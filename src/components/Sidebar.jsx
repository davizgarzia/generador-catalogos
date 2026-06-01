import { useRef, useState } from "react"
import { Switch } from "@/components/ui/switch"
import { usePrint } from "../context/PrintContext"
import { useEdit } from "../context/EditContext"
import { useOverrides } from "../context/OverridesContext"
import EditSidebar from "./EditSidebar"
import ImportExcelButton from "./ImportExcelButton"
import ImportImagesButton from "./ImportImagesButton"

function BulkRemoveBgButton({ onDone }) {
  const { patchOverride } = useOverrides()
  const [state, setState] = useState("idle") // idle | running | stopped | done | error
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [errors, setErrors] = useState([])
  const jobIdRef = useRef(null)

  async function start() {
    setState("running")
    setProgress({ done: 0, total: 0 })
    setErrors([])
    jobIdRef.current = null

    try {
      const res = await fetch("http://localhost:3001/api/remove-bg-bulk", { method: "POST" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop()
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const msg = JSON.parse(line.slice(6))
            // El primer mensaje lleva jobId y total
            if (msg.jobId) {
              jobIdRef.current = msg.jobId
              setProgress({ done: 0, total: msg.total })
              continue
            }
            if (msg.done !== undefined) setProgress({ done: msg.done, total: msg.total })
            if (msg.ok === false && msg.error && msg.error !== "Sin imagen original" && msg.error !== "aborted") {
              setErrors(prev => [...prev, msg.id])
            }
            if (msg.ok === true) patchOverride(msg.id, { imgMode: "nobg" })
            if (msg.finished) {
              setState(msg.stopped ? "stopped" : "done")
              jobIdRef.current = null
              onDone?.()
            }
          } catch {}
        }
      }
    } catch (e) {
      // Si el reader se corta por stop, el server cierra la conexión → tratarlo como stopped
      setState(jobIdRef.current === null ? "error" : "stopped")
      jobIdRef.current = null
    }
  }

  async function stop() {
    const jobId = jobIdRef.current
    if (!jobId) return
    try {
      await fetch("http://localhost:3001/api/remove-bg-bulk/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      })
    } catch {}
    // El estado pasará a "stopped" cuando el SSE cierre
  }

  function reset() {
    setState("idle")
    setProgress({ done: 0, total: 0 })
    setErrors([])
    jobIdRef.current = null
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  const btnBase = {
    fontSize: 11, padding: "4px 10px", borderRadius: 5,
    cursor: "pointer", fontWeight: 600, border: "1.5px solid",
  }

  if (state === "idle") {
    return (
      <button
        onClick={start}
        style={{
          width: "100%", padding: "7px 10px", fontSize: 12, fontWeight: 600,
          borderRadius: 6, border: "1.5px solid #e5e7eb", background: "#fff",
          color: "#374151", cursor: "pointer", textAlign: "left", transition: "background 0.12s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
        onMouseLeave={e => e.currentTarget.style.background = "#fff"}
      >
        Quitar fondo a todo
      </button>
    )
  }

  if (state === "running") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "#6b7280" }}>
            Procesando… {progress.done}/{progress.total}
          </span>
          <button
            onClick={stop}
            style={{ ...btnBase, background: "#fff", borderColor: "#fca5a5", color: "#dc2626" }}
            onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
            onMouseLeave={e => e.currentTarget.style.background = "#fff"}
          >
            Detener
          </button>
        </div>
        <div style={{ height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`, background: "#111827",
            borderRadius: 3, transition: "width 0.2s",
          }} />
        </div>
        <span style={{ fontSize: 10, color: "#9ca3af" }}>{pct}%</span>
      </div>
    )
  }

  if (state === "stopped") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, color: "#d97706", fontWeight: 600 }}>
          ⏹ Detenido — {progress.done}/{progress.total} procesadas
        </span>
        {errors.length > 0 && (
          <span style={{ fontSize: 11, color: "#dc2626" }}>{errors.length} con error</span>
        )}
        <button onClick={reset} style={{ fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
          Reanudar desde el principio
        </button>
      </div>
    )
  }

  if (state === "done") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>
          ✓ {progress.total} imágenes procesadas
        </span>
        {errors.length > 0 && (
          <span style={{ fontSize: 11, color: "#dc2626" }}>{errors.length} con error</span>
        )}
        <button onClick={reset} style={{ fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
          Repetir
        </button>
      </div>
    )
  }

  if (state === "error") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, color: "#dc2626" }}>Error al conectar con el servidor</span>
        <button onClick={reset} style={{ fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
          Reintentar
        </button>
      </div>
    )
  }
}

function DetectBgButton() {
  const { patchOverride } = useOverrides()
  const [state, setState] = useState("idle") // idle | running | done | error
  const [progress, setProgress] = useState({ done: 0, total: 0, blend: 0, original: 0 })

  async function start() {
    setState("running")
    setProgress({ done: 0, total: 0, blend: 0, original: 0 })
    let blendCount = 0, originalCount = 0

    try {
      const res = await fetch("http://localhost:3001/api/detect-bg-bulk", { method: "POST" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop()
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const msg = JSON.parse(line.slice(6))
            if (msg.total && msg.done === undefined) {
              setProgress(p => ({ ...p, total: msg.total }))
              continue
            }
            if (msg.done !== undefined) {
              if (msg.ok && msg.mode) {
                patchOverride(msg.id, { imgMode: msg.mode })
                if (msg.mode === "blend") blendCount++
                else originalCount++
              }
              setProgress({ done: msg.done, total: msg.total, blend: blendCount, original: originalCount })
            }
            if (msg.finished) setState("done")
          } catch {}
        }
      }
    } catch {
      setState("error")
    }
  }

  function reset() {
    setState("idle")
    setProgress({ done: 0, total: 0, blend: 0, original: 0 })
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  if (state === "idle") {
    return (
      <button
        onClick={start}
        style={{
          width: "100%", padding: "7px 10px", fontSize: 12, fontWeight: 600,
          borderRadius: 6, border: "1.5px solid #e5e7eb", background: "#fff",
          color: "#374151", cursor: "pointer", textAlign: "left", transition: "background 0.12s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
        onMouseLeave={e => e.currentTarget.style.background = "#fff"}
      >
        Detectar fondo blanco
      </button>
    )
  }

  if (state === "running") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 11, color: "#6b7280" }}>
          Analizando… {progress.done}/{progress.total}
        </span>
        <div style={{ height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`, background: "#6366f1",
            borderRadius: 3, transition: "width 0.1s",
          }} />
        </div>
        <span style={{ fontSize: 10, color: "#9ca3af" }}>{pct}%</span>
      </div>
    )
  }

  if (state === "done") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>
          ✓ Detección completada
        </span>
        <span style={{ fontSize: 11, color: "#6b7280" }}>
          {progress.blend} fondo blanco · {progress.original} fondo color
        </span>
        <button onClick={reset} style={{ fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
          Repetir
        </button>
      </div>
    )
  }

  if (state === "error") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, color: "#dc2626" }}>Error al conectar con el servidor</span>
        <button onClick={reset} style={{ fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
          Reintentar
        </button>
      </div>
    )
  }
}

function AutoFitImagesButton() {
  const { patchOverride } = useOverrides()
  const [state, setState] = useState("idle") // idle | running | done | error
  const [progress, setProgress] = useState({ done: 0, total: 0, fitted: 0, skipped: 0 })

  async function start() {
    setState("running")
    setProgress({ done: 0, total: 0, fitted: 0, skipped: 0 })

    let fitted = 0
    let skipped = 0

    try {
      const res = await fetch("http://localhost:3001/api/auto-fit-images-bulk", { method: "POST" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop()
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const msg = JSON.parse(line.slice(6))
            if (msg.total && msg.done === undefined) {
              setProgress(p => ({ ...p, total: msg.total }))
              continue
            }
            if (msg.ok === true) {
              fitted++
              patchOverride(msg.id, {
                imgScale: msg.imgScale,
                imgX: msg.imgX,
                imgY: msg.imgY,
              })
            }
            if (msg.ok === false) skipped++
            if (msg.done !== undefined) {
              setProgress({ done: msg.done, total: msg.total, fitted, skipped })
            }
            if (msg.finished) {
              setProgress({
                done: msg.done,
                total: msg.total,
                fitted: msg.fitted ?? fitted,
                skipped: msg.skipped ?? skipped,
              })
              setState("done")
            }
          } catch {}
        }
      }
    } catch {
      setState("error")
    }
  }

  function reset() {
    setState("idle")
    setProgress({ done: 0, total: 0, fitted: 0, skipped: 0 })
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  if (state === "idle") {
    return (
      <button
        onClick={start}
        style={{
          width: "100%", padding: "7px 10px", fontSize: 12, fontWeight: 600,
          borderRadius: 6, border: "1.5px solid #e5e7eb", background: "#fff",
          color: "#374151", cursor: "pointer", textAlign: "left", transition: "background 0.12s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
        onMouseLeave={e => e.currentTarget.style.background = "#fff"}
      >
        Ajustar tamaño automático
      </button>
    )
  }

  if (state === "running") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 11, color: "#6b7280" }}>
          Ajustando… {progress.done}/{progress.total}
        </span>
        <div style={{ height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`, background: "#111827",
            borderRadius: 3, transition: "width 0.1s",
          }} />
        </div>
        <span style={{ fontSize: 10, color: "#9ca3af" }}>{pct}%</span>
      </div>
    )
  }

  if (state === "done") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>
          ✓ {progress.fitted} imágenes ajustadas
        </span>
        {progress.skipped > 0 && (
          <span style={{ fontSize: 11, color: "#9ca3af" }}>{progress.skipped} omitidas</span>
        )}
        <button onClick={reset} style={{ fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
          Repetir
        </button>
      </div>
    )
  }

  if (state === "error") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, color: "#dc2626" }}>Error al conectar con el servidor</span>
        <button onClick={reset} style={{ fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
          Reintentar
        </button>
      </div>
    )
  }
}


export default function Sidebar() {
  const {
    printMode,
    setPrintMode,
    printSize,
    setPrintSize,
    draftQuality,
    setDraftQuality,
    productGrid,
    setProductGrid,
  } = usePrint()
  const { editingProduct } = useEdit()

  const excelRef = useRef(null)
  const imagesRef = useRef(null)

  return (
    <aside style={{
      position: "fixed",
      right: 0, top: 44, bottom: 0,
      width: 220,
      background: "#ffffff",
      borderLeft: "1px solid #e5e7eb",
      display: "flex",
      flexDirection: "column",
      zIndex: 40,
      overflowY: "auto",
    }} className="app-chrome">

      {editingProduct ? (
        <EditSidebar />
      ) : (
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* ── Vista ── */}
          <div style={{
            fontSize: 10, fontWeight: 600, color: "#9ca3af",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            Vista
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>
              Marcas de corte
            </span>
            <Switch
              id="print-mode-sidebar"
              checked={printMode}
              onCheckedChange={setPrintMode}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>
              Calidad borrador
            </span>
            <Switch
              id="draft-quality-sidebar"
              checked={draftQuality}
              onCheckedChange={setDraftQuality}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>
              Referencias por hoja
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { label: "3×3", value: "3x3" },
                { label: "4×3", value: "4x3" },
                { label: "4×4", value: "4x4" },
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setProductGrid(option.value)}
                  style={{
                    flex: 1,
                    padding: "5px 0",
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: productGrid === option.value ? "1.5px solid #111827" : "1.5px solid #e5e7eb",
                    background: productGrid === option.value ? "#111827" : "#fff",
                    color: productGrid === option.value ? "#fff" : "#374151",
                    cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {printMode && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>
                Tamaño de impresión
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                {["A4", "A5"].map(size => (
                  <button
                    key={size}
                    onClick={() => setPrintSize(size)}
                    style={{
                      flex: 1,
                      padding: "5px 0",
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 6,
                      border: printSize === size ? "1.5px solid #111827" : "1.5px solid #e5e7eb",
                      background: printSize === size ? "#111827" : "#fff",
                      color: printSize === size ? "#fff" : "#374151",
                      cursor: "pointer",
                      transition: "all 0.12s",
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Separador ── */}
          <div style={{ height: 1, background: "#e5e7eb", margin: "4px 0" }} />

          {/* ── Datos ── */}
          <div style={{
            fontSize: 10, fontWeight: 600, color: "#9ca3af",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            Datos
          </div>

          <ImportExcelButton ref={excelRef} />
          <ImportImagesButton ref={imagesRef} />

          {/* ── Separador ── */}
          <div style={{ height: 1, background: "#e5e7eb", margin: "4px 0" }} />

          {/* ── Imágenes ── */}
          <div style={{
            fontSize: 10, fontWeight: 600, color: "#9ca3af",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            Imágenes
          </div>

          <AutoFitImagesButton />
          <BulkRemoveBgButton />

        </div>
      )}

    </aside>
  )
}
