import { COMPANY } from "../config/categories"
import styles from "./Cover.module.css"

export default function Cover() {
  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.logo}>
          IMP<span>O</span>RMED
        </div>
        <div className={styles.tagline}>{COMPANY.tagline.toUpperCase()}</div>
        <div className={styles.divider} />
        <div className={styles.title}>CATÁLOGO DE BEBIDAS</div>
        <div className={styles.categories}>Alcohol · Refrescos · Zumos · Cervezas</div>
      </div>
      <div className={styles.footer}>
        <div className={styles.footerLeft}>
          {COMPANY.phone && <span>{COMPANY.phone}</span>}
          {COMPANY.web && <span>{COMPANY.web}</span>}
        </div>
        <div className={styles.year}>2025</div>
      </div>
    </div>
  )
}
