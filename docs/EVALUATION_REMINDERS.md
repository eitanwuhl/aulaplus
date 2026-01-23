# Recordatorios de Evaluación por Estudiante

**Ubicación del código:** `src/components/evaluaciones/SimplifiedSmartRubric.tsx`  
**Motor de enforcement:** `src/lib/contemplaciones/enforcement.ts`

**Fecha de creación:** 2026-01-23

---

## Resumen

Los recordatorios determinísticos por estudiante se muestran **SOLO** en las tarjetas de estudiante dentro de la sección "¿A quién contempla esta versión?" de la rúbrica de evaluación. Estos recordatorios **NUNCA** aparecen en el contenido de la evaluación (cuadernillo) que ven los estudiantes.

---

## Ubicación en la UI

### Dónde Aparecen los Recordatorios

**Sección:** "¿A quién contempla esta versión?"  
**Componente:** `SimplifiedSmartRubric.tsx`  
**Ubicación visual:** Dentro de la tarjeta "Rúbrica de Evaluación", después de los criterios de logro ANEP

**Estructura visual:**
```
┌─────────────────────────────────────────┐
│ Rúbrica de Evaluación                   │
├─────────────────────────────────────────┤
│ [Criterios de logro ANEP...]            │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ¿A quién contempla esta versión?    │ │
│ ├─────────────────────────────────────┤ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │ Juan Pérez                      │ │ │
│ │ │ Justificación contextual...     │ │ │
│ │ │                                 │ │ │
│ │ │ Recordatorios para esta         │ │ │
│ │ │ evaluación:                     │ │ │
│ │ │ • Recordar leer consignas...   │ │ │
│ │ │ • Recuerda brindar más tiempo...│ │ │
│ │ └─────────────────────────────────┘ │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Dónde NO Aparecen los Recordatorios

**Componente:** `CleanEvaluationDisplay.tsx`  
**Ubicación visual:** Segunda tarjeta grande (contenido puro de la evaluación)

**Garantía:** El contenido de la evaluación (`evaluation.content`) **NO contiene** recordatorios. Solo contiene:
- Consignas
- Preguntas
- Ejercicios
- Instrucciones para estudiantes

---

## Implementación Técnica

### Flujo de Datos

1. **Entrada:** Lista de estudiantes con IDs y nombres
   ```typescript
   students?: Array<{
     id: number;
     name: string;
     contemplaciones: string[];
   }>
   ```

2. **Procesamiento:** Motor de enforcement lee contemplaciones desde `localStorage`
   ```typescript
   const enforcementOutput = enforceForEvaluation(enforcementStudents);
   const perStudentReminders = enforcementOutput.perStudentReminders;
   // Map<studentId, string[]>
   ```

3. **Renderizado:** Recordatorios se muestran en las tarjetas de estudiante
   ```typescript
   const reminders = perStudentReminders.get(student.id) || [];
   // Render en la UI dentro de cada tarjeta de estudiante
   ```

### Código Clave

**En `SimplifiedSmartRubric.tsx`:**

```typescript
// Obtener recordatorios determinísticos usando el motor de enforcement
const perStudentReminders = useMemo(() => {
  const enforcementStudents: EnforcementStudent[] = (students || []).map(s => ({
    id: s.id,
    name: s.name || `Estudiante ${s.id}`
  }));

  if (enforcementStudents.length === 0) {
    return new Map<string | number, string[]>();
  }

  const enforcementOutput = enforceForEvaluation(enforcementStudents);
  return enforcementOutput.perStudentReminders;
}, [students]);

// Render en las tarjetas de estudiante
{reminders.length > 0 && (
  <div className="mt-3 pt-3 border-t border-border">
    <div className="text-xs font-medium text-muted-foreground mb-2">
      Recordatorios para esta evaluación:
    </div>
    <ul className="space-y-1.5">
      {reminders.map((reminder, reminderIndex) => (
        <li key={reminderIndex} className="text-sm text-foreground flex items-start gap-2">
          <span className="text-primary mt-0.5">•</span>
          <span>{reminder}</span>
        </li>
      ))}
    </ul>
  </div>
)}
```

---

## Fuente de Datos

### Contemplaciones del Catálogo

Los recordatorios se generan desde contemplaciones seleccionadas en el perfil del estudiante:

**Categoría:** "Contemplaciones para evaluaciones"  
**Storage key:** `contemplacionesEval:${studentId}`  
**Formato:** `string[]` de IDs de contemplaciones (ej: `['contemplacion-1', 'contemplacion-3']`)

### Mapeo de Contemplaciones a Recordatorios

| ID Contemplación | Recordatorio Generado |
|------------------|------------------------|
| `contemplacion-1` | "Recordar leer consignas en voz alta" |
| `contemplacion-3` | "Recuerda brindar más tiempo y pausas en caso de ser necesario para este alumno" |
| `contemplacion-6` | "Permitir hoja auxiliar / borrador" |
| `contemplacion-7` | "Recordatorio: calculadora / material concreto cuando corresponda" |
| `contemplacion-8` | "Docente puede escuchar y ayudar a escribir; NO en cuadernillo" |
| `contemplacion-9-22` | "No penalizar ortografía/sintaxis cuando no es objetivo" |
| `contemplacion-10` | "Verificar comprensión durante la prueba sin dar respuestas" |
| `contemplacion-11` | "Recordatorio: ubicación estratégica en aula si aplica" |
| `contemplacion-20` | "Recordatorio: señalización explícita de tiempos para este estudiante" |
| `contemplacion-21` | "Permitir inicio anticipado o extensión operativa del tiempo" |
| `contemplacion-23` | "No pedir justificaciones extensas" |
| `contemplacion-24` | "Brindarle sugerencia de orden de respuesta" |
| `contemplacion-25` | "Apoyos motivacionales breves, sin interferir con evidencia" |
| `contemplacion-26` | "Recordatorio: soporte digital para producción escrita (teclado/dictado a texto) si el centro lo permite" |

**Ver mapeo completo:** `src/lib/contemplaciones/enforcement.ts` → `EVALUATION_REMINDER_TEMPLATES`

### Contemplaciones Custom

Si un estudiante tiene contemplaciones custom seleccionadas:

**Storage key:** `contemplacionesCustomEval:${studentId}`  
**Formato:** `Array<{ id, title, rule, selected }>`

**Regla de clasificación:**
- Si la regla contiene "recordatorio", "recordar", o "reminder" → Va a recordatorios
- Si NO contiene "diseño" ni "formato" → Va a recordatorios (por defecto)
- Si contiene "diseño" o "formato" → Va a design rules (NO a recordatorios)

---

## Separación Estricta: Recordatorios vs Design Rules

### Recordatorios (Aparecen en Tarjetas)

**Características:**
- Específicos por estudiante
- Aparecen SOLO en tarjetas de "¿A quién contempla...?"
- Son instrucciones para el docente
- NO aparecen en el contenido de la evaluación

**Ejemplos:**
- "Recordar leer consignas en voz alta"
- "Recuerda brindar más tiempo y pausas..."
- "No penalizar ortografía/sintaxis..."

### Design Rules (NO Aparecen en Tarjetas)

**Características:**
- Aplican a nivel de versión (no por estudiante)
- Se aplican al formato/diseño del cuadernillo
- NO aparecen como texto en las tarjetas
- Se usan para generar el cuadernillo con formato correcto

**Ejemplos:**
- "Palabras clave en negrita e íconos de apoyo"
- "Tipografía: Arial 13–14; interlineado 1.5 o doble"
- "Enunciados simples y lenguaje concreto"

**Nota:** Las design rules están disponibles en `enforcementOutput.versionDesignRules` pero **NO se renderizan en las tarjetas de estudiante**. Se usarán en futuras integraciones para aplicar formato al cuadernillo.

---

## Casos Especiales

### Contemplaciones "Orales" (#1, #8, #10)

**Regla crítica:** Estas contemplaciones generan recordatorios que **NUNCA** deben aparecer en el cuadernillo.

**Contemplaciones:**
- `contemplacion-1`: Lectura oral de consignas
- `contemplacion-8`: Respuesta oral alternativa
- `contemplacion-10`: Monitoreo docente y andamiaje

**Garantía de implementación:**
- Estas contemplaciones tienen `materializacion.tipo === 'recordatorio_docente'`
- Se mapean SOLO a `EVALUATION_REMINDER_TEMPLATES`
- NO tienen entrada en `EVALUATION_DESIGN_RULES`
- Por lo tanto, **imposible** que aparezcan en el cuadernillo

### Contemplación #9-22 (Deduplicada)

**Regla:** Las contemplaciones #9 y #22 se unifican en `contemplacion-9-22`.

**Recordatorio:** Siempre incluye explícitamente "No penalizar ortografía/sintaxis cuando no es objetivo".

**Implementación:**
- Si un estudiante tiene `contemplacion-9` o `contemplacion-22` seleccionada, se normaliza a `contemplacion-9-22`
- El recordatorio generado es único y explícito

---

## Comportamiento con `assignedStudents`

### Preservación del Comportamiento Existente

El código **preserva** el comportamiento existente de `assignedStudents`:

```typescript
// Si assignedStudents está definido, se usa como source of truth
if (assignedStudents && assignedStudents.length > 0 && students && students.length > 0) {
  // Filtrar estudiantes por nombre normalizado
  const filteredStudents = students.filter(student => {
    const studentName = student.name || `Estudiante ${student.id}`;
    const normalizedStudentName = normalizeStudentName(studentName);
    return assignedStudentNamesNormalized.has(normalizedStudentName);
  });
  
  // Solo mostrar tarjetas para estudiantes asignados
  return filteredStudents.map(student => ({
    nombre: student.name,
    justificacion: generateContextualJustification(student, evaluationContent)
  }));
}
```

**Los recordatorios se calculan para TODOS los estudiantes en `students`, pero solo se muestran para los que están en `assignedStudents`.**

---

## Ejemplos de Uso

### Ejemplo 1: Estudiante con Múltiples Contemplaciones

**Estudiante:** Juan Pérez (ID: 123)  
**Contemplaciones seleccionadas:**
- `contemplacion-1` (Lectura oral de consignas)
- `contemplacion-3` (Tiempo adicional y pausas)
- `contemplacion-9-22` (Corrección centrada en contenido)

**Resultado en la tarjeta:**
```
┌─────────────────────────────────────┐
│ Juan Pérez                           │
│ Justificación contextual...         │
│                                     │
│ Recordatorios para esta evaluación: │
│ • Recordar leer consignas en voz alta│
│ • Recuerda brindar más tiempo y     │
│   pausas en caso de ser necesario   │
│   para este alumno                   │
│ • No penalizar ortografía/sintaxis   │
│   cuando no es objetivo              │
└─────────────────────────────────────┘
```

### Ejemplo 2: Estudiante sin Contemplaciones

**Estudiante:** María González (ID: 456)  
**Contemplaciones seleccionadas:** `[]` (ninguna)

**Resultado en la tarjeta:**
```
┌─────────────────────────────────────┐
│ María González                      │
│ Justificación contextual...         │
│ (No hay sección de recordatorios)   │
└─────────────────────────────────────┘
```

### Ejemplo 3: Múltiples Estudiantes en la Misma Versión

**Versión:** Versión 2 (Apoyo Moderado)  
**Estudiantes asignados:**
- Juan Pérez (ID: 123) → Tiene `contemplacion-1`, `contemplacion-3`
- Pedro Martínez (ID: 789) → Tiene `contemplacion-6`, `contemplacion-21`

**Resultado:**
- Tarjeta de Juan muestra recordatorios de #1 y #3
- Tarjeta de Pedro muestra recordatorios de #6 y #21
- Cada estudiante tiene sus propios recordatorios específicos

---

## Verificación y Testing

### Test Manual: Recordatorios Aparecen en Tarjetas

1. Ir a "Perfiles de Estudiantes"
2. Seleccionar un estudiante
3. En "Contemplaciones para evaluaciones", seleccionar:
   - ✅ "Lectura oral de consignas"
   - ✅ "Tiempo adicional y pausas"
4. Guardar cambios
5. Ir a "Evaluaciones" → Generar evaluación
6. Asignar el estudiante a una versión
7. **VERIFICAR:** En "¿A quién contempla esta versión?", la tarjeta del estudiante muestra:
   - Nombre del estudiante
   - Justificación contextual
   - Sección "Recordatorios para esta evaluación:" con los recordatorios

### Test Manual: Recordatorios NO Aparecen en Cuadernillo

1. Usar la misma evaluación del test anterior
2. Buscar la segunda tarjeta grande (contenido puro de la evaluación)
3. Revisar TODO el contenido visible
4. **VERIFICAR:** NO aparece ninguna frase como:
   - "Recordar leer consignas"
   - "Recuerda brindar más tiempo"
   - "No penalizar ortografía"
   - Cualquier mención a recordatorios o contemplaciones

### Test Manual: Separación por Estudiante

1. Preparar dos estudiantes con diferentes contemplaciones
2. Asignar ambos a la misma versión
3. **VERIFICAR:** Cada tarjeta muestra solo los recordatorios de su propio estudiante

---

## Integración Futura

### Design Rules (Pendiente)

Actualmente, `enforcementOutput.versionDesignRules` se calcula pero **NO se usa** en la UI. Estas reglas se aplicarán en futuras integraciones para:

1. **Generación de cuadernillo:** Aplicar formato según design rules
2. **Preview de formato:** Mostrar cómo se verá el cuadernillo con las reglas aplicadas
3. **Exportación:** Incluir formato en PDF/HTML según design rules

**Nota:** Las design rules **NO** aparecen como texto en las tarjetas de estudiante. Son especificaciones técnicas para el formato del cuadernillo.

---

## Notas de Implementación

### Determinístico

- El motor NO usa LLM para generar recordatorios
- Todos los recordatorios vienen de templates hardcodeados
- El mapeo es 1:1 desde contemplaciones a recordatorios
- No hay inferencia ni generación de texto

### Performance

- Los recordatorios se calculan con `useMemo` para evitar recálculos innecesarios
- La lectura de `localStorage` es síncrona y rápida
- Complejidad: O(n*m) donde n = estudiantes, m = contemplaciones
- En la práctica, muy rápido (< 10ms)

### Extensibilidad

- Agregar nuevos recordatorios: actualizar `EVALUATION_REMINDER_TEMPLATES` en `enforcement.ts`
- Modificar wording: cambiar templates en `enforcement.ts`
- Agregar lógica especial: agregar casos en `enforceForEvaluation()`

---

## Troubleshooting

### Los recordatorios no aparecen

**Posibles causas:**
1. El estudiante no tiene contemplaciones seleccionadas en "Contemplaciones para evaluaciones"
2. Las contemplaciones seleccionadas no generan recordatorios (solo design rules)
3. El estudiante no está en la lista `students` pasada al componente
4. El ID del estudiante no coincide entre `students` y `assignedStudents`

**Solución:**
- Verificar `localStorage` key: `contemplacionesEval:${studentId}`
- Verificar que las contemplaciones seleccionadas tienen `materializacion.tipo === 'recordatorio_docente'`
- Verificar que el estudiante está en `assignedStudents` de la versión

### Los recordatorios aparecen duplicados

**Posible causa:** El estudiante tiene la misma contemplación seleccionada múltiples veces (no debería pasar, pero el código tiene deduplicación).

**Solución:** El código ya tiene deduplicación en `enforceForEvaluation()`, pero si persiste, verificar `localStorage`.

### Los recordatorios aparecen en el cuadernillo

**CRÍTICO:** Esto NO debería pasar. Si sucede:

1. Verificar que `CleanEvaluationDisplay` NO usa `enforceForEvaluation()`
2. Verificar que la generación de evaluación (Supabase function) NO inyecta recordatorios
3. Verificar que `evaluation.content` NO contiene recordatorios antes de renderizar

**Solución:** Los recordatorios SOLO deben aparecer en `SimplifiedSmartRubric.tsx`, nunca en `CleanEvaluationDisplay.tsx`.

---

**Última actualización:** 2026-01-23

