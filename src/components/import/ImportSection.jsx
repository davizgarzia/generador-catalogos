import { ChevronRight } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// Sección plegable de los diálogos de importación: título + contador + contenido scrolleable.
export default function ImportSection({ title, count, tone = "default", defaultOpen = false, children }) {
  if (!count) return null

  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-lg border border-border">
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm group">
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        <span
          className={cn(
            "flex-1 min-w-0 truncate font-medium",
            tone === "destructive" && "text-destructive",
            tone === "muted" && "text-muted-foreground"
          )}
        >
          {title}
        </span>
        <Badge variant={tone === "destructive" ? "destructive" : "secondary"}>{count}</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="max-h-64 overflow-y-auto overflow-x-hidden border-t border-border">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
