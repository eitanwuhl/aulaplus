# Evaluation Versioning Guardrails

**Fecha:** 2026-01-24  
**Branch:** `Nuevos-perfiles-y-reglas-para-contemplaciones`  
**Tipo:** Documentation / Governance  
**Commit:** `chore(evaluaciones): confirm versioning guardrails remain flags-driven only`

---

## Resumen Ejecutivo

Este documento establece las **guardrails (barandas) definitivas** para el versionado de evaluaciones en el sistema AulaPlus, garantizando que la decisión de qué versión generar (V1, V2, V3) se base **EXCLUSIVAMENTE** en flags explícitos configurados por el docente, **sin ningún tipo de inferencia automática**.

---

## Principio Fundamental

**REGLA DE ORO:**  
El versionado de evaluaciones es **FLAGS-DRIVEN ONLY**.

**Prohibiciones explícitas:**
- ❌ **NO inferir** versión basándose en conteo de contemplaciones (`contemplaciones.length`)
- ❌ **NO inferir** versión basándose en parsing de keywords en texto libre
- ❌ **NO inferir** versión basándose en `modalidadCursado` o cualquier otra propiedad indirecta
- ❌ **NO usar heurísticas** como "si tiene más de X contemplaciones → V3"
- ❌ **NO usar análisis de texto** de nombres de contemplaciones

---

## Tabla de Decisión de Versiones

| Versión | Condición ÚNICA | Flag Explícito | Descripción |
|---------|----------------|----------------|-------------|
| **V3** | `requiereAdecuacionContenido === true` | `requiereAdecuacionContenido` | Adecuación de contenido. El estudiante requiere contenidos adaptados, objetivos diferenciados, criterios de logro modificados. |
| **V2** | `requiereAdecuacionAcceso === true` Y `requiereAdecuacionContenido !== true` | `requiereAdecuacionAcceso` | Adecuación de acceso. El estudiante requiere formato alternativo, tiempo extendido, pero mantiene objetivos estándar. |
| **V1** | Ninguno de los anteriores | — | Evaluación estándar. Sin adecuaciones requeridas. |

**Lógica de asignación:**
```typescript
if (requiereAdecuacionContenido === true) {
  // V3 (Content-adapted)
} else if (requiereAdecuacionAcceso === true) {
  // V2 (Access accommodations only)
} else {
  // V1 (Standard)
}
```

---

## Ejemplos Explícitos

### Ejemplo 1: Estudiante con Adecuación de Contenido

**Configuración del estudiante:**
```typescript
{
  id: "s123",
  name: "María González",
  informeTecnico: {
    requiereAdecuacionContenido: true,    // ← Flag explícito
    requiereAdecuacionAcceso: true        // ← Irrelevante si contenido es true
  }
}
```

**Resultado:** María se asigna a **V3**

**Razón:** `requiereAdecuacionContenido === true` (tiene precedencia sobre acceso)

---

### Ejemplo 2: Estudiante con Solo Adecuación de Acceso

**Configuración del estudiante:**
```typescript
{
  id: "s456",
  name: "Juan Pérez",
  informeTecnico: {
    requiereAdecuacionContenido: false,   // ← Explícitamente false
    requiereAdecuacionAcceso: true        // ← Flag explícito
  }
}
```

**Resultado:** Juan se asigna a **V2**

**Razón:** Solo tiene `requiereAdecuacionAcceso === true` (sin contenido)

---

### Ejemplo 3: Estudiante Sin Adecuaciones

**Configuración del estudiante:**
```typescript
{
  id: "s789",
  name: "Ana Rodríguez",
  informeTecnico: {
    requiereAdecuacionContenido: false,
    requiereAdecuacionAcceso: false
  }
}
```

**Resultado:** Ana se asigna a **V1**

**Razón:** Ningún flag de adecuación está activo

---

### Ejemplo 4: Estudiante con Muchas Contemplaciones pero Sin Flags

**Configuración del estudiante:**
```typescript
{
  id: "s999",
  name: "Pedro López",
  contemplaciones: [
    "contemplacion-1",
    "contemplacion-2",
    "contemplacion-3",
    "contemplacion-4",
    "contemplacion-5",
    "contemplacion-6"
    // ... 20 contemplaciones en total
  ],
  informeTecnico: {
    requiereAdecuacionContenido: false,
    requiereAdecuacionAcceso: false
  }
}
```

**Resultado:** Pedro se asigna a **V1**

**Razón:** Aunque tiene muchas contemplaciones, los flags explícitos son `false`. **NO se infiere** V3 basándose en cantidad de contemplaciones.

---

### Ejemplo 5: Estudiante Sin `informeTecnico` (Legacy)

**Configuración del estudiante:**
```typescript
{
  id: "s111",
  name: "Laura Martínez",
  contemplaciones: ["contemplacion-1", "contemplacion-2"]
  // Sin informeTecnico
}
```

**Resultado:** Laura se asigna a **V1**

**Razón:** Si no existe `informeTecnico` o los flags no están definidos, se asume **V1** (estándar). No se infiere nada de las contemplaciones.

---

## Lo Que Está EXPLÍCITAMENTE PROHIBIDO

### ❌ Prohibido 1: Inferencia por Conteo de Contemplaciones

**MAL (prohibido):**
```typescript
// ❌ NUNCA hacer esto
if (student.contemplaciones.length >= 3) {
  // Asignar a V3
}
```

**Razón:** El número de contemplaciones NO determina la necesidad de adecuación de contenido. Un estudiante puede tener muchas contemplaciones menores (ej: usar lentes, preferir trabajo en grupo) que NO requieren V3.

---

### ❌ Prohibido 2: Parsing de Keywords en Texto

**MAL (prohibido):**
```typescript
// ❌ NUNCA hacer esto
const needsV3 = student.modalidadCursado?.toLowerCase().includes('adaptada') ||
                student.observaciones?.includes('curriculo modificado');
```

**Razón:** El texto libre es ambiguo y puede cambiar. Los flags explícitos son la única fuente de verdad.

---

### ❌ Prohibido 3: Inferencia por Tipo de Contemplación

**MAL (prohibido):**
```typescript
// ❌ NUNCA hacer esto
const severeContemplations = [
  'contemplacion-discapacidad-intelectual',
  'contemplacion-trastorno-espectro-autista'
];
if (student.contemplaciones.some(c => severeContemplations.includes(c))) {
  // Asignar a V3
}
```

**Razón:** La severidad de una contemplación NO determina automáticamente la necesidad de adecuación de contenido. Eso lo decide el equipo multidisciplinario y se refleja en el flag explícito.

---

### ❌ Prohibido 4: Heurísticas Basadas en Múltiples Propiedades

**MAL (prohibido):**
```typescript
// ❌ NUNCA hacer esto
if (student.contemplaciones.length > 2 && 
    student.informeTecnico?.acompaniamientoPermanente === true &&
    student.modalidadCursado === 'Trayectoria singular') {
  // Asignar a V3
}
```

**Razón:** Aunque parezca lógico, esto es inferencia. Solo los flags explícitos determinan la versión.

---

## Dónde Vive la Lógica en el Código

### Archivo Principal: `src/pages/EvaluacionesGrupo.tsx`

#### Funciones Helper para Lectura de Flags

**`studentRequiresContentAdaptation(student)`**

**Ubicación:** Líneas 64-87

**Propósito:** Determinar si un estudiante requiere adecuación de contenido (V3)

**Implementación:**
```typescript
function studentRequiresContentAdaptation(student: Student): boolean {
  // Try localStorage first (persisted from StudentProfile)
  try {
    const key = `student_${student.id}_adecuacionContenido`;
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      return stored === 'true';
    }
  } catch (error) {
    // If localStorage read fails, fall through to fallback
  }
  
  // Fallback: check student.informeTecnico (if present in mock data)
  if (student.informeTecnico?.requiereAdecuacionContenido === true) {
    return true;
  }
  
  // Default: no content adaptation required
  return false;
}
```

**Fuentes de datos (en orden de precedencia):**
1. localStorage: `student_${id}_adecuacionContenido` (configurado por docente en UI)
2. Mock data: `student.informeTecnico.requiereAdecuacionContenido`
3. Default: `false`

---

**`studentRequiresAccessAccommodations(student)`**

**Ubicación:** Líneas 89-112

**Propósito:** Determinar si un estudiante requiere adecuación de acceso (V2)

**Implementación:**
```typescript
function studentRequiresAccessAccommodations(student: Student): boolean {
  // Try localStorage first (persisted from StudentProfile)
  try {
    const key = `student_${student.id}_adecuacionAcceso`;
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      return stored === 'true';
    }
  } catch (error) {
    // If localStorage read fails, fall through to fallback
  }
  
  // Fallback: check student.informeTecnico (if present in mock data)
  if (student.informeTecnico?.requiereAdecuacionAcceso === true) {
    return true;
  }
  
  // Default: no access accommodations required
  return false;
}
```

**Fuentes de datos (en orden de precedencia):**
1. localStorage: `student_${id}_adecuacionAcceso` (configurado por docente en UI)
2. Mock data: `student.informeTecnico.requiereAdecuacionAcceso`
3. Default: `false`

---

#### Función Principal de Versionado

**`getVersionData()`**

**Ubicación:** Líneas 642-683

**Propósito:** Clasificar estudiantes en V1, V2, V3 usando SOLO flags explícitos

**Implementación:**
```typescript
const getVersionData = useCallback(() => {
  if (!selectedGroup) return null;

  const alumnos = selectedGroup.students;
  
  // NEW RULE: Classify students using explicit flags only (no inference)
  // V3 (Content-adapted): Only students with requiereAdecuacionContenido === true
  const conAdecuacionContenido = alumnos.filter(a => 
    studentRequiresContentAdaptation(a)
  );
  
  // V2 (Moderate support): Students with requiereAdecuacionAcceso === true (but NOT content adaptation)
  const conAdecuacionAcceso = alumnos.filter(a => 
    studentRequiresAccessAccommodations(a) && !studentRequiresContentAdaptation(a)
  );
  
  // V1 (Standard): All remaining students (no explicit flags, or only other accommodations)
  const sinAdecuacionesExplicitas = alumnos.filter(a => 
    !studentRequiresContentAdaptation(a) && !studentRequiresAccessAccommodations(a)
  );

  // Assign students to versions
  const v1 = sinAdecuacionesExplicitas;
  const v2 = conAdecuacionAcceso;
  const v3 = conAdecuacionContenido; // Only students with content adaptation

  // Helper to create student details (preserve contemplaciones for display)
  const detalles = (arr: typeof alumnos) =>
    arr.map(a => {
      const persisted = getPersistedContemplaciones(a.id);
      const activas = persisted.length ? persisted : a.contemplaciones;
      return { nombre: a.name, contemplaciones: activas, id: a.id };
    });

  return {
    v1: detalles(v1),
    v2: detalles(v2),
    v3: detalles(v3),
    hasContentAdaptation: conAdecuacionContenido.length > 0  // Flag to determine if V3 should be generated
  };
}, [selectedGroup]);
```

**Nota clave:** La línea 681 `hasContentAdaptation: conAdecuacionContenido.length > 0` determina si se debe generar el archivo V3. Si no hay estudiantes con adecuación de contenido, V3 NO se genera.

---

### Archivo Secundario: `src/components/StudentProfile.tsx`

**Propósito:** Persiste los flags de adecuación en localStorage cuando el docente los configura en la UI.

**Ubicación:** Líneas 150-170 (aprox.)

**Implementación:**
```typescript
// Persist adecuaciones flags to localStorage
const persistirAdecuacionContenido = useCallback((value: boolean) => {
  try {
    const key = `student_${student.id}_adecuacionContenido`;
    localStorage.setItem(key, String(value));
  } catch (error) {
    console.error('Error persisting adecuacionContenido:', error);
  }
}, [student.id]);

const persistirAdecuacionAcceso = useCallback((value: boolean) => {
  try {
    const key = `student_${student.id}_adecuacionAcceso`;
    localStorage.setItem(key, String(value));
  } catch (error) {
    console.error('Error persisting adecuacionAcceso:', error);
  }
}, [student.id]);
```

---

## Flujo de Configuración y Generación

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CONFIGURACIÓN (StudentProfile.tsx)                           │
│    - Docente abre perfil de estudiante                          │
│    - Selecciona checkboxes:                                     │
│      □ requiereAdecuacionContenido                              │
│      □ requiereAdecuacionAcceso                                 │
│    - Flags se persisten en localStorage                         │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. LECTURA DE FLAGS (EvaluacionesGrupo.tsx)                     │
│    - studentRequiresContentAdaptation(student)                  │
│      → Lee localStorage o fallback a mock data                  │
│    - studentRequiresAccessAccommodations(student)               │
│      → Lee localStorage o fallback a mock data                  │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. CLASIFICACIÓN (getVersionData())                             │
│    - Filtra estudiantes por flags:                              │
│      - V3: requiereAdecuacionContenido === true                 │
│      - V2: requiereAdecuacionAcceso === true (sin contenido)    │
│      - V1: Resto (sin flags activos)                            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. GENERACIÓN (handleGenerarCuadernillo())                      │
│    - Si v3.length > 0: Genera archivo V3                        │
│    - Si v2.length > 0: Genera archivo V2                        │
│    - Si v1.length > 0: Genera archivo V1 (siempre)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Casos Edge y Decisiones

### Caso 1: Estudiante con Ambos Flags

**Pregunta:** ¿Qué pasa si `requiereAdecuacionContenido === true` Y `requiereAdecuacionAcceso === true`?

**Respuesta:** El estudiante se asigna a **V3** (contenido tiene precedencia).

**Razón:** La adecuación de contenido implícitamente incluye consideraciones de acceso. V3 es la versión más adaptada.

---

### Caso 2: Grupo Sin Estudiantes V3

**Pregunta:** ¿Qué archivos se generan si ningún estudiante tiene `requiereAdecuacionContenido === true`?

**Respuesta:** Solo se generan V1 y V2 (si aplica). El archivo V3 NO se crea.

**Razón:** `hasContentAdaptation === false` → V3 no se genera.

---

### Caso 3: Actualización de Flags en Tiempo Real

**Pregunta:** Si un docente cambia un flag en `StudentProfile.tsx`, ¿se actualiza inmediatamente la clasificación?

**Respuesta:** SÍ, al recargar `EvaluacionesGrupo.tsx` o cambiar de grupo/materia.

**Razón:** Los flags se leen de localStorage en cada invocación de `getVersionData()`.

---

### Caso 4: Migración de Datos Legacy

**Pregunta:** ¿Qué pasa con estudiantes antiguos que no tienen `informeTecnico`?

**Respuesta:** Se asignan a **V1** (estándar) por defecto.

**Razón:** Las funciones helper retornan `false` si no encuentran datos, asumiendo versión estándar.

---

## Verificación Manual

### Checklist de Auditoría

Para verificar que el sistema cumple con las guardrails:

**1. Inspección de Código:**
- [ ] Buscar en `EvaluacionesGrupo.tsx`: NO debe haber `contemplaciones.length`
- [ ] Buscar en `EvaluacionesGrupo.tsx`: NO debe haber `.includes()`, `.match()`, regex en clasificación
- [ ] Verificar que `getVersionData()` usa SOLO `studentRequiresContentAdaptation()` y `studentRequiresAccessAccommodations()`

**2. Test de Comportamiento:**
- [ ] Estudiante con 10 contemplaciones pero flags en `false` → V1
- [ ] Estudiante con 0 contemplaciones pero `requiereAdecuacionContenido === true` → V3
- [ ] Estudiante con `requiereAdecuacionAcceso === true` (sin contenido) → V2

**3. Test de UI:**
- [ ] En `StudentProfile.tsx`, checkboxes de adecuaciones persisten correctamente
- [ ] Cambiar flags y regenerar evaluación → clasificación se actualiza

---

## Resumen de Garantías

| Garantía | Estado | Implementación |
|----------|--------|----------------|
| **Versionado solo por flags** | ✅ Cumplido | `getVersionData()` usa solo helper functions |
| **No inferencia por conteo** | ✅ Cumplido | No hay `contemplaciones.length` en clasificación |
| **No parsing de texto** | ✅ Cumplido | No hay `.includes()`, regex en clasificación |
| **No heurísticas compuestas** | ✅ Cumplido | Solo evaluación directa de flags |
| **Flags persisten en localStorage** | ✅ Cumplido | `StudentProfile.tsx` guarda cambios |
| **Fallback a mock data** | ✅ Cumplido | Helper functions tienen fallback |
| **V3 solo si hay estudiantes** | ✅ Cumplido | `hasContentAdaptation` controla generación |

---

## Conclusión

El sistema de versionado de evaluaciones está **correctamente implementado** usando guardrails estrictas basadas en flags explícitos. Este documento establece las reglas que DEBEN mantenerse en futuras modificaciones:

✅ **SÍ:** Leer flags explícitos (`requiereAdecuacionContenido`, `requiereAdecuacionAcceso`)  
❌ **NO:** Inferir versión de cualquier otra propiedad  
✅ **SÍ:** Permitir configuración manual por docente  
❌ **NO:** Automatizar decisiones de versionado  

**Cualquier cambio futuro que viole estas guardrails debe ser rechazado en code review.**

---

**Última actualización:** 2026-01-24  
**Autor:** AI Assistant  
**Revisor:** Eitan Wuhl  
**Status:** ✅ GUARDRAILS CONFIRMED

