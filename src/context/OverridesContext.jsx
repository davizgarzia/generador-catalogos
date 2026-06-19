import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { loadProductOverrides, saveProductOverride } from "../lib/catalog"
import { useCatalog } from "./CatalogContext"
import { useAuth } from "./AuthContext"

const OverridesContext = createContext(null)

export function OverridesProvider({ children }) {
  const { catalog } = useCatalog()
  const { isAdmin } = useAuth()
  const [overrides, setOverrides] = useState({})
  const [saveError, setSaveError] = useState("")

  useEffect(() => {
    if (!catalog?.id) return
    loadProductOverrides(catalog.id)
      .then(setOverrides)
      .catch(() => setSaveError("No se pudieron cargar los ajustes desde Supabase."))
  }, [catalog?.id])

  const patchOverride = useCallback(async (id, fields) => {
    if (!isAdmin || !catalog?.id) {
      setSaveError("Debes iniciar sesión como administrador para editar.")
      return
    }

    let previous
    setOverrides(current => {
      previous = current
      return {
        ...current,
        [id]: { ...(current[id] ?? {}), ...fields },
      }
    })

    try {
      setSaveError("")
      await saveProductOverride(catalog.id, id, fields)
    } catch (error) {
      if (previous) setOverrides(previous)
      setSaveError(`No se ha guardado el ajuste de ${id}.`)
      console.error("Error guardando ajuste", id, fields, error)
    }
  }, [catalog?.id, isAdmin])

  const applyOverride = useCallback(product => {
    const override = overrides[product.id]
    return override ? { ...product, ...override } : product
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
