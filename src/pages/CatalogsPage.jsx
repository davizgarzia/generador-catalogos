import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Copy, ExternalLink, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCatalog } from "../context/CatalogContext"
import { useAuth } from "../context/AuthContext"
import { countCatalogProducts, createCatalog, deleteCatalog, updateCatalog } from "../lib/catalog"

const EMPTY_SOURCE = "empty"
const ALL_SOURCE = "all"

const DATE_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

export default function CatalogsPage() {
  const { catalogs, loading, reloadMeta } = useCatalog()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [counts, setCounts] = useState({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [sourceId, setSourceId] = useState(EMPTY_SOURCE)
  const [deleting, setDeleting] = useState(null)
  const [deleteError, setDeleteError] = useState("")
  const [deletePending, setDeletePending] = useState(false)
  const [renaming, setRenaming] = useState(null)

  useEffect(() => {
    if (searchParams.get("nuevo")) {
      setSourceId(EMPTY_SOURCE)
      setDialogOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    let cancelled = false
    Promise.all(
      catalogs.map(async item => [item.id, await countCatalogProducts(item.id).catch(() => null)])
    ).then(entries => {
      if (!cancelled) setCounts(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
  }, [catalogs])

  function openCatalog(item) {
    navigate(`/catalogs/${item.slug}`)
  }

  function openDuplicate(item) {
    setSourceId(item.id)
    setDialogOpen(true)
  }

  async function handleDelete() {
    if (!deleting?.id) return
    setDeletePending(true)
    setDeleteError("")
    try {
      await deleteCatalog(deleting.id)
      await reloadMeta()
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
          <h1 className="text-2xl font-semibold tracking-tight">Catálogos</h1>
          <p className="text-sm text-muted-foreground">
            {catalogs.length} catálogo(s). Los productos, imágenes y categorías son compartidos.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setSourceId(EMPTY_SOURCE); setDialogOpen(true) }}>
            <Plus /> Nuevo catálogo
          </Button>
        )}
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-sm text-muted-foreground text-center">
            Cargando catálogos…
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 py-0 overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-12 px-6 text-xs uppercase tracking-wider text-muted-foreground">
                  Nombre
                </TableHead>
                <TableHead className="h-12 px-6 text-xs uppercase tracking-wider text-muted-foreground w-[120px] text-right">
                  Productos
                </TableHead>
                <TableHead className="h-12 px-6 text-xs uppercase tracking-wider text-muted-foreground w-[150px]">
                  Creado
                </TableHead>
                <TableHead className="h-12 px-6 text-xs uppercase tracking-wider text-muted-foreground w-[150px]">
                  Modificado
                </TableHead>
                <TableHead className="w-[64px] px-6 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogs.map(item => (
                <TableRow
                  key={item.id}
                  onClick={() => openCatalog(item)}
                  className="cursor-pointer"
                >
                  <TableCell className="px-6 py-4">
                    <span className="block truncate font-medium" title={item.name}>
                      {item.name}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right tabular-nums">
                    {counts[item.id] ?? "…"}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <DateCell value={item.created_at} />
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <DateCell value={item.updated_at} />
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right" onClick={event => event.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        type="button"
                        aria-label={`Acciones de ${item.name}`}
                        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4 [&_svg]:shrink-0"
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="cursor-pointer" onSelect={() => openCatalog(item)}>
                          <ExternalLink />
                          Abrir
                        </DropdownMenuItem>
                        {isAdmin && (
                          <>
                            <DropdownMenuItem className="cursor-pointer" onSelect={() => setRenaming(item)}>
                              <Pencil />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onSelect={() => openDuplicate(item)}>
                              <Copy />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              className="cursor-pointer"
                              onSelect={() => {
                                setDeleteError("")
                                setDeleting(item)
                              }}
                            >
                              <Trash2 />
                              Eliminar
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!catalogs.length && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Todavía no hay catálogos. Crea el primero con «Nuevo catálogo».
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <NewCatalogDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        catalogs={catalogs}
        initialSourceId={sourceId}
      />

      <RenameCatalogDialog
        catalog={renaming}
        onOpenChange={open => !open && setRenaming(null)}
      />

      <Dialog open={Boolean(deleting)} onOpenChange={open => !open && !deletePending && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar catálogo</DialogTitle>
            <DialogDescription>
              Se eliminará «{deleting?.name}» y su composición (qué productos incluye,
              orden y encuadres). Los productos siguen en el maestro y en el resto de
              catálogos. No se puede deshacer.
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
              onClick={handleDelete}
            >
              {deletePending ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DateCell({ value }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return <span className="text-muted-foreground">—</span>
  return (
    <span className="block whitespace-nowrap text-xs tabular-nums text-muted-foreground">
      {DATE_FORMATTER.format(date)}
    </span>
  )
}

function RenameCatalogDialog({ catalog, onOpenChange }) {
  const { reloadMeta } = useCatalog()
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const open = Boolean(catalog)

  useEffect(() => {
    if (catalog) {
      setName(catalog.name)
      setError("")
    }
  }, [catalog])

  async function handleSave() {
    setError("")
    setSaving(true)
    try {
      await updateCatalog(catalog.id, { name: name.trim() })
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
          <DialogTitle>Editar catálogo</DialogTitle>
          <DialogDescription>
            Cambia el nombre de «{catalog?.name}». Su selección de productos y
            sus encuadres no se tocan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="rc-name">Nombre</Label>
          <Input
            id="rc-name"
            value={name}
            onChange={event => setName(event.target.value)}
            disabled={saving}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={saving || !name.trim()} onClick={handleSave}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NewCatalogDialog({ open, onOpenChange, catalogs, initialSourceId }) {
  const { reloadMeta } = useCatalog()
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [sourceId, setSourceId] = useState(EMPTY_SOURCE)
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)

  const duplicateSource = catalogs.find(item => item.id === initialSourceId)
  const isDuplicate = Boolean(duplicateSource)

  useEffect(() => {
    if (open) {
      const source = catalogs.find(item => item.id === initialSourceId)
      setName(source ? `${source.name} (copia)` : "")
      setSourceId(initialSourceId)
      setError("")
    }
  }, [open, initialSourceId, catalogs])

  async function handleCreate() {
    setError("")
    setCreating(true)
    try {
      const created = await createCatalog({
        name: name.trim(),
        sourceCatalogId: sourceId === EMPTY_SOURCE || sourceId === ALL_SOURCE ? null : sourceId,
        includeAllProducts: sourceId === ALL_SOURCE,
      })
      onOpenChange(false)
      await reloadMeta()
      navigate(`/catalogs/${created.slug}`)
    } catch (createError) {
      setError(createError.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={value => !creating && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isDuplicate ? "Duplicar catálogo" : "Nuevo catálogo"}</DialogTitle>
          <DialogDescription>
            {isDuplicate
              ? `Se creará una copia de «${duplicateSource.name}» con su selección de productos, orden y encuadres.`
              : "Vacío para componerlo después, con todos los productos activos, o duplicando la selección de un catálogo existente."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="nc-name">Nombre</Label>
            <Input
              id="nc-name"
              value={name}
              placeholder="Catálogo 2027"
              onChange={event => setName(event.target.value)}
              disabled={creating}
            />
          </div>
          {!isDuplicate && (
            <div className="grid gap-2">
              <Label htmlFor="nc-source">Empezar desde</Label>
              <Select value={sourceId} onValueChange={setSourceId} disabled={creating}>
                <SelectTrigger id="nc-source" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_SOURCE}>Catálogo vacío</SelectItem>
                  <SelectItem value={ALL_SOURCE}>Todos los productos activos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" disabled={creating} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={creating || !name.trim()} onClick={handleCreate}>
            {creating ? "Creando…" : isDuplicate ? "Duplicar catálogo" : "Crear catálogo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
