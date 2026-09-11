import { createRef, useEffect, useMemo, useRef, useState } from "react"
import { useCatalog } from "../context/CatalogContext"
import { usePrint } from "../context/PrintContext"
import { useEdit } from "../context/EditContext"
import { useAuth } from "../context/AuthContext"
import { paginateBalanced } from "../lib/pagination"
import Cover from "../components/Cover"
import BackCover from "../components/BackCover"
import FillerPage from "../components/FillerPage"
import InfoPage from "../components/InfoPage"
import CategoryDivider from "../components/CategoryDivider"
import ProductGrid from "../components/ProductGrid"
import LazyPageWrapper from "../components/LazyPageWrapper"
import PageNavigator from "../components/PageNavigator"
import EditSidebar from "../components/EditSidebar"
import CatalogPageHeader from "../components/CatalogPageHeader"

export default function CatalogPage() {
  const { catalog, categories, products, loading, error, reload } = useCatalog()
  const { printMode, printSize, productGrid, hideNoImage } = usePrint()
  const { editingProduct } = useEdit()
  const { isAdmin } = useAuth()
  const [exporting, setExporting] = useState(false)

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

  const pagesByCategory = useMemo(() => {
    const map = {}
    for (const category of categoryOrder) {
      const items = grouped[category]
      if (items?.length) map[category] = paginateBalanced(items, perPage)
    }
    return map
  }, [categoryOrder, grouped, perPage])

  const { pageMeta, navSections, searchItems, fillerCount } = useMemo(() => {
    const list = []
    const sections = []
    const search = []
    const pushPage = meta => list.push(meta) - 1

    sections.push({ type: "page", label: "Portada", index: pushPage({ label: "Portada", color: "#1b3da6" }) })
    sections.push({ type: "page", label: "Información", index: pushPage({ label: "Información", color: null }) })
    for (const category of categoryOrder) {
      const categoryPages = pagesByCategory[category]
      if (!categoryPages) continue
      const cfg = categoryByName[category]
      const n = categoryPages.length
      const children = [
        { label: "Portada de sección", index: pushPage({ label: category, color: cfg.background_color }) },
      ]
      for (let i = 0; i < n; i++) {
        const index = pushPage({ label: `${category} ${i + 1}/${n}`, color: null })
        children.push({ label: `Página ${i + 1} de ${n}`, index })
        for (const product of categoryPages[i]) {
          search.push({ id: product.id, name: product.name, category, index })
        }
      }
      sections.push({ type: "category", label: category, color: cfg.background_color, children })
    }

    // Versión impresa: la imprenta necesita un total de páginas múltiplo de 4
    // (pliegos), así que completamos con hojas de imagen antes de la contraportada.
    const fillerCount = printMode ? (4 - ((list.length + 1) % 4)) % 4 : 0
    for (let i = 0; i < fillerCount; i++) {
      sections.push({
        type: "page",
        label: `Imagen ${i + 1}`,
        index: pushPage({ label: `Imagen ${i + 1}`, color: null }),
      })
    }

    sections.push({ type: "page", label: "Contraportada", index: pushPage({ label: "Contraportada", color: "#1a3f66" }) })

    const total = list.length
    let pageNum = 1
    return {
      pageMeta: list.map(p => ({ ...p, pageNum: pageNum++, total })),
      navSections: sections,
      searchItems: search,
      fillerCount,
    }
  }, [categoryByName, categoryOrder, pagesByCategory, printMode])

  // Refs estables por índice: recrearlas reiniciaría los IntersectionObserver
  // de las páginas lazy y de las miniaturas en cada cambio de vista.
  const refStoreRef = useRef([])
  const pageRefs = useMemo(() => {
    const store = refStoreRef.current
    while (store.length < pageMeta.length) store.push(createRef())
    return store.slice(0, pageMeta.length)
  }, [pageMeta])
  const pages = useMemo(
    () => pageMeta.map((meta, i) => ({ ...meta, ref: pageRefs[i] })),
    [pageMeta, pageRefs]
  )

  const catalogAreaRef = useRef(null)

  useEffect(() => {
    if (!pages.length) return
    requestAnimationFrame(() => {
      if (catalogAreaRef.current) catalogAreaRef.current.scrollTop = 0
    })
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
  const forceRenderPages = exporting

  return (
    <div className="flex flex-col h-full">
      <CatalogPageHeader
        totalProducts={visibleProducts.length}
        totalPages={pages.length}
        hiddenProductsList={hiddenProductsList}
        onExportingChange={setExporting}
      />

      <div className="flex-1 flex min-h-0">
        <PageNavigator
          pages={pages}
          sections={navSections}
          searchItems={searchItems}
          rootRef={catalogAreaRef}
        />

        <div ref={catalogAreaRef} id="catalog-area" className="flex-1 overflow-auto">
          <div id="catalog">
            <LazyPageWrapper ref={pageRefs[ri++]} rootRef={catalogAreaRef} forceRender={forceRenderPages}>
              <Cover />
            </LazyPageWrapper>

            {(() => { const i = ri++; return (
              <LazyPageWrapper ref={pageRefs[i]} page={pageMeta[i].pageNum} total={pageMeta[i].total} rootRef={catalogAreaRef} forceRender={forceRenderPages}>
                <InfoPage />
              </LazyPageWrapper>
            )})()}

            {categoryOrder.map((category) => {
              const categoryPages = pagesByCategory[category]
              if (!categoryPages) return null
              const numPages = categoryPages.length
              const dividerRef = pageRefs[ri++]
              const gridRefs = pageRefs.slice(ri, ri + numPages)
              const gridMeta = pageMeta.slice(ri, ri + numPages)
              ri += numPages

              return (
                <section key={category}>
                  <LazyPageWrapper ref={dividerRef} rootRef={catalogAreaRef} forceRender={forceRenderPages}>
                    <CategoryDivider category={category} />
                  </LazyPageWrapper>
                  <ProductGrid
                    productPages={categoryPages}
                    category={category}
                    perPage={perPage}
                    pageRefs={gridRefs}
                    pageMeta={gridMeta}
                    rootRef={catalogAreaRef}
                    forceRenderPages={forceRenderPages}
                  />
                </section>
              )
            })}

            {Array.from({ length: fillerCount }, (_, i) => {
              const idx = ri++
              return (
                <LazyPageWrapper key={`filler-${i}`} ref={pageRefs[idx]} rootRef={catalogAreaRef} forceRender={forceRenderPages}>
                  <FillerPage index={i} />
                </LazyPageWrapper>
              )
            })}

            <LazyPageWrapper ref={pageRefs[ri++]} rootRef={catalogAreaRef} forceRender={forceRenderPages}>
              <BackCover />
            </LazyPageWrapper>
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
