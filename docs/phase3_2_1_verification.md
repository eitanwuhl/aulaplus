# Phase 3.2.1 - Verificación de Correcciones

## Resumen Ejecutivo

✅ **Las tres correcciones críticas (P1, P2, P3) están implementadas y verificadas en el código.**

Archivo objetivo: `src/pages/PlanificacionWizard.tsx`

---

## P1: Map briefs by `orden`, not by array index

### ✅ Verificación en `persistSessionBriefs`

**Líneas: 176-203**

```typescript
// Fetch sessions for this planning ordered by orden
const { data: sesiones, error: sesionesError } = await supabase
  .from('sesiones_clase')
  .select('id, orden')
  .eq('planificacion_id', planificacionId)
  .order('orden', { ascending: true });
```

```typescript
// P1 FIX: Map briefs by orden (NOT array index)
// sessionBriefs[i] corresponds to session with orden = i + 1
const updates = sesiones
  .filter(s => (s.orden ?? 0) > 0) // Only update sessions with valid orden > 0
  .map((s) => {
    const idx = (s.orden as number) - 1; // Convert orden (1-based) to array index (0-based)
    const brief = idx >= 0 && idx < sessionBriefs.length ? sessionBriefs[idx] : undefined;
    return {
      id: s.id,
      session_brief: brief?.trim() || null  // Empty/whitespace => NULL
    };
  });
```

**Checklist:**
- ✅ Fetch con `select('id, orden')` ordenado por `orden ASC`
- ✅ Filter sessions con `orden > 0`
- ✅ Mapeo: `idx = (orden) - 1`
- ✅ Validación: `idx >= 0 && idx < sessionBriefs.length`
- ✅ Persistencia: `brief?.trim() || null`

### ✅ Verificación en `loadSessionBriefs`

**Líneas: 94-127**

```typescript
// Fetch sessions ordered by orden
const { data: sesiones, error: sesionesError } = await supabase
  .from('sesiones_clase')
  .select('session_brief, orden')
  .eq('planificacion_id', planificacionId)
  .order('orden', { ascending: true });
```

```typescript
// P1 FIX: Build array aligned to orden (handle sparse/non-contiguous ordens)
// Determine max orden
const maxOrden = Math.max(...sesiones.map(s => s.orden ?? 0).filter(o => o > 0));
if (!maxOrden || maxOrden <= 0) {
  return undefined;
}

// Build array sized maxOrden, fill with undefined
const briefs = Array<string | undefined>(maxOrden).fill(undefined);

// Assign briefs[orden-1] = session_brief ?? undefined
sesiones.forEach(s => {
  if ((s.orden ?? 0) > 0) {
    briefs[(s.orden as number) - 1] = s.session_brief ?? undefined;
  }
});
```

**Checklist:**
- ✅ Fetch con `select('orden, session_brief')` ordenado por `orden ASC`
- ✅ Compute `maxOrden` entre valid ordens > 0
- ✅ Allocate `Array(maxOrden).fill(undefined)`
- ✅ Assign `briefs[orden - 1] = session_brief ?? undefined`

---

## P2: Non-blocking persistence must still warn user reliably

### ✅ Verificación del tipo `PersistResult`

**Línea: 163**

```typescript
type PersistResult = { ok: boolean; attempted: number; failures: number };
```

**Checklist:**
- ✅ Tipo definido con tres campos requeridos

### ✅ Verificación en `persistSessionBriefs`

**Retorno seguro - nunca throw:**

**Líneas: 170-172** (no sessionBriefs)
```typescript
if (!sessionBriefs || sessionBriefs.length === 0) {
  return { ok: true, attempted: 0, failures: 0 };
}
```

**Líneas: 182-185** (session fetch fails)
```typescript
if (sesionesError) {
  console.error('[persistSessionBriefs] Error fetching sessions:', sesionesError);
  return { ok: false, attempted: 0, failures: 0 };
}
```

**Líneas: 209-237** (Promise.allSettled + count failures)
```typescript
// Apply updates using Promise.allSettled to avoid blocking on individual failures
const results = await Promise.allSettled(
  updates.map(update =>
    supabase
      .from('sesiones_clase')
      .update({ session_brief: update.session_brief })
      .eq('id', update.id)
  )
);

// Count failures
const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
const failureCount = failures.length;
const ok = failureCount === 0;

if (failures.length > 0) {
  console.error('[persistSessionBriefs] Some updates failed:', failures);
  // ... logging ...
} else {
  console.log(`[persistSessionBriefs] Successfully persisted ${updates.length} session briefs`);
}

return { ok, attempted: updates.length, failures: failureCount };
```

**Líneas: 238-242** (catch block)
```typescript
} catch (error) {
  // Log error and return failure result (non-blocking per requirement)
  console.error('[persistSessionBriefs] Error persisting session briefs:', error);
  return { ok: false, attempted: 0, failures: 0 };
}
```

**Checklist:**
- ✅ Nunca lanza excepciones (todos los paths retornan `PersistResult`)
- ✅ Usa `Promise.allSettled` para updates
- ✅ Cuenta failures correctamente
- ✅ Retorna `{ ok: failures === 0, attempted, failures }`

### ✅ Verificación en `handleFinish` - Warning toast

**Líneas: 782-791**

```typescript
// PHASE 3.2: Persist session briefs to database before generation
// This ensures briefs survive refresh/navigation and are available for retry
const persistResult = await persistSessionBriefs(planificacion.id, wizardData.enfoque?.sessionBriefs);

// P2 FIX: Show warning toast if persistence had failures (non-blocking)
if (!persistResult.ok || persistResult.failures > 0) {
  toast({
    title: "Advertencia",
    description: "No se pudieron guardar algunos temas de las clases. La generación continuará con los valores actuales.",
    variant: "default"
  });
}
```

**Checklist:**
- ✅ Llamada a `persistSessionBriefs`
- ✅ Check `!ok || failures > 0`
- ✅ Muestra warning toast si hay fallos
- ✅ Continúa con generación (non-blocking) - línea 793+

---

## P3: Resolver must not ignore DB briefs due to empty wizard defaults

### ✅ Verificación del helper `hasMeaningfulBriefs`

**Líneas: 135-137**

```typescript
// PHASE 3.2: Helper to check if array has meaningful briefs (at least one non-empty after trimming)
function hasMeaningfulBriefs(arr?: (string | undefined)[]): boolean {
  return Array.isArray(arr) && arr.some(v => (v ?? '').trim().length > 0);
}
```

**Checklist:**
- ✅ Helper definido correctamente
- ✅ Chequea al menos un valor no-vacío después de trim

### ✅ Verificación de `resolveSessionBriefs`

**Líneas: 140-160**

```typescript
async function resolveSessionBriefs(
  planificacionId: string,
  wizardSessionBriefs: (string | undefined)[] | undefined
): Promise<(string | undefined)[] | undefined> {
  // P3 FIX: Treat "meaningful wizard state" as having at least one non-empty entry
  // If wizard has meaningful briefs, prefer it (latest unsaved edits)
  if (hasMeaningfulBriefs(wizardSessionBriefs)) {
    return wizardSessionBriefs;
  }

  // Otherwise, load from DB
  const dbBriefs = await loadSessionBriefs(planificacionId);
  
  // If DB has meaningful briefs, use them
  if (hasMeaningfulBriefs(dbBriefs)) {
    return dbBriefs;
  }

  // If both are empty/undefined, return undefined (backward compatibility)
  return undefined;
}
```

**Checklist:**
- ✅ Si `hasMeaningfulBriefs(wizardSessionBriefs)` => retorna wizard
- ✅ Sino, carga `dbBriefs` via `loadSessionBriefs`
- ✅ Si `hasMeaningfulBriefs(dbBriefs)` => retorna DB
- ✅ Si ambos vacíos => retorna `undefined`

### ✅ Verificación en `handleRetryGeneration`

**Líneas: 562-573**

```typescript
try {
  // PHASE 3.2: Resolve sessionBriefs from wizard state or DB (source-of-truth)
  const resolvedBriefs = await resolveSessionBriefs(
    wizardData.planificacionId,
    wizardData.enfoque?.sessionBriefs
  );

  const planesGenerados = await generarPlanesAutomaticamente(
    wizardData.planificacionId, 
    wizardData.materia || 'Sin especificar', 
    wizardData.nivel || 'Sin especificar',
    resolvedBriefs  // PHASE 3.2: Use resolved briefs (wizard state or DB)
  );
```

**Checklist:**
- ✅ Llama a `resolveSessionBriefs` antes de generación
- ✅ Pasa briefs resueltos a `generarPlanesAutomaticamente`

---

## Tabla de Verificación Completa

| Corrección | Componente | Líneas | Estado | Notas |
|------------|------------|--------|--------|-------|
| **P1** | `persistSessionBriefs` | 176-203 | ✅ | Mapeo por `orden`, filter `> 0`, `NULL` para vacíos |
| **P1** | `loadSessionBriefs` | 94-127 | ✅ | Array alineado a `orden`, maneja ordens sparse |
| **P2** | `PersistResult` type | 163 | ✅ | Tipo definido |
| **P2** | `persistSessionBriefs` returns | 168-242 | ✅ | Nunca throw, `Promise.allSettled`, cuenta failures |
| **P2** | `handleFinish` warning | 782-791 | ✅ | Toast si `!ok \|\| failures > 0`, non-blocking |
| **P3** | `hasMeaningfulBriefs` helper | 135-137 | ✅ | Chequea al menos un non-empty trim |
| **P3** | `resolveSessionBriefs` | 140-160 | ✅ | Wizard meaningful > DB meaningful > undefined |
| **P3** | `handleRetryGeneration` | 562-573 | ✅ | Usa resolver hardeneado |

---

## Casos de Prueba Recomendados

### P1 - Orden Mapping

**Test 1: Sesiones con ordens contiguos (1, 2, 3)**
- Wizard: `["Brief 1", "Brief 2", "Brief 3"]`
- Expected: Sesión orden=1 → "Brief 1", orden=2 → "Brief 2", orden=3 → "Brief 3"

**Test 2: Sesiones con ordens sparse (1, 3, 5)**
- Wizard: `["Brief 1", undefined, "Brief 3", undefined, "Brief 5"]`
- Expected: Sesión orden=1 → "Brief 1", orden=3 → "Brief 3", orden=5 → "Brief 5"

**Test 3: Más briefs que sesiones**
- Wizard: `["Brief 1", "Brief 2", "Brief 3", "Brief 4"]`
- Sesiones: orden=1, orden=2
- Expected: Sesión orden=1 → "Brief 1", orden=2 → "Brief 2" (extras ignorados)

**Test 4: Menos briefs que sesiones**
- Wizard: `["Brief 1", "Brief 2"]`
- Sesiones: orden=1, orden=2, orden=3
- Expected: Sesión orden=1 → "Brief 1", orden=2 → "Brief 2", orden=3 → NULL

### P2 - Non-blocking con warnings

**Test 1: Persistencia exitosa**
- Expected: `{ ok: true, attempted: N, failures: 0 }`, no toast

**Test 2: Algunos updates fallan**
- Simular fallo en update de sesión 2
- Expected: `{ ok: false, attempted: 3, failures: 1 }`, warning toast, generación continúa

**Test 3: Fetch de sesiones falla**
- Expected: `{ ok: false, attempted: 0, failures: 0 }`, warning toast, generación continúa

### P3 - Resolver no ignora DB

**Test 1: Wizard tiene contenido meaningful**
- Wizard: `["Brief importante", undefined]`
- DB: `["Brief viejo", "Otro brief viejo"]`
- Expected: Usa wizard (más reciente)

**Test 2: Wizard vacío, DB tiene contenido**
- Wizard: `[undefined, undefined]` o `["", ""]`
- DB: `["Brief en DB", "Otro brief en DB"]`
- Expected: Usa DB

**Test 3: Ambos vacíos**
- Wizard: `[undefined]`
- DB: `[undefined]`
- Expected: `undefined` (backward compatibility)

**Test 4: Wizard con solo whitespace**
- Wizard: `["   ", "\t\n"]`
- DB: `["Brief en DB"]`
- Expected: Usa DB (wizard no meaningful)

---

## Conclusión

✅ **Todas las correcciones P1, P2, P3 están implementadas correctamente en el código.**

No se requieren cambios adicionales. El código cumple con todos los requisitos especificados en la fase 3.2.1.

**Referencias de código:**
- `src/pages/PlanificacionWizard.tsx` líneas 89-243 (helpers P1/P2/P3)
- `src/pages/PlanificacionWizard.tsx` líneas 551-596 (`handleRetryGeneration` con P3)
- `src/pages/PlanificacionWizard.tsx` líneas 782-791 (`handleFinish` con P2)



















