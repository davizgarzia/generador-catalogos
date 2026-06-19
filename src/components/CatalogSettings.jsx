import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useCatalog } from "../context/CatalogContext"
import { setCatalogCoverProducts, updateCatalog, updateCategory, uploadCatalogAsset } from "../lib/catalog"

const inputStyle = { width: "100%", padding: 7, border: "1px solid #ddd", borderRadius: 6, fontSize: 12 }

export default function CatalogSettings({ open, onClose }) {
  const { catalog, categories, coverProducts, reload } = useCatalog()
  const [form, setForm] = useState(catalog)
  const [categoryRows, setCategoryRows] = useState(categories)
  const [mosaicIds, setMosaicIds] = useState(coverProducts.map(product => product.id).join(", "))
  const [error, setError] = useState("")

  if (!open) return null

  async function save() {
    setError("")
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
      onClose()
    } catch (saveError) {
      setError(saveError.message)
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

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center" }}>
      <div style={{ width: 760, maxHeight: "86vh", overflow: "auto", background: "#fff", borderRadius: 12, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>Configuración del catálogo</h2>
        {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            ["name", "Nombre"], ["edition", "Edición"], ["tagline", "Tagline"], ["phone", "Teléfono"],
            ["whatsapp", "WhatsApp"], ["email", "Email"], ["website", "Web"],
            ["minimum_order", "Pedido mínimo"], ["business_hours", "Horario"],
          ].map(([field, label]) => (
            <label key={field} style={{ fontSize: 12 }}>{label}
              <input value={form[field] ?? ""} onChange={event => setForm({ ...form, [field]: event.target.value })} style={inputStyle} />
            </label>
          ))}
          <label style={{ fontSize: 12 }}>Portada
            <input type="file" accept="image/*" onChange={event => uploadCover(event.target.files?.[0])} />
          </label>
          <label style={{ fontSize: 12 }}>Logo
            <input type="file" accept="image/*" onChange={event => uploadCatalogImage(event.target.files?.[0], "logo_path", "logo")} />
          </label>
          <label style={{ fontSize: 12 }}>Logo blanco
            <input type="file" accept="image/*" onChange={event => uploadCatalogImage(event.target.files?.[0], "logo_white_path", "logo-white")} />
          </label>
          <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>Mosaico de portada (referencias separadas por coma)
            <input value={mosaicIds} onChange={event => setMosaicIds(event.target.value)} style={inputStyle} />
          </label>
        </div>
        <h3>Categorías</h3>
        {categoryRows.map((category, index) => (
          <div key={category.id} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 55px 55px 120px", gap: 8, marginBottom: 8 }}>
            <input value={category.display_name} onChange={event => {
              const next = [...categoryRows]; next[index] = { ...category, display_name: event.target.value }; setCategoryRows(next)
            }} style={inputStyle} />
            <input value={category.subtitle} onChange={event => {
              const next = [...categoryRows]; next[index] = { ...category, subtitle: event.target.value }; setCategoryRows(next)
            }} style={inputStyle} />
            <input type="color" value={category.background_color} onChange={event => {
              const next = [...categoryRows]; next[index] = { ...category, background_color: event.target.value }; setCategoryRows(next)
            }} />
            <input type="color" value={category.accent_color} onChange={event => {
              const next = [...categoryRows]; next[index] = { ...category, accent_color: event.target.value }; setCategoryRows(next)
            }} />
            <input type="file" accept="image/*" onChange={event => uploadCategoryCover(category, event.target.files?.[0])} style={{ fontSize: 10 }} />
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Guardar</Button>
        </div>
      </div>
    </div>
  )
}
