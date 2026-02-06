# Phase 2: Requested Versions Alignment

> **Estado**: COMPLETADO  
> **Fecha**: 2026-02-06  
> **Archivo modificado**: `supabase/functions/modify-evaluation/index.ts`

---

## Resumen del problema anterior

### Comportamiento confuso previo

Antes de Phase 2, el sistema tenía **múltiples variables** que determinaban si generar las versiones B y C:

1. `generateVersionB` / `generateVersionC` - usados para construir el prompt
2. `shouldHaveB` / `shouldHaveC` - usados para validación, calculados de forma **diferente**

```typescript
// ANTES: Dos cálculos diferentes para el mismo concepto
const generateVersionB = designPlan.triggers?.versionB === true || assignmentsIncludeB;
const generateVersionC = designPlan.triggers?.versionC === true || assignmentsIncludeC || hasContentAdaptationStudent;

// ... más adelante en el código ...
const shouldHaveB = assignmentCountsForCheck.B > 0 || designPlan.triggers?.versionB === true;
const shouldHaveC = assignmentCountsForCheck.C > 0 || designPlan.triggers?.versionC === true;
```

Esta duplicación causaba:
- Prompts que decían "B es OBLIGATORIA" cuando no siempre era necesaria
- Validación que esperaba versiones que no fueron solicitadas
- Retries innecesarios cuando B o C faltaban pero no eran requeridas
- Logs confusos con múltiples variables que no coincidían

### Mensajes problemáticos en el prompt

El prompt anterior usaba lenguaje absoluto:

```
- Versión B es OBLIGATORIA y debe ser DIFERENTE de A
- Versión C es OBLIGATORIA y debe ser DIFERENTE de A y B
```

Esto confundía al modelo cuando B o C no eran realmente necesarias para el grupo.

---

## Solución implementada: `requestedVersions`

### Nueva fuente única de verdad

Se introdujo un objeto centralizado que determina qué versiones son requeridas:

```typescript
const requestedVersions = {
  A: true, // Siempre requerida
  B: designPlan.triggers?.versionB === true || assignmentsIncludeB,
  C: designPlan.triggers?.versionC === true || assignmentsIncludeC || hasContentAdaptationStudent
};
```

### Lógica de decisión

| Versión | Condición |
|---------|-----------|
| **A** | Siempre requerida |
| **B** | `designPlan.triggers.versionB === true` **OR** algún estudiante está asignado a B |
| **C** | `designPlan.triggers.versionC === true` **OR** algún estudiante está asignado a C **OR** algún estudiante tiene `hasDeclaredContentAdaptation` / `requiereAdecuacionContenido` / `requiresContentAdaptation` |

### Variables de compatibilidad

Para minimizar cambios, se mantienen aliases:

```typescript
const generateVersionB = requestedVersions.B;
const generateVersionC = requestedVersions.C;
const shouldHaveB = requestedVersions.B;
const shouldHaveC = requestedVersions.C;
```

---

## Cambios en el prompt

### System prompt - Reglas absolutas

**Antes:**
```
- Versión B es OBLIGATORIA y debe ser DIFERENTE de A (formato equivalente).
- Versión C es OBLIGATORIA y debe ser DIFERENTE de A y B (adecuación de contenido).
```

**Después:**
```
- Versión B: Genera esta versión con formato equivalente pero diferente de A.
  // O si no es requerida:
- Versión B: NO generar (no fue solicitada para este grupo).
```

### User prompt - Versiones requeridas

**Antes:**
```
VERSIONES REQUERIDAS:
- Versión A: OBLIGATORIA (universal)
- Versión B: OBLIGATORIA (formato equivalente, misma evidencia)
- Versión C: NO generar
```

**Después:**
```
VERSIONES REQUERIDAS:
- Versión A: Requerida (evaluación universal base)
- Versión B: Requerida (formato equivalente, misma evidencia)
  // O si no es requerida:
- Versión B: No requerida para este grupo
- Versión C: No requerida para este grupo
```

---

## Archivos modificados

### `supabase/functions/modify-evaluation/index.ts`

| Sección | Cambio |
|---------|--------|
| Líneas ~2100-2115 | Nuevo bloque `requestedVersions` con logging |
| Líneas ~2116-2118 | `generateVersionB/C` ahora son aliases de `requestedVersions` |
| Líneas ~2155-2165 | System prompt usa lenguaje condicional |
| Líneas ~2185-2190 | User prompt usa lenguaje condicional |
| Líneas ~2275-2280 | Logging de `[OPENAI_PROMPT]` usa `requestedVersions` |
| Líneas ~2405-2410 | `shouldHaveB/C` ahora son aliases de `requestedVersions` |

---

## Nuevos logs de observabilidad

### `[REQUESTED_VERSIONS]`

```
[REQUESTED_VERSIONS] ========== VERSION DECISION ==========
[REQUESTED_VERSIONS] A: true (always required)
[REQUESTED_VERSIONS] B: false | triggers.versionB: undefined | assignmentsIncludeB: false
[REQUESTED_VERSIONS] C: true | triggers.versionC: true | assignmentsIncludeC: false | hasContentAdaptation: true
[REQUESTED_VERSIONS] summary: A +C
[REQUESTED_VERSIONS] ==========================================
```

### `[OPENAI_PROMPT]` actualizado

```
[OPENAI_PROMPT] requestedVersions: {"A":true,"B":false,"C":true}
```

---

## Verificación por escenario

### Escenario 1: Solo A (grupo sin necesidades especiales)

**Condiciones:**
- `designPlan.triggers.versionB` = false/undefined
- `designPlan.triggers.versionC` = false/undefined
- Ningún estudiante asignado a B o C
- Ningún estudiante con `hasDeclaredContentAdaptation`

**Logs esperados:**
```
[REQUESTED_VERSIONS] A: true (always required)
[REQUESTED_VERSIONS] B: false | triggers.versionB: undefined | assignmentsIncludeB: false
[REQUESTED_VERSIONS] C: false | triggers.versionC: undefined | assignmentsIncludeC: false | hasContentAdaptation: false
[REQUESTED_VERSIONS] summary: A
```

**Prompt esperado:**
```
- Versión B: NO generar (no fue solicitada para este grupo).
- Versión C: NO generar (no fue solicitada para este grupo).
```

### Escenario 2: A + B (opciones de respuesta equivalentes)

**Condiciones:**
- `designPlan.triggers.versionB` = true
- Ningún estudiante con `hasDeclaredContentAdaptation`

**Logs esperados:**
```
[REQUESTED_VERSIONS] A: true (always required)
[REQUESTED_VERSIONS] B: true | triggers.versionB: true | assignmentsIncludeB: false
[REQUESTED_VERSIONS] C: false | ...
[REQUESTED_VERSIONS] summary: A +B
```

### Escenario 3: A + C (adaptación de contenido)

**Condiciones:**
- Al menos un estudiante con `hasDeclaredContentAdaptation: true`
- `designPlan.triggers.versionB` = false/undefined

**Logs esperados:**
```
[REQUESTED_VERSIONS] A: true (always required)
[REQUESTED_VERSIONS] B: false | ...
[REQUESTED_VERSIONS] C: true | triggers.versionC: false | assignmentsIncludeC: false | hasContentAdaptation: true
[REQUESTED_VERSIONS] summary: A +C
```

### Escenario 4: A + B + C (todas las versiones)

**Condiciones:**
- `designPlan.triggers.versionB` = true
- Al menos un estudiante con `hasDeclaredContentAdaptation: true`

**Logs esperados:**
```
[REQUESTED_VERSIONS] summary: A +B +C
```

---

## Cómo verificar en producción

1. Ir a [Supabase Dashboard](https://supabase.com/dashboard/project/srlrbuphsogwgymqywhe/functions) → Edge Functions → modify-evaluation → Logs

2. Filtrar por:
   - `[REQUESTED_VERSIONS]` - Ver la decisión de versiones
   - `[OPENAI_PROMPT] requestedVersions` - Ver qué se envió al modelo

3. Verificar que el prompt NO dice "OBLIGATORIA" para versiones no requeridas

4. Verificar que la respuesta solo incluye las versiones solicitadas

---

## Riesgos y limitaciones

### Sin cambios en esta fase

- **No se modificó la lógica de retry**: Si una versión requerida falla, el comportamiento de retry existente se mantiene.
- **No se modificó la base de datos**: Los flags existentes en `evaluation_design_plan` siguen siendo la fuente de verdad.
- **No se modificó el frontend**: El frontend sigue enviando los mismos datos.

### Posibles mejoras futuras

1. **Eliminar variables duplicadas**: Refactorizar para usar solo `requestedVersions` en todo el código.
2. **Validación más estricta**: Advertir si se generó una versión no solicitada.
3. **Métricas**: Trackear qué combinaciones de versiones se generan con más frecuencia.

---

## Rollback

Si es necesario revertir:

1. Restaurar el archivo desde git:
   ```bash
   git checkout HEAD~1 -- supabase/functions/modify-evaluation/index.ts
   ```

2. Re-desplegar:
   ```bash
   supabase functions deploy modify-evaluation
   ```
