import styles from "./Cover.module.css"

export default function Cover() {
  return (
    <div className={styles.page}>
      <img className={styles.coverImage} src="/portada.png" alt="Catálogo de productos" />
    </div>
  )
}
