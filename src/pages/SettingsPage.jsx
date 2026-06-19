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
import {
  setCatalogCoverProducts,
  updateCatalog,
  updateCategory,
  uploadCatalogAsset,
} from "../lib/catalog"

const TEXT_FIELDS = [
  ["name", "Nombre"], ["edition", "Edición"], ["tagline", "Tagline"], ["phone", "Teléfono"],
  ["whatsapp", "WhatsApp"], ["email", "Email"], ["website", "Web"],
  ["minimum_order", "Pedido mínimo"], ["business_hours", "Horario"],
]

export default function SettingsPage() {
  const { catalog, categories, coverProducts, reload, loading } = useCatalog()
  const { isAdmin } = useAuth()
  const [form, setForm] = useState(catalog)
  const [categoryRows, setCategoryRows] = useState(categories)
  const [mosaicIds, setMosaicIds] = useState(coverProducts.map(product => product.id).join(", "))
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  if (loading || !catalog) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando ajustes…</div>
  }

  if (!form) {
    setForm(catalog)
    return null
  }

  async function save() {
    setError("")
    setSaved(false)
    setSaving(true)
    try {
      await updateCatalog(catalog.id, {
        name: form.name,
        edition: form.edition,
        tagline: form.tagline,
        phone: form.phone,
        whatsapp: form.whatsapp,
        email: form.email,
        website: form.website,
        minimum_order: form.minimum_order,
        business_hours: form.business_hours,
      })
      await Promise.all(categoryRows.map(category => updateCategory(category.id, {
        display_name: category.display_name,
        subtitle: category.subtitle,
        background_color: category.background_color,
        accent_color: category.accent_color,
      })))
      await setCatalogCoverProducts(
        catalog.id,
        mosaicIds.split(",").map(value => value.trim()).filter(Boolean)
      )
      await reload()
      setSaved(true)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function uploadCover(file) {
    if (!file) return
    try {
      const extension = file.name.split(".").pop()
      const path = `assets/cover.${extension}`
      await uploadCatalogAsset(file, path)
      await updateCatalog(catalog.id, { cover_image_path: path })
      await reload()
    } catch (uploadError) {
      setError(uploadError.message)
    }
  }

  async function uploadCatalogImage(file, field, filename) {
    if (!file) return
    try {
      const extension = file.name.split(".").pop()
      const path = `assets/${filename}.${extension}`
      await uploadCatalogAsset(file, path)
      await updateCatalog(catalog.id, { [field]: path })
      await reload()
    } catch (uploadError) {
      setError(uploadError.message)
    }
  }

  async function uploadCategoryCover(category, file) {
    if (!file) return
    try {
      const extension = file.name.split(".").pop()
      const path = `category-covers/${category.code}.${extension}`
      await uploadCatalogAsset(file, path)
      await updateCategory(category.id, { cover_image_path: path })
      await reload()
    } catch (uploadError) {
      setError(uploadError.message)
    }
  }

  const disabled = !isAdmin || saving

  return (
    <div className="flex flex-col gap-6 px-4 py-4 md:gap-8 md:py-6 lg:px-6 max-w-5xl w-full">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
          <p className="text-sm text-muted-foreground">
            Datos comerciales, activos visuales y categorías que componen el catálogo.
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
          <CardDescription>Aparecen en la página de información del catálogo.</CardDescription>
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
          <CardTitle>Activos de imagen</CardTitle>
          <CardDescription>Portada del catálogo y logotipos.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FileField id="cs-cover" label="Portada" onChange={uploadCover} disabled={disabled} />
          <FileField id="cs-logo" label="Logo" onChange={file => uploadCatalogImage(file, "logo_path", "logo")} disabled={disabled} />
          <FileField id="cs-logo-white" label="Logo blanco" onChange={file => uploadCatalogImage(file, "logo_white_path", "logo-white")} disabled={disabled} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mosaico de portada</CardTitle>
          <CardDescription>Referencias separadas por coma, en el orden en que aparecen.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            id="cs-mosaic"
            value={mosaicIds}
            onChange={event => setMosaicIds(event.target.value)}
            disabled={disabled}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categorías</CardTitle>
          <CardDescription>Nombre visible, subtítulo, colores y portada por categoría.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {categoryRows.map((category, index) => (
            <div key={category.id} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_56px_56px_140px] gap-2 items-center rounded-lg border border-border bg-card p-2">
              <Input
                value={category.display_name}
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
                disabled={disabled}
                onChange={event => {
                  const next = [...categoryRows]
                  next[index] = { ...category, subtitle: event.target.value }
                  setCategoryRows(next)
                }}
              />
              <Input
                type="color"
                value={category.background_color}
                className="h-9 p-1"
                disabled={disabled}
                onChange={event => {
                  const next = [...categoryRows]
                  next[index] = { ...category, background_color: event.target.value }
                  setCategoryRows(next)
                }}
              />
              <Input
                type="color"
                value={category.accent_color}
                className="h-9 p-1"
                disabled={disabled}
                onChange={event => {
                  const next = [...categoryRows]
                  next[index] = { ...category, accent_color: event.target.value }
                  setCategoryRows(next)
                }}
              />
              <Input
                type="file"
                accept="image/*"
                className="text-xs"
                disabled={disabled}
                onChange={event => uploadCategoryCover(category, event.target.files?.[0])}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function FileField({ id, label, onChange, disabled }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="file"
        accept="image/*"
        onChange={event => onChange(event.target.files?.[0])}
        disabled={disabled}
      />
    </div>
  )
}
