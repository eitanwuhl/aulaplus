import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Users,
  Search,
  ArrowLeft,
  BarChart3,
  Eye,
  GraduationCap,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { TeacherGroup } from "@/types/schoolCatalog";
import GroupProfile from "@/components/GroupProfile";
import StudentProfile from "@/components/StudentProfile";
import { StudentProfileIncomplete } from "@/components/teacherGroups/StudentProfileIncomplete";
import { CatalogEmptyState } from "@/components/teacherGroups/CatalogEmptyState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useTeacherGroups } from "@/hooks/useTeacherGroups";
import { useTeacherGroupsDeepLink } from "@/hooks/teacherGroups/useTeacherGroupsDeepLink";
import { getGroupCardStats } from "@/lib/teacherGroups/teacherGroupStats";
import {
  TEACHER_DASHBOARD_PATH,
  type TeacherGroupsLocationState,
} from "@/lib/navigation/teacherGroupsNavigation";
import {
  toGroupProfileViewModel,
  toStudentProfileViewModel,
} from "@/services/teacherGroups";

function getProgressIcon(progress: number) {
  if (progress >= 85) return <TrendingUp className="w-4 h-4 text-secondary" />;
  if (progress < 70) return <TrendingDown className="w-4 h-4 text-warning" />;
  return <Minus className="w-4 h-4 text-primary" />;
}

const TeacherGroups = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, user } = useAuth();
  const userId = session?.user?.id;

  const { data: groups = [], isLoading, isError, error } = useTeacherGroups({
    userId,
    enabled: Boolean(userId),
  });

  const locationState = location.state as TeacherGroupsLocationState | null;
  const returnTo = locationState?.returnTo;

  const {
    selectedGroup,
    selectedStudent,
    viewingGroupProfile,
    viewingStudentProfile,
    invalidDeepLinkGroupId,
    openGroup,
    openStudent,
    closeToList,
    closeStudent,
    dismissInvalidDeepLink,
  } = useTeacherGroupsDeepLink(locationState, groups);

  const [searchTerm, setSearchTerm] = useState("");

  const filteredGroups = useMemo(
    () =>
      groups.filter(
        (group) =>
          group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          group.year.toLowerCase().includes(searchTerm.toLowerCase()) ||
          group.section.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [groups, searchTerm]
  );

  const handleBackToGroups = () => {
    if (returnTo) {
      navigate(returnTo, { replace: true });
      return;
    }
    closeToList();
  };

  const handleBackFromStudent = () => {
    if (returnTo) {
      navigate(returnTo, { replace: true });
      return;
    }
    closeStudent();
  };

  if (viewingStudentProfile && selectedStudent) {
    if (!selectedStudent.hasSeededProfile) {
      return (
        <StudentProfileIncomplete student={selectedStudent} onBack={handleBackFromStudent} />
      );
    }
    return (
      <StudentProfile
        student={toStudentProfileViewModel(selectedStudent)}
        onBack={handleBackFromStudent}
      />
    );
  }

  if (viewingGroupProfile && selectedGroup) {
    return (
      <GroupProfile
        group={toGroupProfileViewModel(selectedGroup)}
        onBack={handleBackToGroups}
        onStudentClick={(student) => {
          const originalStudent = selectedGroup.students.find((s) => s.id === student.id);
          if (originalStudent) openStudent(selectedGroup, originalStudent);
        }}
      />
    );
  }

  return (
    <motion.div className="space-y-6">
      {invalidDeepLinkGroupId && (
        <Alert variant="destructive" className="flex items-center justify-between gap-4">
          <div>
            <AlertTitle>Grupo no encontrado</AlertTitle>
            <AlertDescription>
              El grupo solicitado no existe o ya no está disponible. Mostrando la lista de grupos.
            </AlertDescription>
          </div>
          <Button variant="outline" size="sm" onClick={dismissInvalidDeepLink}>
            Cerrar
          </Button>
        </Alert>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex items-center justify-between"
      >
        <motion.div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={() => navigate(returnTo ?? TEACHER_DASHBOARD_PATH)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Dashboard
          </Button>
          <motion.div>
            <h1 className="text-3xl font-bold">Mis Grupos</h1>
            <p className="text-foreground-subtle">
              Gestiona y visualiza el progreso de tus grupos de estudiantes
            </p>
            {user?.schoolName && (
              <Badge variant="secondary" className="mt-2">
                {user.schoolName}
              </Badge>
            )}
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="flex items-center gap-4"
      >
        <motion.div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground-subtle w-4 h-4" />
          <Input
            placeholder="Buscar grupos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </motion.div>
      </motion.div>

      {isLoading && (
        <motion.div className="flex items-center justify-center py-16 text-foreground-subtle">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Cargando grupos…
        </motion.div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Error al cargar grupos</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Intentá recargar la página."}
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !isError && (
        <GroupsGrid groups={filteredGroups} onGroupClick={openGroup} />
      )}

      {!isLoading && !isError && filteredGroups.length === 0 && (
        <EmptyGroupsState hasSearch={Boolean(searchTerm)} />
      )}
    </motion.div>
  );
};

function GroupsGrid({
  groups,
  onGroupClick,
}: {
  groups: TeacherGroup[];
  onGroupClick: (group: TeacherGroup) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {groups.map((group, index) => (
        <GroupCard key={group.id} group={group} index={index} onClick={() => onGroupClick(group)} />
      ))}
    </motion.div>
  );
}

function GroupCard({
  group,
  index,
  onClick,
}: {
  group: TeacherGroup;
  index: number;
  onClick: () => void;
}) {
  const stats = getGroupCardStats(group);
  const hasGradeData = stats.studentsWithGrades > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1 * index }}
    >
      <Card
        className="hover:shadow-lg transition-all duration-200 cursor-pointer group"
        onClick={onClick}
      >
        <CardHeader className="pb-3">
          <motion.div className="flex items-center justify-between">
            <motion.div className="flex items-center space-x-2">
              <motion.div className="p-2 bg-primary/10 rounded-lg">
                <Users className="w-5 h-5 text-primary" />
              </motion.div>
              <motion.div>
                <CardTitle className="text-lg group-hover:text-primary transition-colors">
                  {group.name}
                </CardTitle>
                <p className="text-sm text-foreground-subtle">
                  {group.year} • {group.section}
                </p>
              </motion.div>
            </motion.div>
            <Eye className="w-4 h-4 text-foreground-subtle group-hover:text-primary transition-colors" />
          </motion.div>
        </CardHeader>
        <CardContent className="space-y-4">
          <motion.div className="flex items-center justify-between">
            <motion.div className="flex items-center space-x-2">
              <GraduationCap className="w-4 h-4 text-foreground-subtle" />
              <span className="text-sm font-medium">Estudiantes</span>
            </motion.div>
            <Badge variant="secondary">{group.studentCount}</Badge>
          </motion.div>
          <motion.div className="flex items-center justify-between">
            <motion.div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-foreground-subtle" />
              <span className="text-sm font-medium">Promedio de calificación</span>
            </motion.div>
            <motion.div className="flex items-center space-x-1">
              {hasGradeData && stats.avgGrade !== null ? (
                <>
                  {getProgressIcon(stats.avgGrade * 8.33)}
                  <span className="text-sm font-bold">{stats.avgGrade}</span>
                </>
              ) : (
                <span className="text-sm text-foreground-subtle">Sin datos</span>
              )}
            </motion.div>
          </motion.div>
          <motion.div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
            <motion.div className="text-center">
              <p className="text-xs text-foreground-subtle">Calificación suficiente</p>
              <p className="text-sm font-bold text-secondary">{stats.sufficientGrades}</p>
            </motion.div>
            <motion.div className="text-center">
              <p className="text-xs text-foreground-subtle">Calificación insuficiente</p>
              <p className="text-sm font-bold text-warning">{stats.insufficientGrades}</p>
            </motion.div>
          </motion.div>
          {stats.adjustmentsNeeded > 0 && (
            <motion.div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-xs text-foreground-subtle">Alumnos con ajustes necesarios</span>
              <Badge variant="secondary" className="text-xs">
                {stats.adjustmentsNeeded}
              </Badge>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function EmptyGroupsState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="text-center py-12"
    >
      <Users className="w-12 h-12 text-foreground-subtle mx-auto mb-4" />
      <h3 className="text-lg font-medium mb-2">No se encontraron grupos</h3>
          <p className="text-foreground-subtle">
            {hasSearch
              ? "Intenta con otros términos de búsqueda"
              : "No tienes grupos asignados. Si administrás el entorno, ejecutá npm run seed:teacher-grupos."}
          </p>
    </motion.div>
  );
}

export default TeacherGroups;
