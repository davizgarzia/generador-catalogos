import { createContext, useCallback, useContext, useEffect, useState } from "react"
import {
  loadCatalogBundle,
  loadCatalogProducts,
  loadCatalogRow,
  loadCategories,
} from "../lib/catalog"

const CatalogContext = createContext(null)

export function CatalogProvider({ children }) {
  const [data, setData] = useState({
    catalog: null,
    categories: [],
    products: [],
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

  // Recarga datos comerciales y categorías (tras guardar Ajustes).
  const reloadCatalogInfo = useCallback(() => {
    if (!catalogId) return reload()
    return runRefresh(async () => {
      const [catalog, categories] = await Promise.all([
        loadCatalogRow(),
        loadCategories(),
      ])
      setData(current => ({ ...current, catalog, categories }))
    })
  }, [catalogId, reload, runRefresh])

  useEffect(() => {
    reload()
  }, [reload])

  return (
    <CatalogContext.Provider
      value={{
        catalog: data.catalog,
        categories: data.categories,
        products: data.products,
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
