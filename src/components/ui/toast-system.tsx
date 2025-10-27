import React from "react"
import { toast } from "sonner"
import { CheckCircle, AlertCircle, AlertTriangle, Info, X, Loader2 } from "lucide-react"

// Enhanced toast system with consistent styling
export const showToast = {
  success: (message: string, options?: { description?: string; action?: { label: string; onClick: () => void } }) => {
    toast.success(message, {
      description: options?.description,
      icon: <CheckCircle className="w-4 h-4" />,
      action: options?.action ? {
        label: options.action.label,
        onClick: options.action.onClick
      } : undefined,
      duration: 4000,
    })
  },

  error: (message: string, options?: { description?: string; action?: { label: string; onClick: () => void } }) => {
    toast.error(message, {
      description: options?.description,
      icon: <AlertCircle className="w-4 h-4" />,
      action: options?.action ? {
        label: options.action.label,
        onClick: options.action.onClick
      } : undefined,
      duration: 6000,
    })
  },

  warning: (message: string, options?: { description?: string; action?: { label: string; onClick: () => void } }) => {
    toast.warning(message, {
      description: options?.description,
      icon: <AlertTriangle className="w-4 h-4" />,
      action: options?.action ? {
        label: options.action.label,
        onClick: options.action.onClick
      } : undefined,
      duration: 5000,
    })
  },

  info: (message: string, options?: { description?: string; action?: { label: string; onClick: () => void } }) => {
    toast.info(message, {
      description: options?.description,
      icon: <Info className="w-4 h-4" />,
      action: options?.action ? {
        label: options.action.label,
        onClick: options.action.onClick
      } : undefined,
      duration: 4000,
    })
  },

  loading: (message: string, promise: Promise<any>, options?: { 
    success?: string
    error?: string
  }) => {
    toast.promise(promise, {
      loading: (
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {message}
        </div>
      ),
      success: options?.success || "Operación completada exitosamente",
      error: options?.error || "Ocurrió un error durante la operación",
    })
  },

  custom: (content: React.ReactNode, options?: { duration?: number }) => {
    toast.custom((id) => (
      <div className="bg-background border border-border rounded-lg p-4 shadow-lg">
        {content}
      </div>
    ), {
      duration: options?.duration || 4000,
    })
  }
}

// Predefined toast messages for common actions
export const commonToasts = {
  saved: () => showToast.success("Guardado exitosamente", { 
    description: "Los cambios se han guardado correctamente" 
  }),
  
  deleted: () => showToast.success("Eliminado exitosamente", { 
    description: "El elemento ha sido eliminado" 
  }),
  
  copied: () => showToast.success("Copiado al portapapeles"),
  
  networkError: () => showToast.error("Error de conexión", { 
    description: "Verifica tu conexión a internet e intenta nuevamente",
    action: { label: "Reintentar", onClick: () => window.location.reload() }
  }),
  
  formValidationError: (fieldName: string) => showToast.error("Error de validación", { 
    description: `El campo ${fieldName} es requerido o tiene un formato inválido` 
  }),
  
  permissionDenied: () => showToast.warning("Permisos insuficientes", { 
    description: "No tienes permisos para realizar esta acción" 
  }),
  
  featureComingSoon: () => showToast.info("Próximamente", { 
    description: "Esta funcionalidad estará disponible pronto" 
  }),
  
  loadingData: (promise: Promise<any>) => showToast.loading(
    "Cargando datos...", 
    promise,
    { 
      success: "Datos cargados exitosamente",
      error: "Error al cargar los datos" 
    }
  )
}

// Toast container component with enhanced styling
export const ToastContainer = () => (
  <div className="fixed top-4 right-4 z-50 max-w-sm w-full space-y-2" />
)