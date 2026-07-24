import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const PRODUCT_VARIANTS = {
  original: {
    thumb: { folder: "thumb", width: 160, quality: 70 },
    preview: { folder: "preview", width: 600, quality: 78 },
    catalog: { folder: "catalog", width: 1000, quality: 84 },
  },
  processed: {
    thumb: { folder: "nobg-thumb", width: 160, quality: 70 },
    preview: { folder: "nobg-preview", width: 600, quality: 78 },
    catalog: { folder: "nobg-catalog", width: 1000, quality: 84 },
  },
}

const ASSET_VARIANTS = {
  large: { folder: "asset-large", width: 2400, quality: 86 },
  thumb: { folder: "asset-thumb", width: 320, quality: 72 },
}

const args = new Set(process.argv.slice(2))
const write = args.has("--write")
const force = args.has("--force")
const limitArg = process.argv.find(arg => arg.startsWith("--limit="))
const limit = limitArg ? Number(limitArg.split("=")[1]) : null
const progressEveryArg = process.argv.find(arg => arg.startsWith("--progress-every="))
const progressEvery = progressEveryArg ? Number(progressEveryArg.split("=")[1]) : 25

loadEnvFile(".env.local")
loadEnvFile(".env")

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || (write && !serviceRoleKey) || (!write && !serviceRoleKey && !publishableKey)) {
  throw new Error("Faltan credenciales: dry-run necesita VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY; --write necesita SUPABASE_SERVICE_ROLE_KEY.")
}

const { default: sharp } = await import("sharp").catch(() => {
  throw new Error("Falta sharp. Instálalo en un Node compatible antes de ejecutar la migración.")
})

const supabase = createClient(supabaseUrl, serviceRoleKey || publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const summary = {
  planned: 0,
  uploaded: 0,
  skipped: 0,
  failed: 0,
  originalBytes: 0,
  variantBytes: 0,
}

const jobs = await collectJobs()
const selectedJobs = limit ? jobs.slice(0, limit) : jobs

console.log(`${write ? "WRITE" : "DRY RUN"} · ${selectedJobs.length}/${jobs.length} fuentes · force=${force}`)

for (const [index, job] of selectedJobs.entries()) {
  await processSource(job)
  if (progressEvery > 0 && ((index + 1) % progressEvery === 0 || index + 1 === selectedJobs.length)) {
    console.log(
      `${index + 1}/${selectedJobs.length} · ` +
      `planned=${summary.planned} uploaded=${summary.uploaded} skipped=${summary.skipped} failed=${summary.failed} · ` +
      `source=${formatBytes(summary.originalBytes)} variants=${formatBytes(summary.variantBytes)}`
    )
  }
}

console.log(JSON.stringify(summary, null, 2))

async function collectJobs() {
  const [productsResult, catalogsResult, categoriesResult] = await Promise.all([
    supabase
      .from("catalog_products")
      .select("product_id,original_image_path,processed_image_path")
      .order("product_id"),
    supabase
      .from("catalogs")
      .select("cover_image_path,logo_path,logo_white_path"),
    supabase
      .from("catalog_categories")
      .select("cover_image_path")
      .order("sort_order"),
  ])

  for (const result of [productsResult, catalogsResult, categoriesResult]) {
    if (result.error) throw result.error
  }

  const items = []
  for (const row of productsResult.data) {
    if (row.original_image_path) {
      items.push({
        bucket: "catalog-images",
        sourcePath: row.original_image_path,
        variants: Object.values(PRODUCT_VARIANTS.original),
      })
    }
    if (row.processed_image_path) {
      items.push({
        bucket: "catalog-images",
        sourcePath: row.processed_image_path,
        variants: Object.values(PRODUCT_VARIANTS.processed),
      })
    }
  }

  for (const row of catalogsResult.data) {
    for (const sourcePath of [row.cover_image_path, row.logo_path, row.logo_white_path].filter(Boolean)) {
      items.push({ bucket: "catalog-assets", sourcePath, variants: Object.values(ASSET_VARIANTS) })
    }
  }

  for (const row of categoriesResult.data) {
    if (row.cover_image_path) {
      items.push({ bucket: "catalog-assets", sourcePath: row.cover_image_path, variants: Object.values(ASSET_VARIANTS) })
    }
  }

  const byKey = new Map()
  for (const item of items) byKey.set(`${item.bucket}/${item.sourcePath}`, item)
  return [...byKey.values()]
}

async function processSource(job) {
  const downloaded = await supabase.storage.from(job.bucket).download(job.sourcePath)
  if (downloaded.error) {
    summary.failed += 1
    console.warn(`missing source ${job.bucket}/${job.sourcePath}: ${downloaded.error.message}`)
    return
  }

  const input = Buffer.from(await downloaded.data.arrayBuffer())
  summary.originalBytes += input.byteLength

  for (const variant of job.variants) {
    const targetPath = variantPath(job.sourcePath, variant.folder)
    summary.planned += 1

    if (!force && await exists(job.bucket, targetPath)) {
      summary.skipped += 1
      continue
    }

    const output = await sharp(input)
      .rotate()
      .resize({ width: variant.width, height: variant.width, fit: "inside", withoutEnlargement: true })
      .webp({ quality: variant.quality, effort: 4 })
      .toBuffer()

    summary.variantBytes += output.byteLength

    if (!write) continue

    const uploaded = await supabase.storage
      .from(job.bucket)
      .upload(targetPath, output, {
        upsert: true,
        contentType: "image/webp",
        cacheControl: "31536000",
      })

    if (uploaded.error) {
      summary.failed += 1
      console.warn(`upload failed ${job.bucket}/${targetPath}: ${uploaded.error.message}`)
    } else {
      summary.uploaded += 1
    }
  }
}

async function exists(bucket, path) {
  const result = await supabase.storage.from(bucket).download(path)
  return !result.error
}

function variantPath(sourcePath, folder) {
  if (folder.startsWith("asset-")) {
    return `${folder}/${sourcePath.replace(/\.[^.]+$/, "")}.webp`
  }
  const name = sourcePath.split("/").pop()?.replace(/\.[^.]+$/, "")
  return `${folder}/${name}.webp`
}

function loadEnvFile(path) {
  try {
    const contents = readFileSync(path, "utf8")
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/)
      if (!match || process.env[match[1]]) continue
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "")
    }
  } catch {
    // optional local env file
  }
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
