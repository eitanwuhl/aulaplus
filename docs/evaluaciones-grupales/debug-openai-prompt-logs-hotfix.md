# Hotfix: Crash por `normA is not defined`

> **Fecha**: 2026-02-06  
> **Estado**: RESUELTO  
> **Severidad**: CRÍTICA (función caída)

## Causa del crash

En la línea ~2911 de `supabase/functions/modify-evaluation/index.ts`, había un bloque de logging que referenciaba variables que nunca fueron definidas:

```typescript
wrapperDetected: {
  A: { before: normA.hadWrapperBefore, after: normA.hasWrapperAfter },
  B: { before: normB.hadWrapperBefore, after: normB.hasWrapperAfter },
  C: { before: normC.hadWrapperBefore, after: normC.hasWrapperAfter }
}
```

Las variables `normA`, `normB`, `normC` no existían en ese scope. Este código probablemente quedó de un refactor previo donde esas variables fueron eliminadas pero el log no fue actualizado.

## Cambio realizado

Se eliminó el bloque `wrapperDetected` del log `[UNIVERSAL] versions integrity` ya que referenciaba variables inexistentes.

**Antes:**
```typescript
console.log('[UNIVERSAL] versions integrity', {
  assignmentCounts: finalAssignmentCounts,
  startsWith: { ... },
  isWrapper: { ... },
  lengths: { ... },
  wrapperDetected: {  // <-- CAUSABA EL CRASH
    A: { before: normA.hadWrapperBefore, after: normA.hasWrapperAfter },
    B: { before: normB.hadWrapperBefore, after: normB.hasWrapperAfter },
    C: { before: normC.hadWrapperBefore, after: normC.hasWrapperAfter }
  }
});
```

**Después:**
```typescript
console.log('[UNIVERSAL] versions integrity', {
  assignmentCounts: finalAssignmentCounts,
  startsWith: { ... },
  isWrapper: { ... },
  lengths: { ... }
  // wrapperDetected eliminado - variables no existían
});
```

## Logs de debug (siguen activos)

Los logs de prompts agregados anteriormente **siguen funcionando** correctamente:

```
========== OPENAI SYSTEM PROMPT START ==========
... contenido del system prompt ...
========== OPENAI SYSTEM PROMPT END ==========
========== OPENAI USER PROMPT START ==========
... contenido del user prompt ...
========== OPENAI USER PROMPT END ==========
```

Ubicación: líneas ~2213-2221 en `modify-evaluation/index.ts`

## Verificación

1. Generar una evaluación grupal desde el frontend
2. Confirmar que:
   - La función **no crashea**
   - Los prompts aparecen en los logs de Supabase
   - La evaluación se genera correctamente

## Cómo ver los logs

1. Ir a [Supabase Dashboard](https://supabase.com/dashboard/project/srlrbuphsogwgymqywhe/functions)
2. Edge Functions → modify-evaluation → Logs
3. Buscar `OPENAI SYSTEM PROMPT START` o `OPENAI USER PROMPT START`
