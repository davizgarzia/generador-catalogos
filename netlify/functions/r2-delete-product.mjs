import { DeleteObjectsCommand } from "@aws-sdk/client-s3"
import {
  jsonResponse,
  productImagePaths,
  requireCatalogAdmin,
  requireR2Config,
  requireSupabaseAdmin,
  sanitizeProductId,
} from "./lib/r2-catalog.mjs"

// Elimina el producto del maestro: sus vínculos en todos los catálogos,
// la fila de products y sus imágenes en R2.
export default async function handler(request) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 })
  }

  try {
    const supabase = requireSupabaseAdmin()
    const auth = await requireCatalogAdmin(request, supabase)
    if (auth.error) return auth.error

    const body = await request.json()
    const productId = sanitizeProductId(body.productId)

    const { data: product, error: fetchError } = await supabase
      .from("products")
      .select("id,original_image_path,processed_image_path")
      .eq("id", productId)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!product) return jsonResponse({ error: "Producto no encontrado." }, { status: 404 })

    const { error: coverError } = await supabase
      .from("catalog_cover_products")
      .delete()
      .eq("product_id", productId)
    if (coverError) throw coverError

    const { error: linksError } = await supabase
      .from("catalog_products")
      .delete()
      .eq("product_id", productId)
    if (linksError) throw linksError

    const { error: productError } = await supabase
      .from("products")
      .delete()
      .eq("id", productId)
    if (productError) throw productError

    const { bucket, client } = requireR2Config()
    const paths = productImagePaths(productId, product)
    await client.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: paths.map(Key => ({ Key })),
        Quiet: true,
      },
    }))

    return jsonResponse({ productId, deletedImages: paths.length })
  } catch (error) {
    console.error("r2-delete-product", error)
    return jsonResponse({ error: error.message }, { status: 400 })
  }
}
