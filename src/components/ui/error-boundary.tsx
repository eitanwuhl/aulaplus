import React from "react"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import { Button } from "./button"
import { Card, CardContent, CardHeader, CardTitle } from "./card"

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<{ error: Error; retry: () => void }> },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const CustomFallback = this.props.fallback
      
      if (CustomFallback) {
        return (
          <CustomFallback 
            error={this.state.error!} 
            retry={() => this.setState({ hasError: false, error: null })}
          />
        )
      }

      return <DefaultErrorFallback error={this.state.error!} retry={() => this.setState({ hasError: false, error: null })} />
    }

    return this.props.children
  }
}

// Default error fallback component
const DefaultErrorFallback = ({ error, retry }: { error: Error; retry: () => void }) => (
  <div className="flex items-center justify-center min-h-[400px] p-4">
    <Card className="max-w-md w-full">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-destructive" />
        </div>
        <CardTitle className="text-destructive">¡Algo salió mal!</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          Se produjo un error inesperado. Puedes intentar recargar o volver al inicio.
        </p>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="text-left text-xs bg-muted p-2 rounded">
            <summary className="cursor-pointer font-medium mb-2">Detalles del error</summary>
            <pre className="whitespace-pre-wrap text-destructive">
              {error.message}
              {error.stack}
            </pre>
          </details>
        )}
        
        <div className="flex gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={retry}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar
          </Button>
          <Button variant="default" size="sm" onClick={() => window.location.href = '/'}>
            <Home className="w-4 h-4 mr-2" />
            Ir al inicio
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
)

// Specialized error states
export const NotFoundError = ({ title = "Página no encontrada", message = "La página que buscas no existe." }) => (
  <div className="flex items-center justify-center min-h-[400px] p-4">
    <Card className="max-w-md w-full text-center">
      <CardContent className="pt-6">
        <div className="text-6xl mb-4">🔍</div>
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <p className="text-muted-foreground mb-6">{message}</p>
        <Button onClick={() => window.location.href = '/'}>
          <Home className="w-4 h-4 mr-2" />
          Volver al inicio
        </Button>
      </CardContent>
    </Card>
  </div>
)

export const NetworkError = ({ retry }: { retry: () => void }) => (
  <div className="flex items-center justify-center min-h-[400px] p-4">
    <Card className="max-w-md w-full text-center">
      <CardContent className="pt-6">
        <div className="text-6xl mb-4">📡</div>
        <h2 className="text-2xl font-bold mb-2">Error de conexión</h2>
        <p className="text-muted-foreground mb-6">
          No se pudo conectar con el servidor. Verifica tu conexión a internet.
        </p>
        <Button onClick={retry}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Reintentar
        </Button>
      </CardContent>
    </Card>
  </div>
)

export { ErrorBoundary }