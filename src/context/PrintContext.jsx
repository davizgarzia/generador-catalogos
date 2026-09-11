import { createContext, useContext, useEffect, useState } from "react"

const PrintContext = createContext(null)
const STORAGE_KEY = "impormed.viewSettings"
const VALID_GRIDS = ["3x3", "4x3", "4x4"]
const VALID_SIZES = ["A4", "A5"]

const DEFAULTS = {
  printMode: false,
  printSize: "A4",
  productGrid: "4x4",
  hideNoImage: false,
}

function readStoredSettings() {
  if (typeof window === "undefined") return DEFAULTS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
    return {
      printMode: typeof parsed.printMode === "boolean" ? parsed.printMode : DEFAULTS.printMode,
      printSize: VALID_SIZES.includes(parsed.printSize) ? parsed.printSize : DEFAULTS.printSize,
      productGrid: VALID_GRIDS.includes(parsed.productGrid) ? parsed.productGrid : DEFAULTS.productGrid,
      hideNoImage: typeof parsed.hideNoImage === "boolean" ? parsed.hideNoImage : DEFAULTS.hideNoImage,
    }
  } catch {
    return DEFAULTS
  }
}

export function PrintProvider({ children }) {
  const [settings, setSettings] = useState(readStoredSettings)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // ignore quota / disabled storage
    }
  }, [settings])

  const update = key => value => setSettings(current => ({ ...current, [key]: value }))

  return (
    <PrintContext.Provider value={{
      printMode: settings.printMode,
      setPrintMode: update("printMode"),
      printSize: settings.printSize,
      setPrintSize: update("printSize"),
      productGrid: settings.productGrid,
      setProductGrid: update("productGrid"),
      hideNoImage: settings.hideNoImage,
      setHideNoImage: update("hideNoImage"),
    }}>
      {children}
    </PrintContext.Provider>
  )
}

export function usePrint() {
  return useContext(PrintContext)
}
