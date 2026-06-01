import { CATEGORY_CONFIG } from "../config/categories"
import styles from "./CategoryDivider.module.css"

export default function CategoryDivider({ category }) {
  const config = CATEGORY_CONFIG[category] ?? {
    bg: "#1b4f72",
    accent: "#2e86ab",
    subtitle: "",
    coverImages: [],
  }
  const coverImages = config.coverImages?.slice(0, 3) ?? []
  const mainImage = coverImages[0]

  return (
    <div
      className={styles.page}
      style={{
        "--category-bg": config.bg,
        "--category-accent": config.accent,
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
            alt=""
            onError={(event) => {
              event.currentTarget.style.display = "none"
            }}
          />
        )}
      </div>
    </div>
  )
}
