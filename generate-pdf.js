#!/usr/bin/env node
/**
 * generate-pdf.js
 * Genera el PDF del catálogo usando pagedjs-cli.
 *
 * Flujo:
 *   1. vite build  →  dist/
 *   2. serve dist/ en un puerto libre
 *   3. pagedjs-cli http://localhost:PORT  →  catalogo-impormed-2025.pdf
 *   4. Mata el servidor
 */

import { execSync, spawn } from "child_process"
import { createServer } from "net"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT = resolve(__dirname, "catalogo-impormed-2025.pdf")

// ── 1. Build ──────────────────────────────────────────────
console.log("📦 Building...")
execSync("npm run build", { stdio: "inherit", cwd: __dirname })

// ── 2. Encuentra un puerto libre ──────────────────────────
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

// ── 3. Levanta servidor estático ──────────────────────────
console.log(`🌐 Serving dist/ on port ${port}...`)
const server = spawn(
  "npx",
  ["serve", "dist", "--listen", String(port), "--no-clipboard"],
  { cwd: __dirname, stdio: "pipe" }
)

// Espera a que el servidor esté listo
await new Promise((res) => setTimeout(res, 2000))

// ── 4. Genera el PDF ──────────────────────────────────────
console.log(`🖨  Generating PDF → ${OUTPUT}`)
try {
  execSync(
    `pagedjs-cli http://localhost:${port} -o "${OUTPUT}" --timeout 120000`,
    { stdio: "inherit", cwd: __dirname }
  )
  console.log(`✅ PDF generado: ${OUTPUT}`)
} finally {
  server.kill()
}
