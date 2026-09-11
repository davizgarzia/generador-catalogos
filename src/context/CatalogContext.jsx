import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import {
  loadCatalogBundle,
  loadCatalogProducts,
  loadCatalogRow,
  loadCategories,
  loadCoverProductIds,
} from "../lib/catalog"

const CatalogContext = createContext(null)

export function CatalogProvider({ children }) {
  const [data, setData] = useState({
    catalog: null,
    categories: [],
    products: [],
    coverIds: [],
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  const runRefresh = useCallback(async task => {
    setError("")
    setRefreshing(true)
    try {
      await task()
    } catch (loadError) {
      console.error(loadError)
      setError("No se pudo cargar el catálogo desde Supabase.")
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

  const reload = useCallback(
    () => runRefresh(async () => setData(await loadCatalogBundle())),
    [runRefresh]
  )

  const catalogId = data.catalog?.id

  // Recarga solo los productos del catálogo (tras crear/editar/borrar/importar).
  const reloadProducts = useCallback(() => {
    if (!catalogId) return reload()
    return runRefresh(async () => {
      const products = await loadCatalogProducts(catalogId)
      setData(current => ({ ...current, products }))
    })
  }, [catalogId, reload, runRefresh])

  // Recarga datos comerciales, categorías y mosaico (tras guardar Ajustes).
  const reloadCatalogInfo = useCallback(() => {
    if (!catalogId) return reload()
    return runRefresh(async () => {
      const [catalog, categories, coverIds] = await Promise.all([
        loadCatalogRow(),
        loadCategories(),
        loadCoverProductIds(catalogId),
      ])
      setData(current => ({ ...current, catalog, categories, coverIds }))
    })
  }, [catalogId, reload, runRefresh])

  useEffect(() => {
    reload()
  }, [reload])

  const coverProducts = useMemo(() => {
    const byId = new Map(data.products.map(product => [product.id, product]))
    return data.coverIds.map(id => byId.get(id)).filter(Boolean)
  }, [data.products, data.coverIds])

  return (
    <CatalogContext.Provider
      value={{
        catalog: data.catalog,
        categories: data.categories,
        products: data.products,
        coverProducts,
        loading,
        refreshing,
        error,
        reload,
        reloadProducts,
        reloadCatalogInfo,
      }}
    >
      {children}
    </CatalogContext.Provider>
  )
}

export function useCatalog() {
  return useContext(CatalogContext)
}
