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
  "REFRESCOS":           "REFRESCOS",
  "ZUMOS Y LACTEOS":     "ZUMOS Y LACTEOS",
  "MALTAS Y CERVEZAS":   "CERVEZAS Y MALTAS",
  "CERVEZAS Y MALTAS":   "CERVEZAS Y MALTAS",
  "LEGUMBRES":           "LEGUMBRES",
  "HARINAS":             "HARINAS",
  "CAFE Y TE":           "CAFE Y TE",
  "CONDIMENTOS":         "CONDIMENTOS",
  "CONGELADOS":          "CONGELADOS",
  "HELADOS":             "HELADOS",
  "PULPAS":              "PULPAS",
  "REFRIGERADOS":        "REFRIGERADOS",
  "CONSERVAS":           "CONSERVAS",
  "GALLETAS":            "GALLETAS",
  "GOLOSINAS":           "GOLOSINAS",
  "PASTAS":              "PASTAS",
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
function runPythonBulk(items, onLine, timeoutMs = 3600000, signal = null) {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", ["-c", BULK_PYTHON_SCRIPT])
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
  for (const ext of ["jpg", "jpeg"]) {
    const p = path.join(IMAGES_DIR, `${id}.${ext}`)
    if (fs.existsSync(p)) return p
  }
  return null
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

// ── POST /api/generate-pdf ────────────────────────────────
// Body: { marks, size } — marks: bool, size: "A4" | "A5"
app.post("/api/generate-pdf", async (req, res) => {
  const { marks = false, size = "A4" } = req.body ?? {}
  const outputName = "catalogo-impormed-2025.pdf"

  // Tamaño de página para Puppeteer:
  // sin marcas → A4 exacto; con marcas (A4 o A5) → A4 con sangre (el A5 se escala dentro)
  const pageSize = marks ? "216mm 303mm" : "210mm 297mm"

  // Puppeteer apunta directamente al servidor Vite dev que ya está corriendo
  const marksParam = marks ? "1" : "0"
  const viteUrl = `http://localhost:5173?marks=${marksParam}&size=${size}`

  const browser = await puppeteer.launch({ headless: true })

  try {
    const browserPage = await browser.newPage()
    await browserPage.setViewport({ width: 1600, height: 900 })

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

    // CSS de impresión: solo ocultar chrome y resetear layout.
    // El estado (marks/size) ya está correcto porque lo leyó la app desde la URL.
    const printCSS = marks ? `
      .app-chrome { display: none !important; }
      #catalog-area { margin: 0 !important; }
      body { background: white !important; }
      #catalog { gap: 0 !important; padding: 0 !important; }
      #catalog > *, #catalog section > * { box-shadow: none !important; }
      @page { size: ${pageSize}; margin: 0; }
    ` : `
      .app-chrome { display: none !important; }
      #catalog-area { margin: 0 !important; }
      body { background: white !important; }
      #catalog { gap: 0 !important; padding: 0 !important; align-items: flex-start !important; }
      #catalog > *, #catalog section > * { box-shadow: none !important; }
      @page { size: ${pageSize}; margin: 0; }
    `
    await browserPage.addStyleTag({ content: printCSS })

    const pdfBuffer = await browserPage.pdf({
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
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
