import {
  jsonResponse,
  requireCatalogAdmin,
  requireSupabaseAdmin,
} from "./lib/r2-catalog.mjs"

const MAX_PRODUCTS = 20000

// Sincroniza el maestro de productos desde el Excel/CSV de stock.
// La composición de cada catálogo se gestiona por separado en la UI.
export default async function handler(request) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 })
  }

  try {
    const supabase = requireSupabaseAdmin()
    const auth = await requireCatalogAdmin(request, supabase)
    if (auth.error) return auth.error

    const body = await request.json()
    const products = body.products
    const markMissing = body.markMissing !== false

    if (!Array.isArray(products) || !products.length) {
      return jsonResponse({ error: "No hay productos que importar." }, { status: 400 })
    }
    if (products.length > MAX_PRODUCTS) {
      return jsonResponse({ error: `El fichero supera el máximo de ${MAX_PRODUCTS} productos.` }, { status: 400 })
    }

    const { data, error } = await supabase.rpc("import_master_products", {
      input_products: products,
      input_requested_by: auth.user.id,
      input_mark_missing: markMissing,
    })
    if (error) throw error

    return jsonResponse(data)
  } catch (error) {
    console.error("import-master-products", error)
    return jsonResponse({ error: error.message }, { status: 400 })
  }
}
