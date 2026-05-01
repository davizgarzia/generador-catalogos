import { forwardRef } from "react"
import { usePrint } from "../context/PrintContext"
import styles from "./PageWrapper.module.css"

const PageWrapper = forwardRef(function PageWrapper({ children, page, total }, ref) {
  const { printMode, printSize } = usePrint()

  const isA5 = printMode && printSize === "A5"

  // Sheet: siempre A4 cuando hay marcas (A5 se escala dentro del A4)
  const sheetClass = !printMode ? styles.sheetNormal : styles.sheet

  // Inner: en A5 el contenido se escala al 71.3% centrado
  const innerClass = !printMode
    ? styles.innerNormal
    : isA5
      ? styles.innerA5Scaled
      : styles.inner

  return (
    <div className={sheetClass} ref={ref}>

      {/* Marcas de corte A5: posicionadas en el sheet A4, apuntan a esquinas del A5 centrado */}
      {isA5 && (
        <>
          <div className={`${styles.cropMarkA5} ${styles["a5-tl-h"]}`} />
          <div className={`${styles.cropMarkA5} ${styles["a5-tl-v"]}`} />
          <div className={`${styles.cropMarkA5} ${styles["a5-tr-h"]}`} />
          <div className={`${styles.cropMarkA5} ${styles["a5-tr-v"]}`} />
          <div className={`${styles.cropMarkA5} ${styles["a5-bl-h"]}`} />
          <div className={`${styles.cropMarkA5} ${styles["a5-bl-v"]}`} />
          <div className={`${styles.cropMarkA5} ${styles["a5-br-h"]}`} />
          <div className={`${styles.cropMarkA5} ${styles["a5-br-v"]}`} />
        </>
      )}

      <div className={innerClass}>
        {/* Marcas de corte A4: relativas al inner A4 */}
        {printMode && !isA5 && (
          <>
            <div className={`${styles.cropMark} ${styles["tl-h"]}`} />
            <div className={`${styles.cropMark} ${styles["tl-v"]}`} />
            <div className={`${styles.cropMark} ${styles["tr-h"]}`} />
            <div className={`${styles.cropMark} ${styles["tr-v"]}`} />
            <div className={`${styles.cropMark} ${styles["bl-h"]}`} />
            <div className={`${styles.cropMark} ${styles["bl-v"]}`} />
            <div className={`${styles.cropMark} ${styles["br-h"]}`} />
            <div className={`${styles.cropMark} ${styles["br-v"]}`} />
          </>
        )}

        {children}

        {page != null && (
          <div className={styles.pagination}>
            <div className={styles.paginationLine} />
            <span className={styles.paginationText}>{page}</span>
            <div className={styles.paginationLine} />
          </div>
        )}
      </div>
    </div>
  )
})

export default PageWrapper
