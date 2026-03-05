# Delta Filler y corrección de Versión B

**Objetivo:** Hacer que la duración alcanzada sea fiable incluso cuando el LLM no añade suficientes ítems, y garantizar que la Versión B se genere y se refleje correctamente cuando se solicita (cobertura completa de promptB o generación explícita en el repair).

---

## 1) Por qué el extend solo con LLM no es fiable

La duración estimada es **heurística**: se calcula sumando minutos por tipo de ítem (MC=2, ensayo=14, etc.) y por sección. El auto-extend pide al modelo que añada ítems o cambie tipos para acercarse al objetivo (95%–105%), pero:

- El modelo a veces no añade ítems o no cambia tipos; solo alarga texto, lo que **no** aumenta la estimación heurística.
- Tras varios intentos de extend, la estimación puede quedar muy por debajo del 95% del objetivo (p. ej. ~48 min para objetivo 80, low=76).
- Las advertencias indican “extend failed to reach 95%”, “duration deviation”, etc.

Por tanto, hace falta un **guardrail determinista** en servidor que, si tras el extend la estimación sigue por debajo de `low`, añada ítems hasta alcanzar al menos `low`, **sin llamar a OpenAI**.

---

## 2) Cómo funciona el Delta Filler

**Ubicación en el flujo:** Después del bucle de auto-extend, la validación/reparación de excerpts y el trim; **antes** del repair de rúbricas y promptB.

**Cálculo:**

- `low = round(targetMinutes * 0.95)`
- `remainingDelta = max(0, low - estimateDurationFromSpec(spec))`

Si `remainingDelta <= 0`, no se hace nada.

**Si remainingDelta > 0:**

1. Se añaden ítems nuevos hasta que la estimación heurística sea ≥ `low` (o hasta un tope de ítems, p. ej. 30).
2. **Preferencia:** Si hay material con excerpt usable (≥200 caracteres), se añaden ítems de **opción múltiple** (2 min cada uno) que usan ese fragmento como `source.content`.
3. Si no hay excerpt usable, se añaden ítems de **respuesta corta** (4 min cada uno) con consigna genérica y rúbrica de respaldo.
4. Los ítems se agrupan en una sección dedicada: id `duration-filler-section`, título “Complemento de duración”.
5. Los IDs de los nuevos ítems son únicos (prefijo `filler-` + número) y no se reutilizan IDs existentes.
6. **No se modifican** IDs de ítems ni secciones ya existentes.

**Seguridad:**

- No se llama a OpenAI; la lógica es determinista.
- Tope máximo de ítems añadidos para evitar crecimientos descontrolados.
- El esquema de la evaluación se mantiene válido (ítems con tipo, prompt, puntos, opciones o rúbrica según corresponda).

**Advertencia:** Se emite `DURATION_DELTA_FILLER_APPLIED` (severidad info) cuando se aplica el filler, indicando cuántos ítems se añadieron y el objetivo (low).

---

## 3) Garantía de Versión B cuando se solicita

**Problema:** Tras el repair de rúbricas/promptB, la respuesta podía seguir mostrando “La versión B fue solicitada pero no fue generada” y la cobertura de promptB seguía siendo parcial.

**Cambios:**

1. **Repair obligatorio de promptB:** Cuando se solicita Versión B, el paso de repair de rúbricas y promptB debe rellenar **todos** los ítems que falten de `versionedContent.promptB`. Las instrucciones al LLM indican que es **obligatorio** rellenar promptB en todos los ítems listados.
2. **Reflejar B en la respuesta:** Después del repair, si `requestedVersions.B` es true y al menos un ítem tiene promptB, se asegura que `spec.versionVariants.B` exista (con etiqueta y razón). Así la respuesta no muestra “B no generada” cuando sí hay contenido B.
3. **Eliminación de avisos obsoletos:** Si tras el repair la variante B queda presente (porque hay promptB), se eliminan de la lista de avisos los códigos `VERSION_B_NO_CONTENT` y `VERSION_B_MISSING` para no mostrar mensajes contradictorios.
4. **Un solo aviso de cobertura parcial:** El aviso `VERSION_B_PARTIAL_CONTENT` ya no se emite dentro de `validateAndNormalizeSpec` (que se ejecuta varias veces). Se emite **una sola vez** al final, con los conteos finales de ítems con promptB y total de ítems.

**Orden de operaciones:**  
generación → validar/normalizar → estimar → bucle extend → limpieza/reparación de excerpts → **delta filler** (si sigue por debajo de low) → estimación y desglose finales → repair de rúbricas y promptB (una pasada) → asegurar variante B y aviso parcial → respuesta.

---

## 4) Cómo probar a mano

### Duración (objetivo 80 no debe quedar por debajo de 76)

1. Generar una evaluación con **duración objetivo 80 min**.
2. Revisar que la **duración estimada** final (`meta.duration.minutes`) sea **≥ 76** (95% de 80).
3. Si el extend no alcanzó 76, debe haberse aplicado el delta filler: en avisos debe aparecer `DURATION_DELTA_FILLER_APPLIED` y la estimación final ≥ 76.
4. En logs: `[DURATION_DELTA_FILLER] added N items, new_estimated=...`.

### Versión B

1. Solicitar **Versión B** (adaptación de contenido declarada).
2. Tras generar, comprobar que los ítems tengan `versionedContent.promptB` cuando corresponda (el repair debe rellenar los que falten).
3. Comprobar que **no** aparezca “La versión B fue solicitada pero no fue generada” cuando al menos un ítem tiene promptB.
4. Si la cobertura es parcial, debe aparecer **una sola** vez el aviso `VERSION_B_PARTIAL_CONTENT` con los conteos finales.

---

## 5) Tests unitarios (deterministas)

- **deltaFiller.test.ts:**  
  - El delta filler añade ítems hasta que la estimación sea ≥ low (p. ej. spec con 48 min y objetivo 80 → se añaden ítems hasta ≥ 76).  
  - Si la estimación ya es ≥ low, no se añaden ítems y no se emite `DURATION_DELTA_FILLER_APPLIED`.

- **promptBDetection.test.ts:**  
  - `detectRubricAndPromptBRepairCandidates` devuelve todos los ítems que faltan de promptB cuando B está solicitado.  
  - “Repair required” cuando B está solicitado y hay ítems sin promptB.  
  - No se pide repair de promptB cuando B no está solicitado.

Ejecución (con Deno):

```bash
deno test __tests__/deltaFiller.test.ts __tests__/promptBDetection.test.ts --allow-read
```
