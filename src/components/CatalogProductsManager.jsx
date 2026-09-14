import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronRight, Loader2, Search } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { addProductsToCatalog, removeProductsFromCatalog } from "../lib/catalog"
import { useCatalog } from "../context/CatalogContext"

// Gestiona qué productos del maestro componen el catálogo abierto.
export default function CatalogProductsManager({ open, onOpenChange }) {
  const { products, categories, catalog, catalogItems, reloadCatalogItems } = useCatalog()
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(() => new Set())
  const [openGroups, setOpenGroups] = useState(() => new Set())
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const initialIds = useMemo(
    () => new Set(catalogItems.map(item => item.id)),
    [catalogItems]
  )

  useEffect(() => {
    if (open) {
      setSelected(new Set(initialIds))
      setQuery("")
      setError("")
    }
  }, [open, initialIds])

  const searching = Boolean(query.trim())
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter(product =>
      `${product.id} ${product.name}`.toLowerCase().includes(q)
    )
  }, [products, query])

  // Grupos por categoría, en el orden del catálogo.
  const groups = useMemo(() => {
    const byCategory = new Map()
    for (const product of filtered) {
      const key = product.category ?? "Sin categoría"
      if (!byCategory.has(key)) byCategory.set(key, [])
      byCategory.get(key).push(product)
    }
    const ordered = []
    for (const category of categories) {
      const items = byCategory.get(category.display_name)
      if (items?.length) {
        ordered.push({ key: category.display_name, label: category.display_name, items })
        byCategory.delete(category.display_name)
      }
    }
    for (const [key, items] of byCategory) {
      ordered.push({ key, label: key, items })
    }
    return ordered
  }, [filtered, categories])

  const additions = [...selected].filter(id => !initialIds.has(id))
  const removals = [...initialIds].filter(id => !selected.has(id))
  const dirty = additions.length > 0 || removals.length > 0

  function toggle(id, value) {
    setSelected(prev => {
      const next = new Set(prev)
      if (value) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleMany(items, value) {
    setSelected(prev => {
      const next = new Set(prev)
      items.forEach(item => (value ? next.add(item.id) : next.delete(item.id)))
      return next
    })
  }

  function checkboxState(items) {
    const selectedCount = items.reduce((count, item) => count + (selected.has(item.id) ? 1 : 0), 0)
    if (selectedCount === 0) return { checked: false, count: 0 }
    if (selectedCount === items.length) return { checked: true, count: selectedCount }
    return { checked: "indeterminate", count: selectedCount }
  }

  async function save() {
    setSaving(true)
    setError("")
    try {
      await addProductsToCatalog(catalog.id, additions)
      await removeProductsFromCatalog(catalog.id, removals)
      await reloadCatalogItems()
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={value => !saving && onOpenChange(value)}>
      <DialogContent className="sm:max-w-2xl flex flex-col max-h-[85svh]">
        <DialogHeader>
          <DialogTitle>Productos del catálogo</DialogTitle>
          <DialogDescription>
            Marca los productos que forman parte de este catálogo. Si falta alguno,
            impórtalo primero en la sección{" "}
            <Link to="/products" className="underline underline-offset-2 hover:text-foreground">
              Productos
            </Link>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar referencia o nombre…"
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-border">
          {filtered.length > 0 && (
            <label className="flex cursor-pointer items-center gap-3 border-b border-border bg-muted/40 px-3 py-2 text-sm font-medium hover:bg-muted/60">
              <Checkbox
                checked={checkboxState(filtered).checked}
                onCheckedChange={value => toggleMany(filtered, Boolean(value))}
              />
              <span className="flex-1">
                {searching ? "Seleccionar los resultados" : "Seleccionar todo"}
              </span>
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                {checkboxState(filtered).count}/{filtered.length}
              </span>
            </label>
          )}

          {groups.map(group => {
            const state = checkboxState(group.items)
            const isOpen = searching || openGroups.has(group.key)
            return (
              <Collapsible
                key={group.key}
                open={isOpen}
                onOpenChange={value => {
                  setOpenGroups(prev => {
                    const next = new Set(prev)
                    if (value) next.add(group.key)
                    else next.delete(group.key)
                    return next
                  })
                }}
              >
                <div className="flex items-center gap-3 border-b border-border px-3 py-2 hover:bg-accent/40">
                  <Checkbox
                    checked={state.checked}
                    aria-label={`Seleccionar ${group.label}`}
                    onCheckedChange={value => toggleMany(group.items, Boolean(value))}
                  />
                  <CollapsibleTrigger className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{group.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {state.count}/{group.items.length}
                    </span>
                    <ChevronRight
                      className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")}
                    />
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent>
                  {group.items.map(product => (
                    <label
                      key={product.id}
                      className="flex cursor-pointer items-center gap-3 border-b border-border py-2 pl-8 pr-3 hover:bg-accent/40"
                    >
                      <Checkbox
                        checked={selected.has(product.id)}
                        onCheckedChange={value => toggle(product.id, Boolean(value))}
                      />
                      {product.thumb || product.originalImage ? (
                        <img
                          src={product.thumb || product.originalImage}
                          alt=""
                          className="size-8 shrink-0 rounded object-contain bg-muted"
                          loading="lazy"
                        />
                      ) : (
                        <div className="size-8 shrink-0 rounded bg-muted" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{product.name}</span>
                        <span className="block truncate text-xs text-muted-foreground font-mono">
                          {product.id}
                        </span>
                      </span>
                      {product.discontinued && <Badge variant="destructive">De baja</Badge>}
                    </label>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )
          })}

          {!filtered.length && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Ningún producto coincide con la búsqueda.
            </p>
          )}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-sm text-muted-foreground tabular-nums">
            {selected.size} seleccionados
            {dirty && ` · +${additions.length} / −${removals.length}`}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={saving || !dirty} onClick={save}>
              {saving ? (
                <>
                  <Loader2 className="animate-spin" /> Guardando…
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
