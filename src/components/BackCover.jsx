import { useCatalog } from "../context/CatalogContext"
import { useEdit } from "../context/EditContext"
import styles from "./BackCover.module.css"

// Contraportada: imagen propia a página completa si el catálogo la tiene;
// si no, la versión corporativa generada (logo + datos de contacto).
export default function BackCover() {
  const { catalog, company } = useCatalog()
  const { setEditingPage } = useEdit()
  const logo = catalog.logoWhite || catalog.logo

  const pageProps = {
    className: styles.page,
    title: "Editar contraportada",
    style: { cursor: "pointer" },
    onClick: () => setEditingPage({ kind: "backcover" }),
  }

  if (catalog.backCoverImage) {
    return (
      <div {...pageProps}>
        <img className={styles.customImage} src={catalog.backCoverImage} alt="" loading="lazy" decoding="async" />
      </div>
    )
  }

  const contactLines = [
    [
      company.phone && `Tel. ${company.phone}`,
      company.whatsapp && `WhatsApp ${company.whatsapp}`,
    ].filter(Boolean).join("  ·  "),
    [company.email, company.website].filter(Boolean).join("  ·  "),
    company.business_hours,
  ].filter(Boolean)

  return (
    <div {...pageProps}>
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
