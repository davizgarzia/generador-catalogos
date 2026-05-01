import { usePrint } from "../context/PrintContext"
import styles from "./Sidebar.module.css"

export default function Sidebar() {
  const { printMode, setPrintMode } = usePrint()

  return (
    <aside className={styles.sidebar}>
      <label className={styles.toggle}>
        <div
          className={`${styles.toggleTrack} ${printMode ? styles.on : ""}`}
          onClick={() => setPrintMode(v => !v)}
        >
          <div className={styles.toggleThumb} />
        </div>
        <span className={styles.toggleLabel}>Modo impresión</span>
      </label>

      <button className={styles.printBtn} onClick={() => window.print()}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 6 2 18 2 18 9"/>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
          <rect x="6" y="14" width="12" height="8"/>
        </svg>
        Guardar PDF
      </button>
    </aside>
  )
}
