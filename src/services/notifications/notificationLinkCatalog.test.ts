import { describe, expect, it } from 'vitest';
import { mapTeacherGroupsToNotificationLinkOptions } from './notificationLinkCatalogMappers';
import type { TeacherGroup } from '@/types/schoolCatalog';

describe('mapTeacherGroupsToNotificationLinkOptions', () => {
  it('lists only students from assigned teacher groups', () => {
    const groups: TeacherGroup[] = [
      {
        id: '1',
        name: '9no 1',
        year: '9º',
        section: '1',
        studentCount: 2,
        students: [
          {
            id: 1,
            name: 'Ana',
            perfil: 'Visual',
            avatar: '👤',
            contemplaciones: [],
            hasSeededProfile: false,
          },
          {
            id: 2,
            name: 'Luis',
            perfil: 'Auditivo',
            avatar: '👤',
            contemplaciones: [],
            hasSeededProfile: false,
          },
        ],
      },
      {
        id: '2',
        name: '9no 2',
        year: '9º',
        section: '2',
        studentCount: 1,
        students: [
          {
            id: 5,
            name: 'María',
            perfil: 'Visual',
            avatar: '👤',
            contemplaciones: [],
            hasSeededProfile: false,
          },
        ],
      },
    ];

    const { groups: groupOptions, students } = mapTeacherGroupsToNotificationLinkOptions(groups);

    expect(groupOptions).toEqual([
      { id: '1', name: '9no 1' },
      { id: '2', name: '9no 2' },
    ]);
    expect(students.map((s) => s.id)).toEqual([1, 2, 5]);
    expect(students.find((s) => s.id === 1)?.groupName).toBe('9no 1');
  });
});
