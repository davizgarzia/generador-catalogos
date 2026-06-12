import { createContext, useContext, useState } from "react"

const PrintContext = createContext(null)

export function PrintProvider({ children }) {
  // Leer estado inicial desde query params (usado por Puppeteer al generar PDF)
  // ?marks=1&size=A5&draft=1&grid=4x3&hideNoImage=1
  const params = new URLSearchParams(window.location.search)
  const initMarks = params.has("marks") ? params.get("marks") === "1" : false
  const initSize  = params.has("size")  ? params.get("size")          : "A4"
  const initDraft = params.has("draft") ? params.get("draft") === "1" : false
  const initGrid  = params.has("grid")  ? params.get("grid")          : "4x4"
  const initHideNoImage = params.has("hideNoImage") ? params.get("hideNoImage") === "1" : false

  const [printMode, setPrintMode] = useState(initMarks)
  const [printSize, setPrintSize] = useState(initSize)
  const [draftQuality, setDraftQuality] = useState(initDraft)
  const [productGrid, setProductGrid] = useState(["3x3", "4x3", "4x4"].includes(initGrid) ? initGrid : "4x4")
  const [hideNoImage, setHideNoImage] = useState(initHideNoImage)

  return (
    <PrintContext.Provider value={{
      printMode,
      setPrintMode,
      printSize,
      setPrintSize,
      draftQuality,
      setDraftQuality,
      productGrid,
      setProductGrid,
      hideNoImage,
      setHideNoImage,
    }}>
      {children}
    </PrintContext.Provider>
  )
}

export function usePrint() {
  return useContext(PrintContext)
}
