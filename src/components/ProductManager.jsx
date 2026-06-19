import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { useCatalog } from "../context/CatalogContext"
import { createManualProduct, setProductActive, updateProduct } from "../lib/catalog"
import { supabase } from "../lib/supabase"

const inputStyle = { width: "100%", padding: 7, border: "1px solid #ddd", borderRadius: 6, fontSize: 12 }

export default function ProductManager({ open, onClose }) {
  const { catalog, categories, products, reload } = useCatalog()
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    supabase.from("catalog_products")
      .select("active,sort_order,product:products(id,article_name,display_name,stock_units,units_per_case,category_id,source_type,discontinued)")
      .eq("catalog_id", catalog.id)
      .order("sort_order")
      .then(({ data, error: loadError }) => {
        if (loadError) setError(loadError.message)
        else setRows(data.map(row => ({ ...row.product, active: row.active, sortOrder: row.sort_order })))
      })
  }, [catalog?.id, open, products])

  const filtered = useMemo(() => rows.filter(row =>
    `${row.id} ${row.display_name}`.toLowerCase().includes(query.toLowerCase())
  ), [query, rows])

  if (!open) return null

  async function save(event) {
    event.preventDefault()
    setError("")
    try {
      if (editing.isNew) {
        await createManualProduct(catalog.id, {
          id: editing.id.trim(),
          articleName: editing.article_name.trim(),
          displayName: editing.display_name.trim(),
          stockUnits: Number(editing.stock_units || 0),
          unitsPerCase: editing.units_per_case ? Number(editing.units_per_case) : null,
          categoryId: Number(editing.category_id),
          sortOrder: rows.length,
        })
      } else {
        await updateProduct(editing.id, {
          article_name: editing.article_name,
          display_name: editing.display_name,
          stock_units: Number(editing.stock_units || 0),
          units_per_case: editing.units_per_case ? Number(editing.units_per_case) : null,
          category_id: Number(editing.category_id),
          discontinued: editing.discontinued,
        })
        await setProductActive(catalog.id, editing.id, editing.active)
      }
      await reload()
      setEditing(null)
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center" }}>
      <div style={{ width: 850, maxHeight: "86vh", overflow: "auto", background: "#fff", borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0, flex: 1 }}>Productos</h2>
          <Button onClick={() => setEditing({
            isNew: true, id: "", article_name: "", display_name: "", stock_units: 0,
            units_per_case: "", category_id: categories[0]?.id, active: true, discontinued: false,
          })}>Nuevo producto</Button>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </div>
        <input placeholder="Buscar referencia o nombre…" value={query} onChange={event => setQuery(event.target.value)}
          style={{ ...inputStyle, margin: "14px 0" }} />
        {error && <p style={{ color: "#b91c1c", fontSize: 12 }}>{error}</p>}

        {editing ? (
          <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <label>Referencia<input required disabled={!editing.isNew} value={editing.id}
              onChange={event => setEditing({ ...editing, id: event.target.value })} style={inputStyle} /></label>
            <label>Nombre original<input required value={editing.article_name}
              onChange={event => setEditing({ ...editing, article_name: event.target.value })} style={inputStyle} /></label>
            <label>Nombre visible<input required value={editing.display_name}
              onChange={event => setEditing({ ...editing, display_name: event.target.value })} style={inputStyle} /></label>
            <label>Categoría<select value={editing.category_id}
              onChange={event => setEditing({ ...editing, category_id: event.target.value })} style={inputStyle}>
              {categories.map(category => <option key={category.id} value={category.id}>{category.display_name}</option>)}
            </select></label>
            <label>Stock<input type="number" step=".001" value={editing.stock_units}
              onChange={event => setEditing({ ...editing, stock_units: event.target.value })} style={inputStyle} /></label>
            <label>Unidades por caja<input type="number" min="1" value={editing.units_per_case ?? ""}
              onChange={event => setEditing({ ...editing, units_per_case: event.target.value })} style={inputStyle} /></label>
            {!editing.isNew && (
              <>
                <label><input type="checkbox" checked={editing.active}
                  onChange={event => setEditing({ ...editing, active: event.target.checked })} /> Incluido en catálogo</label>
                <label><input type="checkbox" checked={editing.discontinued}
                  onChange={event => setEditing({ ...editing, discontinued: event.target.checked })} /> Producto de baja</label>
              </>
            )}
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        ) : (
          <div>
            {filtered.map(row => (
              <button key={row.id} onClick={() => setEditing({ ...row, isNew: false })}
                style={{ width: "100%", display: "flex", gap: 10, textAlign: "left", padding: 9, border: 0, borderBottom: "1px solid #eee", background: "#fff", cursor: "pointer" }}>
                <code style={{ width: 80 }}>{row.id}</code>
                <span style={{ flex: 1 }}>{row.display_name}</span>
                <span style={{ color: row.active ? "#15803d" : "#9ca3af" }}>{row.active ? "Activo" : "Fuera"}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
