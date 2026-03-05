# Planificación: debug y mejoras (loading, spinner infinito, reporte IA)

**Objetivo:** Corregir UX/estabilidad de generación y recuperar detalle del reporte IA de planificación.

---

## 1) Cambio de copy en loading (wizard)

### Qué se cambió

En la pantalla de carga del wizard de planificación se actualizó el mensaje principal a:

> **"Aguarda un instante mientras generamos las clases. Esperamos no demorar mucho."**

### Dónde

- `src/pages/PlanificacionWizard.tsx`
- Bloque de loading/error de generación (`isGeneratingPlans || generationError`)
- El texto está en el `h2` principal, por lo tanto es el mensaje más prominente de la pantalla.

---

## 2) Bug de flicker/spinner infinito en workspace

### Síntoma observado

Tras crear la planificación y entrar al workspace, la vista podía quedar en loading indefinido (spinner/flicker) sin error explícito visible y sin mostrar el contenido generado.

### Causa raíz

En el efecto de auto-generación de planes del workspace:

- Se usaba una bandera local `cancelled` en cleanup.
- Si el efecto se invalidaba durante una corrida (por cambios de estado/deps), quedaba `cancelled = true`.
- El flujo final evitaba ejecutar `setIsEnsuringPlans(false)` cuando `cancelled` era true.

Esto podía dejar `isEnsuringPlans` “clavado” en `true`, manteniendo la UI en estado de spinner.

### Fix aplicado

1. **Liberación defensiva del estado de ensuring**
   - Se fuerza `setIsEnsuringPlans(false)` al finalizar el ciclo, incluso si hubo cancelación local del efecto.

2. **Guard anti-loop por firma de sesiones faltantes**
   - Se agregó un `useRef<Set<string>>` con firmas de sesiones faltantes (`missingSignature`).
   - Si el mismo set de faltantes reaparece, se evita entrar en bucle de reintentos automáticos y se muestra error visible al usuario.

3. **Timeout defensivo en generación por sesión**
   - `generatePlanForSession` ahora usa timeout (120s) con `Promise.race`.
   - Si la edge function no responde, se corta el ciclo con error explícito (en lugar de spinner infinito).

4. **Retry manual limpio**
   - Al presionar reintento, se limpia el registro de firmas intentadas para permitir un nuevo ciclo controlado.

### Dónde

- `src/pages/PlanificacionWorkspace.tsx`
  - efecto de auto-generation (`useEffect` de faltantes),
  - `generatePlanForSession` (timeout),
  - `handleRetryGeneration` (reset de guardas).

---

## 3) Restauración del nivel de detalle del reporte IA

### Problema detectado

El reporte narrativo (`ai_design_report`) podía quedar corto/genérico en algunos casos, perdiendo el nivel de detalle esperado en producción.

### Cambios aplicados (sin aumentar cómputo)

1. **Umbral de aceptación de narrativa más exigente**
   - Si la narrativa recibida es corta, no se toma como final automáticamente.

2. **Generador narrativo determinista más rico**
   - Se enriqueció `buildTeacherReportNarrative(...)` para producir un texto más completo y específico:
     - contexto de sesión y secuencia,
     - foco de contenido y justificación,
     - operacionalización de competencias,
     - evidencia de aprendizaje esperada,
     - uso de fuentes/materiales y alineación ANEP.
   - Resultado: mayor densidad pedagógica sin añadir llamadas extra por defecto.

3. **Consistencia de requisitos en prompt**
   - Se alineó la guía de longitud del ejemplo JSON a 400–600 palabras para reducir ambigüedad con las reglas del prompt.

### Dónde

- `supabase/functions/generate-plan-completo/index.ts`
  - función `buildTeacherReportNarrative`,
  - texto de referencia de longitud narrativa en el prompt JSON.

---

## 4) Resumen de diff funcional (alto nivel)

- **Wizard loading copy:** texto principal actualizado.
- **Workspace estabilidad:** eliminado escenario de estado `isEnsuringPlans` atascado + anti-loop + timeout por sesión.
- **Reporte IA:** narrativa final más detallada y consistente con contexto pedagógico.

---

## 5) Pruebas manuales sugeridas

1. Ir a crear planificación nueva (`/planificacion/nuevo`).
2. Completar wizard y finalizar.
3. Verificar en pantalla de generación:
   - aparece como mensaje principal:  
     **"Aguarda un instante mientras generamos las clases. Esperamos no demorar mucho."**
4. Al terminar, entrar al workspace:
   - no debe quedar spinner infinito,
   - debe mostrarse contenido de sesiones cuando llega la respuesta.
5. Forzar un caso lento (material pesado o red inestable):
   - confirmar que, si se excede timeout, aparece error visible (no loading perpetuo).
6. Usar “Reintentar generación”:
   - confirmar que reintenta correctamente y no queda en loop silencioso.
7. Abrir panel de reporte IA de sesión:
   - verificar narrativa más extensa y específica (foco de sesión, continuidad, evidencia, competencias).
