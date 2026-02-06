# Phase 4: V2 JSON Renderer

> **Fecha**: 2026-02-06  
> **Estado**: Implementado  
> **Objetivo**: Renderizar evaluaciones v2 directamente desde JSON usando React, sin HTML ni `dangerouslySetInnerHTML`

---

## Resumen

Esta fase implementa un renderer completo basado en componentes React que toma el JSON estructurado de v2 y lo renderiza visualmente. Esto elimina la necesidad de que el backend genere HTML, permitiendo mayor control sobre el diseño y mejor mantenibilidad.

**Arquitectura del flujo:**

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐      ┌─────────────┐
│ Beta Toggle │──ON──│ v2 Edge Func │──────│ v2Normalizer.ts │──────│ Renderer v2 │
│    (UI)     │      │ (JSON resp.) │      │ (ViewModel)     │      │ (React)     │
└─────────────┘      └──────────────┘      └─────────────────┘      └─────────────┘
       │                                                                   │
       │                    ┌─────────────────┐                           │
       └───────OFF──────────│ v1 Edge Func    │───────────────────────────┤
                           │ (HTML resp.)    │                           │
                           └─────────────────┘                           │
                                                                         ▼
                                                              ┌─────────────────┐
                                                              │  UI Display     │
                                                              └─────────────────┘
```

---

## Archivos Creados

### Tipos y normalización

| Archivo | Descripción |
|---------|-------------|
| [src/services/evaluations/v2Types.ts](../src/services/evaluations/v2Types.ts) | TypeScript interfaces para v2: `EvaluationSpecV2`, `NormalizedEvaluation`, `NormalizedSection`, `NormalizedItem` |
| [src/services/evaluations/v2Normalizer.ts](../src/services/evaluations/v2Normalizer.ts) | Función `normalizeV2Response()` que transforma JSON crudo a ViewModel estable |

### Componentes del renderer

| Archivo | Descripción |
|---------|-------------|
| [src/components/evaluaciones/v2/EvaluationRendererV2.tsx](../src/components/evaluaciones/v2/EvaluationRendererV2.tsx) | Componente principal del renderer v2 |
| [src/components/evaluaciones/v2/EvalHeader.tsx](../src/components/evaluaciones/v2/EvalHeader.tsx) | Header con metadata (materia, duración, puntos, versión) |
| [src/components/evaluaciones/v2/MapTable.tsx](../src/components/evaluaciones/v2/MapTable.tsx) | "Mapa de la evaluación" - tabla con secciones, ítems, puntos, tiempo |
| [src/components/evaluaciones/v2/EvalSection.tsx](../src/components/evaluaciones/v2/EvalSection.tsx) | Sección con título, instrucciones y lista de ítems |
| [src/components/evaluaciones/v2/EvalItem.tsx](../src/components/evaluaciones/v2/EvalItem.tsx) | Ítem individual con soporte para todos los tipos de pregunta |
| [src/components/evaluaciones/v2/ResponseOptions.tsx](../src/components/evaluaciones/v2/ResponseOptions.tsx) | Opciones de respuesta equivalentes (A/B/C) |
| [src/components/evaluaciones/v2/index.ts](../src/components/evaluaciones/v2/index.ts) | Barrel export |

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| [src/services/evaluations/requestService.ts](../src/services/evaluations/requestService.ts) | Agregado `v2RawResponse` al `EvaluationResult` |
| [src/pages/EvaluacionesGrupo.tsx](../src/pages/EvaluacionesGrupo.tsx) | Import de renderer v2, estado para `v2RawResponse`, lógica de rendering condicional |

---

## Tipos de Ítems Soportados

El renderer v2 soporta todos los tipos definidos en el contrato v2:

| Tipo | Descripción | Renderizado |
|------|-------------|-------------|
| `multiple_choice` | Opción múltiple | Lista de opciones con letras (a, b, c...) |
| `true_false` | Verdadero/Falso | Checkboxes V/F |
| `true_false_justify` | V/F con justificación | Checkboxes + líneas para justificar |
| `short_answer` | Respuesta corta | Línea punteada |
| `paragraph` | Párrafo | Múltiples líneas punteadas |
| `essay` | Desarrollo | Líneas + preguntas orientadoras opcionales |
| `source_analysis` | Análisis de fuente | Bloque de fuente + sub-ítems |
| `table_completion` | Completar tabla | Tabla semántica con celdas pre-llenadas y vacías para completar |
| `matching` | Unir con flechas | Dos columnas para matching |
| `ordering` | Ordenar secuencia | Lista de ítems con espacios para número |

---

## Proceso de Normalización

El normalizer (`v2Normalizer.ts`) realiza:

1. **Validación de estructura**: Verifica campos requeridos (`success`, `evaluationSpec`, `sections`)
2. **Tipo safety**: Convierte tipos desconocidos con fallbacks seguros
3. **Numeración**: Asigna números de sección e ítem para display
4. **Cálculos**: Suma totales de puntos por sección y evaluación
5. **Warnings**: Registra problemas no críticos (ítem sin prompt, sección vacía)

**Campos requeridos para renderizar:**

```typescript
// Mínimo para que canRenderV2() retorne true:
{
  success: true,
  evaluationSpec: {
    sections: [
      {
        items: [{ prompt: "..." }] // Al menos 1 ítem con prompt
      }
    ]
  }
}
```

---

## Lógica de Fallback

```
┌──────────────────┐
│ Toggle = ON      │
│ v2RawResponse    │
│ existe?          │
└────────┬─────────┘
         │
    ┌────┴────┐
    │ SI      │ NO
    ▼         ▼
┌────────────┐ ┌────────────┐
│ Render v2  │ │ Render v1  │
│ (JSON)     │ │ (HTML)     │
└─────┬──────┘ └────────────┘
      │
      ▼
┌─────────────────┐
│ Normalization   │
│ exitosa?        │
└────────┬────────┘
         │
    ┌────┴────┐
    │ SI      │ NO
    ▼         ▼
┌────────────┐ ┌────────────────────────┐
│ Show v2    │ │ onRenderError callback │
│ components │ │ → set v2RawResponse=   │
└────────────┘ │   null                 │
               │ → toast "formato       │
               │   estándar"            │
               │ → Render v1            │
               └────────────────────────┘
```

---

## Cómo Testear

### Paso 1: Configuración

1. Asegurarse que el backend `modify-evaluation-v2` esté deployado
2. Setear variable de entorno para debug (opcional):
   ```bash
   VITE_DEBUG_EVAL_PIPELINE=true npm run dev
   ```

### Paso 2: Test con Toggle OFF (v1)

1. Ir a `/evaluaciones`
2. Seleccionar grupo y materia
3. Verificar que el toggle "Beta (v2)" esté **OFF**
4. Generar evaluación
5. **Esperado**: Se usa `EvaluacionVisualRenderer` (v1, HTML)

### Paso 3: Test con Toggle ON (v2)

1. Activar toggle "Beta (v2)"
2. Generar evaluación
3. **Esperado si v2 funciona**:
   - Nuevo diseño con `EvaluationRendererV2`
   - Header con metadata
   - Tabla "Mapa de la Evaluación"
   - Secciones y ítems renderizados desde JSON
4. **Esperado si v2 falla**:
   - Toast "Usando formato estándar"
   - Fallback a v1 renderer

### Paso 4: Verificar Debug Panel

Con `VITE_DEBUG_EVAL_PIPELINE=true`:

1. Generar evaluación con toggle ON
2. Buscar panel morado "V2 Renderer Debug"
3. Verificar:
   - `Normalization success: ✅`
   - Conteo de sections/items/points
   - Warnings si hay campos faltantes

### Paso 5: Test de Tipos de Ítems

Generar evaluaciones que incluyan diferentes tipos:

- [ ] Multiple choice → Opciones a), b), c)
- [ ] True/false → Checkboxes V/F
- [ ] Essay → Líneas + preguntas orientadoras
- [ ] Source analysis → Bloque de fuente + sub-preguntas

---

## Limitaciones Conocidas

1. **Versiones B/C**: El renderer solo muestra versión A por ahora. El backend genera las variantes pero el selector de versiones no está implementado en v2.

2. **Feedback/Regenerate**: Los callbacks `onFeedback` y `onRegenerate` no están conectados al renderer v2 (solo v1 los tiene).

3. **Print styling**: El renderer v2 no tiene estilos optimizados para impresión como v1.

4. **Rúbrica integrada**: La `RubricaIntegrada` solo aparece en v1 renderer.

---

## Próximos Pasos (Phase 5)

### Schema/Prompt Hardening

1. **Validación estricta del schema**: Usar JSON Schema para validar respuesta de OpenAI
2. **Prompts mejorados**: Refinar prompts para garantizar estructura consistente
3. **Retry inteligente**: Si el JSON es inválido, reintentar con prompt más explícito

### Mejoras de UX

1. **Version selector v2**: UI para cambiar entre versión A/B/C en renderer v2
2. **Print styles**: CSS de impresión para v2 renderer
3. **Feedback integration**: Conectar feedback al renderer v2

### Métricas

1. **Tasa de éxito v2**: Tracking de cuántas veces v2 renderiza vs fallback
2. **Normalization warnings**: Dashboard de campos faltantes más comunes
3. **Performance**: Comparar tiempo de render v1 (HTML parse) vs v2 (React)

---

## Referencias

- [Phase 3 Doc](./phase-3/summary.md) - Beta toggle implementation
- [v2 Edge Function](../supabase/functions/modify-evaluation-v2/index.ts) - Backend v2
- [v2Types.ts](../src/services/evaluations/v2Types.ts) - Type definitions
- [EvaluationRendererV2.tsx](../src/components/evaluaciones/v2/EvaluationRendererV2.tsx) - Main renderer
