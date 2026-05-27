import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useInstitutionSnapshot } from '@/hooks/useInstitution';
import { canManageInstitution } from '@/lib/institution/curriculumFrameworks';
import { AuthRouteFallback } from '@/components/auth/AuthRouteFallback';

/**
 * Redirects dirección/admin to onboarding until the school is configured.
 */
export function InstitutionOnboardingGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const schoolId = user?.schoolId;
  const mustCheck = canManageInstitution(user?.profileRole);

  const { data: snapshot, isLoading, isError } = useInstitutionSnapshot(
    schoolId,
    mustCheck && Boolean(schoolId)
  );

  if (!mustCheck) {
    return <>{children}</>;
  }

  if (isLoading) {
    return <AuthRouteFallback />;
  }

  if (isError) {
    return <>{children}</>;
  }

  const onOnboardingPath = location.pathname.startsWith('/institucion/onboarding');

  if (!snapshot?.onboardingCompleted && !onOnboardingPath) {
    return <Navigate to="/institucion/onboarding" replace />;
  }

  return <>{children}</>;
}
