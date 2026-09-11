import { useRef, useState } from "react"
import { Download, Loader2, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import ViewControlsSheet from "./ViewControlsSheet"

// Tiempo máximo de espera a que las páginas lazy terminen de montar antes de imprimir.
const RENDER_WAIT_MS = 30000
// Respaldo por si afterprint/matchMedia no llegan (diálogo abierto mucho tiempo, navegadores antiguos).
const CLEANUP_FALLBACK_MS = 60000

export default function CatalogPageHeader({
  totalProducts,
  totalPages,
  hiddenProductsList = [],
  onExportingChange,
}) {
  const [viewOpen, setViewOpen] = useState(false)
  const [clientExport, setClientExport] = useState({ active: false, phase: null, page: 0, total: 0 })
  const [exportError, setExportError] = useState("")
  const cancelExportRef = useRef(false)

  async function waitForCatalogPages() {
    const startedAt = Date.now()
    while (Date.now() - startedAt < RENDER_WAIT_MS) {
      if (cancelExportRef.current) throw new Error("EXPORT_CANCELLED")
      const wrappers = Array.from(document.querySelectorAll("#catalog > div, #catalog section > div"))
      const rendered = wrappers.filter(wrapper =>
        Array.from(wrapper.children).some(child => child.childElementCount > 0)
      ).length
      if (wrappers.length >= totalPages && rendered >= totalPages) return
      setClientExport({ active: true, phase: "rendering", page: rendered, total: totalPages })
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error("No se han podido preparar todas las páginas del catálogo. Vuelve a intentarlo.")
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
    setExportError("")
    setClientExport({ active: true, phase: "preparing", page: 0, total: 0 })
    onExportingChange?.(true)

    let cleanupTimer
    const printMedia = window.matchMedia("print")
    const cleanup = () => {
      window.removeEventListener("afterprint", cleanup)
      printMedia.removeEventListener?.("change", onPrintMediaChange)
      window.clearTimeout(cleanupTimer)
      onExportingChange?.(false)
      setClientExport({ active: false, phase: null, page: 0, total: 0 })
      cancelExportRef.current = false
    }
    // En navegadores donde print() no bloquea, el fin de la impresión llega por aquí.
    const onPrintMediaChange = event => {
      if (!event.matches) cleanup()
    }

    try {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      if (cancelExportRef.current) throw new Error("EXPORT_CANCELLED")
      await waitForCatalogPages()

      await preloadCatalogImages((page, total) => {
        setClientExport({ active: true, phase: "images", page, total })
      })
      if (cancelExportRef.current) throw new Error("EXPORT_CANCELLED")

      setClientExport({ active: true, phase: "printing", page: 0, total: 0 })
      window.addEventListener("afterprint", cleanup, { once: true })
      printMedia.addEventListener?.("change", onPrintMediaChange)
      window.print()
      cleanupTimer = window.setTimeout(cleanup, CLEANUP_FALLBACK_MS)
    } catch (error) {
      if (error.message !== "EXPORT_CANCELLED") {
        setExportError(error.message)
      }
      cleanup()
    }
  }

  function exportLabel() {
    if (clientExport.phase === "canceling") return "Cancelando…"
    if (clientExport.phase === "images" && clientExport.total) {
      return `Cargando imágenes ${clientExport.page}/${clientExport.total}…`
    }
    if (clientExport.phase === "printing") return "Abriendo impresión…"
    return "Preparando…"
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
          {exportError && (
            <p className="text-xs text-destructive" role="alert">{exportError}</p>
          )}
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
                {exportLabel()}
              </>
            ) : (
              <>
                <Download /> Guardar PDF
              </>
            )}
          </Button>

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
