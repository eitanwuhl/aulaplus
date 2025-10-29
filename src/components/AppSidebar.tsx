import { useState } from "react"
import { 
  Home, 
  Users, 
  FileText, 
  Calendar, 
  BarChart3, 
  Settings,
  BookOpen,
  ClipboardList,
  FolderOpen
} from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"

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
      <SidebarHeader className="border-b border-border p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-primary-foreground" />
          </div>
          {open && (
            <div className="flex flex-col">
              <h2 className="text-sm font-semibold text-sidebar-foreground">Aula+</h2>
              <p className="text-xs text-sidebar-foreground/70">Plataforma Educativa</p>
            </div>
          )}
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