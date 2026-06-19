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

createRoot(document.getElementById("root")).render(
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
