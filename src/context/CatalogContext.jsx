import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import {
  loadCatalogProducts,
  loadCatalogRow,
  loadCatalogs,
  loadCategories,
  loadCompanyProfile,
  loadProducts,
} from "../lib/catalog"

const CatalogContext = createContext(null)

export function CatalogProvider({ children }) {
  // Datos globales: maestro de productos, categorías, lista de catálogos y empresa.
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [catalogs, setCatalogs] = useState([])
  const [company, setCompany] = useState({ settings: {} })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  // Detalle del catálogo que se está viendo (/catalogs/:slug).
  const [viewedSlug, setViewedSlug] = useState(null)
  const [detail, setDetail] = useState({ catalog: null, items: [] })
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState("")
  const detailIdRef = useRef(null)
  detailIdRef.current = detail.catalog?.id ?? null

  const runRefresh = useCallback(async task => {
    setError("")
    setRefreshing(true)
    try {
      await task()
    } catch (loadError) {
      console.error(loadError)
      setError("No se pudieron cargar los datos desde Supabase.")
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

  const reload = useCallback(
    () =>
      runRefresh(async () => {
        const [master, categoryList, catalogList, companyProfile] = await Promise.all([
          loadProducts(),
          loadCategories(),
          loadCatalogs(),
          loadCompanyProfile(),
        ])
        setProducts(master)
        setCategories(categoryList)
        setCatalogs(catalogList)
        setCompany(companyProfile)
      }),
    [runRefresh]
  )

  const reloadProducts = useCallback(
    () =>
      runRefresh(async () => {
        setProducts(await loadProducts())
        // El detalle abierto muestra datos del maestro: mantenerlo en sincronía.
        if (detailIdRef.current) {
          const items = await loadCatalogProducts(detailIdRef.current)
          setDetail(current => ({ ...current, items }))
        }
      }),
    [runRefresh]
  )

  const reloadMeta = useCallback(
    () =>
      runRefresh(async () => {
        const [categoryList, catalogList, companyProfile] = await Promise.all([
          loadCategories(),
          loadCatalogs(),
          loadCompanyProfile(),
        ])
        setCategories(categoryList)
        setCatalogs(catalogList)
        setCompany(companyProfile)
      }),
    [runRefresh]
  )

  useEffect(() => {
    reload()
  }, [reload])

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

  useEffect(() => {
    loadDetail(viewedSlug)
  }, [viewedSlug, loadDetail])

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
