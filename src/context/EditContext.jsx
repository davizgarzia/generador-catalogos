import { createContext, useCallback, useContext, useState } from "react"

const EditContext = createContext(null)

export function EditProvider({ children }) {
  const [editingProduct, setEditingProductState] = useState(null) // product object | null
  // Página especial en edición: { kind: "cover" | "filler" | "backcover", index } | null
  const [editingPage, setEditingPageState] = useState(null)

  // El sidebar es único: abrir una edición cierra la otra.
  const setEditingProduct = useCallback(product => {
    setEditingProductState(product)
    if (product) setEditingPageState(null)
  }, [])

  const setEditingPage = useCallback(page => {
    setEditingPageState(page)
    if (page) setEditingProductState(null)
  }, [])

  return (
    <EditContext.Provider value={{ editingProduct, setEditingProduct, editingPage, setEditingPage }}>
      {children}
    </EditContext.Provider>
  )
}

export function useEdit() {
  return useContext(EditContext)
}
