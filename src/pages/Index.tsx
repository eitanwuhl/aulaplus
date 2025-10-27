
import { useState } from "react";
import StudentProfile from "@/components/StudentProfile";
import GroupProfile from "@/components/GroupProfile";
import HeroSection from "@/components/HeroSection";
import WhatIsSection from "@/components/WhatIsSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import CRMDemoSection from "@/components/CRMDemoSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import StudentDiagnostic from "./StudentDiagnostic";
import DiagnosticResults from "@/components/DiagnosticResults";
import { mockGroups, mockStudents } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Users, BookOpen, Award } from "lucide-react";

const Index = () => {
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [viewingProfile, setViewingProfile] = useState<boolean>(false);
  const [viewingGroupProfile, setViewingGroupProfile] = useState<boolean>(false);
  const [showDiagnostic, setShowDiagnostic] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [studentData, setStudentData] = useState<any>(null);

  // Los datos se importan desde mockData.ts

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleStudentClick = (student: any) => {
    setSelectedStudent(student);
    setViewingProfile(true);
    // No cambiar viewingGroupProfile aquí - mantener la referencia al grupo
  };

  const handleGroupClick = (group: any) => {
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

  const handleDiagnosticComplete = (data: any) => {
    setStudentData(data);
    setShowDiagnostic(false);
    setShowResults(true);
  };

  const handleResultsContinue = () => {
    setShowResults(false);
  };

  if (showDiagnostic) {
    return <StudentDiagnostic />;
  }

  if (showResults && studentData) {
    return <DiagnosticResults studentData={studentData} onContinue={handleResultsContinue} />;
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
