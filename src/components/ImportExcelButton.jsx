import { useRef, useState } from "react"
import readXlsxFile from "read-excel-file/browser"
import { Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { importCatalogProducts } from "../lib/catalog"
import { useCatalog } from "../context/CatalogContext"

function cleanName(fullName) {
  return fullName
    .replace(/\s*\([^)]*(?:U\s*x\s*C|UXC|UDS?|UNI(?:D(?:AD(?:ES)?)?)?|CAJA|PACKS?|DISPLAY)[^)]*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

function unitsPerCase(fullName) {
  const patterns = [
    /\((?:[^)]*?\b)?(\d+)\s*(?:U\s*x\s*C|UXC|UDS?\s*\/?\s*C(?:AJA)?|UNI(?:D(?:AD(?:ES)?)?)?(?:\s*X\s*CAJA)?|PACKS?|DISP(?:L|LAY)?)[^)]*\)/i,
    /\b(?:CAJA|DISPLAY)\s*(?:X\s*)?(\d+)\s*(?:UNI(?:D(?:AD(?:ES)?)?)?|UDS?)\b/i,
  ]
  for (const pattern of patterns) {
    const match = fullName.match(pattern)
    if (match) return Number.parseInt(match[1], 10)
  }
  return null
}

async function parseWorkbook(file) {
  const rows = await readXlsxFile(file, { sheet: "Valoración de stocks" })
  const headers = rows[0].map(value => String(value ?? "").trim())
  const indexOf = name => headers.indexOf(name)
  const idIndex = indexOf("Artículo")
  const nameIndex = indexOf("Nombre artículo")
  const familyIndex = indexOf("Nombre de familia")
  const stockIndex = indexOf("Unidades")
  if ([idIndex, nameIndex, familyIndex, stockIndex].some(index => index === -1)) {
    throw new Error("El Excel no contiene las columnas esperadas.")
  }

  return rows.slice(1).map((row, index) => {
      const articleName = String(row[nameIndex] ?? "").replace(/\s+/g, " ").trim()
      return {
        id: String(row[idIndex] ?? "").trim(),
        article_name: articleName,
        display_name: cleanName(articleName),
        family_name: String(row[familyIndex] ?? "").trim(),
        stock_units: Number(row[stockIndex] ?? 0),
        units_per_case: unitsPerCase(articleName),
        sort_order: index,
      }
    }).filter(product => product.id && product.article_name && product.family_name)
}

export default function ImportExcelButton() {
  const inputRef = useRef(null)
  const { products: currentProducts, reload } = useCatalog()
  const [pending, setPending] = useState(null)
  const [state, setState] = useState("idle")
  const [error, setError] = useState("")

  async function selectFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setState("loading")
    setError("")
    try {
      const products = await parseWorkbook(file)
      const currentIds = new Set(currentProducts.map(product => product.id))
      const nextIds = new Set(products.map(product => product.id))
      setPending({
        products,
        added: products.filter(product => !currentIds.has(product.id)).length,
        discontinued: currentProducts.filter(product => !nextIds.has(product.id) && product.sourceType === "excel").length,
      })
      setState("preview")
    } catch (parseError) {
      setError(parseError.message)
      setState("error")
    }
  }

  async function confirm() {
    setState("saving")
    try {
      await importCatalogProducts(pending.products)
      await reload()
      setPending(null)
      setState("done")
    } catch (importError) {
      setError(importError.message)
      setState("error")
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".xlsx,.xls" hidden onChange={selectFile} />
      <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={state === "loading" || state === "saving"}>
        {state === "loading" || state === "saving" ? <Loader2 size={13} /> : <Upload size={13} />}
        {state === "saving" ? "Importando…" : "Importar Excel"}
      </Button>
      {(state === "preview" || state === "error") && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1500, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center" }}>
          <div style={{ width: 420, background: "#fff", borderRadius: 12, padding: 24 }}>
            {state === "error" ? (
              <>
                <h3>Error de importación</h3>
                <p style={{ fontSize: 13, color: "#b91c1c" }}>{error}</p>
                <Button onClick={() => setState("idle")}>Cerrar</Button>
              </>
            ) : (
              <>
                <h3 style={{ marginTop: 0 }}>Confirmar importación</h3>
                <p>{pending.products.length} productos · {pending.added} nuevos · {pending.discontinued} bajas</p>
                <p style={{ fontSize: 12, color: "#6b7280" }}>
                  La operación es transaccional. Las familias desconocidas bloquearán toda la importación.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="outline" onClick={() => setState("idle")} style={{ flex: 1 }}>Cancelar</Button>
                  <Button onClick={confirm} style={{ flex: 1 }}>Confirmar</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
