import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import sharp from "sharp"
import {
  PRODUCT_VARIANTS,
  assertExpectedSourcePath,
  bodyToBuffer,
  jsonResponse,
  normalizeVariant,
  productVariantPath,
  requireCatalogAdmin,
  requireR2Config,
  requireSupabaseAdmin,
  sanitizeProductId,
} from "./lib/r2-catalog.mjs"

const MAX_SOURCE_BYTES = 20 * 1024 * 1024
const MAX_SOURCE_PIXELS = 60_000_000

export default async function handler(request) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 })
  }

  try {
    const supabase = requireSupabaseAdmin()
    const auth = await requireCatalogAdmin(request, supabase)
    if (auth.error) return auth.error

    const { bucket, client } = requireR2Config()
    const body = await request.json()
    const catalogId = body.catalogId
    const productId = sanitizeProductId(body.productId)
    const variant = normalizeVariant(body.variant)
    const sourcePath = String(body.path || "")
    assertExpectedSourcePath(sourcePath, productId, variant)

    const source = await client.send(new GetObjectCommand({ Bucket: bucket, Key: sourcePath }))
    if (source.ContentLength > MAX_SOURCE_BYTES) {
      return jsonResponse({ error: "La imagen supera el tamaño máximo de 20 MB." }, { status: 400 })
    }
    const input = await bodyToBuffer(source.Body)

    await Promise.all(Object.entries(PRODUCT_VARIANTS[variant]).map(async ([size, config]) => {
      const output = await sharp(input, { limitInputPixels: MAX_SOURCE_PIXELS })
        .rotate()
        .resize({ width: config.width, height: config.width, fit: "inside", withoutEnlargement: true })
        .webp({ quality: config.quality, effort: 4 })
        .toBuffer()

      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: productVariantPath(productId, size, variant),
        Body: output,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }))
    }))

    const timestamp = Date.now()
    const field = variant === "processed" ? "processed_image_path" : "original_image_path"
    const payload = {
      [field]: sourcePath,
      image_variant: variant,
      img_mode: variant === "processed" ? "nobg" : "original",
      image_version: timestamp,
      updated_at: new Date().toISOString(),
    }
    if (variant === "processed") payload.nobg_version = timestamp

    const { error } = await supabase
      .from("catalog_products")
      .update(payload)
      .eq("catalog_id", catalogId)
      .eq("product_id", productId)
    if (error) throw error

    return jsonResponse({ path: sourcePath, imageVersion: timestamp })
  } catch (error) {
    console.error("r2-process-product-image", error)
    return jsonResponse({ error: error.message }, { status: 400 })
  }
}
