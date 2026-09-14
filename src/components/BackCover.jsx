import { useCatalog } from "../context/CatalogContext"
import styles from "./BackCover.module.css"

export default function BackCover() {
  const { catalog, company } = useCatalog()
  const logo = catalog.logoWhite || catalog.logo

  const contactLines = [
    [
      company.phone && `Tel. ${company.phone}`,
      company.whatsapp && `WhatsApp ${company.whatsapp}`,
    ].filter(Boolean).join("  ·  "),
    [company.email, company.website].filter(Boolean).join("  ·  "),
    company.business_hours,
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
          <div className={styles.contactName}>{company.name ?? catalog.name}</div>
          {contactLines.map((line, index) => (
            <div key={index} className={styles.contactLine}>{line}</div>
          ))}
        </div>
      )}
    </div>
  )
}
