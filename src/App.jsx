import { useMemo, createRef, useEffect } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { usePrint } from "./context/PrintContext"
import products from "./data/products"
import { CATEGORY_ORDER, CATEGORY_CONFIG } from "./config/categories"
import Cover from "./components/Cover"
import InfoPage from "./components/InfoPage"
import CategoryDivider from "./components/CategoryDivider"
import ProductGrid from "./components/ProductGrid"
import Topbar from "./components/Topbar"
import Sidebar from "./components/Sidebar"
import PageWrapper from "./components/PageWrapper"
import PageNavigator from "./components/PageNavigator"

const PER_PAGE = 9

export default function App() {
  const { printMode } = usePrint()

  // Inyectar @page dinámicamente según modo:
  // - con marcas: A4 (el .sheet A4 envuelve el .inner 154×216mm con sangre)
  // - sin marcas: A5 (el .innerNormal 148×210mm es la página directamente)
  useEffect(() => {
    let el = document.getElementById("dynamic-page-style")
    if (!el) {
      el = document.createElement("style")
      el.id = "dynamic-page-style"
      document.head.appendChild(el)
    }
    if (printMode) {
      el.textContent = `@page { size: 210mm 297mm; margin: 0; }`
      document.body.classList.remove("mode-normal")
      document.body.classList.add("mode-print")
    } else {
      el.textContent = `@page { size: 148mm 210mm; margin: 0; }`
      document.body.classList.remove("mode-print")
      document.body.classList.add("mode-normal")
    }
  }, [printMode])
  const grouped = useMemo(() => {
    const map = {}
    for (const product of products) {
      if (!map[product.category]) map[product.category] = []
      map[product.category].push(product)
    }
    return map
  }, [])

  const pageMeta = useMemo(() => {
    const list = []
    list.push({ label: "Portada",     color: "#1b3da6", icon: "📘", paginated: false })
    list.push({ label: "Información", color: null,                   paginated: true  })
    for (const category of CATEGORY_ORDER) {
      const cat = grouped[category]
      if (!cat?.length) continue
      const cfg = CATEGORY_CONFIG[category]
      list.push({ label: category, color: cfg.bg, icon: cfg.icon, paginated: false })
      const n = Math.ceil(cat.length / PER_PAGE)
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
  }, [grouped])

  const pageRefs = useMemo(() => pageMeta.map(() => createRef()), [pageMeta])
  const pages = useMemo(
    () => pageMeta.map((meta, i) => ({ ...meta, ref: pageRefs[i] })),
    [pageMeta, pageRefs]
  )

  let ri = 0

  return (
    <TooltipProvider>
      {/* Fixed chrome — hidden on print */}
      <Topbar totalProducts={products.length} totalPages={pages.length} />
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

          {CATEGORY_ORDER.map((category) => {
            const categoryProducts = grouped[category]
            if (!categoryProducts?.length) return null
            const numPages = Math.ceil(categoryProducts.length / PER_PAGE)
            const dividerRef = pageRefs[ri++]
            const gridRefs = pageRefs.slice(ri, ri + numPages)
            const gridMeta = pageMeta.slice(ri, ri + numPages)
            ri += numPages

            return (
              <section key={category}>
                <PageWrapper ref={dividerRef}>
                  <CategoryDivider
                    category={category}
                    productCount={categoryProducts.length}
                  />
                </PageWrapper>
                <ProductGrid
                  products={categoryProducts}
                  category={category}
                  perPage={PER_PAGE}
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
