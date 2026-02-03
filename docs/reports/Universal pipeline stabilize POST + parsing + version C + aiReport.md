# Universal pipeline stabilize POST + parsing + version C + aiReport

**Fecha**: 2026-02-02  
**Rama**: `nuevas-evaluaciones`

---

## Root cause (502)

- El handler podía lanzar errores en runtime y devolver 502 (gateway) cuando el proceso se caía.
- La salida del modelo a veces se guardaba como JSON en string dentro de `versions.A`.
- `generateVersionC` podía quedar en `false` aunque existieran estudiantes con adecuación de contenido en `groupContext`.
- `responseOptionsIncluded` no reflejaba el HTML real.

---

## Fixes aplicados (mínimos, sin refactor de negocio)

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

### 1) Universal response builder único

```ts
const buildUniversalResponse = ({ ... }) => new Response(JSON.stringify({ ... }), { headers: { ...corsHeaders, 'Content-Type':'application/json' } });
```

Se usa en **todas** las salidas exitosas del path universal y evita retornos legacy.

### 2) HTML final nunca JSON

```ts
if (!baseHtml || baseHtml.trim().length === 0 || baseHtml.trim().startsWith('{')) {
  parseFailed = true;
  const rawFallback = generatedContent || '';
  baseHtml = rawFallback.trim().startsWith('<') ? cleanupContent(rawFallback) : '<div>Contenido no disponible.</div>';
}
```

### 3) Version C determinística por adaptaciones

```ts
const hasContentAdaptationStudent = Array.isArray(groupContext?.students)
  ? groupContext.students.some((student: any) => ...)
  : false;
const generateVersionC = designPlan.triggers?.versionC === true || assignmentsIncludeC || hasContentAdaptationStudent;
```

Y se asigna `C` a esos estudiantes:

```ts
contentAdaptationIds.forEach((studentId) => {
  if (studentId) adjustedAssignments[studentId] = 'C';
});
```

### 4) Response options basadas en HTML real

```ts
const responseOptionsIncluded = baseHtml.includes(metacognitionPhrase);
const responseOptionCountFinal = responseOptionsIncluded ? (baseHtml.includes('Opción 3') ? 3 : 2) : 0;
```

---

## Verificación (Network)

1) OPTIONS → 204 con headers CORS.  
2) POST → 200 OK.  
3) `_debug.generationPath` = `universal` o `universal_parse_failed`.  
4) `evaluationBundle.versions.A` comienza con `<`.  
5) Si Diego tiene adecuación: `versions.C` no es null + `studentAssignments` incluye `C`.  

---

## Comando de deploy (documentado)

```bash
supabase functions deploy modify-evaluation --no-verify-jwt
```

