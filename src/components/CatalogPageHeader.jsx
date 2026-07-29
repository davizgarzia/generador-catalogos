import { useRef, useState } from "react"
import { Download, Loader2, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { usePrint } from "../context/PrintContext"
import ViewControlsSheet from "./ViewControlsSheet"

const SHOW_LEGACY_PDF_EXPORT = false
const LEGACY_QUALITY_PRESETS = {
  low:    { label: "Rápida", scale: 1,    jpegQuality: 0.6 },
  medium: { label: "Media",  scale: 1.5,  jpegQuality: 0.85 },
  high:   { label: "Alta",   scale: 2.5,  jpegQuality: 0.95 },
}

export default function CatalogPageHeader({
  catalog,
  totalProducts,
  totalPages,
  hiddenProductsList = [],
  onExportingChange,
}) {
  const { printMode } = usePrint()
  const [viewOpen, setViewOpen] = useState(false)
  const [legacyQuality] = useState("medium")
  const [clientExport, setClientExport] = useState({ active: false, phase: null, page: 0, total: 0 })
  const cancelExportRef = useRef(false)

  async function waitForCatalogPages() {
    const startedAt = Date.now()
    while (Date.now() - startedAt < 6000) {
      if (cancelExportRef.current) throw new Error("EXPORT_CANCELLED")
      const wrappers = Array.from(document.querySelectorAll("#catalog > div, #catalog section > div"))
      const rendered = wrappers.filter(wrapper =>
        Array.from(wrapper.children).some(child => child.childElementCount > 0)
      ).length
      if (wrappers.length >= totalPages && rendered >= totalPages) return
      setClientExport({ active: true, phase: "rendering", page: 0, total: 0 })
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  async function preloadCatalogImages(onProgress) {
    const imgs = Array.from(document.querySelectorAll("#catalog img"))
    const total = imgs.length
    if (!total) return
    onProgress(0, total)
    let loaded = 0
    for (const img of imgs) {
      if (cancelExportRef.current) throw new Error("EXPORT_CANCELLED")
      try {
        img.loading = "eager"
        if (!img.complete || img.naturalHeight === 0) {
          await img.decode()
        }
      } catch {
        // ignoramos fallos puntuales, seguimos
      }
      loaded += 1
      onProgress(loaded, total)
    }
  }

  function cancelClientPdf() {
    cancelExportRef.current = true
    setClientExport(prev => ({ ...prev, phase: "canceling" }))
  }

  async function handleBrowserPrint() {
    if (clientExport.active) return
    cancelExportRef.current = false
    setClientExport({ active: true, phase: "preparing", page: 0, total: 0 })
    onExportingChange?.(true)

    let cleanupTimer
    const cleanup = () => {
      window.removeEventListener("afterprint", cleanup)
      window.clearTimeout(cleanupTimer)
      onExportingChange?.(false)
      setClientExport({ active: false, phase: null, page: 0, total: 0 })
      cancelExportRef.current = false
    }

    try {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      if (cancelExportRef.current) throw new Error("EXPORT_CANCELLED")
      await waitForCatalogPages()

      await preloadCatalogImages((page, total) => {
        setClientExport({ active: true, phase: "preparing", page, total })
      })
      if (cancelExportRef.current) throw new Error("EXPORT_CANCELLED")

      setClientExport({ active: true, phase: "printing", page: 0, total: 0 })
      window.addEventListener("afterprint", cleanup, { once: true })
      window.print()
      cleanupTimer = window.setTimeout(cleanup, 1000)
    } catch (error) {
      if (error.message !== "EXPORT_CANCELLED") {
        alert(`Error preparando impresión: ${error.message}`)
      }
      cleanup()
    }
  }

  async function handleLegacyPdfExport() {
    if (clientExport.active) return
    cancelExportRef.current = false
    setClientExport({ active: true, phase: "preparing", page: 0, total: 0 })
    onExportingChange?.(true)
    try {
      const preset = LEGACY_QUALITY_PRESETS[legacyQuality]
      await waitForCatalogPages()
      await preloadCatalogImages((page, total) => {
        setClientExport({ active: true, phase: "preparing", page, total })
      })
      if (cancelExportRef.current) throw new Error("EXPORT_CANCELLED")

      const [{ domToJpeg }, { jsPDF }] = await Promise.all([
        import("modern-screenshot"),
        import("jspdf"),
      ])
      const pages = Array.from(document.querySelectorAll("#catalog > div, #catalog section > div"))
      if (!pages.length) throw new Error("No se encontraron páginas para exportar.")

      setClientExport({ active: true, phase: "capturing", page: 0, total: pages.length })
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true })
      const widthMm = printMode ? 216 : 210
      const heightMm = printMode ? 303 : 297
      if (printMode) {
        pdf.deletePage(1)
        pdf.addPage([widthMm, heightMm], "portrait")
      }

      for (let i = 0; i < pages.length; i++) {
        if (cancelExportRef.current) throw new Error("EXPORT_CANCELLED")
        setClientExport({ active: true, phase: "capturing", page: i + 1, total: pages.length })
        const imgData = await domToJpeg(pages[i], {
          scale: preset.scale,
          quality: preset.jpegQuality,
          backgroundColor: "#ffffff",
        })
        if (cancelExportRef.current) throw new Error("EXPORT_CANCELLED")
        if (i > 0) pdf.addPage(printMode ? [widthMm, heightMm] : "a4", "portrait")
        pdf.addImage(imgData, "JPEG", 0, 0, widthMm, heightMm, undefined, "FAST")
      }

      pdf.save(`catalogo-${catalog.slug}-${catalog.edition}.pdf`)
    } catch (error) {
      if (error.message !== "EXPORT_CANCELLED") {
        alert(`Error generando PDF: ${error.message}`)
      }
    } finally {
      onExportingChange?.(false)
      setClientExport({ active: false, phase: null, page: 0, total: 0 })
      cancelExportRef.current = false
    }
  }

  return (
    <>
      <div className="app-chrome flex items-start justify-between gap-4 px-4 py-4 md:py-6 lg:px-6 border-b border-border bg-background">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Catálogo</h1>
          <p className="text-sm text-muted-foreground">
            {totalProducts} productos · {totalPages} páginas
            {hiddenProductsList.length > 0 && (
              <>
                {" · "}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="underline-offset-2 hover:underline text-muted-foreground hover:text-foreground">
                      {hiddenProductsList.length} ocultos
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-80 p-2">
                    <ScrollArea className="max-h-72">
                      <div className="flex flex-col">
                        {hiddenProductsList.map(product => (
                          <div key={product.id} className="px-2 py-1.5 text-xs flex gap-2">
                            <code className="text-muted-foreground">{product.id}</code>
                            <span>{product.name}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={handleBrowserPrint}
            disabled={clientExport.active}
            className="min-w-[190px]"
          >
            {clientExport.active ? (
              <>
                <Loader2 className="animate-spin" />
                {clientExport.phase === "preparing"
                  ? "Preparando…"
                  : clientExport.phase === "rendering"
                    ? "Preparando…"
                  : clientExport.phase === "canceling"
                    ? "Cancelando…"
                  : "Preparando impresión…"}
              </>
            ) : (
              <>
                <Download /> Guardar PDF
              </>
            )}
          </Button>

          {SHOW_LEGACY_PDF_EXPORT && (
            <Button
              type="button"
              variant="outline"
              onClick={handleLegacyPdfExport}
              disabled={clientExport.active}
            >
              Generar PDF
            </Button>
          )}

          {clientExport.active && (
            <Button
              type="button"
              variant="outline"
              onClick={cancelClientPdf}
              disabled={clientExport.phase === "canceling"}
            >
              Cancelar
            </Button>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={() => setViewOpen(true)}
            title="Ajustes de vista"
            aria-label="Ajustes de vista"
          >
            <Settings />
          </Button>
        </div>
      </div>

      <ViewControlsSheet open={viewOpen} onOpenChange={setViewOpen} />
    </>
  )
}
