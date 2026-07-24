import { useEffect, useMemo, useRef, useState } from "react"
import { Download, ImageIcon, Loader2, Upload } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCatalog } from "../context/CatalogContext"
import {
  createManualProduct,
  setProductActive,
  updateProduct,
  uploadProductImage,
  withCacheBust,
} from "../lib/catalog"

const EMPTY_FORM = {
  id: "",
  article_name: "",
  display_name: "",
  stock_units: 0,
  units_per_case: "",
  category_id: "",
  active: true,
  discontinued: false,
}

export default function ProductFormSheet({ open, onOpenChange, product = null }) {
  const { catalog, categories, products, reload } = useCatalog()
  const isEdit = Boolean(product)
  const liveProduct = useMemo(() => {
    if (!product?.id) return product
    return products.find(item => item.id === product.id) ?? product
  }, [products, product])
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)
  const [imageFallbackIndex, setImageFallbackIndex] = useState(0)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setError("")
    setUploadStatus(null)
    setImageFallbackIndex(0)
    if (isEdit) {
      setForm({
        id: product.id,
        article_name: product.fullName ?? "",
        display_name: product.name ?? "",
        stock_units: product.stockUnits ?? 0,
        units_per_case: product.unitsPerCase ?? "",
        category_id: String(product.categoryId ?? categories[0]?.id ?? ""),
        active: product.active ?? true,
        discontinued: product.discontinued ?? false,
      })
    } else {
      setForm({ ...EMPTY_FORM, category_id: String(categories[0]?.id ?? "") })
    }
  }, [open, product, isEdit, categories])

  async function handleImageUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !isEdit) return
    setUploadStatus("loading")
    setError("")
    try {
      await uploadProductImage(catalog.id, product.id, file, "original")
      await reload()
      setUploadStatus("ok")
      setTimeout(() => setUploadStatus(null), 2000)
    } catch (uploadError) {
      setUploadStatus("error")
      setError(uploadError.message)
    }
  }

  async function handleDownloadOriginal() {
    if (!liveProduct?.originalImage) return
    setError("")
    try {
      const response = await fetch(liveProduct.originalImage)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const filename = new URL(liveProduct.originalImage).pathname.split("/").pop() || `${liveProduct.id}.jpg`
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = objectUrl
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (downloadError) {
      setError(`No se pudo descargar la imagen: ${downloadError.message}`)
    }
  }


  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    setError("")
    try {
      if (isEdit) {
        await updateProduct(form.id, {
          article_name: form.article_name,
          display_name: form.display_name,
          stock_units: Number(form.stock_units || 0),
          units_per_case: form.units_per_case ? Number(form.units_per_case) : null,
          category_id: Number(form.category_id),
          discontinued: form.discontinued,
        })
        await setProductActive(catalog.id, form.id, form.active)
      } else {
        await createManualProduct(catalog.id, {
          id: form.id.trim(),
          articleName: form.article_name.trim(),
          displayName: form.display_name.trim(),
          stockUnits: Number(form.stock_units || 0),
          unitsPerCase: form.units_per_case ? Number(form.units_per_case) : null,
          categoryId: Number(form.category_id),
          sortOrder: 0,
        })
      }
      await reload()
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  const imageCandidates = [
    liveProduct?.processedPreview,
    liveProduct?.processedPreviewFallback,
    liveProduct?.preview,
    liveProduct?.previewFallback,
    liveProduct?.processedImage,
    liveProduct?.originalImage,
  ].filter(Boolean)
  const imagePreviewSrc = imageCandidates[imageFallbackIndex]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[440px] sm:max-w-[440px] flex flex-col p-0">
        <SheetHeader className="p-6 pb-2">
          <SheetTitle>{isEdit ? "Editar producto" : "Nuevo producto"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? `Cambios en ${product.id}. Los textos se aplicarán inmediatamente al catálogo.`
              : "Crea un producto manual. La referencia debe ser única."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 pb-6 flex flex-col gap-4">
          {isEdit && (
            <div className="grid gap-2">
              <Label>Imagen</Label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadStatus === "loading"}
                className="group relative aspect-square w-full overflow-hidden rounded-md border border-border bg-muted flex items-center justify-center transition-opacity disabled:opacity-60"
              >
                {imagePreviewSrc ? (
                  <img
                    src={withCacheBust(imagePreviewSrc, liveProduct.imageVersion || liveProduct.nobgVersion)}
                    data-thumb-src={liveProduct.processedThumb || liveProduct.thumb || undefined}
                    alt={liveProduct.name}
                    className="size-full object-contain"
                    onError={() => {
                      if (imageFallbackIndex < imageCandidates.length - 1) {
                        setImageFallbackIndex(value => value + 1)
                      }
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <ImageIcon className="size-6" />
                    <span className="text-xs">Sin imagen</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white">
                  {uploadStatus === "loading" ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <>
                      <Upload className="size-5" />
                      <span className="text-xs font-medium">
                        {liveProduct?.image ? "Reemplazar" : "Subir imagen"}
                      </span>
                    </>
                  )}
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              {uploadStatus === "ok" && (
                <p className="text-xs text-emerald-600">Imagen guardada.</p>
              )}
              {uploadStatus === "error" && (
                <p className="text-xs text-destructive">No se pudo subir la imagen.</p>
              )}
              {liveProduct?.originalImage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadOriginal}
                  className="w-full"
                >
                  <Download /> Descargar imagen original
                </Button>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="pf-id">Referencia</Label>
            <Input
              id="pf-id"
              required
              disabled={isEdit}
              value={form.id}
              onChange={event => setForm({ ...form, id: event.target.value })}
              placeholder="Ej: IP12050"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pf-article">Nombre original</Label>
            <Input
              id="pf-article"
              required
              value={form.article_name}
              onChange={event => setForm({ ...form, article_name: event.target.value })}
              placeholder="Tal cual viene del Excel"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pf-display">Nombre visible</Label>
            <Input
              id="pf-display"
              required
              value={form.display_name}
              onChange={event => setForm({ ...form, display_name: event.target.value })}
              placeholder="El que aparece en la card del catálogo"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pf-category">Categoría</Label>
            <Select
              value={form.category_id}
              onValueChange={value => setForm({ ...form, category_id: value })}
            >
              <SelectTrigger id="pf-category">
                <SelectValue placeholder="Selecciona categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="pf-stock">Stock</Label>
              <Input
                id="pf-stock"
                type="number"
                step="0.001"
                value={form.stock_units}
                onChange={event => setForm({ ...form, stock_units: event.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pf-upc">Uds./caja</Label>
              <Input
                id="pf-upc"
                type="number"
                min="1"
                value={form.units_per_case ?? ""}
                onChange={event => setForm({ ...form, units_per_case: event.target.value })}
              />
            </div>
          </div>

          {isEdit && (
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <ToggleField
                id="pf-active"
                label="Incluido en el catálogo"
                description="Si lo desactivas, no aparecerá en la vista pública del catálogo."
                checked={form.active}
                onChange={value => setForm({ ...form, active: value })}
              />
              <ToggleField
                id="pf-disc"
                label="Producto de baja"
                description="Marca el producto como dado de baja en el sistema."
                checked={form.discontinued}
                onChange={value => setForm({ ...form, discontinued: value })}
              />
            </div>
          )}

          {error && <p className="text-destructive text-xs">{error}</p>}
        </form>

        <SheetFooter className="flex-row gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function ToggleField({ id, label, description, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground leading-snug">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5 shrink-0" />
    </div>
  )
}
