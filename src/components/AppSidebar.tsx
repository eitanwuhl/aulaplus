import { 
  Home, 
  Users, 
  FileText, 
  Calendar, 
  BarChart3, 
  Settings,
  ClipboardList,
  FolderOpen,
  Library
} from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"
import logo from "@/assets/logo/aulaplus-logo.png.png"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"

  const navigationItems = [
    { 
      title: "Inicio", 
      url: "/teacher-dashboard", 
      icon: Home,
      description: "Dashboard principal"
    },
  { 
    title: "Evaluaciones Grupales", 
    url: "/evaluaciones", 
    icon: Users,
    description: "Gestión de grupos y evaluaciones"
  },
  { 
    title: "Planificación de Clase", 
    url: "/planificacion", 
    icon: Calendar,
    description: "Herramientas de planificación"
  },
  { 
    title: "Mis Planificaciones", 
    url: "/mis-planificaciones", 
    icon: FolderOpen,
    description: "Planificaciones guardadas y contador de competencias"
  },
  { 
    title: "Biblioteca de Materiales", 
    url: "/biblioteca-materiales", 
    icon: Library,
    description: "Gestiona tus materiales docentes"
  },
]

const toolsItems = [
  { 
    title: "Diagnóstico Individual", 
    url: "/diagnostico", 
    icon: ClipboardList,
    description: "Evaluación individual de estudiantes"
  },
  { 
    title: "Reportes Ejecutivos", 
    url: "/reportes", 
    icon: FileText,
    description: "Generación de reportes"
  },
  { 
    title: "Análisis y Estadísticas", 
    url: "/analytics", 
    icon: BarChart3,
    description: "Métricas y análisis"
  },
]

export function AppSidebar() {
  const { open } = useSidebar()
  const location = useLocation()
  const currentPath = location.pathname

  const isActive = (path: string) => currentPath === path
  const getNavClassName = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-primary text-primary-foreground font-medium shadow-sm" 
      : "hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-accent-foreground"

  return (
    <Sidebar className={open ? "w-64" : "w-16"} collapsible="icon">
      <SidebarHeader className="border-b border-border py-4">
        <div className="flex items-center px-2" style={{ minHeight: '3.5rem', height: '100%' }}>
          <img 
            src={logo} 
            alt="Aula+" 
            className={`transition-all duration-200 object-contain ${
              open ? "max-h-[72px] w-auto" : "h-12 w-12"
            }`}
            style={{
              display: 'block'
            }}
            draggable="false"
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-sidebar-foreground/70 px-2 mb-2">
            {open ? "Navegación Principal" : "Nav"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-10 rounded-md">
                    <NavLink 
                      to={item.url} 
                      end 
                      className={getNavClassName}
                      title={!open ? item.description : undefined}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {open && (
                        <div className="flex flex-col items-start">
                          <span className="text-sm">{item.title}</span>
                        </div>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}