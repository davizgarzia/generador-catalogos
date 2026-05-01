import { Switch } from "@/components/ui/switch"
import { usePrint } from "../context/PrintContext"

export default function Sidebar() {
  const { printMode, setPrintMode } = usePrint()

  return (
    <aside style={{
      position: "fixed",
      right: 0, top: 44, bottom: 0,
      width: 220,
      background: "#ffffff",
      borderLeft: "1px solid #e5e7eb",
      display: "flex",
      flexDirection: "column",
      zIndex: 40,
    }} className="app-chrome">

      {/* Marcas de corte */}
      <div style={{ padding: "16px" }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: "#9ca3af",
          textTransform: "uppercase", letterSpacing: "0.06em",
          marginBottom: 10,
        }}>
          Vista
        </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>
            Marcas de corte
          </span>
          <Switch
            id="print-mode-sidebar"
            checked={printMode}
            onCheckedChange={setPrintMode}
          />
        </div>
      </div>

    </aside>
  )
}
