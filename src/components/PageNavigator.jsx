import { useState, useEffect, useRef } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

// Dimensiones fijas del área imprimible sin sangre (innerNormal: 210×297mm a 96dpi)
const MM = 3.7795275591
const INNER_W_PX = Math.round(210 * MM)  // ~794px
const INNER_H_PX = Math.round(297 * MM)  // ~1123px
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
      for (const img of clone.querySelectorAll("img")) {
        img.removeAttribute("srcset")
        const src = img.getAttribute("src")
        if (!src) continue
        if (/[?&]width=/.test(src)) {
          img.setAttribute(
            "src",
            src
              .replace(/([?&])width=\d+/g, "$1width=140")
              .replace(/([?&])height=\d+/g, "$1height=140")
              .replace(/([?&])quality=\d+/g, "$1quality=55")
          )
          img.loading = "lazy"
          img.decoding = "async"
        }
      }
      container.innerHTML = ""
      container.appendChild(clone)
    }

    const raf = requestAnimationFrame(render)
    const observer = new MutationObserver(render)
    observer.observe(inner, { childList: true, subtree: true })

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      container.innerHTML = ""
    }
  }, [pageRef])

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-sm bg-background shrink-0 transition-colors",
        isActive ? "border-2 border-primary" : "border border-border"
      )}
      style={{ width: THUMB_W, height: THUMB_H }}
    >
      <div ref={containerRef} className="absolute inset-0 overflow-hidden" />
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
    <nav className="app-chrome w-[220px] shrink-0 bg-background border-r border-border flex flex-col min-h-0 h-full">
      <ScrollArea type="always" className="flex-1 min-h-0">
        <div className="flex flex-col gap-1.5 px-3 py-2.5">
          {pages.map((page, i) => (
            <Tooltip key={i} delayDuration={150}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => goTo(i)}
                  className="flex flex-col items-center gap-1 p-1.5 rounded-md w-full cursor-pointer text-left"
                >
                  <PageThumb pageRef={page.ref} isActive={active === i} />
                  <span
                    className={cn(
                      "text-[10px] leading-snug w-full overflow-hidden text-ellipsis whitespace-nowrap text-center",
                      active === i ? "text-foreground font-semibold" : "text-muted-foreground"
                    )}
                  >
                    {i + 1}. {page.label}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <strong>{i + 1}.</strong> {page.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </ScrollArea>
    </nav>
  )
}
