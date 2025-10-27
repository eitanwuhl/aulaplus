import { ReactNode } from "react"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"
import { Breadcrumbs } from "./Breadcrumbs"
import { Bell, Search, User, LogOut } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { FloatingCommunicationButton } from "./FloatingCommunicationButton"

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { logout, user } = useAuth();
  const { toast } = useToast();

  const handleLogout = () => {
    logout();
    toast({
      title: "Sesión cerrada",
      description: "Has cerrado sesión exitosamente.",
    });
  };

  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-4 gap-4">
              <SidebarTrigger className="h-9 w-9" />
              
              <div className="flex-1 flex items-center justify-between">
                <Breadcrumbs />
                
                  <div className="flex items-center gap-2">
                    <div className="relative max-w-sm">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input 
                        placeholder="Buscar estudiantes, grupos..."
                        className="pl-9 h-8 w-64"
                      />
                    </div>
                    
                    <span className="text-sm text-foreground-subtle hidden md:block">
                      {user?.name}
                    </span>
                    
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Bell className="h-4 w-4" />
                    </Button>
                    
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <User className="h-4 w-4" />
                    </Button>

                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      onClick={handleLogout}
                      title="Cerrar sesión"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            <div className="container mx-auto p-6">
              {children}
            </div>
          </main>
        </div>
        
        {/* Floating Communication Button */}
        <FloatingCommunicationButton />
      </div>
    </SidebarProvider>
  )
}