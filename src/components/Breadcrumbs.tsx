import { useLocation, Link } from "react-router-dom"
import { ChevronRight, Home } from "lucide-react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

// Route configuration for breadcrumbs
const routeConfig: Record<string, { label: string; parent?: string }> = {
  "/": { label: "Inicio" },
  "/evaluaciones": { label: "Evaluaciones Grupales", parent: "/" },
  "/evaluaciones/nuevo": { label: "Generar Evaluación", parent: "/evaluaciones" },
  "/mis-evaluaciones": { label: "Mis Evaluaciones", parent: "/evaluaciones" },
  "/planificacion": { label: "Planificación de Clase", parent: "/" },
  "/diagnostico": { label: "Diagnóstico Individual", parent: "/" },
  "/reportes": { label: "Reportes Ejecutivos", parent: "/" },
  "/analytics": { label: "Análisis y Estadísticas", parent: "/" },
}

export function Breadcrumbs() {
  const location = useLocation()
  const currentPath = location.pathname

  // Build breadcrumb trail
  const buildBreadcrumbs = (path: string): Array<{ path: string; label: string }> => {
    const breadcrumbs: Array<{ path: string; label: string }> = []
    
    const addBreadcrumb = (currentPath: string) => {
      const config = routeConfig[currentPath]
      if (config) {
        breadcrumbs.unshift({ path: currentPath, label: config.label })
        
        // Add parent breadcrumbs recursively
        if (config.parent && config.parent !== currentPath) {
          addBreadcrumb(config.parent)
        }
      }
    }
    
    addBreadcrumb(path)
    return breadcrumbs
  }

  const breadcrumbs = buildBreadcrumbs(currentPath)

  // Don't show breadcrumbs on home page
  if (currentPath === "/" || breadcrumbs.length <= 1) {
    return null
  }

  return (
    <Breadcrumb className="flex items-center">
      <BreadcrumbList>
        {breadcrumbs.map((breadcrumb, index) => {
          const isLast = index === breadcrumbs.length - 1
          
          return (
            <div key={breadcrumb.path} className="flex items-center">
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="text-foreground font-medium">
                    {breadcrumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link 
                      to={breadcrumb.path} 
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {breadcrumb.path === "/" ? (
                        <Home className="h-4 w-4" />
                      ) : (
                        breadcrumb.label
                      )}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              
              {!isLast && (
                <BreadcrumbSeparator>
                  <ChevronRight className="h-4 w-4" />
                </BreadcrumbSeparator>
              )}
            </div>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}