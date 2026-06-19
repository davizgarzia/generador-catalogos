import { useState } from "react"
import { Pencil, RotateCcw, X } from "lucide-react"
import { useEdit } from "../context/EditContext"
import { useOverrides } from "../context/OverridesContext"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import ProductFormSheet from "./ProductFormSheet"

function Field({ label, children, className = "" }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Label className="text-xs text-muted-foreground font-semibold">{label}</Label>
      {children}
    </div>
  )
}

function SliderRow({ label, value, min, max, step = 1, unit = "", onChange, onReset }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold text-foreground tabular-nums min-w-8 text-right">
            {value}{unit}
          </span>
          <button
            type="button"
            onClick={onReset}
            title="Resetear"
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
          >
            <RotateCcw className="size-3" />
          </button>
        </div>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  )
}

export default function EditSidebar() {
  const { editingProduct, setEditingProduct } = useEdit()
  const { overrides, patchOverride } = useOverrides()
  const [editFormOpen, setEditFormOpen] = useState(false)

  if (!editingProduct) return null

  const id = editingProduct.id
  const o = overrides[id] ?? {}

  const name = o.name ?? editingProduct.name
  const imgHidden = o.imgHidden ?? false
  const imgX = o.imgX ?? 0
  const imgY = o.imgY ?? 0
  const imgScale = o.imgScale ?? 1
  const imgMode = o.imgMode ?? "original"

  function patch(fields) {
    patchOverride(id, fields)
  }

  function handleToggleNobg(checked) {
    if (checked && editingProduct.processedImage) {
      patch({ imgMode: "nobg", nobgVersion: Date.now() })
    } else {
      patch({ imgMode: "original" })
    }
  }

  const imgSrc = imgMode === "nobg"
    ? (editingProduct.processedPreview || editingProduct.processedImage)
    : (editingProduct.preview || editingProduct.originalImage)
  const imgPreviewStyle = {
    width: "100%", height: "100%", objectFit: "contain",
    transform: `translate(${imgX}%, ${imgY}%) scale(${imgScale})`,
    transformOrigin: "center center",
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div>
          <div className="text-sm font-semibold text-foreground">Editar producto</div>
          <div className="text-xs text-muted-foreground mt-0.5">Ref: {id}</div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => setEditingProduct(null)}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <Field label="Imagen">
          <div
            className={`relative w-full aspect-square rounded-md border border-border bg-muted overflow-hidden flex items-center justify-center transition-opacity ${imgHidden ? "opacity-30" : ""}`}
          >
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={name}
                style={imgPreviewStyle}
                onError={event => { event.target.style.display = "none" }}
              />
            ) : (
              <span className="text-xs text-muted-foreground font-bold tracking-wider">SIN IMAGEN</span>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <Label htmlFor="es-show" className="text-xs text-muted-foreground font-medium">Mostrar imagen</Label>
            <Switch
              id="es-show"
              checked={!imgHidden}
              onCheckedChange={value => patch({ imgHidden: !value })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="es-nobg" className="text-xs text-muted-foreground font-medium">Sin fondo</Label>
            <Switch
              id="es-nobg"
              checked={imgMode === "nobg"}
              disabled={!editingProduct.processedImage}
              onCheckedChange={handleToggleNobg}
            />
          </div>
        </Field>

        <Separator />

        <Field label="Ajuste de imagen">
          <div className="flex flex-col gap-3">
            <SliderRow
              label="Horizontal" value={imgX} min={-50} max={50} step={1} unit="%"
              onChange={value => patch({ imgX: value })}
              onReset={() => patch({ imgX: 0 })}
            />
            <SliderRow
              label="Vertical" value={imgY} min={-50} max={50} step={1} unit="%"
              onChange={value => patch({ imgY: value })}
              onReset={() => patch({ imgY: 0 })}
            />
            <SliderRow
              label="Escala" value={imgScale} min={0.5} max={2} step={0.05} unit="×"
              onChange={value => patch({ imgScale: value })}
              onReset={() => patch({ imgScale: 1 })}
            />
          </div>
        </Field>

        <Separator />

        <Button
          type="button"
          variant="outline"
          onClick={() => setEditFormOpen(true)}
          className="w-full"
        >
          <Pencil className="size-4" /> Editar producto
        </Button>
      </div>

      <ProductFormSheet
        open={editFormOpen}
        onOpenChange={setEditFormOpen}
        product={editingProduct}
      />
    </>
  )
}
