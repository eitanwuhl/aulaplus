import {
  buildCompetenciasContenidosMap,
  extractCompetenciesFromUnits,
  extractContenidosFromUnits,
} from '@/lib/competencyExtractor';
import { resolvePlanificacionFechas } from '@/lib/planificacion/planificacionDates';
import type { UnidadDidactica, WizardData } from '@/types/planificacion';

export function aggregateUnitMaterialPlan(unidades: UnidadDidactica[]) {
  return unidades.flatMap((u) =>
    (u.unit_material_plan ?? []).map((m) => ({
      ...m,
      unitId: u.id,
    }))
  );
}

export function buildPlanificacionInsertPayload(input: {
  userId: string;
  wizardData: WizardData;
  nivel: string;
}) {
  const { userId, wizardData, nivel } = input;
  const unidadesDidacticas = wizardData.enfoque?.unidades_didacticas ?? [];
  const { fecha_inicio, fecha_fin } = resolvePlanificacionFechas(wizardData);

  return {
    user_id: userId,
    grupo_id: wizardData.contexto!.grupo_id,
    materia: wizardData.contexto!.materia,
    fecha_inicio,
    fecha_fin,
    horas_semanales: wizardData.horario?.horas_semanales ?? null,
    configuracion_horario: wizardData.horario?.configuracion ?? null,
    unidades_didacticas: unidadesDidacticas,
    competencias_seleccionadas: extractCompetenciesFromUnits(unidadesDidacticas),
    contenidos_programa: extractContenidosFromUnits(unidadesDidacticas),
    mapeo_competencias_contenidos: buildCompetenciasContenidosMap(unidadesDidacticas),
    requerimientos_docente: wizardData.enfoque!.requerimientos_docente,
    distribucion_modalidades: wizardData.enfoque!.distribucion_modalidades,
    estrategias_diferenciacion: wizardData.enfoque!.estrategias_diferenciacion,
    objetivos_unidad: wizardData.enfoque!.objetivos_unidad,
    cantidad_sesiones: wizardData.contexto?.cantidad_sesiones,
    cadencia_deseada: wizardData.contexto?.cadencia_deseada,
    bloques_preferidos: wizardData.contexto?.bloques_preferidos,
    ventana_sugerida: wizardData.contexto?.ventana_sugerida,
    unit_material_plan: aggregateUnitMaterialPlan(unidadesDidacticas),
    nivel,
    is_saved: false,
    ...(wizardData.programa_id ? { programa_id: wizardData.programa_id } : {}),
  };
}
