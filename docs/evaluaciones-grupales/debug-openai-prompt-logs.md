# Debug: Logging de Prompts OpenAI

> **Estado**: ACTIVO (temporal)  
> **Fecha activación**: 2026-02-06  
> **Propósito**: Inspeccionar y mejorar la calidad de los prompts enviados a OpenAI

## ¿Por qué se agregaron estos logs?

Para poder revisar el contenido exacto de los prompts que se envían a OpenAI durante la generación de evaluaciones grupales. Esto permite:

1. Verificar que el contexto del grupo se incluye correctamente
2. Inspeccionar la estructura del system prompt
3. Identificar oportunidades de mejora en las instrucciones
4. Debuguear problemas de formato en las respuestas

## Ubicación en el código

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Líneas**: ~2213-2221 (aproximadamente)

```typescript
// ======================= DEBUG LOGGING (TEMPORARY) =======================
// TODO: Remove after debugging prompt quality
console.log('========== OPENAI SYSTEM PROMPT START ==========');
console.log(currentSystemPrompt);
console.log('========== OPENAI SYSTEM PROMPT END ==========');
console.log('========== OPENAI USER PROMPT START ==========');
console.log(currentUserPrompt);
console.log('========== OPENAI USER PROMPT END ==========');
// ======================= END DEBUG LOGGING =======================
```

## Dónde ver los logs en Supabase

1. Ir a [Supabase Dashboard](https://supabase.com/dashboard/project/srlrbuphsogwgymqywhe/functions)
2. Navegar a: **Edge Functions** → **modify-evaluation**
3. Click en la pestaña **Logs**
4. Buscar las líneas marcadas con:
   - `OPENAI SYSTEM PROMPT START`
   - `OPENAI USER PROMPT START`

### Filtrado de logs

En el panel de logs puedes filtrar por texto para encontrar rápidamente:
- `SYSTEM PROMPT` - Ver solo el prompt de sistema
- `USER PROMPT` - Ver solo el prompt de usuario

## Cómo reproducir

1. Desde el frontend, generar una evaluación grupal
2. Esperar a que complete (o falle)
3. Revisar los logs en Supabase Dashboard

## Cómo remover los logs

Cuando ya no sean necesarios, eliminar el bloque de código entre:

```
// ======================= DEBUG LOGGING (TEMPORARY) =======================
```

y

```
// ======================= END DEBUG LOGGING =======================
```

Luego re-desplegar:

```bash
supabase functions deploy modify-evaluation
```

## Notas de seguridad

- ✅ NO se loguea el API key de OpenAI
- ✅ Los logs solo contienen el contenido del prompt (contexto educativo)
- ⚠️ Los logs pueden contener información del grupo/estudiantes (anonimizados como "Estudiante A, B, C...")
- ⚠️ Remover antes de producción final si hay concerns de privacidad
