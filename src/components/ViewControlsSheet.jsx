import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { usePrint } from "../context/PrintContext"

export default function ViewControlsSheet({ open, onOpenChange }) {
  const {
    printMode, setPrintMode,
    printSize, setPrintSize,
    productGrid, setProductGrid,
    hideNoImage, setHideNoImage,
  } = usePrint()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 flex flex-col gap-4 p-6">
        <SheetHeader className="p-0">
          <SheetTitle>Opciones de vista</SheetTitle>
          <SheetDescription>
            Cambia cómo se previsualiza y se exporta el catálogo.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4">
          <ToggleRow
            id="vw-marks"
            label="Marcas de corte"
            description="Añade sangre 3 mm y marcas. La hoja exportada será 216×303 mm."
            checked={printMode}
            onChange={setPrintMode}
          />
          <ToggleRow
            id="vw-hide"
            label="Ocultar productos sin imagen"
            description="Quita las referencias sin foto del catálogo."
            checked={hideNoImage}
            onChange={setHideNoImage}
          />
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground font-medium">Referencias por hoja</Label>
          <div className="flex gap-1.5">
            {["3x3", "4x3", "4x4"].map(value => (
              <Button
                key={value}
                size="sm"
                variant={productGrid === value ? "default" : "outline"}
                onClick={() => setProductGrid(value)}
                className="flex-1"
              >
                {value.replace("x", "×")}
              </Button>
            ))}
          </div>
        </div>

        {printMode && (
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground font-medium">Tamaño con marcas</Label>
            <div className="flex gap-1.5">
              {["A4", "A5"].map(value => (
                <Button
                  key={value}
                  size="sm"
                  variant={printSize === value ? "default" : "outline"}
                  onClick={() => setPrintSize(value)}
                  className="flex-1"
                >
                  {value}
                </Button>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function ToggleRow({ id, label, description, checked, onChange }) {
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
