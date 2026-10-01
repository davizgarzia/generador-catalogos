import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import sharp from "sharp"
import {
  bodyToBuffer,
  imageExtension,
  jsonResponse,
  requireCatalogAdmin,
  requireR2Config,
  requireSupabaseAdmin,
} from "./lib/r2-catalog.mjs"

// Imágenes propias de las páginas especiales del catálogo (portada, hojas de
// relleno y contraportada). Tres acciones: presign (URL de subida directa a R2),
// process (genera el WebP final de calidad de impresión y limpia la subida)
// y delete (borra una imagen al volver al fallback). La fila de `catalogs`
// la actualiza el cliente; aquí solo se tocan objetos de R2.

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_SOURCE_BYTES = 20 * 1024 * 1024
const MAX_SOURCE_PIXELS = 60_000_000
// A4 a 300 dpi son ~2480×3508: 3600 px de lado largo conserva calidad de
// imprenta sin almacenar originales enormes.
const MAX_OUTPUT_SIZE = 3600
const OUTPUT_QUALITY = 88

function sanitizeCatalogId(catalogId) {
  const value = String(catalogId || "").trim().toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) {
    throw new Error("Identificador de catálogo inválido.")
  }
  return value
}

function sanitizeKindIndex(kind, index) {
  if (!["cover", "filler", "backcover"].includes(kind)) throw new Error("Tipo de página inválido.")
  const n = Number.parseInt(index ?? 0, 10)
  if (!Number.isInteger(n) || n < 0 || n > 99) throw new Error("Índice de página inválido.")
  return { kind, index: kind === "filler" ? n : 0 }
}

// Prefijos propiedad de este catálogo: solo dentro de ellos se puede borrar.
const ownedPrefix = catalogId => `catalog/${catalogId}/`
const uploadPrefix = catalogId => `uploads/catalog/${catalogId}/`

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
    const catalogId = sanitizeCatalogId(body.catalogId)
    const action = String(body.action || "")

    if (action === "presign") {
      const { kind, index } = sanitizeKindIndex(body.kind, body.index)
      const contentType = String(body.contentType || "")
      if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
        return jsonResponse({ error: `Tipo de imagen no admitido: ${contentType || "desconocido"}` }, { status: 400 })
      }
      const extension = imageExtension(body.fileName, contentType)
      const path = `${uploadPrefix(catalogId)}${kind}-${index}.${extension}`

      const command = new PutObjectCommand({ Bucket: bucket, Key: path, ContentType: contentType })
      const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 })
      return jsonResponse({ uploadUrl, path, headers: { "content-type": contentType } })
    }

    if (action === "process") {
      const { kind, index } = sanitizeKindIndex(body.kind, body.index)
      const sourcePath = String(body.path || "")
      if (!sourcePath.startsWith(uploadPrefix(catalogId))) {
        throw new Error("La ruta de subida no coincide con el catálogo.")
      }

      const source = await client.send(new GetObjectCommand({ Bucket: bucket, Key: sourcePath }))
      if (source.ContentLength > MAX_SOURCE_BYTES) {
        return jsonResponse({ error: "La imagen supera el tamaño máximo de 20 MB." }, { status: 400 })
      }
      const input = await bodyToBuffer(source.Body)

      const output = await sharp(input, { limitInputPixels: MAX_SOURCE_PIXELS })
        .rotate()
        .resize({ width: MAX_OUTPUT_SIZE, height: MAX_OUTPUT_SIZE, fit: "inside", withoutEnlargement: true })
        .webp({ quality: OUTPUT_QUALITY, effort: 4 })
        .toBuffer()

      const path = `${ownedPrefix(catalogId)}${kind}-${index}-${Date.now()}.webp`
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: path,
        Body: output,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }))

      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: sourcePath }))
      // La imagen anterior solo se borra si pertenece a este catálogo: un
      // catálogo duplicado referencia rutas del original y no debe tocarlas.
      const previousPath = String(body.previousPath || "")
      if (previousPath.startsWith(ownedPrefix(catalogId))) {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: previousPath }))
      }

      return jsonResponse({ path })
    }

    if (action === "delete") {
      const path = String(body.path || "")
      if (path.startsWith(ownedPrefix(catalogId))) {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: path }))
      }
      return jsonResponse({ ok: true })
    }

    return jsonResponse({ error: "Acción inválida." }, { status: 400 })
  } catch (error) {
    console.error("r2-catalog-asset", error)
    return jsonResponse({ error: error.message }, { status: 400 })
  }
}
