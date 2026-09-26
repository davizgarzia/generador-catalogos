// Copia de seguridad local de las tablas de Supabase (datos, no imágenes:
// los ficheros de R2/Storage no se tocan y no hace falta copiarlos).
// Uso: node scripts/db-snapshot.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const TABLES = [
  "catalog_categories",
  "company_profile",
  "products",
  "catalogs",
  "catalog_products",
  "catalog_cover_products",
  "catalog_admins",
]
const PAGE_SIZE = 1000

function loadEnv() {
  const env = {}
  for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) env[match[1]] = match[2].trim()
  }
  return env
}

const env = loadEnv()
const BASE = env.VITE_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!BASE || !KEY) {
  console.error("Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local")
  process.exit(1)
}

async function fetchTable(table) {
  const rows = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await fetch(
      `${BASE}/rest/v1/${table}?select=*&limit=${PAGE_SIZE}&offset=${offset}`,
      { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } }
    )
    if (!response.ok) throw new Error(`${table}: HTTP ${response.status} ${await response.text()}`)
    const page = await response.json()
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
const dir = resolve("backups", stamp)
mkdirSync(dir, { recursive: true })

for (const table of TABLES) {
  const rows = await fetchTable(table)
  writeFileSync(resolve(dir, `${table}.json`), JSON.stringify(rows, null, 2))
  console.log(`${table}: ${rows.length} filas`)
}

console.log(`\nSnapshot guardado en backups/${stamp}`)
console.log(`Para restaurar: node scripts/db-restore.mjs backups/${stamp}`)
