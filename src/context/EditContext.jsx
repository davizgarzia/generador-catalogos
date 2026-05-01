import { createContext, useContext, useState } from "react"

const EditContext = createContext(null)

export function EditProvider({ children }) {
  const [editingProduct, setEditingProduct] = useState(null) // product object | null

  return (
    <EditContext.Provider value={{ editingProduct, setEditingProduct }}>
      {children}
    </EditContext.Provider>
  )
}

export function useEdit() {
  return useContext(EditContext)
}
