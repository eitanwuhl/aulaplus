import { describe, it, expect } from 'vitest';
import {
  mapGrupoRowsToGroups,
  mapSchoolStudentRowToStudent,
  rowHasSeededProfile,
} from './teacherGroupsMappers';

describe('rowHasSeededProfile', () => {
  it('returns false for empty profile_data', () => {
    expect(
      rowHasSeededProfile({
        id: 1,
        display_name: 'Test',
        perfil: 'V',
        school_group_id: '1',
        profile_data: {},
      })
    ).toBe(false);
  });

  it('returns true when profile_data has fields', () => {
    expect(
      rowHasSeededProfile({
        id: 1,
        display_name: 'Test',
        perfil: 'V',
        school_group_id: '1',
        profile_data: { progreso: 80 },
      })
    ).toBe(true);
  });
});

describe('mapSchoolStudentRowToStudent', () => {
  it('maps catalog columns and profile_data fields', () => {
    const student = mapSchoolStudentRowToStudent({
      id: 1,
      display_name: 'Ana García',
      perfil: 'Visual',
      school_group_id: '1',
      profile_data: {
        avatar: '👩',
        progreso: 85,
        contemplaciones: ['Tiempo adicional'],
      },
    });

    expect(student.hasSeededProfile).toBe(true);
    expect(student.name).toBe('Ana García');
    expect(student.progreso).toBe(85);
    expect(student.contemplaciones).toEqual(['Tiempo adicional']);
  });

  it('maps resultadosEvaluaciones from profile_data', () => {
    const student = mapSchoolStudentRowToStudent({
      id: 1,
      display_name: 'Ana',
      perfil: 'Visual',
      school_group_id: '1',
      profile_data: {
        resultadosEvaluaciones: [
          {
            fecha: 'Nov 2024',
            materia: 'Historia',
            trimestre: 'T3',
            nota: 8,
            versionEvaluacion: 1,
            observacion: 'Buen desempeño',
          },
        ],
      },
    });

    expect(student.resultadosEvaluaciones).toHaveLength(1);
    expect(student.resultadosEvaluaciones?.[0].materia).toBe('Historia');
  });

  it('maps evolucionDetallada from profile_data', () => {
    const student = mapSchoolStudentRowToStudent({
      id: 1,
      display_name: 'Ana',
      perfil: 'Visual',
      school_group_id: '1',
      profile_data: {
        evolucionDetallada: [
          {
            año: '2024',
            trimestre: 'T1',
            materias: [{ nombre: 'Matemática', calificacion: 8 }],
          },
        ],
      },
    });

    expect(student.evolucionDetallada).toHaveLength(1);
    expect(student.evolucionDetallada?.[0].trimestre).toBe('T1');
  });

  it('maps dashboardEvolucion from profile_data', () => {
    const student = mapSchoolStudentRowToStudent({
      id: 1,
      display_name: 'Ana',
      perfil: 'Visual',
      school_group_id: '1',
      profile_data: {
        dashboardEvolucion: {
          metricas: {
            promedioGeneral: 8.1,
            promedioAnterior: 7.5,
            mejorMateria: { nombre: 'Historia', nota: 9 },
            materiaRiesgo: { nombre: 'Lengua', nota: 7 },
            objetivosCumplidos: 3,
            objetivosTotales: 5,
            progresoAnual: 85,
          },
          progresoMaterias: [],
          efectividadContemplaciones: [],
          objetivos: [],
        },
      },
    });

    expect(student.dashboardEvolucion?.metricas.promedioGeneral).toBe(8.1);
  });

  it('does not use mock fallback when profile_data is empty', () => {
    const student = mapSchoolStudentRowToStudent({
      id: 99,
      display_name: 'Sin perfil',
      perfil: 'Auditivo',
      school_group_id: '1',
      profile_data: {},
    });

    expect(student.hasSeededProfile).toBe(false);
    expect(student.name).toBe('Sin perfil');
    expect(student.perfil).toBe('Auditivo');
    expect(student.progreso).toBeUndefined();
    expect(student.contemplaciones).toEqual([]);
    expect(student.historialAcademico).toBeUndefined();
  });
});

describe('mapGrupoRowsToGroups', () => {
  it('groups students by school_group_id and sets studentCount', () => {
    const studentsByGroupId = new Map([
      [
        '1',
        [
          {
            id: 1,
            display_name: 'A',
            perfil: 'V',
            school_group_id: '1',
            profile_data: { progreso: 70 },
          },
          {
            id: 2,
            display_name: 'B',
            perfil: 'A',
            school_group_id: '1',
            profile_data: {},
          },
        ],
      ],
    ]);

    const groups = mapGrupoRowsToGroups(
      [{ id: '1', name: '9no 1', year: '9º', section: '1', teacher_sugerencias: null }],
      studentsByGroupId
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].studentCount).toBe(2);
    expect(groups[0].students[0].hasSeededProfile).toBe(true);
    expect(groups[0].students[1].hasSeededProfile).toBe(false);
  });
});
