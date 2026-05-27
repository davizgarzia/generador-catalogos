import { CATEGORY_CONFIG } from "../config/categories"
import styles from "./CategoryDivider.module.css"

export default function CategoryDivider({ category, productCount }) {
  const config = CATEGORY_CONFIG[category] ?? {
    bg: "#1b4f72",
    accent: "#2e86ab",
    subtitle: "",
  }

  return (
    <div className={styles.page} style={{ background: config.bg }}>
      <div className={styles.bgText} style={{ color: config.accent }}>
        {category}
      </div>
      <div className={styles.content}>
        <h1 className={styles.title}>{category}</h1>
        <p className={styles.subtitle} style={{ color: config.accent }}>
          {config.subtitle}
        </p>
        <div className={styles.line} style={{ background: config.accent }} />
        <p className={styles.count}>{productCount} productos</p>
      </div>
    </div>
  )
}
