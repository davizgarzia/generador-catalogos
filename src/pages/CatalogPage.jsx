import { createRef, useEffect, useMemo, useRef } from "react"
import { useCatalog } from "../context/CatalogContext"
import { usePrint } from "../context/PrintContext"
import { useEdit } from "../context/EditContext"
import { useAuth } from "../context/AuthContext"
import { paginateBalanced } from "../lib/pagination"
import Cover from "../components/Cover"
import BackCover from "../components/BackCover"
import InfoPage from "../components/InfoPage"
import CategoryDivider from "../components/CategoryDivider"
import ProductGrid from "../components/ProductGrid"
import PageWrapper from "../components/PageWrapper"
import PageNavigator from "../components/PageNavigator"
import EditSidebar from "../components/EditSidebar"
import CatalogPageHeader from "../components/CatalogPageHeader"

export default function CatalogPage() {
  const { catalog, categories, products, loading, error, reload } = useCatalog()
  const { printMode, printSize, productGrid, hideNoImage } = usePrint()
  const { editingProduct } = useEdit()
  const { isAdmin } = useAuth()

  const categoryOrder = useMemo(
    () => categories.map(category => category.display_name),
    [categories]
  )
  const categoryByName = useMemo(
    () => Object.fromEntries(categories.map(category => [category.display_name, category])),
    [categories]
  )
  const perPage = productGrid === "3x3" ? 9 : productGrid === "4x3" ? 12 : 16
  const activeProducts = useMemo(
    () => products.filter(product => product.active),
    [products]
  )
  const visibleProducts = useMemo(
    () => hideNoImage ? activeProducts.filter(product => Boolean(product.image)) : activeProducts,
    [hideNoImage, activeProducts]
  )
  const hiddenProductsList = useMemo(
    () => hideNoImage ? activeProducts.filter(product => !product.image) : [],
    [hideNoImage, activeProducts]
  )

  // Inject @page based on print mode. Only applies while the catalog page
  // is mounted; cleanup restores the body to its default state so the
  // products/settings views don't inherit print-mode styles.
  useEffect(() => {
    let element = document.getElementById("dynamic-page-style")
    if (!element) {
      element = document.createElement("style")
      element.id = "dynamic-page-style"
      document.head.appendChild(element)
    }
    if (!printMode) {
      element.textContent = `@page { size: 210mm 297mm; margin: 0; }`
      document.body.classList.remove("mode-print")
      document.body.classList.add("mode-normal")
    } else {
      element.textContent = `@page { size: 216mm 303mm; margin: 0; }`
      document.body.classList.remove("mode-normal")
      document.body.classList.add("mode-print")
    }
    return () => {
      document.getElementById("dynamic-page-style")?.remove()
      document.body.classList.remove("mode-print")
      document.body.classList.remove("mode-normal")
    }
  }, [printMode, printSize])

  const grouped = useMemo(() => {
    const map = {}
    for (const product of visibleProducts) {
      if (!map[product.category]) map[product.category] = []
      map[product.category].push(product)
    }
    return map
  }, [visibleProducts])

  const pageMeta = useMemo(() => {
    const list = []
    list.push({ label: "Portada",     color: "#1b3da6", icon: "📘", paginated: false })
    list.push({ label: "Información", color: null,                   paginated: true  })
    for (const category of categoryOrder) {
      const cat = grouped[category]
      if (!cat?.length) continue
      const cfg = categoryByName[category]
      list.push({ label: category, color: cfg.background_color, paginated: false })
      const n = paginateBalanced(cat, perPage).length
      for (let i = 0; i < n; i++) {
        list.push({ label: `${category} ${i + 1}/${n}`, color: null, paginated: true })
      }
    }
    list.push({ label: "Contraportada", color: "#1a3f66", icon: "📘", paginated: false })

    const total = list.length
    let pageNum = 1
    return list.map(p => ({ ...p, pageNum: pageNum++, total }))
  }, [categoryByName, categoryOrder, grouped, perPage])

  const pageRefs = useMemo(() => pageMeta.map(() => createRef()), [pageMeta])
  const pages = useMemo(
    () => pageMeta.map((meta, i) => ({ ...meta, ref: pageRefs[i] })),
    [pageMeta, pageRefs]
  )

  const catalogAreaRef = useRef(null)
  const scrollRestoredRef = useRef(false)

  useEffect(() => {
    const el = catalogAreaRef.current
    if (!el) return
    let timeoutId
    function handleScroll() {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        try {
          window.localStorage.setItem("impormed.catalogScroll", String(el.scrollTop))
        } catch {
          // ignore quota / disabled storage
        }
      }, 200)
    }
    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      el.removeEventListener("scroll", handleScroll)
      clearTimeout(timeoutId)
    }
  }, [pages.length])

  useEffect(() => {
    if (scrollRestoredRef.current || !pages.length) return
    const el = catalogAreaRef.current
    if (!el) return
    try {
      const saved = window.localStorage.getItem("impormed.catalogScroll")
      if (saved !== null) {
        const value = Number(saved)
        if (Number.isFinite(value) && value > 0) {
          requestAnimationFrame(() => {
            if (catalogAreaRef.current) catalogAreaRef.current.scrollTop = value
          })
        }
      }
    } catch {
      // ignore
    }
    scrollRestoredRef.current = true
  }, [pages.length])

  if (loading) {
    return (
      <div className="p-10 text-sm text-muted-foreground">Cargando catálogo…</div>
    )
  }

  if (error || !catalog) {
    return (
      <div className="p-10 flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">
          {error || "No existe un catálogo activo."}
        </p>
        <button onClick={reload} className="text-sm underline text-primary">
          Reintentar
        </button>
      </div>
    )
  }

  let ri = 0

  return (
    <div className="flex flex-col h-full">
      <CatalogPageHeader
        catalog={catalog}
        totalProducts={visibleProducts.length}
        totalPages={pages.length}
        hiddenProductsList={hiddenProductsList}
      />

      <div className="flex-1 flex min-h-0">
        <PageNavigator pages={pages} />

        <div ref={catalogAreaRef} id="catalog-area" className="flex-1 overflow-auto">
          <div id="catalog">
            <PageWrapper ref={pageRefs[ri++]}>
              <Cover />
            </PageWrapper>

            {(() => { const i = ri++; return (
              <PageWrapper ref={pageRefs[i]} page={pageMeta[i].pageNum} total={pageMeta[i].total}>
                <InfoPage />
              </PageWrapper>
            )})()}

            {categoryOrder.map((category) => {
              const categoryProducts = grouped[category]
              if (!categoryProducts?.length) return null
              const numPages = paginateBalanced(categoryProducts, perPage).length
              const dividerRef = pageRefs[ri++]
              const gridRefs = pageRefs.slice(ri, ri + numPages)
              const gridMeta = pageMeta.slice(ri, ri + numPages)
              ri += numPages

              return (
                <section key={category}>
                  <PageWrapper ref={dividerRef}>
                    <CategoryDivider category={category} />
                  </PageWrapper>
                  <ProductGrid
                    products={categoryProducts}
                    category={category}
                    perPage={perPage}
                    pageRefs={gridRefs}
                    pageMeta={gridMeta}
                  />
                </section>
              )
            })}

            <PageWrapper ref={pageRefs[ri++]}>
              <BackCover />
            </PageWrapper>
          </div>
        </div>

        {editingProduct && isAdmin && (
          <aside className="w-80 shrink-0 bg-background border-l border-border flex flex-col min-h-0 h-full">
            <EditSidebar />
          </aside>
        )}
      </div>
    </div>
  )
}
