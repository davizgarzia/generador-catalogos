import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { loadCatalogBundle } from "../lib/catalog"

const CatalogContext = createContext(null)

export function CatalogProvider({ children }) {
  const [data, setData] = useState({
    catalog: null,
    categories: [],
    products: [],
    coverProducts: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const reload = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setData(await loadCatalogBundle())
    } catch (loadError) {
      console.error(loadError)
      setError("No se pudo cargar el catálogo desde Supabase.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return (
    <CatalogContext.Provider value={{ ...data, loading, error, reload }}>
      {children}
    </CatalogContext.Provider>
  )
}

export function useCatalog() {
  return useContext(CatalogContext)
}
