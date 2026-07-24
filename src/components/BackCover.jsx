import { useCatalog } from "../context/CatalogContext"
import styles from "./BackCover.module.css"

export default function BackCover() {
  const { catalog } = useCatalog()
  const logo = catalog.logoWhite || catalog.logo

  return (
    <div className={styles.page}>
      {logo && (
        <img
          className={styles.logo}
          src={logo}
          data-thumb-src={logo}
          data-fallback-src={catalog.logoWhiteFallback || catalog.logoFallback || undefined}
          alt={catalog.name}
          onError={(event) => {
            const fallback = event.currentTarget.dataset.fallbackSrc
            if (fallback && event.currentTarget.src !== fallback) {
              event.currentTarget.src = fallback
            }
          }}
        />
      )}
    </div>
  )
}
