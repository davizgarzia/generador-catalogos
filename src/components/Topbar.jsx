import { useEffect, useRef, useState } from "react"
import { BookOpen, FileDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { usePrint } from "../context/PrintContext"

export default function Topbar({ totalProducts, totalPages, hiddenProducts = 0, hiddenProductsList = [] }) {
  const { printMode, printSize, draftQuality, productGrid, hideNoImage } = usePrint()
  const [generating, setGenerating] = useState(false)
  const [hiddenOpen, setHiddenOpen] = useState(false)
  const hiddenWrapRef = useRef(null)

  useEffect(() => {
    if (!hiddenOpen) return
    function onDocClick(e) {
      if (hiddenWrapRef.current && !hiddenWrapRef.current.contains(e.target)) {
        setHiddenOpen(false)
      }
    }
    function onKey(e) {
      if (e.key === "Escape") setHiddenOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDocClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [hiddenOpen])

  useEffect(() => {
    if (hiddenProducts === 0) setHiddenOpen(false)
  }, [hiddenProducts])

  async function handleGeneratePdf() {
    setGenerating(true)
    try {
      const res = await fetch("http://localhost:3001/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marks: printMode,
          size: printSize,
          draft: draftQuality,
          grid: productGrid,
          hideNoImage,
        }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        alert(`Error generando PDF: ${error}`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "catalogo-impormed-2025.pdf"
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(`Error conectando con el servidor: ${e.message}\n¿Está corriendo npm run dev:all?`)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <header style={{
      position: "fixed",
      top: 0, left: 0, right: 0,
      height: 44,
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "0 16px",
      background: "#ffffff",
      borderBottom: "1px solid #e5e7eb",
      zIndex: 50,
    }} className="app-chrome">

      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 24, height: 24,
          background: "#111827",
          borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <BookOpen size={13} color="white" />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", letterSpacing: "-0.01em" }}>
          Catálogo IMPORMED
        </span>
        <Badge variant="secondary" style={{ fontSize: 11, padding: "1px 6px", borderRadius: 4 }}>
          2025
        </Badge>
      </div>

      <Separator orientation="vertical" style={{ height: 16 }} />

      {/* Stats */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 12, color: "#6b7280" }}>
          <span style={{ fontWeight: 600, color: "#111827" }}>{totalProducts}</span> productos
        </span>
        {hiddenProducts > 0 && (
          <div ref={hiddenWrapRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setHiddenOpen(o => !o)}
              style={{
                fontSize: 12,
                color: "#9ca3af",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                textDecoration: "underline",
                textDecorationStyle: "dotted",
                textUnderlineOffset: 2,
              }}
              title="Ver productos ocultos"
            >
              {hiddenProducts} ocultos
            </button>
            {hiddenOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  width: 360,
                  maxHeight: 360,
                  overflowY: "auto",
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                  zIndex: 60,
                  padding: 8,
                }}
              >
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  padding: "6px 8px 8px",
                  borderBottom: "1px solid #f3f4f6",
                  marginBottom: 4,
                }}>
                  Productos sin imagen ({hiddenProductsList.length})
                </div>
                {hiddenProductsList.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#9ca3af", padding: 8 }}>
                    No hay productos ocultos.
                  </div>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {hiddenProductsList.map(p => (
                      <li
                        key={p.id}
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "baseline",
                          padding: "6px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          lineHeight: 1.3,
                        }}
                      >
                        <span style={{
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                          color: "#6b7280",
                          fontSize: 11,
                          flexShrink: 0,
                        }}>
                          {p.id}
                        </span>
                        <span style={{ color: "#111827" }}>{p.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
        <span style={{ fontSize: 12, color: "#6b7280" }}>
          <span style={{ fontWeight: 600, color: "#111827" }}>{totalPages}</span> páginas
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Guardar PDF */}
      <Button
        size="sm"
        onClick={handleGeneratePdf}
        disabled={generating}
        style={{ padding: "0 12px", height: 28, minWidth: 110 }}
      >
        {generating
          ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Generando…</>
          : <><FileDown size={13} /> Guardar PDF</>
        }
      </Button>

    </header>
  )
}
