import { useRef, useState, forwardRef, useImperativeHandle } from "react"
import { Images, Loader2, CheckCircle, AlertTriangle, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"

const API = "http://localhost:3001"

const ImportImagesButton = forwardRef(function ImportImagesButton({ onImported, hideButton }, ref) {
  const inputRef = useRef(null)

  useImperativeHandle(ref, () => ({
    trigger: () => inputRef.current?.click(),
  }))
  const [state, setState] = useState("idle") // idle | loading | preview | confirming | done | error
  const [summary, setSummary] = useState(null)
  const [pendingFiles, setPendingFiles] = useState(null)
  const [errorMsg, setErrorMsg] = useState("")

  function handleClick() {
    inputRef.current?.click()
  }

  async function handleFiles(e) {
    const files = [...(e.target.files ?? [])]
    if (!files.length) return
    e.target.value = ""

    setState("loading")
    setErrorMsg("")
    setPendingFiles(files)

    try {
      const fd = new FormData()
      files.forEach(f => fd.append("images", f))
      const res = await fetch(`${API}/api/import-images`, { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error desconocido")
      setSummary(data.summary)
      setState("preview")
    } catch (e) {
      setErrorMsg(e.message)
      setState("error")
    }
  }

  async function handleConfirm() {
    if (!pendingFiles) return
    setState("confirming")
    try {
      const fd = new FormData()
      pendingFiles.forEach(f => fd.append("images", f))
      const res = await fetch(`${API}/api/import-images?confirm=1`, { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error desconocido")
      setState("done")
      onImported?.()
      // Recargar para que Vite actualice products.js
      setTimeout(() => window.location.reload(), 1200)
    } catch (e) {
      setErrorMsg(e.message)
      setState("error")
    }
  }

  function handleCancel() {
    setState("idle")
    setSummary(null)
    setPendingFiles(null)
  }

  return (
    <>
      {/* Input oculto — acepta carpeta completa */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        // webkitdirectory permite seleccionar una carpeta entera
        webkitdirectory=""
        style={{ display: "none" }}
        onChange={handleFiles}
      />

      {/* Botón principal (oculto cuando lo gestiona el dropdown del Topbar) */}
      {!hideButton && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleClick}
          disabled={state === "loading" || state === "confirming" || state === "done"}
          style={{ padding: "0 10px", height: 28, gap: 5 }}
        >
          {state === "loading" || state === "confirming"
            ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
            : state === "done"
            ? <CheckCircle size={13} color="#16a34a" />
            : <FolderOpen size={13} />
          }
          <span style={{ fontSize: 12 }}>
            {state === "loading"     ? "Leyendo…"
            : state === "confirming" ? "Importando…"
            : state === "done"       ? "Importadas"
            : "Importar imágenes"}
          </span>
        </Button>
      )}

      {/* Modal de preview / error */}
      {(state === "preview" || state === "error") && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#fff",
            borderRadius: 12,
            padding: 28,
            width: 440,
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            {state === "error" ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <AlertTriangle size={20} color="#dc2626" />
                  <span style={{ fontWeight: 600, fontSize: 15 }}>Error al leer las imágenes</span>
                </div>
                <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>{errorMsg}</p>
                <Button size="sm" variant="outline" onClick={handleCancel} style={{ width: "100%" }}>
                  Cerrar
                </Button>
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <Images size={20} color="#2563eb" />
                  <span style={{ fontWeight: 600, fontSize: 15 }}>Resumen de imágenes</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  <Row label="Total archivos seleccionados" value={summary.total} />
                  <Row label="Con producto en catálogo" value={summary.matched} color="#16a34a" />
                  <Row label="Imágenes nuevas" value={summary.newImages} color="#2563eb" />
                  <Row label="Sustituyen imagen existente" value={summary.replaced} color="#d97706" />
                  <Row label="Sin producto (se ignoran)" value={summary.unmatched} color="#9ca3af" />
                </div>

                {summary.unmatchedIds?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 4 }}>
                      IDs sin match (primeros {summary.unmatchedIds.length}):
                    </p>
                    <p style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace", lineHeight: 1.6 }}>
                      {summary.unmatchedIds.join(", ")}{summary.unmatched > 20 ? "…" : ""}
                    </p>
                  </div>
                )}

                <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 20 }}>
                  Al confirmar se copiarán las imágenes a <code>public/images/</code> y se
                  actualizará <code>products.js</code>. La página se recargará automáticamente.
                </p>

                <div style={{ display: "flex", gap: 10 }}>
                  <Button size="sm" variant="outline" onClick={handleCancel} style={{ flex: 1 }}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConfirm}
                    style={{ flex: 1 }}
                    disabled={summary.matched === 0}
                  >
                    Confirmar ({summary.matched} imágenes)
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
})

export default ImportImagesButton

function Row({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "#374151" }}>{label}</span>
      <span style={{ fontWeight: 700, color: color ?? "#111827" }}>{value}</span>
    </div>
  )
}
