import { useRef, useState, forwardRef, useImperativeHandle } from "react"
import { Upload, FileSpreadsheet, Loader2, CheckCircle, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

const API = "http://localhost:3001"

const ImportExcelButton = forwardRef(function ImportExcelButton({ onImported, hideButton }, ref) {
  const inputRef = useRef(null)

  useImperativeHandle(ref, () => ({
    trigger: () => inputRef.current?.click(),
  }))
  const [state, setState] = useState("idle") // idle | loading | preview | confirming | done | error
  const [summary, setSummary] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [errorMsg, setErrorMsg] = useState("")

  function handleClick() {
    inputRef.current?.click()
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    setState("loading")
    setErrorMsg("")
    setPendingFile(file)

    try {
      const fd = new FormData()
      fd.append("excel", file)
      const res = await fetch(`${API}/api/import-excel`, { method: "POST", body: fd })
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
    if (!pendingFile) return
    setState("confirming")
    try {
      const fd = new FormData()
      fd.append("excel", pendingFile)
      const res = await fetch(`${API}/api/import-excel?confirm=1`, { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error desconocido")
      setState("done")
      onImported?.()
      // Forzar recarga de la página tras breve pausa para que Vite actualice products.js
      setTimeout(() => window.location.reload(), 1200)
    } catch (e) {
      setErrorMsg(e.message)
      setState("error")
    }
  }

  function handleCancel() {
    setState("idle")
    setSummary(null)
    setPendingFile(null)
  }

  return (
    <>
      {/* Input oculto */}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={handleFile}
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
            : <Upload size={13} />
          }
          <span style={{ fontSize: 12 }}>
            {state === "loading"   ? "Leyendo…"
            : state === "confirming" ? "Importando…"
            : state === "done"       ? "Importado"
            : "Actualizar catálogo"}
          </span>
        </Button>
      )}

      {/* Modal de preview */}
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
            width: 420,
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            {state === "error" ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <AlertTriangle size={20} color="#dc2626" />
                  <span style={{ fontWeight: 600, fontSize: 15 }}>Error al leer el Excel</span>
                </div>
                <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>{errorMsg}</p>
                <Button size="sm" variant="outline" onClick={handleCancel} style={{ width: "100%" }}>
                  Cerrar
                </Button>
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <FileSpreadsheet size={20} color="#2563eb" />
                  <span style={{ fontWeight: 600, fontSize: 15 }}>Resumen de cambios</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  <Row label="Total productos en Excel" value={summary.total} />
                  <Row label="Nuevos (se añaden)" value={summary.added} color="#16a34a" />
                  <Row label="Eliminados (ya no están)" value={summary.removed} color="#dc2626" />
                  <Row label="Sin cambios" value={summary.kept} />
                </div>

                {summary.addedIds?.length > 0 && (
                  <Detail label="Nuevos IDs" ids={summary.addedIds} color="#16a34a" />
                )}
                {summary.removedIds?.length > 0 && (
                  <Detail label="IDs eliminados" ids={summary.removedIds} color="#dc2626" />
                )}

                <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 20 }}>
                  Al confirmar se sobreescribirá <code>products.js</code> y la página se recargará.
                  Los overrides (imágenes, escala, posición) se conservan.
                </p>

                <div style={{ display: "flex", gap: 10 }}>
                  <Button size="sm" variant="outline" onClick={handleCancel} style={{ flex: 1 }}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleConfirm} style={{ flex: 1 }}>
                    Confirmar importación
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

export default ImportExcelButton

function Row({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "#374151" }}>{label}</span>
      <span style={{ fontWeight: 700, color: color ?? "#111827" }}>{value}</span>
    </div>
  )
}

function Detail({ label, ids, color }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 4 }}>{label}:</p>
      <p style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace", lineHeight: 1.6 }}>
        {ids.join(", ")}{ids.length === 20 ? "…" : ""}
      </p>
    </div>
  )
}
