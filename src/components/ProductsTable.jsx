import { useEffect, useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

function statusOf(product) {
  if (product.discontinued) return { label: "De baja", variant: "destructive" }
  if (!product.active) return { label: "Fuera", variant: "outline" }
  return { label: "Activo", variant: "secondary" }
}

const COLUMNS = [
  { key: "id", label: "Ref", sortable: true, className: "w-[110px]" },
  { key: "name", label: "Nombre", sortable: true },
  { key: "status", label: "Estado", sortable: false, className: "w-[120px]" },
  { key: "category", label: "Categoría", sortable: true, className: "w-[200px]" },
  { key: "stockUnits", label: "Stock", sortable: true, className: "w-[100px] text-right" },
  { key: "unitsPerCase", label: "Uds./caja", sortable: true, className: "w-[110px] text-right" },
  { key: "addedAt", label: "Añadido", sortable: true, className: "w-[140px]" },
  { key: "updatedAt", label: "Modificado", sortable: true, className: "w-[150px]" },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const DATE_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

export default function ProductsTable({
  products,
  onRowClick,
  onDeleteClick,
}) {
  const [sort, setSort] = useState({ key: "addedAt", direction: "desc" })
  const [pageSize, setPageSize] = useState(10)
  const [pageIndex, setPageIndex] = useState(0)

  const columns = COLUMNS

  const sorted = useMemo(() => {
    const copy = [...products]
    copy.sort((a, b) => {
      const av = a[sort.key]
      const bv = b[sort.key]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === "number" && typeof bv === "number") {
        return sort.direction === "asc" ? av - bv : bv - av
      }
      return sort.direction === "asc"
        ? String(av).localeCompare(String(bv), "es", { numeric: true })
        : String(bv).localeCompare(String(av), "es", { numeric: true })
    })
    return copy
  }, [products, sort])

  const totalRows = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))

  useEffect(() => {
    if (pageIndex > totalPages - 1) setPageIndex(0)
  }, [pageIndex, totalPages])

  useEffect(() => {
    setPageIndex(0)
  }, [products, pageSize])

  const paged = useMemo(() => {
    const start = pageIndex * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, pageIndex, pageSize])

  function toggleSort(key) {
    setSort(prev => (
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    ))
  }

  return (
    <div className="flex flex-col">
      <div className="overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              {columns.map(column => (
                <TableHead
                  key={column.key}
                  className={cn(
                    "h-12 px-6 text-xs uppercase tracking-wider text-muted-foreground",
                    column.className
                  )}
                >
                  {column.sortable ? (
                    <SortButton
                      label={column.label}
                      active={sort.key === column.key}
                      direction={sort.direction}
                      onClick={() => toggleSort(column.key)}
                    />
                  ) : (
                    column.label
                  )}
                </TableHead>
              ))}
              <TableHead className="w-[64px] px-6 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map(product => {
              const status = statusOf(product)
              return (
                <TableRow
                  key={product.id}
                  onClick={() => onRowClick(product)}
                  className="cursor-pointer"
                >
                  {columns.map(column => (
                    <TableCell key={column.key} className={cn("px-6 py-4", column.className)}>
                      {renderCell(column.key, product, status)}
                    </TableCell>
                  ))}
                  <TableCell className="px-6 py-4 text-right" onClick={event => event.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        type="button"
                        aria-label={`Acciones de ${product.id}`}
                        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4 [&_svg]:shrink-0"
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="cursor-pointer" onSelect={() => onRowClick(product)}>
                          <Pencil />
                          Editar
                        </DropdownMenuItem>
                        {onDeleteClick && (
                          <DropdownMenuItem
                            variant="destructive"
                            className="cursor-pointer"
                            onSelect={() => onDeleteClick(product)}
                          >
                            <Trash2 />
                            Eliminar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
            {!paged.length && (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="h-32 text-center text-muted-foreground">
                  No hay productos que coincidan con los filtros.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 border-t border-border bg-card px-6 py-3 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
        <span className="tabular-nums">
          {totalRows} producto(s).
        </span>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="rows-per-page" className="text-sm font-medium">
              Filas por página
            </Label>
            <Select
              value={String(pageSize)}
              onValueChange={value => setPageSize(Number(value))}
            >
              <SelectTrigger id="rows-per-page" className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {PAGE_SIZE_OPTIONS.map(option => (
                  <SelectItem key={option} value={String(option)}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="tabular-nums">
            Página {pageIndex + 1} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              className="size-8"
              onClick={() => setPageIndex(0)}
              disabled={pageIndex === 0}
              aria-label="Primera página"
            >
              <ChevronsLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="size-8"
              onClick={() => setPageIndex(value => Math.max(0, value - 1))}
              disabled={pageIndex === 0}
              aria-label="Página anterior"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="size-8"
              onClick={() => setPageIndex(value => Math.min(totalPages - 1, value + 1))}
              disabled={pageIndex >= totalPages - 1}
              aria-label="Página siguiente"
            >
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="size-8"
              onClick={() => setPageIndex(totalPages - 1)}
              disabled={pageIndex >= totalPages - 1}
              aria-label="Última página"
            >
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function renderCell(key, product, status) {
  switch (key) {
    case "id":
      return <span className="font-mono text-xs text-muted-foreground">{product.id}</span>
    case "name":
      return (
        <span className="block truncate font-medium" title={product.name}>
          {product.name}
        </span>
      )
    case "category":
      return (
        <Badge variant="outline" className="font-normal">
          {product.category ?? "—"}
        </Badge>
      )
    case "stockUnits":
      return <span className="block text-right tabular-nums">{product.stockUnits ?? 0}</span>
    case "unitsPerCase":
      return <span className="block text-right tabular-nums">{product.unitsPerCase ?? "—"}</span>
    case "addedAt":
      return <DateCell value={product.addedAt} />
    case "updatedAt":
      return <DateCell value={product.updatedAt} />
    case "status":
      return <Badge variant={status.variant}>{status.label}</Badge>
    default:
      return null
  }
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

function SortButton({ label, active, direction, onClick }) {
  const Icon = !active ? ChevronsUpDown : direction === "asc" ? ArrowUp : ArrowDown
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        "-ml-3 h-8 px-2 text-xs uppercase tracking-wider gap-1.5",
        active ? "text-foreground" : "text-muted-foreground"
      )}
    >
      {label}
      <Icon className={cn("size-3", active ? "opacity-100" : "opacity-60")} />
    </Button>
  )
}
