import { Fragment, createRef, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import { useCatalog } from "../context/CatalogContext"
import CatalogProductsManager from "../components/CatalogProductsManager"
import { usePrint } from "../context/PrintContext"
import { useEdit } from "../context/EditContext"
import { useAuth } from "../context/AuthContext"
import { paginateBalanced } from "../lib/pagination"
import { saveCatalogFillerEntries, saveCategoryOrder } from "../lib/catalog"
import Cover from "../components/Cover"
import BackCover from "../components/BackCover"
import FillerPage from "../components/FillerPage"
import InfoPage from "../components/InfoPage"
import CategoryDivider from "../components/CategoryDivider"
import ProductGrid from "../components/ProductGrid"
import LazyPageWrapper from "../components/LazyPageWrapper"
import PageNavigator from "../components/PageNavigator"
import EditSidebar from "../components/EditSidebar"
import PageEditSidebar from "../components/PageEditSidebar"
import CatalogPageHeader from "../components/CatalogPageHeader"

export default function CatalogPage() {
  const { slug } = useParams()
  const {
    catalog,
    catalogItems: products,
    categories,
    detailLoading,
    detailError,
    openCatalog,
    reloadCatalogDetail,
    reloadCatalogRow,
    reloadMeta,
  } = useCatalog()
  const { printMode, printSize, productGrid, hideNoImage } = usePrint()
  const { editingProduct, editingPage, setEditingPage } = useEdit()
  const { isAdmin } = useAuth()
  const [exporting, setExporting] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)

  useEffect(() => {
    openCatalog(slug)
    setEditingPage(null)
  }, [slug, openCatalog, setEditingPage])

  const detailReady = catalog?.slug === slug

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

  const fillerEntries = useMemo(() => catalog?.fillerEntries ?? [], [catalog])

  const { pageMeta, navSections, searchItems, autoFillerCount, entriesByAnchor } = useMemo(() => {
    const list = []
    const sections = []
    const search = []
    const pushPage = meta => list.push(meta) - 1
    let imageNumber = 1

    // Hojas de imagen colocadas, agrupadas por su ancla: "start" (antes de la
    // primera categoría), el id de una categoría visible, o "end" (tramo
    // final; también las ancladas a categorías sin páginas en este catálogo).
    const visibleIds = new Set(
      categoryOrder
        .filter(name => pagesByCategory[name])
        .map(name => String(categoryByName[name]?.id))
    )
    const entriesByAnchor = {}
    fillerEntries.forEach((entry, entryIndex) => {
      const id = entry.after != null ? String(entry.after) : null
      const anchor = entry.after === "start" ? "start" : id && visibleIds.has(id) ? id : "end"
      ;(entriesByAnchor[anchor] ??= []).push({ ...entry, entryIndex })
    })

    const pushImagePages = anchor => {
      for (const entry of entriesByAnchor[anchor] ?? []) {
        const label = `Imagen ${imageNumber++}`
        sections.push({
          type: "page",
          label,
          imgEntry: entry.entryIndex,
          index: pushPage({ label, color: null }),
        })
      }
    }

    sections.push({ type: "page", label: "Portada", index: pushPage({ label: "Portada", color: "#1b3da6" }) })
    sections.push({ type: "page", label: "Información", index: pushPage({ label: "Información", color: null }) })
    pushImagePages("start")
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
      sections.push({
        type: "category",
        label: category,
        color: cfg.background_color,
        categoryId: cfg.id,
        children,
      })
      pushImagePages(String(cfg.id))
    }
    pushImagePages("end")

    // Versión impresa: la imprenta necesita un total de páginas múltiplo de 4
    // (pliegos), así que completamos con hojas automáticas antes de la
    // contraportada.
    const autoFillerCount = printMode ? (4 - ((list.length + 1) % 4)) % 4 : 0
    for (let i = 0; i < autoFillerCount; i++) {
      const label = `Imagen ${imageNumber++}`
      sections.push({
        type: "page",
        label,
        autoFiller: i,
        index: pushPage({ label, color: null }),
      })
    }

    sections.push({ type: "page", label: "Contraportada", index: pushPage({ label: "Contraportada", color: "#1a3f66" }) })

    const total = list.length
    let pageNum = 1
    return {
      pageMeta: list.map(p => ({ ...p, pageNum: pageNum++, total })),
      navSections: sections,
      searchItems: search,
      autoFillerCount,
      entriesByAnchor,
    }
  }, [categoryByName, categoryOrder, pagesByCategory, printMode, fillerEntries])

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

  if (detailLoading || (!detailReady && !detailError)) {
    return (
      <div className="p-10 text-sm text-muted-foreground">Cargando catálogo…</div>
    )
  }

  if (detailError || !catalog) {
    return (
      <div className="p-10 flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">
          {detailError || "No existe este catálogo."}
        </p>
        <button onClick={() => reloadCatalogDetail(slug)} className="text-sm underline text-primary">
          Reintentar
        </button>
      </div>
    )
  }

  // Un único arrastre puede reordenar secciones (orden global de categorías)
  // y/o recolocar hojas de imagen (ancla por catálogo): se recorre la lista
  // soltada y se persiste solo lo que cambió.
  async function handleReorderMiddle(items) {
    try {
      const newCategoryIds = items.filter(item => item.type === "cat").map(item => String(item.id))
      const currentCategoryIds = categoryOrder
        .filter(name => pagesByCategory[name])
        .map(name => String(categoryByName[name]?.id))

      let lastAnchor = "start"
      const nextEntries = []
      for (const item of items) {
        if (item.type === "cat") {
          lastAnchor = String(item.id)
        } else if (fillerEntries[item.entryIndex]) {
          nextEntries.push({ path: fillerEntries[item.entryIndex].path, after: lastAnchor })
        }
      }
      const currentEntries = fillerEntries.map(entry => ({ path: entry.path, after: entry.after ?? null }))

      if (JSON.stringify(newCategoryIds) !== JSON.stringify(currentCategoryIds)) {
        // El sidebar solo lista categorías con productos: las demás conservan
        // su posición relativa y solo se reordena la subsecuencia visible.
        const visible = new Set(newCategoryIds)
        const queue = [...newCategoryIds]
        const fullOrder = categories.map(category =>
          visible.has(String(category.id)) ? queue.shift() : String(category.id)
        )
        await saveCategoryOrder(fullOrder)
        await reloadMeta()
      }
      if (JSON.stringify(nextEntries) !== JSON.stringify(currentEntries)) {
        await saveCatalogFillerEntries(catalog, nextEntries)
        await reloadCatalogRow()
      }
    } catch (error) {
      console.error("No se pudo guardar el nuevo orden", error)
    }
  }

  let ri = 0
  const forceRenderPages = exporting

  const renderPlacedImages = anchor =>
    (entriesByAnchor[anchor] ?? []).map(entry => {
      const idx = ri++
      return (
        <LazyPageWrapper
          key={`img-${entry.entryIndex}`}
          ref={pageRefs[idx]}
          rootRef={catalogAreaRef}
          forceRender={forceRenderPages}
        >
          <FillerPage image={entry.image} entryIndex={entry.entryIndex} />
        </LazyPageWrapper>
      )
    })

  return (
    <div className="flex flex-col h-full">
      <CatalogPageHeader
        catalogName={catalog.name}
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
          onManageProducts={isAdmin ? () => setManagerOpen(true) : undefined}
          onReorderMiddle={isAdmin ? handleReorderMiddle : undefined}
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

            {renderPlacedImages("start")}

            {categoryOrder.map((category) => {
              const categoryPages = pagesByCategory[category]
              if (!categoryPages) return null
              const numPages = categoryPages.length
              const dividerRef = pageRefs[ri++]
              const gridRefs = pageRefs.slice(ri, ri + numPages)
              const gridMeta = pageMeta.slice(ri, ri + numPages)
              ri += numPages

              return (
                <Fragment key={category}>
                  <section>
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
                  {renderPlacedImages(String(categoryByName[category]?.id))}
                </Fragment>
              )
            })}

            {renderPlacedImages("end")}

            {Array.from({ length: autoFillerCount }, (_, i) => {
              const idx = ri++
              return (
                <LazyPageWrapper key={`autofiller-${i}`} ref={pageRefs[idx]} rootRef={catalogAreaRef} forceRender={forceRenderPages}>
                  <FillerPage seedIndex={i} />
                </LazyPageWrapper>
              )
            })}

            <LazyPageWrapper ref={pageRefs[ri++]} rootRef={catalogAreaRef} forceRender={forceRenderPages}>
              <BackCover />
            </LazyPageWrapper>
          </div>
        </div>

        {(editingProduct || editingPage) && isAdmin && (
          <aside className="app-chrome w-80 shrink-0 bg-background border-l border-border flex flex-col min-h-0 h-full">
            {editingProduct ? <EditSidebar /> : <PageEditSidebar />}
          </aside>
        )}
      </div>

      {isAdmin && (
        <CatalogProductsManager open={managerOpen} onOpenChange={setManagerOpen} />
      )}
    </div>
  )
}
