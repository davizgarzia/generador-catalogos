import { useState, useEffect } from "react"
import styles from "./ProductCard.module.css"
import { useEdit } from "../context/EditContext"
import { useOverrides } from "../context/OverridesContext"

export default function ProductCard({ product: rawProduct, accentColor }) {
  const { setEditingProduct }        = useEdit()
  const { applyOverride }            = useOverrides()
  const product                      = applyOverride(rawProduct)

  const [imgError, setImgError]       = useState(false)
  const [nobgFailed, setNobgFailed]   = useState(false)
  // imgMode viene del override:
  //   "original" → imagen tal cual, sin multiply (fondo no blanco detectado o sin detectar)
  //   "blend"    → mix-blend-mode multiply (fondo blanco detectado automáticamente)
  //   "nobg"     → PNG sin fondo procesado con rembg, sin multiply
  const mode = product.imgMode ?? "original"
  // nobgVersion se guarda en el override al procesar — sirve de cache-buster
  const nobgVersion = product.nobgVersion ?? 0

  // Reset de errores cuando cambia el producto, modo, o versión nobg
  useEffect(() => { setImgError(false); setNobgFailed(false) }, [rawProduct.id, mode, nobgVersion])

  function getImgSrc() {
    if (!rawProduct.image) return null
    if (mode === "nobg" && !nobgFailed) return `/images-nobg/${rawProduct.id}.png?v=${nobgVersion}`
    return rawProduct.image
  }

  function handleImgError() {
    if (mode === "nobg" && !nobgFailed) {
      // nobg no existe → caer a original
      setNobgFailed(true)
    } else {
      setImgError(true)
    }
  }

  const imgSrc  = getImgSrc()
  const isBlend = mode === "blend"  // multiply solo si fondo blanco detectado

  // Transform de posición y escala desde overrides
  const imgStyle = {
    transform: `translate(${product.imgX ?? 0}%, ${product.imgY ?? 0}%) scale(${product.imgScale ?? 1})`,
    transformOrigin: "center center",
  }

  return (
    <div className={styles.card}>
      <div className={styles.imgWrap}>
        {!product.imgHidden && imgSrc && !imgError ? (
          <img
            src={imgSrc}
            alt={product.name}
            className={isBlend ? styles.blend : undefined}
            style={imgStyle}
            onError={handleImgError}
          />
        ) : (
          <div className={styles.noImg}>SIN<br />IMAGEN</div>
        )}

        {/* Overlay editar — solo en pantalla */}
        <div
          className={styles.overlay}
          onClick={() => setEditingProduct(rawProduct)}
        >
          <div className={styles.editHint}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Editar
          </div>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.meta}>
          {rawProduct.id && (
            <span className={styles.ref} style={{ color: accentColor }}>Ref: {rawProduct.id}</span>
          )}
          {rawProduct.id && product.unitsLabel && (
            <span className={styles.sep}>·</span>
          )}
          {product.unitsLabel && (
            <span className={styles.units}>{product.unitsLabel}</span>
          )}
        </div>
        <div className={styles.name}>{product.name}</div>
      </div>
    </div>
  )
}
