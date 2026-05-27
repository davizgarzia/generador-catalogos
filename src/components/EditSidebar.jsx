import { useRef, useState, useEffect } from "react"
import { useEdit } from "../context/EditContext"
import { useOverrides } from "../context/OverridesContext"

const API = "http://localhost:3001/api"

function Label({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 5 }}>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        fontSize: 12, color: "#111827", fontWeight: 500,
        border: "1px solid #e5e7eb", borderRadius: 6,
        padding: "5px 8px", outline: "none", width: "100%",
        background: "#fff",
      }}
    />
  )
}

// Extrae el número de "N uds./caja" o devuelve "" si no hay
function parseUnitsNum(label) {
  if (!label) return ""
  const m = label.match(/^(\d+)\s*uds\.\/caja$/i)
  return m ? m[1] : ""
}

function UnitsInput({ value, onChange }) {
  const num = parseUnitsNum(value)
  function handleChange(e) {
    const raw = e.target.value.replace(/\D/g, "") // solo dígitos
    if (raw === "") {
      onChange(null)
    } else {
      onChange(`${raw} uds./caja`)
    }
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input
        type="number"
        min="1"
        value={num}
        onChange={handleChange}
        placeholder="—"
        style={{
          fontSize: 12, color: "#111827", fontWeight: 500,
          border: "1px solid #e5e7eb", borderRadius: 6,
          padding: "5px 8px", outline: "none", width: 64,
          background: "#fff", appearance: "textfield", MozAppearance: "textfield",
        }}
      />
      <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>uds./caja</span>
    </div>
  )
}

function SliderRow({ label, value, min, max, step = 1, unit = "", onChange, onReset }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#111827", minWidth: 32, textAlign: "right" }}>
            {value}{unit}
          </span>
          <button
            onClick={onReset}
            title="Resetear"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#9ca3af", fontSize: 11, padding: "0 2px", lineHeight: 1,
            }}
          >↺</button>
        </div>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#111827" }}
      />
    </div>
  )
}

export default function EditSidebar() {
  const { editingProduct, setEditingProduct } = useEdit()
  const { overrides, patchOverride }          = useOverrides()
  const fileRef   = useRef(null)
  const [imgUploadStatus, setImgUploadStatus] = useState(null)
  const [hovering, setHovering]               = useState(false)

  if (!editingProduct) return null

  const id = editingProduct.id
  const o  = overrides[id] ?? {}

  // Valores actuales (override o valor original del producto)
  const name       = o.name       ?? editingProduct.name
  const unitsLabel = o.unitsLabel ?? editingProduct.unitsLabel ?? ""
  const imgHidden  = o.imgHidden  ?? false
  const imgX       = o.imgX       ?? 0
  const imgY       = o.imgY       ?? 0
  const imgScale   = o.imgScale   ?? 1
  const imgMode    = o.imgMode    ?? "original"  // sync con applyOverride default
  const [removingBg, setRemovingBg] = useState(false)
  const [imgKey, setImgKey] = useState(() => Date.now())

  function patch(fields) {
    patchOverride(id, fields)
  }

  async function handleToggleNobg() {
    if (imgMode === "nobg") {
      // Desactivar: volver a original
      patch({ imgMode: "original" })
    } else {
      // Comprobar si ya existe el PNG sin fondo (via API, no Vite que devuelve 200 siempre)
      const nobgVersion = o.nobgVersion ?? 0
      const existsRes = await fetch(`${API}/nobg-exists/${id}`)
      const { exists } = await existsRes.json()
      if (exists) {
        // Ya procesada — activar directamente sin reprocesar
        patch({ imgMode: "nobg", nobgVersion })
        setImgKey(Date.now())
        return
      }
      // No existe — llamar al endpoint para quitar fondo
      setRemovingBg(true)
      try {
        const r = await fetch(`${API}/remove-bg/${id}`, { method: "POST" })
        const data = await r.json()
        if (r.ok) {
          patch({ imgMode: "nobg", nobgVersion: Date.now() })
          setImgKey(Date.now())
        } else {
          alert(`Error quitando fondo: ${data.error}`)
        }
      } catch (e) {
        alert(`Error de red: ${e.message}`)
      } finally {
        setRemovingBg(false)
      }
    }
  }

  // Preview de imagen en el sidebar: nobg si modo nobg, original en otro caso
  const origExt = editingProduct.image?.match(/\.(\w+)$/)?.[1] ?? "jpg"
  const imgSrc = editingProduct.image
    ? (imgMode === "nobg"
        ? `/images-nobg/${id}.png?v=${imgKey}`
        : `/images/${id}.${origExt}?v=${imgKey}`)
    : null
  const imgPreviewStyle = {
    width: "100%", height: "100%", objectFit: "contain",
    transform: `translate(${imgX}%, ${imgY}%) scale(${imgScale})`,
    transformOrigin: "center center",
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImgUploadStatus("loading")
    const form = new FormData()
    form.append("image", file)
    try {
      const res  = await fetch(`${API}/upload/${id}`, { method: "POST", body: form })
      const data = await res.json()
      if (data.ok) {
        const key = Date.now()
        setImgKey(key)
        editingProduct._refreshImg?.(key)
        setImgUploadStatus("ok")
        setTimeout(() => setImgUploadStatus(null), 2000)
      } else {
        setImgUploadStatus("error")
        setTimeout(() => setImgUploadStatus(null), 2000)
      }
    } catch {
      setImgUploadStatus("error")
      setTimeout(() => setImgUploadStatus(null), 2000)
    }
    e.target.value = ""
  }

  const divider = <div style={{ borderTop: "1px solid #f3f4f6", margin: "4px 0" }} />

  return (
    <>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderBottom: "1px solid #e5e7eb", flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>Editar producto</div>
          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>Ref: {id}</div>
        </div>
        <button
          onClick={() => setEditingProduct(null)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16, padding: 2 }}
        >✕</button>
      </div>

      {/* Scroll body */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ── Imagen ── */}
        <Field label="Imagen">
          {/* Preview clicable */}
          <div
            style={{
              width: "100%", aspectRatio: "1 / 1",
              background: "#f9fafb", border: "1px solid #e5e7eb",
              borderRadius: 8, overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative", cursor: "pointer", marginBottom: 8,
              opacity: imgHidden ? 0.35 : 1,
            }}
            onClick={() => !imgHidden && fileRef.current?.click()}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
          >
            {imgSrc ? (
              <img src={imgSrc} alt={name} style={imgPreviewStyle}
                onError={e => { e.target.style.display = "none" }} />
            ) : (
              <span style={{ fontSize: 10, color: "#d1d5db", fontWeight: 700 }}>SIN IMAGEN</span>
            )}
            {hovering && !imgHidden && (
              <div style={{
                position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 4,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span style={{ color: "#fff", fontSize: 10, fontWeight: 600 }}>Reemplazar</span>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*"
            style={{ display: "none" }} onChange={handleFileChange} />
          {imgUploadStatus === "loading" && <div style={{ fontSize: 11, color: "#6b7280", textAlign: "center" }}>Subiendo...</div>}
          {imgUploadStatus === "ok"      && <div style={{ fontSize: 11, color: "#16a34a", textAlign: "center" }}>✓ Guardada</div>}
          {imgUploadStatus === "error"   && <div style={{ fontSize: 11, color: "#dc2626", textAlign: "center" }}>✗ Error</div>}

          {/* Toggle visibilidad */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>Mostrar imagen</span>
            <button
              onClick={() => patch({ imgHidden: !imgHidden })}
              style={{
                width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer",
                background: imgHidden ? "#e5e7eb" : "#111827",
                position: "relative", transition: "background 0.2s", flexShrink: 0,
              }}
            >
              <span style={{
                position: "absolute", top: 2,
                left: imgHidden ? 2 : 18,
                width: 16, height: 16, borderRadius: "50%",
                background: "#fff", transition: "left 0.2s",
              }} />
            </button>
          </div>

          {/* Toggle sin fondo */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>
              Sin fondo{removingBg ? " (procesando…)" : ""}
            </span>
            <button
              onClick={handleToggleNobg}
              disabled={removingBg}
              style={{
                width: 36, height: 20, borderRadius: 10, border: "none",
                cursor: removingBg ? "wait" : "pointer",
                background: imgMode === "nobg" ? "#111827" : "#e5e7eb",
                position: "relative", transition: "background 0.2s", flexShrink: 0,
                opacity: removingBg ? 0.6 : 1,
              }}
            >
              <span style={{
                position: "absolute", top: 2,
                left: imgMode === "nobg" ? 18 : 2,
                width: 16, height: 16, borderRadius: "50%",
                background: "#fff", transition: "left 0.2s",
              }} />
            </button>
          </div>


        </Field>

        {divider}

        {/* ── Posición y escala ── */}
        <Field label="Ajuste de imagen">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SliderRow
              label="Horizontal" value={imgX} min={-50} max={50} step={1} unit="%"
              onChange={v => patch({ imgX: v })}
              onReset={() => patch({ imgX: 0 })}
            />
            <SliderRow
              label="Vertical" value={imgY} min={-50} max={50} step={1} unit="%"
              onChange={v => patch({ imgY: v })}
              onReset={() => patch({ imgY: 0 })}
            />
            <SliderRow
              label="Escala" value={imgScale} min={0.5} max={2} step={0.05} unit="×"
              onChange={v => patch({ imgScale: v })}
              onReset={() => patch({ imgScale: 1 })}
            />
          </div>
        </Field>

        {divider}

        {/* ── Texto ── */}
        <Field label="Nombre">
          <TextInput
            value={name}
            onChange={v => patch({ name: v })}
            placeholder={editingProduct.name}
          />
          {o.name && o.name !== editingProduct.name && (
            <button onClick={() => patch({ name: editingProduct.name })}
              style={{ fontSize: 10, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", textAlign: "left", marginTop: 3 }}>
              ↺ Restaurar original
            </button>
          )}
        </Field>

        <Field label="Unidades">
          <UnitsInput
            value={unitsLabel}
            onChange={v => patch({ unitsLabel: v })}
          />
          {o.unitsLabel && o.unitsLabel !== editingProduct.unitsLabel && (
            <button onClick={() => patch({ unitsLabel: editingProduct.unitsLabel })}
              style={{ fontSize: 10, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", textAlign: "left", marginTop: 3 }}>
              ↺ Restaurar original
            </button>
          )}
        </Field>

      </div>
    </>
  )
}
