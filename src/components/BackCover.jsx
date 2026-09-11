import { useCatalog } from "../context/CatalogContext"
import styles from "./BackCover.module.css"

export default function BackCover() {
  const { catalog } = useCatalog()
  const logo = catalog.logoWhite || catalog.logo

  const contactLines = [
    [
      catalog.phone && `Tel. ${catalog.phone}`,
      catalog.whatsapp && `WhatsApp ${catalog.whatsapp}`,
    ].filter(Boolean).join("  ·  "),
    [catalog.email, catalog.website].filter(Boolean).join("  ·  "),
    catalog.business_hours,
  ].filter(Boolean)

  return (
    <div className={styles.page}>
      {logo && (
        <img
          className={styles.logo}
          src={logo}
          data-fallback-src={catalog.logoWhiteFallback || catalog.logoFallback || undefined}
          alt={catalog.name}
          onError={(event) => {
            const fallback = event.currentTarget.dataset.fallbackSrc
            if (fallback && event.currentTarget.src !== fallback) {
              event.currentTarget.src = fallback
            }
          }}
        />
      )}

      {contactLines.length > 0 && (
        <div className={styles.contact}>
          <div className={styles.contactName}>{catalog.name}</div>
          {contactLines.map((line, index) => (
            <div key={index} className={styles.contactLine}>{line}</div>
          ))}
        </div>
      )}
    </div>
  )
}
