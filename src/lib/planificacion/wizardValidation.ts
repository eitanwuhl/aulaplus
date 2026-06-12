import { compareIsoDates, todayLocal, toIsoDateLocal } from '@/lib/dates/localDate';
import type { WizardData } from '@/types/planificacion';
import type { FieldError, ValidationResult } from '@/types/validation';
import {
  validateHorarioCoherence,
  validateHorarioConfigItem,
  validateHorarioNoOverlaps,
  validateHorasSemanalesValue,
} from '@/lib/planificacion/horarioValidation';

/** Validates a single wizard step (0–3). Step 3 aggregates steps 0, 1 (if applicable), and 2. */
export function validateWizardStep(wizardData: WizardData, paso: number): ValidationResult {
  const errors: FieldError[] = [];
  let firstInvalidField: string | undefined;

  switch (paso) {
    case 0: {
      if (!wizardData.contexto?.grupo_id) {
        errors.push({
          fieldId: 'grupo_id',
          message: 'Grupo a evaluar es obligatorio',
          type: 'required',
        });
        if (!firstInvalidField) firstInvalidField = 'grupo_id';
      }

      if (!wizardData.contexto?.materia) {
        errors.push({
          fieldId: 'materia',
          message: 'Materia es obligatoria',
          type: 'required',
        });
        if (!firstInvalidField) firstInvalidField = 'materia';
      }

      if (!wizardData.tipo_planificacion) {
        errors.push({
          fieldId: 'tipo_planificacion',
          message: 'Debes seleccionar un tipo de planificación',
          type: 'required',
        });
        if (!firstInvalidField) firstInvalidField = 'tipo_planificacion';
      }

      if (wizardData.tipo_planificacion === 'periodo_especifico') {
        const fechaInicio = wizardData.contexto?.fecha_inicio;
        const fechaFin = wizardData.contexto?.fecha_fin;
        const hoy = todayLocal();

        if (!fechaInicio) {
          errors.push({
            fieldId: 'fecha_inicio',
            message: 'Fecha de inicio es obligatoria',
            type: 'required',
          });
          if (!firstInvalidField) firstInvalidField = 'fecha_inicio';
        } else if (compareIsoDates(fechaInicio, toIsoDateLocal(hoy)) < 0) {
          errors.push({
            fieldId: 'fecha_inicio',
            message: 'La fecha de inicio no puede ser anterior a hoy',
            type: 'range',
          });
          if (!firstInvalidField) firstInvalidField = 'fecha_inicio';
        }

        if (!fechaFin) {
          errors.push({
            fieldId: 'fecha_fin',
            message: 'Fecha de fin es obligatoria',
            type: 'required',
          });
          if (!firstInvalidField) firstInvalidField = 'fecha_fin';
        } else if (fechaInicio && compareIsoDates(fechaFin, fechaInicio) <= 0) {
          errors.push({
            fieldId: 'fecha_fin',
            message: 'La fecha de fin debe ser posterior a la fecha de inicio',
            type: 'range',
          });
          if (!firstInvalidField) firstInvalidField = 'fecha_fin';
        }
      }

      if (wizardData.tipo_planificacion === 'sin_periodo') {
        const cantidadSesiones = wizardData.contexto?.cantidad_sesiones;
        const duracion = wizardData.contexto?.duracion_por_sesion;

        if (!cantidadSesiones || cantidadSesiones <= 0) {
          errors.push({
            fieldId: 'cantidad_sesiones',
            message:
              cantidadSesiones === undefined
                ? 'Cantidad de sesiones es obligatoria'
                : 'Debe ser un número mayor a 0',
            type: cantidadSesiones === undefined ? 'required' : 'range',
          });
          if (!firstInvalidField) firstInvalidField = 'cantidad_sesiones';
        }

        if (!duracion || duracion <= 0) {
          errors.push({
            fieldId: 'duracion_por_sesion',
            message:
              duracion === undefined
                ? 'Duración por sesión es obligatoria'
                : 'Debe ser un número mayor a 0 minutos',
            type: duracion === undefined ? 'required' : 'range',
          });
          if (!firstInvalidField) firstInvalidField = 'duracion_por_sesion';
        }
      }

      break;
    }

    case 1: {
      const horasSemanales = wizardData.horario?.horas_semanales;
      const horasError = validateHorasSemanalesValue(horasSemanales);
      if (horasError) {
        errors.push(horasError);
        if (!firstInvalidField) firstInvalidField = horasError.fieldId;
      }

      const configuracion = wizardData.horario?.configuracion || [];
      if (configuracion.length === 0) {
        errors.push({
          fieldId: 'configuracion',
          message: 'Debes configurar al menos un horario',
          type: 'required',
        });
        if (!firstInvalidField) firstInvalidField = 'configuracion';
      } else {
        configuracion.forEach((config, index) => {
          for (const itemError of validateHorarioConfigItem(config, index)) {
            errors.push(itemError);
            if (!firstInvalidField) firstInvalidField = itemError.fieldId;
          }
        });

        for (const overlapError of validateHorarioNoOverlaps(configuracion)) {
          errors.push(overlapError);
          if (!firstInvalidField) firstInvalidField = overlapError.fieldId;
        }

        const coherenceError = validateHorarioCoherence(horasSemanales, configuracion);
        if (coherenceError) {
          errors.push(coherenceError);
          if (!firstInvalidField) firstInvalidField = coherenceError.fieldId;
        }
      }

      break;
    }

    case 2: {
      const unidades = wizardData.enfoque?.unidades_didacticas || [];
      const hasAnepContent =
        unidades.length > 0 && unidades.some((u) => u.contenido_texto?.trim());

      const requerimientos = wizardData.enfoque?.requerimientos_docente?.trim() || '';
      const sessionBriefs = wizardData.enfoque?.sessionBriefs || [];
      const hasMeaningfulBriefs = sessionBriefs.some((b) => (b?.trim() || '').length >= 15);
      const hasMeaningfulRequerimientos = requerimientos.length >= 20;
      const hasSufficientFocusText = hasMeaningfulBriefs || hasMeaningfulRequerimientos;
      const hasPlanMaterials = (wizardData.enfoque?.attachedPlanMaterialIds || []).length > 0;

      if (!hasAnepContent && !hasSufficientFocusText && !hasPlanMaterials) {
        errors.push({
          fieldId: 'generation_requirements',
          message:
            'Para generar planes necesitas al menos: (A) contenido ANEP en unidades didácticas, O (B) materiales adjuntos a nivel planificación (usa "Adjuntar materiales" arriba), O (C) texto de foco/tema suficientemente informativo (ej: temas de las clases o requerimientos del docente). Podés generar usando solo materiales docentes.',
          type: 'custom',
        });
        if (!firstInvalidField) firstInvalidField = 'generation_requirements';
      }

      const distribucion = wizardData.enfoque?.distribucion_modalidades;
      if (distribucion) {
        const total = Object.values(distribucion).reduce((sum, val) => sum + val, 0);
        if (total !== 100) {
          errors.push({
            fieldId: 'distribucion_modalidades',
            message: 'La suma de modalidades debe ser 100%',
            type: 'custom',
          });
          if (!firstInvalidField) firstInvalidField = 'distribucion_modalidades';
        }
      }

      break;
    }

    case 3: {
      const paso0 = validateWizardStep(wizardData, 0);
      const paso1 =
        wizardData.tipo_planificacion === 'sin_periodo'
          ? { valid: true, errors: [] as FieldError[], firstInvalidField: undefined }
          : validateWizardStep(wizardData, 1);
      const paso2 = validateWizardStep(wizardData, 2);

      errors.push(...paso0.errors, ...paso1.errors, ...paso2.errors);
      firstInvalidField =
        paso0.firstInvalidField || paso1.firstInvalidField || paso2.firstInvalidField;
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    firstInvalidField,
  };
}
