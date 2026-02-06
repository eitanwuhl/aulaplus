# Recordatorios vs Diseño del Cuadernillo

> Documentación sobre la distinción entre contemplaciones que generan recordatorios para el docente vs contemplaciones que afectan el diseño del instrumento de evaluación.

## El Problema

Anteriormente, el panel "Recordatorios para el docente" mostraba tres categorías:
- **Administración** (bucket: `ADMIN_REMINDER`) ✓
- **Corrección** (bucket: `CORRECTION_REMINDER`) ✓  
- **Permisos / apoyos** (bucket: `INSTRUMENT_DESIGN`) ✗

La sección "Permisos / apoyos" era incorrecta porque las contemplaciones del bucket `INSTRUMENT_DESIGN` **NO son recordatorios para el docente**. Son reglas que afectan directamente el diseño del cuadernillo de evaluación.

## La Solución

### Separación de Responsabilidades

| Bucket | Propósito | ¿Dónde se muestra? |
|--------|-----------|-------------------|
| `ADMIN_REMINDER` | Instrucciones para administrar la evaluación (tiempo extra, ubicación especial, etc.) | Panel "Recordatorios para el docente" |
| `CORRECTION_REMINDER` | Instrucciones para corregir (criterios especiales, tolerancias, etc.) | Panel "Recordatorios para el docente" |
| `INSTRUMENT_DESIGN` | Adaptaciones al formato del cuadernillo (letra grande, menos ítems por página, etc.) | "Reporte de IA" → "Adaptaciones aplicadas al instrumento" |

### Cambios Realizados

#### 1. TeacherRemindersPanel.tsx

```typescript
// ANTES: Incluía allowances en el filtro
const meaningfulReminders = reminders.filter(item =>
  item.admin.length > 0 || item.correction.length > 0 || item.allowances.length > 0
);

// DESPUÉS: Solo admin y correction son recordatorios
const meaningfulReminders = reminders.filter(item =>
  item.admin.length > 0 || item.correction.length > 0
);
```

También se eliminó la sección "Permisos / apoyos" del render.

#### 2. AIDesignReport.tsx

Se agregó una nueva sección "Adaptaciones aplicadas al instrumento" que muestra las contemplaciones de `INSTRUMENT_DESIGN` que fueron consideradas al generar el cuadernillo:

```tsx
{reportData.contemplaciones?.instrument_design?.length > 0 && (
  <div className="space-y-2 border-t pt-4">
    <h4 className="font-semibold text-sm">Adaptaciones aplicadas al instrumento</h4>
    <p className="text-xs text-muted-foreground mb-2">
      Estas contemplaciones afectan el diseño del cuadernillo (no son recordatorios para el docente):
    </p>
    <ul className="list-disc pl-5 text-sm">
      {reportData.contemplaciones.instrument_design.map((item, idx) => (
        <li key={idx}>{item}</li>
      ))}
    </ul>
  </div>
)}
```

## Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────────┐
│                      buildEvaluationDesignPlan()                     │
│                   src/services/evaluations/designPlan.ts             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Contemplaciones por bucket:                                         │
│                                                                      │
│  ┌─────────────────────┐                                            │
│  │  ADMIN_REMINDER     │ ──────► perStudentReminders.admin[]        │
│  └─────────────────────┘         (mostrado en TeacherRemindersPanel) │
│                                                                      │
│  ┌─────────────────────┐                                            │
│  │  CORRECTION_REMINDER│ ──────► perStudentReminders.correction[]   │
│  └─────────────────────┘         (mostrado en TeacherRemindersPanel) │
│                                                                      │
│  ┌─────────────────────┐                                            │
│  │  INSTRUMENT_DESIGN  │ ──────► instrumentDesignContemplacionIds[] │
│  └─────────────────────┘              │                              │
│                                       ▼                              │
│                     getEvaluationDesignRuleTemplate(id)              │
│                                       │                              │
│                                       ▼                              │
│                              instrumentDesignRules[]                 │
│                                       │                              │
│                                       ▼                              │
│               evaluation_design_plan.instrumentDesignRules           │
│                            (enviado al backend)                      │
│                                       │                              │
│                                       ▼                              │
│                      aiReport.contemplaciones.instrument_design      │
│                         (mostrado en AIDesignReport)                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Cómo Verificar

1. **Crear una evaluación grupal** con estudiantes que tengan contemplaciones de diferentes buckets
2. **Panel "Recordatorios para el docente"**: Debe mostrar SOLO items de administración y corrección
3. **Reporte de IA** → "Adaptaciones aplicadas al instrumento": Debe mostrar las contemplaciones de diseño de instrumento

## Archivos Modificados

- [src/components/evaluaciones/TeacherRemindersPanel.tsx](../../src/components/evaluaciones/TeacherRemindersPanel.tsx)
- [src/components/evaluaciones/AIDesignReport.tsx](../../src/components/evaluaciones/AIDesignReport.tsx)

## Contexto Adicional

El tipo `StudentReminders` (en `src/services/evaluations/types.ts`) mantiene las tres propiedades `admin`, `correction`, y `allowances` porque los datos de allowances aún se necesitan internamente para el flujo de versiones y asignaciones. Simplemente no se muestran en el panel de recordatorios porque **no son recordatorios**.

---

*Fecha: 2025-01-XX*  
*Relacionado: proactive-seeding-evaluaciones.md, option-a-missing-pieces.md*
