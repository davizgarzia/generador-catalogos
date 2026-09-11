import { Suspense, lazy } from "react"
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { useAuth } from "./context/AuthContext"
import AppSidebar from "./components/AppSidebar"
import LoginPage from "./pages/LoginPage"

const CatalogPage = lazy(() => import("./pages/CatalogPage"))
const ProductsPage = lazy(() => import("./pages/ProductsPage"))
const SettingsPage = lazy(() => import("./pages/SettingsPage"))

function RequireAuth() {
  const { user, isAdmin, loading, signOut } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-svh grid place-items-center text-sm text-muted-foreground">
        Comprobando sesión…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!isAdmin) {
    return (
      <div className="min-h-svh grid place-items-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-lg font-semibold">Cuenta sin permisos</h1>
          <p className="text-sm text-muted-foreground">
            Tu cuenta ({user.email}) no está autorizada para administrar el catálogo.
            Contacta con un administrador para que te dé acceso.
          </p>
          <button
            type="button"
            onClick={signOut}
            className="text-sm underline underline-offset-2 text-muted-foreground hover:text-foreground"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  return <Outlet />
}

function sectionLabel(pathname) {
  if (pathname.startsWith("/catalog")) return "Catálogo"
  if (pathname.startsWith("/products")) return "Productos"
  if (pathname.startsWith("/settings")) return "Ajustes"
  return ""
}

function AppShell() {
  const location = useLocation()
  const section = sectionLabel(location.pathname)

  return (
    <SidebarProvider
      className="overflow-hidden"
      style={{
        "--sidebar-width": "18rem",
        "--header-height": "3rem",
        height: "100svh",
        maxHeight: "100svh",
      }}
    >
      <AppSidebar variant="inset" />
      <SidebarInset className="min-w-0 min-h-0 overflow-hidden">
        <header className="app-chrome flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
          <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mx-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:inline-flex text-muted-foreground">
                  Impormed
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-base font-medium">
                    {section}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="app-main flex-1 min-h-0 min-w-0 relative">
          <div className="app-scroll absolute inset-0 flex flex-col overflow-y-auto">
            <Suspense
              fallback={
                <div className="p-6 text-sm text-muted-foreground">Cargando…</div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function App() {
  return (
    <TooltipProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/products" replace />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/products" replace />} />
      </Routes>
    </TooltipProvider>
  )
}
