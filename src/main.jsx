import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App"
import { PrintProvider } from "./context/PrintContext"

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PrintProvider>
      <App />
    </PrintProvider>
  </StrictMode>
)
