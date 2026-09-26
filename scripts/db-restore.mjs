// Restaura un snapshot creado con db-snapshot.mjs: borra el contenido actual
// de las tablas y reinserta las filas del snapshot (las imágenes de R2/Storage
// nunca se tocan, así que los punteros restaurados vuelven a funcionar).
// Uso: node scripts/db-restore.mjs backups/<carpeta>
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// Orden de borrado (hijos primero) y de inserción (padres primero).
// Cada entrada lleva una columna not-null para el filtro que exige PostgREST.
const DELETE_ORDER = [
  ["catalog_cover_products", "catalog_id"],
  ["catalog_products", "catalog_id"],
  ["catalogs", "id"],
  ["products", "id"],
]
const INSERT_ORDER = [
  "catalog_categories",
  "company_profile",
  "products",
  "catalogs",
  "catalog_products",
  "catalog_cover_products",
]
const CHUNK = 500

const dir = process.argv[2]
if (!dir) {
  console.error("Uso: node scripts/db-restore.mjs backups/<carpeta>")
  process.exit(1)
}

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

const headers = {
  apikey: KEY,
  authorization: `Bearer ${KEY}`,
  "content-type": "application/json",
}

async function wipe(table, column) {
  const response = await fetch(`${BASE}/rest/v1/${table}?${column}=not.is.null`, {
    method: "DELETE",
    headers,
  })
  if (!response.ok) throw new Error(`DELETE ${table}: HTTP ${response.status} ${await response.text()}`)
  console.log(`vaciada ${table}`)
}

async function insert(table, rows) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const response = await fetch(`${BASE}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...headers, prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(chunk),
    })
    if (!response.ok) throw new Error(`INSERT ${table}: HTTP ${response.status} ${await response.text()}`)
  }
  console.log(`${table}: ${rows.length} filas restauradas`)
}

for (const [table, column] of DELETE_ORDER) {
  await wipe(table, column)
}

for (const table of INSERT_ORDER) {
  const rows = JSON.parse(readFileSync(resolve(dir, `${table}.json`), "utf8"))
  if (rows.length) await insert(table, rows)
}

console.log("\nRestauración completada.")
