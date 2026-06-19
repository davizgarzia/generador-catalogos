import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { loadProductOverrides, saveProductOverride } from "../lib/catalog"
import { useCatalog } from "./CatalogContext"
import { useAuth } from "./AuthContext"

const OverridesContext = createContext(null)
const SAVE_DEBOUNCE_MS = 400

export function OverridesProvider({ children }) {
  const { catalog } = useCatalog()
  const { isAdmin } = useAuth()
  const [overrides, setOverrides] = useState({})
  const [saveError, setSaveError] = useState("")
  const pendingFieldsRef = useRef(new Map())
  const pendingTimersRef = useRef(new Map())

  useEffect(() => {
    if (!catalog?.id) return
    loadProductOverrides(catalog.id)
      .then(setOverrides)
      .catch(() => setSaveError("No se pudieron cargar los ajustes desde Supabase."))
  }, [catalog?.id])

  const flushPending = useCallback(async id => {
    const fields = pendingFieldsRef.current.get(id)
    pendingFieldsRef.current.delete(id)
    pendingTimersRef.current.delete(id)
    if (!fields || !catalog?.id) return
    try {
      setSaveError("")
      await saveProductOverride(catalog.id, id, fields)
    } catch (error) {
      setSaveError(`No se ha guardado el ajuste de ${id}.`)
      console.error("Error guardando ajuste", id, fields, error)
    }
  }, [catalog?.id])

  useEffect(() => {
    return () => {
      for (const timerId of pendingTimersRef.current.values()) {
        clearTimeout(timerId)
      }
      pendingTimersRef.current.clear()
      pendingFieldsRef.current.clear()
    }
  }, [])

  const patchOverride = useCallback((id, fields) => {
    if (!isAdmin || !catalog?.id) {
      setSaveError("Debes iniciar sesión como administrador para editar.")
      return
    }

    setOverrides(current => ({
      ...current,
      [id]: { ...(current[id] ?? {}), ...fields },
    }))

    const merged = { ...(pendingFieldsRef.current.get(id) ?? {}), ...fields }
    pendingFieldsRef.current.set(id, merged)

    const existingTimer = pendingTimersRef.current.get(id)
    if (existingTimer) clearTimeout(existingTimer)
    const timerId = setTimeout(() => flushPending(id), SAVE_DEBOUNCE_MS)
    pendingTimersRef.current.set(id, timerId)
  }, [catalog?.id, isAdmin, flushPending])

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
