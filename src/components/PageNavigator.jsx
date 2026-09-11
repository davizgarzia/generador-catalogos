import { forwardRef, useEffect, useMemo, useRef, useState } from "react"
import { ChevronRight } from "lucide-react"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

const MAX_SEARCH_RESULTS = 30
// Una página solo se marca activa si sigue siendo la visible tras esta pausa;
// evita que un scroll rápido active en cascada todas las intermedias.
const ACTIVE_SETTLE_MS = 150

export default function PageNavigator({ pages, sections, searchItems = [], rootRef }) {
  const [active, setActive] = useState(0)
  const [openSections, setOpenSections] = useState(() => new Set())
  const [query, setQuery] = useState("")
  const itemRefs = useRef([])
  const hasScrolledOnceRef = useRef(false)
  const suppressObserverRef = useRef(false)
  const settleTimerRef = useRef(null)

  useEffect(() => {
    const targets = pages
      .map((page, i) => [page.ref?.current, i])
      .filter(([el]) => Boolean(el))
    if (!targets.length) return

    const indexByElement = new Map(targets)
    let pending = null
    const observer = new IntersectionObserver(
      entries => {
        if (suppressObserverRef.current) return
        for (const entry of entries) {
          if (entry.isIntersecting) {
            pending = indexByElement.get(entry.target)
          }
        }
        if (pending == null) return
        window.clearTimeout(settleTimerRef.current)
        settleTimerRef.current = window.setTimeout(() => {
          if (!suppressObserverRef.current && pending != null) setActive(pending)
        }, ACTIVE_SETTLE_MS)
      },
      { threshold: 0.5 }
    )
    targets.forEach(([el]) => observer.observe(el))
    return () => {
      observer.disconnect()
      window.clearTimeout(settleTimerRef.current)
    }
  }, [pages])

  useEffect(() => {
    const el = itemRefs.current[active]
    if (!el) return
    el.scrollIntoView({
      block: "nearest",
      behavior: hasScrolledOnceRef.current ? "smooth" : "instant",
    })
    hasScrolledOnceRef.current = true
  }, [active])

  // Auto-abre la sección al entrar en ella (una vez): después el usuario puede
  // colapsarla aunque siga siendo la activa.
  const activeSectionLabel = useMemo(() => {
    for (const section of sections) {
      if (section.type === "category" && section.children.some(child => child.index === active)) {
        return section.label
      }
    }
    return null
  }, [sections, active])

  const prevActiveSectionRef = useRef(null)
  useEffect(() => {
    if (activeSectionLabel && activeSectionLabel !== prevActiveSectionRef.current) {
      setOpenSections(prev => new Set(prev).add(activeSectionLabel))
    }
    prevActiveSectionRef.current = activeSectionLabel
  }, [activeSectionLabel])

  const trimmedQuery = query.trim().toLowerCase()
  const results = useMemo(() => {
    if (!trimmedQuery) return []
    return searchItems
      .filter(item => `${item.id} ${item.name}`.toLowerCase().includes(trimmedQuery))
      .slice(0, MAX_SEARCH_RESULTS)
  }, [searchItems, trimmedQuery])

  function goTo(index) {
    setActive(index)
    // El scroll suave atraviesa las páginas intermedias; silenciamos el observer
    // hasta que el desplazamiento se asienta para no activarlas en cascada.
    suppressObserverRef.current = true
    pages[index]?.ref?.current?.scrollIntoView({ behavior: "smooth", block: "center" })

    const root = rootRef?.current
    let releaseTimer = window.setTimeout(release, 1500)
    function release() {
      window.clearTimeout(releaseTimer)
      root?.removeEventListener("scroll", onScroll)
      suppressObserverRef.current = false
    }
    function onScroll() {
      window.clearTimeout(releaseTimer)
      releaseTimer = window.setTimeout(release, ACTIVE_SETTLE_MS)
    }
    root?.addEventListener("scroll", onScroll, { passive: true })
  }

  function registerItem(index) {
    return el => {
      if (el) itemRefs.current[index] = el
      else delete itemRefs.current[index]
    }
  }

  return (
    <nav
      aria-label="Páginas del catálogo"
      className="app-chrome w-[250px] shrink-0 bg-background border-r border-border flex flex-col min-h-0 h-full overflow-hidden"
    >
      <Command shouldFilter={false} className="flex-1 min-h-0 flex flex-col rounded-none bg-transparent">
        <CommandInput
          placeholder="Buscar producto…"
          value={query}
          onValueChange={setQuery}
        />

        {trimmedQuery ? (
          <CommandList className="flex-1 min-h-0 max-h-none">
            <CommandEmpty>Ningún producto coincide.</CommandEmpty>
            {results.map(item => (
              <CommandItem
                key={item.id}
                value={item.id}
                onSelect={() => {
                  goTo(item.index)
                  setQuery("")
                }}
                className="mx-1 flex items-center justify-between gap-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs">{item.name}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {item.id} · {item.category}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  pág. {pages[item.index]?.pageNum}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="flex flex-col gap-0.5 p-2">
              {sections.map(section => {
                if (section.type === "page") {
                  return (
                    <PageRow
                      key={`page-${section.index}`}
                      ref={registerItem(section.index)}
                      label={section.label}
                      pageNum={pages[section.index]?.pageNum}
                      isActive={active === section.index}
                      onClick={() => goTo(section.index)}
                    />
                  )
                }

                const containsActive = section.children.some(child => child.index === active)
                const open = openSections.has(section.label)

                return (
                  <Collapsible
                    key={`cat-${section.label}`}
                    open={open}
                    onOpenChange={value => {
                      setOpenSections(prev => {
                        const next = new Set(prev)
                        if (value) next.add(section.label)
                        else next.delete(section.label)
                        return next
                      })
                    }}
                  >
                    <div
                      className={cn(
                        "flex w-full min-w-0 items-center rounded-md",
                        containsActive ? "bg-accent/60" : "hover:bg-accent/40"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          goTo(section.children[0].index)
                          setOpenSections(prev => new Set(prev).add(section.label))
                        }}
                        className={cn(
                          "flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-xs",
                          containsActive
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        title={section.label}
                      >
                        <span
                          aria-hidden="true"
                          className="size-2.5 shrink-0 rounded-full border border-black/10"
                          style={{ background: section.color ?? "var(--muted)" }}
                        />
                        <span className="min-w-0 truncate">{section.label}</span>
                      </button>
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          aria-label={`${open ? "Contraer" : "Expandir"} ${section.label}`}
                          className="shrink-0 cursor-pointer p-1.5 text-muted-foreground hover:text-foreground"
                        >
                          <ChevronRight
                            className={cn("size-3.5 transition-transform", open && "rotate-90")}
                          />
                        </button>
                      </CollapsibleTrigger>
                    </div>

                    <CollapsibleContent>
                      <div className="ml-3 flex flex-col gap-0.5 border-l border-border pl-1.5 pt-0.5">
                        {section.children.map(child => (
                          <PageRow
                            key={`page-${child.index}`}
                            ref={registerItem(child.index)}
                            label={child.label}
                            pageNum={pages[child.index]?.pageNum}
                            isActive={active === child.index}
                            onClick={() => goTo(child.index)}
                          />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}
            </div>
          </div>
        )}
      </Command>
    </nav>
  )
}

const PageRow = forwardRef(function PageRow({ label, pageNum, isActive, onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs",
        isActive
          ? "bg-accent font-semibold text-foreground"
          : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
      )}
      title={label}
    >
      <span className="min-w-0 truncate">{label}</span>
      {pageNum != null && (
        <span
          className={cn(
            "shrink-0 tabular-nums text-[10px]",
            !isActive && "text-muted-foreground/70"
          )}
        >
          {pageNum}
        </span>
      )}
    </button>
  )
})
