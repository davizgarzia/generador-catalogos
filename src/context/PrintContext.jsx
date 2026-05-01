import { createContext, useContext, useState } from "react"

const PrintContext = createContext(null)

export function PrintProvider({ children }) {
  const [printMode, setPrintMode] = useState(true)

  return (
    <PrintContext.Provider value={{ printMode, setPrintMode }}>
      {children}
    </PrintContext.Provider>
  )
}

export function usePrint() {
  return useContext(PrintContext)
}
