import styles from "./CategoryDivider.module.css"
import { useCatalog } from "../context/CatalogContext"

export default function CategoryDivider({ category }) {
  const { categories } = useCatalog()
  const config = categories.find(item => item.display_name === category)
  const mainImage = config?.coverImage
  const fallbackImage = config?.coverImageFallback

  return (
    <div
      className={styles.page}
      style={{
        "--category-bg": config?.background_color ?? "#1b4f72",
        "--category-accent": config?.accent_color ?? "#2e86ab",
      }}
    >
      <div className={styles.header}>
        <div className={styles.headerInner}>
          <h1 className={styles.title}>{category}</h1>
        </div>
      </div>

      <div className={styles.imageArea} aria-hidden="true">
        <div className={styles.placeholder}>
          <span>Imagen principal</span>
          <small>{mainImage ?? "Sin ruta configurada"}</small>
        </div>
        {mainImage && (
          <img
            src={mainImage}
            data-thumb-src={config?.coverThumb || mainImage}
            data-fallback-src={fallbackImage || undefined}
            alt=""
            onError={(event) => {
              const fallback = event.currentTarget.dataset.fallbackSrc
              if (fallback && event.currentTarget.src !== fallback) {
                event.currentTarget.src = fallback
              } else {
                event.currentTarget.style.display = "none"
              }
            }}
          />
        )}
      </div>
    </div>
  )
}
