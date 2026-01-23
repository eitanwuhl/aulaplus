# Motor de Enforcement Determinístico para Contemplaciones

**Ubicación del código:** `src/lib/contemplaciones/enforcement.ts`

**Fecha de creación:** 2026-01-23

---

## Resumen

Motor determinístico que genera outputs estructurados basados en contemplaciones seleccionadas, **sin depender del LLM** para colocar recordatorios correctamente. Garantiza que los recordatorios aparezcan en los lugares correctos según reglas NO negociables.

---

## Reglas NO Negociables

### 1. Recordatorios de Evaluación

**Ubicación:** SOLO en tarjetas de estudiante en "¿A quién contempla esta versión?"

**NO aparecen en:**
- HTML del cuadernillo
- Contenido de la evaluación
- Cualquier otro lugar

### 2. Recordatorios de Plan de Clase

**Ubicación:** SOLO en sección "Diferenciación/Adaptaciones"

**Requisitos:**
- DEBEN incluir nombres de estudiantes
- Agrupar estudiantes por contemplación cuando aplica
- Formato: texto estructurado con nombres

### 3. Reglas de Diseño

**Ubicación:** Se aplican al cuadernillo/materiales

**Características:**
- NO son recordatorios
- Son especificaciones de diseño/formato
- Se aplican a nivel de versión (no por estudiante)

---

## Inputs

### Para Evaluaciones

```typescript
enforceForEvaluation(students: Student[]): EvaluationEnforcementOutput
```

**Parámetros:**
- `students`: Array de estudiantes con `{ id: string | number, name: string }`

**Lee automáticamente:**
- `readSelected(student.id, 'evaluaciones')` - Contemplaciones del catálogo seleccionadas
- `readCustom(student.id, 'evaluaciones')` - Contemplaciones custom seleccionadas

### Para Planes de Clase

```typescript
enforceForLessonPlan(
  students: Student[],
  lessonContent?: string
): LessonPlanEnforcementOutput
```

**Parámetros:**
- `students`: Array de estudiantes con `{ id: string | number, name: string }`
- `lessonContent`: Contenido opcional de la clase (para detectar consignas escritas)

**Lee automáticamente:**
- `readSelected(student.id, 'clase')` - Contemplaciones del catálogo seleccionadas
- `readCustom(student.id, 'clase')` - Contemplaciones custom seleccionadas

---

## Outputs

### Para Evaluaciones

```typescript
interface EvaluationEnforcementOutput {
  versionDesignRules: Set<string>;        // Reglas de diseño para cuadernillo
  perStudentReminders: Map<studentId, string[]>; // Reminders por estudiante
}
```

**Ejemplo:**
```typescript
{
  versionDesignRules: Set([
    'Palabras clave en negrita e íconos de apoyo',
    'Tipografía: Arial 13–14; interlineado 1.5 o doble',
    'Enunciados simples y lenguaje concreto'
  ]),
  perStudentReminders: Map([
    [123, ['Recordar leer consignas en voz alta', 'Recuerda brindar más tiempo y pausas...']],
    [456, ['No penalizar ortografía/sintaxis cuando no es objetivo']]
  ])
}
```

### Para Planes de Clase

```typescript
interface LessonPlanEnforcementOutput {
  diferenciacionBlock: string[]; // Líneas de texto para "Diferenciación/Adaptaciones"
}
```

**Ejemplo:**
```typescript
{
  diferenciacionBlock: [
    'Recordar leer consignas escritas en voz alta para Juan, María y Pedro (si hay consignas escritas puntuales)',
    'Recuerda monitorear la comprensión de Juan y María',
    'Recordar llevar material impreso para Pedro'
  ]
}
```

---

## Mapeo de Contemplaciones (1-26)

### Evaluaciones: Recordatorios por Estudiante

Estas contemplaciones generan recordatorios que aparecen en la tarjeta del estudiante:

| ID | Contemplación | Recordatorio |
|----|--------------|--------------|
| `contemplacion-1` | Lectura oral de consignas | "Recordar leer consignas en voz alta" |
| `contemplacion-3` | Tiempo adicional y pausas | "Recuerda brindar más tiempo y pausas en caso de ser necesario para este alumno" |
| `contemplacion-6` | Hoja auxiliar / borrador permitido | "Permitir hoja auxiliar / borrador" |
| `contemplacion-7` | Calculadora / material concreto | "Recordatorio: calculadora / material concreto cuando corresponda" |
| `contemplacion-8` | Respuesta oral alternativa | "Docente puede escuchar y ayudar a escribir; NO en cuadernillo" |
| `contemplacion-9-22` | Corrección centrada en contenido | "No penalizar ortografía/sintaxis cuando no es objetivo" |
| `contemplacion-10` | Monitoreo docente y andamiaje | "Verificar comprensión durante la prueba sin dar respuestas" |
| `contemplacion-11` | Ubicación estratégica en aula | "Recordatorio: ubicación estratégica en aula si aplica" |
| `contemplacion-20` | Señalización explícita de tiempos | "Recordatorio: señalización explícita de tiempos para este estudiante" |
| `contemplacion-21` | Inicio anticipado / extensión operativa | "Permitir inicio anticipado o extensión operativa del tiempo" |
| `contemplacion-23` | Respuestas estructuradas | "No pedir justificaciones extensas" |
| `contemplacion-24` | Priorización de tareas | "Brindarle sugerencia de orden de respuesta" |
| `contemplacion-25` | Refuerzo positivo | "Apoyos motivacionales breves, sin interferir con evidencia" |
| `contemplacion-26` | Soporte digital | "Recordatorio: soporte digital para producción escrita (teclado/dictado a texto) si el centro lo permite" |

### Evaluaciones: Reglas de Diseño

Estas contemplaciones generan reglas de diseño que se aplican al cuadernillo/materiales:

| ID | Contemplación | Regla de Diseño |
|----|--------------|-----------------|
| `contemplacion-2` | Palabras clave en negrita | "Palabras clave en negrita e íconos de apoyo" |
| `contemplacion-4` | Letra ampliada y alto contraste | "Tipografía legible (letra ampliada y alto contraste)" |
| `contemplacion-5` | Segmentación de consignas | "Consignas en 2 capas (producto + pasos numerados)" |
| `contemplacion-12` | Anticipación y estructura previa | "Incluir 'mapa de la prueba' (secciones, puntaje, tiempo)" |
| `contemplacion-13` | Modelos y plantillas | "Plantillas de respuesta (tabla/matriz/guía) sin dar respuesta" |
| `contemplacion-14` | Guía de revisión / checklist | "Checklist final del estudiante (cité evidencia, respondí todo, etc.)" |
| `contemplacion-15` | Reducción de copia mecánica | "Cuadernillo siempre impreso/entregado" |
| `contemplacion-16` | Diagramación legible | "Diagramación legible y 'no saturada' (espaciado, márgenes, interlineado)" |
| `contemplacion-17` | Tipografía recomendada | "Tipografía: Arial 13–14; interlineado 1.5 o doble" |
| `contemplacion-18` | Enunciados simples | "Enunciados simples y lenguaje concreto (sin frases encadenadas)" |
| `contemplacion-19` | Fragmentación de textos | "Texto por bloques + preguntas inmediatamente después de cada fragmento" |
| `contemplacion-20` | Señalización de tiempos | "Cronograma sugerido por secciones" |
| `contemplacion-23` | Respuestas estructuradas | "Plantillas/casilleros; si hay V/F exigir justificación para no bajar exigencia" |

**Nota:** `contemplacion-20` y `contemplacion-23` generan TANTO reminder como design rule.

### Planes de Clase: Diferenciación/Adaptaciones

Estas contemplaciones generan líneas en "Diferenciación/Adaptaciones" con nombres de estudiantes:

| ID | Contemplación | Template (con nombres) |
|----|--------------|------------------------|
| `contemplacion-1` | Lectura oral de consignas | "Recordar leer consignas escritas en voz alta para {nombres} (si hay consignas escritas puntuales)" |
| `contemplacion-2` | Palabras clave en negrita | "Recordar al docente poner palabras clave en negrita e iconografías para {nombres} si aplica" |
| `contemplacion-4` | Letra ampliada y alto contraste | "Cuando se utilice material, recuerda letra particularmente legible para {nombres}" |
| `contemplacion-7` | Calculadora / material concreto | "Recordatorio: calculadora / material concreto cuando corresponda para {nombres}" |
| `contemplacion-8` | Respuesta oral alternativa | "Participación oral guiada para {nombres}" |
| `contemplacion-10` | Monitoreo docente y andamiaje | "Recuerda monitorear la comprensión de {nombres}" |
| `contemplacion-11` | Ubicación estratégica en aula | "Recomendación: ubicación estratégica en aula (cerca del docente y/o pizarrón) para {nombres}" |
| `contemplacion-12` | Anticipación y estructura previa | "Recomendar entregar agenda/objetivos antes de la clase para {nombres}" |
| `contemplacion-15` | Reducción de copia mecánica | "Recordar llevar material impreso para {nombres}" |
| `contemplacion-24` | Priorización de tareas | "Consignas con orden y foco para {nombres} si aplica" |
| `contemplacion-25` | Refuerzo positivo | "Refuerzo positivo y comentarios de reconocimiento para {nombres} si corresponde" |
| `contemplacion-26` | Soporte digital | "Recordatorio: soporte digital para producción escrita (teclado/dictado a texto) para {nombres} si el centro lo permite" |

---

## Casos Especiales

### #1 Lectura oral de consignas (Clase)

**Regla especial:** Solo se incluye en "Diferenciación/Adaptaciones" si hay "consignas escritas puntuales".

**Implementación:**
1. Se intenta detectar en `lessonContent` (buscando palabras clave: "consigna", "instrucción", etc.)
2. Si se detecta → Se incluye sin condición
3. Si NO se detecta → Se incluye con wording conservador: "(si hay consignas escritas puntuales)"

**Ejemplo:**
- Con detección: `"Recordar leer consignas escritas en voz alta para Juan y María"`
- Sin detección: `"Recordar leer consignas escritas en voz alta para Juan y María (si hay consignas escritas puntuales)"`

### #9-22 Corrección centrada en contenido

**Deduplicación:** Siempre se usa `contemplacion-9-22` (unifica #9 y #22).

**Recordatorio:** Incluye explícitamente "No penalizar ortografía/sintaxis cuando no es objetivo".

---

## Contemplaciones Custom

### Procesamiento

Las contemplaciones custom se procesan usando la **regla oculta** exactamente como el docente la escribió.

### Clasificación Automática

El sistema intenta clasificar automáticamente basándose en palabras clave en la regla:

**Va a Reminders (evaluaciones):**
- Si la regla contiene: "recordatorio", "recordar", "reminder"
- Si NO contiene: "diseño", "formato"

**Va a Design Rules (evaluaciones):**
- Si la regla contiene: "diseño", "formato"

**Va a Diferenciación (clase):**
- Siempre se agrega con nombres de estudiantes
- Formato: `"{regla} (para {nombres})"`

### Ejemplo Custom

**Título:** "Permitir uso de calculadora gráfica"  
**Regla oculta:** "Permitir calculadora gráfica en ejercicios de funciones y gráficos"

**Resultado en evaluación:**
- Reminder para el estudiante: "Permitir calculadora gráfica en ejercicios de funciones y gráficos"

**Resultado en clase:**
- Diferenciación: "Permitir calculadora gráfica en ejercicios de funciones y gráficos (para Juan y María)"

---

## Agrupación de Estudiantes

### En Evaluaciones

- Cada estudiante tiene su propia lista de reminders
- No se agrupan (cada tarjeta muestra sus propios reminders)

### En Planes de Clase

- Los estudiantes se agrupan por contemplación
- Si varios estudiantes tienen la misma contemplación, aparecen juntos en una línea
- Formato de nombres: "Juan", "Juan y María", "Juan, María, y Pedro"

---

## Funciones Helper

### `getStudentRemindersForEvaluation(studentId)`

Obtiene reminders para un estudiante específico en evaluación.

**Uso:**
```typescript
const reminders = getStudentRemindersForEvaluation(123);
// → ['Recordar leer consignas en voz alta', 'Recuerda brindar más tiempo...']
```

### `getDesignRulesForEvaluation(students)`

Obtiene reglas de diseño para una evaluación.

**Uso:**
```typescript
const designRules = getDesignRulesForEvaluation(students);
// → Set(['Palabras clave en negrita...', 'Tipografía: Arial 13–14...'])
```

---

## Ejemplos de Uso

### Ejemplo 1: Evaluación con múltiples estudiantes

```typescript
import { enforceForEvaluation } from '@/lib/contemplaciones/enforcement';

const students = [
  { id: 1, name: 'Juan' },
  { id: 2, name: 'María' },
  { id: 3, name: 'Pedro' }
];

const output = enforceForEvaluation(students);

// Design rules (aplican a toda la versión)
console.log(output.versionDesignRules);
// → Set(['Palabras clave en negrita...', 'Tipografía: Arial 13–14...'])

// Reminders por estudiante
console.log(output.perStudentReminders.get(1));
// → ['Recordar leer consignas en voz alta', 'Recuerda brindar más tiempo...']

console.log(output.perStudentReminders.get(2));
// → ['No penalizar ortografía/sintaxis cuando no es objetivo']
```

### Ejemplo 2: Plan de clase con diferenciación

```typescript
import { enforceForLessonPlan } from '@/lib/contemplaciones/enforcement';

const students = [
  { id: 1, name: 'Juan' },
  { id: 2, name: 'María' },
  { id: 3, name: 'Pedro' }
];

const lessonContent = "En esta clase trabajaremos con consignas escritas sobre...";

const output = enforceForLessonPlan(students, lessonContent);

console.log(output.diferenciacionBlock);
// → [
//     'Recordar leer consignas escritas en voz alta para Juan, María y Pedro',
//     'Recuerda monitorear la comprensión de Juan y María',
//     'Recordar llevar material impreso para Pedro'
//   ]
```

### Ejemplo 3: Integración en componente de evaluación

```typescript
import { enforceForEvaluation } from '@/lib/contemplaciones/enforcement';

// En el componente que renderiza "¿A quién contempla esta versión?"
const output = enforceForEvaluation(assignedStudents);

// Para cada estudiante en la tarjeta
assignedStudents.forEach(student => {
  const reminders = output.perStudentReminders.get(student.id) || [];
  
  // Renderizar reminders en la tarjeta del estudiante
  reminders.forEach(reminder => {
    // Mostrar reminder en la UI
  });
});

// Aplicar design rules al cuadernillo (NO en HTML, solo en generación)
const designRules = Array.from(output.versionDesignRules);
// Pasar a la función que genera el cuadernillo
```

---

## Separación Estricta: Reminders vs Design Rules

### Reminders (NO en cuadernillo)

**Características:**
- Aparecen SOLO en tarjetas de estudiante
- Son recordatorios para el docente
- NO se incluyen en el HTML del cuadernillo
- Son específicos por estudiante

**Ejemplos:**
- "Recordar leer consignas en voz alta"
- "Recuerda brindar más tiempo y pausas..."
- "No penalizar ortografía/sintaxis..."

### Design Rules (SÍ en cuadernillo)

**Características:**
- Se aplican al diseño del cuadernillo/materiales
- Son especificaciones técnicas
- Se aplican a nivel de versión (no por estudiante)
- Se incluyen en la generación del cuadernillo

**Ejemplos:**
- "Palabras clave en negrita e íconos de apoyo"
- "Tipografía: Arial 13–14; interlineado 1.5 o doble"
- "Enunciados simples y lenguaje concreto"

---

## Validación y Testing

### Test 1: Reminders NO aparecen en cuadernillo

**Verificación:**
1. Generar evaluación con estudiantes que tienen contemplaciones
2. Verificar que `perStudentReminders` tiene reminders
3. Verificar que esos reminders NO están en `versionDesignRules`
4. Verificar que el HTML del cuadernillo NO contiene esos reminders

### Test 2: Design Rules SÍ se aplican al cuadernillo

**Verificación:**
1. Generar evaluación con contemplaciones de diseño
2. Verificar que `versionDesignRules` contiene las reglas
3. Verificar que el cuadernillo generado aplica esas reglas

### Test 3: Diferenciación incluye nombres

**Verificación:**
1. Generar plan de clase con estudiantes que tienen contemplaciones
2. Verificar que `diferenciacionBlock` contiene nombres de estudiantes
3. Verificar formato: "para {nombres}" o similar

### Test 4: Caso especial #1 en clase

**Verificación:**
1. Con `lessonContent` que contiene "consigna" → Debe incluir sin condición
2. Sin `lessonContent` o sin "consigna" → Debe incluir con "(si hay consignas escritas puntuales)"

### Test 5: Custom contemplaciones

**Verificación:**
1. Agregar contemplación custom con regla que contiene "recordatorio"
2. Verificar que va a `perStudentReminders` (no a design rules)
3. Agregar contemplación custom con regla que contiene "diseño"
4. Verificar que va a `versionDesignRules` (no a reminders)

---

## Notas de Implementación

### Determinístico

- El motor NO usa LLM
- Todas las decisiones son basadas en reglas explícitas
- Los templates están hardcodeados según el spec
- No hay inferencia ni generación de texto

### Performance

- Lee de localStorage (síncrono)
- Procesa en memoria
- Complejidad: O(n*m) donde n = estudiantes, m = contemplaciones
- En la práctica, muy rápido (< 10ms)

### Extensibilidad

- Agregar nuevas contemplaciones: actualizar templates
- Modificar wording: cambiar templates
- Agregar lógica especial: agregar casos en las funciones

---

## Integración Futura

Este motor está diseñado para ser usado por:

1. **Generación de evaluaciones**: Usar `enforceForEvaluation()` para obtener reminders y design rules
2. **Generación de planes de clase**: Usar `enforceForLessonPlan()` para obtener diferenciación
3. **Componentes de UI**: Usar helpers para mostrar reminders en tarjetas de estudiante

**Próximos pasos:**
- Integrar en `EvaluacionesGrupo.tsx` para mostrar reminders en tarjetas
- Integrar en generación de cuadernillos para aplicar design rules
- Integrar en generación de planes para incluir diferenciación

---

**Última actualización:** 2026-01-23

