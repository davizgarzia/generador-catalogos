import { useEffect, useState } from "react"
import { Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useCatalog } from "../context/CatalogContext"
import { useAuth } from "../context/AuthContext"
import { createCategory, updateCompanyProfile, updateCategory } from "../lib/catalog"

const TEXT_FIELDS = [
  ["name", "Nombre de la empresa"], ["phone", "Teléfono"],
  ["whatsapp", "WhatsApp"], ["email", "Email"], ["website", "Web"],
  ["business_hours", "Horario"],
]

export default function SettingsPage() {
  const { company, loading } = useCatalog()

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando ajustes…</div>
  }

  return <SettingsForm key={company?.id ?? "company"} />
}

function SettingsForm() {
  const { company, categories, reloadMeta } = useCatalog()
  const { isAdmin } = useAuth()
  const [form, setForm] = useState(company)
  // undefined = cerrado · null = crear · objeto = editar esa categoría
  const [categoryDialog, setCategoryDialog] = useState(undefined)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setError("")
    setSaved(false)
    setSaving(true)
    try {
      await updateCompanyProfile({
        name: form.name,
        phone: form.phone,
        whatsapp: form.whatsapp,
        email: form.email,
        website: form.website,
        business_hours: form.business_hours,
      })
      await reloadMeta()
      setSaved(true)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  const disabled = !isAdmin || saving

  return (
    <div className="flex flex-col gap-6 px-4 py-4 md:gap-8 md:py-6 lg:px-6 max-w-5xl w-full">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
          <p className="text-sm text-muted-foreground">
            Datos de la empresa y categorías, compartidos por todos los catálogos.
            Las imágenes de marca viven en el repositorio, en <code>public/brand/</code>.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {saved && (
        <Alert>
          <AlertDescription>Cambios guardados.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Datos de la empresa</CardTitle>
          <CardDescription>
            Aparecen en la página de información y la contraportada de todos los catálogos.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TEXT_FIELDS.map(([field, label]) => (
            <div key={field} className="grid gap-2">
              <Label htmlFor={`cs-${field}`}>{label}</Label>
              <Input
                id={`cs-${field}`}
                value={form[field] ?? ""}
                onChange={event => setForm({ ...form, [field]: event.target.value })}
                disabled={disabled}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categorías</CardTitle>
          <CardDescription>
            Nombre visible y subtítulo por categoría, compartidos por todos los catálogos.
          </CardDescription>
          {isAdmin && (
            <CardAction>
              <Button variant="outline" size="sm" onClick={() => setCategoryDialog(null)}>
                <Plus /> Añadir
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {categories.map(category => (
            <div
              key={category.id}
              className="group relative rounded-lg border border-border bg-card p-3 pr-10"
            >
              <p className="text-sm font-medium leading-snug">{category.display_name}</p>
              <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                {category.subtitle || "Sin subtítulo"}
              </p>
              {isAdmin && (
                <button
                  type="button"
                  aria-label={`Editar ${category.display_name}`}
                  onClick={() => setCategoryDialog(category)}
                  className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4"
                >
                  <Pencil />
                </button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <CategoryDialog
        open={categoryDialog !== undefined}
        category={categoryDialog ?? null}
        onOpenChange={open => !open && setCategoryDialog(undefined)}
        reloadMeta={reloadMeta}
      />
    </div>
  )
}

function CategoryDialog({ open, category, onOpenChange, reloadMeta }) {
  const isEdit = Boolean(category)
  const [displayName, setDisplayName] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setDisplayName(category?.display_name ?? "")
    setSubtitle(category?.subtitle ?? "")
    setError("")
  }, [open, category])

  async function handleSave() {
    if (!displayName.trim()) return
    setError("")
    setSaving(true)
    try {
      if (isEdit) {
        await updateCategory(category.id, {
          display_name: displayName.trim(),
          subtitle: subtitle.trim(),
        })
      } else {
        await createCategory({ displayName, subtitle })
      }
      await reloadMeta()
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={value => !saving && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Cambia el nombre visible y el subtítulo de «${category.display_name}».`
              : "Escribe el nombre tal como aparece en la columna «Nombre de familia» del Excel (ej.: ALCOHOLES) para que las importaciones la reconozcan."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cd-name">Nombre</Label>
            <Input
              id="cd-name"
              value={displayName}
              placeholder="Ej: ALCOHOLES"
              disabled={saving}
              onChange={event => setDisplayName(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cd-subtitle">Subtítulo</Label>
            <Input
              id="cd-subtitle"
              value={subtitle}
              placeholder="Opcional"
              disabled={saving}
              onChange={event => setSubtitle(event.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={saving || !displayName.trim()} onClick={handleSave}>
            {saving ? "Guardando…" : isEdit ? "Guardar" : "Añadir categoría"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
