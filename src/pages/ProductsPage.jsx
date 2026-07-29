import { useMemo, useState } from "react"
import { Filter, Plus, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useCatalog } from "../context/CatalogContext"
import { useAuth } from "../context/AuthContext"
import ProductsTable from "../components/ProductsTable"
import ProductFormSheet from "../components/ProductFormSheet"
import ImportExcelButton from "../components/ImportExcelButton"
import ImportImagesButton from "../components/ImportImagesButton"
import { deleteProduct } from "../lib/catalog"

const ANY = "all"

const STATUS_OPTIONS = [
  { value: ANY, label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
  { value: "discontinued", label: "De baja" },
]

const SOURCE_OPTIONS = [
  { value: ANY, label: "Cualquiera" },
  { value: "excel", label: "Excel" },
  { value: "manual", label: "Manual" },
]

export default function ProductsPage() {
  const { catalog, categories, products, loading, reload } = useCatalog()
  const { isAdmin } = useAuth()
  const [query, setQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState(ANY)
  const [statusFilter, setStatusFilter] = useState(ANY)
  const [sourceFilter, setSourceFilter] = useState(ANY)
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [deleteError, setDeleteError] = useState("")
  const [deletePending, setDeletePending] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter(product => {
      if (q && !`${product.id} ${product.name}`.toLowerCase().includes(q)) return false
      if (categoryFilter !== ANY && product.category !== categoryFilter) return false
      if (sourceFilter !== ANY && product.sourceType !== sourceFilter) return false
      if (statusFilter !== ANY) {
        if (statusFilter === "active" && !product.active) return false
        if (statusFilter === "inactive" && product.active) return false
        if (statusFilter === "discontinued" && !product.discontinued) return false
      }
      return true
    })
  }, [products, query, categoryFilter, statusFilter, sourceFilter])

  const activeFilters = [statusFilter, categoryFilter, sourceFilter].filter(value => value !== ANY).length
  const hasActiveFilters = activeFilters > 0

  function clearFilters() {
    setStatusFilter(ANY)
    setCategoryFilter(ANY)
    setSourceFilter(ANY)
  }

  async function handleDeleteProduct() {
    if (!catalog?.id || !deleting?.id) return
    setDeletePending(true)
    setDeleteError("")
    try {
      await deleteProduct(catalog.id, deleting.id)
      await reload()
      setDeleting(null)
    } catch (error) {
      setDeleteError(error.message)
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} de {products.length} productos en el catálogo.
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <ImportExcelButton />
            <ImportImagesButton />
            <Button onClick={() => setCreating(true)}>
              <Plus /> Nuevo producto
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative grow basis-72 max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            id="prod-search"
            placeholder="Buscar referencia o nombre…"
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>

        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger
            type="button"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4 [&_svg]:shrink-0"
          >
            <Filter />
            Filtros
            {hasActiveFilters && (
              <Badge variant="secondary" className="h-5 px-1.5 font-normal">
                {activeFilters}
              </Badge>
            )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-medium">Filtros</span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <X className="size-3" /> Limpiar
                </button>
              )}
            </div>

            <div className="flex flex-col gap-4 px-4 py-4">
              <FilterField
                label="Estado"
                value={statusFilter}
                onChange={setStatusFilter}
                options={STATUS_OPTIONS}
              />
              <FilterField
                label="Fuente"
                value={sourceFilter}
                onChange={setSourceFilter}
                options={SOURCE_OPTIONS}
              />
              <FilterField
                label="Categoría"
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={[
                  { value: ANY, label: "Todas las categorías" },
                  ...categories.map(category => ({
                    value: category.display_name,
                    label: category.display_name,
                  })),
                ]}
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-sm text-muted-foreground text-center">
            Cargando productos…
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 py-0 overflow-hidden">
          <ProductsTable
            products={filtered}
            onRowClick={setEditing}
            onDeleteClick={isAdmin
              ? product => {
                setDeleteError("")
                setDeleting(product)
              }
              : undefined}
          />
        </Card>
      )}

      <ProductFormSheet
        open={Boolean(editing)}
        onOpenChange={value => !value && setEditing(null)}
        product={editing}
      />
      <ProductFormSheet
        open={creating}
        onOpenChange={setCreating}
      />
      <Dialog open={Boolean(deleting)} onOpenChange={open => !open && !deletePending && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar producto</DialogTitle>
            <DialogDescription>
              Esta acción quitará {deleting?.name || deleting?.id} del catálogo. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deletePending}
              onClick={() => setDeleting(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletePending}
              onClick={handleDeleteProduct}
            >
              {deletePending ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FilterField({ label, value, onChange, options }) {
  const id = `filter-${label.toLowerCase().replace(/\s+/g, "-")}`
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
