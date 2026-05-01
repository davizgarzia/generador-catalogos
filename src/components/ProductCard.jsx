import { useState } from "react"
import styles from "./ProductCard.module.css"
import { useEdit } from "../context/EditContext"
import { useOverrides } from "../context/OverridesContext"

export default function ProductCard({ product: rawProduct, accentColor }) {
  const { setEditingProduct }        = useEdit()
  const { applyOverride }            = useOverrides()
  const product                      = applyOverride(rawProduct)

  const [imgError, setImgError] = useState(false)
  const [imgKey, setImgKey]     = useState(() => Date.now())
  const [mode, setMode]         = useState("nobg")

  function getImgSrc() {
    if (!rawProduct.image) return null
    const ext = rawProduct.image.match(/\.(jpe?g)$/i)?.[1] ?? "jpg"
    if (mode === "nobg") return `/images-nobg/${rawProduct.id}.png?v=${imgKey}`
    return `/images/${rawProduct.id}.${ext}?v=${imgKey}`
  }

  function handleImgError() {
    if (mode === "nobg") setMode("multiply")
    else setImgError(true)
  }

  const imgSrc  = getImgSrc()
  const isBlend = mode === "multiply"

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
            className={isBlend ? undefined : styles.noBlend}
            style={imgStyle}
            onError={handleImgError}
          />
        ) : (
          <div className={styles.noImg}>SIN<br />IMAGEN</div>
        )}

        {rawProduct.id && (
          <span className={styles.refBadge} style={{ background: accentColor }}>
            Ref: {rawProduct.id}
          </span>
        )}

        {product.unitsLabel && (
          <span className={styles.unitsBadge}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
            {product.unitsLabel.replace(/\/Caja$/i, "").trim()}
          </span>
        )}

        {/* Overlay editar — solo en pantalla */}
        <div
          className={styles.overlay}
          onClick={() => setEditingProduct({ ...rawProduct, _refreshImg: (key) => { setImgKey(key); setImgError(false) } })}
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
        <div className={styles.name}>{product.name}</div>
      </div>
    </div>
  )
}
