import { forwardRef } from "react"
import { usePrint } from "../context/PrintContext"
import styles from "./PageWrapper.module.css"

const PageWrapper = forwardRef(function PageWrapper({ children, page, total }, ref) {
  const { printMode } = usePrint()

  return (
    <div className={printMode ? styles.sheet : styles.sheetNormal} ref={ref}>
      <div className={printMode ? styles.inner : styles.innerNormal}>
        {printMode && (
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
