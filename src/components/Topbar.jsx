import { useState } from "react"
import { BookOpen, FileDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { usePrint } from "../context/PrintContext"

export default function Topbar({ totalProducts, totalPages }) {
  const { printMode, printSize } = usePrint()
  const [generating, setGenerating] = useState(false)

  async function handleGeneratePdf() {
    setGenerating(true)
    try {
      const res = await fetch("http://localhost:3001/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marks: printMode, size: printSize }),
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
        <span style={{ fontSize: 12, color: "#6b7280" }}>
          <span style={{ fontWeight: 600, color: "#111827" }}>{totalPages}</span> páginas
        </span>
      </div>

      <div style={{ flex: 1 }} />

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
