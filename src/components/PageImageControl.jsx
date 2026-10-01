import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useCatalog } from "../context/CatalogContext"
import {
  deleteCatalogPageImage,
  setCatalogBackCoverImage,
  setCatalogFillerImage,
  uploadCatalogPageImage,
} from "../lib/catalog"

// A4 a 300 dpi son ~2480×3508; por debajo de esto la impresión a página
// completa pierde calidad. Es un aviso, no un bloqueo.
const MIN_PRINT_WIDTH = 2000
const MIN_PRINT_HEIGHT = 2800

// Controles de edición superpuestos a una hoja de relleno o a la contraportada:
// sustituir la imagen por una propia (subida a R2) o quitarla para volver al
// fallback de marca. Solo existen en pantalla — `print:hidden` los excluye del
// PDF, que se genera con window.print() sobre esta misma vista.
export default function PageImageControl({ kind, index = 0, currentPath }) {
  const { catalog, reloadCatalogRow } = useCatalog()
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  async function persist(path) {
    if (kind === "filler") await setCatalogFillerImage(catalog, index, path)
    else await setCatalogBackCoverImage(catalog, path)
    await reloadCatalogRow()
  }

  async function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || busy) return
    setBusy(true)
    setNotice(null)
    try {
      const bitmap = await createImageBitmap(file)
      const lowRes = bitmap.width < MIN_PRINT_WIDTH || bitmap.height < MIN_PRINT_HEIGHT
      const resolution = `${bitmap.width}×${bitmap.height}`
      bitmap.close?.()

      const path = await uploadCatalogPageImage(catalog.id, file, kind, index, currentPath)
      await persist(path)
      if (lowRes) {
        setNotice({
          tone: "warning",
          text: `La imagen (${resolution} px) es pequeña para imprimir a página completa; se recomienda al menos 2500×3500 px.`,
        })
      }
    } catch (error) {
      setNotice({ tone: "error", text: error.message })
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    if (busy) return
    setBusy(true)
    setNotice(null)
    try {
      await deleteCatalogPageImage(catalog.id, currentPath)
      await persist(null)
    } catch (error) {
      setNotice({ tone: "error", text: error.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="print:hidden absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" className="shadow" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Guardando…" : "Sustituir imagen"}
        </Button>
        {currentPath && (
          <Button size="sm" variant="outline" className="shadow" disabled={busy} onClick={handleRemove}>
            Quitar
          </Button>
        )}
      </div>
      {notice && (
        <p
          className={`max-w-72 rounded-md bg-background/95 px-2.5 py-1.5 text-right text-xs shadow ${
            notice.tone === "error" ? "text-destructive" : "text-amber-700"
          }`}
        >
          {notice.text}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}
