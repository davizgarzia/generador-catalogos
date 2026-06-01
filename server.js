import express from "express"
import cors from "cors"
import { execSync, spawn } from "child_process"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import puppeteer from "puppeteer"
import multer from "multer"
import XLSX from "xlsx"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(cors())
app.use(express.json())

const IMAGES_DIR   = path.join(__dirname, "public/images")
const NOBG_DIR     = path.join(__dirname, "public/images-nobg")
const OVERRIDES_PATH = path.join(__dirname, "src/data/overrides.json")
const PRODUCTS_PATH  = path.join(__dirname, "src/data/products.js")

// Mapeo de familias del Excel → claves de categoría del catálogo
const EXCEL_FAMILY_MAP = {
  "ALCOHOLES":           "ALCOHOL",
  "REFRESCOS":           "REFRESCOS, MALTAS Y CERVEZAS",
  "ZUMOS Y LACTEOS":     "ZUMOS Y LACTEOS",
  "MALTAS Y CERVEZAS":   "REFRESCOS, MALTAS Y CERVEZAS",
  "CERVEZAS Y MALTAS":   "REFRESCOS, MALTAS Y CERVEZAS",
  "LEGUMBRES":           "LEGUMBRES",
  "HARINAS":             "HARINAS Y PASTAS",
  "CAFE Y TE":           "CAFE Y TE",
  "CONDIMENTOS":         "CONDIMENTOS",
  "CONGELADOS":          "CONGELADOS",
  "HELADOS":             "HELADOS",
  "PULPAS":              "PULPAS",
  "REFRIGERADOS":        "REFRIGERADOS",
  "CONSERVAS":           "CONSERVAS",
  "GALLETAS":            "GALLETAS",
  "GOLOSINAS":           "GOLOSINAS",
  "PASTAS":              "HARINAS Y PASTAS",
  "SNAKS":               "SNAKS",
  "UTENSILIOS":          "UTENSILIOS",
  "HIGIENE Y COSMETICA": "HIGIENE Y COSMETICA",
}

const upload = multer({ storage: multer.memoryStorage() })

function readOverrides() {
  try { return JSON.parse(fs.readFileSync(OVERRIDES_PATH, "utf8")) }
  catch { return {} }
}
function writeOverrides(data) {
  fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(data, null, 2))
}

// Mapa de jobs bulk activos: jobId → AbortController
const bulkJobs = new Map()

// Script Python: quita fondo con withoutbg (local, ONNX, mejor calidad)
function makePythonScript(src, dest) {
  return `
from withoutbg.core import WithoutBG

model = WithoutBG.opensource()
result = model.remove_background(${JSON.stringify(src)})
result.save(${JSON.stringify(dest)}, 'PNG')
`
}

// Script Python para bulk: carga el modelo UNA vez, procesa lista de imágenes
// Recibe por stdin una línea JSON: [{id, src, dest}, ...]
// Imprime por stdout una línea JSON por imagen: {id, ok, error?}
const BULK_PYTHON_SCRIPT = `
import sys, json
from withoutbg.core import WithoutBG

model = WithoutBG.opensource()

data = json.loads(sys.stdin.readline())
for item in data:
    try:
        result = model.remove_background(item['src'])
        result.save(item['dest'], 'PNG')
        print(json.dumps({'id': item['id'], 'ok': True}), flush=True)
    except Exception as e:
        print(json.dumps({'id': item['id'], 'ok': False, 'error': str(e)[:200]}), flush=True)
`

// Script Python para autoencajar imágenes en las tarjetas.
// Detecta el bounding box visual ignorando transparencia y fondos casi blancos.
// Devuelve {id, ok, imgScale, imgX, imgY} por stdout en líneas JSON.
const AUTO_FIT_PYTHON_SCRIPT = `
import sys, json, math
from PIL import Image

# Medidas aproximadas del hueco de imagen con ProductGrid 3x3.
# La tarjeta ocupa 2 columnas internas de una grid de 6; el alto descuenta
# el bloque fijo de texto del producto.
CONTAINER_W = 64.7
CONTAINER_H = 67.0
TARGET_W = CONTAINER_W * 0.86
TARGET_H = CONTAINER_H * 0.84

def clamp(value, low, high):
    return max(low, min(high, value))

def median(values):
    values = sorted(values)
    if not values:
        return 255
    return values[len(values) // 2]

def background_color(pixels, w, h):
    sample = []
    edge = max(2, min(w, h) // 20)
    for y in range(h):
        for x in range(w):
            if x < edge or x >= w - edge or y < edge or y >= h - edge:
                r, g, b, a = pixels[x, y]
                if a > 16:
                    sample.append((r, g, b))
    if not sample:
        return (255, 255, 255)
    return tuple(median([p[i] for p in sample]) for i in range(3))

def bbox_for(path):
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    pixels = im.load()
    bg = background_color(pixels, w, h)
    bg_is_light = sum(bg) / 3 > 210

    min_x, min_y = w, h
    max_x, max_y = -1, -1

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a <= 16:
                continue

            if bg_is_light:
                dist = math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2)
                chroma = max(r, g, b) - min(r, g, b)
                # Evita que sombras JPEG muy suaves expandan el bbox, pero conserva
                # etiquetas claras si forman parte de una silueta coloreada.
                if dist < 30 and chroma < 18 and a > 245:
                    continue

            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)

    if max_x < min_x or max_y < min_y:
        return None

    return {
        "w": w,
        "h": h,
        "x": min_x,
        "y": min_y,
        "bw": max_x - min_x + 1,
        "bh": max_y - min_y + 1,
    }

def fit_for(path):
    box = bbox_for(path)
    if not box:
        return None

    w = box["w"]
    h = box["h"]
    bw = box["bw"]
    bh = box["bh"]

    base = min(CONTAINER_W / w, CONTAINER_H / h)
    rendered_bw = bw * base
    rendered_bh = bh * base
    if rendered_bw <= 0 or rendered_bh <= 0:
        return None

    scale = min(TARGET_W / rendered_bw, TARGET_H / rendered_bh)
    scale = round(clamp(scale, 0.8, 1.95), 2)

    cx = box["x"] + bw / 2
    cy = box["y"] + bh / 2
    img_x = round(clamp((0.5 - cx / w) * 100, -35, 35), 1)
    img_y = round(clamp((0.5 - cy / h) * 100, -35, 35), 1)

    return {
        "imgScale": scale,
        "imgX": img_x,
        "imgY": img_y,
    }

items = json.loads(sys.stdin.readline())
for item in items:
    try:
        fit = fit_for(item["src"])
        if fit:
            print(json.dumps({"id": item["id"], "ok": True, **fit}), flush=True)
        else:
            print(json.dumps({"id": item["id"], "ok": False, "error": "No se pudo detectar producto"}), flush=True)
    except Exception as e:
        print(json.dumps({"id": item["id"], "ok": False, "error": str(e)[:200]}), flush=True)
`

function readProducts() {
  const currentText = fs.existsSync(PRODUCTS_PATH) ? fs.readFileSync(PRODUCTS_PATH, "utf8") : ""
  const blocks = currentText.match(/\{\s*id:\s*"[^"]+"[\s\S]*?\n\s*\}/g) ?? []
  return blocks.map(block => {
    const readString = (field) => block.match(new RegExp(`${field}:\\s*"([^"]*)"`))?.[1] ?? null
    const id = readString("id")
    const image = readString("image")
    return id ? {
      id,
      name: readString("name") ?? "",
      fullName: readString("fullName") ?? "",
      unitsLabel: readString("unitsLabel") ?? "",
      category: readString("category") ?? "",
      image,
    } : null
  }).filter(Boolean)
}

function parseDecimal(value) {
  return Number.parseFloat(String(value).replace(",", "."))
}

function detectVolumeMl(text) {
  const normalized = text.toUpperCase().replace(/\s+/g, " ")

  const literMatch = normalized.match(/(\d+(?:[,.]\d+)?)\s*(?:L|LT|LTR|LITRO|LITROS)\b/)
  if (literMatch) return parseDecimal(literMatch[1]) * 1000

  const mlMatch = normalized.match(/(\d+(?:[,.]\d+)?)\s*(?:ML|M\.L\.|CC|CL)\b/)
  if (mlMatch) {
    const value = parseDecimal(mlMatch[1])
    // En el Excel aparecen algunos "0,700 CL" que realmente representan 700 ml.
    if (value > 0 && value < 10) return value * 1000
    if (normalized.includes("CL") && value <= 100) return value * 10
    return value
  }

  const bareLargeBottle = normalized.match(/\b(1500|1750|2000)\b/)
  if (bareLargeBottle) return Number.parseInt(bareLargeBottle[1], 10)

  return null
}

function detectWeightG(text) {
  const normalized = text.toUpperCase().replace(/\s+/g, " ")

  const kgMatch = normalized.match(/(\d+(?:[,.]\d+)?)\s*(?:KG|KILO|KILOS)\b/)
  if (kgMatch) return parseDecimal(kgMatch[1]) * 1000

  const gMatch = normalized.match(/(\d+(?:[,.]\d+)?)\s*(?:GR|G|GRAMOS)\b/)
  if (gMatch) return parseDecimal(gMatch[1])

  return null
}

function visualScaleAdjustment(product) {
  const text = `${product.name} ${product.fullName} ${product.unitsLabel}`.toUpperCase()
  const volumeMl = detectVolumeMl(text)
  if (volumeMl) {
    if (volumeMl <= 250) return 0.68
    if (volumeMl <= 355) return 0.74
    if (volumeMl <= 500) return 0.84
    if (volumeMl <= 750) return 1
    if (volumeMl <= 1000) return 1.12
    if (volumeMl <= 1500) return 1.32
    return 1.5
  }

  const weightG = detectWeightG(text)
  if (weightG) {
    if (weightG <= 100) return 0.72
    if (weightG <= 250) return 0.82
    if (weightG <= 500) return 1
    if (weightG <= 1000) return 1.12
    return 1.28
  }

  if (/\b(LATA|CAN|330|355)\b/.test(text)) return 0.74
  if (/\b(2L|2 L|1\.5L|1,5L|1\.75L|1,75L|GARRAFA|PET)\b/.test(text)) return 1.42

  return 1
}

// Ejecuta el script Python de forma async (no bloquea el event loop)
// signal: AbortSignal opcional — si se aborta, mata el proceso Python
function runPython(script, timeoutMs = 120000, signal = null) {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", ["-c", script])
    const stderr = []
    proc.stderr.on("data", d => stderr.push(d))

    const timer = setTimeout(() => { proc.kill(); reject(new Error("timeout")) }, timeoutMs)

    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer)
        proc.kill()
        return reject(new Error("aborted"))
      }
      signal.addEventListener("abort", () => {
        clearTimeout(timer)
        proc.kill()
        reject(new Error("aborted"))
      }, { once: true })
    }

    proc.on("close", code => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(Buffer.concat(stderr).toString().slice(0, 300)))
    })
  })
}

// Ejecuta el script Python bulk: recibe lista de tareas por stdin,
// emite líneas JSON por stdout a medida que procesa cada imagen.
// onLine(parsedObj) se llama por cada línea de stdout.
// signal: AbortSignal opcional — mata el proceso al abortar.
function runPythonBulk(items, onLine, timeoutMs = 3600000, signal = null, script = BULK_PYTHON_SCRIPT) {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", ["-c", script])
    const stderr = []
    proc.stderr.on("data", d => stderr.push(d))

    const timer = setTimeout(() => { proc.kill(); reject(new Error("timeout")) }, timeoutMs)

    if (signal) {
      if (signal.aborted) { clearTimeout(timer); proc.kill(); return reject(new Error("aborted")) }
      signal.addEventListener("abort", () => {
        clearTimeout(timer); proc.kill(); reject(new Error("aborted"))
      }, { once: true })
    }

    // Enviar la lista de tareas al stdin del proceso Python
    proc.stdin.write(JSON.stringify(items) + "\n")
    proc.stdin.end()

    // Leer stdout línea a línea
    let buf = ""
    proc.stdout.on("data", chunk => {
      buf += chunk.toString()
      const lines = buf.split("\n")
      buf = lines.pop() // último fragmento incompleto
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try { onLine(JSON.parse(trimmed)) } catch { /* ignorar líneas malformadas */ }
      }
    })

    proc.on("close", code => {
      clearTimeout(timer)
      // Procesar cualquier línea restante en el buffer
      if (buf.trim()) {
        try { onLine(JSON.parse(buf.trim())) } catch {}
      }
      if (code === 0 || signal?.aborted) resolve()
      else reject(new Error(Buffer.concat(stderr).toString().slice(0, 300)))
    })
  })
}

function findOriginal(id) {
  for (const ext of ["jpg", "jpeg", "png", "webp"]) {
    const p = path.join(IMAGES_DIR, `${id}.${ext}`)
    if (fs.existsSync(p)) return p
  }
  return null
}

function findImageForFit(product, overrides) {
  const nobg = path.join(NOBG_DIR, `${product.id}.png`)
  if (overrides[product.id]?.imgMode === "nobg" && fs.existsSync(nobg)) return nobg

  if (product.image) {
    const rel = product.image.replace(/^\/+/, "")
    const fromProduct = path.join(__dirname, "public", rel)
    if (fs.existsSync(fromProduct)) return fromProduct
  }

  return findOriginal(product.id)
}

// GET /api/overrides — devuelve todos los overrides
app.get("/api/overrides", (req, res) => {
  res.json(readOverrides())
})

// PATCH /api/overrides/:id — mergea campos en el override de un producto
app.patch("/api/overrides/:id", (req, res) => {
  const { id } = req.params
  const overrides = readOverrides()
  overrides[id] = { ...(overrides[id] ?? {}), ...req.body }
  writeOverrides(overrides)
  res.json({ ok: true, override: overrides[id] })
})

// POST /api/revert/:id — el cliente ya muestra el JPG original directamente,
// este endpoint solo confirma que el original existe
app.post("/api/revert/:id", (req, res) => {
  const { id } = req.params
  const original = findOriginal(id)
  if (!original) return res.status(404).json({ error: "Original no encontrado" })
  res.json({ ok: true, message: "Mostrando imagen original" })
})

// POST /api/upload/:id — sube una imagen y la guarda en images-nobg/<id>.png
app.post("/api/upload/:id", upload.single("image"), (req, res) => {
  const { id } = req.params
  if (!req.file) return res.status(400).json({ error: "No se recibió ningún archivo" })

  const dest = path.join(NOBG_DIR, `${id}.png`)
  try {
    fs.writeFileSync(dest, req.file.buffer)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/nobg-exists/:id — comprueba si ya existe el PNG sin fondo
app.get("/api/nobg-exists/:id", (req, res) => {
  const { id } = req.params
  const exists = fs.existsSync(path.join(NOBG_DIR, `${id}.png`))
  res.json({ exists })
})

// POST /api/remove-bg/:id — pasa rembg sobre el JPG original y guarda en images-nobg
app.post("/api/remove-bg/:id", async (req, res) => {
  const { id } = req.params
  const original = findOriginal(id)
  if (!original) return res.status(404).json({ error: "Original no encontrado" })

  const dest = path.join(NOBG_DIR, `${id}.png`)
  try {
    await runPython(makePythonScript(original, dest))
    res.json({ ok: true, message: "Fondo eliminado con rembg" })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── POST /api/remove-bg-bulk ──────────────────────────────────────────────────
// Procesa en bulk todos los productos con imagen original.
// Usa withoutbg con un solo proceso Python (modelo cargado una vez en RAM).
// Responde con SSE: cada línea es un JSON { done, total, id, ok, error? }
// Al final envía { done: total, total, finished: true }
// Query params:
//   ?ids=id1,id2,...  → solo esos IDs (opcional; si se omite, todos los que tienen imagen original)
app.post("/api/remove-bg-bulk", async (req, res) => {
  // jobId para poder abortar desde /api/remove-bg-bulk/stop
  const jobId = Date.now().toString()
  const ac = new AbortController()
  bulkJobs.set(jobId, ac)

  // Determinar qué IDs procesar
  let ids
  if (req.query.ids) {
    ids = req.query.ids.split(",").map(s => s.trim()).filter(Boolean)
  } else {
    ids = fs.readdirSync(IMAGES_DIR)
      .filter(f => /\.(jpe?g|png)$/i.test(f))
      .map(f => path.basename(f, path.extname(f)))
  }

  // Construir lista de tareas (solo las que tienen imagen original)
  const tasks = ids.flatMap(id => {
    const original = findOriginal(id)
    if (!original) return []
    const dest = path.join(NOBG_DIR, `${id}.png`)
    return [{ id, src: original, dest }]
  })

  const skipped = ids.length - tasks.length
  const total = ids.length

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")
  res.flushHeaders()

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)

  // Enviar jobId al cliente para que pueda llamar al endpoint stop
  send({ jobId, total })

  // Notificar los skipped de inmediato
  let done = 0
  for (const id of ids) {
    if (!tasks.find(t => t.id === id)) {
      done++
      send({ done, total, id, ok: false, error: "Sin imagen original" })
    }
  }

  try {
    await runPythonBulk(
      tasks,
      (result) => {
        if (ac.signal.aborted) return
        done++
        // Persistir imgMode: nobg si ok
        if (result.ok) {
          const overrides = readOverrides()
          overrides[result.id] = { ...(overrides[result.id] ?? {}), imgMode: "nobg" }
          writeOverrides(overrides)
        }
        send({ done, total, id: result.id, ok: result.ok, error: result.error })
      },
      3600000,
      ac.signal
    )
  } catch (e) {
    if (e.message !== "aborted") {
      send({ done, total, id: null, ok: false, error: e.message?.slice(0, 200) })
    }
  }

  bulkJobs.delete(jobId)
  send({ done, total, finished: true, stopped: ac.signal.aborted })
  res.end()
})

// POST /api/remove-bg-bulk/stop — aborta un job bulk en curso
app.post("/api/remove-bg-bulk/stop", (req, res) => {
  const { jobId } = req.body ?? {}
  const job = bulkJobs.get(jobId)
  if (!job) return res.status(404).json({ error: "Job no encontrado o ya terminado" })
  job.abort()
  bulkJobs.delete(jobId)
  res.json({ ok: true, jobId })
})

// ── POST /api/auto-fit-images-bulk ───────────────────────────────────────────
// Calcula imgScale/imgX/imgY para que el producto ocupe más espacio en su tarjeta.
// No modifica imágenes; solo persiste overrides. Responde por SSE.
app.post("/api/auto-fit-images-bulk", async (req, res) => {
  const products = readProducts()
  const overrides = readOverrides()
  const productsById = new Map(products.map(product => [product.id, product]))
  const tasks = products.flatMap(product => {
    const src = findImageForFit(product, overrides)
    return src ? [{ id: product.id, src }] : []
  })

  const total = products.length
  let done = 0
  let fitted = 0
  let skipped = total - tasks.length

  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")
  res.flushHeaders()

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)
  send({ total })

  const taskIds = new Set(tasks.map(t => t.id))
  for (const product of products) {
    if (!taskIds.has(product.id)) {
      done++
      send({ done, total, id: product.id, ok: false, skipped: true, error: "Sin imagen" })
    }
  }

  try {
    await runPythonBulk(
      tasks,
      (result) => {
        done++
        if (result.ok) {
          fitted++
          const product = productsById.get(result.id)
          const scaleAdjustment = product ? visualScaleAdjustment(product) : 1
          const imgScale = Math.round(Math.max(0.7, Math.min(2.1, result.imgScale * scaleAdjustment)) * 100) / 100
          const current = readOverrides()
          current[result.id] = {
            ...(current[result.id] ?? {}),
            imgScale,
            imgX: result.imgX,
            imgY: result.imgY,
          }
          writeOverrides(current)
          result.imgScale = imgScale
          result.scaleAdjustment = scaleAdjustment
        } else {
          skipped++
        }
        send({ done, total, ...result })
      },
      3600000,
      null,
      AUTO_FIT_PYTHON_SCRIPT
    )
  } catch (e) {
    send({ done, total, id: null, ok: false, error: e.message?.slice(0, 200) })
  }

  send({ done, total, fitted, skipped, finished: true })
  res.end()
})

// ── POST /api/generate-pdf ────────────────────────────────
// Body: { marks, size } — marks: bool, size: "A4" | "A5"
app.post("/api/generate-pdf", async (req, res) => {
  const { marks = false, size = "A4", draft = false, grid = "4x4" } = req.body ?? {}
  const outputName = "catalogo-impormed-2025.pdf"

  // Tamaño de página para Puppeteer:
  // sin marcas → A4 exacto; con marcas (A4 o A5) → A4 con sangre (el A5 se escala dentro)
  const pageSize = marks ? "216mm 303mm" : "210mm 297mm"

  // Puppeteer apunta directamente al servidor Vite dev que ya está corriendo
  const marksParam = marks ? "1" : "0"
  const draftParam = draft ? "1" : "0"
  const gridParam = ["3x3", "4x3", "4x4"].includes(grid) ? grid : "4x4"
  const viteUrl = `http://localhost:5173?marks=${marksParam}&size=${size}&draft=${draftParam}&grid=${gridParam}`

  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 300000,
  })

  try {
    const browserPage = await browser.newPage()
    browserPage.setDefaultTimeout(300000)
    browserPage.setDefaultNavigationTimeout(300000)
    await browserPage.setViewport({
      width: 1600,
      height: 900,
      // Renderiza las capturas a más resolución para que textos y producto
      // no queden blandos al montar el PDF rasterizado.
      deviceScaleFactor: draft ? 1 : 2.5,
    })

    await browserPage.goto(viteUrl, { waitUntil: "networkidle0", timeout: 60000 })

    // Esperar imágenes
    await browserPage.evaluate(() =>
      Promise.all(
        [...document.images]
          .filter(img => !img.complete)
          .map(img => new Promise(r => { img.onload = r; img.onerror = r }))
      )
    )
    await new Promise(r => setTimeout(r, 800))

    // CSS para aislar las páginas antes de capturarlas una a una.
    // Evitamos delegar el paginado completo a Chromium porque con muchas páginas,
    // wrappers y assets grandes puede generar hojas vacías y PDFs enormes.
    const printCSS = marks ? `
      .app-chrome { display: none !important; }
      #catalog-area { margin: 0 !important; }
      body { background: white !important; }
      #catalog { gap: 0 !important; padding: 0 !important; }
      #catalog section { gap: 0 !important; }
      #catalog > *, #catalog section > * { box-shadow: none !important; }
      @page { size: ${pageSize}; margin: 0; }
    ` : `
      .app-chrome { display: none !important; }
      #catalog-area { margin: 0 !important; }
      body { background: white !important; }
      #catalog { gap: 0 !important; padding: 0 !important; align-items: flex-start !important; }
      #catalog section { gap: 0 !important; }
      #catalog > *, #catalog section > * { box-shadow: none !important; }
      @page { size: ${pageSize}; margin: 0; }
    `
    await browserPage.addStyleTag({ content: printCSS })

    const boxes = await browserPage.evaluate(() => {
      const pages = [...document.querySelectorAll('[class*="sheet"]')]
      return pages
        .map((el) => {
          const r = el.getBoundingClientRect()
          return {
            x: r.left + window.scrollX,
            y: r.top + window.scrollY,
            width: r.width,
            height: r.height,
          }
        })
        .filter((box) => box.width > 0 && box.height > 0)
    })

    if (!boxes.length) {
      throw new Error("No se encontraron páginas para generar el PDF")
    }

    const screenshots = []
    for (const box of boxes) {
      const jpg = await browserPage.screenshot({
        type: "jpeg",
        quality: draft ? 86 : 94,
        captureBeyondViewport: true,
        clip: {
          x: Math.max(0, box.x),
          y: Math.max(0, box.y),
          width: box.width,
          height: box.height,
        },
      })
      screenshots.push(Buffer.from(jpg).toString("base64"))
    }

    const [pageWidth, pageHeight] = pageSize.split(" ")
    const pdfPage = await browser.newPage()
    pdfPage.setDefaultTimeout(300000)

    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { background: white; }
            @page { size: ${pageSize}; margin: 0; }
            .pdf-page {
              width: ${pageWidth};
              height: ${pageHeight};
              page-break-after: always;
              break-after: page;
              overflow: hidden;
            }
            .pdf-page:last-child {
              page-break-after: auto;
              break-after: auto;
            }
            img {
              width: 100%;
              height: 100%;
              display: block;
              object-fit: fill;
            }
          </style>
        </head>
        <body>
          ${screenshots.map((image) => `<div class="pdf-page"><img src="data:image/jpeg;base64,${image}" /></div>`).join("")}
        </body>
      </html>`

    await pdfPage.setContent(html, { waitUntil: "load", timeout: 300000 })

    const pdfBuffer = await pdfPage.pdf({
      width: pageWidth,
      height: pageHeight,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      timeout: 300000,
    })

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="${outputName}"`)
    res.send(Buffer.from(pdfBuffer))
  } catch (e) {
    res.status(500).json({ error: e.message })
  } finally {
    await browser.close()
  }
})

// ── POST /api/import-excel ────────────────────────────────────────────────────
// Recibe un .xlsx, devuelve un resumen de cambios (preview).
// Con ?confirm=1 aplica los cambios a products.js.
app.post("/api/import-excel", upload.single("excel"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se recibió ningún archivo" })

  try {
    // Parsear Excel
    const wb = XLSX.read(req.file.buffer, { type: "buffer" })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

    // Cabecera esperada: Artículo | Nombre artículo | Unidades | Nombre de familia | Artículo de baja
    const newProducts = []
    for (let i = 1; i < rows.length; i++) {
      const [id, fullName, , family, baja] = rows[i]
      if (!id || !fullName || !family) continue
      if (String(baja).toLowerCase() === "sí" || String(baja).toLowerCase() === "si") continue

      const category = EXCEL_FAMILY_MAP[String(family).trim().toUpperCase()]
      if (!category) continue // familia desconocida → ignorar

      // Extraer unitsLabel del nombre: busca patrones como (12UXC), (6 UxC), (24 Uds), etc.
      const unitsMatch = String(fullName).match(/\(\s*(\d+\s*[Uu][xXsS][a-zA-Z\.]*\s*[^\)]*)\)/i)
      const unitsLabel = unitsMatch ? unitsMatch[0].replace(/[()]/g, "").trim() : null

      // Nombre limpio: quita la parte de unidades y espacios extra
      const name = String(fullName)
        .replace(/\s*\([^)]*[Uu][xXsS][^)]*\)/gi, "")
        .replace(/\s+/g, " ")
        .trim()

      // Detectar si existe imagen
      const strId = String(id).trim()
      let image = null
      for (const ext of ["jpg", "jpeg", "png"]) {
        if (fs.existsSync(path.join(IMAGES_DIR, `${strId}.${ext}`))) {
          image = `/images/${strId}.${ext}`
          break
        }
      }

      newProducts.push({ id: strId, name, fullName: String(fullName).trim(), unitsLabel, category, image })
    }

    // Leer productos actuales para calcular diff
    const currentText = fs.existsSync(PRODUCTS_PATH) ? fs.readFileSync(PRODUCTS_PATH, "utf8") : ""
    const currentIds = new Set([...currentText.matchAll(/id:\s*"([^"]+)"/g)].map(m => m[1]))
    const newIds = new Set(newProducts.map(p => p.id))

    const added   = newProducts.filter(p => !currentIds.has(p.id)).map(p => p.id)
    const removed = [...currentIds].filter(id => !newIds.has(id))
    const kept    = newProducts.filter(p => currentIds.has(p.id)).length

    const summary = {
      total: newProducts.length,
      added: added.length,
      removed: removed.length,
      kept,
      addedIds: added.slice(0, 20),   // muestra hasta 20 en preview
      removedIds: removed.slice(0, 20),
    }

    // Si no viene ?confirm=1, sólo devolver el resumen (preview)
    if (req.query.confirm !== "1") {
      return res.json({ ok: true, preview: true, summary })
    }

    // ── CONFIRMAR: escribir products.js ──────────────────────────────────────
    const lines = newProducts.map(p => {
      const img = p.image ? `"/images/${p.id}.jpg"` : "null"
      return `  {
    id: "${p.id}",
    name: ${JSON.stringify(p.name)},
    fullName: ${JSON.stringify(p.fullName)},
    unitsLabel: ${p.unitsLabel ? JSON.stringify(p.unitsLabel) : "null"},
    category: "${p.category}",
    image: ${img},
  },`
    })

    const fileContent = `// Generado automáticamente por import-excel — ${new Date().toISOString()}
// Para añadir o editar productos, edita este archivo directamente o sube un nuevo Excel.

const products = [
${lines.join("\n")}
]

export default products
`
    fs.writeFileSync(PRODUCTS_PATH, fileContent, "utf8")

    res.json({ ok: true, preview: false, summary })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── POST /api/import-images ───────────────────────────────────────────────────
// Recibe múltiples imágenes (campo "images"), las nombra por su nombre original
// (sin extensión = id del producto), las copia a public/images/ y actualiza
// products.js para rellenar los campos image: null que ahora tienen match.
//
// Sin ?confirm=1 → solo devuelve preview (cuántas matchean, cuántas son nuevas)
// Con ?confirm=1 → copia archivos y actualiza products.js
const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,   // 20 MB por imagen
    files: 5000,                   // hasta 5000 archivos por subida
  },
  fileFilter: (req, file, cb) => {
    const ok = /\.(jpe?g|png|webp)$/i.test(file.originalname)
    cb(null, ok)
  },
})

app.post("/api/import-images", (req, res) => {
  uploadImages.array("images", 5000)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message })
    if (!req.files?.length) return res.status(400).json({ error: "No se recibieron imágenes" })

  try {
    // Leer products.js actual para saber qué IDs existen
    const currentText = fs.existsSync(PRODUCTS_PATH) ? fs.readFileSync(PRODUCTS_PATH, "utf8") : ""
    const productIds = new Set([...currentText.matchAll(/id:\s*"([^"]+)"/g)].map(m => m[1]))

    // Para cada archivo recibido, calcular el id (nombre sin extensión)
    const results = req.files.map(file => {
      const ext = path.extname(file.originalname).toLowerCase() // .jpg / .png / …
      const id  = path.basename(file.originalname, ext).trim()
      const matchesProduct = productIds.has(id)
      const destName = `${id}${ext}`
      const destPath = path.join(IMAGES_DIR, destName)
      const alreadyExists = fs.existsSync(destPath)
      return { id, ext, destName, destPath, buffer: file.buffer, matchesProduct, alreadyExists }
    })

    const matched   = results.filter(r => r.matchesProduct)
    const unmatched = results.filter(r => !r.matchesProduct)
    const newImages = matched.filter(r => !r.alreadyExists)
    const replaced  = matched.filter(r =>  r.alreadyExists)

    const summary = {
      total:     req.files.length,
      matched:   matched.length,
      unmatched: unmatched.length,
      newImages: newImages.length,
      replaced:  replaced.length,
      unmatchedIds: unmatched.map(r => r.id).slice(0, 20),
    }

    if (req.query.confirm !== "1") {
      return res.json({ ok: true, preview: true, summary })
    }

    // ── CONFIRMAR: copiar archivos y actualizar products.js ──────────────────
    let copied = 0
    for (const r of matched) {
      fs.writeFileSync(r.destPath, r.buffer)
      copied++
    }

    // Actualizar products.js: rellenar image: null → image: "/images/<id>.<ext>"
    // para los productos que ahora tienen archivo
    const idToImage = {}
    for (const r of matched) {
      idToImage[r.id] = `/images/${r.destName}`
    }

    // Reescribir products.js línea a línea sustituyendo sólo los image: null
    // de los productos que ahora tienen match
    let updatedText = currentText
    // Reemplaza bloques id: "XXX" ... image: null por image: "/images/XXX.ext"
    updatedText = updatedText.replace(
      /id:\s*"([^"]+)"([\s\S]*?)image:\s*null/g,
      (match, id, middle) => {
        if (idToImage[id]) {
          return `id: "${id}"${middle}image: "${idToImage[id]}"`
        }
        return match
      }
    )
    // Actualizar comentario de timestamp
    updatedText = updatedText.replace(
      /\/\/ Generado automáticamente[^\n]*/,
      `// Actualizado automáticamente por import-images — ${new Date().toISOString()}`
    )

    fs.writeFileSync(PRODUCTS_PATH, updatedText, "utf8")

    res.json({ ok: true, preview: false, summary: { ...summary, copied } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
  }) // cierra callback uploadImages.array
})

app.listen(3001, () => {
  console.log("Servidor de imágenes en http://localhost:3001")
})
