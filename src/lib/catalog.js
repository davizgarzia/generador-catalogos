import bundledProducts from "@/data/products"
import bundledOverrides from "@/data/overrides.json"
import { getCatalogImageUrl, isSupabaseConfigured, supabase } from "./supabase"

const CATALOG_SLUG = import.meta.env.VITE_CATALOG_SLUG ?? "catalogo-principal"
let catalogIdPromise

async function getCatalogId() {
  if (!catalogIdPromise) {
    catalogIdPromise = supabase
      .from("catalogs")
      .select("id")
      .eq("slug", CATALOG_SLUG)
      .single()
      .then(({ data, error }) => {
        if (error) throw error
        return data.id
      })
  }

  return catalogIdPromise
}

function mapProduct(row) {
  return {
    id: row.product_id,
    name: row.product.display_name,
    fullName: row.product.article_name,
    unitsLabel: row.product.units_per_case
      ? `${row.product.units_per_case} uds./caja`
      : null,
    category: row.product.category.display_name,
    image: getCatalogImageUrl(row.image_path),
  }
}

function mapOverride(row) {
  return {
    name: row.name,
    unitsLabel: row.units_label,
    imgHidden: row.img_hidden,
    imgX: row.img_x,
    imgY: row.img_y,
    imgScale: row.img_scale,
    imgMode: row.img_mode,
    nobgVersion: row.nobg_version,
  }
}

export async function loadCatalogProducts() {
  if (!isSupabaseConfigured) return bundledProducts

  const catalogId = await getCatalogId()
  const { data, error } = await supabase
    .from("catalog_products")
    .select(`
      product_id,
      image_path,
      sort_order,
      product:products(
        article_name,
        display_name,
        units_per_case,
        category:catalog_categories(display_name)
      )
    `)
    .eq("catalog_id", catalogId)
    .eq("active", true)
    .order("sort_order")

  if (error) throw error
  return data.length ? data.map(mapProduct) : bundledProducts
}

export async function loadProductOverrides() {
  if (!isSupabaseConfigured) return bundledOverrides

  const catalogId = await getCatalogId()
  const { data, error } = await supabase
    .from("catalog_products")
    .select("product_id,img_hidden,img_x,img_y,img_scale,img_mode,nobg_version")
    .eq("catalog_id", catalogId)

  if (error) throw error
  if (!data.length) return bundledOverrides
  return Object.fromEntries(data.map(row => [row.product_id, mapOverride(row)]))
}

export async function saveProductOverride(productId, fields) {
  if (!isSupabaseConfigured) return false

  const catalogId = await getCatalogId()
  const catalogPayload = {
    updated_at: new Date().toISOString(),
  }
  const productPayload = {
    updated_at: new Date().toISOString(),
  }

  const catalogFieldMap = {
    imgHidden: "img_hidden",
    imgX: "img_x",
    imgY: "img_y",
    imgScale: "img_scale",
    imgMode: "img_mode",
    nobgVersion: "nobg_version",
  }

  for (const [key, value] of Object.entries(fields)) {
    if (catalogFieldMap[key]) catalogPayload[catalogFieldMap[key]] = value
    if (key === "name") productPayload.display_name = value
    if (key === "unitsLabel") {
      const match = value?.match(/^\s*(\d+)/)
      productPayload.units_per_case = match ? Number.parseInt(match[1], 10) : null
    }
  }

  if (Object.keys(productPayload).length > 1) {
    const { error } = await supabase
      .from("products")
      .update(productPayload)
      .eq("id", productId)

    if (error) throw error
  }

  if (Object.keys(catalogPayload).length > 1) {
    const { error } = await supabase
      .from("catalog_products")
      .update(catalogPayload)
      .eq("catalog_id", catalogId)
      .eq("product_id", productId)

    if (error) throw error
  }

  return true
}
