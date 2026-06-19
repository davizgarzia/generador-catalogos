import { useMemo, createRef, useEffect } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { usePrint } from "./context/PrintContext"
import { useCatalog } from "./context/CatalogContext"
import Cover from "./components/Cover"
import InfoPage from "./components/InfoPage"
import CategoryDivider from "./components/CategoryDivider"
import ProductGrid from "./components/ProductGrid"
import Topbar from "./components/Topbar"
import Sidebar from "./components/Sidebar"
import PageWrapper from "./components/PageWrapper"
import PageNavigator from "./components/PageNavigator"
import { paginateBalanced } from "./lib/pagination"

export default function App() {
  const { catalog, categories, products, loading, error, reload } = useCatalog()
  const { printMode, printSize, productGrid, hideNoImage } = usePrint()
  const categoryOrder = useMemo(() => categories.map(category => category.display_name), [categories])
  const categoryByName = useMemo(
    () => Object.fromEntries(categories.map(category => [category.display_name, category])),
    [categories]
  )
  const perPage = productGrid === "3x3" ? 9 : productGrid === "4x3" ? 12 : 16
  const visibleProducts = useMemo(
    () => hideNoImage ? products.filter(product => Boolean(product.image)) : products,
    [hideNoImage, products]
  )
  const hiddenProductsList = useMemo(
    () => hideNoImage ? products.filter(product => !product.image) : [],
    [hideNoImage, products]
  )

  // Inyectar @page dinámicamente según modo y tamaño:
  // - sin marcas:            A4 exacto 210×297mm
  // - con marcas A4:         216×303mm (A4 + 3mm sangre)
  // - con marcas A5 en A4:   216×303mm (el papel sigue siendo A4, el contenido se escala)
  useEffect(() => {
    let el = document.getElementById("dynamic-page-style")
    if (!el) {
      el = document.createElement("style")
      el.id = "dynamic-page-style"
      document.head.appendChild(el)
    }
    if (!printMode) {
      el.textContent = `@page { size: 210mm 297mm; margin: 0; }`
      document.body.classList.remove("mode-print")
      document.body.classList.add("mode-normal")
    } else {
      // Tanto A4 como A5: el papel impreso es siempre A4 con sangre
      el.textContent = `@page { size: 216mm 303mm; margin: 0; }`
      document.body.classList.remove("mode-normal")
      document.body.classList.add("mode-print")
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

    const total = list.length
    let pageNum = 1
    return list.map(p => ({
      ...p,
      pageNum: pageNum++,
      total,
    }))
  }, [categoryByName, categoryOrder, grouped, perPage])

  const pageRefs = useMemo(() => pageMeta.map(() => createRef()), [pageMeta])
  const pages = useMemo(
    () => pageMeta.map((meta, i) => ({ ...meta, ref: pageRefs[i] })),
    [pageMeta, pageRefs]
  )

  if (loading) {
    return <div style={{ padding: 40, fontFamily: "Geist, sans-serif" }}>Cargando catálogo…</div>
  }

  if (error || !catalog) {
    return (
      <div style={{ padding: 40, fontFamily: "Geist, sans-serif" }}>
        <p>{error || "No existe un catálogo activo."}</p>
        <button onClick={reload}>Reintentar</button>
      </div>
    )
  }

  let ri = 0

  return (
    <TooltipProvider>
      {/* Fixed chrome — hidden on print */}
      <Topbar
        catalog={catalog}
        totalProducts={visibleProducts.length}
        totalPages={pages.length}
        hiddenProducts={products.length - visibleProducts.length}
        hiddenProductsList={hiddenProductsList}
      />
      <PageNavigator pages={pages} />
      <Sidebar />

      {/* Scrollable catalog area: offset for topbar + left nav + right sidebar */}
      <div
        id="catalog-area"
        style={{ marginTop: 44, marginLeft: 220, marginRight: 220 }}
      >
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
        </div>
      </div>
    </TooltipProvider>
  )
}
