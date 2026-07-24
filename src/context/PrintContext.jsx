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
  renderTarget: "screen",
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
      renderTarget: DEFAULTS.renderTarget,
    }
  } catch {
    return DEFAULTS
  }
}

function readQueryOverrides() {
  if (typeof window === "undefined") return {}
  const params = new URLSearchParams(window.location.search)
  const overrides = {}
  if (params.has("marks")) overrides.printMode = params.get("marks") === "1"
  if (params.has("size")) overrides.printSize = params.get("size")
  if (params.has("grid")) overrides.productGrid = params.get("grid")
  if (params.has("hideNoImage")) overrides.hideNoImage = params.get("hideNoImage") === "1"
  if (params.get("render") === "pdf") overrides.renderTarget = "pdf"
  return overrides
}

export function PrintProvider({ children }) {
  const [settings, setSettings] = useState(() => ({
    ...readStoredSettings(),
    ...readQueryOverrides(),
  }))

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const { renderTarget, ...storedSettings } = settings
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSettings))
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
      renderTarget: settings.renderTarget,
      isPdfRender: settings.renderTarget === "pdf",
    }}>
      {children}
    </PrintContext.Provider>
  )
}

export function usePrint() {
  return useContext(PrintContext)
}
