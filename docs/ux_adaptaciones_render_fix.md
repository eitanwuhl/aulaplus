# UX Fix: Diferenciación/Adaptaciones Rendering Fix

## Resumen

Se implementó una normalización adicional a nivel de UI para garantizar que "Diferenciación/Adaptaciones" aparezca únicamente al final del plan de clase (después de Cierre), eliminando cualquier bloque de adaptaciones que pueda estar embebido dentro de las secciones Inicio/Desarrollo/Cierre, incluso si el parser inicial no lo detectó.

## Archivos Modificados

1. `src/components/planificacion/EditorSesionNuevo.tsx`

## Problema Identificado

Aunque el parser (`parsePlan`) ya tenía lógica para extraer adaptaciones desde dentro de secciones (`hoistInlineDiferenciacion`), algunos casos edge no eran capturados correctamente, resultando en que "Diferenciación/Adaptaciones" aparecía duplicada: tanto dentro de Inicio (o Desarrollo/Cierre) como al final del plan.

## Solución Implementada

Se agregó una función de normalización adicional (`extractDiferenciacionFromHtml`) que se ejecuta **después** del parsing inicial, como una capa defensiva que garantiza que cualquier contenido de "Diferenciación/Adaptaciones" restante en las secciones sea extraído y movido al campo `diferenciacion`.

### Función de Extracción

La función `extractDiferenciacionFromHtml` detecta y extrae adaptaciones usando tres patrones:

1. **Pattern 1**: H2 headings con "Diferenciación/Adaptaciones" seguido de contenido hasta el próximo H1/H2 o final
   - Regex: `/<h2[^>]*>[\s\S]*?(?:diferenciaci[oó]n(?:es)?(?:\s*(?:\/|y)\s*adaptaciones?)?|adaptaciones?)[\s\S]*?<\/h2>([\s\S]*?)(?=<h[12][^>]*>|$)/gi`

2. **Pattern 2**: Párrafos con label strong "Diferenciación/Adaptaciones:" seguido de listas/párrafos
   - Regex: `/<p[^>]*>\s*<strong>\s*(?:diferenciaci[oó]n(?:es)?(?:\s*(?:\/|y)\s*adaptaciones?)?|adaptaciones?)\s*:?\s*<\/strong>\s*<\/p>\s*([\s\S]*?)(?=<h[1-6][^>]*>|<p[^>]*>\s*<strong>\s*(?!diferenciaci[oó]n|adaptaciones)|$)/gi`

3. **Pattern 3**: Menciones inline en un solo párrafo (defensivo)
   - Regex: `/<p[^>]*>[\s\S]*?<strong>\s*(?:diferenciaci[oó]n(?:es)?(?:\s*(?:\/|y)\s*adaptaciones?)?|adaptaciones?)\s*:?\s*<\/strong>[\s\S]*?<\/p>/gi`

### Integración en el Flujo de Renderizado

La normalización se aplica en el `useMemo` que procesa `planParsed`:

```typescript
const planParsed = useMemo<ParsedPlan>(() => {
  // ... parsing inicial con parsePlan() ...
  
  // Normalización defensiva: extraer cualquier diferenciacion restante
  const inicioClean = extractDiferenciacionFromHtml(parsed.inicio || '');
  const desarrolloClean = extractDiferenciacionFromHtml(parsed.desarrollo || '');
  const cierreClean = extractDiferenciacionFromHtml(parsed.cierre || '');
  
  // Fusionar todo el contenido extraído
  const allExtracted = [
    inicioClean.extracted,
    desarrolloClean.extracted,
    cierreClean.extracted,
    parsed.diferenciacion || ''
  ].filter(e => e && e.trim().length > 0).join('\n\n');
  
  return {
    inicio: inicioClean.cleanedHtml,
    desarrollo: desarrolloClean.cleanedHtml,
    cierre: cierreClean.cleanedHtml,
    diferenciacion: allExtracted || undefined,
    // ... resto de campos ...
  };
}, [planHtml, recursos]);
```

### Logging de Desarrollo

Se agregó logging en modo desarrollo para ayudar a verificar cuando ocurre la extracción:

```typescript
if (mergedExtracted && import.meta.env.DEV) {
  console.log('[EditorSesionNuevo] Extracted diferenciacion content from section:', mergedExtracted.substring(0, 100) + '...');
}
```

## Comportamiento Antes vs Después

### Antes

- ⚠️ "Diferenciación/Adaptaciones" podía aparecer dentro de Inicio (o Desarrollo/Cierre)
- ⚠️ Podía aparecer duplicada: dentro de una sección Y al final
- ⚠️ El parser inicial no capturaba todos los casos edge

**Ejemplo visual anterior:**
```
Inicio (15 min)
- Actividad: ...
- Recursos: ...
- Diferenciación/Adaptaciones:    ← Aparecía aquí (incorrecto)
  - Adaptación visual
  - Adaptación auditiva

Desarrollo (40 min)
...

Cierre (5 min)
...

Diferenciación/Adaptaciones:      ← Y también aquí (duplicado)
  - Adaptación visual
  - Adaptación auditiva
```

### Después

- ✅ "Diferenciación/Adaptaciones" **solo** aparece al final, después de Cierre
- ✅ No hay duplicación: cualquier contenido embebido es extraído y movido al final
- ✅ Las secciones Inicio/Desarrollo/Cierre quedan limpias, sin bloques de adaptaciones

**Ejemplo visual nuevo:**
```
Inicio (15 min)
- Actividad: ...
- Recursos: ...
(sin adaptaciones aquí)

Desarrollo (40 min)
...

Cierre (5 min)
...

Diferenciación/Adaptaciones:      ← Solo aquí, al final (correcto)
  - Adaptación visual
  - Adaptación auditiva
```

## Compatibilidad

### Planes Existentes

- ✅ **Totalmente compatible**: Los planes guardados previamente se normalizan automáticamente al renderizarse
- ✅ **Sin migraciones necesarias**: Los cambios son solo en el renderizado, no en la estructura de datos
- ✅ **Backward compatible**: Si un plan tiene adaptaciones embebidas, se extraen automáticamente

### Rendimiento

- ✅ **Minimal overhead**: La normalización se ejecuta solo una vez por render (en `useMemo`)
- ✅ **Patrones eficientes**: Los regex están optimizados para capturar los casos comunes rápidamente
- ✅ **Solo en desarrollo**: El logging solo se ejecuta en modo desarrollo

## Componente Afectado

- **`EditorSesionNuevo`**: Este es el componente principal donde se renderiza el plan de clase con las secciones estructuradas (Inicio/Desarrollo/Cierre)

**Nota**: El componente `EditorSesionTabs` usa un flujo diferente (renderiza HTML completo directamente) y no requiere este fix, ya que no parsea en secciones estructuradas.

## Checklist de Pruebas Manuales

### Caso 1: Plan con Adaptaciones Embebidas en Inicio

1. **Preparación**:
   - Abrir un plan de clase existente que tenga "Diferenciación/Adaptaciones" dentro de la sección Inicio
   - O crear uno manualmente editando el HTML para incluir adaptaciones dentro de Inicio

2. **Verificación**:
   - Navegar a la pestaña "Clase" en `EditorSesionNuevo`
   - **Resultado esperado**: 
     - La sección "Inicio" NO muestra ningún bloque de "Diferenciación/Adaptaciones"
     - La sección "Diferenciación/Adaptaciones" aparece al final, después de "Cierre"
     - No hay duplicación

3. **Logging (opcional, solo en DEV)**:
   - Abrir la consola del navegador
   - **Resultado esperado**: Si se extrajo contenido, debería aparecer un log: `[EditorSesionNuevo] Extracted diferenciacion content from section: ...`

### Caso 2: Plan Nuevo con Adaptaciones Ya al Final

1. **Preparación**:
   - Generar un plan nuevo con IA (que debería generar adaptaciones al final según los prompts actualizados)
   - O usar un plan que ya tenga adaptaciones correctamente ubicadas al final

2. **Verificación**:
   - Navegar a la pestaña "Clase"
   - **Resultado esperado**:
     - Las secciones Inicio/Desarrollo/Cierre están limpias (sin adaptaciones)
     - "Diferenciación/Adaptaciones" aparece una sola vez, al final
     - No hay duplicación

### Caso 3: Navegación entre Tabs

1. **Preparación**:
   - Abrir un plan con adaptaciones embebidas
   - Verificar que aparece correctamente en la pestaña "Clase"

2. **Navegación**:
   - Cambiar a la pestaña "Recursos"
   - Cambiar a la pestaña "Evaluación"
   - Volver a la pestaña "Clase"

3. **Verificación**:
   - **Resultado esperado**: 
     - El plan se muestra correctamente cada vez
     - No aparece duplicación después de cambiar de tabs
     - Las adaptaciones siguen estando solo al final

### Caso 4: Regeneración con IA

1. **Preparación**:
   - Abrir un plan existente
   - Usar la funcionalidad "Solicitar cambios a la IA" para regenerar/modificar el plan

2. **Verificación**:
   - **Resultado esperado**:
     - El plan regenerado muestra las adaptaciones solo al final
     - No aparecen duplicadas dentro de las secciones

### Caso 5: Exportación PDF

1. **Preparación**:
   - Abrir un plan con adaptaciones
   - Generar PDF

2. **Verificación**:
   - **Resultado esperado**: 
     - El PDF muestra "Diferenciación/Adaptaciones" solo al final
     - No hay duplicación en el PDF

## Notas Técnicas

### Por qué una Capa Defensiva Adicional

Aunque `parsePlan` ya tiene lógica de extracción (`hoistInlineDiferenciacion`), se agregó esta capa adicional porque:

1. **Edge cases**: Algunos formatos HTML no coinciden exactamente con los patrones del parser inicial
2. **Robustez**: Garantiza que incluso si el parser falla, la UI siempre mostrará las adaptaciones correctamente
3. **Múltiples patrones**: La función de extracción usa patrones más exhaustivos que capturan variaciones adicionales

### Patrones de Extracción

Los tres patrones cubren:

- **H2 headings**: Cuando las adaptaciones están como una sección completa con H2
- **Paragraph labels**: Cuando están como `<p><strong>Diferenciación/Adaptaciones:</strong></p>` seguido de contenido
- **Inline mentions**: Cuando están mencionadas dentro de un párrafo (defensivo)

### Orden de Procesamiento

1. `parsePlan()` procesa el HTML inicial y extrae secciones
2. `extractDiferenciacionFromHtml()` se ejecuta en cada sección parseada como normalización defensiva
3. Todo el contenido extraído se fusiona con `parsed.diferenciacion`
4. El resultado final garantiza que `diferenciacion` contiene todo y las secciones están limpias

## Observaciones

- **Minimal risk**: Los cambios son solo en el renderizado, no afectan la estructura de datos guardada
- **No breaking changes**: Los planes existentes se normalizan automáticamente al renderizarse
- **Performance**: El overhead es mínimo (solo ejecuta en `useMemo` cuando cambia `planHtml`)
- **Maintainability**: La función está bien documentada y usa patrones regex claros





















