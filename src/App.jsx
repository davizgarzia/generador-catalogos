import { useMemo, createRef } from "react"
import { usePrint } from "./context/PrintContext"
import products from "./data/products"
import { CATEGORY_ORDER, CATEGORY_CONFIG } from "./config/categories"
import Cover from "./components/Cover"
import InfoPage from "./components/InfoPage"
import CategoryDivider from "./components/CategoryDivider"
import ProductGrid from "./components/ProductGrid"
import Sidebar from "./components/Sidebar"
import PageWrapper from "./components/PageWrapper"
import PageNavigator from "./components/PageNavigator"

const PER_PAGE = 9

export default function App() {
  const { printMode } = usePrint()
  const grouped = useMemo(() => {
    const map = {}
    for (const product of products) {
      if (!map[product.category]) map[product.category] = []
      map[product.category].push(product)
    }
    return map
  }, [])

  // Construir metadatos de páginas
  // paginated: true → recibe número de página
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

    // Asignar número de página a todas, mostrar solo en las paginadas
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
    <>
      <PageNavigator pages={pages} />
      <Sidebar totalProducts={products.length} totalPages={pages.length} />
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
    </>
  )
}
