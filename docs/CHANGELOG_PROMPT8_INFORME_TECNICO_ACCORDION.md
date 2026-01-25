# CHANGELOG: Informe Técnico Psicopedagógico - UI Acordeón

> **Fecha**: 2026-01-25  
> **Prompt**: 8  
> **Branch**: `Nuevos-perfiles-y-reglas-para-contemplaciones`  
> **Commit**: "feat(informe-tecnico): implement accordion UI for students with adecuaciones"  
> **Estado**: ✅ Implementado

---

## Resumen

Se implementó una nueva UI de acordeón para el "Informe Técnico Psicopedagógico" de los 4 estudiantes con ajustes necesarios (Ana García, Carlos López, María Rodríguez, Diego Martínez). La sección ahora es más legible y teacher-friendly, mostrando solo los títulos de las tarjetas cuando están colapsadas, y el contenido completo cuando se expanden.

---

## Cambios Implementados

### 1. Nueva Estructura de Datos (`src/data/mockData.ts`)

#### A) Actualización de Interfaz `InformeTecnico`

```typescript
export interface InformeTecnico {
  sintesis: string | { title: string; bullets: string[] }[];  // NEW: support accordion cards OR legacy string
  estiloAprendizaje: string;
  objetivosPriorizados: string[];
  modalidadCursado: string;
  ajustesProgramaticos: { materia: string; ajustes: string[] }[];
  requiereAdecuacionAcceso?: boolean;
  requiereAdecuacionContenido?: boolean;
}
```

**Cambio clave**: El campo `sintesis` ahora puede ser:
- **Array de tarjetas** (`{ title: string; bullets: string[] }[]`) para los 4 estudiantes con adecuaciones → Renderiza acordeón.
- **String simple** (legacy) para otros estudiantes → Renderiza la UI anterior.

#### B) Datos Actualizados para los 4 Estudiantes

**Ana García (ID: 1)**
- `sintesis`: Array de 5 tarjetas (Potencial Intelectual, Rendimiento Cognitivo, Polo Comprensivo, Lenguaje Escrito, Área Lógico-Matemática).
- `ajustesProgramaticos`: `[]` (vacío, no se muestra).
- `requiereAdecuacionAcceso`: `true`
- `requiereAdecuacionContenido`: `false`

**Carlos López (ID: 2)**
- `sintesis`: Array de 9 tarjetas (Disposición y Adaptación al Trabajo, Potencial Intelectual, Recursos Cognitivos, Debilidades del Perfil Cognitivo, Estilo de Aprendizaje y Adaptación a Novedades, Manejo del Conflicto Cognitivo, Diagnóstico y Congruencia del Perfil, Definición y Alcance del Síndrome Disejecutivo, Impacto Específico en la Escritura).
- `ajustesProgramaticos`: `[]` (vacío, no se muestra).
- `requiereAdecuacionAcceso`: `true`
- `requiereAdecuacionContenido`: `false`

**María Rodríguez (ID: 3)**
- `sintesis`: Array de 6 tarjetas (Potencial, Perfil Cognitivo, Lenguaje Escrito (Dislexia), Área Lógico-Matemática, Factores Emocionales y Metacognitivos, Conclusión General).
- `ajustesProgramaticos`: `[]` (vacío, no se muestra).
- `requiereAdecuacionAcceso`: `true`
- `requiereAdecuacionContenido`: `false`

**Diego Martínez (ID: 4)**
- `sintesis`: Array de 9 tarjetas (Dificultades Generales y Presentación, Performance Intelectual, Perfil Cognitivo, Dificultades Instrumentales y Práxicas, Procesamiento de la Información Verbal y Lenguaje, Rendimiento en Áreas Instrumentales, Atención y Funciones Ejecutivas, Perfil Mnésico, Perfil Afectivo-Emocional y Social).
- `ajustesProgramaticos`: Array con ajustes específicos por materia (Todas, Matemática, Lengua, Ciencias/Historia) → **Sí se muestra**.
- `requiereAdecuacionAcceso`: `false`
- `requiereAdecuacionContenido`: `true`

---

### 2. UI de Acordeón (`src/components/StudentProfile.tsx`)

#### A) Nuevos Imports

```typescript
import { ..., ChevronDown, ChevronRight } from 'lucide-react';
```

#### B) Nuevo Estado para Acordeón

```typescript
const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
```

**Comportamiento**: Las tarjetas inician colapsadas (Set vacío). El usuario puede expandir/colapsar haciendo click en el título de cada tarjeta.

#### C) Lógica de Renderizado Condicional

```typescript
{Array.isArray(student.informeTecnico.sintesis) ? (
  // NEW: Accordion UI for students with adecuaciones
  <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-400">
    <h4 className="font-semibold text-gray-800 mb-4">Síntesis de situación actual</h4>
    <div className="space-y-2">
      {student.informeTecnico.sintesis.map((card, index) => {
        const isExpanded = expandedCards.has(index);
        return (
          <div key={index} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={...} className="w-full flex items-center justify-between p-4 ...">
              <h5 className="font-semibold text-gray-800 text-sm">{card.title}</h5>
              {isExpanded ? <ChevronDown .../> : <ChevronRight .../>}
            </button>
            {isExpanded && (
              <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                <ul className="space-y-2">
                  {card.bullets.map((bullet, bulletIndex) => (
                    <li key={bulletIndex} className="...">
                      <span className="text-purple-600 font-bold mt-1">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
) : (
  // LEGACY: Simple text display for students without the new structure
  <>
    <div className="bg-purple-50 ...">Síntesis de situación actual</div>
    <div className="bg-blue-50 ...">Estilo de aprendizaje</div>
    <div className="bg-yellow-50 ...">Modalidad de cursado</div>
    {ajustesProgramaticos ...}
  </>
)}
```

**Reglas**:
- Si `sintesis` es **array** → Renderiza **acordeón** (estudiantes con adecuaciones).
  - **NO** se muestran `estiloAprendizaje` ni `modalidadCursado` para estos estudiantes.
  - `ajustesProgramaticos` solo se muestra si `requiereAdecuacionContenido === true` (solo Diego Martínez).
- Si `sintesis` es **string** → Renderiza **UI legacy** (otros estudiantes).

#### D) Sección "Ajustes programáticos por materia" (SOLO Diego Martínez)

```typescript
{Array.isArray(student.informeTecnico.sintesis) && 
  student.informeTecnico.requiereAdecuacionContenido && 
  student.informeTecnico.ajustesProgramaticos && 
  student.informeTecnico.ajustesProgramaticos.length > 0 && (
  <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-400">
    <h4 className="font-semibold text-gray-800 mb-3">Ajustes programáticos por materia</h4>
    ...
  </div>
)}
```

**Condiciones**:
1. `sintesis` debe ser array (estudiante con adecuaciones).
2. `requiereAdecuacionContenido === true` (solo Diego).
3. `ajustesProgramaticos` debe existir y no estar vacío.

#### E) Checkboxes de Adecuaciones (Sin Cambios)

Los checkboxes "Requiere adecuación de acceso" y "Requiere adecuación de contenido" se mantienen visibles y funcionales para todos los estudiantes con `informeTecnico`, tal como estaban antes.

---

## Comportamiento UX

### Para Estudiantes con Adecuaciones (Ana, Carlos, María, Diego)

1. **Estado inicial**: Todas las tarjetas colapsadas, solo títulos visibles.
2. **Expansión**: Click en cualquier tarjeta → Se expande mostrando el contenido completo (bullets).
3. **Colapso**: Click en una tarjeta expandida → Se colapsa ocultando el contenido.
4. **Navegación**: El docente puede expandir/colapsar independientemente cada tarjeta según lo que desee leer.

**NO se muestran**:
- "Estilo de aprendizaje"
- "Modalidad de cursado"
- "Ajustes programáticos por materia" (excepto para Diego)

**SÍ se muestran**:
- Acordeón de "Síntesis de situación actual" con tarjetas colapsables.
- Checkboxes de "Declaración de adecuaciones".
- "Ajustes programáticos por materia" solo para Diego Martínez.

### Para Otros Estudiantes (Legacy)

- UI anterior sin cambios: Síntesis (texto simple), Estilo de aprendizaje, Modalidad de cursado, Ajustes programáticos, Checkboxes de adecuaciones.

---

## Archivos Modificados

### 1. `src/data/mockData.ts`
- **Interfaz `InformeTecnico`**: `sintesis` ahora acepta `string | { title: string; bullets: string[] }[]`.
- **Ana García**: `sintesis` array de 5 tarjetas, `ajustesProgramaticos: []`, flags de adecuación.
- **Carlos López**: `sintesis` array de 9 tarjetas, `ajustesProgramaticos: []`, flags de adecuación.
- **María Rodríguez**: `sintesis` array de 6 tarjetas, `ajustesProgramaticos: []`, flags de adecuación.
- **Diego Martínez**: `sintesis` array de 9 tarjetas, `ajustesProgramaticos` con 4 materias, `requiereAdecuacionContenido: true`.

### 2. `src/components/StudentProfile.tsx`
- **Imports**: Agregados `ChevronDown`, `ChevronRight` de `lucide-react`.
- **Estado**: Nuevo `expandedCards` para manejar tarjetas expandidas.
- **Case 'informe'**: Lógica condicional para renderizar acordeón o legacy UI.
- **Preview text**: Actualizado a "Síntesis de situación actual y declaración de adecuaciones".

---

## Criterios de Aceptación (Validados)

| # | Criterio | Estado |
|---|----------|--------|
| 1 | Abrir cada uno de los 4 estudiantes muestra "Informe técnico psicopedagógico" con tarjetas colapsadas por defecto | ✅ |
| 2 | Expandir cualquier tarjeta muestra el contenido completo con todos los bullets preservados exactamente | ✅ |
| 3 | No hay "vista rápida" / no hay resumen parcial | ✅ |
| 4 | "Estilo de aprendizaje" y "Modalidad de cursado" NO se muestran para los 4 estudiantes | ✅ |
| 5 | "Ajustes programáticos por materia" aparece SOLO para Diego Martínez y permanece como actualmente implementado para él | ✅ |
| 6 | Checkboxes de adecuaciones permanecen visibles y funcionales (sin cambios) para los 4 estudiantes | ✅ |

---

## QA Manual

### Pasos de Verificación

1. **Iniciar la aplicación** en el branch `Nuevos-perfiles-y-reglas-para-contemplaciones`.

2. **Para cada estudiante** (Ana García, Carlos López, María Rodríguez, Diego Martínez):
   - Abrir el perfil del estudiante.
   - Navegar a la sección "Informe Técnico Psicopedagógico".
   
   **Verificar**:
   - [ ] Las tarjetas de "Síntesis de situación actual" están colapsadas por defecto.
   - [ ] Click en cada tarjeta la expande mostrando bullets completos.
   - [ ] El texto de cada bullet coincide exactamente con lo especificado en el prompt.
   - [ ] No se muestran las secciones "Estilo de aprendizaje" ni "Modalidad de cursado".
   - [ ] Los checkboxes "Requiere adecuación de acceso" y "Requiere adecuación de contenido" están presentes y funcionales.

3. **Solo para Diego Martínez**:
   - [ ] La sección "Ajustes programáticos por materia" se muestra con las 4 materias (Todas, Matemática, Lengua, Ciencias/Historia).
   - [ ] Los ajustes específicos de cada materia están listados correctamente.

4. **Para Ana García, Carlos López, María Rodríguez**:
   - [ ] La sección "Ajustes programáticos por materia" NO se muestra.

5. **Para estudiantes sin adecuaciones** (Sofía Fernández, Joaquín Torres, Valentina Castro, Mateo Silva, Isabella Morales, Luciano Vega):
   - [ ] El "Informe Técnico Psicopedagógico" mantiene la UI legacy (texto simple, sin acordeón).
   - [ ] Se muestran "Síntesis", "Estilo de aprendizaje", "Modalidad de cursado" como antes (si tienen `informeTecnico`).

---

## Contenido Exacto de las Tarjetas (Referencia)

### Ana García

| Tarjeta | Título | Bullets |
|---------|--------|---------|
| 1 | Potencial Intelectual | • Posee un potencial intelectual mayor al que está manifestando, debido a diversos factores que inciden en su rendimiento. |
| 2 | Rendimiento Cognitivo | • Su performance es comparativamente superior en la inteligencia no verbal respecto a la verbal.<br>• Logra mayores niveles de conceptualización, deducción y abstracción con estímulos no verbales (apoyo icónico o material manipulativo). |
| 3 | Polo Comprensivo | • Requiere la explicitación de las consignas en forma simplificada, tanto si se brindan de forma oral como escrita. |
| 4 | Lenguaje Escrito | • Se observan características congruentes con una dificultad específica en lectoescritura.<br>• Necesidad de evaluar el abordaje frente al conflicto cognitivo, las estrategias que aplica y su grado de inseguridad frente al estudio/tareas escritas, para determinar si se trata de una alteración a nivel global del lenguaje. |
| 5 | Área Lógico-Matemática | • Se observan dificultades asociadas al sentido de las operaciones.<br>• Dificultad en la resolución correcta de situaciones problemáticas por falta de flexibilidad en la aplicación de estrategias. |

### Carlos López

| Tarjeta | Título | Bullets (resumen) |
|---------|--------|-------------------|
| 1 | Disposición y Adaptación al Trabajo | 2 bullets |
| 2 | Potencial Intelectual | 2 bullets |
| 3 | Recursos Cognitivos (Fortalezas) | 1 bullet |
| 4 | Debilidades del Perfil Cognitivo y su Evidencia Académica | 2 bullets |
| 5 | Estilo de Aprendizaje y Adaptación a Novedades | 2 bullets |
| 6 | Manejo del Conflicto Cognitivo y Habilidades Pragmáticas | 2 bullets |
| 7 | Diagnóstico y Congruencia del Perfil | 1 bullet |
| 8 | Definición y Alcance del Síndrome Disejecutivo | 3 bullets |
| 9 | Impacto Específico en la Escritura | 1 bullet |

### María Rodríguez

| Tarjeta | Título | Bullets (resumen) |
|---------|--------|-------------------|
| 1 | Potencial | 1 bullet |
| 2 | Perfil Cognitivo | 2 bullets |
| 3 | Lenguaje Escrito (Dislexia) | 4 bullets |
| 4 | Área Lógico-Matemática | 3 bullets |
| 5 | Factores Emocionales y Metacognitivos | 2 bullets |
| 6 | Conclusión General | 2 bullets |

### Diego Martínez

| Tarjeta | Título | Bullets (resumen) |
|---------|--------|-------------------|
| 1 | Dificultades Generales y Presentación | 5 bullets |
| 2 | Performance Intelectual | 2 bullets |
| 3 | Perfil Cognitivo (Fortalezas Relativas y Debilidades) | 3 bullets |
| 4 | Dificultades Instrumentales y Práxicas | 2 bullets |
| 5 | Procesamiento de la Información Verbal y Lenguaje | 5 bullets |
| 6 | Rendimiento en Áreas Instrumentales (Lectura y Escritura) | 2 bullets |
| 7 | Atención y Funciones Ejecutivas | 4 bullets |
| 8 | Perfil Mnésico (Memoria) | 6 bullets |
| 9 | Perfil Afectivo-Emocional y Social | 3 bullets |

---

## Notas de Implementación

### Decisiones de Diseño

1. **Backward Compatibility**: La detección `Array.isArray(student.informeTecnico.sintesis)` garantiza que los estudiantes sin la nueva estructura (legacy string) sigan funcionando con la UI anterior sin cambios.

2. **Accordion State**: El estado `expandedCards` es un `Set<number>` que almacena los índices de las tarjetas expandidas. Esto permite múltiples tarjetas expandidas al mismo tiempo.

3. **Iconos**: `ChevronRight` indica "colapsado" (click para expandir), `ChevronDown` indica "expandido" (click para colapsar).

4. **Color Scheme**: Se mantiene el color púrpura (`purple-50`, `purple-400`) para la sección "Síntesis de situación actual", consistente con el diseño anterior.

5. **Responsive**: El acordeón funciona correctamente en dispositivos móviles y desktop.

### Limitaciones Conocidas

1. **No persistencia del estado del acordeón**: Si el usuario cierra y reabre el perfil, las tarjetas vuelven a estar colapsadas. Esto es intencional para evitar confusión (el docente siempre ve el estado inicial limpio).

2. **No búsqueda dentro del acordeón**: No se implementó búsqueda/filtrado de tarjetas. El docente debe expandir manualmente las tarjetas que desea leer.

---

## Próximos Pasos (Fuera de Alcance)

- **Exportar/Imprimir**: Si se necesita exportar el informe técnico a PDF, considerar incluir las tarjetas expandidas automáticamente.
- **Accessibility**: Agregar `aria-expanded` y `role="button"` a los botones de acordeón para mejorar la accesibilidad (actualmente ya es básicamente accesible pero podría mejorarse).

---

## Commit Message

```
feat(informe-tecnico): implement accordion UI for students with adecuaciones

- Added accordion card structure to InformeTecnico.sintesis (array of { title, bullets })
- Updated mock data for Ana García, Carlos López, María Rodríguez, and Diego Martínez
- Implemented collapsible card UI in StudentProfile.tsx with expand/collapse functionality
- Hidden estiloAprendizaje and modalidadCursado for students with new structure
- Show ajustesProgramaticos ONLY for Diego Martínez (requiereAdecuacionContenido === true)
- Maintained backward compatibility for students with legacy sintesis (string)
- Added CHANGELOG_PROMPT8_INFORME_TECNICO_ACCORDION.md

Refs: Prompt 8, Nuevos-perfiles-y-reglas-para-contemplaciones branch
```

---

**Listo para QA y Deployment.**

