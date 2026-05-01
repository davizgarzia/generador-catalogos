import { createContext, useCallback, useContext, useEffect, useState } from "react"

const API = "http://localhost:3001/api"

const OverridesContext = createContext(null)

export function OverridesProvider({ children }) {
  const [overrides, setOverrides] = useState({})

  // Carga inicial
  useEffect(() => {
    fetch(`${API}/overrides`)
      .then(r => r.json())
      .then(setOverrides)
      .catch(() => {})
  }, [])

  // Actualiza un campo de un producto y persiste en el servidor
  const patchOverride = useCallback(async (id, fields) => {
    // Optimistic update
    setOverrides(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? {}), ...fields },
    }))
    try {
      await fetch(`${API}/overrides/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      })
    } catch {
      // Si falla el servidor la UI igual refleja el cambio en sesión
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
    }
  }, [overrides])

  return (
    <OverridesContext.Provider value={{ overrides, patchOverride, applyOverride }}>
      {children}
    </OverridesContext.Provider>
  )
}

export function useOverrides() {
  return useContext(OverridesContext)
}
