# Index + pasajes relevantes: menos WORKER_LIMIT sin bajar calidad

**Objetivo:** Reducir probabilidad de HTTP 546 WORKER_LIMIT en `modify-evaluation-v2` sin sacrificar rigor pedagógico ni grounding en materiales.

---

## 1) Problema: enviar “todo el PDF” empeora costo y estabilidad

Cuando se manda demasiado texto bruto al prompt (portadas, metadatos, fragmentos irrelevantes, bloques redundantes), pasan dos cosas:

1. **Sube el costo computacional por request** (prompt más grande, más latencia, más riesgo de timeout/WORKER_LIMIT).
2. **Baja la señal útil** para el modelo: se diluye el contenido relevante entre ruido y se vuelve más probable que la salida necesite reparaciones posteriores.

En la práctica, “más texto sin curar” no es necesariamente “más calidad”.

---

## 2) Diseño aplicado: Index + Relevant Passages

Se implementó un enfoque en dos capas para prompt de materiales:

### Capa A — Índice liviano de materiales (scope map)

Para cada material con `extractedText`:
- Se mantiene el texto completo en memoria del servidor (no se descarta).
- Se divide en bloques coherentes (ventanas de 1–3 párrafos contiguos).
- Se filtran bloques tipo portada/metadatos con heurísticas existentes.
- Se crea un índice con:
  - etiqueta corta del bloque (best-effort),
  - resumen breve (1–2 oraciones / snippet),
  - material de origen y keywords de match.

Esto le da al modelo **visión de alcance** sin enviar todo el texto bruto.

### Capa B — Pasajes relevantes verbatim (evidence corpus)

Luego se seleccionan pasajes por relevancia (top-K):
- K objetivo: 6–10 (configurado en 8 por defecto).
- Relevancia basada en keywords extraídas de:
  - requerimiento docente (`modification`),
  - materia/temas/competencias/criterios del contexto,
  - reglas de diseño del instrumento.
- Se excluyen pasajes answer-leaking para `source_analysis`.
- Se impone presupuesto total aproximado de caracteres (curated corpus): **~24k chars**.

Resultado: el prompt incluye evidencia suficiente y concreta, pero controlada.

---

## 3) Qué quedó igual en calidad (no se degradó la exigencia)

Se mantienen en prompt principal los requisitos de calidad por construcción:
- banda de duración 95–105%,
- validez por tipo (ordering/matching/MC/source_analysis),
- cobertura completa de promptB cuando aplica versión B,
- rúbricas específicas por contenido en ítems abiertos.

Y siguen activos safeguards deterministas en post-proceso:
- limpieza/selección coherente de excerpts,
- validación de ítems y degradación determinista si hace falta,
- delta filler de duración.

---

## 4) Métricas de debug agregadas

En `response.debug` se agregaron:
- `materialsIndexCount`
- `passagesSelectedCount`
- `materialsCharsSent`
- `topKeywordsUsedForSelection`

Estas métricas permiten verificar cuánto material curado se envió y con qué criterios.

---

## 5) Impacto esperado en WORKER_LIMIT

Con este enfoque:
- baja la longitud promedio del prompt frente a “texto completo sin curar”,
- mejora la relación señal/ruido,
- se reduce necesidad de cascadas de reparación,
- baja la latencia y el riesgo de límite de worker.

El objetivo operativo sigue siendo una generación robusta en flujo normal con una llamada principal y post-procesamiento determinista.

---

## 6) Cómo validar manualmente

1. Generar evaluación V2 con materiales reales (incluyendo PDF largo).
2. Revisar `debug` en la respuesta:
   - `materialsIndexCount > 0`
   - `passagesSelectedCount` entre 6 y 10 (aprox., según material disponible)
   - `materialsCharsSent` dentro de presupuesto razonable (~20k–30k)
   - `topKeywordsUsedForSelection` con términos esperables del pedido.
3. Verificar calidad en salida:
   - ítems de ordenar/relacionar renderizables,
   - `source_analysis` con fragmentos coherentes y no answer-leaking,
   - promptB completo si se pidió versión B,
   - rúbricas específicas (no genéricas).
4. Monitorear tasa de errores 546 WORKER_LIMIT y tiempos de respuesta vs. baseline previo.

---

## 7) Archivos relevantes

- `supabase/functions/modify-evaluation-v2/index.ts`
  - selección index + pasajes,
  - presupuesto de caracteres,
  - métricas debug de materiales.
- `supabase/functions/modify-evaluation-v2/excerptCleaning.ts`
  - heurísticas de limpieza y coherencia de excerpt (base determinista).
- `supabase/functions/modify-evaluation-v2/itemValidity.ts`
  - guardrails de validez por tipo.
