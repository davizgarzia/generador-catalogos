import { useState } from "react"
import { Check, ChevronDown, Download, Loader2, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { usePrint } from "../context/PrintContext"
import ViewControlsSheet from "./ViewControlsSheet"

const QUALITY_PRESETS = {
  low:    { label: "Rápida", scale: 1,    jpegQuality: 0.6  },
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
  const [quality, setQuality] = useState("medium")
  const [viewOpen, setViewOpen] = useState(false)
  const [clientExport, setClientExport] = useState({ active: false, phase: null, page: 0, total: 0 })

  async function preloadCatalogImages(onProgress) {
    const imgs = Array.from(document.querySelectorAll("#catalog img"))
    const total = imgs.length
    if (!total) return
    onProgress(0, total)
    let loaded = 0
    await Promise.all(imgs.map(async img => {
      try {
        const printSrc = img.dataset.printSrc
        if (printSrc && img.src !== printSrc) img.src = printSrc
        img.loading = "eager"
        if (!img.complete || img.naturalHeight === 0) {
          await img.decode()
        }
      } catch {
        // ignoramos fallos puntuales, seguimos
      }
      loaded += 1
      onProgress(loaded, total)
    }))
  }

  async function handleClientPdf() {
    if (clientExport.active) return
    setClientExport({ active: true, phase: "preparing", page: 0, total: 0 })
    onExportingChange?.(true)
    try {
      const preset = QUALITY_PRESETS[quality]
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

      await preloadCatalogImages((page, total) => {
        setClientExport({ active: true, phase: "preparing", page, total })
      })

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
        setClientExport({ active: true, phase: "capturing", page: i + 1, total: pages.length })
        const imgData = await domToJpeg(pages[i], {
          scale: preset.scale,
          quality: preset.jpegQuality,
          backgroundColor: "#ffffff",
        })
        if (i > 0) pdf.addPage(printMode ? [widthMm, heightMm] : "a4", "portrait")
        pdf.addImage(imgData, "JPEG", 0, 0, widthMm, heightMm, undefined, "FAST")
      }

      pdf.save(`catalogo-${catalog.slug}-${catalog.edition}.pdf`)
    } catch (error) {
      alert(`Error generando PDF: ${error.message}`)
    } finally {
      onExportingChange?.(false)
      setClientExport({ active: false, phase: null, page: 0, total: 0 })
    }
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4 px-4 py-4 md:py-6 lg:px-6 border-b border-border bg-background">
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
          <div className="inline-flex items-stretch">
            <Button
              onClick={handleClientPdf}
              disabled={clientExport.active}
              className="min-w-[160px] rounded-r-none border-r border-r-primary-foreground/20"
            >
              {clientExport.active ? (
                <>
                  <Loader2 className="animate-spin" />
                  {clientExport.phase === "preparing"
                    ? clientExport.total
                      ? `Preparando ${clientExport.page}/${clientExport.total}`
                      : "Preparando…"
                    : clientExport.total
                      ? `${clientExport.page}/${clientExport.total}`
                      : "Generando…"}
                </>
              ) : (
                <>
                  <Download /> Descargar PDF
                </>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                disabled={clientExport.active}
                title="Calidad del PDF"
                aria-label="Calidad del PDF"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md rounded-l-none bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4 [&_svg]:shrink-0"
              >
                <ChevronDown />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Calidad del PDF</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
                  <DropdownMenuItem
                    key={key}
                    onSelect={() => setQuality(key)}
                    className="gap-2"
                  >
                    <Check className={cn("size-4", quality === key ? "opacity-100" : "opacity-0")} />
                    <span>{preset.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

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
