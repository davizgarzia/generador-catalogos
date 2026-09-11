import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "./index.css"
import App from "./App"
import { PrintProvider } from "./context/PrintContext"
import { EditProvider } from "./context/EditContext"
import { OverridesProvider } from "./context/OverridesContext"
import { AuthProvider } from "./context/AuthContext"
import { CatalogProvider } from "./context/CatalogContext"
import { supabaseConfigError } from "./lib/supabase"

function ConfigError({ message }) {
  return (
    <div style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: "28rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
          Configuración incompleta
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#666" }}>{message}</p>
      </div>
    </div>
  )
}

createRoot(document.getElementById("root")).render(
  supabaseConfigError ? (
    <StrictMode>
      <ConfigError message={supabaseConfigError} />
    </StrictMode>
  ) : (
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CatalogProvider>
          <PrintProvider>
            <OverridesProvider>
              <EditProvider>
                <App />
              </EditProvider>
            </OverridesProvider>
          </PrintProvider>
        </CatalogProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
  )
)
