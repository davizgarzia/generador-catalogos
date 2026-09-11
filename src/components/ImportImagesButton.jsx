import { useRef, useState } from "react"
import { FolderOpen, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { uploadProductImage } from "../lib/catalog"
import { useCatalog } from "../context/CatalogContext"

const CONCURRENCY = 4

export default function ImportImagesButton() {
  const inputRef = useRef(null)
  const { catalog, products, reloadProducts } = useCatalog()
  const [state, setState] = useState("idle")
  const [progress, setProgress] = useState("")

  async function upload(event) {
    const files = [...(event.target.files ?? [])]
    event.target.value = ""
    if (!files.length) return

    setState("loading")
    const productIds = new Set(products.map(product => product.id))
    const matched = files.filter(file => productIds.has(file.name.replace(/\.[^.]+$/, "").trim()))

    const queue = [...matched]
    const failures = []
    let completed = 0

    async function worker() {
      let file
      while ((file = queue.shift())) {
        const productId = file.name.replace(/\.[^.]+$/, "").trim()
        try {
          await uploadProductImage(catalog.id, productId, file, "original")
        } catch (error) {
          failures.push(`${file.name}: ${error.message}`)
        }
        completed += 1
        setProgress(`${completed}/${matched.length}`)
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, matched.length) }, worker)
    )
    await reloadProducts()

    const uploaded = matched.length - failures.length
    const ignored = files.length - matched.length
    if (failures.length) {
      setState("error")
      console.error("Fallos al importar imágenes:", failures)
      setProgress(
        `${uploaded} subidas · ${failures.length} con error (${failures[0]}${failures.length > 1 ? "…" : ""})`
      )
    } else {
      setState("done")
      setProgress(`${uploaded} subidas · ${ignored} ignoradas`)
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={upload} />
      <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={state === "loading"}>
        {state === "loading" ? <Loader2 className="animate-spin" /> : <FolderOpen />}
        Importar imágenes {state === "loading" && progress}
      </Button>
      {(state === "done" || state === "error") && (
        <span
          role="status"
          className={state === "error" ? "text-destructive text-xs" : "text-emerald-600 text-xs"}
        >
          {progress}
        </span>
      )}
    </>
  )
}
