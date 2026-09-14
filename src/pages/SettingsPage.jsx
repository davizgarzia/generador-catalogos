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
import { updateCompanyProfile, updateCategory } from "../lib/catalog"

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
  const [categoryRows, setCategoryRows] = useState(categories)
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
      await Promise.all(categoryRows.map(category => updateCategory(category.id, {
        display_name: category.display_name,
        subtitle: category.subtitle,
      })))
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
