import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useCatalog } from "../context/CatalogContext"
import { useAuth } from "../context/AuthContext"
import { updateCatalog, updateCategory } from "../lib/catalog"

const TEXT_FIELDS = [
  ["name", "Nombre"], ["edition", "Edición"], ["phone", "Teléfono"],
  ["whatsapp", "WhatsApp"], ["email", "Email"], ["website", "Web"],
  ["business_hours", "Horario"],
]

export default function SettingsPage() {
  const { catalog, loading } = useCatalog()

  if (loading || !catalog) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando ajustes…</div>
  }

  return <SettingsForm key={catalog.id} />
}

function SettingsForm() {
  const { catalog, categories, reloadCatalogInfo } = useCatalog()
  const { isAdmin } = useAuth()
  const [form, setForm] = useState(catalog)
  const [categoryRows, setCategoryRows] = useState(categories)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setError("")
    setSaved(false)
    setSaving(true)
    try {
      await updateCatalog(catalog.id, {
        name: form.name,
        edition: form.edition,
        phone: form.phone,
        whatsapp: form.whatsapp,
        email: form.email,
        website: form.website,
        business_hours: form.business_hours,
      })
      await Promise.all(categoryRows.map(category => updateCategory(category.id, {
        display_name: category.display_name,
        subtitle: category.subtitle,
      })))
      await reloadCatalogInfo()
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
            Datos comerciales y categorías del catálogo. Las imágenes de marca
            (portada, logos, portadas de categoría) viven en el repositorio,
            en <code>public/brand/</code>.
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
          <CardTitle>Datos comerciales</CardTitle>
          <CardDescription>Aparecen en la página de información y la contraportada del catálogo.</CardDescription>
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
          <CardDescription>Nombre visible y subtítulo por categoría.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {categoryRows.map((category, index) => (
            <div key={category.id} className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-2 items-center rounded-lg border border-border bg-card p-2">
              <Input
                value={category.display_name}
                aria-label={`Nombre de ${category.code}`}
                disabled={disabled}
                onChange={event => {
                  const next = [...categoryRows]
                  next[index] = { ...category, display_name: event.target.value }
                  setCategoryRows(next)
                }}
              />
              <Input
                value={category.subtitle ?? ""}
                placeholder="Subtítulo"
                aria-label={`Subtítulo de ${category.code}`}
                disabled={disabled}
                onChange={event => {
                  const next = [...categoryRows]
                  next[index] = { ...category, subtitle: event.target.value }
                  setCategoryRows(next)
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
