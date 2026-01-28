# Catálogo de Contemplaciones v2

**Single Source of Truth** para contemplaciones en AulaPlus.

**Ubicación del código:** `src/lib/contemplaciones/catalog.ts`

**Fecha de creación:** 2026-01-23

---

## Índice

1. [Estructura del Catálogo](#estructura-del-catálogo)
2. [IDs Estables](#ids-estables)
3. [Etiquetas Canónicas](#etiquetas-canónicas)
4. [Categorías de Aplicabilidad](#categorías-de-aplicabilidad)
5. [Materialización](#materialización)
6. [Deduplicación: #9 y #22](#deduplicación-9-y-22)
7. [Badge "Sugerido"](#badge-sugerido)
8. [Funciones Helper](#funciones-helper)
9. [Catálogo Completo (1-26)](#catálogo-completo-1-26)

---

## Estructura del Catálogo

Cada contemplación en el catálogo tiene la siguiente estructura:

```typescript
interface Contemplacion {
  id: string;                    // ID estable (contemplacion-1, contemplacion-2, etc.)
  numero: number;                // Número original (1-26)
  label: string;                 // Etiqueta canónica
  category: ContemplacionCategory; // 'clase' | 'evaluaciones' | 'ambas'
  materializaciones: Materializacion[]; // Cómo se materializa en la UI
  reglasEspecificas?: string[];  // Reglas adicionales explícitas
  notas?: string;                // Notas sobre deduplicación o casos especiales
}
```

---

## IDs Estables

Cada contemplación tiene un **ID estable** que nunca debe cambiar:

- Formato: `contemplacion-{numero}` (ej: `contemplacion-1`, `contemplacion-2`)
- **Excepción:** `contemplacion-9-22` unifica las contemplaciones #9 y #22

**Lista completa de IDs:**

| ID | Número Original | Label |
|----|----------------|-------|
| `contemplacion-1` | 1 | Lectura oral de consignas |
| `contemplacion-2` | 2 | Palabras clave en negrita e íconos de apoyo |
| `contemplacion-3` | 3 | Tiempo adicional y pausas |
| `contemplacion-4` | 4 | Letra ampliada y alto contraste |
| `contemplacion-5` | 5 | Segmentación de consignas en pasos numerados |
| `contemplacion-6` | 6 | Hoja auxiliar / borrador permitido |
| `contemplacion-7` | 7 | Calculadora / material concreto cuando corresponda |
| `contemplacion-8` | 8 | Respuesta oral alternativa (cuando corresponda) |
| `contemplacion-9-22` | 9, 22 | Corrección centrada en contenido (no forma) |
| `contemplacion-10` | 10 | Monitoreo docente y andamiaje (verificación de comprensión) |
| `contemplacion-11` | 11 | Ubicación estratégica en aula (cerca del docente y/o pizarrón) |
| `contemplacion-12` | 12 | Anticipación y estructura previa (agenda, objetivos, punteos/esquemas) |
| `contemplacion-13` | 13 | Modelos y plantillas de respuesta (ejemplos ilustrativos, organizadores) |
| `contemplacion-14` | 14 | Guía de revisión / checklist del estudiante (autocontrol) |
| `contemplacion-15` | 15 | Reducción de copia mecánica (materiales fotocopiados o consignas ya impresas) |
| `contemplacion-16` | 16 | Diagramación legible y "no saturada" (espaciado, márgenes, interlineado) |
| `contemplacion-17` | 17 | Tipografía recomendada y tamaño mínimo (Arial 13–14; interlineado 1.5 o doble) |
| `contemplacion-18` | 18 | Enunciados simples y lenguaje concreto (sin frases encadenadas) |
| `contemplacion-19` | 19 | Fragmentación de textos + preguntas inmediatamente después de cada fragmento |
| `contemplacion-20` | 20 | Señalización explícita de tiempos (avisar límites, tiempos por sección) |
| `contemplacion-21` | 21 | Inicio anticipado / extensión operativa del tiempo (comenzar antes o terminar después) |
| `contemplacion-23` | 23 | Respuestas estructuradas en lugar de redacción extensa (bloques, casilleros, V/F con justificación) |
| `contemplacion-24` | 24 | Priorización de tareas (orden recomendado, qué hacer primero) |
| `contemplacion-25` | 25 | Refuerzo positivo / comentarios de reconocimiento (motivación externa) |
| `contemplacion-26` | 26 | Soporte digital para producción escrita (teclado / dictado a texto si el centro lo permite) |

**Nota:** No existe `contemplacion-22` como ID independiente. La contemplación #22 está unificada con #9 en `contemplacion-9-22`.

---

## Etiquetas Canónicas

Las **etiquetas canónicas** son los nombres oficiales de cada contemplación. Estas etiquetas:

- **NO incluyen** el badge "Sugerido" (ver sección [Badge "Sugerido"](#badge-sugerido))
- Son **inmutables** y deben usarse consistentemente en toda la aplicación
- Se definen en el campo `label` de cada contemplación

**Ejemplo:**
- ✅ Correcto: `"Lectura oral de consignas"`
- ❌ Incorrecto: `"Lectura oral de consignas (Sugerido)"`

---

## Categorías de Aplicabilidad

Cada contemplación pertenece a una de tres categorías:

### `'clase'`
Aplicable solo en contexto de **clase/planificación**.

**Ejemplos:**
- `contemplacion-8`: Respuesta oral alternativa
- `contemplacion-25`: Refuerzo positivo

### `'evaluaciones'`
Aplicable solo en contexto de **evaluaciones**.

**Ejemplos:**
- `contemplacion-3`: Tiempo adicional y pausas
- `contemplacion-5`: Segmentación de consignas en pasos numerados
- `contemplacion-9-22`: Corrección centrada en contenido

### `'ambas'`
Aplicable tanto en **clase** como en **evaluaciones**.

**Ejemplos:**
- `contemplacion-2`: Palabras clave en negrita e íconos de apoyo
- `contemplacion-4`: Letra ampliada y alto contraste
- `contemplacion-10`: Monitoreo docente y andamiaje

---

## Materialización

Cada contemplación se **materializa** en la UI de diferentes formas según el contexto. Los tipos de materialización son:

### `'diseño_cuadernillo'`
Diseño aplicado directamente en el cuadernillo/materiales impresos.

**Ejemplos:**
- Negritas, señalética simple
- Tipografía legible
- Consignas en 2 capas (producto + pasos)
- Plantillas (tabla/matriz/guía)

### `'recordatorio_docente'`
Recordatorio mostrado al docente en "¿A quién contempla...?" o similar.

**Ejemplos:**
- "Recuerda brindar más tiempo y pausas en caso de ser necesario para este alumno"
- "Verificar comprensión durante la prueba sin dar respuestas"
- "No pedir justificaciones extensas"

### `'diferenciacion_adaptaciones'`
Recomendación en la sección "Diferenciación/Adaptaciones" del plan de clase.

**Ejemplos:**
- "Recordar leer consignas escritas en voz alta para (nombres...)"
- "Recuerda monitorear la comprensión de (nombres...)"
- "Recordar llevar material impreso para (nombres...)"

### `'regla_correccion'`
Regla aplicada en corrección/rúbrica.

**Ejemplos:**
- Regla de corrección centrada en contenido (no forma)
- Rúbrica alineada a CL

### `'norma_formato'`
Norma de formato estándar aplicada a todos los materiales.

**Ejemplos:**
- Estándar de diseño de materiales y cuadernillo
- Norma de formato del cuadernillo/materiales
- Norma de redacción en consignas y guías

### `'recomendacion_perfil'`
Recomendación en planificación/perfil del estudiante.

**Ejemplos:**
- Recomendación en planificación/perfil para ubicación estratégica

---

## Deduplicación: #9 y #22

Las contemplaciones **#9** y **#22** están **unificadas** en una sola opción UI para evitar duplicados.

### ID Unificado
- **ID:** `contemplacion-9-22`
- **Números originales:** 9, 22
- **Label:** `"Corrección centrada en contenido (no forma)"`

### Regla Explícita
La contemplación unificada **DEBE incluir explícitamente** la regla:

> **"No penalizar ortografía/sintaxis cuando no es objetivo"**

Esta regla aparece en:
- `reglasEspecificas` del catálogo
- Materialización como `regla_correccion`
- Recordatorio docente en "¿A quién contempla...?"

### Funciones Helper
El catálogo incluye funciones para manejar la deduplicación:

```typescript
// Normalizar IDs (convierte contemplacion-9 o contemplacion-22 a contemplacion-9-22)
normalizeContemplacionId('contemplacion-9') // → 'contemplacion-9-22'
normalizeContemplacionId('contemplacion-22') // → 'contemplacion-9-22'

// Verificar si dos IDs son duplicados
areContemplacionesDuplicadas('contemplacion-9', 'contemplacion-22') // → true

// Deduplicar lista de IDs
deduplicateContemplacionIds(['contemplacion-9', 'contemplacion-22', 'contemplacion-1'])
// → ['contemplacion-9-22', 'contemplacion-1']
```

### Nota de Implementación
Si el sistema recibe referencias a `contemplacion-9` o `contemplacion-22` (por ejemplo, desde datos legacy), deben normalizarse automáticamente a `contemplacion-9-22` antes de procesar.

---

## Badge "Sugerido"

**IMPORTANTE:** El badge "Sugerido" **NO es parte del nombre** de la contemplación.

- El badge "Sugerido" es un **elemento de UI** que puede mostrarse visualmente junto a la contemplación
- La etiqueta canónica (`label`) **nunca incluye** el texto "(Sugerido)" o similar
- El badge debe manejarse por separado en la lógica de UI

**Ejemplo de implementación correcta:**

```typescript
// En el catálogo
{
  id: 'contemplacion-1',
  label: 'Lectura oral de consignas', // ✅ Sin "(Sugerido)"
  // ...
}

// En la UI
<div>
  <span>{contemplacion.label}</span>
  {esSugerida && <Badge>Sugerido</Badge>} {/* Badge separado */}
</div>
```

---

## Funciones Helper

El catálogo exporta las siguientes funciones helper:

### `getAllContemplaciones(): Contemplacion[]`
Retorna todas las contemplaciones del catálogo (1-26, con #9 y #22 unificadas).

### `getContemplacionesByCategory(category: ContemplacionCategory): Contemplacion[]`
Filtra contemplaciones por categoría:
- `'clase'`: Solo contemplaciones de clase
- `'evaluaciones'`: Solo contemplaciones de evaluaciones
- `'ambas'`: Solo contemplaciones aplicables a ambas

### `getContemplacionById(id: string): Contemplacion | undefined`
Obtiene una contemplación por su ID estable.

### `getContemplacionByNumero(numero: number): Contemplacion | undefined`
Obtiene una contemplación por su número original (1-26).

**Nota:** Si se busca `numero: 22`, retornará `contemplacion-9-22` (la unificada).

### `normalizeContemplacionId(id: string): string`
Normaliza IDs de contemplaciones, convirtiendo `contemplacion-9` o `contemplacion-22` a `contemplacion-9-22`.

### `areContemplacionesDuplicadas(id1: string, id2: string): boolean`
Verifica si dos IDs se refieren a la misma contemplación (útil para detectar duplicados).

### `deduplicateContemplacionIds(ids: string[]): string[]`
Elimina duplicados de una lista de IDs y normaliza #9/#22.

### `getContemplacionesForContext(context: 'clase' | 'evaluacion' | 'ambos'): Contemplacion[]`
Obtiene contemplaciones aplicables para un contexto específico:
- `'clase'`: Contemplaciones de clase + ambas
- `'evaluacion'`: Contemplaciones de evaluaciones + ambas
- `'ambos'`: Solo contemplaciones de ambas

---

## Catálogo Completo (1-26)

### Contemplación 1: Lectura oral de consignas
- **ID:** `contemplacion-1`
- **Categoría:** `evaluaciones` (Clase solo si hay consignas escritas puntuales)
- **Materialización:**
  - Evaluación: Recordatorio docente ("Recordar leer consignas en voz alta")
  - Clase: Diferenciación/Adaptaciones ("Recordar leer consignas escritas en voz alta para (nombres...)")

### Contemplación 2: Palabras clave en negrita e íconos de apoyo
- **ID:** `contemplacion-2`
- **Categoría:** `ambas`
- **Materialización:**
  - Evaluación: Diseño cuadernillo (negritas, señalética simple)
  - Clase: Recordatorio docente

### Contemplación 3: Tiempo adicional y pausas
- **ID:** `contemplacion-3`
- **Categoría:** `evaluaciones`
- **Materialización:**
  - Evaluación: Recordatorio docente
  - Clase: No aplica

### Contemplación 4: Letra ampliada y alto contraste
- **ID:** `contemplacion-4`
- **Categoría:** `ambas`
- **Materialización:**
  - Evaluación: Diseño cuadernillo (tipografía legible)
  - Clase: Diferenciación/Adaptaciones

### Contemplación 5: Segmentación de consignas en pasos numerados
- **ID:** `contemplacion-5`
- **Categoría:** `evaluaciones`
- **Materialización:**
  - Evaluación: Diseño cuadernillo (consignas en 2 capas: producto + pasos)
  - Clase: No aplica (en esta etapa)

### Contemplación 6: Hoja auxiliar / borrador permitido
- **ID:** `contemplacion-6`
- **Categoría:** `evaluaciones`
- **Materialización:**
  - Evaluación: Recordatorio docente

### Contemplación 7: Calculadora / material concreto cuando corresponda
- **ID:** `contemplacion-7`
- **Categoría:** `ambas` (solo cuando la tarea lo permite)
- **Materialización:**
  - Ambas: Recordatorio docente (en evaluación especialmente si corresponde)

### Contemplación 8: Respuesta oral alternativa (cuando corresponda)
- **ID:** `contemplacion-8`
- **Categoría:** `clase` (Evaluación: como apoyo docente, NO evidencia)
- **Materialización:**
  - Clase: Diferenciación/Adaptaciones (participación oral guiada)
  - Evaluación: Recordatorio docente (docente puede escuchar y ayudar a escribir; NO en cuadernillo)

### Contemplación 9-22: Corrección centrada en contenido (no forma)
- **ID:** `contemplacion-9-22` ⚠️ **UNIFICADA**
- **Números originales:** 9, 22
- **Categoría:** `evaluaciones`
- **Materialización:**
  - Regla corrección/rúbrica
  - Recordatorio docente
- **Regla explícita:** "No penalizar ortografía/sintaxis cuando no es objetivo"

### Contemplación 10: Monitoreo docente y andamiaje (verificación de comprensión)
- **ID:** `contemplacion-10`
- **Categoría:** `ambas`
- **Materialización:**
  - Evaluación: Recordatorio docente ("Verificar comprensión durante la prueba sin dar respuestas")
  - Clase: Diferenciación/Adaptaciones ("Recuerda monitorear la comprensión de (nombres...)")

### Contemplación 11: Ubicación estratégica en aula (cerca del docente y/o pizarrón)
- **ID:** `contemplacion-11`
- **Categoría:** `ambas`
- **Materialización:**
  - Clase: Recomendación perfil
  - Evaluación: Recordatorio docente si aplica

### Contemplación 12: Anticipación y estructura previa (agenda, objetivos, punteos/esquemas)
- **ID:** `contemplacion-12`
- **Categoría:** `ambas`
- **Materialización:**
  - Clase: Diferenciación/Adaptaciones ("Recomendar entregar agenda/objetivos antes de la clase para (nombres...)")
  - Evaluación: Diseño cuadernillo ("mapa de la prueba": secciones, puntaje, tiempo)

### Contemplación 13: Modelos y plantillas de respuesta (ejemplos ilustrativos, organizadores)
- **ID:** `contemplacion-13`
- **Categoría:** `evaluaciones`
- **Materialización:**
  - Evaluación: Diseño cuadernillo (plantillas: tabla/matriz/guía sin dar respuesta)
  - Clase: No aplica (en esta etapa)

### Contemplación 14: Guía de revisión / checklist del estudiante (autocontrol)
- **ID:** `contemplacion-14`
- **Categoría:** `evaluaciones`
- **Materialización:**
  - Evaluación: Diseño cuadernillo (checklist final: cité evidencia, respondí todo, etc.)
  - Clase: No aplica

### Contemplación 15: Reducción de copia mecánica (materiales fotocopiados o consignas ya impresas)
- **ID:** `contemplacion-15`
- **Categoría:** `ambas` (Clase: principal, Evaluación: sí)
- **Materialización:**
  - Clase: Diferenciación/Adaptaciones ("Recordar llevar material impreso para (nombres...)")
  - Evaluación: Diseño cuadernillo (cuadernillo siempre impreso/entregado)

### Contemplación 16: Diagramación legible y "no saturada" (espaciado, márgenes, interlineado)
- **ID:** `contemplacion-16`
- **Categoría:** `ambas`
- **Materialización:**
  - Ambas: Norma formato (estándar de diseño de materiales y cuadernillo)

### Contemplación 17: Tipografía recomendada y tamaño mínimo (Arial 13–14; interlineado 1.5 o doble)
- **ID:** `contemplacion-17`
- **Categoría:** `ambas`
- **Materialización:**
  - Ambas: Norma formato (norma de formato del cuadernillo/materiales)
- **Regla específica:** Arial 13–14; interlineado 1.5 o doble

### Contemplación 18: Enunciados simples y lenguaje concreto (sin frases encadenadas)
- **ID:** `contemplacion-18`
- **Categoría:** `ambas`
- **Materialización:**
  - Ambas: Norma formato (norma de redacción en consignas y guías)

### Contemplación 19: Fragmentación de textos + preguntas inmediatamente después de cada fragmento
- **ID:** `contemplacion-19`
- **Categoría:** `evaluaciones`
- **Materialización:**
  - Evaluación: Diseño cuadernillo (texto por bloques + preguntas por bloque)
  - Clase: No aplica en desarrollo (en esta etapa)

### Contemplación 20: Señalización explícita de tiempos (avisar límites, tiempos por sección)
- **ID:** `contemplacion-20`
- **Categoría:** `evaluaciones`
- **Materialización:**
  - Evaluación: Diseño cuadernillo (cronograma sugerido por secciones) + Recordatorio docente
  - Clase: No aplica

### Contemplación 21: Inicio anticipado / extensión operativa del tiempo (comenzar antes o terminar después)
- **ID:** `contemplacion-21`
- **Categoría:** `evaluaciones`
- **Materialización:**
  - Evaluación: Recordatorio docente

### Contemplación 23: Respuestas estructuradas en lugar de redacción extensa (bloques, casilleros, V/F con justificación)
- **ID:** `contemplacion-23`
- **Categoría:** `evaluaciones`
- **Materialización:**
  - Evaluación: Diseño cuadernillo (plantillas/casilleros; si hay V/F exigir justificación para no bajar exigencia)
  - Evaluación: Recordatorio docente ("No pedir justificaciones extensas")

### Contemplación 24: Priorización de tareas (orden recomendado, qué hacer primero)
- **ID:** `contemplacion-24`
- **Categoría:** `evaluaciones` (Clase: consignas con orden y foco)
- **Materialización:**
  - Evaluación: Recordatorio docente ("Brindarle sugerencia de orden de respuesta")
  - Clase: Diferenciación/Adaptaciones ("Consignas con orden y foco si aplica")

### Contemplación 25: Refuerzo positivo / comentarios de reconocimiento (motivación externa)
- **ID:** `contemplacion-25`
- **Categoría:** `clase` (Evaluación: administración mínima)
- **Materialización:**
  - Clase: Diferenciación/Adaptaciones
  - Evaluación: Recordatorio docente ("Apoyos motivacionales breves, sin interferir con evidencia")

### Contemplación 26: Soporte digital para producción escrita (teclado / dictado a texto si el centro lo permite)
- **ID:** `contemplacion-26`
- **Categoría:** `ambas`
- **Materialización:**
  - Ambas: Recordatorio docente + opción de formato (evidencia sigue escrita)
- **Regla específica:** "Grabación" NO como evidencia → traducir a "dictado a texto/teclado"

---

## Notas de Implementación

1. **Preservar mapeo literal:** Las reglas especificadas en el catálogo deben preservarse exactamente. No debilitar ninguna regla.

2. **IDs estables:** Los IDs nunca deben cambiar. Si se necesita referenciar una contemplación, usar siempre su ID estable.

3. **Deduplicación automática:** Cualquier referencia a `contemplacion-9` o `contemplacion-22` debe normalizarse automáticamente a `contemplacion-9-22`.

4. **Badge "Sugerido":** El badge es un elemento de UI separado, no parte del nombre de la contemplación.

5. **Contexto de aplicación:** Verificar siempre la categoría de la contemplación antes de aplicarla en un contexto específico.

---

**Última actualización:** 2026-01-23








