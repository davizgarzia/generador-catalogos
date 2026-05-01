import { createContext, useContext, useState } from "react"

const PrintContext = createContext(null)

export function PrintProvider({ children }) {
  // Leer estado inicial desde query params (usado por Puppeteer al generar PDF)
  // ?marks=1&size=A5
  const params = new URLSearchParams(window.location.search)
  const initMarks = params.has("marks") ? params.get("marks") === "1" : true
  const initSize  = params.has("size")  ? params.get("size")          : "A4"

  const [printMode, setPrintMode] = useState(initMarks)
  const [printSize, setPrintSize] = useState(initSize)

  return (
    <PrintContext.Provider value={{ printMode, setPrintMode, printSize, setPrintSize }}>
      {children}
    </PrintContext.Provider>
  )
}

export function usePrint() {
  return useContext(PrintContext)
}
