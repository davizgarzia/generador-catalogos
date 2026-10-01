import { useRef, useState } from "react"
import { Upload, X } from "lucide-react"
import { useEdit } from "../context/EditContext"
import { useCatalog } from "../context/CatalogContext"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  deleteCatalogPageImage,
  setCatalogBackCoverImage,
  setCatalogCoverImage,
  setCatalogFillerImage,
  uploadCatalogPageImage,
} from "../lib/catalog"

// A4 a 300 dpi son ~2480×3508; por debajo de esto la impresión a página
// completa pierde calidad. Es un aviso, no un bloqueo.
const MIN_PRINT_WIDTH = 2000
const MIN_PRINT_HEIGHT = 2800

const KIND_LABELS = {
  cover: "Portada",
  filler: "Hoja de imagen",
  backcover: "Contraportada",
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground font-semibold">{label}</Label>
      {children}
    </div>
  )
}

// Sidebar de edición de las páginas especiales del catálogo (portada, hojas de
// relleno y contraportada): sustituir la imagen por una propia subida a R2 o
// quitarla para volver al diseño por defecto.
export default function PageEditSidebar() {
  const { editingPage, setEditingPage } = useEdit()
  const { catalog, reloadCatalogRow } = useCatalog()
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  if (!editingPage) return null

  const { kind, index = 0 } = editingPage
  const currentPath =
    kind === "cover" ? catalog.coverImagePath
    : kind === "backcover" ? catalog.backCoverImagePath
    : catalog.fillerImagePaths?.[index] ?? null
  const currentImage =
    kind === "cover" ? (currentPath ? catalog.coverImage : null)
    : kind === "backcover" ? catalog.backCoverImage
    : catalog.fillerImages?.[index] ?? null

  async function persist(path) {
    if (kind === "cover") await setCatalogCoverImage(catalog, path)
    else if (kind === "backcover") await setCatalogBackCoverImage(catalog, path)
    else await setCatalogFillerImage(catalog, index, path)
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
    if (busy || !currentPath) return
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
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div>
          <div className="text-sm font-semibold text-foreground">
            Editar {KIND_LABELS[kind].toLowerCase()}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {kind === "filler" ? `Hoja ${index + 1} de la versión impresa` : catalog.name}
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => setEditingPage(null)}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <Field label="Imagen">
          <div className="relative w-full aspect-[210/297] rounded-md border border-border bg-muted overflow-hidden flex items-center justify-center">
            {currentImage ? (
              <img src={currentImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-muted-foreground font-bold tracking-wider text-center px-4">
                DISEÑO POR DEFECTO
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {currentPath
              ? "Imagen propia a página completa."
              : "Se está usando el diseño por defecto de la marca."}
          </p>
        </Field>

        <Separator />

        <div className="flex flex-col gap-2">
          <Button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="w-full">
            <Upload className="size-4" /> {busy ? "Guardando…" : "Subir imagen"}
          </Button>
          {currentPath && (
            <Button type="button" variant="outline" disabled={busy} onClick={handleRemove} className="w-full">
              Quitar y volver al diseño por defecto
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Para imprimir a página completa se recomienda una imagen de al menos 2500×3500 px
            (JPG, PNG o WebP, máx. 20 MB).
          </p>
        </div>

        {notice && (
          <p className={`text-xs ${notice.tone === "error" ? "text-destructive" : "text-amber-700"}`}>
            {notice.text}
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />
    </>
  )
}
