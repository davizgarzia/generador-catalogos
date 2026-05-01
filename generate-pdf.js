#!/usr/bin/env node
/**
 * generate-pdf.js
 * Genera el PDF del catálogo usando Puppeteer.
 *
 * Estrategia: capturar cada página del catálogo como screenshot PNG
 * a 300 DPI y luego combinarlas en un PDF multi-página.
 */

import { execSync, spawn } from "child_process"
import { createServer } from "net"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { writeFileSync, unlinkSync, existsSync } from "fs"
import puppeteer from "puppeteer"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT = resolve(__dirname, "catalogo-impormed-2025.pdf")

// A5 a 150 DPI: 148mm × 210mm → 874 × 1240 px
const DPI = 150
const MM_TO_PX = DPI / 25.4
const PAGE_W_PX = Math.round(148 * MM_TO_PX)  // 874px
const PAGE_H_PX = Math.round(210 * MM_TO_PX)  // 1240px

// ── 1. Build ──────────────────────────────────────────────
console.log("📦 Building...")
execSync("npm run build", { stdio: "inherit", cwd: __dirname })

// ── 2. Puerto libre ───────────────────────────────────────
async function freePort() {
  return new Promise((res) => {
    const srv = createServer()
    srv.listen(0, () => {
      const { port } = srv.address()
      srv.close(() => res(port))
    })
  })
}

const port = await freePort()

// ── 3. Servidor estático ──────────────────────────────────
console.log(`🌐 Serving dist/ on port ${port}...`)
const server = spawn(
  "npx",
  ["serve", "dist", "--listen", String(port), "--no-clipboard"],
  { cwd: __dirname, stdio: "pipe" }
)
await new Promise((res) => setTimeout(res, 1500))

// ── 4. Puppeteer ──────────────────────────────────────────
const browser = await puppeteer.launch({ headless: true })

try {
  const browserPage = await browser.newPage()

  // Viewport que muestra el layout de 3 paneles correctamente
  await browserPage.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 })

  console.log(`🌐 Loading http://localhost:${port}...`)
  await browserPage.goto(`http://localhost:${port}`, {
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

  // Desactivar marcas de corte si están activas (queremos modo sin sangre)
  const switchOn = await browserPage.evaluate(() => {
    const btn = document.querySelector('[role="switch"]')
    return btn?.getAttribute("aria-checked") === "true"
  })
  if (switchOn) {
    await browserPage.click('[role="switch"]')
    await new Promise(res => setTimeout(res, 500))
  }

  // Esperar a que el layout se estabilice
  await new Promise(res => setTimeout(res, 800))

  // Obtener las bounding boxes de cada .innerNormal
  const boxes = await browserPage.evaluate(() => {
    // Selector que captura los innerNormal hasheados por CSS Modules
    const els = [...document.querySelectorAll('[class*="innerNormal"]')]
    return els.map(el => {
      const r = el.getBoundingClientRect()
      const scrollX = window.scrollX
      const scrollY = window.scrollY
      return {
        x: r.left + scrollX,
        y: r.top + scrollY,
        width: r.width,
        height: r.height,
      }
    })
  })

  console.log(`📄 Páginas detectadas: ${boxes.length}`)
  if (boxes.length === 0) {
    throw new Error("No se encontraron páginas. Verifica que la app cargó correctamente.")
  }

  // Capturar cada página como PNG
  const pngBuffers = []
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i]
    process.stdout.write(`  📸 Capturando página ${i + 1}/${boxes.length}...\r`)

    const png = await browserPage.screenshot({
      clip: {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      },
      encoding: "binary",
      // Scale up para conseguir más resolución
      omitBackground: false,
    })
    pngBuffers.push(Buffer.from(png, "binary"))
  }
  console.log(`\n✅ ${boxes.length} páginas capturadas`)

  // ── 5. Combinar PNGs en PDF ───────────────────────────────
  // Usamos una página puppeteer vacía para generar el PDF multi-página
  // cargando cada imagen como fondo de una página A5
  console.log("📎 Combinando en PDF...")

  const pdfPage = await browser.newPage()

  // Construir HTML con una <div> por página, cada una con la imagen embebida
  const pages = pngBuffers.map((buf, i) => {
    const b64 = buf.toString("base64")
    return `<div class="page" style="
      width: 148mm;
      height: 210mm;
      overflow: hidden;
      page-break-after: ${i < pngBuffers.length - 1 ? "always" : "auto"};
      break-after: ${i < pngBuffers.length - 1 ? "page" : "auto"};
      margin: 0;
      padding: 0;
      display: block;
    ">
      <img src="data:image/png;base64,${b64}" style="
        width: 148mm;
        height: 210mm;
        display: block;
        margin: 0;
        padding: 0;
      " />
    </div>`
  })

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: white; }
  @page { size: 148mm 210mm; margin: 0; }
</style>
</head>
<body>${pages.join("\n")}</body>
</html>`

  await pdfPage.setContent(html, { waitUntil: "networkidle0" })

  await pdfPage.pdf({
    path: OUTPUT,
    width: "148mm",
    height: "210mm",
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  })

  console.log(`✅ PDF generado: ${OUTPUT}`)
} finally {
  await browser.close()
  server.kill()
}
