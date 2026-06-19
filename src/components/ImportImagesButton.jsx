import { useRef, useState } from "react"
import { FolderOpen, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { uploadProductImage } from "../lib/catalog"
import { useCatalog } from "../context/CatalogContext"

export default function ImportImagesButton() {
  const inputRef = useRef(null)
  const { catalog, products, reload } = useCatalog()
  const [state, setState] = useState("idle")
  const [progress, setProgress] = useState("")

  async function upload(event) {
    const files = [...(event.target.files ?? [])]
    event.target.value = ""
    if (!files.length) return

    setState("loading")
    const productIds = new Set(products.map(product => product.id))
    const matched = files.filter(file => productIds.has(file.name.replace(/\.[^.]+$/, "").trim()))
    try {
      for (const [index, file] of matched.entries()) {
        const productId = file.name.replace(/\.[^.]+$/, "").trim()
        setProgress(`${index + 1}/${matched.length}`)
        await uploadProductImage(catalog.id, productId, file, "original")
      }
      await reload()
      setState("done")
      setProgress(`${matched.length} subidas · ${files.length - matched.length} ignoradas`)
    } catch (error) {
      setState("error")
      setProgress(error.message)
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={upload} />
      <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={state === "loading"}>
        {state === "loading" ? <Loader2 size={13} /> : <FolderOpen size={13} />}
        Importar imágenes {state === "loading" && progress}
      </Button>
      {(state === "done" || state === "error") && (
        <span style={{ fontSize: 10, color: state === "error" ? "#b91c1c" : "#15803d" }}>{progress}</span>
      )}
    </>
  )
}
