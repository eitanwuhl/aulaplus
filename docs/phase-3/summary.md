# Phase 3: Beta Toggle + v2 Fallback

> **Fecha**: 2026-02-06  
> **Estado**: Implementado  
> **Objetivo**: Permitir probar v2 de forma segura con fallback automático a v1

---

## Resumen

Esta fase agrega un toggle "Beta (v2)" en la UI de generación de evaluaciones que permite a los usuarios optar por usar el nuevo backend v2 (JSON estructurado). Si v2 falla, el sistema automáticamente usa v1 y muestra un mensaje amigable.

---

## Archivos Creados/Modificados

### Nuevos Archivos

| Archivo | Descripción |
|---------|-------------|
| `src/services/evaluations/requestService.ts` | Servicio unificado que maneja requests a v1/v2 con fallback |
| `src/components/evaluaciones/BetaToggle.tsx` | Componente de toggle para activar/desactivar v2 |

### Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `src/components/evaluaciones/index.ts` | Export del nuevo `BetaToggle` |
| `src/pages/EvaluacionesGrupo.tsx` | Integración del toggle y uso del servicio unificado |

---

## Cómo Funciona el Toggle

### UI

El toggle aparece justo antes del botón "Generar Evaluaciones Inteligentes":

```
┌─────────────────────────────────────────┐
│ 🧪 Beta (v2)  [OFF/ON]                  │
│ ℹ️ Usa el nuevo formato estructurado.   │
│    Si no está disponible, volvemos al   │
│    formato estándar automáticamente.    │
└─────────────────────────────────────────┘
```

### Persistencia

El estado del toggle se guarda en `localStorage` bajo la key:
```
aulaplus:eval-beta-toggle
```

Esto significa que:
- La preferencia sobrevive recargas de página
- Cada usuario mantiene su propia preferencia
- El default es `false` (v1)

### Funciones de Acceso

```typescript
import { getBetaToggleState, setBetaToggleState } from '@/services/evaluations/requestService';

// Leer estado actual
const isEnabled = getBetaToggleState(); // boolean

// Cambiar estado
setBetaToggleState(true); // Habilitar v2
setBetaToggleState(false); // Volver a v1
```

---

## Lógica de Fallback

### Flujo de Decisión

```
Usuario hace click en "Generar"
         │
         ▼
┌─────────────────┐
│ Toggle = ON?    │
└────────┬────────┘
         │
    ┌────┴────┐
    │ NO      │ SI
    ▼         ▼
┌────────┐ ┌────────────┐
│ Call   │ │ Call v2    │
│ v1     │ └─────┬──────┘
└────────┘       │
                 ▼
          ┌─────────────┐
          │ v2 Success? │
          └──────┬──────┘
                 │
            ┌────┴────┐
            │ NO      │ SI
            ▼         ▼
     ┌────────────┐ ┌────────────┐
     │ Call v1    │ │ Return v2  │
     │ (fallback) │ │ result     │
     └─────┬──────┘ └────────────┘
           │
           ▼
    ┌─────────────┐
    │ Show toast: │
    │ "Modo       │
    │ estándar    │
    │ activado"   │
    └─────────────┘
```

### Condiciones de Fallback

v2 se considera fallido si:

1. **Error de red**: La llamada a `modify-evaluation-v2` falla
2. **Timeout**: La respuesta tarda demasiado
3. **JSON inválido**: La respuesta no es JSON parseable
4. **Validación fallida**: Faltan campos requeridos:
   - `success` (boolean)
   - `evaluationSpec.sections` (array)
   - `evaluationSpec.versionVariants` (object)
   - `requestedVersions` (object)
   - `warnings` (array)
5. **success: false**: El backend reportó error

### Mensaje de Fallback

Cuando ocurre fallback, se muestra un toast:

```
┌─────────────────────────────────────┐
│ ✓ Modo estándar activado            │
│ Cargamos la versión estándar para   │
│ garantizar confiabilidad.           │
└─────────────────────────────────────┘
```

Y debajo del toggle aparece un banner:

```
ℹ️ Se usó el modo estándar en la última generación para garantizar confiabilidad.
```

---

## Validación de Respuestas v2

### Campos Requeridos

```typescript
// success === true requiere:
{
  success: true,
  evaluationSpec: {
    sections: Array<{ items: Array<...> }>,  // Al menos 1 sección
    versionVariants: { A: {...} }            // Al menos versión A
  },
  requestedVersions: { A: boolean, B: boolean, C: boolean },
  warnings: []
}
```

### Campos Opcionales

```typescript
{
  instrumentDesignRulesApplied: string[],
  teacherRemindersByStudent: Array<{...}>,
  aiReport: {...},
  debug: {...}
}
```

### Normalización

Si faltan campos opcionales, se normalizan a valores vacíos:
- Arrays faltantes → `[]`
- Objects faltantes → `{}`

---

## Logging (DEV Only)

En modo desarrollo (`import.meta.env.DEV === true`), se loguea:

```
[EVAL_SERVICE] ========== REQUEST START ==========
[EVAL_SERVICE] requestId: req_1234567890_abc123
[EVAL_SERVICE] useBeta: true
[EVAL_SERVICE] payload.groupContext.subject: Historia
[EVAL_SERVICE] Calling v2 endpoint
[EVAL_SERVICE] v2 success (no fallback needed)
[EVAL_SERVICE] ========== REQUEST END ==========
```

Si hay fallback:

```
[EVAL_SERVICE] Calling v2 endpoint
[EVAL_SERVICE] v2 failed, falling back to v1: v2 validation failed: missing: evaluationSpec.sections
[EVAL_SERVICE] Calling v1 endpoint
[EVAL_SERVICE] v1 fallback success
```

---

## Testing Manual

### Paso 1: Verificar Toggle

1. Ir a `/evaluaciones`
2. Seleccionar un grupo y materia
3. Verificar que el toggle "Beta (v2)" aparece antes del botón "Generar"
4. El toggle debe estar OFF por defecto

### Paso 2: Probar v1 (Toggle OFF)

1. Mantener toggle OFF
2. Click en "Generar Evaluaciones Inteligentes"
3. Verificar que la evaluación se genera correctamente
4. En la consola (DEV), verificar log: `[EVAL_SERVICE] Calling v1 endpoint`

### Paso 3: Probar v2 (Toggle ON)

1. Activar toggle (ON)
2. Click en "Generar Evaluaciones Inteligentes"
3. Observar uno de estos resultados:
   - **v2 Success**: Evaluación generada, sin toast de fallback
   - **v2 Fallback**: Toast "Modo estándar activado", evaluación generada con v1
4. En la consola (DEV), verificar logs correspondientes

### Paso 4: Verificar Persistencia

1. Activar toggle (ON)
2. Recargar la página (F5)
3. Verificar que el toggle sigue ON

### Paso 5: Verificar Debug Panel (opcional)

1. Setear variable de entorno: `VITE_DEBUG_EVAL_PIPELINE=true`
2. Reiniciar dev server
3. Generar evaluación
4. El debug panel debe mostrar:
   - `Endpoint: modify-evaluation` (v1) o `modify-evaluation-v2` (v2)
   - Si v2: Badge "v2 Beta"
   - Si fallback: ⚠️ Fallback usado

---

## Limitaciones Conocidas

1. **v2 siempre convierte a HTML**: Por ahora, las respuestas v2 se convierten a HTML para mantener compatibilidad con el renderer existente. El renderer JSON nativo viene en Phase 4.

2. **Sin retry automático en v2**: Si v2 falla, no hay retry - va directo a fallback v1.

3. **Logs solo en DEV**: Los logs detallados solo aparecen en modo desarrollo.

4. **Sin métricas**: No hay tracking de tasa de éxito v1 vs v2 todavía.

---

## Próximos Pasos (Phase 4)

1. **EvaluationRendererV2**: Componente que renderiza JSON estructurado directamente
2. **Dual rendering**: Mostrar v2 JSON si disponible, fallback a HTML
3. **Métricas**: Tracking de uso y tasa de éxito
4. **A/B testing**: Habilitar v2 para % de usuarios progresivamente

---

## Referencias

- [requestService.ts](../../src/services/evaluations/requestService.ts) - Servicio unificado
- [BetaToggle.tsx](../../src/components/evaluaciones/BetaToggle.tsx) - Componente UI
- [Phase 2 Doc](../phase-2-v2-edge-function.md) - Documentación del backend v2
