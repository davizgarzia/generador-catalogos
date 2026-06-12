import { createContext, useCallback, useContext, useEffect, useState } from "react"

const API = "http://localhost:3001/api"

const OverridesContext = createContext(null)

export function OverridesProvider({ children }) {
  const [overrides, setOverrides] = useState({})
  const [saveError, setSaveError] = useState("")

  // Carga inicial
  useEffect(() => {
    fetch(`${API}/overrides`)
      .then(r => r.json())
      .then(setOverrides)
      .catch(() => setSaveError("No se pudieron cargar los ajustes. ¿Está corriendo npm run dev:all?"))
  }, [])

  // Actualiza un campo de un producto y persiste en el servidor
  const patchOverride = useCallback(async (id, fields) => {
    let previous
    // Optimistic update
    setOverrides(prev => {
      previous = prev
      return {
        ...prev,
        [id]: { ...(prev[id] ?? {}), ...fields },
      }
    })
    try {
      setSaveError("")
      const res = await fetch(`${API}/overrides/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (error) {
      if (previous) setOverrides(previous)
      setSaveError(`No se ha guardado el ajuste de ${id}. ¿Está corriendo npm run dev:all?`)
      console.error("Error guardando override", id, fields, error)
    }
  }, [])

  // Devuelve el producto con sus overrides mergeados
  const applyOverride = useCallback((product) => {
    const o = overrides[product.id]
    if (!o) return product
    return {
      ...product,
      name:        o.name        ?? product.name,
      unitsLabel:  o.unitsLabel  ?? product.unitsLabel,
      imgHidden:   o.imgHidden   ?? false,
      imgX:        o.imgX        ?? 0,
      imgY:        o.imgY        ?? 0,
      imgScale:    o.imgScale    ?? 1,
      imgMode:     o.imgMode     ?? "original",
    }
  }, [overrides])

  return (
    <OverridesContext.Provider value={{ overrides, patchOverride, applyOverride, saveError, setSaveError }}>
      {children}
    </OverridesContext.Provider>
  )
}

export function useOverrides() {
  return useContext(OverridesContext)
}
