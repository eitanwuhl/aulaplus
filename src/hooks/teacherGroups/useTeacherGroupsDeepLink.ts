import { useEffect, useState } from 'react';
import type { SchoolStudent, TeacherGroup } from '@/types/schoolCatalog';
import type { TeacherGroupsLocationState } from '@/lib/navigation/teacherGroupsNavigation';

type DeepLinkView = {
  selectedGroup: TeacherGroup | null;
  selectedStudent: SchoolStudent | null;
  viewingGroupProfile: boolean;
  viewingStudentProfile: boolean;
  invalidDeepLinkGroupId: string | null;
};

const initialView: DeepLinkView = {
  selectedGroup: null,
  selectedStudent: null,
  viewingGroupProfile: false,
  viewingStudentProfile: false,
  invalidDeepLinkGroupId: null,
};

export function useTeacherGroupsDeepLink(
  locationState: TeacherGroupsLocationState | null,
  groups: TeacherGroup[]
) {
  const [view, setView] = useState<DeepLinkView>(initialView);

  useEffect(() => {
    if (!locationState || groups.length === 0) return;

    if (typeof locationState.studentId === 'number') {
      const groupWithStudent = groups.find((group) =>
        group.students.some((student) => student.id === locationState.studentId)
      );
      if (!groupWithStudent) return;
      const student = groupWithStudent.students.find((s) => s.id === locationState.studentId);
      if (!student) return;
      setView({
        selectedGroup: groupWithStudent,
        selectedStudent: student,
        viewingGroupProfile: true,
        viewingStudentProfile: true,
        invalidDeepLinkGroupId: null,
      });
      return;
    }

    if (locationState.groupId) {
      const group = groups.find((g) => g.id === locationState.groupId);
      if (group) {
        setView({
          selectedGroup: group,
          selectedStudent: null,
          viewingGroupProfile: true,
          viewingStudentProfile: false,
          invalidDeepLinkGroupId: null,
        });
      } else {
        setView({
          ...initialView,
          invalidDeepLinkGroupId: locationState.groupId,
        });
      }
    }
  }, [locationState, groups]);

  const openGroup = (group: TeacherGroup) => {
    setView({
      selectedGroup: group,
      selectedStudent: null,
      viewingGroupProfile: true,
      viewingStudentProfile: false,
      invalidDeepLinkGroupId: null,
    });
  };

  const openStudent = (group: TeacherGroup, student: SchoolStudent) => {
    setView({
      selectedGroup: group,
      selectedStudent: student,
      viewingGroupProfile: true,
      viewingStudentProfile: true,
      invalidDeepLinkGroupId: null,
    });
  };

  const closeToList = () => setView(initialView);

  const closeStudent = () => {
    setView((prev) => ({
      ...prev,
      selectedStudent: null,
      viewingStudentProfile: false,
    }));
  };

  const dismissInvalidDeepLink = () => {
    setView((prev) => ({ ...prev, invalidDeepLinkGroupId: null }));
  };

  return {
    ...view,
    openGroup,
    openStudent,
    closeToList,
    closeStudent,
    dismissInvalidDeepLink,
  };
}
