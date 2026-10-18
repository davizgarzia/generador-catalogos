// Promueve el recorte sin fondo (`nobg/{ref}.png`) a imagen única del producto.
//
// El modo "sin fondo" se retiró de la app: su pipeline dejó de operar en julio
// de 2026 y las variantes `nobg-*` nunca se regeneraban al reemplazar una foto,
// así que mostraban recortes que ya no correspondían al producto. El recorte es
// la imagen buena (la foto con fondo solo existía porque las primeras se
// generaron en bloque), de modo que aquí se convierte en el original.
//
// Por cada producto: respalda la foto con fondo en `original-con-fondo/`,
// sube el recorte como `original/{ref}.png`, regenera las variantes WebP
// conservando la transparencia y actualiza la fila en Supabase.
//
// Uso:
//   node scripts/promote-nobg-to-original.mjs --dry-run        (no escribe nada)
//   node scripts/promote-nobg-to-original.mjs --limit 15       (lote de prueba)
//   node scripts/promote-nobg-to-original.mjs                  (todos)
//   node scripts/promote-nobg-to-original.mjs --only IP14032,54041
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import sharp from "sharp"

const BACKUP_PREFIX = "original-con-fondo"
const VARIANTS = {
  thumb: { folder: "thumb", width: 160, quality: 70 },
  preview: { folder: "preview", width: 600, quality: 78 },
  catalog: { folder: "catalog", width: 1000, quality: 84 },
}
const CACHE_CONTROL = "public, max-age=31536000, immutable"

function loadEnv() {
  const env = {}
  for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) env[match[1]] = match[2].trim()
  }
  return env
}

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const limitArg = args.indexOf("--limit")
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : null
const onlyArg = args.indexOf("--only")
const only = onlyArg >= 0 ? args[onlyArg + 1].split(",").map(s => s.trim()) : null

const env = loadEnv()
const BASE = env.VITE_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const PUBLIC = env.VITE_R2_PUBLIC_URL?.replace(/\/+$/, "")
const BUCKET = env.R2_BUCKET_NAME || "impormed-catalog"
if (!BASE || !KEY || !PUBLIC || !env.R2_ENDPOINT) {
  console.error("Faltan variables en .env.local (Supabase o R2).")
  process.exit(1)
}

const headers = { apikey: KEY, authorization: `Bearer ${KEY}` }
const s3 = new S3Client({
  region: "auto",
  endpoint: env.R2_ENDPOINT,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
})

const buffer = async body => {
  const chunks = []
  for await (const chunk of body) chunks.push(chunk)
  return Buffer.concat(chunks)
}

const lastModified = async key => {
  const r = await fetch(`${PUBLIC}/${key}`, { method: "HEAD", cache: "no-store" })
  return r.ok ? new Date(r.headers.get("last-modified")).getTime() : null
}

// ── Selección de candidatos ────────────────────────────────────────────────
const products = await (await fetch(
  `${BASE}/rest/v1/products?select=id,display_name,original_image_path,processed_image_path,image_version&limit=2000`,
  { headers }
)).json()

const candidatos = []
const saltados = { sinRecorte: [], recorteObsoleto: [], sinAlfa: [] }

for (const p of products) {
  if (only && !only.includes(p.id)) continue
  const nobgKey = `nobg/${p.id}.png`
  const nobgMod = await lastModified(nobgKey)
  if (nobgMod === null) { saltados.sinRecorte.push(p.id); continue }
  // Si se subió una foto DESPUÉS de generar el recorte, el recorte es de la
  // imagen anterior: promoverlo revertiría ese reemplazo.
  if ((Number(p.image_version) || 0) > nobgMod) { saltados.recorteObsoleto.push(p.id); continue }
  candidatos.push({ ...p, nobgKey })
}

const lote = limit ? candidatos.slice(0, limit) : candidatos
console.log(`candidatos: ${candidatos.length}  |  a procesar ahora: ${lote.length}`)
console.log(`saltados → sin recorte: ${saltados.sinRecorte.length}, recorte obsoleto: ${saltados.recorteObsoleto.length}`)
if (saltados.recorteObsoleto.length) console.log(`  obsoletos (intactos): ${saltados.recorteObsoleto.join(", ")}`)
if (dryRun) {
  console.log("\n--dry-run: no se escribe nada.")
  console.log(lote.map(p => p.id).join(", "))
  process.exit(0)
}

// ── Migración ──────────────────────────────────────────────────────────────
let ok = 0
const fallos = []

for (const [i, p] of lote.entries()) {
  const etiqueta = `[${i + 1}/${lote.length}] ${p.id}`
  try {
    const source = await buffer((await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: p.nobgKey }))).Body)
    const meta = await sharp(source).metadata()
    if (!meta.hasAlpha) { saltados.sinAlfa.push(p.id); console.log(`${etiqueta} SALTADO (el recorte no tiene transparencia)`); continue }

    // 1. Respaldo de la foto con fondo — es lo que hace esto reversible.
    if (p.original_image_path) {
      await s3.send(new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${p.original_image_path}`,
        Key: `${BACKUP_PREFIX}/${p.original_image_path.split("/").pop()}`,
      }))
    }

    // 2. El recorte pasa a ser el original.
    const destino = `original/${p.id}.png`
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key: destino, Body: source,
      ContentType: "image/png", CacheControl: CACHE_CONTROL,
    }))

    // 3. Variantes WebP: webp conserva el canal alfa del PNG.
    await Promise.all(Object.values(VARIANTS).map(async config => {
      const out = await sharp(source)
        .rotate()
        .resize({ width: config.width, height: config.width, fit: "inside", withoutEnlargement: true })
        .webp({ quality: config.quality, effort: 4 })
        .toBuffer()
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET, Key: `${config.folder}/${p.id}.webp`, Body: out,
        ContentType: "image/webp", CacheControl: CACHE_CONTROL,
      }))
    }))

    // 4. Supabase: el recorte es ya la única imagen del producto.
    const response = await fetch(`${BASE}/rest/v1/products?id=eq.${encodeURIComponent(p.id)}`, {
      method: "PATCH",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        original_image_path: destino,
        processed_image_path: null,
        nobg_version: null,
        image_variant: "original",
        img_mode: "original",
        image_version: Date.now(),
        updated_at: new Date().toISOString(),
      }),
    })
    if (!response.ok) throw new Error(`Supabase HTTP ${response.status} ${await response.text()}`)

    // 5. El original antiguo ya está respaldado: fuera de `original/`.
    if (p.original_image_path && p.original_image_path !== destino) {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: p.original_image_path }))
    }

    ok++
    console.log(`${etiqueta} ok  ${meta.width}x${meta.height}  ${(p.display_name || "").slice(0, 40)}`)
  } catch (error) {
    fallos.push({ id: p.id, error: error.message })
    console.log(`${etiqueta} ERROR  ${error.message}`)
  }
}

console.log(`\nmigrados: ${ok}  |  fallos: ${fallos.length}  |  sin transparencia: ${saltados.sinAlfa.length}`)
if (fallos.length) console.log(fallos.map(f => `  ${f.id}: ${f.error}`).join("\n"))
console.log(`respaldo de las fotos con fondo en R2: ${BACKUP_PREFIX}/`)
