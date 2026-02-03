# Fix modify-evaluation 500 ai_report null

**Fecha**: 2026-02-02  
**Rama**: `nuevas-evaluaciones`

---

## Root cause

El handler accedía a `parsed.ai_report` y `parsed.response_option_count` sin validar si `parsed` era `null`.  
Cuando el parseo fallaba y `parsed` quedaba `null`, el acceso provocaba:
```
TypeError: Cannot read properties of null (reading 'ai_report')
```

---

## Fix aplicado (mínimo, sin cambios de lógica)

Archivo: `supabase/functions/modify-evaluation/index.ts`

### Antes
```ts
const aiReportFromAI = parsed.ai_report;
const aiWarnings = Array.isArray(parsed.ai_report?.warnings) ? parsed.ai_report.warnings : [];
// ...
responseOptionCount: parsed.response_option_count || responseOptionCount
```

### Después
```ts
const aiReportFromAI = parsed?.ai_report ?? null;
const aiWarnings = Array.isArray(parsed?.ai_report?.warnings) ? parsed.ai_report.warnings : [];
// ...
responseOptionCount: parsed?.response_option_count || responseOptionCount
```

Log mínimo añadido:
```ts
if (!parsed) {
  console.warn('[UNIVERSAL] Parsed output is null; using fallback-safe values for ai_report and response options.');
}
```

---

## Verificación (lectura de código)

1) No hay accesos `parsed.ai_report` sin optional chaining.  
2) Si `parsed` es `null`, el handler no lanza excepción.  
3) OPTIONS sigue devolviendo 204 con CORS headers correctos.  
4) No se agregaron declaraciones duplicadas nuevas.  
5) El schema universal se mantiene intacto en respuestas exitosas.

---

## Deploy

```bash
supabase functions deploy modify-evaluation --no-verify-jwt
```

---

## Checklist de verificación (operador)

1) Preflight `OPTIONS` devuelve 204 con headers de CORS.  
2) POST devuelve 200 (o 500 controlado con JSON y headers CORS).  
3) Logs no muestran `TypeError: ... ai_report`.

