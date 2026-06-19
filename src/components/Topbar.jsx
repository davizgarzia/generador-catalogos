import { useEffect, useRef, useState } from "react"
import { BookOpen, Download, FileDown, Loader2, LogIn, LogOut, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { usePrint } from "../context/PrintContext"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabase"
import LoginDialog from "./LoginDialog"

export default function Topbar({ catalog, totalProducts, totalPages, hiddenProducts = 0, hiddenProductsList = [] }) {
  const { printMode, printSize, draftQuality, productGrid, hideNoImage } = usePrint()
  const { user, isAdmin, signOut } = useAuth()
  const [generating, setGenerating] = useState(false)
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
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          imageTimeout: 15000,
        })
        const imgData = canvas.toDataURL("image/jpeg", 0.9)
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

  async function handleGeneratePdf() {
    if (!isAdmin || !user) {
      setLoginOpen(true)
      return
    }

    setGenerating(true)
    try {
      const options = { marks: printMode, size: printSize, draft: draftQuality, grid: productGrid, hideNoImage }
      const { data: exportJob, error: createError } = await supabase
        .from("pdf_exports")
        .insert({ catalog_id: catalog.id, requested_by: user.id, options })
        .select()
        .single()
      if (createError) throw createError

      const { data: sessionData } = await supabase.auth.getSession()
      const response = await fetch("/.netlify/functions/generate-pdf-background", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ exportId: exportJob.id }),
      })
      if (!response.ok) throw new Error("No se pudo iniciar la generación.")

      let completed
      for (let attempt = 0; attempt < 150; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        const { data, error } = await supabase
          .from("pdf_exports")
          .select("status,storage_path,error_message")
          .eq("id", exportJob.id)
          .single()
        if (error) throw error
        if (data.status === "failed") throw new Error(data.error_message || "Falló la generación.")
        if (data.status === "completed") {
          completed = data
          break
        }
      }
      if (!completed) throw new Error("La generación superó el tiempo de espera.")

      const { data: signed, error: signedError } = await supabase.storage
        .from("catalog-pdfs")
        .createSignedUrl(completed.storage_path, 60)
      if (signedError) throw signedError
      const link = document.createElement("a")
      link.href = signed.signedUrl
      link.download = `catalogo-${catalog.slug}-${catalog.edition}.pdf`
      link.click()
    } catch (error) {
      alert(`Error generando PDF: ${error.message}`)
    } finally {
      setGenerating(false)
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
      <Button size="sm" variant="outline" onClick={() => window.print()} title="Imprimir o guardar como PDF desde el navegador">
        <Printer size={13} /> Imprimir
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={handleClientPdf}
        disabled={clientExport.active}
        style={{ minWidth: 130 }}
        title="Descarga el catálogo como PDF directamente desde el navegador"
      >
        {clientExport.active
          ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> {clientExport.total ? `${clientExport.page}/${clientExport.total}` : "Preparando…"}</>
          : <><Download size={13} /> PDF rápido</>}
      </Button>
      <Button size="sm" onClick={handleGeneratePdf} disabled={generating} style={{ minWidth: 110 }}>
        {generating
          ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Generando…</>
          : <><FileDown size={13} /> Guardar PDF</>}
      </Button>
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </header>
  )
}
