import styles from "./Cover.module.css"
import { useCatalog } from "../context/CatalogContext"

export default function Cover() {
  const { catalog } = useCatalog()
  return (
    <div className={styles.page}>
      {catalog.coverImage && (
        <img
          className={styles.coverImage}
          src={catalog.coverImage}
          data-fallback-src={catalog.coverImageFallback || undefined}
          alt={`Catálogo ${catalog.name}`}
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
