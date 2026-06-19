import { useEffect, useRef, useState } from "react"
import { BookOpen, Download, Loader2, LogIn, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { usePrint } from "../context/PrintContext"
import { useAuth } from "../context/AuthContext"
import LoginDialog from "./LoginDialog"

const QUALITY_PRESETS = {
  low:    { label: "Rápida", scale: 1.25, jpegQuality: 0.75 },
  medium: { label: "Media",  scale: 2,    jpegQuality: 0.9  },
  high:   { label: "Alta",   scale: 3,    jpegQuality: 0.95 },
}

export default function Topbar({ catalog, totalProducts, totalPages, hiddenProducts = 0, hiddenProductsList = [] }) {
  const { printMode } = usePrint()
  const { user, signOut } = useAuth()
  const [quality, setQuality] = useState("medium")
  const [clientExport, setClientExport] = useState({ active: false, page: 0, total: 0 })
  const [loginOpen, setLoginOpen] = useState(false)
  const [hiddenOpen, setHiddenOpen] = useState(false)
  const hiddenWrapRef = useRef(null)

  useEffect(() => {
    if (!hiddenOpen) return
    function close(event) {
      if (hiddenWrapRef.current && !hiddenWrapRef.current.contains(event.target)) setHiddenOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [hiddenOpen])

  async function handleClientPdf() {
    if (clientExport.active) return
    setClientExport({ active: true, page: 0, total: 0 })
    try {
      const preset = QUALITY_PRESETS[quality]
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ])
      const pages = Array.from(document.querySelectorAll("#catalog > div, #catalog section > div"))
      if (!pages.length) throw new Error("No se encontraron páginas para exportar.")

      setClientExport({ active: true, page: 0, total: pages.length })
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true })
      const widthMm = printMode ? 216 : 210
      const heightMm = printMode ? 303 : 297
      if (printMode) {
        pdf.deletePage(1)
        pdf.addPage([widthMm, heightMm], "portrait")
      }

      for (let i = 0; i < pages.length; i++) {
        setClientExport({ active: true, page: i + 1, total: pages.length })
        const canvas = await html2canvas(pages[i], {
          scale: preset.scale,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          imageTimeout: 15000,
        })
        const imgData = canvas.toDataURL("image/jpeg", preset.jpegQuality)
        if (i > 0) pdf.addPage(printMode ? [widthMm, heightMm] : "a4", "portrait")
        pdf.addImage(imgData, "JPEG", 0, 0, widthMm, heightMm, undefined, "FAST")
      }

      pdf.save(`catalogo-${catalog.slug}-${catalog.edition}.pdf`)
    } catch (error) {
      alert(`Error generando PDF: ${error.message}`)
    } finally {
      setClientExport({ active: false, page: 0, total: 0 })
    }
  }

  return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0, height: 44, display: "flex",
      alignItems: "center", gap: 12, padding: "0 16px", background: "#fff",
      borderBottom: "1px solid #e5e7eb", zIndex: 50,
    }} className="app-chrome">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 24, height: 24, background: "#111827", borderRadius: 6, display: "grid", placeItems: "center" }}>
          <BookOpen size={13} color="white" />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{catalog.name}</span>
        <Badge variant="secondary" style={{ fontSize: 11 }}>{catalog.edition}</Badge>
      </div>

      <Separator orientation="vertical" style={{ height: 16 }} />
      <span style={{ fontSize: 12, color: "#6b7280" }}><b style={{ color: "#111827" }}>{totalProducts}</b> productos</span>
      {hiddenProducts > 0 && (
        <div ref={hiddenWrapRef} style={{ position: "relative" }}>
          <button onClick={() => setHiddenOpen(value => !value)}
            style={{ border: 0, background: "transparent", color: "#9ca3af", fontSize: 12, cursor: "pointer" }}>
            {hiddenProducts} ocultos
          </button>
          {hiddenOpen && (
            <div style={{
              position: "absolute", top: 26, left: 0, width: 360, maxHeight: 360, overflow: "auto",
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8,
              boxShadow: "0 10px 30px rgba(0,0,0,.08)",
            }}>
              {hiddenProductsList.map(product => (
                <div key={product.id} style={{ padding: 6, fontSize: 12 }}>
                  <code>{product.id}</code> {product.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <span style={{ fontSize: 12, color: "#6b7280" }}><b style={{ color: "#111827" }}>{totalPages}</b> páginas</span>
      <div style={{ flex: 1 }} />

      {user ? (
        <Button size="sm" variant="ghost" onClick={signOut} title={user.email}>
          <LogOut size={13} /> Salir
        </Button>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setLoginOpen(true)}>
          <LogIn size={13} /> Administrar
        </Button>
      )}
      <Select value={quality} onValueChange={setQuality} disabled={clientExport.active}>
        <SelectTrigger size="sm" style={{ width: 110 }} title="Calidad del PDF: más alta = más detalle y más tiempo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
            <SelectItem key={key} value={key}>{preset.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        onClick={handleClientPdf}
        disabled={clientExport.active}
        style={{ minWidth: 140 }}
        title="Descarga el catálogo como PDF directamente desde el navegador"
      >
        {clientExport.active
          ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> {clientExport.total ? `${clientExport.page}/${clientExport.total}` : "Preparando…"}</>
          : <><Download size={13} /> Descargar PDF</>}
      </Button>
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </header>
  )
}
