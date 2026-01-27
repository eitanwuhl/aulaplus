# Phase 2: Progressive Class Generation - Prompt and Payload Changes

**Fecha**: 26 de diciembre de 2024  
**Estado**: ✅ IMPLEMENTADO  
**Objetivo**: Habilitar generación progresiva y no duplicada de clases cuando una unidad tiene múltiples clases (`clases_estimadas > 1`)

---

## Resumen Ejecutivo

Phase 2 extiende Phase 1 agregando contexto de secuencia didáctica a los prompts de IA y payloads enviados a edge functions. Esto permite que cada clase sepa:
- Qué clase es dentro de la unidad (1, 2, 3...)
- Cuántas clases totales tiene la unidad
- Generar contenido progresivo y diferenciado
- Respetar instrucciones del docente (`requerimientos_docente`)

**Cambios realizados**:
- ✅ Payloads extendidos con `unitContext` (opcional para backward compatibility)
- ✅ Edge function `generate-plan-completo` acepta y usa `unitContext`
- ✅ Prompts de IA incluyen sección de "CONTEXTO DE SECUENCIA DIDÁCTICA"
- ✅ `requerimientos_docente` integrado en ambos paths

---

## 1. Cambios en Payloads

### 1.1 Path A: `useFullSessionGeneration.ts` → `modify-evaluation`

**Archivo**: `src/hooks/useFullSessionGeneration.ts`

**Cambios**:

1. **Parámetro agregado a `generateAIPlan()`**:
   ```typescript
   requerimientosDocente?: string;  // Nuevo parámetro opcional
   ```

2. **Construcción de `unitContext`** (líneas ~248-254):
   ```typescript
   // PHASE 2: Construir unitContext si unitAssignment está disponible
   const unitContext = params.unitAssignment ? {
     unidadId: params.unitAssignment.unidadId,
     contenido: params.unitAssignment.contenido_texto,
     claseEnUnidad: params.unitAssignment.claseEnUnidad,
     totalClasesUnidad: params.unitAssignment.totalClasesUnidad,
     ...(params.unitAssignment.isExtraSlot && { isExtraSlot: true })
   } : undefined;
   ```

3. **Payload extendido** (líneas ~256-290):
   ```typescript
   const { data, error } = await supabase.functions.invoke('modify-evaluation', {
     body: {
       type: 'planning',
       modification: `...`,  // Prompt actualizado (ver sección 3)
       groupContext: { ... },
       // PHASE 2: Incluir unitContext en payload (opcional para backward compatibility)
       ...(unitContext && { unitContext })
     }
   });
   ```

4. **Llamada actualizada** (línea ~80):
   ```typescript
   unitAssignment: assignment,
   requerimientosDocente: planificacion.requerimientos_docente  // Nuevo
   ```

**Estructura de `unitContext`**:
```typescript
{
  unidadId: string;
  contenido: string;
  claseEnUnidad: number;
  totalClasesUnidad: number;
  isExtraSlot?: boolean;  // Solo si es true
}
```

### 1.2 Path B: `PlanificacionWizard.tsx` → `generate-plan-completo`

**Archivo**: `src/pages/PlanificacionWizard.tsx`

**Cambios**:

1. **Construcción de `unitContext`** (líneas ~183-189):
   ```typescript
   // PHASE 2: Construir unitContext para generación progresiva
   const unitContext = {
     unidadId: assignment.unidadId,
     contenido: assignment.contenido_texto,
     claseEnUnidad: assignment.claseEnUnidad,
     totalClasesUnidad: assignment.totalClasesUnidad,
     ...(assignment.isExtraSlot && { isExtraSlot: true })
   };
   ```

2. **Payload extendido** (líneas ~202-213):
   ```typescript
   const payload = {
     modo: 'generar_plan_html',
     sesionId: sesion.id,
     orden: sesion.orden,
     duracionMin: sesion.duracion_minutos,
     materia: materia || 'Sin especificar',
     nivel: nivel || 'Sin especificar',
     contenidos: contenidosSesion,
     competencias: competenciasSesion,
     criterios: criterios,
     instruccionesDocente: planificacion.requerimientos_docente || undefined,  // PHASE 2: Incluir requerimientos
     // PHASE 2: Incluir unitContext para generación progresiva
     unitContext: unitContext
   };
   ```

**Nota**: `unitContext` siempre se incluye en Path B (no es opcional), pero la edge function lo maneja como opcional para mantener compatibilidad.

---

## 2. Cambios en Edge Function

### 2.1 `generate-plan-completo/index.ts`

**Archivo**: `supabase/functions/generate-plan-completo/index.ts`

**Cambios**:

1. **Extracción de `unitContext`** (líneas ~38-52):
   ```typescript
   const { 
     modo,
     sesionId,
     orden,
     duracionMin,
     materia,
     nivel,
     contenidos,
     competencias,
     criterios,
     perfilGrupo,
     estudiantes,
     instruccionesDocente,
     planActual,
     // PHASE 2: unitContext para generación progresiva (opcional para backward compatibility)
     unitContext
   } = await req.json();
   ```

2. **Construcción de sección de secuencia** (líneas ~54-65):
   ```typescript
   // PHASE 2: Construir sección de contexto de secuencia didáctica si unitContext está presente
   const secuenciaContext = unitContext ? `
   CONTEXTO DE SECUENCIA DIDÁCTICA:
   Esta clase forma parte de una unidad temática llamada "${unitContext.contenido}".

   - Esta es la clase ${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad} de esta unidad.
   - El contenido debe ser progresivo.
   - No repitas explicaciones ya dadas en clases anteriores.
   - Si es la primera clase, introduce el tema y el contexto.
   - Si es una clase intermedia, profundiza y complejiza.
   - Si es la última clase, prioriza síntesis, reflexión, debate o aplicación.
   ${unitContext.isExtraSlot ? 'Esta clase es adicional: puede usarse para repaso, evaluación o proyecto integrador.' : ''}

   ` : '';
   ```

3. **Construcción de sección de instrucciones del docente** (líneas ~67-78):
   ```typescript
   // PHASE 2: Construir sección de instrucciones del docente con contexto adicional
   const instruccionesDocenteSection = instruccionesDocente ? `
   INSTRUCCIONES DEL DOCENTE:
   ${instruccionesDocente}

   Estas instrucciones pueden:
   - Aplicar a toda la planificación
   - Aplicar solo a algunas clases
   - Indicar temas específicos para una clase puntual

   Respeta explícitamente estas indicaciones si están presentes.
   No inventes una secuencia distinta si el docente ya la definió.

   ` : '';
   ```

4. **Prompt actualizado** (líneas ~80-95):
   ```typescript
   const prompt = `
   Sos un asistente pedagógico experto en planificación de clases para el sistema educativo uruguayo (ANEP).
   ${modo === 'regenerar' ? 'Modificá' : 'Generá'} el plan de la sesión ${orden} con duración ${duracionMin} minutos.

   CONTEXTO DE LA CLASE:
   - Materia: ${materia || 'Sin especificar'}
   - Nivel: ${nivel || 'Sin especificar'}
   - Contenidos ANEP: ${Array.isArray(contenidos) ? contenidos.join(', ') : contenidos || 'Sin especificar'}
   - Competencias: ${Array.isArray(competencias) ? competencias.join(', ') : competencias || 'Sin especificar'}
   - Criterios de logro: ${Array.isArray(criterios) ? criterios.join(', ') : criterios || 'Sin especificar'}
   ${perfilGrupo ? `- Perfil del grupo: ${perfilGrupo.dominante || 'mixto'} (${perfilGrupo.tamanio || 'sin especificar'} estudiantes)` : ''}
   ${estudiantes?.length ? `- Estudiantes con ajustes: ${estudiantes.filter(e => e.ajustes?.length).length}` : ''}
   ${secuenciaContext}${instruccionesDocenteSection}${planActual ? `\nPLAN ACTUAL A MODIFICAR:\n${planActual}` : ''}
   ...
   `;
   ```

**Backward Compatibility**:
- ✅ `unitContext` es opcional - si no está presente, `secuenciaContext` es string vacío
- ✅ Funciona con llamadas antiguas que no incluyen `unitContext`
- ✅ `instruccionesDocente` ya existía, solo se mejoró la sección del prompt

---

## 3. Flujo de Metadata

### 3.1 Flujo Completo (Path B - más común)

```
PlanificacionWizard.tsx
  ↓
generarPlanesAutomaticamente()
  ↓
assignment = sessionAssignments[i]  // De Phase 1
  ↓
unitContext = {
  unidadId: assignment.unidadId,
  contenido: assignment.contenido_texto,
  claseEnUnidad: assignment.claseEnUnidad,
  totalClasesUnidad: assignment.totalClasesUnidad,
  isExtraSlot?: assignment.isExtraSlot
}
  ↓
payload = {
  ...existingFields,
  unitContext: unitContext,
  instruccionesDocente: planificacion.requerimientos_docente
}
  ↓
supabase.functions.invoke('generate-plan-completo', { body: payload })
  ↓
generate-plan-completo/index.ts
  ↓
const { unitContext, instruccionesDocente, ... } = await req.json()
  ↓
secuenciaContext = unitContext ? "CONTEXTO DE SECUENCIA DIDÁCTICA: ..." : ""
  ↓
instruccionesDocenteSection = instruccionesDocente ? "INSTRUCCIONES DEL DOCENTE: ..." : ""
  ↓
prompt = `... ${secuenciaContext}${instruccionesDocenteSection} ...`
  ↓
OpenAI API
  ↓
Respuesta con plan progresivo
```

### 3.2 Flujo Path A (menos común)

```
useFullSessionGeneration.ts
  ↓
generateAllSessions()
  ↓
assignment = sessionAssignments[index]  // De Phase 1
  ↓
generateAIPlan({
  ...params,
  unitAssignment: assignment,
  requerimientosDocente: planificacion.requerimientos_docente
})
  ↓
unitContext = params.unitAssignment ? { ... } : undefined
  ↓
supabase.functions.invoke('modify-evaluation', {
  body: {
    ...existingFields,
    ...(unitContext && { unitContext }),
    modification: `... ${secuenciaContext}${instruccionesDocenteSection} ...`
  }
})
  ↓
modify-evaluation edge function
  ↓
(Nota: modify-evaluation puede o no usar unitContext, pero está disponible en el payload)
```

---

## 4. Ejemplo de Prompt Generado

### 4.1 Con `unitContext` (Clase 2 de 3)

```
Sos un asistente pedagógico experto en planificación de clases para el sistema educativo uruguayo (ANEP).
Generá el plan de la sesión 2 con duración 60 minutos.

CONTEXTO DE LA CLASE:
- Materia: Historia
- Nivel: 9º Año
- Contenidos ANEP: Batllismo
- Competencias: Análisis histórico, Comprensión crítica
- Criterios de logro: Identifica causas y consecuencias, Analiza documentos

CONTEXTO DE SECUENCIA DIDÁCTICA:
Esta clase forma parte de una unidad temática llamada "Batllismo".

- Esta es la clase 2 de 3 de esta unidad.
- El contenido debe ser progresivo.
- No repitas explicaciones ya dadas en clases anteriores.
- Si es la primera clase, introduce el tema y el contexto.
- Si es una clase intermedia, profundiza y complejiza.
- Si es la última clase, prioriza síntesis, reflexión, debate o aplicación.

INSTRUCCIONES DEL DOCENTE:
Priorizar trabajo en grupos, incluir análisis de documentos históricos.

Estas instrucciones pueden:
- Aplicar a toda la planificación
- Aplicar solo a algunas clases
- Indicar temas específicos para una clase puntual

Respeta explícitamente estas indicaciones si están presentes.
No inventes una secuencia distinta si el docente ya la definió.

ESTRUCTURA OBLIGATORIA - DEVOLVER SOLO HTML VÁLIDO:
...
```

### 4.2 Sin `unitContext` (Backward Compatibility)

```
Sos un asistente pedagógico experto en planificación de clases para el sistema educativo uruguayo (ANEP).
Generá el plan de la sesión 1 con duración 60 minutos.

CONTEXTO DE LA CLASE:
- Materia: Historia
- Nivel: 9º Año
- Contenidos ANEP: Contenido general
- Competencias: Análisis histórico
- Criterios de logro: Identifica causas y consecuencias

ESTRUCTURA OBLIGATORIA - DEVOLVER SOLO HTML VÁLIDO:
...
```

**Nota**: Sin `unitContext`, no se incluye la sección "CONTEXTO DE SECUENCIA DIDÁCTICA", manteniendo compatibilidad con llamadas antiguas.

---

## 5. Por Qué Esto Habilita Generación Progresiva

### 5.1 Antes de Phase 2

**Problema**:
- Todas las clases de una unidad recibían el mismo prompt
- IA no sabía si era clase 1, 2 o 3
- Generaba contenido similar/duplicado
- No había progresión lógica

**Ejemplo**:
- Unidad "Batllismo" con 3 clases
- Las 3 clases recibían: "CONTENIDO: Batllismo"
- IA generaba 3 planes similares sin progresión

### 5.2 Después de Phase 2

**Solución**:
- Cada clase recibe contexto explícito de secuencia
- IA sabe: "Esta es la clase 2 de 3"
- Instrucciones específicas según posición:
  - Clase 1: Introducción
  - Clase 2: Profundización
  - Clase 3: Síntesis/aplicación
- No repite explicaciones anteriores

**Ejemplo**:
- Unidad "Batllismo" con 3 clases
- Clase 1 recibe: "Esta es la clase 1 de 3. Introduce el tema y el contexto."
- Clase 2 recibe: "Esta es la clase 2 de 3. Profundiza y complejiza. No repitas explicaciones ya dadas."
- Clase 3 recibe: "Esta es la clase 3 de 3. Prioriza síntesis, reflexión, debate o aplicación."

**Resultado**:
- ✅ 3 planes diferentes con progresión lógica
- ✅ Títulos diferentes (introducción → desarrollo → cierre)
- ✅ Contenido no duplicado
- ✅ Secuencia coherente

---

## 6. Integración de `requerimientos_docente`

### 6.1 Path A

**Ubicación**: `src/hooks/useFullSessionGeneration.ts`

```typescript
requerimientosDocente: planificacion.requerimientos_docente
```

**Incluido en prompt**:
```typescript
${params.requerimientosDocente ? `\nINSTRUCCIONES DEL DOCENTE:\n${params.requerimientosDocente}\n\nEstas instrucciones pueden:\n- Aplicar a toda la planificación\n- Aplicar solo a algunas clases\n- Indicar temas específicos para una clase puntual\n\nRespeta explícitamente estas indicaciones si están presentes.\nNo inventes una secuencia distinta si el docente ya la definió.` : ''}
```

### 6.2 Path B

**Ubicación**: `src/pages/PlanificacionWizard.tsx`

```typescript
instruccionesDocente: planificacion.requerimientos_docente || undefined
```

**Incluido en prompt** (edge function):
```typescript
const instruccionesDocenteSection = instruccionesDocente ? `
INSTRUCCIONES DEL DOCENTE:
${instruccionesDocente}

Estas instrucciones pueden:
- Aplicar a toda la planificación
- Aplicar solo a algunas clases
- Indicar temas específicos para una clase puntual

Respeta explícitamente estas indicaciones si están presentes.
No inventes una secuencia distinta si el docente ya la definió.

` : '';
```

**Comportamiento**:
- ✅ Se pasa `requerimientos_docente` de la planificación
- ✅ Se incluye en prompt con contexto adicional
- ✅ IA respeta instrucciones explícitas del docente
- ✅ Si docente define secuencia, IA no la cambia

---

## 7. Verificación y Testing

### 7.1 Criterios de Aceptación

✅ **Una unidad con 3 clases genera**:
- 3 clases con títulos diferentes
- Progresión lógica (introducción → desarrollo → cierre)
- No hay planes duplicados
- Respeto a overrides del docente

✅ **Planes existentes sin unidades**:
- Siguen funcionando (backward compatibility)
- No requieren `unitContext`
- Generan normalmente

✅ **Sin errores**:
- ✅ `npm run build` pasa sin errores
- ✅ No hay errores de TypeScript
- ✅ No hay errores de linting

✅ **Sin cambios en BD**:
- ✅ No hay migraciones
- ✅ No hay cambios en esquema

✅ **Sin cambios en UI**:
- ✅ UI permanece igual
- ✅ Solo cambios internos en payloads/prompts

### 7.2 Cómo Verificar Manualmente

1. **Crear planificación con unidad de 3 clases**:
   - Unidad: "Batllismo", `clases_estimadas: 3`
   - Crear 3 sesiones

2. **Generar planes automáticamente**:
   - Verificar en console logs que `unitContext` se incluye
   - Verificar que cada sesión tiene `claseEnUnidad` diferente (1, 2, 3)

3. **Verificar planes generados**:
   - Abrir cada sesión
   - Verificar que títulos son diferentes
   - Verificar que contenido es progresivo (no duplicado)
   - Verificar que última clase tiene síntesis/reflexión

4. **Verificar con `requerimientos_docente`**:
   - Agregar requerimientos en wizard
   - Generar planes
   - Verificar que planes respetan instrucciones

---

## 8. Archivos Modificados

### 8.1 Archivos de Código

1. **`src/hooks/useFullSessionGeneration.ts`**
   - Líneas ~69-81: Llamada a `generateAIPlan()` con `requerimientosDocente`
   - Líneas ~234-247: Firma de `generateAIPlan()` extendida
   - Líneas ~248-290: Construcción de `unitContext` y payload actualizado

2. **`src/pages/PlanificacionWizard.tsx`**
   - Líneas ~183-189: Construcción de `unitContext`
   - Líneas ~202-213: Payload extendido con `unitContext` y `instruccionesDocente`

3. **`supabase/functions/generate-plan-completo/index.ts`**
   - Líneas ~38-52: Extracción de `unitContext`
   - Líneas ~54-78: Construcción de secciones de prompt
   - Líneas ~80-95: Prompt actualizado con `secuenciaContext` y `instruccionesDocenteSection`

### 8.2 Archivos de Documentación

1. **`docs/phase2_prompt_and_payload_changes.md`** (este archivo)

---

## 9. Resumen de Cambios

| Aspecto | Antes (Phase 1) | Después (Phase 2) |
|---------|------------------|-------------------|
| **Metadata calculada** | ✅ En memoria | ✅ En memoria |
| **Metadata enviada a IA** | ❌ No | ✅ Sí (`unitContext`) |
| **Prompt incluye secuencia** | ❌ No | ✅ Sí (si `unitContext` presente) |
| **`requerimientos_docente`** | ❌ No se pasa | ✅ Se pasa y se incluye en prompt |
| **Generación progresiva** | ❌ No | ✅ Sí |
| **Backward compatibility** | N/A | ✅ Mantenida |

---

## 10. Próximos Pasos (Opcional)

1. **Validación en Wizard**:
   - Mostrar advertencia si `totalSesiones != sum(clases_estimadas)`
   - Sugerir ajustar `clases_estimadas` o cantidad de sesiones

2. **Persistencia de Metadata** (Opcional):
   - Considerar agregar campo JSONB en `sesiones_clase` para `unitContext`
   - O almacenar en `plan_desarrollo` como metadata adicional

3. **Mejoras en Prompt**:
   - Incluir referencia a clases anteriores (si están disponibles)
   - Sugerir continuidad temática explícita

---

**Fin del Documento - Phase 2 Implementado**















