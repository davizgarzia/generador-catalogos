import ProductCard from "./ProductCard"
import { CATEGORY_CONFIG } from "../config/categories"
import styles from "./ProductGrid.module.css"
import PageWrapper from "./PageWrapper"
import { paginateBalanced } from "../lib/pagination"

export default function ProductGrid({ products, category, perPage = 9, pageRefs = [], pageMeta = [] }) {
  const config = CATEGORY_CONFIG[category] ?? { accent: "#4A6CF7", bg: "#1F2937", icon: "📦", subtitle: "" }
  const pages = paginateBalanced(products, perPage)

  function gridPositions(count) {
    const rowsByCount = {
      1: [1],
      2: [2],
      3: [3],
      4: [2, 2],
      5: [2, 3],
      6: [3, 3],
      7: [2, 3, 2],
      8: [3, 2, 3],
      9: [3, 3, 3],
    }
    const rows = rowsByCount[count] ?? [3, 3, 3]

    return rows.flatMap((rowSize, rowIndex) => {
      const startsBySize = {
        1: [3],
        2: [2, 4],
        3: [1, 3, 5],
      }
      return startsBySize[rowSize].map(columnStart => ({
        gridColumn: `${columnStart} / span 2`,
        gridRow: rowIndex + 1,
      }))
    })
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
          {(() => {
            const positions = gridPositions(pageProducts.length)
            return (
          <div className={styles.page}>
            {/* Header de categoría */}
            <div className={styles.header} style={{ background: config.bg }}>
              <span className={styles.headerIcon}>{config.icon}</span>
              <div className={styles.headerText}>
                <span className={styles.headerTitle}>{category}</span>
              </div>
              <div className={styles.headerAccent} style={{ background: config.accent }} />
            </div>

            <div className={styles.grid}>
              {pageProducts.map((product, productIndex) => (
                <div
                  key={product.id || product.name}
                  className={styles.slot}
                  style={positions[productIndex]}
                >
                  <ProductCard
                    product={product}
                    accentColor={config.accent}
                  />
                </div>
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
            )
          })()}
        </PageWrapper>
      ))}
    </>
  )
}
