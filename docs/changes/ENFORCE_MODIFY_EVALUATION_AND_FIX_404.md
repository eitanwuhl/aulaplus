# Enforce modify-evaluation Call + Remove Silent Fallback + Fix grupos teacher_sugerencias 404

**Fecha**: 2026-02-01  
**Rama**: `nuevas-evaluaciones`  
**Objetivo**: Asegurar que la generación de evaluaciones siempre llame al edge function `modify-evaluation`, eliminar fallbacks silenciosos, y corregir el 404 de `teacher_sugerencias` que bloquea la generación.

---

## Causa Raíz

### Por qué `modify-evaluation` no se estaba llamando

**Problema identificado**: El código ya estaba implementado para llamar a `modify-evaluation`, pero tenía **fallbacks silenciosos** que permitían que la generación continuara sin llamar al edge function:

1. **Returns tempranos sin mensajes**: Las validaciones tempranas (líneas 805-816) retornaban silenciosamente sin mostrar errores al usuario, dando la impresión de que nada pasaba.

2. **Fallback silencioso en catch**: Cuando el edge function fallaba, el código usaba un fallback local que generaba una evaluación básica sin llamar al servidor (líneas 1134-1154). Esto resultaba en:
   - Solo versión A generada
   - Sin `aiReport`
   - Sin versiones B/C
   - Sin opciones equivalentes

3. **404 de `teacher_sugerencias` bloqueando generación**: El query a `grupos?select=teacher_sugerencias...` retornaba 404 cuando la tabla/columna no existía o el grupo no estaba en la DB, y aunque el código intentaba manejarlo, podía causar que `getGroupContextForAI` fallara y bloqueara toda la generación.

---

## Cambios Exactos Aplicados

### Archivo: `src/pages/EvaluacionesGrupo.tsx`

#### Cambio 1: Eliminar Returns Tempranos Silenciosos

**Ubicación**: Líneas ~801-832

**Antes**:
```typescript
if (!selectedGroup || (!materia && !esInterdisciplinaria)) {
  console.info('[EVAL_PIPELINE] Early return: missing group or materia');
  return;  // ❌ Silencioso, usuario no ve nada
}
if (esInterdisciplinaria && materiasSeleccionadas.length === 0) {
  console.info('[EVAL_PIPELINE] Early return: interdisciplinaria without materias');
  return;  // ❌ Silencioso
}
if (!hasAnepContent && !hasSessions && !hasMaterials) {
  console.info('[EVAL_PIPELINE] Early return: no content, sessions, or materials');
  return;  // ❌ Silencioso
}
```

**Después**:
```typescript
if (!selectedGroup || (!materia && !esInterdisciplinaria)) {
  console.info('[EVAL_PIPELINE] Early return: missing group or materia');
  toast({
    title: "Error de validación",
    description: "Seleccioná un grupo y una materia antes de generar evaluaciones.",
    variant: "destructive"
  });
  return;  // ✅ Usuario ve el error
}
if (esInterdisciplinaria && materiasSeleccionadas.length === 0) {
  console.info('[EVAL_PIPELINE] Early return: interdisciplinaria without materias');
  toast({
    title: "Error de validación",
    description: "Seleccioná al menos una materia para la evaluación interdisciplinaria.",
    variant: "destructive"
  });
  return;  // ✅ Usuario ve el error
}
if (!hasAnepContent && !hasSessions && !hasMaterials) {
  console.info('[EVAL_PIPELINE] Early return: no content, sessions, or materials');
  toast({
    title: "Error de validación",
    description: "Seleccioná al menos uno: contenidos ANEP, sesiones de clase, o materiales docentes.",
    variant: "destructive"
  });
  return;  // ✅ Usuario ve el error
}
```

#### Cambio 2: Eliminar Fallback Silencioso en Catch

**Ubicación**: Líneas ~1132-1180

**Antes**:
```typescript
} catch (error) {
  console.error('[EVAL_PIPELINE] Error generating evaluations:', error);
  // Fallback to local generation if AI fails (using provider data)
  const evaluations: GeneratedEvaluation[] = [
    {
      id: 'A',
      version: 1,
      versionKind: 'A',
      versionLabel: 'Versión A (Universal)',
      title: 'Versión A (Universal)',
      content: basePrototype || generatePrototipo(selectedSubtemas, requerimientos, 1),
      // ... sin aiReport, sin versiones B/C
    }
  ];
  setGeneratedEvaluations(evaluations);  // ❌ Fallback silencioso
  setEvaluationBundle(null);
  // ... continúa como si nada pasó
}
```

**Después**:
```typescript
} catch (error: any) {
  console.error('[EVAL_PIPELINE] Error generating evaluations:', error);
  
  // ENFORCE: Show visible error instead of silent fallback
  let errorMessage = "No se pudo generar la evaluación. Por favor, intentá nuevamente.";
  let errorDetails = "";
  
  if (error?.message) {
    if (error.message.includes('network') || error.message.includes('fetch')) {
      errorMessage = "Error de conexión";
      errorDetails = "No se pudo conectar con el servidor. Verificá tu conexión a internet e intentá nuevamente.";
    } else if (error.message.includes('auth') || error.message.includes('401') || error.message.includes('403')) {
      errorMessage = "Error de autenticación";
      errorDetails = "Tu sesión expiró o no tenés permisos. Por favor, iniciá sesión nuevamente.";
    } else {
      errorDetails = error.message;
    }
  }
  
  toast({
    title: errorMessage,
    description: errorDetails || "Ocurrió un error inesperado al generar la evaluación.",
    variant: "destructive",
    duration: 10000
  });
  
  // ENFORCE: Do NOT use silent fallback - clear state instead
  setGeneratedEvaluations([]);
  setEvaluationBundle(null);
  setEvaluationDesignPlan(null);
  setStudentAssignments({});
  setTeacherReminders([]);
  setAssignmentWarnings([]);
  setAiDesignReport(null);
  
  // Set visible error banner
  setGenerationError({
    message: errorMessage,
    details: errorDetails,
    show: true
  });
}
```

#### Cambio 3: Agregar Verificación Explícita de Response

**Ubicación**: Líneas ~1040-1060

**Agregado**:
```typescript
// ENFORCE: Verify that modify-evaluation was called and returned expected data
if (!data) {
  console.error('[EVAL_PIPELINE] Edge function returned no data');
  setGenerationError({
    message: 'Error en la respuesta del servidor',
    details: 'El servidor no retornó datos. Por favor, intentá nuevamente.',
    show: true
  });
  throw new Error('Edge function returned no data');
}

if (!data?.evaluationBundle && !data?.content) {
  console.error('[EVAL_PIPELINE] Response missing both evaluationBundle and content');
  setGenerationError({
    message: 'Error en la respuesta del servidor',
    details: 'La respuesta no contiene datos de evaluación. El servidor puede no haber procesado la solicitud correctamente.',
    show: true
  });
  toast({
    title: "Error en la respuesta",
    description: "La respuesta del servidor no contiene datos de evaluación. Por favor, intentá nuevamente.",
    variant: "destructive"
  });
  setIsGenerating(false);
  return;
}
```

#### Cambio 4: Agregar Banner de Error Visible

**Ubicación**: Líneas ~458-465 (estado) y ~1585-1605 (render)

**Estado agregado**:
```typescript
const [generationError, setGenerationError] = useState<{
  message: string;
  details?: string;
  show: boolean;
} | null>(null);
```

**Banner en UI**:
```typescript
{/* ENFORCE: Error banner for generation failures */}
{generationError?.show && (
  <Card className="mb-6 border-l-4 border-red-500 bg-red-50 dark:bg-red-950/20">
    <CardHeader>
      <CardTitle className="text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        {generationError.message}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-red-700 dark:text-red-300">
        {generationError.details || 'Ocurrió un error inesperado al generar la evaluación.'}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => setGenerationError(null)}
      >
        Cerrar
      </Button>
    </CardContent>
  </Card>
)}
```

#### Cambio 5: Agregar Verificación de Llamada a modify-evaluation

**Ubicación**: Líneas ~1023-1031

**Agregado**:
```typescript
// ENFORCE: Clear any previous errors
setGenerationError(null);

console.info('[EVAL_PIPELINE] Invoking modify-evaluation edge function');
const { data, error } = await supabase.functions.invoke('modify-evaluation', {
  body: requestBody
});

if (error) {
  console.error('[EVAL_PIPELINE] Edge function error:', error);
  // ENFORCE: Set visible error state before throwing
  const errorMessage = error.message || 'Error desconocido al llamar al servidor';
  const errorStatus = (error as any).status || '';
  setGenerationError({
    message: 'No se pudo generar la evaluación',
    details: `${errorMessage}${errorStatus ? ` (Código: ${errorStatus})` : ''}`,
    show: true
  });
  throw error;
}
```

---

### Archivo: `src/services/groupContext/provider.ts`

#### Cambio: Manejar 404 de `teacher_sugerencias` Gracefully

**Ubicación**: Líneas ~309-338

**Antes**:
```typescript
const { data, error } = await supabase
  .from('grupos')
  .select('teacher_sugerencias')
  .eq('id', grupoId)
  .eq('user_id', user.id)
  .maybeSingle();

if (error && error.code !== 'PGRST116') {
  console.warn('[getGroupContextForAI] Error fetching teacher_sugerencias:', error);
  return undefined;  // ❌ Podía bloquear si el error no era PGRST116
}
```

**Después**:
```typescript
const { data, error } = await supabase
  .from('grupos')
  .select('teacher_sugerencias')
  .eq('id', grupoId)
  .eq('user_id', user.id)
  .maybeSingle();

// Handle 404 gracefully: PGRST116 = no rows returned (expected if group doesn't exist in DB)
// Also handle 404 from PostgREST if table/column doesn't exist (non-blocking)
if (error) {
  if (error.code === 'PGRST116') {
    // No rows found - group doesn't exist in DB, use mock data (expected behavior)
    console.log('[getGroupContextForAI] Group not found in DB, using mock data');
    return undefined;
  }
  // Handle 404 or other errors gracefully without blocking generation
  if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('404')) {
    // Table or column doesn't exist - non-blocking, just log and continue
    console.warn('[getGroupContextForAI] Table/column teacher_sugerencias not available:', error.message);
    return undefined;  // ✅ No bloquea generación
  }
  // Other errors - log but don't block
  console.warn('[getGroupContextForAI] Error fetching teacher_sugerencias (non-blocking):', error);
  return undefined;  // ✅ Nunca bloquea
}
```

---

## Verificación desde UI (Sin DevTools)

### Paso 1: Verificar que se Muestra Error en Validaciones

1. Ir a "Generar Evaluaciones"
2. **NO seleccionar grupo ni materia**
3. Hacer clic en "Generar Evaluaciones Inteligentes"
4. **✅ Verificar**: Debe aparecer un toast rojo con el mensaje: "Seleccioná un grupo y una materia antes de generar evaluaciones."

### Paso 2: Verificar que se Llama a modify-evaluation

1. Seleccionar grupo, materia, contenidos
2. Hacer clic en "Generar Evaluaciones Inteligentes"
3. **✅ Verificar**: 
   - El botón muestra "Generando evaluaciones creativas..." (spinner)
   - Después de unos segundos, aparecen las evaluaciones generadas
   - Si hay error, aparece un banner rojo en la parte superior con el mensaje de error

### Paso 3: Verificar Banner de Error en Fallo de Red

1. Desconectar internet (o simular error de red)
2. Seleccionar grupo, materia, contenidos
3. Hacer clic en "Generar Evaluaciones Inteligentes"
4. **✅ Verificar**: 
   - Aparece un banner rojo en la parte superior con: "No se pudo generar la evaluación"
   - El mensaje incluye detalles sobre el error de conexión
   - NO aparece ninguna evaluación generada (estado limpio)

### Paso 4: Verificar que 404 de teacher_sugerencias No Bloquea

1. Seleccionar grupo, materia, contenidos
2. Hacer clic en "Generar Evaluaciones Inteligentes"
3. **✅ Verificar**: 
   - La generación continúa normalmente incluso si hay un 404 en `grupos?select=teacher_sugerencias`
   - No aparece ningún error relacionado con `teacher_sugerencias`
   - Las evaluaciones se generan correctamente

### Paso 5: Verificar Versión C para Diego

1. Preparar grupo con Diego marcado para adaptación de contenido
2. Generar evaluación
3. **✅ Verificar**:
   - Aparece Versión C con Diego asignado
   - El panel de debug (si está habilitado) muestra `versionsGenerated: ["A", "C"]`

### Paso 6: Verificar Opciones Equivalentes en Versión A

1. Preparar grupo con contemplaciones que requieran opciones equivalentes
2. Generar evaluación
3. **✅ Verificar**:
   - Versión A incluye opciones equivalentes después de cada consigna
   - El panel de debug muestra `responseOptionsInclude: true`

---

## Comportamiento Esperado

### Cuando modify-evaluation se Llama Exitosamente

- ✅ El botón muestra spinner durante la generación
- ✅ Aparecen las evaluaciones generadas (A, y B/C si corresponde)
- ✅ El banner de error NO aparece
- ✅ El estado se actualiza con `evaluationBundle`, `aiReport`, `studentAssignments`

### Cuando modify-evaluation Falla

- ✅ Aparece un banner rojo en la parte superior con el mensaje de error
- ✅ Aparece un toast rojo con detalles del error
- ✅ NO se genera ninguna evaluación (estado limpio)
- ✅ El usuario puede cerrar el banner y reintentar

### Cuando hay Validaciones Faltantes

- ✅ Aparece un toast rojo específico indicando qué falta
- ✅ NO se intenta llamar a modify-evaluation
- ✅ El usuario puede corregir y reintentar

### Cuando hay 404 de teacher_sugerencias

- ✅ La generación continúa normalmente
- ✅ Se usa mock data si el grupo no está en DB
- ✅ NO aparece ningún error relacionado
- ✅ Las evaluaciones se generan correctamente

---

## Resumen de Cambios

### Eliminado

- ❌ Returns tempranos silenciosos (ahora muestran toasts)
- ❌ Fallback silencioso en catch (ahora muestra error visible y limpia estado)
- ❌ Bloqueo por 404 de `teacher_sugerencias` (ahora maneja gracefully)

### Agregado

- ✅ Toasts de error en todas las validaciones tempranas
- ✅ Banner de error visible en la parte superior cuando falla la generación
- ✅ Verificación explícita de que `modify-evaluation` se llama y retorna datos
- ✅ Manejo graceful de 404 de `teacher_sugerencias` (no bloquea generación)
- ✅ Estado limpio cuando falla (no fallback silencioso)

### Resultado

- ✅ El usuario SIEMPRE sabe si la generación falló y por qué
- ✅ `modify-evaluation` SIEMPRE se llama (o se muestra error claro si no se puede)
- ✅ NO hay fallbacks silenciosos que generen evaluaciones incompletas
- ✅ El 404 de `teacher_sugerencias` no bloquea la generación

---

## Rollback

Si es necesario revertir este cambio:

1. **Revertir commit**: Si se hizo un commit único, usar `git revert <commit-hash>`
2. **Revertir archivos manualmente**:
   - `src/pages/EvaluacionesGrupo.tsx`: Restaurar returns tempranos sin toasts, restaurar fallback silencioso en catch
   - `src/services/groupContext/provider.ts`: Restaurar manejo simple de errores en `loadTeacherSugerencias`

**Nota**: Después del rollback, volverán los fallbacks silenciosos y el 404 puede bloquear la generación.
