import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx"
import bundledProducts from "../src/data/products.js"
import overrides from "../src/data/overrides.json" with { type: "json" }

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const EXCEL_PATH = path.join(ROOT, "data", "BASE14052026.xlsx")
const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  throw new Error("Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para ejecutar la migración.")
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
}

const bundledProductsById = new Map(
  bundledProducts.map(product => [product.id, product])
)

function readSourceProducts() {
  const workbook = XLSX.readFile(EXCEL_PATH)
  const worksheet = workbook.Sheets["Valoración de stocks"]
  if (!worksheet) throw new Error("No existe la hoja 'Valoración de stocks'.")

  return XLSX.utils.sheet_to_json(worksheet, { defval: null }).map(row => ({
    id: String(row["Artículo"]).trim(),
    articleName: String(row["Nombre artículo"]).replace(/\s+/g, " ").trim(),
    familyName: String(row["Nombre de familia"]).trim(),
    stockUnits: Number(row["Unidades"]),
  }))
}

function chunks(items, size = 100) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size)
  )
}

function localImagePath(publicPath) {
  return publicPath ? path.join(ROOT, "public", publicPath.replace(/^\//, "")) : null
}

async function uploadImage(filePath, storagePath) {
  if (!filePath || !fs.existsSync(filePath)) return false

  const extension = path.extname(filePath).toLowerCase()
  const { error } = await supabase.storage
    .from("catalog-images")
    .upload(storagePath, fs.readFileSync(filePath), {
      contentType: MIME_TYPES[extension] ?? "application/octet-stream",
      upsert: true,
    })

  if (error) throw error
  return true
}

async function migrateProducts() {
  const sourceProducts = readSourceProducts()
  const { data: categories, error: categoriesError } = await supabase
    .from("catalog_categories")
    .select("id,source_name")
  if (categoriesError) throw categoriesError

  const categoryIdBySourceName = new Map(
    categories.map(category => [category.source_name, category.id])
  )

  const sourceRows = sourceProducts.map(sourceProduct => {
    const bundled = bundledProductsById.get(sourceProduct.id)
    const categoryId = categoryIdBySourceName.get(sourceProduct.familyName)
    if (!categoryId) {
      throw new Error(`Familia no configurada: ${sourceProduct.familyName}`)
    }

    const unitsMatch = bundled?.unitsLabel?.match(/^\s*(\d+)/)
    return {
      id: sourceProduct.id,
      article_name: sourceProduct.articleName,
      display_name: overrides[sourceProduct.id]?.name ?? bundled?.name ?? sourceProduct.articleName,
      stock_units: sourceProduct.stockUnits,
      units_per_case: unitsMatch ? Number.parseInt(unitsMatch[1], 10) : null,
      category_id: categoryId,
      discontinued: false,
      imported_at: new Date().toISOString(),
    }
  })

  for (const batch of chunks(sourceRows)) {
    const { error } = await supabase.from("products").upsert(batch, { onConflict: "id" })
    if (error) throw error
  }

  const { data: catalog, error: catalogError } = await supabase
    .from("catalogs")
    .select("id")
    .eq("slug", "catalogo-principal")
    .single()
  if (catalogError) throw catalogError

  const catalogRows = bundledProducts.map((product, sortOrder) => {
    const extension = product.image ? path.extname(product.image).toLowerCase() : ""
    const value = overrides[product.id] ?? {}
    return {
      catalog_id: catalog.id,
      product_id: product.id,
      image_path: product.image ? `original/${product.id}${extension}` : null,
      sort_order: sortOrder,
      active: true,
      img_hidden: value.imgHidden ?? false,
      img_x: value.imgX ?? 0,
      img_y: value.imgY ?? 0,
      img_scale: value.imgScale ?? 1,
      img_mode: value.imgMode ?? "original",
      nobg_version: value.nobgVersion ?? null,
    }
  })

  for (const batch of chunks(catalogRows)) {
    const { error } = await supabase.from("catalog_products").upsert(batch, {
      onConflict: "catalog_id,product_id",
    })
    if (error) throw error
  }

  console.log(`Productos maestros migrados: ${sourceRows.length}`)
  console.log(`Productos de catálogo migrados: ${catalogRows.length}`)
}

async function migrateImages() {
  let originals = 0
  let noBackground = 0

  for (const [index, product] of bundledProducts.entries()) {
    const original = localImagePath(product.image)
    if (original) {
      const extension = path.extname(original).toLowerCase()
      if (await uploadImage(original, `original/${product.id}${extension}`)) originals++
    }

    const nobg = path.join(ROOT, "public", "images-nobg", `${product.id}.png`)
    if (await uploadImage(nobg, `nobg/${product.id}.png`)) noBackground++

    if ((index + 1) % 25 === 0) {
      console.log(`Imágenes revisadas: ${index + 1}/${bundledProducts.length}`)
    }
  }

  console.log(`Imágenes originales migradas: ${originals}`)
  console.log(`Imágenes sin fondo migradas: ${noBackground}`)
}

await migrateProducts()
if (process.env.SKIP_IMAGE_MIGRATION !== "true") {
  await migrateImages()
}

console.log("Migración a Supabase completada.")
