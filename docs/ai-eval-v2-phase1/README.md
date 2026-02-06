# AI Evaluation v2 — Resumen Ejecutivo

> **Phase 1**: Análisis y especificación (sin código)  
> **Fecha**: 2026-02-06

## 🎯 Objetivo

Migrar de evaluaciones generadas como **HTML monolítico** a un **JSON estructurado** (`EvaluationSpecV2`) que permita:

1. Renderizado flexible en frontend
2. Validación de schema
3. Manejo granular de errores
4. Soporte para múltiples layouts (pantalla, impresión, mobile)

## 📋 Entregables Phase 1

| Documento | Estado |
|-----------|--------|
| [specification.md](./specification.md) | ✅ Completo |

## 🔑 Decisiones de Diseño Clave

### 1. Teacher Reminders vs Instrument Design

```
Teacher Reminders (para panel docente)
├── admin[]      → "Leer consignas en voz alta"
└── correction[] → "No penalizar ortografía"

Instrument Design (para AI Report, NO para reminders)
└── allowances[] → "Palabras clave en negrita"
```

### 2. Versiones Condicionales

- `requestedVersions` es la **única fuente de verdad**
- Si `requestedVersions: ["A"]`, el JSON NO incluye `versionVariants.B` ni `versionVariants.C`
- Evita generar contenido innecesario

### 3. Fallbacks Graceful

```
Si v2 falla → Mostrar v1 (HTML legacy)
Si versión C falla → Banner + mostrar versión A
Si item malformado → Placeholder amigable
```

### 4. Item Types

| Tipo | Uso |
|------|-----|
| `multiple_choice` | Opción múltiple |
| `true_false_justify` | V/F con justificación |
| `short_answer` | Respuesta corta |
| `essay` | Desarrollo + opciones equivalentes |
| `source_analysis` | Análisis de fuentes |
| `table_completion` | Completar tablas |

## 📂 Schema EvaluationSpecV2

```
{
  meta: { subject, group, duration, ... }
  sections: [ { items: [...] } ]
  versionVariants: { A, B?, C? }
  studentAssignments: { byStudentId, counts }
  teacherReminders: { byStudent, global }
  aiReport: { rationale, contemplaciones, ... }
  warnings: []
}
```

## 🚀 Phase 2 (Implementación)

Ver [specification.md#5-checklist-phase-2](./specification.md#5-checklist-phase-2-implementación)

### Resumen:

1. **Backend**: Nuevo edge function `modify-evaluation-v2` con JSON output
2. **Frontend**: Nuevos componentes en `src/components/evaluaciones-v2/`
3. **Feature flag**: `EVAL_V2_ENABLED` para rollout gradual
4. **Observabilidad**: Logs estructurados + métricas de éxito

## ⚠️ Riesgos Principales

| Riesgo | Mitigación |
|--------|------------|
| JSON malformado | Retry + fallback HTML |
| UI no reconoce item type | `UnknownItemRenderer` |
| Latencia aumentada | Cache de specs |

---

**Siguiente paso**: Revisión del documento de especificación antes de comenzar Phase 2.
