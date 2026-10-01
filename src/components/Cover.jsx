import styles from "./Cover.module.css"
import { useCatalog } from "../context/CatalogContext"
import PageEditOverlay from "./PageEditOverlay"

export default function Cover() {
  const { catalog } = useCatalog()
  return (
    <div className={styles.page}>
      {catalog.coverImage && (
        <img
          key={catalog.coverImage}
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

      <PageEditOverlay kind="cover" />
    </div>
  )
}
