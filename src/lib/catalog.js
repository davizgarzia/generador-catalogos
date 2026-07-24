import { supabase } from "./supabase"

export const CATALOG_SLUG = import.meta.env.VITE_CATALOG_SLUG ?? "catalogo-principal"
const SUPABASE_IMAGE_TRANSFORMS_ENABLED =
  import.meta.env.VITE_SUPABASE_IMAGE_TRANSFORMS === "true"

export function getStorageUrl(bucket, path, transform = null) {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  const options = transform && SUPABASE_IMAGE_TRANSFORMS_ENABLED ? { transform } : undefined
  return supabase.storage.from(bucket).getPublicUrl(path, options).data.publicUrl
}

const CACHE_BUST_WINDOW_MS = 5 * 60 * 1000

export function withCacheBust(url, version) {
  if (!url) return url
  if (!version || Date.now() - version > CACHE_BUST_WINDOW_MS) return url
  const sep = url.includes("?") ? "&" : "?"
  return `${url}${sep}v=${version}`
}

const THUMB_TRANSFORM = { width: 160, height: 160, resize: "contain", quality: 75 }
const PREVIEW_TRANSFORM = { width: 600, height: 600, resize: "contain", quality: 80 }
const CATALOG_TRANSFORM = { width: 1000, height: 1000, resize: "contain", quality: 85 }

const PRODUCT_VARIANTS = {
  original: {
    thumb: { folder: "thumb", width: 160, height: 160, quality: 0.7 },
    preview: { folder: "preview", width: 600, height: 600, quality: 0.78 },
    catalog: { folder: "catalog", width: 1000, height: 1000, quality: 0.84 },
  },
  processed: {
    thumb: { folder: "nobg-thumb", width: 160, height: 160, quality: 0.7 },
    preview: { folder: "nobg-preview", width: 600, height: 600, quality: 0.78 },
    catalog: { folder: "nobg-catalog", width: 1000, height: 1000, quality: 0.84 },
  },
}

const ASSET_VARIANTS = {
  large: { folder: "asset-large", width: 2400, height: 2400, quality: 0.86 },
  thumb: { folder: "asset-thumb", width: 320, height: 320, quality: 0.72 },
}

function extensionlessName(path) {
  return path.split("/").pop()?.replace(/\.[^.]+$/, "") || null
}

function productVariantPath(path, size, variant = "original") {
  if (!path || /^https?:\/\//.test(path)) return null
  const name = extensionlessName(path)
  const config = PRODUCT_VARIANTS[variant]?.[size]
  if (!name || !config) return null
  return `${config.folder}/${name}.webp`
}

function assetVariantPath(path, size) {
  if (!path || /^https?:\/\//.test(path)) return null
  const config = ASSET_VARIANTS[size]
  const withoutExtension = path.replace(/\.[^.]+$/, "")
  if (!config || !withoutExtension) return null
  return `${config.folder}/${withoutExtension}.webp`
}

function getProductVariantUrl(path, size, variant = "original", transform = null) {
  if (SUPABASE_IMAGE_TRANSFORMS_ENABLED) return getStorageUrl("catalog-images", path, transform)
  return getStorageUrl("catalog-images", productVariantPath(path, size, variant))
}

function getAssetVariantUrl(path, size) {
  return getStorageUrl("catalog-assets", assetVariantPath(path, size))
}

async function imageBlobToVariant(source, { width, height, quality }) {
  const bitmap = await createImageBitmap(source)
  const scale = Math.min(width / bitmap.width, height / bitmap.height, 1)
  const targetWidth = Math.max(1, Math.round(bitmap.width * scale))
  const targetHeight = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = targetWidth
  canvas.height = targetHeight
  const context = canvas.getContext("2d")
  context.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
  bitmap.close?.()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error("No se pudo optimizar la imagen.")),
      "image/webp",
      quality
    )
  })
}

async function uploadStorageObject(bucket, path, body, contentType) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, body, { upsert: true, contentType, cacheControl: "31536000" })
  if (error) throw error
}

async function uploadProductImageVariants(file, productId, variant) {
  const sizes = PRODUCT_VARIANTS[variant]
  await Promise.all(Object.entries(sizes).map(async ([size, config]) => {
    const blob = await imageBlobToVariant(file, config)
    await uploadStorageObject(
      "catalog-images",
      productVariantPath(`${variant === "processed" ? "nobg" : "original"}/${productId}.png`, size, variant),
      blob,
      "image/webp"
    )
  }))
}

async function uploadCatalogAssetVariants(file, path) {
  await Promise.all(Object.values(ASSET_VARIANTS).map(async config => {
    const blob = await imageBlobToVariant(file, config)
    await uploadStorageObject("catalog-assets", `${config.folder}/${path.replace(/\.[^.]+$/, "")}.webp`, blob, "image/webp")
  }))
}

function mapCatalogProduct(row) {
  const product = row.product
  const originalImage = getStorageUrl("catalog-images", row.original_image_path)
  const processedImage = getStorageUrl("catalog-images", row.processed_image_path)
  const thumb = getProductVariantUrl(row.original_image_path, "thumb", "original", THUMB_TRANSFORM)
  const processedThumb = getProductVariantUrl(row.processed_image_path, "thumb", "processed", THUMB_TRANSFORM)
  const preview = getProductVariantUrl(row.original_image_path, "preview", "original", PREVIEW_TRANSFORM)
  const processedPreview = getProductVariantUrl(row.processed_image_path, "preview", "processed", PREVIEW_TRANSFORM)
  const catalogImage = getProductVariantUrl(row.original_image_path, "catalog", "original", CATALOG_TRANSFORM)
  const catalogProcessed = getProductVariantUrl(row.processed_image_path, "catalog", "processed", CATALOG_TRANSFORM)

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
    originalThumb: originalImage,
    processedThumbFallback: processedImage,
    previewFallback: originalImage,
    processedPreviewFallback: processedImage,
    catalogImageFallback: originalImage,
    catalogProcessedFallback: processedImage,
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
    coverImage: getAssetVariantUrl(category.cover_image_path, "large") || getStorageUrl("catalog-assets", category.cover_image_path),
    coverImageFallback: getStorageUrl("catalog-assets", category.cover_image_path),
    coverThumb: getAssetVariantUrl(category.cover_image_path, "thumb"),
  }))
  const products = productsResult.data.map(mapCatalogProduct)
  const byId = new Map(products.map(product => [product.id, product]))

  return {
    catalog: {
      ...catalog,
      coverImage: getAssetVariantUrl(catalog.cover_image_path, "large") || getStorageUrl("catalog-assets", catalog.cover_image_path),
      coverImageFallback: getStorageUrl("catalog-assets", catalog.cover_image_path),
      coverThumb: getAssetVariantUrl(catalog.cover_image_path, "thumb"),
      logo: getAssetVariantUrl(catalog.logo_path, "large") || getStorageUrl("catalog-assets", catalog.logo_path),
      logoFallback: getStorageUrl("catalog-assets", catalog.logo_path),
      logoWhite: getAssetVariantUrl(catalog.logo_white_path, "large") || getStorageUrl("catalog-assets", catalog.logo_white_path),
      logoWhiteFallback: getStorageUrl("catalog-assets", catalog.logo_white_path),
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
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "31536000" })
  if (uploadError) throw uploadError
  await uploadProductImageVariants(file, productId, variant)

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
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "31536000" })
  if (error) throw error
  await uploadCatalogAssetVariants(file, path)
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
