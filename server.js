import express from "express"
import cors from "cors"
import { execSync, spawn } from "child_process"
import { createServer } from "net"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import puppeteer from "puppeteer"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(cors())
app.use(express.json())

const IMAGES_DIR = path.join(__dirname, "public/images")
const NOBG_DIR = path.join(__dirname, "public/images-nobg")

// Encuentra el archivo original de una imagen (jpg o jpeg)
function findOriginal(id) {
  for (const ext of ["jpg", "jpeg"]) {
    const p = path.join(IMAGES_DIR, `${id}.${ext}`)
    if (fs.existsSync(p)) return p
  }
  return null
}

// POST /api/revert/:id — el cliente ya muestra el JPG original directamente,
// este endpoint solo confirma que el original existe
app.post("/api/revert/:id", (req, res) => {
  const { id } = req.params
  const original = findOriginal(id)
  if (!original) return res.status(404).json({ error: "Original no encontrado" })
  res.json({ ok: true, message: "Mostrando imagen original" })
})

// POST /api/remove-bg/:id — pasa rembg sobre el JPG original y guarda en images-nobg
app.post("/api/remove-bg/:id", (req, res) => {
  const { id } = req.params
  const original = findOriginal(id)
  if (!original) return res.status(404).json({ error: "Original no encontrado" })

  const dest = path.join(NOBG_DIR, `${id}.png`)
  try {
    execSync(
      `python3 -c "
from rembg import remove
from PIL import Image
import io

with open('${original}', 'rb') as f:
    data = f.read()
result = remove(data)

# Componer sobre fondo gris #f5f5f5 para que el PDF lo respete
fg = Image.open(io.BytesIO(result)).convert('RGBA')
bg = Image.new('RGBA', fg.size, (245, 245, 245, 255))
bg.paste(fg, mask=fg.split()[3])
final = bg.convert('RGB')
final.save('${dest}', 'PNG')
"`,
      { timeout: 60000 }
    )
    res.json({ ok: true, message: "Fondo eliminado con rembg" })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── POST /api/generate-pdf ────────────────────────────────
// Body: { marks } — true = con marcas de corte (A4), false = sin marcas (A5)
app.post("/api/generate-pdf", async (req, res) => {
  const { marks = false } = req.body ?? {}
  const outputName = "catalogo-impormed-2025.pdf"

  const PAGE_W_MM = marks ? 210 : 148
  const PAGE_H_MM = marks ? 297 : 210

  // Puerto libre para servir el build de Vite
  const freePort = await new Promise((resolve) => {
    const srv = createServer()
    srv.listen(0, () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })

  const staticServer = spawn(
    "npx",
    ["serve", "dist", "--listen", String(freePort), "--no-clipboard"],
    { cwd: __dirname, stdio: "pipe" }
  )
  await new Promise((r) => setTimeout(r, 1500))

  const browser = await puppeteer.launch({ headless: true })

  try {
    const browserPage = await browser.newPage()
    await browserPage.setViewport({ width: 1600, height: 900 })
    await browserPage.goto(`http://localhost:${freePort}`, {
      waitUntil: "networkidle0",
      timeout: 60000,
    })

    // Esperar imágenes
    await browserPage.evaluate(() =>
      Promise.all(
        [...document.images]
          .filter(img => !img.complete)
          .map(img => new Promise(r => { img.onload = r; img.onerror = r }))
      )
    )

    // Sincronizar el toggle de marcas con el parámetro recibido
    const switchOn = await browserPage.evaluate(() =>
      document.querySelector('[role="switch"]')?.getAttribute("aria-checked") === "true"
    )
    if (switchOn !== marks) {
      await browserPage.click('[role="switch"]')
      await new Promise(r => setTimeout(r, 500))
    }
    await new Promise(r => setTimeout(r, 800))

    // Inyectar CSS de impresión: ocultar chrome, resetear márgenes, configurar @page
    const printCSS = marks ? `
      .app-chrome { display: none !important; }
      #catalog-area { margin: 0 !important; }
      body { background: white !important; }
      #catalog { gap: 0 !important; padding: 0 !important; }
      #catalog > *, #catalog section > * { box-shadow: none !important; }
      @page { size: 210mm 297mm; margin: 0; }
    ` : `
      .app-chrome { display: none !important; }
      #catalog-area { margin: 0 !important; }
      body { background: white !important; }
      #catalog { gap: 0 !important; padding: 0 !important; align-items: flex-start !important; }
      #catalog > *, #catalog section > * { box-shadow: none !important; }
      [class*="sheetNormal"] { display: contents !important; }
      @page { size: 148mm 210mm; margin: 0; }
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
    staticServer.kill()
  }
})

app.listen(3001, () => {
  console.log("Servidor de imágenes en http://localhost:3001")
})
