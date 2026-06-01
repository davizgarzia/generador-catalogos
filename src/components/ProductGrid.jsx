import ProductCard from "./ProductCard"
import { CATEGORY_CONFIG } from "../config/categories"
import styles from "./ProductGrid.module.css"
import PageWrapper from "./PageWrapper"
import { paginateBalanced } from "../lib/pagination"

export default function ProductGrid({ products, category, perPage = 16, pageRefs = [], pageMeta = [] }) {
  const config = CATEGORY_CONFIG[category] ?? { accent: "#4A6CF7", bg: "#1F2937", icon: "📦", subtitle: "" }
  const pages = paginateBalanced(products, perPage)

  function gridPositions(count) {
    if (perPage === 16 && count === 4) {
      return [
        { gridColumn: 1, gridRow: 1 },
        { gridColumn: 2, gridRow: 1 },
        { gridColumn: 1, gridRow: 2 },
        { gridColumn: 2, gridRow: 2 },
      ]
    }

    const layouts = {
      9: {
        columns: 6,
        rowsByCount: {
          1: [1],
          2: [2],
          3: [3],
          4: [2, 2],
          5: [2, 3],
          6: [3, 3],
          7: [2, 3, 2],
          8: [3, 2, 3],
          9: [3, 3, 3],
        },
        startsBySize: {
          1: [3],
          2: [2, 4],
          3: [1, 3, 5],
        },
        span: 2,
      },
      12: {
        columns: 8,
        rowsByCount: {
          1: [1],
          2: [2],
          3: [3],
          4: [2, 2],
          5: [2, 3],
          6: [3, 3],
          7: [3, 4],
          8: [4, 4],
          9: [3, 3, 3],
          10: [3, 4, 3],
          11: [4, 3, 4],
          12: [4, 4, 4],
        },
        startsBySize: {
          1: [4],
          2: [3, 5],
          3: [2, 4, 6],
          4: [1, 3, 5, 7],
        },
        span: 2,
      },
      16: {
        columns: 8,
        rowsByCount: {
          1: [1],
          2: [2],
          3: [3],
          4: [2, 2],
          5: [2, 3],
          6: [3, 3],
          7: [3, 4],
          8: [4, 4],
          9: [3, 3, 3],
          10: [3, 4, 3],
          11: [4, 3, 4],
          12: [4, 4, 4],
          13: [3, 4, 3, 3],
          14: [3, 4, 4, 3],
          15: [4, 4, 3, 4],
          16: [4, 4, 4, 4],
        },
        startsBySize: {
          1: [4],
          2: [3, 5],
          3: [2, 4, 6],
          4: [1, 3, 5, 7],
        },
        span: 2,
      },
    }
    const layout = layouts[perPage] ?? layouts[16]
    const rows = layout.rowsByCount[count] ?? layout.rowsByCount[perPage]
    const totalRows = perPage === 16 ? 4 : 3
    const rowOffset = Math.floor((totalRows - rows.length) / 2)

    return rows.flatMap((rowSize, rowIndex) =>
      layout.startsBySize[rowSize].map(columnStart => ({
        gridColumn: `${columnStart} / span ${layout.span}`,
        gridRow: rowOffset + rowIndex + 1,
      }))
    )
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
            <div className={styles.header} style={{ background: config.bg, "--header-bg": config.bg }}>
              {config.coverImages?.[0] && (
                <img
                  className={styles.headerCover}
                  src={config.coverImages[0]}
                  alt=""
                  aria-hidden="true"
                />
              )}
              <span className={styles.headerIcon}>{config.icon}</span>
              <div className={styles.headerText}>
                <span className={styles.headerTitle}>{category}</span>
              </div>
              <div className={styles.headerAccent} style={{ background: config.accent }} />
            </div>

            <div className={`${styles.grid} ${perPage === 9 ? styles.grid3 : perPage === 12 ? styles.grid4x3 : pageProducts.length === 4 ? styles.grid4Compact : styles.grid4}`}>
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
                <div className={styles.footerSide}>
                  <span className={styles.footerBrand}>
                    <img
                      className={styles.footerLogo}
                      src="/logo-white.png"
                      alt="IMPORMED"
                    />
                    <span className={styles.footerDivider} />
                    <span>CATÁLOGO DE PRODUCTOS</span>
                  </span>
                </div>
                <div className={styles.footerSide}>
                  <span className={styles.footerPage}>{pageMeta[pageIndex].pageNum}</span>
                </div>
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
