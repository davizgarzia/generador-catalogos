import styles from "./Cover.module.css"
import { useCatalog } from "../context/CatalogContext"
import { useEdit } from "../context/EditContext"

export default function Cover() {
  const { catalog } = useCatalog()
  const { setEditingPage } = useEdit()
  return (
    <div
      className={styles.page}
      title="Editar portada"
      style={{ cursor: "pointer" }}
      onClick={() => setEditingPage({ kind: "cover" })}
    >
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
