import ProductCard from "./ProductCard"
import { CATEGORY_CONFIG } from "../config/categories"
import styles from "./ProductGrid.module.css"
import PageWrapper from "./PageWrapper"

export default function ProductGrid({ products, category, perPage = 12, pageRefs = [], pageMeta = [] }) {
  const config = CATEGORY_CONFIG[category] ?? { accent: "#4A6CF7" }

  const pages = []
  for (let i = 0; i < products.length; i += perPage) {
    pages.push(products.slice(i, i + perPage))
  }

  return (
    <>
      {pages.map((pageProducts, pageIndex) => (
        <PageWrapper
          key={pageIndex}
          ref={pageRefs[pageIndex]}
          page={pageMeta[pageIndex]?.pageNum}
          total={pageMeta[pageIndex]?.total}
        >
          <div className={styles.page}>
            <div className={styles.grid}>
              {pageProducts.map((product) => (
                <ProductCard
                  key={product.id || product.name}
                  product={product}
                  accentColor={config.accent}
                />
              ))}
            </div>
          </div>
        </PageWrapper>
      ))}
    </>
  )
}
