
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AppLayout } from "./components/AppLayout";
import RoleSelection from "./components/RoleSelection";
import TeacherLogin from "./components/TeacherLogin";
import StudentLogin from "./components/StudentLogin";
import TeacherDashboard from "./components/TeacherDashboard";
import TeacherGroups from "./pages/TeacherGroups";
import StudentDiagnostic from "./pages/StudentDiagnostic";
import NotFound from "./pages/NotFound";
import EvaluacionesGrupo from "./pages/EvaluacionesGrupo";
import PlanificacionClase from "./pages/PlanificacionClase";
import PlanificacionWizard from "./pages/PlanificacionWizard";
import PlanificacionWorkspace from "./pages/PlanificacionWorkspace";
import MisPlanificaciones from "./pages/MisPlanificaciones";
import Comunicaciones from "./pages/Comunicaciones";

const queryClient = new QueryClient();

// Protected Route wrapper for teachers
const ProtectedTeacherRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  if (user?.role !== 'teacher') {
    return <Navigate to="/" replace />;
  }
  
  return <AppLayout>{children}</AppLayout>;
};

// Protected Route wrapper for students  
const ProtectedStudentRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  if (user?.role !== 'student') {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

// Main App Routes
const AppRoutes = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={
        isAuthenticated ? 
          (user?.role === 'teacher' ? <Navigate to="/teacher-dashboard" replace /> : <Navigate to="/student-diagnostic" replace />) :
          <RoleSelection />
      } />
      <Route path="/teacher-login" element={<TeacherLogin />} />
      <Route path="/student-login" element={<StudentLogin />} />
      
      {/* Protected Teacher Routes */}
      <Route path="/teacher-dashboard" element={
        <ProtectedTeacherRoute>
          <TeacherDashboard />
        </ProtectedTeacherRoute>
      } />
      <Route path="/teacher-groups" element={
        <ProtectedTeacherRoute>
          <TeacherGroups />
        </ProtectedTeacherRoute>
      } />
      <Route path="/evaluaciones" element={
        <ProtectedTeacherRoute>
          <EvaluacionesGrupo />
        </ProtectedTeacherRoute>
      } />
      <Route path="/planificacion" element={
        <ProtectedTeacherRoute>
          <PlanificacionClase />
        </ProtectedTeacherRoute>
      } />
      <Route path="/planificacion/nuevo" element={
        <ProtectedTeacherRoute>
          <PlanificacionWizard />
        </ProtectedTeacherRoute>
      } />
      <Route path="/planificacion/:id" element={
        <ProtectedTeacherRoute>
          <PlanificacionWorkspace />
        </ProtectedTeacherRoute>
      } />
      <Route path="/mis-planificaciones" element={
        <ProtectedTeacherRoute>
          <MisPlanificaciones />
        </ProtectedTeacherRoute>
      } />
      <Route path="/comunicaciones" element={
        <ProtectedTeacherRoute>
          <Comunicaciones />
        </ProtectedTeacherRoute>
      } />
      
      {/* Protected Student Routes */}
      <Route path="/student-diagnostic" element={
        <ProtectedStudentRoute>
          <StudentDiagnostic />
        </ProtectedStudentRoute>
      } />
      
      {/* Catch-all route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <AppRoutes />
          <Toaster />
          <Sonner />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;
