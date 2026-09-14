import { useRef, useState } from "react"
import { Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import ImportSection from "./import/ImportSection"
import { importMasterProducts } from "../lib/catalog"
import { EXPECTED_HEADERS, computeImportDiff, parseImportFile } from "../lib/importExcel"
import { useCatalog } from "../context/CatalogContext"

export default function ImportExcelButton() {
  const inputRef = useRef(null)
  const { products: currentProducts, categories, reloadProducts } = useCatalog()
  const [state, setState] = useState("idle")
  const [diff, setDiff] = useState(null)
  const [discarded, setDiscarded] = useState([])
  const [markMissing, setMarkMissing] = useState(true)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState("")

  const masterIsEmpty = currentProducts.length === 0
  const dialogOpen = ["preview", "saving", "result", "error"].includes(state)

  async function selectFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setState("loading")
    setError("")
    try {
      const parsed = await parseImportFile(file)
      if (parsed.kind === "references") {
        throw new Error(
          `Este fichero es una lista de ${parsed.references.length} referencia(s), útil para ` +
          "componer un catálogo (desde su «Gestionar productos»). Para actualizar el maestro " +
          `se necesita el formato completo con las columnas ${EXPECTED_HEADERS}.`
        )
      }
      const { products, discarded: discardedRows } = parsed
      if (!products.length) {
        throw new Error("El fichero no contiene ninguna fila válida.")
      }
      setDiff(computeImportDiff({ fileProducts: products, currentProducts, categories }))
      setDiscarded(discardedRows)
      setMarkMissing(!masterIsEmpty)
      setState("preview")
    } catch (parseError) {
      setError(parseError.message)
      setState("error")
    }
  }

  async function confirm() {
    setState("saving")
    setError("")
    try {
      const result = await importMasterProducts(diff.toSend, {
        markMissing: masterIsEmpty ? false : markMissing,
      })
      await reloadProducts()
      setSummary(result)
      setState("result")
    } catch (importError) {
      setError(importError.message)
      setState("error")
    }
  }

  function close() {
    setState("idle")
    setDiff(null)
    setDiscarded([])
    setSummary(null)
    setError("")
  }

  const blocked = diff?.unknownFamilies.length > 0

  return (
    <>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={selectFile} />
      <Button
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={state === "loading" || state === "saving"}
      >
        {state === "loading" || state === "saving" ? <Loader2 className="animate-spin" /> : <Upload />}
        {state === "saving" ? "Importando…" : "Importar Excel"}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={open => !open && state !== "saving" && close()}>
        <DialogContent className="sm:max-w-3xl">
          {state === "error" ? (
            <>
              <DialogHeader>
                <DialogTitle>No se pudo importar</DialogTitle>
              </DialogHeader>
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <DialogFooter>
                <Button variant="outline" onClick={close}>Cerrar</Button>
              </DialogFooter>
            </>
          ) : state === "result" ? (
            <>
              <DialogHeader>
                <DialogTitle>Importación completada</DialogTitle>
                <DialogDescription>
                  {summary?.total ?? 0} artículos procesados en el fichero.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{summary?.added ?? 0} nuevos</Badge>
                <Badge variant="secondary">{summary?.updated ?? 0} actualizados</Badge>
                {(summary?.reactivated ?? 0) > 0 && (
                  <Badge variant="secondary">{summary.reactivated} reincorporados</Badge>
                )}
                {(summary?.discontinued ?? 0) > 0 && (
                  <Badge variant="destructive">{summary.discontinued} bajas</Badge>
                )}
              </div>
              <DialogFooter>
                <Button onClick={close}>Cerrar</Button>
              </DialogFooter>
            </>
          ) : diff ? (
            <>
              <DialogHeader>
                <DialogTitle>Revisar importación</DialogTitle>
                <DialogDescription>
                  Nada se guarda hasta que confirmes. Revisa especialmente las bajas.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{diff.toSend.length} en el fichero</Badge>
                <Badge variant="secondary">{diff.added.length} nuevos</Badge>
                <Badge variant="secondary">{diff.updated.length} con cambios</Badge>
                <Badge variant="outline">{diff.unchanged.length} sin cambios</Badge>
                {diff.reactivated.length > 0 && (
                  <Badge variant="secondary">{diff.reactivated.length} reincorporados</Badge>
                )}
                {diff.discontinuedNow.length > 0 && (
                  <Badge variant={markMissing ? "destructive" : "outline"}>
                    {diff.discontinuedNow.length} bajas
                  </Badge>
                )}
                {discarded.length > 0 && (
                  <Badge variant="outline">{discarded.length} descartados</Badge>
                )}
              </div>

              {blocked && (
                <Alert variant="destructive">
                  <AlertTitle>Familias desconocidas</AlertTitle>
                  <AlertDescription>
                    Estas familias no existen como categoría y bloquean la importación:{" "}
                    <strong>{diff.unknownFamilies.join(", ")}</strong>. Corrige el fichero
                    o crea las categorías antes de continuar.
                  </AlertDescription>
                </Alert>
              )}

              {diff.manualConflicts.length > 0 && (
                <Alert>
                  <AlertDescription>
                    {diff.manualConflicts.length} referencia(s) del fichero corresponden a
                    productos manuales ({diff.manualConflicts.map(item => item.id).join(", ")}).
                    Sus datos y su estado no se modificarán.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-2">
                <ImportSection
                  title={markMissing ? "Bajas (se darán de baja al confirmar)" : "Bajas (no se aplicarán)"}
                  count={diff.discontinuedNow.length}
                  tone={markMissing ? "destructive" : "muted"}
                  defaultOpen
                >
                  <SimpleTable
                    headers={["Ref", "Nombre", "Stock actual"]}
                    rows={diff.discontinuedNow.map(product => [product.id, product.name, product.stockUnits ?? 0])}
                  />
                </ImportSection>

                <ImportSection title="Con cambios" count={diff.updated.length}>
                  <SimpleTable
                    headers={["Ref", "Nombre", "Cambios"]}
                    rows={diff.updated.map(item => [
                      item.id,
                      item.name,
                      item.changes.map(change => `${change.field}: ${change.before} → ${change.after}`).join(" · "),
                    ])}
                  />
                </ImportSection>

                <ImportSection title="Nuevos" count={diff.added.length}>
                  <SimpleTable
                    headers={["Ref", "Nombre", "Familia", "Stock"]}
                    rows={diff.added.map(item => [item.id, item.display_name, item.family_name, item.stock_units])}
                  />
                </ImportSection>

                <ImportSection title="Reincorporados (estaban de baja)" count={diff.reactivated.length}>
                  <SimpleTable
                    headers={["Ref", "Nombre"]}
                    rows={diff.reactivated.map(item => [item.id, item.name])}
                  />
                </ImportSection>

                <ImportSection title="Filas descartadas" count={discarded.length} tone="muted">
                  <SimpleTable
                    headers={["Fila", "Ref", "Motivo"]}
                    rows={discarded.map(item => [item.rowNumber, item.id || "—", item.reason])}
                  />
                </ImportSection>
              </div>

              {!masterIsEmpty && diff.discontinuedNow.length > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="import-mark-missing"
                    checked={markMissing}
                    onCheckedChange={value => setMarkMissing(Boolean(value))}
                    disabled={state === "saving"}
                  />
                  <Label htmlFor="import-mark-missing" className="text-sm font-normal">
                    Dar de baja los productos ausentes del fichero
                  </Label>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" disabled={state === "saving"} onClick={close}>
                  Cancelar
                </Button>
                <Button disabled={state === "saving" || blocked} onClick={confirm}>
                  {state === "saving" ? (
                    <>
                      <Loader2 className="animate-spin" /> Importando…
                    </>
                  ) : (
                    "Confirmar importación"
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function SimpleTable({ headers, rows }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map(header => (
            <TableHead key={header} className="h-9 px-4 text-xs">{header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((cells, index) => (
          <TableRow key={index}>
            {cells.map((cell, cellIndex) => (
              <TableCell key={cellIndex} className="px-4 py-2 text-xs">
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
