import express from "express"
import cors from "cors"
import { execSync } from "child_process"
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

app.listen(3001, () => {
  console.log("Servidor de imágenes en http://localhost:3001")
})
