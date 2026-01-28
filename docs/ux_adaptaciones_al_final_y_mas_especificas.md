# UX Fix: Diferenciación/Adaptaciones al Final y Más Específicas

## Resumen

Se actualizó la generación y renderizado de planes de clase para que la sección "Diferenciación/Adaptaciones" siempre aparezca al final del plan (después de Cierre) y contenga información más específica y estructurada sobre cuándo, para quién, por qué y cómo aplicar cada adaptación.

## Archivos Modificados

1. `supabase/functions/generate-plan-completo/index.ts` - Prompts de IA para generación/regeneración de planes
2. `src/components/planificacion/EditorSesionTabs.tsx` - Prompt de IA para modificaciones de planes existentes

## Cambios Realizados

### 1. Actualización de Prompts de IA

#### Cambio en `generate-plan-completo/index.ts`

**Antes:**
El ejemplo del prompt mostraba "Diferenciación/Adaptaciones" dentro de la sección "Inicio":
```html
<h2><strong>Inicio (15 min)</strong></h2>
...
<p><strong>Diferenciación/Adaptaciones:</strong></p>
<ul>
  <li>Adaptación para perfil visual</li>
  <li>Adaptación para perfil auditivo</li>
</ul>
```

**Después:**
- Se eliminó "Diferenciación/Adaptaciones" de las secciones Inicio, Desarrollo y Cierre
- Se agregó una sección separada al final, después de Cierre
- Se estructuró cada adaptación con 4 campos obligatorios:
  - `Momento`: Cuándo aplicar (Inicio/Desarrollo/Cierre + actividad específica)
  - `Perfil/Necesidad`: Para qué perfil de estudiante o necesidad está dirigida
  - `Propósito`: Qué mejora o facilita esta adaptación
  - `Cómo aplicarla`: Instrucciones concretas y prácticas

**Ejemplo nuevo:**
```html
<h2><strong>Cierre (5 min)</strong></h2>
...

<h2><strong>Diferenciación/Adaptaciones</strong></h2>
<ul>
  <li><strong>Momento:</strong> Inicio - durante la actividad de apertura<br>
      <strong>Perfil/Necesidad:</strong> Estudiantes con dificultades de atención<br>
      <strong>Propósito:</strong> Facilitar la participación activa desde el inicio de la clase<br>
      <strong>Cómo aplicarla:</strong> Proporcionar apoyos visuales (imágenes claras) y permitir respuestas orales además de escritas</li>
  <li><strong>Momento:</strong> Desarrollo - durante el trabajo grupal<br>
      <strong>Perfil/Necesidad:</strong> Estudiantes con necesidades de adaptación curricular<br>
      <strong>Propósito:</strong> Garantizar acceso al contenido principal<br>
      <strong>Cómo aplicarla:</strong> Organizar grupos heterogéneos, asignar roles claros y proporcionar guías paso a paso con ejemplos</li>
</ul>
```

**Requisitos actualizados:**
- Se agregó: "NUNCA incluir 'Diferenciación/Adaptaciones' dentro de las secciones Inicio, Desarrollo o Cierre"
- Se agregó: "La sección 'Diferenciación/Adaptaciones' DEBE aparecer DESPUÉS de Cierre, al final del plan"
- Se especificó que cada adaptación debe incluir los 4 campos: Momento, Perfil/Necesidad, Propósito, Cómo aplicarla

#### Cambio en `EditorSesionTabs.tsx`

**Mismo cambio**: Se actualizó el ejemplo del prompt y los requisitos para que coincidan con el formato nuevo.

### 2. Compatibilidad con Código Existente

#### Parser (`src/lib/planParser.ts`)
- **Ya funciona correctamente**: El parser ya tenía la funcionalidad de extraer "Diferenciación/Adaptaciones" desde dentro de secciones usando `hoistInlineDiferenciacion()`
- **Backward compatibility**: Si un plan antiguo tiene adaptaciones dentro de Inicio/Desarrollo/Cierre, el parser las extrae automáticamente y las mueve a la sección `diferenciacion` separada
- **No se requieren cambios**: El parser ya detecta la sección "Diferenciación/Adaptaciones" como un H2 separado y la procesa correctamente

#### Renderizador (`EditorSesionNuevo.tsx`)
- **Ya funciona correctamente**: El renderizador ya muestra "Diferenciación/Adaptaciones" al final, después de Cierre
- **No se requieren cambios**: El HTML estructurado con moment/target/purpose/how se renderiza correctamente con `dangerouslySetInnerHTML` y las clases de estilo existentes (`prose prose-sm`)

## Comportamiento Antes vs Después

### Antes

- ⚠️ Las adaptaciones aparecían dentro de las secciones (especialmente Inicio)
- ⚠️ Las adaptaciones eran vagas: "Adaptación para perfil visual" sin detalles
- ⚠️ No especificaba cuándo aplicar cada adaptación
- ⚠️ No explicaba el propósito o cómo aplicarla concretamente

**Ejemplo anterior:**
```
Inicio (15 min)
- Actividad: ...
- Recursos: ...
- Diferenciación/Adaptaciones:
  - Visual: Imágenes claras
  - Auditivo: Lectura en voz alta
```

### Después

- ✅ Las adaptaciones siempre aparecen al final, después de Cierre
- ✅ Cada adaptación especifica:
  - **Cuándo**: "Inicio - durante la actividad de apertura"
  - **Para quién**: "Estudiantes con dificultades de atención"
  - **Por qué**: "Facilitar la participación activa desde el inicio"
  - **Cómo**: "Proporcionar apoyos visuales (imágenes claras) y permitir respuestas orales además de escritas"
- ✅ Las instrucciones son concretas y aplicables, no vagas

**Ejemplo nuevo:**
```
Inicio (15 min)
- Actividad: ...
- Recursos: ...
(sin adaptaciones aquí)

Desarrollo (40 min)
...

Cierre (5 min)
...

Diferenciación/Adaptaciones:
- Momento: Inicio - durante la actividad de apertura
  Perfil/Necesidad: Estudiantes con dificultades de atención
  Propósito: Facilitar la participación activa desde el inicio
  Cómo aplicarla: Proporcionar apoyos visuales (imágenes claras) y permitir respuestas orales además de escritas
```

## Compatibilidad Hacia Atrás

### Planes Existentes

Los planes guardados anteriormente que tienen adaptaciones dentro de las secciones seguirán funcionando correctamente porque:

1. **El parser extrae automáticamente**: La función `hoistInlineDiferenciacion()` en `planParser.ts` busca bloques de "Diferenciación/Adaptaciones" dentro de Inicio/Desarrollo/Cierre y los extrae
2. **Se mueven al final**: Estas adaptaciones extraídas se agregan a la sección `diferenciacion` separada
3. **Se muestran correctamente**: El renderizador ya muestra la sección `diferenciacion` al final

### Estructura de Datos

- **No se requieren cambios en la base de datos**: La estructura de datos ya soporta `diferenciacion` como campo opcional separado
- **No se requieren migraciones**: El campo `diferenciacion` ya existe en el tipo `ParsedPlan`
- **Normalización en tiempo de ejecución**: Si un plan antiguo tiene adaptaciones embebidas, se normalizan cuando se parsea

## Ejemplo de Salida de IA

Con los nuevos prompts, la IA ahora generará planes con esta estructura:

```html
<section id="plan">
  <h1>Planificación de Clase</h1>

  <h2><strong>Inicio (15 min)</strong></h2>
  <h3>Actividad de apertura motivadora</h3>
  <p><strong>Actividad:</strong> "Escalera del tiempo: ¿Cómo habría sido tu vida en el 900?"</p>
  <ul>
    <li>Presenta imágenes representativas del 900.</li>
    <li>Formula la pregunta guía: <em>"Si hubieras nacido en el 900…"</em></li>
    <li>Los estudiantes escriben en 5 líneas su respuesta.</li>
  </ul>
  <p><strong>Recursos:</strong> proyector, láminas impresas.</p>

  <h2><strong>Desarrollo (100 min)</strong></h2>
  <h3>Parte A – Mapa Mental Colaborativo</h3>
  ...

  <h2><strong>Cierre (5 min)</strong></h2>
  ...

  <h2><strong>Diferenciación/Adaptaciones</strong></h2>
  <ul>
    <li><strong>Momento:</strong> Inicio - durante la actividad de apertura<br>
        <strong>Perfil/Necesidad:</strong> Estudiantes con dificultades de atención<br>
        <strong>Propósito:</strong> Facilitar la participación activa desde el inicio de la clase<br>
        <strong>Cómo aplicarla:</strong> Proporcionar apoyos visuales (imágenes claras y coloridas) y permitir respuestas orales además de escritas. Lectura en voz alta de testimonios para estudiantes con perfil auditivo.</li>
    <li><strong>Momento:</strong> Desarrollo - durante el trabajo grupal del mapa mental<br>
        <strong>Perfil/Necesidad:</strong> Estudiantes con necesidades de adaptación curricular<br>
        <strong>Propósito:</strong> Garantizar acceso al contenido principal mediante participación estructurada<br>
        <strong>Cómo aplicarla:</strong> Organizar grupos heterogéneos, asignar roles claros (facilitador, registrador, presentador) y proporcionar guías paso a paso con ejemplos concretos.</li>
  </ul>
</section>
```

## Checklist de Pruebas Manuales

### Generación de Nuevos Planes

1. **Generar un plan nuevo**
   - Navegar a crear/editar una sesión de clase
   - Solicitar generación de plan con IA
   - **Resultado esperado**: 
     - El plan muestra Inicio, Desarrollo, Cierre en orden
     - "Diferenciación/Adaptaciones" aparece al final, después de Cierre
     - Cada adaptación incluye los 4 campos: Momento, Perfil/Necesidad, Propósito, Cómo aplicarla

2. **Verificar que no hay adaptaciones dentro de secciones**
   - Revisar el contenido de Inicio, Desarrollo y Cierre
   - **Resultado esperado**: No aparece ningún bloque "Diferenciación/Adaptaciones" dentro de estas secciones

3. **Verificar estructura de adaptaciones**
   - Revisar la sección "Diferenciación/Adaptaciones" al final
   - **Resultado esperado**: 
     - Cada ítem de adaptación tiene formato estructurado
     - Incluye momento específico (ej: "Inicio - durante la actividad de apertura")
     - Incluye perfil/necesidad específica
     - Incluye propósito claro
     - Incluye instrucciones concretas de aplicación

### Regeneración/Modificación de Planes

4. **Solicitar modificaciones a un plan existente**
   - Abrir un plan existente
   - Solicitar cambios con IA (ej: "hacer más dinámico")
   - **Resultado esperado**: 
     - El plan regenerado mantiene la estructura correcta
     - Las adaptaciones siguen al final

5. **Modificar solo adaptaciones**
   - Solicitar cambios específicos a adaptaciones (ej: "agregar adaptación para estudiantes con dislexia")
   - **Resultado esperado**: 
     - La nueva adaptación aparece al final
     - Incluye todos los campos requeridos

### Compatibilidad con Planes Antiguos

6. **Abrir un plan guardado anteriormente**
   - Abrir un plan que fue guardado antes de este cambio
   - Si tenía adaptaciones dentro de Inicio/Desarrollo/Cierre
   - **Resultado esperado**: 
     - Las adaptaciones se muestran al final (extraídas automáticamente por el parser)
     - No aparecen duplicadas dentro de las secciones

7. **Verificar renderizado de PDF**
   - Generar PDF de un plan con adaptaciones estructuradas
   - **Resultado esperado**: 
     - Las adaptaciones aparecen al final en el PDF
     - El formato estructurado se mantiene legible

### Validación de Contenido

8. **Verificar que las adaptaciones son específicas**
   - Revisar varias adaptaciones generadas
   - **Resultado esperado**: 
     - No son vagas (ej: "Adaptación visual")
     - Especifican momento concreto (ej: "Desarrollo - durante el trabajo grupal")
     - Incluyen instrucciones aplicables (ej: "Organizar grupos heterogéneos, asignar roles claros")

9. **Verificar que hay adaptaciones para diferentes momentos**
   - Si el plan tiene actividades en Inicio, Desarrollo y Cierre
   - **Resultado esperado**: 
     - Hay adaptaciones que mencionan momentos diferentes (no todas para el mismo momento)

## Notas Técnicas

- **No se modificó el esquema de base de datos**: Los cambios son solo en los prompts de IA y en cómo se estructura el HTML generado
- **El parser ya soportaba esto**: La función `hoistInlineDiferenciacion()` ya extraía adaptaciones de dentro de secciones
- **El renderizador ya mostraba diferenciacion al final**: No se requirieron cambios en el renderizador
- **Backward compatible**: Los planes antiguos se normalizan automáticamente al parsearse

## Observaciones

- Los cambios son **minimalistas y de bajo riesgo**: Solo se modificaron los prompts de IA, no la lógica de parsing o renderizado
- **Mejora la UX**: Las adaptaciones ahora son más útiles porque especifican cuándo, para quién, por qué y cómo aplicarlas
- **Mantiene compatibilidad**: Los planes existentes siguen funcionando correctamente gracias a la normalización automática del parser





















