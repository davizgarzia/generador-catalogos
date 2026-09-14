import { useRef, useState } from "react"
import { FolderOpen, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
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
import { uploadProductImage } from "../lib/catalog"
import { useCatalog } from "../context/CatalogContext"

const CONCURRENCY = 4
const VALID_EXTENSIONS = /\.(jpe?g|png|webp)$/i

function baseName(fileName) {
  return fileName.replace(/\.[^.]+$/, "").trim()
}

export default function ImportImagesButton() {
  const inputRef = useRef(null)
  const { products, reloadProducts } = useCatalog()
  const [state, setState] = useState("idle")
  const [plan, setPlan] = useState(null)
  const [skipOverwrites, setSkipOverwrites] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [failures, setFailures] = useState([])
  const [uploadedCount, setUploadedCount] = useState(0)

  const dialogOpen = ["preview", "uploading", "result"].includes(state)

  function classifyFiles(files) {
    const byId = new Map(products.map(product => [product.id, product]))
    const byIdLower = new Map(products.map(product => [product.id.toLowerCase(), product]))
    const newMatches = []
    const overwrites = []
    const ignored = []

    for (const file of files) {
      if (!VALID_EXTENSIONS.test(file.name)) {
        ignored.push({ fileName: file.name, reason: "Extensión no válida (jpg, png o webp)" })
        continue
      }
      const id = baseName(file.name)
      const product = byId.get(id)
      if (!product) {
        const nearMatch = byIdLower.get(id.toLowerCase())
        ignored.push({
          fileName: file.name,
          reason: nearMatch
            ? `Sin coincidencia exacta (¿quizá ${nearMatch.id}? revisa mayúsculas)`
            : "Ninguna referencia del catálogo coincide con el nombre",
        })
        continue
      }
      const entry = { file, product }
      if (product.originalImage) overwrites.push(entry)
      else newMatches.push(entry)
    }

    return { newMatches, overwrites, ignored }
  }

  function selectFiles(event) {
    const files = [...(event.target.files ?? [])]
    event.target.value = ""
    if (!files.length) return
    setPlan(classifyFiles(files))
    setSkipOverwrites(false)
    setFailures([])
    setState("preview")
  }

  async function upload() {
    const entries = [
      ...plan.newMatches,
      ...(skipOverwrites ? [] : plan.overwrites),
    ]
    if (!entries.length) return

    setState("uploading")
    setProgress({ done: 0, total: entries.length })
    const queue = [...entries]
    const errors = []
    let done = 0

    async function worker() {
      let entry
      while ((entry = queue.shift())) {
        try {
          await uploadProductImage(entry.product.id, entry.file, "original")
        } catch (error) {
          errors.push({ fileName: entry.file.name, message: error.message })
        }
        done += 1
        setProgress({ done, total: entries.length })
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, entries.length) }, worker))
    await reloadProducts()
    setUploadedCount(entries.length - errors.length)
    setFailures(errors)
    setState("result")
  }

  function close() {
    setState("idle")
    setPlan(null)
    setFailures([])
  }

  const uploadCount = plan
    ? plan.newMatches.length + (skipOverwrites ? 0 : plan.overwrites.length)
    : 0

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={selectFiles}
      />
      <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={state === "uploading"}>
        {state === "uploading" ? <Loader2 className="animate-spin" /> : <FolderOpen />}
        Importar imágenes
      </Button>

      <Dialog open={dialogOpen} onOpenChange={open => !open && state !== "uploading" && close()}>
        <DialogContent className="sm:max-w-2xl">
          {state === "result" ? (
            <>
              <DialogHeader>
                <DialogTitle>Subida completada</DialogTitle>
                <DialogDescription>
                  {uploadedCount} imagen(es) subida(s) correctamente
                  {failures.length > 0 && ` · ${failures.length} con error`}.
                </DialogDescription>
              </DialogHeader>
              {failures.length > 0 && (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                  <Table>
                    <TableBody>
                      {failures.map(failure => (
                        <TableRow key={failure.fileName}>
                          <TableCell className="px-4 py-2 text-xs font-mono">{failure.fileName}</TableCell>
                          <TableCell className="px-4 py-2 text-xs text-destructive">{failure.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <DialogFooter>
                <Button onClick={close}>Cerrar</Button>
              </DialogFooter>
            </>
          ) : state === "uploading" ? (
            <>
              <DialogHeader>
                <DialogTitle>Subiendo imágenes…</DialogTitle>
                <DialogDescription>
                  {progress.done} de {progress.total}. No cierres esta ventana.
                </DialogDescription>
              </DialogHeader>
              <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
            </>
          ) : plan ? (
            <>
              <DialogHeader>
                <DialogTitle>Revisar imágenes</DialogTitle>
                <DialogDescription>
                  Cada fichero debe llamarse como la referencia del producto (p. ej.{" "}
                  <code className="text-xs">63028.jpg</code>). Nada se sube hasta que confirmes.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{plan.newMatches.length} nuevas</Badge>
                <Badge variant={plan.overwrites.length ? "destructive" : "outline"}>
                  {plan.overwrites.length} sobrescriben
                </Badge>
                <Badge variant="outline">{plan.ignored.length} ignoradas</Badge>
              </div>

              {plan.overwrites.length > 0 && (
                <Alert>
                  <AlertDescription>
                    Las sobrescrituras sustituyen la foto actual del producto (la imagen es
                    única por producto y se ve igual en todos los catálogos).
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-2">
                <ImportSection
                  title="Sobrescriben la imagen actual"
                  count={plan.overwrites.length}
                  tone={skipOverwrites ? "muted" : "destructive"}
                  defaultOpen
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-9 px-4 text-xs w-[60px]">Actual</TableHead>
                        <TableHead className="h-9 px-4 text-xs">Fichero</TableHead>
                        <TableHead className="h-9 px-4 text-xs">Producto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plan.overwrites.map(entry => (
                        <TableRow key={entry.file.name}>
                          <TableCell className="px-4 py-1.5">
                            {(entry.product.thumb || entry.product.originalImage) && (
                              <img
                                src={entry.product.thumb || entry.product.originalImage}
                                alt=""
                                className="size-9 rounded object-contain bg-muted"
                                loading="lazy"
                              />
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-1.5 text-xs font-mono">{entry.file.name}</TableCell>
                          <TableCell className="px-4 py-1.5 text-xs">{entry.product.name}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ImportSection>

                <ImportSection title="Nuevas (el producto no tenía imagen)" count={plan.newMatches.length}>
                  <Table>
                    <TableBody>
                      {plan.newMatches.map(entry => (
                        <TableRow key={entry.file.name}>
                          <TableCell className="px-4 py-1.5 text-xs font-mono">{entry.file.name}</TableCell>
                          <TableCell className="px-4 py-1.5 text-xs">{entry.product.name}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ImportSection>

                <ImportSection title="Ignoradas" count={plan.ignored.length} tone="muted">
                  <Table>
                    <TableBody>
                      {plan.ignored.map(item => (
                        <TableRow key={item.fileName}>
                          <TableCell className="px-4 py-1.5 text-xs font-mono">{item.fileName}</TableCell>
                          <TableCell className="px-4 py-1.5 text-xs text-muted-foreground">{item.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ImportSection>
              </div>

              {plan.overwrites.length > 0 && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="skip-overwrites"
                    checked={skipOverwrites}
                    onCheckedChange={setSkipOverwrites}
                  />
                  <Label htmlFor="skip-overwrites" className="text-sm font-normal">
                    Omitir las que ya tienen imagen
                  </Label>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={close}>Cancelar</Button>
                <Button disabled={uploadCount === 0} onClick={upload}>
                  Subir {uploadCount} imagen(es)
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
