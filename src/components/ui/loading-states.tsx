import { Skeleton } from "./skeleton"
import { Card, CardContent, CardHeader } from "./card"
import { LoadingSpinner } from "./loading-spinner"

// Component skeletons for different UI elements
export const StudentCardSkeleton = () => (
  <Card className="animate-fade-in">
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </CardContent>
  </Card>
)

export const GroupCardSkeleton = () => (
  <Card className="animate-fade-in">
    <CardHeader className="text-center">
      <Skeleton className="w-12 h-12 rounded-full mx-auto mb-3" />
      <Skeleton className="h-6 w-32 mx-auto mb-2" />
      <Skeleton className="h-4 w-20 mx-auto" />
    </CardHeader>
    <CardContent>
      <div className="text-center">
        <Skeleton className="h-4 w-28 mx-auto mb-4" />
        <Skeleton className="h-10 w-full" />
      </div>
    </CardContent>
  </Card>
)

export const ProfileSkeleton = () => (
  <div className="space-y-6 animate-fade-in">
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
      </CardHeader>
    </Card>
    
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
)

export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <Card className="animate-fade-in">
    <CardHeader>
      <Skeleton className="h-6 w-40" />
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="grid grid-cols-4 gap-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
)

// Loading states with spinner and message
export const LoadingState = ({ 
  message = "Cargando...", 
  size = "md" 
}: { 
  message?: string
  size?: "sm" | "md" | "lg" 
}) => (
  <div className="flex flex-col items-center justify-center p-8 text-center animate-fade-in">
    <LoadingSpinner size={size} className="mb-4" />
    <p className="text-muted-foreground">{message}</p>
  </div>
)

export const InlineLoadingState = ({ message = "Cargando..." }: { message?: string }) => (
  <div className="flex items-center gap-2 py-2 animate-fade-in">
    <LoadingSpinner size="sm" />
    <span className="text-sm text-muted-foreground">{message}</span>
  </div>
)