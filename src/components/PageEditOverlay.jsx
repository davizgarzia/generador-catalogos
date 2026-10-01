import { useAuth } from "../context/AuthContext"
import { useEdit } from "../context/EditContext"
import styles from "./PageEditOverlay.module.css"

// Overlay de edición de las páginas especiales (portada, hojas de relleno y
// contraportada): al pasar el ratón aparece el botón Editar, como en los
// productos. Solo en pantalla — nunca se imprime.
export default function PageEditOverlay({ kind, index = null }) {
  const { isAdmin } = useAuth()
  const { setEditingPage } = useEdit()

  if (!isAdmin) return null

  return (
    <div className={styles.overlay} onClick={() => setEditingPage({ kind, index })}>
      <div className={styles.editHint}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        Editar
      </div>
    </div>
  )
}
