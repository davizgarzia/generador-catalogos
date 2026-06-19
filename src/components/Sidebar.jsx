import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { usePrint } from "../context/PrintContext"
import { useEdit } from "../context/EditContext"
import { useOverrides } from "../context/OverridesContext"
import { useAuth } from "../context/AuthContext"
import EditSidebar from "./EditSidebar"
import ImportExcelButton from "./ImportExcelButton"
import ImportImagesButton from "./ImportImagesButton"
import ProductManager from "./ProductManager"
import CatalogSettings from "./CatalogSettings"

export default function Sidebar() {
  const {
    printMode, setPrintMode, printSize, setPrintSize, draftQuality, setDraftQuality,
    productGrid, setProductGrid, hideNoImage, setHideNoImage,
  } = usePrint()
  const { editingProduct } = useEdit()
  const { saveError, setSaveError } = useOverrides()
  const { isAdmin } = useAuth()
  const [productsOpen, setProductsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <aside style={{
        position: "fixed", right: 0, top: 44, bottom: 0, width: 220, background: "#fff",
        borderLeft: "1px solid #e5e7eb", display: "flex", flexDirection: "column",
        zIndex: 40, overflowY: "auto",
      }} className="app-chrome">
        {editingProduct && isAdmin ? (
          <>
            {saveError && <ErrorBanner message={saveError} onClose={() => setSaveError("")} />}
            <EditSidebar />
          </>
        ) : (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {saveError && <ErrorBanner message={saveError} onClose={() => setSaveError("")} />}
            <Section>Vista</Section>
            <Toggle label="Marcas de corte" checked={printMode} onChange={setPrintMode} />
            <Toggle label="Calidad borrador" checked={draftQuality} onChange={setDraftQuality} />
            <Toggle label="Ocultar sin imagen" checked={hideNoImage} onChange={setHideNoImage} />

            <label style={{ fontSize: 11, color: "#6b7280" }}>Referencias por hoja</label>
            <div style={{ display: "flex", gap: 5 }}>
              {["3x3", "4x3", "4x4"].map(value => (
                <Button key={value} size="sm" variant={productGrid === value ? "default" : "outline"}
                  onClick={() => setProductGrid(value)} style={{ flex: 1, padding: 0 }}>
                  {value.replace("x", "×")}
                </Button>
              ))}
            </div>

            {printMode && (
              <div style={{ display: "flex", gap: 5 }}>
                {["A4", "A5"].map(value => (
                  <Button key={value} size="sm" variant={printSize === value ? "default" : "outline"}
                    onClick={() => setPrintSize(value)} style={{ flex: 1 }}>
                    {value}
                  </Button>
                ))}
              </div>
            )}

            {isAdmin && (
              <>
                <hr style={{ width: "100%", border: 0, borderTop: "1px solid #e5e7eb" }} />
                <Section>Administración</Section>
                <Button size="sm" variant="outline" onClick={() => setProductsOpen(true)}>Gestionar productos</Button>
                <ImportExcelButton />
                <ImportImagesButton />
                <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>Configurar catálogo</Button>

                <hr style={{ width: "100%", border: 0, borderTop: "1px solid #e5e7eb" }} />
                <Section>Procesado de imágenes</Section>
                <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.4 }}>
                  Quitar fondo y autoajustar estarán disponibles cuando se conecte el backend de procesamiento.
                </div>
              </>
            )}
          </div>
        )}
      </aside>
      <ProductManager open={productsOpen} onClose={() => setProductsOpen(false)} />
      <CatalogSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}

function Section({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".06em" }}>{children}</div>
}

function Toggle({ label, checked, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <span style={{ fontSize: 13, color: "#374151" }}>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function ErrorBanner({ message, onClose }) {
  return (
    <div style={{ padding: 9, borderRadius: 6, background: "#fef2f2", color: "#991b1b", fontSize: 11 }}>
      {message}
      <button onClick={onClose} style={{ float: "right", border: 0, background: "transparent" }}>×</button>
    </div>
  )
}
