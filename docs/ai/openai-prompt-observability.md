# OpenAI Prompt Observability

> **Estado**: ACTIVO  
> **Fecha implementación**: 2026-02-06  
> **Archivo modificado**: `supabase/functions/modify-evaluation/index.ts`

## Resumen

Se implementó logging estructurado para observar los prompts enviados a OpenAI desde la Edge Function `modify-evaluation`. Esto permite debuguear y mejorar la calidad de los prompts sin modificar la lógica de generación.

---

## Dónde se construye el prompt de OpenAI

### Path 1: Universal (Evaluaciones Grupales)

**Ubicación**: `modify-evaluation/index.ts` líneas ~2090-2180

```
Condición de activación: type === 'modification' && generation_mode === 'universal'
```

| Variable | Descripción | Línea aprox. |
|----------|-------------|--------------|
| `systemPrompt` | Instrucciones del sistema para generación de evaluaciones | ~2103 |
| `userPrompt` | Contexto del grupo, contenidos, requerimientos del docente | ~2162 |

El prompt se envía dentro de `generateEvaluationWithRetries()` (~línea 2270).

### Path 2: Legacy (Otros tipos de request)

**Ubicación**: `modify-evaluation/index.ts` líneas ~2990-3290

```
Condición de activación: Cualquier request que NO sea universal
Tipos: 'chat', 'html_plan', 'planning', 'modification' (legacy)
```

| Variable | Descripción | Línea aprox. |
|----------|-------------|--------------|
| `systemPrompt` | Varía según el tipo de request | ~3000-3270 |
| `userPrompt` | Varía según el tipo de request | ~3000-3270 |

---

## Datos incluidos en el prompt

### Contexto del grupo (`groupContext`)
- `subject`: Materia
- `content`: Contenidos curriculares (array)
- `competencies`: Competencias (array)
- `criteriosLogro`: Criterios de logro (array)
- `students`: Lista de estudiantes (anonimizados como "Estudiante A, B, C...")

### Plan de diseño (`evaluation_design_plan`)
- `instrumentDesignRules`: Reglas de diseño del instrumento
- `studentAssignments`: Asignación de versiones por estudiante
- `varkDistribution`: Distribución de estilos de aprendizaje
- `triggers.versionB/C`: Si se requieren versiones B/C
- `responseOptions`: Opciones de respuesta equivalentes

### Parámetros de generación
- `modification`: Requerimientos específicos del docente
- `generateVersionB`: Si generar versión B
- `generateVersionC`: Si generar versión C
- `responseOptionsInclude`: Si incluir opciones equivalentes

---

## Logs agregados

### Prefijos de búsqueda

| Prefijo | Descripción |
|---------|-------------|
| `[OPENAI_CONTEXT]` | Datos de entrada usados para construir el prompt |
| `[OPENAI_PROMPT]` | El prompt completo enviado a OpenAI |

### Logs de contexto (Universal path)

```
[OPENAI_CONTEXT] ========== INPUT DATA START ==========
[OPENAI_CONTEXT] groupContext.subject: Historia
[OPENAI_CONTEXT] groupContext.content: ["Batllismo", "Reformas sociales"]
[OPENAI_CONTEXT] groupContext.competencies: ["Análisis crítico"]
[OPENAI_CONTEXT] groupContext.criteriosLogro: ["Identifica causas"]
[OPENAI_CONTEXT] groupContext.students.count: 25
[OPENAI_CONTEXT] modification: Incluir análisis de fuentes
[OPENAI_CONTEXT] evaluation_design_plan.keys: ["instrumentDesignRules", "triggers"]
[OPENAI_CONTEXT] ========== INPUT DATA END ==========

[OPENAI_CONTEXT] ========== DESIGN PLAN DETAILS ==========
[OPENAI_CONTEXT] instrumentDesignRules: ["Incluir 3 ítems de análisis"]
[OPENAI_CONTEXT] studentAssignments.count: 25
[OPENAI_CONTEXT] studentAssignments.sample: [["1","A"],["2","A"]]
[OPENAI_CONTEXT] varkDistribution: {"visual":5,"readWrite":10}
[OPENAI_CONTEXT] responseOptionsInclude: true
[OPENAI_CONTEXT] responseOptionCount: 2
[OPENAI_CONTEXT] assignmentsIncludeB: false
[OPENAI_CONTEXT] assignmentsIncludeC: true
[OPENAI_CONTEXT] hasContentAdaptationStudent: true
[OPENAI_CONTEXT] designPlan.triggers: {"versionC":true}
[OPENAI_CONTEXT] ========== DESIGN PLAN END ==========
```

### Logs de prompt (ambos paths)

```
[OPENAI_PROMPT] ========== REQUEST METADATA ==========
[OPENAI_PROMPT] path: universal
[OPENAI_PROMPT] attempt: 1
[OPENAI_PROMPT] model: gpt-4.1-2025-04-14
[OPENAI_PROMPT] max_completion_tokens: 6000
[OPENAI_PROMPT] generateVersionB: false
[OPENAI_PROMPT] generateVersionC: true
[OPENAI_PROMPT] shouldHaveB: false
[OPENAI_PROMPT] shouldHaveC: true
[OPENAI_PROMPT] isRepairAttempt: false
[OPENAI_PROMPT] ========== SYSTEM PROMPT START ==========
Eres un especialista en evaluación educativa...
[OPENAI_PROMPT] ========== SYSTEM PROMPT END ==========
[OPENAI_PROMPT] systemPromptLength: 2845
[OPENAI_PROMPT] ========== USER PROMPT START ==========
CONTEXTO DEL GRUPO:
Materia: Historia
...
[OPENAI_PROMPT] ========== USER PROMPT END ==========
[OPENAI_PROMPT] userPromptLength: 1234
[OPENAI_PROMPT] totalPromptLength: 4079
```

---

## Dónde ver los logs en Supabase

1. Ir al [Dashboard de Supabase](https://supabase.com/dashboard/project/srlrbuphsogwgymqywhe/functions)
2. Navegar a: **Edge Functions** → **modify-evaluation** → **Logs**
3. Filtrar por texto:
   - `[OPENAI_CONTEXT]` - Ver datos de entrada
   - `[OPENAI_PROMPT]` - Ver prompts completos
   - `SYSTEM PROMPT START` - Buscar inicio del system prompt
   - `USER PROMPT START` - Buscar inicio del user prompt

### Tips de filtrado

- Para ver solo metadata: `[OPENAI_PROMPT] path:`
- Para ver intentos de reparación: `isRepairAttempt: true`
- Para ver longitud del prompt: `totalPromptLength:`

---

## Verificación de que los logs funcionan

1. Generar una evaluación grupal desde el frontend
2. Ir a los logs en Supabase
3. Buscar `[OPENAI_PROMPT]` y verificar que aparece:
   - El system prompt completo
   - El user prompt completo
   - Los metadatos de la request

---

## Paths de OpenAI en la función

| Path | Condición | Modelo | max_tokens |
|------|-----------|--------|------------|
| Universal | `type === 'modification' && generation_mode === 'universal'` | `gpt-4.1-2025-04-14` | 6000 |
| Legacy - Chat | `type === 'chat'` | `gpt-5-mini-2025-08-07` | 4000 |
| Legacy - Otros | `type !== 'chat'` | `gpt-4.1-2025-04-14` | 4000 |

---

## Riesgos y consideraciones

### Seguridad
- ✅ **NO se loguea el API key** de OpenAI
- ⚠️ Los logs pueden contener información del grupo (pero estudiantes están anonimizados como "Estudiante A, B, C...")
- ⚠️ Los logs incluyen contenidos curriculares y requerimientos del docente

### Rendimiento
- Los logs son síncronos pero no deberían impactar significativamente el tiempo de respuesta
- En caso de retry (intentos > 1), los logs se emiten múltiples veces

### Volumen de logs
- Cada request genera ~20-30 líneas de log estructurado
- En producción con alto volumen, considerar reducir detalle o usar sampling

---

## Mejoras futuras sugeridas

1. **Structured JSON logging**: Usar `JSON.stringify()` para logs más parseables
2. **Correlation ID**: Agregar un ID único por request para correlacionar logs
3. **Log sampling**: En producción, loguear solo un % de requests
4. **Response logging**: Agregar logs de la respuesta de OpenAI (tokens usados, finish_reason)
5. **Dashboard dedicado**: Crear un dashboard en Supabase para visualizar métricas de prompts

---

## Cómo desactivar los logs

Para desactivar temporalmente, buscar y comentar los bloques entre:

```typescript
// ======================= OPENAI CONTEXT LOGGING =======================
...
// =====================================================================

// ======================= OPENAI PROMPT LOGGING =======================
...
// ======================= END OPENAI PROMPT LOGGING =======================
```

Luego re-desplegar:

```bash
supabase functions deploy modify-evaluation
```
