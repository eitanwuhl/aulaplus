# Resumen de Cambios: Eliminación de Longitud Mínima para Narrative

**Fecha:** 2025-01-XX  
**Rama:** `mejorar-evaluaciones`  
**Objetivo:** Permitir que el narrative se muestre siempre que exista, sin requerir longitud mínima

---

## Cambios Realizados

### 1. Frontend: V2AIReportPanel (`src/components/evaluaciones/v2/V2InfoPanels.tsx`)

**Línea modificada:** ~339

**Antes:**
```typescript
const hasNarrative = aiReport?.narrative && typeof aiReport.narrative === 'string' && aiReport.narrative.trim().length >= 80;
```

**Después:**
```typescript
const hasNarrative = aiReport?.narrative && typeof aiReport.narrative === 'string' && aiReport.narrative.trim().length > 0;
```

**Razón:** Eliminar verificación de longitud mínima (>= 80). Ahora solo verifica que exista y no esté vacío después de trim.

---

### 2. Edge Function: Validación en `validateAndNormalizeSpec` (`supabase/functions/modify-evaluation-v2/index.ts`)

**Líneas modificadas:** ~508-525

**Antes:**
```typescript
if (typeof aiReport.narrative !== 'string' || aiReport.narrative.trim().length < 80) {
  warnings.push({
    code: 'NARRATIVE_TOO_SHORT',
    message: 'El reporte narrativo es muy corto o inválido. Se generará uno de respaldo.',
    severity: 'warning'
  });
  delete aiReport.narrative; // Eliminaba si era corto
} else {
  aiReport.narrative = aiReport.narrative.trim();
}
```

**Después:**
```typescript
if (typeof aiReport.narrative !== 'string') {
  delete aiReport.narrative; // Solo elimina si no es string
} else {
  const trimmed = aiReport.narrative.trim();
  if (trimmed.length === 0) {
    delete aiReport.narrative; // Solo elimina si está vacío después de trim
  } else {
    aiReport.narrative = trimmed; // Mantiene narrative incluso si es corto
  }
}
```

**Razón:** Eliminar verificación de longitud mínima. Mantener narrative si existe y no está vacío, sin importar su longitud.

---

### 3. Edge Function: Extracción de Narrative (`supabase/functions/modify-evaluation-v2/index.ts`)

**Líneas modificadas:** ~1424-1430

**Antes:**
```typescript
if (typeof specAiReport.narrative === 'string' && specAiReport.narrative.trim().length >= 80) {
  narrative = specAiReport.narrative.trim();
}
```

**Después:**
```typescript
if (typeof specAiReport.narrative === 'string') {
  const trimmed = specAiReport.narrative.trim();
  if (trimmed.length > 0) {
    narrative = trimmed; // Acepta cualquier longitud > 0
  }
}
```

**Razón:** Eliminar verificación de longitud mínima. Aceptar cualquier narrative no vacío.

---

### 4. Edge Function: Fallback Generation (`supabase/functions/modify-evaluation-v2/index.ts`)

**Líneas modificadas:** ~617-621

**Antes:**
```typescript
if (narrative.length < 80) {
  throw new Error('Narrative too short');
}
```

**Después:**
```typescript
if (narrative.length === 0) {
  throw new Error('Narrative is empty');
}
```

**Razón:** El fallback solo debe fallar si el narrative está completamente vacío, no si es corto.

---

## Comportamiento Resultante

### Antes:
- ❌ Narrative con < 80 caracteres se eliminaba
- ❌ Fallback se generaba incluso si había narrative corto
- ❌ UI mostraba formato legacy si narrative era corto

### Después:
- ✅ Narrative con cualquier longitud > 0 se mantiene
- ✅ Fallback solo se genera si narrative está completamente ausente
- ✅ UI muestra narrative incluso si es corto (el docente puede editarlo después)

---

## Backward Compatibility

✅ **Mantenida:**
- Si narrative no existe o está vacío → UI muestra formato legacy (fallback)
- Si narrative existe (incluso corto) → UI muestra narrative
- V1 no se modifica (solo cambios en V2)

---

## Archivos Modificados

1. `src/components/evaluaciones/v2/V2InfoPanels.tsx` (1 cambio)
2. `supabase/functions/modify-evaluation-v2/index.ts` (3 cambios)

**Total:** 2 archivos, 4 cambios

---

## Checklist de Testing Manual (Grupo Demo "9no1")

### Test 1: Narrative Corto se Muestra

**Pasos:**
1. Generar evaluación V2 para grupo "9no1"
2. Si el narrative generado es corto (< 80 caracteres), verificar que:
   - ✅ El panel "Reporte de diseño de IA" muestra el narrative (no formato legacy)
   - ✅ El narrative se muestra completo, sin truncar
   - ✅ No hay warnings en consola sobre "NARRATIVE_TOO_SHORT"

**Resultado esperado:** ✅ Narrative corto se muestra correctamente

---

### Test 2: Narrative Largo se Muestra

**Pasos:**
1. Generar evaluación V2 para grupo "9no1"
2. Si el narrative generado es largo (≥ 80 caracteres), verificar que:
   - ✅ El panel "Reporte de diseño de IA" muestra el narrative
   - ✅ El narrative se muestra completo

**Resultado esperado:** ✅ Narrative largo se muestra correctamente

---

### Test 3: Narrative Ausente → Fallback Legacy

**Pasos:**
1. Generar evaluación V2 para grupo "9no1"
2. Si el narrative no se genera (o se elimina manualmente en DB), verificar que:
   - ✅ El panel "Reporte de diseño de IA" muestra formato legacy estructurado
   - ✅ Se muestran: Justificación del diseño, Versiones generadas, Contemplaciones aplicadas
   - ✅ No hay errores en consola

**Resultado esperado:** ✅ Formato legacy se muestra cuando narrative falta

---

### Test 4: Narrative Vacío → Fallback Legacy

**Pasos:**
1. Simular narrative vacío (solo espacios) en la respuesta del edge function
2. Verificar que:
   - ✅ El narrative vacío se trata como ausente
   - ✅ El panel muestra formato legacy

**Resultado esperado:** ✅ Narrative vacío se trata como ausente

---

### Test 5: Persistencia en DB

**Pasos:**
1. Generar evaluación V2 con narrative (corto o largo)
2. Guardar la evaluación
3. Recargar la página
4. Verificar que:
   - ✅ El narrative se persiste en DB
   - ✅ El narrative se muestra correctamente después de recargar

**Resultado esperado:** ✅ Narrative se persiste y se muestra después de recargar

---

## Notas Adicionales

- **No se agregaron logs adicionales** - El código existente ya tiene logging suficiente
- **No se modificó V1** - Solo cambios en V2
- **Backward compatibility mantenida** - Evaluaciones existentes sin narrative seguirán mostrando formato legacy

---

**Fin del Resumen**
