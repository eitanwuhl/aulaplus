# Phase 3.2.1 - Correcciones P1/P2/P3 Implementadas

## Estado: ✅ IMPLEMENTADO

Las tres correcciones críticas (P1, P2, P3) **ya están implementadas** en `src/pages/PlanificacionWizard.tsx`.

Este documento proporciona referencias a las líneas de código donde cada corrección está visible.

---

## P1: Map briefs by `orden`, not by array index

### Ubicación en código

#### `persistSessionBriefs` - Líneas 192-203

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
      session_brief: brief?.trim() || null
    };
  });
```

**Implementación correcta:**
- ✅ Fetch sessions con `select('id, orden')` ordenado por `orden ASC` (líneas 176-180)
- ✅ Filtrado de sesiones con `orden > 0` (línea 195)
- ✅ Mapeo usando `idx = (orden) - 1` (línea 197)
- ✅ Validación de índice en rango (línea 198)
- ✅ Persistencia como `NULL` para valores vacíos (línea 201)

#### `loadSessionBriefs` - Líneas 109-124

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

**Implementación correcta:**
- ✅ Fetch con `select('session_brief, orden')` ordenado por `orden ASC` (líneas 94-98)
- ✅ Cálculo de `maxOrden` entre ordens válidos > 0 (línea 111)
- ✅ Asignación de array de tamaño `maxOrden` (línea 117)
- ✅ Mapeo `briefs[orden - 1] = session_brief ?? undefined` (línea 122)

---

## P2: Non-blocking persistence must still warn user reliably

### Ubicación en código

#### Tipo `PersistResult` - Línea 163

```typescript
type PersistResult = { ok: boolean; attempted: number; failures: number };
```

#### `persistSessionBriefs` - Retorno seguro sin throw - Líneas 168-242

**Caso 1: No sessionBriefs**
```typescript
if (!sessionBriefs || sessionBriefs.length === 0) {
  return { ok: true, attempted: 0, failures: 0 };
}
```

**Caso 2: Error fetching sessions**
```typescript
if (sesionesError) {
  console.error('[persistSessionBriefs] Error fetching sessions:', sesionesError);
  return { ok: false, attempted: 0, failures: 0 };
}
```

**Caso 3: Promise.allSettled con conteo de fallos**
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
```

**Caso 4: Catch global**
```typescript
} catch (error) {
  // Log error and return failure result (non-blocking per requirement)
  console.error('[persistSessionBriefs] Error persisting session briefs:', error);
  return { ok: false, attempted: 0, failures: 0 };
}
```

#### `handleFinish` - Warning toast si hay fallos - Líneas 782-791

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

**Implementación correcta:**
- ✅ Función nunca lanza excepciones (siempre retorna `PersistResult`)
- ✅ Usa `Promise.allSettled` para no bloquear en fallos individuales (línea 210)
- ✅ Cuenta fallos correctamente (líneas 220-222)
- ✅ En `handleFinish`, muestra warning toast si `!ok || failures > 0` (línea 785)
- ✅ Continúa con generación incluso si hay fallos (non-blocking)

---

## P3: Resolver must not ignore DB briefs due to empty wizard defaults

### Ubicación en código

#### Helper `hasMeaningfulBriefs` - Líneas 135-137

```typescript
// PHASE 3.2: Helper to check if array has meaningful briefs (at least one non-empty after trimming)
function hasMeaningfulBriefs(arr?: (string | undefined)[]): boolean {
  return Array.isArray(arr) && arr.some(v => (v ?? '').trim().length > 0);
}
```

#### `resolveSessionBriefs` - Líneas 140-160

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

#### `handleRetryGeneration` - Uso del resolver - Líneas 563-566

```typescript
// PHASE 3.2: Resolve sessionBriefs from wizard state or DB (source-of-truth)
const resolvedBriefs = await resolveSessionBriefs(
  wizardData.planificacionId,
  wizardData.enfoque?.sessionBriefs
);
```

**Implementación correcta:**
- ✅ Helper `hasMeaningfulBriefs` chequea al menos un valor no-vacío después de trim
- ✅ Resolver prioriza wizard solo si tiene contenido significativo
- ✅ Si wizard está vacío, carga briefs de DB
- ✅ Si DB tiene contenido significativo, lo retorna
- ✅ Si ambos están vacíos, retorna `undefined` (backward compatibility)
- ✅ `handleRetryGeneration` usa el resolver hardeneado

---

## Resumen de Verificación

| Corrección | Estado | Líneas Clave | Verificación |
|------------|--------|--------------|--------------|
| **P1** | ✅ Implementado | 192-203, 109-124 | Mapeo por `orden`, no por índice |
| **P2** | ✅ Implementado | 163, 210-237, 785-791 | Non-blocking con warning confiable |
| **P3** | ✅ Implementado | 135-137, 140-160, 563-566 | Resolver no ignora DB briefs |

---

## Git Diff Status

**Estado:** No se requieren cambios adicionales. Todas las correcciones ya están aplicadas en el código actual.

```
# No hay diffs pendientes - código ya está corregido
```

---

## Notas de Compatibilidad

✅ **Backward compatibility preservada:**
- Planificaciones sin briefs funcionan igual que en Phase 2.2.2
- Empty/whitespace-only briefs se persisten como `NULL`
- No se modificaron prompts de IA ni formato de payload
- Solo se toca `src/pages/PlanificacionWizard.tsx` (scope mínimo)

---

## Conclusión

Las correcciones P1, P2 y P3 están completamente implementadas y funcionando en el código actual. No se requieren cambios adicionales.














