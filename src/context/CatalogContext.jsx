import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import {
  loadCatalogProducts,
  loadCatalogRow,
  loadCatalogs,
  loadCategories,
  loadCompanyProfile,
  loadProducts,
} from "../lib/catalog"
import { useAuth } from "./AuthContext"

const CatalogContext = createContext(null)

// Datasets globales: cada uno se carga y se aplica por separado. Antes iban en
// un único Promise.all con los setState después del await, así que un fallo
// puntual en cualquiera de ellos dejaba TODOS vacíos — y con `categories` a []
// el catálogo se pintaba sin secciones (solo portada, información y
// contraportada) como si estuviera vacío.
const DATASETS = ["products", "categories", "catalogs", "company"]
const META_DATASETS = ["categories", "catalogs", "company"]
const LOADERS = {
  products: loadProducts,
  categories: loadCategories,
  catalogs: loadCatalogs,
  company: loadCompanyProfile,
}
// Espera antes del único reintento automático de los datasets que fallaron.
const RETRY_DELAY_MS = 1500

export function CatalogProvider({ children }) {
  // Datos globales: maestro de productos, categorías, lista de catálogos y empresa.
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [catalogs, setCatalogs] = useState([])
  const [company, setCompany] = useState({ settings: {} })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [failedDatasets, setFailedDatasets] = useState([])

  // La sesión de Supabase se restaura de forma asíncrona al arrancar. Cargar
  // antes de tenerla deja las peticiones sin token y el RLS devuelve vacío sin
  // error: hay que esperar a que AuthProvider resuelva.
  const { session, loading: authLoading } = useAuth()
  const userId = session?.user?.id ?? null

  // Detalle del catálogo que se está viendo (/catalogs/:slug).
  const [viewedSlug, setViewedSlug] = useState(null)
  const [detail, setDetail] = useState({ catalog: null, items: [] })
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState("")
  const detailIdRef = useRef(null)
  detailIdRef.current = detail.catalog?.id ?? null

  const applyDataset = useCallback((key, value) => {
    if (key === "products") setProducts(value)
    else if (key === "categories") setCategories(value)
    else if (key === "catalogs") setCatalogs(value)
    else if (key === "company") setCompany(value)
  }, [])

  // Carga los datasets indicados en paralelo y aplica los que salgan bien:
  // los fallos se acumulan y se devuelven para poder reintentarlos solos.
  const runLoads = useCallback(
    async keys => {
      setRefreshing(true)
      const results = await Promise.allSettled(keys.map(key => LOADERS[key]()))
      const failed = []
      results.forEach((result, index) => {
        const key = keys[index]
        if (result.status === "fulfilled") applyDataset(key, result.value)
        else {
          failed.push(key)
          console.error(`No se pudo cargar "${key}" desde Supabase.`, result.reason)
        }
      })
      setFailedDatasets(current => [
        ...current.filter(key => !keys.includes(key)),
        ...failed,
      ])
      setRefreshing(false)
      setLoading(false)
      return failed
    },
    [applyDataset]
  )

  // Un fallo de red o un token a medio refrescar son transitorios: se reintenta
  // una vez en silencio y solo si vuelve a fallar se muestra el error.
  const loadDatasets = useCallback(
    async keys => {
      setError("")
      let failed = await runLoads(keys)
      if (failed.length) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
        failed = await runLoads(failed)
      }
      if (failed.length) setError("No se pudieron cargar los datos desde Supabase.")
      return failed
    },
    [runLoads]
  )

  const reload = useCallback(() => loadDatasets(DATASETS), [loadDatasets])
  const reloadMeta = useCallback(() => loadDatasets(META_DATASETS), [loadDatasets])

  const reloadProducts = useCallback(async () => {
    setError("")
    const failed = await runLoads(["products"])
    if (failed.length) {
      setError("No se pudieron cargar los datos desde Supabase.")
      return
    }
    // El detalle abierto muestra datos del maestro: mantenerlo en sincronía.
    if (detailIdRef.current) {
      try {
        const items = await loadCatalogProducts(detailIdRef.current)
        setDetail(current => ({ ...current, items }))
      } catch (loadError) {
        console.error(loadError)
        setDetailError("No se pudo actualizar el catálogo.")
      }
    }
  }, [runLoads])

  useEffect(() => {
    if (authLoading) return
    if (!userId) {
      // Sin sesión no hay nada que leer: limpiar evita servir datos del
      // usuario anterior si se vuelve a entrar con otra cuenta.
      setProducts([])
      setCategories([])
      setCatalogs([])
      setCompany({ settings: {} })
      setFailedDatasets([])
      setError("")
      setLoading(false)
      return
    }
    reload()
  }, [authLoading, userId, reload])

  // Carga del detalle cuando cambia el catálogo visitado.
  const openCatalog = useCallback(slug => {
    setViewedSlug(slug)
  }, [])

  const loadDetail = useCallback(async slug => {
    if (!slug) return
    setDetailLoading(true)
    setDetailError("")
    try {
      const catalog = await loadCatalogRow(slug)
      const items = await loadCatalogProducts(catalog.id)
      setDetail({ catalog, items })
    } catch (loadError) {
      console.error(loadError)
      setDetail({ catalog: null, items: [] })
      setDetailError("No se pudo cargar el catálogo.")
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // El detalle depende de la misma sesión que el resto: esperar a Auth evita
  // pedirlo sin token y que el RLS devuelva un catálogo vacío.
  useEffect(() => {
    if (authLoading || !userId) return
    loadDetail(viewedSlug)
  }, [authLoading, userId, viewedSlug, loadDetail])

  const reloadCatalogItems = useCallback(async () => {
    if (!detail.catalog?.id) return
    try {
      const items = await loadCatalogProducts(detail.catalog.id)
      setDetail(current => ({ ...current, items }))
    } catch (loadError) {
      console.error(loadError)
      setDetailError("No se pudo actualizar el catálogo.")
    }
  }, [detail.catalog?.id])

  // Refresco ligero de la fila del catálogo (sin pasar por detailLoading,
  // que desmontaría la vista y perdería el scroll).
  const reloadCatalogRow = useCallback(async () => {
    if (!detail.catalog?.slug) return
    try {
      const catalog = await loadCatalogRow(detail.catalog.slug)
      setDetail(current => ({ ...current, catalog }))
    } catch (loadError) {
      console.error(loadError)
      setDetailError("No se pudo actualizar el catálogo.")
    }
  }, [detail.catalog?.slug])

  return (
    <CatalogContext.Provider
      value={{
        // Global
        products,
        categories,
        catalogs,
        company,
        loading,
        refreshing,
        error,
        failedDatasets,
        reload,
        reloadProducts,
        reloadMeta,
        // Detalle
        catalog: detail.catalog,
        catalogItems: detail.items,
        detailLoading,
        detailError,
        openCatalog,
        reloadCatalogDetail: loadDetail,
        reloadCatalogItems,
        reloadCatalogRow,
      }}
    >
      {children}
    </CatalogContext.Provider>
  )
}

export function useCatalog() {
  return useContext(CatalogContext)
}
