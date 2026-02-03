# Universal pipeline fix parsing + version C + aiReport

**Fecha**: 2026-02-02  
**Rama**: `nuevas-evaluaciones`

---

## Root cause

- La salida del modelo a veces llega como **JSON embebido en string**, y terminaba guardándose como texto en `versions.A`.
- `responseOptionsIncluded` podía quedar en `false` aunque el HTML sí contenía la frase metacognitiva.
- `generateVersionC` podía quedar `false` aunque hubiera estudiantes con adecuación de contenido en `groupContext`.
- El `aiReport` no reflejaba la realidad del HTML (opciones equivalentes presentes).

---

## Fixes aplicados

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

### 1) Version C determinística también por adaptaciones en `groupContext`

```ts
const hasContentAdaptationStudent = Array.isArray(groupContext?.students)
  ? groupContext.students.some((student: any) =>
      student?.hasDeclaredContentAdaptation === true ||
      student?.requiereAdecuacionContenido === true ||
      student?.requiresContentAdaptation === true ||
      student?.informeTecnico?.requiereAdecuacionContenido === true
    )
  : false;
const generateVersionC = designPlan.triggers?.versionC === true || assignmentsIncludeC || hasContentAdaptationStudent;
```

### 2) Detección real de metacognición desde HTML

```ts
const responseOptionsIncluded = baseHtml.includes(metacognitionPhrase);
const responseOptionCountFinal = responseOptionsIncluded
  ? (baseHtml.includes('Opción 3') ? 3 : 2)
  : 0;
```

### 3) Normalización de `evaluationBundle.responseOptions*`

```ts
evaluationBundle: {
  ...
  responseOptionsIncluded,
  responseOptionCount: responseOptionsIncluded ? responseOptionCountFinal : 0
}
```

### 4) aiReport ahora refleja el HTML real

```ts
response_options: {
  included: responseOptionsIncluded,
  optionCount: responseOptionCountFinal,
  rationale: responseOptionsRationale,
  location: responseOptionsIncluded ? 'Después de cada consigna que requiere respuesta escrita' : 'No aplica'
}
```

---

## Verificación (Network)

1) `_debug.generationPath` comienza con `"universal"`.
2) `evaluationBundle.versions.A` **comienza con `<`** (no `{`).
3) Si hay estudiantes con adaptación de contenido → `versions.C` no es null.
4) `responseOptionsIncluded` = `true` si el HTML contiene la frase metacognitiva.

---

## Verificación (Diego)

Si Diego tiene adecuación de contenido:
- `generateVersionC` debe ser `true`.
- `evaluationBundle.versions.C` no es null.
- Diego aparece asignado a `"C"` en `studentAssignments`.

