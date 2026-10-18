import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import {
  IMAGE_CACHE_CONTROL,
  imageExtension,
  jsonResponse,
  requireCatalogAdmin,
  requireR2Config,
  requireSupabaseAdmin,
  sanitizeProductId,
  sourcePathForProduct,
} from "./lib/r2-catalog.mjs"

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

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
    const productId = sanitizeProductId(body.productId)
    const contentType = String(body.contentType || "")
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return jsonResponse({ error: `Tipo de imagen no admitido: ${contentType || "desconocido"}` }, { status: 400 })
    }
    const extension = imageExtension(body.fileName, contentType)
    const path = sourcePathForProduct(productId, extension)

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      ContentType: contentType,
      CacheControl: IMAGE_CACHE_CONTROL,
    })
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 })

    // Los headers van firmados: la subida debe enviarlos tal cual.
    return jsonResponse({
      uploadUrl,
      path,
      headers: { "content-type": contentType, "cache-control": IMAGE_CACHE_CONTROL },
    })
  } catch (error) {
    console.error("r2-presign-product-image", error)
    return jsonResponse({ error: error.message }, { status: 400 })
  }
}
