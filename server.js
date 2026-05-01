import express from "express"
import cors from "cors"
import { execSync, spawn } from "child_process"
import { createServer } from "net"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

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
// Body: { width, height, landscape, bleed, marks, media, outputName }
app.post("/api/generate-pdf", async (req, res) => {
  const {
    width = 210,
    height = 297,
    landscape = false,
    bleed = "3mm",
    marks = true,
    media = "print",
    outputName = "catalogo-impormed-2025.pdf",
  } = req.body ?? {}

  const outputPath = path.join(__dirname, outputName)

  // Genera CSS extra para @page según las opciones
  const pageW = landscape ? height : width
  const pageH = landscape ? width : height
  const bleedValue = bleed || "0"
  const marksValue = marks ? "crop cross" : "none"

  const extraCss = `
@page {
  size: ${pageW}mm ${pageH}mm;
  bleed: ${bleedValue};
  marks: ${marksValue};
}
`
  const tmpCss = path.join(__dirname, "_print-options.css")
  fs.writeFileSync(tmpCss, extraCss)

  // Puerto libre para servir el build de Vite (ya tiene que estar en dist/)
  const freePort = await new Promise((resolve) => {
    const srv = createServer()
    srv.listen(0, () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })

  // Servir el build estático
  const staticServer = spawn(
    "npx",
    ["serve", "dist", "--listen", String(freePort), "--no-clipboard"],
    { cwd: __dirname, stdio: "pipe" }
  )

  await new Promise((r) => setTimeout(r, 2000))

  try {
    const cmd = [
      "pagedjs-cli",
      `http://localhost:${freePort}`,
      "-o", outputPath,
      "--style", tmpCss,
      "--media", media,
      "--timeout", "120000",
    ]
    if (landscape) cmd.push("-l")

    execSync(cmd.join(" "), { stdio: "pipe" })

    res.json({ ok: true, file: outputName })
  } catch (e) {
    res.status(500).json({ error: e.message })
  } finally {
    staticServer.kill()
    fs.unlinkSync(tmpCss)
  }
})

app.listen(3001, () => {
  console.log("Servidor de imágenes en http://localhost:3001")
})
