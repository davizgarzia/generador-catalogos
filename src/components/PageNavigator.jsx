import { useState, useEffect, useRef } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

// Dimensiones fijas del área imprimible sin sangre (innerNormal: 148×210mm a 96dpi)
const MM = 3.7795275591
const INNER_W_PX = Math.round(148 * MM)  // ~559px
const INNER_H_PX = Math.round(210 * MM)  // ~794px
const THUMB_W = 164
const THUMB_H = Math.round(THUMB_W * (INNER_H_PX / INNER_W_PX))
const SCALE = THUMB_W / INNER_W_PX

function PageThumb({ pageRef, isActive }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    const sheet = pageRef?.current
    if (!container || !sheet) return

    const inner = sheet.firstElementChild ?? sheet

    function render() {
      const clone = inner.cloneNode(true)
      // Forzar siempre las dimensiones del innerNormal, independiente del printMode
      clone.style.cssText = `
        position: absolute;
        top: 0; left: 0;
        width: ${INNER_W_PX}px;
        height: ${INNER_H_PX}px;
        transform: scale(${SCALE});
        transform-origin: top left;
        pointer-events: none;
        overflow: hidden;
      `
      container.innerHTML = ""
      container.appendChild(clone)
    }

    const raf = requestAnimationFrame(render)

    // Solo observar cambios de contenido (childList/subtree), no atributos de tamaño
    const observer = new MutationObserver(render)
    observer.observe(inner, { childList: true, subtree: true })

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      container.innerHTML = ""
    }
  }, [pageRef])

  return (
    <div style={{
      width: THUMB_W,
      height: THUMB_H,
      position: "relative",
      overflow: "hidden",
      borderRadius: 4,
      border: isActive ? "2px solid #111827" : "1px solid #e5e7eb",
      background: "#fff",
      flexShrink: 0,
      transition: "border-color 0.1s",
    }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0, overflow: "hidden" }} />
    </div>
  )
}

export default function PageNavigator({ pages }) {
  const [active, setActive] = useState(0)

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
    <nav style={{
      position: "fixed",
      left: 0, top: 44, bottom: 0,
      width: 220,
      background: "#ffffff",
      borderRight: "1px solid #e5e7eb",
      display: "flex",
      flexDirection: "column",
      zIndex: 40,
    }} className="app-chrome">
      <div style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
        }}>
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: "10px 12px",
        }}>
          {pages.map((page, i) => (
            <Tooltip key={i} delayDuration={150}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => goTo(i)}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    padding: "6px",
                    borderRadius: 6,
                    background: active === i ? "#f3f4f6" : "transparent",
                    transition: "background 0.1s",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                  onMouseEnter={e => { if (active !== i) e.currentTarget.style.background = "#f9fafb" }}
                  onMouseLeave={e => { if (active !== i) e.currentTarget.style.background = "transparent" }}
                >
                  <PageThumb pageRef={page.ref} isActive={active === i} />

                  <span style={{
                    fontSize: 10,
                    lineHeight: 1.3,
                    textAlign: "center",
                    color: active === i ? "#111827" : "#9ca3af",
                    fontWeight: active === i ? 600 : 400,
                    width: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {i + 1}. {page.label}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" style={{ fontSize: 12 }}>
                <strong>{i + 1}.</strong> {page.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </nav>
  )
}
