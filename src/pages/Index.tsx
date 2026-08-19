
import { useState } from "react";
import StudentProfile from "@/components/StudentProfile";
import GroupProfile from "@/components/GroupProfile";
import HeroSection from "@/components/HeroSection";
import CRMDemoSection from "@/components/CRMDemoSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import StudentDiagnostic from "./StudentDiagnostic";
import { mockGroups, type Student, type Group } from "@/data/mockData";

const Index = () => {
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [viewingProfile, setViewingProfile] = useState<boolean>(false);
  const [viewingGroupProfile, setViewingGroupProfile] = useState<boolean>(false);
  const [showDiagnostic, setShowDiagnostic] = useState<boolean>(false);

  // Los datos se importan desde mockData.ts

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleStudentClick = (student: Student) => {
    setSelectedStudent(student);
    setViewingProfile(true);
    // No cambiar viewingGroupProfile aquí - mantener la referencia al grupo
  };

  const handleGroupClick = (group: Group) => {
    setSelectedGroup(group);
    setViewingGroupProfile(true);
  };

  const handleBackToGroup = () => {
    setViewingProfile(false);
    setSelectedStudent(null);
    // viewingGroupProfile se mantiene true para volver al perfil del grupo
  };

  const handleBackToGroups = () => {
    setViewingGroupProfile(false);
    setViewingProfile(false);
    setSelectedGroup(null);
    setSelectedStudent(null);
  };

  const handleStartDiagnostic = () => {
    setShowDiagnostic(true);
  };

  if (showDiagnostic) {
    return <StudentDiagnostic />;
  }

  // Mostrar perfil del estudiante (tiene prioridad sobre el perfil del grupo)
  if (viewingProfile && selectedStudent) {
    return (
      <StudentProfile 
        student={selectedStudent} 
        onBack={handleBackToGroup}
      />
    );
  }

  // Mostrar perfil del grupo
  if (viewingGroupProfile && selectedGroup) {
    return (
      <GroupProfile 
        group={selectedGroup} 
        onBack={handleBackToGroups}
        onStudentClick={handleStudentClick}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <HeroSection onScrollToSection={scrollToSection} onStartDiagnostic={handleStartDiagnostic} />
      
      <CRMDemoSection 
        mockGroups={mockGroups}
        onGroupClick={handleGroupClick}
      />
      
      <CTASection />
      <Footer />
    </div>
  );
};

export default Index;
