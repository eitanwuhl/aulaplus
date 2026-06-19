import { lazy, Suspense } from "react";
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
import EvaluacionesChoice from "./pages/EvaluacionesChoice";
import MisEvaluaciones from "./pages/MisEvaluaciones";
import EvaluacionDetalle from "./pages/EvaluacionDetalle";
import PlanificacionClase from "./pages/PlanificacionClase";
const PlanificacionWizard = lazy(() => import("./pages/PlanificacionWizard"));
import PlanificacionWorkspace from "./pages/PlanificacionWorkspace";
import MisPlanificaciones from "./pages/MisPlanificaciones";
import Comunicaciones from "./pages/Comunicaciones";
import BibliotecaMateriales from "./pages/BibliotecaMateriales";
import { AuthRouteFallback } from "./components/auth/AuthRouteFallback";
import InstitutionOnboarding from "./pages/institution/InstitutionOnboarding";
import InstitutionConfig from "./pages/institution/InstitutionConfig";
import AnnualProgramList from "./pages/annualProgram/AnnualProgramList";
import AnnualProgramNew from "./pages/annualProgram/AnnualProgramNew";
import AnnualProgramEditor from "./pages/annualProgram/AnnualProgramEditor";
import { InstitutionOnboardingGate } from "./components/institution/InstitutionOnboardingGate";
import { canViewInstitutionConfig } from "./lib/institution/curriculumFrameworks";

const queryClient = new QueryClient();

// Protected Route wrapper for teachers
const ProtectedTeacherRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, authReady, session } = useAuth();

  if (!authReady) {
    return <AuthRouteFallback />;
  }

  if (!isAuthenticated || user?.role !== 'teacher' || !session?.user) {
    return <Navigate to="/teacher-login" replace />;
  }

  return (
    <AppLayout>
      <InstitutionOnboardingGate>{children}</InstitutionOnboardingGate>
    </AppLayout>
  );
};

const ProtectedInstitutionRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, authReady, session } = useAuth();

  if (!authReady) {
    return <AuthRouteFallback />;
  }

  if (!isAuthenticated || user?.role !== 'teacher' || !session?.user) {
    return <Navigate to="/teacher-login" replace />;
  }

  if (!canViewInstitutionConfig(user?.profileRole)) {
    return <Navigate to="/teacher-dashboard" replace />;
  }

  return (
    <AppLayout>
      <InstitutionOnboardingGate>{children}</InstitutionOnboardingGate>
    </AppLayout>
  );
};

// Protected Route wrapper for students  
const ProtectedStudentRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, authReady } = useAuth();

  if (!authReady) {
    return <AuthRouteFallback />;
  }

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
          <EvaluacionesChoice />
        </ProtectedTeacherRoute>
      } />
      <Route path="/evaluaciones/nuevo" element={
        <ProtectedTeacherRoute>
          <EvaluacionesGrupo />
        </ProtectedTeacherRoute>
      } />
      <Route path="/mis-evaluaciones" element={
        <ProtectedTeacherRoute>
          <MisEvaluaciones />
        </ProtectedTeacherRoute>
      } />
      <Route path="/mis-evaluaciones/:id" element={
        <ProtectedTeacherRoute>
          <EvaluacionDetalle />
        </ProtectedTeacherRoute>
      } />
      <Route path="/programa-anual" element={
        <ProtectedTeacherRoute>
          <AnnualProgramList />
        </ProtectedTeacherRoute>
      } />
      <Route path="/programa-anual/nuevo" element={
        <ProtectedTeacherRoute>
          <AnnualProgramNew />
        </ProtectedTeacherRoute>
      } />
      <Route path="/programa-anual/:id" element={
        <ProtectedTeacherRoute>
          <AnnualProgramEditor />
        </ProtectedTeacherRoute>
      } />
      <Route path="/planificacion" element={
        <ProtectedTeacherRoute>
          <PlanificacionClase />
        </ProtectedTeacherRoute>
      } />
      <Route path="/planificacion/nuevo" element={
        <ProtectedTeacherRoute>
          <Suspense fallback={<AuthRouteFallback />}>
            <PlanificacionWizard />
          </Suspense>
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
      <Route path="/biblioteca-materiales" element={
        <ProtectedTeacherRoute>
          <BibliotecaMateriales />
        </ProtectedTeacherRoute>
      } />
      <Route path="/institucion/onboarding" element={
        <ProtectedInstitutionRoute>
          <InstitutionOnboarding />
        </ProtectedInstitutionRoute>
      } />
      <Route path="/institucion/configuracion" element={
        <ProtectedInstitutionRoute>
          <InstitutionConfig />
        </ProtectedInstitutionRoute>
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
  <BrowserRouter
    future={{
      // React Router v7 migration flags
      // v7_relativeSplatPath: true - Required because we use a splat route (path="*")
      // This flag ensures relative paths work correctly with splat routes
      // Safe to enable: all our routes use absolute paths (start with "/")
      v7_relativeSplatPath: true,
      // v7_startTransition: true - Uses React.startTransition for navigation
      // This makes navigation non-blocking and improves perceived performance
      // Safe to enable: no known issues with current navigation patterns
      v7_startTransition: true,
    }}
  >
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
