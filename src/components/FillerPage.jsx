import { useMemo } from "react"
import { useCatalog } from "../context/CatalogContext"
import PageEditOverlay from "./PageEditOverlay"
import styles from "./FillerPage.module.css"

// Barajado determinista: la misma semilla produce siempre el mismo orden,
// así la hoja no cambia entre re-renders ni entre la vista y el PDF.
function seededShuffle(items, seed) {
  const result = [...items]
  let state = seed
  for (let i = result.length - 1; i > 0; i--) {
    state = (state * 9301 + 49297) % 233280
    const j = Math.floor((state / 233280) * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Hoja automática de relleno de la versión impresa (su cantidad la decide la
// paginación para llegar a un múltiplo de 4). Con imagen propia se pinta a
// página completa; sin ella, fallback de marca: cabecera corporativa y una
// portada de categoría estable por hoja. `slotIndex` identifica su descriptor
// en filler_images.
export default function FillerPage({ image = null, slotIndex = 0, seedIndex = 0 }) {
  const { catalog, categories, company } = useCatalog()
  const logo = catalog.logo || catalog.logoWhite

  const fallbackImage = useMemo(() => {
    const covers = categories.map(category => category.coverImage).filter(Boolean)
    if (!covers.length) return catalog.coverImageFallback
    const seed = (catalog.slug?.length ?? 0) * 131 + 7919
    const shuffled = seededShuffle(covers, seed)
    return shuffled[seedIndex % shuffled.length]
  }, [categories, seedIndex, catalog.slug, catalog.coverImageFallback])

  const contactLines = [
    [
      company.phone && `Tel. ${company.phone}`,
      company.whatsapp && `WhatsApp ${company.whatsapp}`,
    ].filter(Boolean).join("  ·  "),
    [company.email, company.website].filter(Boolean).join("  ·  "),
  ].filter(Boolean)

  return (
    <div className={styles.page}>
      {image ? (
        <img key={image} className={styles.customImage} src={image} alt="" loading="lazy" decoding="async" />
      ) : (
        <>
          {fallbackImage && (
            <img className={styles.image} src={fallbackImage} alt="" loading="lazy" decoding="async" />
          )}

          <div className={styles.header}>
            {logo && <img className={styles.logo} src={logo} alt={company.name ?? ""} />}
            {company.name && <div className={styles.name}>{company.name}</div>}
            {contactLines.map((line, lineIndex) => (
              <div key={lineIndex} className={styles.line}>{line}</div>
            ))}
          </div>
        </>
      )}

      <PageEditOverlay kind="filler" index={slotIndex} />
    </div>
  )
}
