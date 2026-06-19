import styles from "./Cover.module.css"
import { useCatalog } from "../context/CatalogContext"

export default function Cover() {
  const { catalog } = useCatalog()
  return (
    <div className={styles.page}>
      {catalog.coverImage && (
        <img className={styles.coverImage} src={catalog.coverImage} alt={`Catálogo ${catalog.name}`} />
      )}
    </div>
  )
}
