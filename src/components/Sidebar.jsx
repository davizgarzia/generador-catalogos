import { Switch } from "@/components/ui/switch"
import { usePrint } from "../context/PrintContext"

export default function Sidebar() {
  const { printMode, setPrintMode, printSize, setPrintSize } = usePrint()

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
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: "#9ca3af",
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          Vista
        </div>

        {/* Toggle marcas */}
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

        {/* Selector de tamaño — solo visible con marcas activas */}
        {printMode && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>
              Tamaño de impresión
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              {["A4", "A5"].map(size => (
                <button
                  key={size}
                  onClick={() => setPrintSize(size)}
                  style={{
                    flex: 1,
                    padding: "5px 0",
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: printSize === size ? "1.5px solid #111827" : "1.5px solid #e5e7eb",
                    background: printSize === size ? "#111827" : "#fff",
                    color: printSize === size ? "#fff" : "#374151",
                    cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

    </aside>
  )
}
