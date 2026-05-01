import { useState, useEffect } from "react"
import styles from "./PageNavigator.module.css"

export default function PageNavigator({ pages }) {
  const [active, setActive] = useState(0)

  // Detecta qué página está visible con IntersectionObserver
  useEffect(() => {
    const observers = []
    pages.forEach((page, i) => {
      if (!page.ref?.current) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(i) },
        { threshold: 0.5 }
      )
      obs.observe(page.ref.current)
      observers.push(obs)
    })
    return () => observers.forEach(o => o.disconnect())
  }, [pages])

  function goTo(i) {
    pages[i].ref?.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    setActive(i)
  }

  return (
    <nav className={styles.nav}>
      <div className={styles.header}>
        <span className={styles.title}>Páginas</span>
        <span className={styles.count}>{pages.length}</span>
      </div>
      <div className={styles.list}>
        {pages.map((page, i) => (
          <button
            key={i}
            className={`${styles.item} ${active === i ? styles.active : ""}`}
            onClick={() => goTo(i)}
          >
            <div className={styles.thumb} style={page.color ? { background: page.color } : {}}>
              {page.color ? (
                <span className={styles.thumbIcon}>{page.icon}</span>
              ) : (
                <div className={styles.thumbGrid}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <div key={j} className={styles.thumbCell} />
                  ))}
                </div>
              )}
            </div>
            <div className={styles.meta}>
              <span className={styles.pageNum}>{i + 1}</span>
              <span className={styles.pageLabel}>{page.label}</span>
            </div>
          </button>
        ))}
      </div>
    </nav>
  )
}
