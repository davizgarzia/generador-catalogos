import { useState } from "react"
import styles from "./ProductCard.module.css"

const API = "http://localhost:3001/api"

// Modos de imagen:
//   "multiply"  — JPG original con mix-blend-mode: multiply (default)
//   "nobg"      — PNG sin fondo procesado con rembg
//   "original"  — JPG original sin ningún blend

export default function ProductCard({ product, accentColor }) {
  const [imgError, setImgError] = useState(false)
  const [status, setStatus] = useState(null) // null | "loading" | "ok" | "error"
  const [imgKey, setImgKey] = useState(0)
  const [mode, setMode] = useState("multiply")

  async function handleRemoveBg() {
    setStatus("loading")
    try {
      const res = await fetch(`${API}/remove-bg/${product.id}`, { method: "POST" })
      const data = await res.json()
      if (data.ok) {
        setStatus("ok")
        setImgError(false)
        setMode("nobg")
        setTimeout(() => { setImgKey(k => k + 1); setStatus(null) }, 800)
      } else {
        setStatus("error")
        setTimeout(() => setStatus(null), 2000)
      }
    } catch {
      setStatus("error")
      setTimeout(() => setStatus(null), 2000)
    }
  }

  function getImgSrc() {
    if (!product.image) return null
    const ext = product.image.match(/\.(jpe?g)$/i)?.[1] ?? "jpg"
    if (mode === "nobg") return `/images-nobg/${product.id}.png?v=${imgKey}`
    return `/images/${product.id}.${ext}?v=${imgKey}`
  }

  const imgSrc = getImgSrc()
  const isBlend = mode === "multiply"

  return (
    <div className={styles.card}>
        <div className={styles.imgWrap}>
        {imgSrc && !imgError ? (
          <img
            src={imgSrc}
            alt={product.name}
            className={isBlend ? undefined : styles.noBlend}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={styles.noImg}>SIN<br />IMAGEN</div>
        )}

        {product.id && (
          <span className={styles.refBadge} style={{ background: accentColor }}>
            Ref: {product.id}
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

        {/* Overlay — solo en pantalla */}
        <div className={styles.overlay}>
          {status === "loading" && (
            <div className={styles.overlayStatus}>⏳ Procesando...</div>
          )}
          {status === "ok" && (
            <div className={`${styles.overlayStatus} ${styles.ok}`}>✓ Listo</div>
          )}
          {status === "error" && (
            <div className={`${styles.overlayStatus} ${styles.error}`}>✗ Error</div>
          )}
          {!status && product.image && (
            <div className={styles.overlayActions}>
              {mode !== "multiply" && (
                <button className={styles.actionBtn} onClick={() => { setMode("multiply"); setImgError(false) }}>
                  ◈ Blend
                </button>
              )}
              {mode !== "nobg" && (
                <button className={styles.actionBtn} onClick={handleRemoveBg}>
                  ✦ Quitar fondo
                </button>
              )}
              {mode !== "original" && (
                <button className={styles.actionBtn} onClick={() => { setMode("original"); setImgError(false) }}>
                  ↩ Original
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.name}>{product.name}</div>
      </div>
    </div>
  )
}
