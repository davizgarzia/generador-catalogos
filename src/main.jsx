import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App"
import { PrintProvider } from "./context/PrintContext"
import { EditProvider } from "./context/EditContext"
import { OverridesProvider } from "./context/OverridesContext"

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PrintProvider>
      <OverridesProvider>
        <EditProvider>
          <App />
        </EditProvider>
      </OverridesProvider>
    </PrintProvider>
  </StrictMode>
)
