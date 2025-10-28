# VERIFICACIÓN: Competencias de "Educación para la Ciudadanía" No Cargan en Wizard

**RUN_ID:** `planificacion-ciudadania_2025-10-28_verification`  
**Fecha:** 28 de octubre de 2025  
**Tipo:** Root Cause Analysis + Fix Design  
**Alcance:** Planning Wizard - Paso 2 - Panel "Competencias Específicas"

---

## ESTADO: ⚠️ **FIX INCOMPLETO - ARCHIVO INCORRECTO EDITADO**

---

## 1. CAUSA RAÍZ IDENTIFICADA

### Hallazgo Principal

**El archivo editado anteriormente (`CompetenceSelector.tsx`) NO es usado por el Planning Wizard.**

El wizard usa un componente completamente diferente: **`BibliotecaElementos.tsx`**

### Flujo de Componentes Real

```
PlanificacionWizard.tsx (línea 467-469)
  └─> WizardSteps.tsx - renderPaso2() (línea 467)
      └─> UnidadDidacticaBuilder.tsx (línea 75-77)
          └─> BibliotecaElementos.tsx (línea 38-47) ← AQUÍ ESTÁ EL BUG
```

### Evidencia del Código

#### Archivo: `src/components/planificacion/WizardSteps.tsx`

**Línea 91:** Dropdown de selección de materia:
```tsx
<SelectItem value="Educación para la Ciudadanía">Educación para la Ciudadanía</SelectItem>
```
👆 El usuario selecciona **"Educación para la Ciudadanía"**

**Línea 467:** Paso 2 pasa este valor a `UnidadDidacticaBuilder`:
```tsx
<UnidadDidacticaBuilder
  materia={wizardData.contexto.materia as Materia}
  // wizardData.contexto.materia = "Educación para la Ciudadanía"
```

#### Archivo: `src/components/planificacion/UnidadDidacticaBuilder.tsx`

**Línea 75-77:** Pasa `materia` a `BibliotecaElementos`:
```tsx
<BibliotecaElementos
  materia={materia}  // "Educación para la Ciudadanía"
  contenidosUsados={unidades.map(u => u.contenido_id)}
  onSeleccionarContenido={onSeleccionarContenido}
/>
```

#### Archivo: `src/components/planificacion/BibliotecaElementos.tsx` ⚠️ **ARCHIVO CON BUG**

**Línea 17:** Interfaz define `materia` como tipo `Materia`:
```tsx
interface BibliotecaElementosProps {
  materia: Materia;  // Type from catalogo.ts
  // ...
}
```

**Línea 38-47:** Switch-case para mapear materia → competencias:
```tsx
const competencias = React.useMemo(() => {
  switch (materia) {
    case 'Historia':
      return COMPETENCIAS_HISTORIA;
    case 'Literatura':
      return COMPETENCIAS_LITERATURA;
    case 'Formación para la ciudadanía':  // ← Solo acepta este string
      return COMPETENCIAS_CIUDADANIA;
    default:
      return [];  // ← "Educación para la Ciudadanía" cae aquí
  }
}, [materia]);
```

### El Problema en Detalle

| Paso | Valor de `materia` | Resultado |
|------|-------------------|-----------|
| 1. Dropdown (WizardSteps.tsx L91) | `"Educación para la Ciudadanía"` | Valor almacenado en wizard state |
| 2. Cast a tipo `Materia` (WizardSteps.tsx L467) | `"Educación para la Ciudadanía" as Materia` | ⚠️ Cast forzado - TypeScript no valida en runtime |
| 3. Switch-case (BibliotecaElementos.tsx L38-47) | Compara con `'Formación para la ciudadanía'` | ❌ **NO MATCH** → `default: return []` |
| 4. Renderizado | Array vacío `[]` | 🔴 Panel "Competencias Específicas" aparece vacío |

---

## 2. EVIDENCIA DETALLADA POR VERIFICACIÓN

### 2.1 Component Wiring ✅ VERIFICADO

**Pregunta:** ¿El wizard renderiza el componente correcto?

**Respuesta:** SÍ, pero NO es `CompetenceSelector.tsx`.

- **Archivo correcto:** `src/components/planificacion/BibliotecaElementos.tsx`
- **Import path:**
  ```
  PlanificacionWizard.tsx (línea 9)
    └─> import { WizardSteps } from '@/components/planificacion/WizardSteps'
        └─> (línea 17) import { UnidadDidacticaBuilder } from './UnidadDidacticaBuilder'
            └─> (línea 7) import { BibliotecaElementos } from './BibliotecaElementos'
  ```
- **No hay duplicados:** Solo 1 archivo `BibliotecaElementos.tsx` en el proyecto

### 2.2 Valor Runtime de `materia` ✅ IDENTIFICADO

**Pregunta:** ¿Qué valor exacto recibe `BibliotecaElementos` en runtime?

**Respuesta:** `"Educación para la Ciudadanía"` (string sin normalizar)

**Evidencia:**

1. **Dropdown value (línea 91 WizardSteps.tsx):**
   ```tsx
   <SelectItem value="Educación para la Ciudadanía">
     Educación para la Ciudadanía
   </SelectItem>
   ```

2. **Sin transformación:** No hay mapeo/normalización entre el dropdown y `BibliotecaElementos`

3. **Type cast (línea 467 WizardSteps.tsx):**
   ```tsx
   materia={wizardData.contexto.materia as Materia}
   ```
   - El `as Materia` es un **type assertion de TypeScript** - solo afecta compile time
   - En runtime, el valor sigue siendo `"Educación para la Ciudadanía"` sin cambios

4. **Tipo `Materia` esperado (catalogo.ts línea 4):**
   ```tsx
   export type Materia = "Literatura" | "Formación para la ciudadanía" | "Historia";
   ```
   - ❌ `"Educación para la Ciudadanía"` NO está en este union type
   - ⚠️ TypeScript no detecta esto porque hay un `as Materia` cast forzado

### 2.3 Lógica de Mapping ❌ BUG CONFIRMADO

**Pregunta:** ¿La lista de competencias usa el switch correcto?

**Respuesta:** SÍ usa el switch, pero el switch NO tiene caso para `"Educación para la Ciudadanía"`

**Código problemático (BibliotecaElementos.tsx líneas 38-47):**
```tsx
const competencias = React.useMemo(() => {
  switch (materia) {
    case 'Historia':                        // ✅ Match
      return COMPETENCIAS_HISTORIA;
    case 'Literatura':                      // ✅ Match
      return COMPETENCIAS_LITERATURA;
    case 'Formación para la ciudadanía':    // ❌ NO match con "Educación..."
      return COMPETENCIAS_CIUDADANIA;
    default:
      return [];  // ← "Educación para la Ciudadanía" cae AQUÍ
  }
}, [materia]);
```

**Por qué falla:**
- JavaScript compara strings con `===` (exact match)
- `"Educación para la Ciudadanía" !== "Formación para la ciudadanía"`
- Diferencias: mayúsculas, palabras diferentes ("Educación" vs "Formación")

### 2.4 Disponibilidad de Datos ✅ VERIFICADO

**Pregunta:** ¿Los datos de Ciudadanía existen y están bien importados?

**Respuesta:** SÍ, todo correcto.

**Evidencia:**

1. **Import (BibliotecaElementos.tsx línea 14):**
   ```tsx
   import { COMPETENCIAS_CIUDADANIA } from '@/data/competenciasCiudadania';
   ```
   ✅ Import correcto y no tree-shaken (usado en switch)

2. **Estructura de datos (competenciasCiudadania.ts):**
   ```tsx
   export const COMPETENCIAS_CIUDADANIA: CompetenciaEspecificaCiudadania[] = [
     // 7 competencias con estructura idéntica a Historia/Literatura
     { id: 'CIU-C1', codigo: 'C1', nombre: '...', criteriosLogro: [...] },
     // ...
   ];
   ```
   ✅ 7 competencias con la misma shape que Historia/Literatura

3. **Path alias:** `@/data` resuelve a `src/data` (vite.config.ts)
   ✅ Resolución correcta

### 2.5 Condicional Rendering ✅ SIN GATING

**Pregunta:** ¿Hay guards que oculten el panel aunque la lista no esté vacía?

**Respuesta:** NO, el problema es que la lista SÍ está vacía (`[]`)

**Evidencia (BibliotecaElementos.tsx líneas 127-149):**
```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2 text-base">
      <Target className="h-4 w-4" />
      Competencias Específicas
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-3 max-h-80 overflow-y-auto">
    {competencias.map((competencia) => (  // ← competencias = []
      // ... render de cada competencia
    ))}
  </CardContent>
</Card>
```

- **No hay `if` statements** que oculten el Card
- El Card se renderiza SIEMPRE
- El `.map([])` simplemente no itera porque el array está vacío
- **Resultado visual:** Card con título "Competencias Específicas" pero cuerpo vacío

### 2.6 Estado de `materia` ✅ VERIFICADO

**Pregunta:** ¿El valor de `materia` se normaliza/resetea antes de llegar a `BibliotecaElementos`?

**Respuesta:** NO, se pasa sin transformación.

**Trace del estado:**

1. **Origen (WizardSteps.tsx línea 82-84):**
   ```tsx
   <Select
     value={wizardData.contexto?.materia || ''}
     onValueChange={(value) => 
       onUpdateContexto({ ...wizardData.contexto, materia: value })
     }
   ```
   - `value` desde dropdown = `"Educación para la Ciudadanía"`
   - Se almacena directamente sin transformación

2. **Propagación (WizardSteps.tsx línea 467):**
   ```tsx
   <UnidadDidacticaBuilder
     materia={wizardData.contexto.materia as Materia}
   ```
   - Se pasa el valor raw con type assertion

3. **Llegada (BibliotecaElementos.tsx línea 22-24):**
   ```tsx
   export const BibliotecaElementos: React.FC<BibliotecaElementosProps> = ({
     materia,  // Recibe "Educación para la Ciudadanía" sin cambios
   ```

**No hay middleware que normalice el valor.**

### 2.7 Build/HMR Issues ✅ DESCARTADO

**Pregunta:** ¿Podría ser un problema de build/cache?

**Respuesta:** NO, es un bug lógico en código.

**Evidencia:**
- El build anterior pasó correctamente (4.51s, sin errores TS)
- TypeScript no detecta el bug porque hay un `as Materia` cast
- El problema es puramente de runtime string comparison

---

## 3. RESUMEN DE LA CAUSA RAÍZ

### El Bug Real

**Archivo:** `src/components/planificacion/BibliotecaElementos.tsx` (líneas 38-47)

**Problema:** Switch-case solo acepta `"Formación para la ciudadanía"`, pero el dropdown envía `"Educación para la Ciudadanía"`.

**Por qué no se detectó antes:**

1. **TypeScript weakness:** El `as Materia` cast oculta la inconsistencia
2. **Archivo equivocado editado:** `CompetenceSelector.tsx` es usado por `/evaluaciones`, NO por el wizard
3. **Misma data, diferente componente:** Ambos componentes importan los mismos datos de Ciudadanía, pero con lógica de mapping diferente

### Archivo Editado Anteriormente (Innecesario)

El commit `0d5aba1` modificó **`CompetenceSelector.tsx`**, pero este archivo solo se usa en:
- `/evaluaciones` (Evaluaciones page)
- NO se usa en `/planificacion/nuevo` (Planning Wizard)

**Resultado del commit anterior:** ✅ Arregla `/evaluaciones`, ❌ NO afecta al wizard

---

## 4. DISEÑO DEL FIX MÍNIMO (Sin Código)

### Opción 1: Agregar Caso al Switch (Recomendada) ⭐

**Archivo a editar:** `src/components/planificacion/BibliotecaElementos.tsx`

**Líneas a modificar:** 38-47 (switch-case)

**Cambio propuesto:**

Extender el switch para aceptar AMBAS variantes del label:
- `"Formación para la ciudadanía"` (valor del tipo `Materia`)
- `"Educación para la Ciudadanía"` (valor del dropdown del wizard)

Agregar un nuevo `case` antes del `default` que maneje la variante "Educación para la Ciudadanía" y retorne `COMPETENCIAS_CIUDADANIA`.

**Por qué esta opción:**
- ✅ Cambio quirúrgico (1 archivo, 2 líneas)
- ✅ Backward compatible (ambas variantes siguen funcionando)
- ✅ No rompe `/evaluaciones` ni otros consumidores
- ✅ Consistente con el fix en `CompetenceSelector.tsx` (commit 0d5aba1)
- ✅ Blast radius mínimo

**Riesgos:**
- ⚠️ Bajo: Mantiene inconsistencia de labels (pero ya existe en el sistema)

### Opción 2: Normalizar en `WizardSteps.tsx`

**Archivo a editar:** `src/components/planificacion/WizardSteps.tsx`

**Línea a modificar:** 467 (donde se pasa `materia` a `UnidadDidacticaBuilder`)

**Cambio propuesto:**

Agregar una función mapper que traduzca `"Educación para la Ciudadanía"` → `"Formación para la ciudadanía"` antes de pasar el valor a `UnidadDidacticaBuilder`.

**Por qué esta opción:**
- ✅ Centraliza la normalización en un solo lugar
- ✅ BibliotecaElementos solo necesita manejar el valor canónico
- ✅ Más correcto desde perspectiva de arquitectura

**Riesgos:**
- ⚠️ Medio: Requiere testing de todos los consumers de `wizardData.contexto.materia`
- ⚠️ Medio: Si hay otros componentes que esperan "Educación...", se rompen

### Opción 3: Cambiar Dropdown a Valor Canónico

**Archivo a editar:** `src/components/planificacion/WizardSteps.tsx`

**Línea a modificar:** 91 (`<SelectItem>`)

**Cambio propuesto:**

Cambiar el `value` del dropdown de `"Educación para la Ciudadanía"` a `"Formación para la ciudadanía"`, pero mantener el label visual.

```tsx
<SelectItem value="Formación para la ciudadanía">
  Educación para la Ciudadanía  {/* Label visual sin cambios */}
</SelectItem>
```

**Por qué esta opción:**
- ✅ Fix estructural más correcto
- ✅ Alinea UI con tipo `Materia` del sistema
- ✅ No requiere cambios en BibliotecaElementos

**Riesgos:**
- ⚠️ Alto: Rompe planes existentes en DB con `materia: "Educación para la Ciudadanía"`
- ⚠️ Alto: Requiere migración de datos
- ⚠️ Alto: Afecta múltiples componentes que leen `wizardData.contexto.materia`

### Recomendación: **OPCIÓN 1**

**Justificación:**
- Menor blast radius (solo 1 componente)
- No requiere migración de datos
- Consistente con fix previo en `CompetenceSelector.tsx`
- Rápido de implementar y verificar

**Trade-off aceptado:**
- Mantiene la inconsistencia de labels, pero es una deuda técnica existente
- Si en el futuro se agregan más materias, considerar refactor centralizado (Opción 2)

---

## 5. CHECKLIST DE VERIFICACIÓN MANUAL (5 Pasos)

### Pre-requisitos
- Build exitoso del fix
- Dev server corriendo en `http://localhost:8080`
- Navegador con DevTools abierto (Console tab)

### Test Case 1: Ciudadanía Competencias Loading ✅

**Pasos:**
1. Navegar a `/planificacion/nuevo`
2. **Paso 0:** Seleccionar:
   - Grupo: cualquiera
   - Materia: **"Educación para la Ciudadanía"**
   - Tipo: "Período Específico"
   - Fechas: cualquier rango de 2 semanas
3. Click "Siguiente"
4. **Paso 1:** Configurar horario (ej: Lunes 8:00-9:30, 90min)
5. Click "Siguiente"
6. **Paso 2:** Inspeccionar el panel **"Competencias Específicas"** (lado derecho)

**Resultado Esperado:**
- ✅ Panel muestra **7 competencias de Ciudadanía**:
  - C1: Participación ciudadana
  - C2: Identidad y diversidad
  - C3: Derechos y responsabilidades
  - C4: Pensamiento crítico
  - C5: Resolución de conflictos
  - C6: Cultura democrática
  - C7: Compromiso social
- ✅ Cada competencia tiene badges con códigos de criterios (C1.1, C1.2, etc.)
- ✅ Panel NO está vacío

**Resultado Antes del Fix:**
- ❌ Panel aparece vacío (solo título sin items)

### Test Case 2: ANEP Contents Loading (Regression) ✅

**Continuar desde TC1 Paso 2:**

**Acción:** Inspeccionar el panel **"Contenidos del Programa ANEP"** (lado izquierdo)

**Resultado Esperado:**
- ✅ Panel muestra capítulos colapsables de "Formación para la ciudadanía"
- ✅ Al expandir capítulos, muestra subtemas con botón "Usar"
- ✅ Contenidos correctos para la materia

**Nota:** Este panel ya funcionaba antes (usa `contenidosPorMateria()` que hace la traducción correcta)

### Test Case 3: Historia - No Regression ✅

**Pasos:**
1. Volver al Paso 0 (click "Anterior" 2 veces)
2. Cambiar Materia a **"Historia"**
3. Avanzar al Paso 2

**Resultado Esperado:**
- ✅ Panel "Competencias Específicas" muestra competencias de Historia
- ✅ Panel "Contenidos ANEP" muestra contenidos de Historia
- ✅ Sin errores en console

### Test Case 4: Literatura - No Regression ✅

**Pasos:**
1. Volver al Paso 0
2. Cambiar Materia a **"Literatura"**
3. Avanzar al Paso 2

**Resultado Esperado:**
- ✅ Panel "Competencias Específicas" muestra competencias de Literatura
- ✅ Panel "Contenidos ANEP" muestra contenidos de Literatura
- ✅ Sin errores en console

### Test Case 5: Cross-Page Consistency ✅

**Objetivo:** Verificar que `/evaluaciones` y wizard muestren las mismas competencias

**Pasos:**
1. Desde el wizard (Paso 2, materia Ciudadanía), tomar screenshot del panel "Competencias Específicas"
2. Navegar a `/evaluaciones`
3. Click "Nueva Evaluación"
4. Seleccionar:
   - Grupo: cualquiera
   - Materia: **"Educación para la Ciudadanía"**
5. En el paso de competencias, tomar screenshot

**Resultado Esperado:**
- ✅ Ambos screenshots muestran las **mismas 7 competencias**
- ✅ Mismos códigos (C1-C7)
- ✅ Mismos nombres y criterios

---

## 6. CRITERIOS DE ACEPTACIÓN

### Funcionales

- [ ] **F1:** Seleccionar "Educación para la Ciudadanía" en wizard Paso 0 → Paso 2 muestra 7 competencias
- [ ] **F2:** Las 7 competencias de Ciudadanía coinciden con las de `/evaluaciones`
- [ ] **F3:** Contenidos ANEP de Ciudadanía se muestran correctamente (sin regresión)
- [ ] **F4:** Historia y Literatura siguen funcionando (no hay regresión)

### Técnicos

- [ ] **T1:** Build de producción pasa sin errores TypeScript
- [ ] **T2:** No hay nuevos warnings en consola del navegador
- [ ] **T3:** El fix está en el archivo correcto (`BibliotecaElementos.tsx`)
- [ ] **T4:** Solo 1 archivo modificado (cambio quirúrgico)

### Arquitectura

- [ ] **A1:** El fix es backward compatible (no rompe código existente)
- [ ] **A2:** No requiere migración de datos en Supabase
- [ ] **A3:** La solución es consistente con el fix previo en `CompetenceSelector.tsx`

---

## 7. ARCHIVOS INVOLUCRADOS

### Archivo a Editar (FIX)

```
src/components/planificacion/BibliotecaElementos.tsx
  └─ Líneas 38-47: Switch-case de materia → competencias
```

### Archivos para Verificación (NO EDITAR)

```
src/components/planificacion/WizardSteps.tsx
  └─ Línea 91: Dropdown con valor "Educación para la Ciudadanía"
  └─ Línea 467: Pasa materia a UnidadDidacticaBuilder

src/components/planificacion/UnidadDidacticaBuilder.tsx
  └─ Línea 75-77: Pasa materia a BibliotecaElementos

src/data/catalogo.ts
  └─ Línea 4: Type Materia con valor canónico "Formación para la ciudadanía"

src/data/competenciasCiudadania.ts
  └─ Datos fuente correctos (7 competencias)
```

### Archivo Editado Previamente (INNECESARIO para Wizard)

```
src/components/planificacion/CompetenceSelector.tsx
  └─ Usado solo en /evaluaciones, NO en wizard
  └─ Commit 0d5aba1 ya lo arregló
```

---

## 8. PRÓXIMOS PASOS

1. **Implementar Opción 1:**
   - Editar `BibliotecaElementos.tsx` líneas 38-47
   - Agregar caso `case 'Educación para la Ciudadanía':` que retorne `COMPETENCIAS_CIUDADANIA`

2. **Verificar Build:**
   - `npm run build`
   - Confirmar 0 errores TypeScript

3. **Testing Manual:**
   - Ejecutar los 5 test cases del checklist
   - Tomar screenshots de before/after

4. **Commit:**
   - Mensaje: `fix(planificacion): mostrar competencias de Ciudadanía en BibliotecaElementos`
   - Body: Referenciar este documento de verificación

5. **Documentación:**
   - Actualizar este documento con resultados de testing
   - Crear implementation report

---

## 9. LECCIONES APRENDIDAS

### Por Qué el Fix Anterior No Funcionó

1. **Asunción incorrecta:** Se asumió que `CompetenceSelector` era usado por el wizard
2. **Falta de trace completo:** No se siguió el component tree desde `PlanificacionWizard` hasta el componente final
3. **Mismo nombre de datos, diferentes consumers:** Ambos componentes usan `COMPETENCIAS_CIUDADANIA`, pero con diferentes lógicas de routing

### Cómo Prevenir Esto en el Futuro

1. **Antes de editar:** Hacer `grep` para confirmar qué componente renderiza cada ruta
2. **Component trace:** Siempre seguir el árbol de imports desde la página raíz
3. **Testing cross-route:** Al arreglar un bug, verificar en TODAS las rutas que usan esa feature
4. **Type safety:** Considerar enum en lugar de string literals para evitar typos
5. **Centralizar mappers:** Si 2+ componentes hacen el mismo mapping, extraer a utility

---

## ANEXO A: Comparación de Componentes

| Aspecto | `CompetenceSelector.tsx` | `BibliotecaElementos.tsx` |
|---------|--------------------------|---------------------------|
| **Usado por** | `/evaluaciones` | `/planificacion/nuevo` |
| **Importado en** | `EvaluacionInteligente.tsx` | `UnidadDidacticaBuilder.tsx` |
| **Lógica de mapping** | Ternary chain (línea 36-43) | Switch-case (línea 38-47) |
| **Import Ciudadanía** | ✅ Agregado en commit 0d5aba1 | ✅ Ya existía (línea 14) |
| **Maneja ambos labels** | ✅ SÍ (después del fix) | ❌ NO (solo "Formación...") |
| **Status** | ✅ FIXED | 🔴 **NEEDS FIX** |

---

**FIN DEL REPORTE DE VERIFICACIÓN**
