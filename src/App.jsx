import { Fragment, Suspense, lazy } from "react"
import { Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom"
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
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { useAuth } from "./context/AuthContext"
import { useCatalog } from "./context/CatalogContext"
import AppSidebar from "./components/AppSidebar"
import LoginPage from "./pages/LoginPage"

const CatalogPage = lazy(() => import("./pages/CatalogPage"))
const CatalogsPage = lazy(() => import("./pages/CatalogsPage"))
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

function useBreadcrumbItems() {
  const location = useLocation()
  const { catalog, catalogs } = useCatalog()
  const pathname = location.pathname

  if (pathname.startsWith("/products")) return [{ label: "Productos", to: "/products" }]
  if (pathname.startsWith("/settings")) return [{ label: "Ajustes", to: "/settings" }]
  if (pathname.startsWith("/catalogs")) {
    const items = [{ label: "Catálogos", to: "/catalogs" }]
    const slug = pathname.split("/")[2]
    if (slug) {
      const name =
        (catalog?.slug === slug ? catalog.name : null) ??
        catalogs.find(item => item.slug === slug)?.name ??
        slug
      items.push({ label: name, to: pathname })
    }
    return items
  }
  return []
}

function AppShell() {
  const items = useBreadcrumbItems()

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
                <BreadcrumbItem className="hidden md:inline-flex">
                  <BreadcrumbLink asChild className="text-muted-foreground hover:text-foreground">
                    <Link to="/products">Impormed</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {items.length > 0 && <BreadcrumbSeparator className="hidden md:block" />}
                {items.map((item, index) => {
                  const isLast = index === items.length - 1
                  return (
                    <Fragment key={item.to}>
                      <BreadcrumbItem>
                        {isLast ? (
                          <BreadcrumbPage className="text-base font-medium max-w-[40vw] truncate">
                            {item.label}
                          </BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link to={item.to}>{item.label}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {!isLast && <BreadcrumbSeparator />}
                    </Fragment>
                  )
                })}
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
            <Route path="/catalogs" element={<CatalogsPage />} />
            <Route path="/catalogs/:slug" element={<CatalogPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/products" replace />} />
      </Routes>
    </TooltipProvider>
  )
}
