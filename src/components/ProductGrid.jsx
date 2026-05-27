import ProductCard from "./ProductCard"
import { CATEGORY_CONFIG } from "../config/categories"
import styles from "./ProductGrid.module.css"
import PageWrapper from "./PageWrapper"

export default function ProductGrid({ products, category, perPage = 12, pageRefs = [], pageMeta = [] }) {
  const config = CATEGORY_CONFIG[category] ?? { accent: "#4A6CF7", bg: "#1F2937", icon: "📦", subtitle: "" }

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
          accentColor={config.accent}
          bgColor={config.bg}
        >
          <div className={styles.page}>
            {/* Header de categoría */}
            <div className={styles.header} style={{ background: config.bg }}>
              <span className={styles.headerIcon}>{config.icon}</span>
              <div className={styles.headerText}>
                <span className={styles.headerTitle}>{category}</span>
                {config.subtitle && (
                  <span className={styles.headerSubtitle}>{config.subtitle}</span>
                )}
              </div>
              <div className={styles.headerAccent} style={{ background: config.accent }} />
            </div>

            <div className={styles.grid}>
              {pageProducts.map((product) => (
                <ProductCard
                  key={product.id || product.name}
                  product={product}
                  accentColor={config.accent}
                />
              ))}
            </div>

            {/* Footer de paginación — mismo estilo que el header */}
            {pageMeta[pageIndex]?.pageNum != null && (
              <div className={styles.footer} style={{ background: config.bg }}>
                <div className={styles.footerAccentLeft} style={{ background: config.accent }} />
                <span className={styles.footerPage}>{pageMeta[pageIndex].pageNum}</span>
                <div className={styles.footerAccentRight} style={{ background: config.accent }} />
              </div>
            )}
          </div>
        </PageWrapper>
      ))}
    </>
  )
}
