import { useCatalog } from "../context/CatalogContext"
import styles from "./FillerPage.module.css"

// Hoja de imagen corporativa usada para completar la versión impresa
// hasta un número de páginas múltiplo de 4.
export default function FillerPage({ index = 0 }) {
  const { catalog } = useCatalog()
  const fillers = catalog.fillerImages ?? []
  const filler = fillers[index] ?? fillers[fillers.length - 1]
  const image = filler?.image ?? catalog.coverImage
  const fallback = filler?.fallback ?? catalog.coverImageFallback
  const logo = catalog.logoWhite || catalog.logo

  return (
    <div className={styles.page}>
      {image ? (
        <img
          className={styles.image}
          src={image}
          data-fallback-src={fallback || undefined}
          alt=""
          onError={event => {
            const fallbackSrc = event.currentTarget.dataset.fallbackSrc
            if (fallbackSrc && event.currentTarget.src !== fallbackSrc) {
              event.currentTarget.src = fallbackSrc
            } else {
              event.currentTarget.style.display = "none"
            }
          }}
        />
      ) : (
        logo && <img className={styles.logo} src={logo} alt={catalog.name} />
      )}
    </div>
  )
}
