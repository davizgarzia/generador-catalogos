import { supabase } from "./supabase"

export const CATALOG_SLUG = import.meta.env.VITE_CATALOG_SLUG ?? "catalogo-principal"

export function getStorageUrl(bucket, path, transform = null) {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  const options = transform ? { transform } : undefined
  return supabase.storage.from(bucket).getPublicUrl(path, options).data.publicUrl
}

const THUMB_TRANSFORM = { width: 160, height: 160, resize: "contain", quality: 75 }
const PREVIEW_TRANSFORM = { width: 600, height: 600, resize: "contain", quality: 80 }
const CATALOG_TRANSFORM = { width: 1000, height: 1000, resize: "contain", quality: 85 }

function mapCatalogProduct(row) {
  const product = row.product
  const originalImage = getStorageUrl("catalog-images", row.original_image_path)
  const processedImage = getStorageUrl("catalog-images", row.processed_image_path)
  const thumb = getStorageUrl("catalog-images", row.original_image_path, THUMB_TRANSFORM)
  const processedThumb = getStorageUrl("catalog-images", row.processed_image_path, THUMB_TRANSFORM)
  const preview = getStorageUrl("catalog-images", row.original_image_path, PREVIEW_TRANSFORM)
  const processedPreview = getStorageUrl("catalog-images", row.processed_image_path, PREVIEW_TRANSFORM)
  const catalogImage = getStorageUrl("catalog-images", row.original_image_path, CATALOG_TRANSFORM)
  const catalogProcessed = getStorageUrl("catalog-images", row.processed_image_path, CATALOG_TRANSFORM)

  return {
    id: row.product_id,
    name: product.display_name,
    fullName: product.article_name,
    stockUnits: product.stock_units,
    unitsPerCase: product.units_per_case,
    unitsLabel: product.units_per_case ? `${product.units_per_case} uds./caja` : null,
    categoryId: product.category_id,
    category: product.category.display_name,
    sourceType: product.source_type,
    discontinued: product.discontinued,
    image: originalImage,
    originalImage,
    processedImage,
    thumb,
    processedThumb,
    preview,
    processedPreview,
    catalogImage,
    catalogProcessed,
    sortOrder: row.sort_order,
    active: row.active,
    imgHidden: row.img_hidden,
    imgX: Number(row.img_x),
    imgY: Number(row.img_y),
    imgScale: Number(row.img_scale),
    imgMode: row.img_mode,
    imageVariant: row.image_variant,
    imageVersion: row.image_version,
    nobgVersion: row.nobg_version,
  }
}

export async function loadCatalogBundle() {
  const { data: catalog, error: catalogError } = await supabase
    .from("catalogs")
    .select("*")
    .eq("slug", CATALOG_SLUG)
    .single()
  if (catalogError) throw catalogError

  const [categoriesResult, productsResult, coverResult] = await Promise.all([
    supabase
      .from("catalog_categories")
      .select("*")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("catalog_products")
      .select(`
        *,
        product:products(
          article_name,
          display_name,
          stock_units,
          units_per_case,
          category_id,
          source_type,
          discontinued,
          category:catalog_categories(display_name)
        )
      `)
      .eq("catalog_id", catalog.id)
      .order("sort_order"),
    supabase
      .from("catalog_cover_products")
      .select("product_id,sort_order")
      .eq("catalog_id", catalog.id)
      .order("sort_order"),
  ])

  if (categoriesResult.error) throw categoriesResult.error
  if (productsResult.error) throw productsResult.error
  if (coverResult.error) throw coverResult.error

  const categories = categoriesResult.data.map(category => ({
    ...category,
    coverImage: getStorageUrl("catalog-assets", category.cover_image_path),
  }))
  const products = productsResult.data.map(mapCatalogProduct)
  const byId = new Map(products.map(product => [product.id, product]))

  return {
    catalog: {
      ...catalog,
      coverImage: getStorageUrl("catalog-assets", catalog.cover_image_path),
      logo: getStorageUrl("catalog-assets", catalog.logo_path),
      logoWhite: getStorageUrl("catalog-assets", catalog.logo_white_path),
    },
    categories,
    products,
    coverProducts: coverResult.data.map(item => byId.get(item.product_id)).filter(Boolean),
  }
}

export async function loadProductOverrides(catalogId) {
  const { data, error } = await supabase
    .from("catalog_products")
    .select("product_id,img_hidden,img_x,img_y,img_scale,img_mode,nobg_version")
    .eq("catalog_id", catalogId)
  if (error) throw error

  return Object.fromEntries(data.map(row => [row.product_id, {
    imgHidden: row.img_hidden,
    imgX: Number(row.img_x),
    imgY: Number(row.img_y),
    imgScale: Number(row.img_scale),
    imgMode: row.img_mode,
    nobgVersion: row.nobg_version,
  }]))
}

export async function saveProductOverride(catalogId, productId, fields) {
  const catalogPayload = { updated_at: new Date().toISOString() }
  const productPayload = { updated_at: new Date().toISOString() }
  const fieldMap = {
    imgHidden: "img_hidden",
    imgX: "img_x",
    imgY: "img_y",
    imgScale: "img_scale",
    imgMode: "img_mode",
    nobgVersion: "nobg_version",
  }

  for (const [key, value] of Object.entries(fields)) {
    if (fieldMap[key]) catalogPayload[fieldMap[key]] = value
    if (key === "name") productPayload.display_name = value
    if (key === "unitsLabel") {
      const match = value?.match(/^\s*(\d+)/)
      productPayload.units_per_case = match ? Number.parseInt(match[1], 10) : null
    }
  }

  if (Object.keys(productPayload).length > 1) {
    const { error } = await supabase.from("products").update(productPayload).eq("id", productId)
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
}

export async function createManualProduct(catalogId, product) {
  const { error: productError } = await supabase.from("products").insert({
    id: product.id,
    article_name: product.articleName,
    display_name: product.displayName || product.articleName,
    stock_units: product.stockUnits || 0,
    units_per_case: product.unitsPerCase || null,
    category_id: product.categoryId,
    source_type: "manual",
    discontinued: false,
  })
  if (productError) throw productError

  const { error: catalogError } = await supabase.from("catalog_products").insert({
    catalog_id: catalogId,
    product_id: product.id,
    sort_order: product.sortOrder,
    active: true,
  })
  if (catalogError) throw catalogError
}

export async function updateProduct(productId, fields) {
  const { error } = await supabase
    .from("products")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", productId)
  if (error) throw error
}

export async function setProductActive(catalogId, productId, active) {
  const { error } = await supabase
    .from("catalog_products")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("catalog_id", catalogId)
    .eq("product_id", productId)
  if (error) throw error
}

export async function uploadProductImage(catalogId, productId, file, variant = "original") {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
  const folder = variant === "processed" ? "nobg" : "original"
  const path = `${folder}/${productId}.${variant === "processed" ? "png" : extension}`
  const { error: uploadError } = await supabase.storage
    .from("catalog-images")
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) throw uploadError

  const field = variant === "processed" ? "processed_image_path" : "original_image_path"
  const { error } = await supabase
    .from("catalog_products")
    .update({
      [field]: path,
      image_variant: variant,
      img_mode: variant === "processed" ? "nobg" : "original",
      image_version: Date.now(),
      updated_at: new Date().toISOString(),
    })
    .eq("catalog_id", catalogId)
    .eq("product_id", productId)
  if (error) throw error
  return path
}

export async function importCatalogProducts(products) {
  const { data, error } = await supabase.functions.invoke("import-catalog-products", {
    body: { products, catalogSlug: CATALOG_SLUG },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

export async function updateCatalog(catalogId, fields) {
  const { error } = await supabase
    .from("catalogs")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", catalogId)
  if (error) throw error
}

export async function updateCategory(categoryId, fields) {
  const { error } = await supabase
    .from("catalog_categories")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", categoryId)
  if (error) throw error
}

export async function uploadCatalogAsset(file, path) {
  const { error } = await supabase.storage
    .from("catalog-assets")
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  return path
}

export async function setCatalogCoverProducts(catalogId, productIds) {
  const { error: deleteError } = await supabase
    .from("catalog_cover_products")
    .delete()
    .eq("catalog_id", catalogId)
  if (deleteError) throw deleteError

  if (!productIds.length) return
  const { error } = await supabase.from("catalog_cover_products").insert(
    productIds.map((productId, index) => ({
      catalog_id: catalogId,
      product_id: productId,
      sort_order: (index + 1) * 10,
    }))
  )
  if (error) throw error
}
