import { useMemo } from "react"
import { useCatalog } from "../context/CatalogContext"
import PageImageControl from "./PageImageControl"
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

// Hoja de imagen usada para completar la versión impresa hasta un número de
// páginas múltiplo de 4. Si el catálogo tiene una imagen propia para esta hoja
// se pinta a página completa; si no, fallback de marca: cabecera corporativa
// (logo + datos de la empresa) y una portada de categoría estable por hoja.
export default function FillerPage({ index = 0 }) {
  const { catalog, categories, company } = useCatalog()
  const logo = catalog.logo || catalog.logoWhite
  const customImage = catalog.fillerImages?.[index] ?? null

  const fallbackImage = useMemo(() => {
    const covers = categories.map(category => category.coverImage).filter(Boolean)
    if (!covers.length) return catalog.coverImage
    const seed = (catalog.slug?.length ?? 0) * 131 + 7919
    const shuffled = seededShuffle(covers, seed)
    return shuffled[index % shuffled.length]
  }, [categories, index, catalog.slug, catalog.coverImage])

  const contactLines = [
    [
      company.phone && `Tel. ${company.phone}`,
      company.whatsapp && `WhatsApp ${company.whatsapp}`,
    ].filter(Boolean).join("  ·  "),
    [company.email, company.website].filter(Boolean).join("  ·  "),
  ].filter(Boolean)

  return (
    <div className={styles.page}>
      {customImage ? (
        <img className={styles.customImage} src={customImage} alt="" loading="lazy" decoding="async" />
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

      <PageImageControl kind="filler" index={index} currentPath={catalog.fillerImagePaths?.[index] ?? null} />
    </div>
  )
}
