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
          alt={catalog.name}
        />
      )}
    </div>
  )
}
