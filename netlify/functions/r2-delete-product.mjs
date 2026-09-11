import { DeleteObjectsCommand } from "@aws-sdk/client-s3"
import {
  jsonResponse,
  productImagePaths,
  requireCatalogAdmin,
  requireR2Config,
  requireSupabaseAdmin,
  sanitizeProductId,
} from "./lib/r2-catalog.mjs"

export default async function handler(request) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 })
  }

  try {
    const supabase = requireSupabaseAdmin()
    const auth = await requireCatalogAdmin(request, supabase)
    if (auth.error) return auth.error

    const body = await request.json()
    const catalogId = body.catalogId
    const productId = sanitizeProductId(body.productId)
    if (!catalogId) throw new Error("Falta catalogId.")

    const { data: catalogProduct, error: fetchError } = await supabase
      .from("catalog_products")
      .select("catalog_id,product_id,original_image_path,processed_image_path")
      .eq("catalog_id", catalogId)
      .eq("product_id", productId)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!catalogProduct) return jsonResponse({ error: "Producto no encontrado." }, { status: 404 })

    const { count: linkCount, error: countError } = await supabase
      .from("catalog_products")
      .select("product_id", { count: "exact", head: true })
      .eq("product_id", productId)
    if (countError) throw countError
    const deleteSharedAssets = (linkCount ?? 0) <= 1

    const { error: coverError } = await supabase
      .from("catalog_cover_products")
      .delete()
      .eq("catalog_id", catalogId)
      .eq("product_id", productId)
    if (coverError) throw coverError

    const { error: catalogError } = await supabase
      .from("catalog_products")
      .delete()
      .eq("catalog_id", catalogId)
      .eq("product_id", productId)
    if (catalogError) throw catalogError

    let deletedImages = 0
    if (deleteSharedAssets) {
      const { error: productError } = await supabase
        .from("products")
        .delete()
        .eq("id", productId)
      if (productError) throw productError

      const { bucket, client } = requireR2Config()
      const paths = productImagePaths(productId, catalogProduct)
      await client.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: paths.map(Key => ({ Key })),
          Quiet: true,
        },
      }))
      deletedImages = paths.length
    }

    return jsonResponse({ productId, deletedImages })
  } catch (error) {
    console.error("r2-delete-product", error)
    return jsonResponse({ error: error.message }, { status: 400 })
  }
}
