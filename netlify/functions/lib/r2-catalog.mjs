import { createClient } from "@supabase/supabase-js"
import { S3Client } from "@aws-sdk/client-s3"

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

export { PRODUCT_VARIANTS }

export function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  })
}

export function requireR2Config() {
  const bucket = process.env.R2_BUCKET_NAME || "impormed-catalog"
  const endpoint =
    process.env.R2_ENDPOINT ||
    (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : null)
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Faltan variables R2_BUCKET_NAME, R2_ENDPOINT/R2_ACCOUNT_ID, R2_ACCESS_KEY_ID o R2_SECRET_ACCESS_KEY.")
  }

  return {
    bucket,
    client: new S3Client({
      region: "auto",
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    }),
  }
}

export function requireSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.")
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function requireCatalogAdmin(request, supabase) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (!token) return { error: jsonResponse({ error: "Unauthorized" }, { status: 401 }) }

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) {
    return { error: jsonResponse({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: admin } = await supabase
    .from("catalog_admins")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle()

  if (!admin) return { error: jsonResponse({ error: "Forbidden" }, { status: 403 }) }
  return { user: userData.user }
}

export function sanitizeProductId(productId) {
  const value = String(productId || "").trim()
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Referencia de producto inválida.")
  return value
}

export function normalizeVariant(variant) {
  if (variant === "processed") return "processed"
  if (!variant || variant === "original") return "original"
  throw new Error("Variante de imagen inválida.")
}

export function imageExtension(filename, contentType) {
  const byType = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }
  const fromType = byType[String(contentType || "").toLowerCase()]
  if (fromType) return fromType

  const fromName = String(filename || "").split(".").pop()?.toLowerCase()
  if (["jpg", "jpeg", "png", "webp"].includes(fromName)) return fromName === "jpeg" ? "jpg" : fromName
  throw new Error("Formato de imagen no soportado.")
}

export function sourcePathForProduct(productId, variant, extension) {
  return variant === "processed"
    ? `nobg/${productId}.png`
    : `original/${productId}.${extension}`
}

export function productVariantPath(productId, size, variant) {
  const config = PRODUCT_VARIANTS[variant]?.[size]
  if (!config) throw new Error("Tamaño de variante inválido.")
  return `${config.folder}/${productId}.webp`
}

export function productImagePaths(productId, row = {}) {
  const paths = new Set([
    row.original_image_path,
    row.processed_image_path,
    `original/${productId}.jpg`,
    `original/${productId}.jpeg`,
    `original/${productId}.png`,
    `original/${productId}.webp`,
    `nobg/${productId}.png`,
  ])

  for (const variant of Object.keys(PRODUCT_VARIANTS)) {
    for (const size of Object.keys(PRODUCT_VARIANTS[variant])) {
      paths.add(productVariantPath(productId, size, variant))
    }
  }

  return [...paths].filter(Boolean)
}

export function assertExpectedSourcePath(path, productId, variant) {
  const expectedPrefix = variant === "processed" ? `nobg/${productId}.` : `original/${productId}.`
  if (!String(path || "").startsWith(expectedPrefix)) {
    throw new Error("La ruta de imagen no coincide con el producto.")
  }
}

export async function bodyToBuffer(body) {
  const chunks = []
  for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}
