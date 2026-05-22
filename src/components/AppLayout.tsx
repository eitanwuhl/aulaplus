import { ReactNode } from "react"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"
import { Breadcrumbs } from "./Breadcrumbs"
import { LogOut } from "lucide-react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { FloatingCommunicationButton } from "./FloatingCommunicationButton"
import { GlobalSearch } from "@/components/dashboard/GlobalSearch"

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
            <div className="flex h-14 w-full items-center gap-3 px-4">
              <SidebarTrigger className="h-9 w-9 shrink-0" />

              <div className="min-w-0 flex-1">
                <Breadcrumbs />
              </div>

              <GlobalSearch />

              <div className="ml-auto flex shrink-0 items-center gap-2 border-l border-border pl-3">
                {user?.schoolName && (
                  <Badge variant="secondary" className="hidden font-normal sm:inline-flex">
                    {user.schoolName}
                  </Badge>
                )}
                <span className="max-w-[12rem] truncate text-sm text-foreground-subtle hidden md:block">
                  {user?.name}
                </span>
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