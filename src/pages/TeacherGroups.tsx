import React, { useState } from "react";
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
  Minus
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { mockGroups } from "@/data/mockData";
import type { Group as MockGroup, Student as MockStudent } from "@/data/mockData";
import GroupProfile from "@/components/GroupProfile";
import StudentProfile from "@/components/StudentProfile";

const TeacherGroups = () => {
  console.log("[DEBUG] TeacherGroups component starting to render");
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<MockGroup | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<MockStudent | null>(null);
  const [viewingGroupProfile, setViewingGroupProfile] = useState(false);
  const [viewingStudentProfile, setViewingStudentProfile] = useState(false);

  const filteredGroups = mockGroups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.year.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.section.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleGroupClick = (group: MockGroup) => {
    setSelectedGroup(group);
    setViewingGroupProfile(true);
  };

  const handleStudentClick = (student: MockStudent) => {
    setSelectedStudent(student);
    setViewingStudentProfile(true);
  };

  const handleBackToGroups = () => {
    setViewingGroupProfile(false);
    setViewingStudentProfile(false);
    setSelectedGroup(null);
    setSelectedStudent(null);
  };

  const handleBackToGroup = () => {
    setViewingStudentProfile(false);
    setSelectedStudent(null);
  };

  // Helper function to check if a student requires adjustments (explicit flags only)
  const studentRequiresAdjustments = (student: MockStudent): boolean => {
    // Source of truth: explicit flags from localStorage or student.informeTecnico
    // Check localStorage first (user-controlled values)
    try {
      const accesoKey = `adecuacionAcceso:${student.id}`;
      const contenidoKey = `adecuacionContenido:${student.id}`;
      
      const accesoFromStorage = localStorage.getItem(accesoKey);
      const contenidoFromStorage = localStorage.getItem(contenidoKey);
      
      if (accesoFromStorage !== null) {
        const accesoValue = JSON.parse(accesoFromStorage);
        if (accesoValue === true) return true;
      }
      
      if (contenidoFromStorage !== null) {
        const contenidoValue = JSON.parse(contenidoFromStorage);
        if (contenidoValue === true) return true;
      }
    } catch (error) {
      // If localStorage read fails, fall through to fallback
    }
    
    // Fallback: check student.informeTecnico (if present in mock data)
    if (student.informeTecnico) {
      if (student.informeTecnico.requiereAdecuacionAcceso === true) return true;
      if (student.informeTecnico.requiereAdecuacionContenido === true) return true;
    }
    
    // Default: no adjustments required
    return false;
  };

  const getGroupStats = (group: MockGroup) => {
    const students = group.students;
    // Convertir progreso a calificaciones (0-100 -> 1-12 scale)
    const avgGrade = students.reduce((sum, student) => {
      const grade = ((student.progreso || 0) / 100) * 11 + 1; // Convert to 1-12 scale
      return sum + grade;
    }, 0) / students.length;
    
    // Count students with explicit adjustment flags (source of truth)
    const studentsWithAdjustments = students.filter(student => 
      studentRequiresAdjustments(student)
    ).length;
    
    return {
      avgGrade: Math.round(avgGrade * 10) / 10, // Round to 1 decimal
      adjustmentsNeeded: studentsWithAdjustments,
      sufficientGrades: students.filter(student => {
        const grade = ((student.progreso || 0) / 100) * 11 + 1;
        return grade >= 6;
      }).length,
      insufficientGrades: students.filter(student => {
        const grade = ((student.progreso || 0) / 100) * 11 + 1;
        return grade < 6;
      }).length
    };
  };

  const getProgressIcon = (progress: number) => {
    if (progress >= 85) return <TrendingUp className="w-4 h-4 text-secondary" />;
    if (progress < 70) return <TrendingDown className="w-4 h-4 text-warning" />;
    return <Minus className="w-4 h-4 text-primary" />;
  };

  // Convert MockStudent to Student for StudentProfile component
  const convertToStudentProfile = (mockStudent: MockStudent) => ({
    id: mockStudent.id,
    name: mockStudent.name,
    perfil: mockStudent.perfil,
    avatar: mockStudent.avatar,
    contemplaciones: mockStudent.contemplaciones,
    anotaciones: mockStudent.anotaciones || "",
    seguimiento: mockStudent.seguimiento || [],
    historialAcademico: mockStudent.historialAcademico || [],
    evaluacionesCualitativas: mockStudent.evaluacionesCualitativas || [],
    informeTecnico: mockStudent.informeTecnico
  });

  // Convert MockGroup to Group for GroupProfile component
  const convertToGroupProfile = (mockGroup: MockGroup) => ({
    id: mockGroup.id,
    name: mockGroup.name,
    studentCount: mockGroup.studentCount,
    year: mockGroup.year,
    section: mockGroup.section,
    students: mockGroup.students.map(student => ({
      id: student.id,
      name: student.name,
      perfil: student.perfil,
      ajustes: student.ajustes || "",
      progreso: student.progreso || 0,
      avatar: student.avatar
    }))
  });

  // If viewing student profile
  if (viewingStudentProfile && selectedStudent) {
    return (
      <StudentProfile 
        student={convertToStudentProfile(selectedStudent)} 
        onBack={handleBackToGroup}
      />
    );
  }

  // If viewing group profile
  if (viewingGroupProfile && selectedGroup) {
    console.log("[DEBUG] Rendering GroupProfile component");
    const convertedGroup = convertToGroupProfile(selectedGroup);
    return (
      <GroupProfile 
        group={convertedGroup} 
        onBack={handleBackToGroups}
        onStudentClick={(student) => {
          // Find the original student from mockData
          const originalStudent = selectedGroup.students.find(s => s.id === student.id);
          if (originalStudent) {
            handleStudentClick(originalStudent);
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={() => navigate('/teacher-dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Mis Grupos</h1>
            <p className="text-foreground-subtle">
              Gestiona y visualiza el progreso de tus grupos de estudiantes
            </p>
          </div>
        </div>
      </motion.div>

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="flex items-center gap-4"
      >
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground-subtle w-4 h-4" />
          <Input
            placeholder="Buscar grupos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </motion.div>

      {/* Groups Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {filteredGroups.map((group, index) => {
          const stats = getGroupStats(group);
          
          return (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 * index }}
            >
              <Card 
                className="hover:shadow-lg transition-all duration-200 cursor-pointer group"
                onClick={() => handleGroupClick(group)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {group.name}
                        </CardTitle>
                        <p className="text-sm text-foreground-subtle">
                          {group.year} • {group.section}
                        </p>
                      </div>
                    </div>
                    <Eye className="w-4 h-4 text-foreground-subtle group-hover:text-primary transition-colors" />
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Student Count */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <GraduationCap className="w-4 h-4 text-foreground-subtle" />
                      <span className="text-sm font-medium">Estudiantes</span>
                    </div>
                    <Badge variant="secondary">{group.studentCount}</Badge>
                  </div>

                  {/* Grade Average */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="w-4 h-4 text-foreground-subtle" />
                      <span className="text-sm font-medium">Promedio de calificación</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      {getProgressIcon(stats.avgGrade * 8.33)} {/* Convert back for icon */}
                      <span className="text-sm font-bold">{stats.avgGrade}</span>
                    </div>
                  </div>

                  {/* Grade Distribution */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                    <div className="text-center">
                      <p className="text-xs text-foreground-subtle">Calificación suficiente</p>
                      <p className="text-sm font-bold text-secondary">{stats.sufficientGrades}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-foreground-subtle">Calificación insuficiente</p>
                      <p className="text-sm font-bold text-warning">{stats.insufficientGrades}</p>
                    </div>
                  </div>

                  {/* Adjustments Needed */}
                  {stats.adjustmentsNeeded > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-xs text-foreground-subtle">Alumnos con ajustes necesarios</span>
                      <Badge variant="secondary" className="text-xs">
                        {stats.adjustmentsNeeded}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {filteredGroups.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center py-12"
        >
          <Users className="w-12 h-12 text-foreground-subtle mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No se encontraron grupos</h3>
          <p className="text-foreground-subtle">
            {searchTerm ? 'Intenta con otros términos de búsqueda' : 'No tienes grupos asignados actualmente'}
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default TeacherGroups;