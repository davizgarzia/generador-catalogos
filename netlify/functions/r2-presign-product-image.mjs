import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import {
  imageExtension,
  jsonResponse,
  normalizeVariant,
  requireCatalogAdmin,
  requireR2Config,
  requireSupabaseAdmin,
  sanitizeProductId,
  sourcePathForProduct,
} from "./lib/r2-catalog.mjs"

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
    const variant = normalizeVariant(body.variant)
    const contentType = String(body.contentType || "application/octet-stream")
    const extension = imageExtension(body.fileName, contentType)
    const path = sourcePathForProduct(productId, variant, extension)

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      ContentType: contentType,
    })
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 })

    return jsonResponse({
      uploadUrl,
      path,
      headers: { "content-type": contentType },
    })
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 400 })
  }
}
