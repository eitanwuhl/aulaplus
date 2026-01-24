# Resumen Ejecutivo: Corrección de Session Briefs

**Fecha**: 28 de diciembre de 2024  
**Estado**: ✅ Implementado y listo para testing

---

## Problema Reportado

El usuario reportó que después de ingresar "temas de clase por sesión" (session briefs) en el wizard:
1. Las sesiones generadas **NO reflejaban** esos temas
2. La UI (calendario/tarjetas) **NO mostraba** los temas en ningún lugar

---

## Causa Raíz (3 Problemas Críticos)

### 1. ⚠️ Prompt Débil en Edge Function
El prompt mencionaba el sessionBrief pero no lo hacía **obligatorio** en el H1 generado. La IA podía reformular o ignorar el tema ingresado por el docente.

### 2. ❌ Campo `titulo` No Se Actualizaba (CRÍTICO)
Después de generar el plan, se actualizaban múltiples campos (`plan_desarrollo`, `argumento_competencias`, `recursos`), pero **NO se actualizaba** el campo `titulo` de la sesión, que es lo que muestra la UI.

### 3. ❌ UI No Usaba `session_brief`
Los componentes (calendario, backlog, workspace) mostraban `sesion.titulo` que era `null`, sin verificar si existía `sesion.session_brief` en la base de datos.

---

## Solución Implementada

### Cambio 1: Edge Function - Prompt Endurecido
**Archivo**: `supabase/functions/generate-plan-completo/index.ts`

**Modificaciones**:
- Cambió "CRÍTICO" → "CRÍTICO - OBLIGATORIO"
- Ahora dice explícitamente: *"El título H1 DEBE SER EXACTAMENTE este sessionBrief, palabra por palabra"*
- Agregó: *"Si sessionBrief existe, SIEMPRE tiene prioridad sobre cualquier otro título"*
- Agregó lógica de extracción del H1 del HTML generado
- Devuelve `titulo` en el JSON response

### Cambio 2: Backend - Persistir `titulo`
**Archivo**: `src/pages/PlanificacionWizard.tsx`

**Modificaciones**:
```typescript
// ANTES: titulo NO se actualizaba
.update({
  plan_desarrollo: { html_completo: data.plan_html },
  argumento_competencias: data.argumento_competencias,
  // ... otros campos
  // ❌ titulo: FALTABA
})

// DESPUÉS: titulo se actualiza con prioridad
if (data.titulo) {
  updatePayload.titulo = data.titulo;  // Extraído del HTML
} else if (sessionBrief) {
  updatePayload.titulo = sessionBrief;  // Fallback al input del docente
}
```

**Lógica de Prioridad**:
1. **Primera prioridad**: `data.titulo` (extraído del HTML generado por la IA)
2. **Fallback**: `sessionBrief` (input directo del docente)

### Cambio 3: UI - Mostrar `session_brief`
**Archivos**: 
- `src/components/planificacion/CalendarioDnD.tsx`
- `src/components/planificacion/BacklogSesiones.tsx`
- `src/pages/PlanificacionWorkspace.tsx`

**Modificaciones**:
```tsx
// ANTES: Solo mostraba titulo (que era null)
<span>{sesion.titulo || `Sesión ${sesion.orden}`}</span>

// DESPUÉS: Prioriza session_brief
<span>{sesion.session_brief || sesion.titulo || `Sesión ${sesion.orden}`}</span>

// PLUS: Muestra contenido ANEP como línea secundaria cuando hay session_brief
{sesion.session_brief && sesion.contenidos_anep?.[0] && (
  <span className="text-xs text-muted-foreground">
    Contenido ANEP: {sesion.contenidos_anep[0]}
  </span>
)}
```

**Prioridad de Visualización**:
1. **Primera prioridad**: `session_brief` (tema del docente)
2. **Segunda prioridad**: `titulo` (extraído del HTML)
3. **Fallback**: `"Sesión N"`

---

## Flujo Completo (End-to-End)

```
1. Usuario ingresa temas en Wizard Step 2
   → wizardData.enfoque.sessionBriefs = ["Tema 1", "Tema 2", ...]

2. handleFinish() persiste a DB ANTES de generar
   → sesiones_clase.session_brief = "Tema N"

3. generarPlanesAutomaticamente() envía sessionBrief en payload
   → { ..., sessionBrief: "Tema N" }

4. Edge Function (generate-plan-completo):
   a) Recibe sessionBrief
   b) Prompt OBLIGA a usar sessionBrief como H1 exacto
   c) OpenAI genera HTML con H1 = "Tema N"
   d) Extrae H1 del HTML generado
   e) Devuelve { plan_html, recursos, titulo: "Tema N" }

5. PlanificacionWizard actualiza DB:
   → sesiones_clase.titulo = data.titulo || sessionBrief

6. UI muestra:
   → session_brief || titulo || "Sesión N"
```

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `supabase/functions/generate-plan-completo/index.ts` | Prompt endurecido + extracción de título |
| `src/pages/PlanificacionWizard.tsx` | Actualización de campo `titulo` |
| `src/components/planificacion/CalendarioDnD.tsx` | Mostrar `session_brief` primero |
| `src/components/planificacion/BacklogSesiones.tsx` | Mostrar `session_brief` primero |
| `src/pages/PlanificacionWorkspace.tsx` | Mostrar `session_brief` primero |
| `docs/phase3_2_1_session_brief_fix.md` | Documentación técnica completa |

---

## Compatibilidad Hacia Atrás

✅ **100% Compatible**

| Escenario | Comportamiento |
|-----------|----------------|
| Sin session brief | IA genera título basado en contenido ANEP (sin cambios) |
| Con session brief | IA usa sessionBrief exacto como H1 (nuevo) |
| Sesiones viejas (sin session_brief en DB) | Muestra `titulo` o fallback "Sesión N" (sin cambios) |
| Edge Function falla extracción | Fallback a sessionBrief en PlanificacionWizard (seguro) |

**Garantías**:
- Sin cambios destructivos en sesiones existentes
- Sin migraciones de BD requeridas
- Todos los cambios son aditivos

---

## Plan de Testing Manual

### Test 1: Generación Completa con Session Briefs
1. Crear plan con 10 sesiones
2. Ingresar 10 temas en "Tema de cada clase (opcional)"
3. Generar plan automáticamente
4. **Verificar**:
   - ✅ DB tiene `session_brief` y `titulo` por cada sesión
   - ✅ Consola muestra logs de extracción de título
   - ✅ HTML generado tiene H1 coincidente con sessionBrief
   - ✅ UI (calendario/backlog) muestra los temas

### Test 2: Verificar UI Display (Calendario)
1. Navegar a PlanificacionWorkspace del plan generado
2. Ver calendario
3. **Verificar**:
   - ✅ Tarjetas muestran session brief como título principal
   - ✅ Contenido ANEP aparece como línea secundaria
   - ✅ NO se muestra "Sesión N" cuando hay session_brief

### Test 3: Backward Compatibility
1. Crear plan **sin** ingresar session briefs
2. Generar plan
3. **Verificar**:
   - ✅ Generación funciona normalmente
   - ✅ Títulos generados por IA basados en contenido ANEP
   - ✅ Sin errores

### Test 4: Session Briefs Parciales
1. Crear plan con 10 sesiones
2. Ingresar session briefs **solo para sesiones 1, 3, 5, 7, 9**
3. Generar plan
4. **Verificar**:
   - ✅ Sesiones con brief: muestran tema del docente
   - ✅ Sesiones sin brief: muestran título generado por IA
   - ✅ Sin errores

### Test 5: Verificar Prompt Enforcement
1. Generar sesión con sessionBrief = "La Revolución Industrial en Inglaterra"
2. Inspeccionar HTML generado en BD
3. **Verificar**:
   - ✅ H1 es **EXACTAMENTE** "La Revolución Industrial en Inglaterra"
   - ✅ Sin reformulaciones ni interpretaciones

---

## Logs de Consola Agregados

### Edge Function
```typescript
console.log('[generate-plan-completo] Extracted title:', extractedTitle);
```

### PlanificacionWizard
```typescript
console.log(`Guardando para sesión ${sesion.orden}:`, {
  contenido: contenidosSesion[0]?.substring(0, 40),
  competencias: competenciasSesion.length,
  titulo: data.titulo || sessionBrief || '(sin título)'
});
```

**Propósito**: Verificar que títulos se extraen y persisten correctamente.

---

## Queries de Verificación (Supabase SQL)

```sql
-- Verificar session_brief y titulo persisten
SELECT orden, session_brief, titulo 
FROM sesiones_clase 
WHERE planificacion_id = 'YOUR_PLAN_ID'
ORDER BY orden;

-- Debería mostrar: session_brief y titulo coincidentes para todas las sesiones con tema ingresado
```

---

## Próximos Pasos (Implementador)

1. ✅ **Deploy Edge Function**:
   ```bash
   supabase functions deploy generate-plan-completo
   ```

2. ✅ **Verificar frontend compilado sin errores**:
   ```bash
   npm run build
   ```

3. ⚠️ **Testing Manual**:
   - Ejecutar los 5 tests del plan de testing
   - Verificar logs en consola del navegador
   - Verificar datos en Supabase SQL Editor

4. 📊 **Validar con usuario**:
   - Crear plan real con 10 sesiones de Historia
   - Ingresar temas reales (ej: Batllismo)
   - Confirmar que temas aparecen en UI y coinciden con el plan generado

---

## Resultado Esperado

**ANTES**:
- ❌ Session briefs ignorados en generación
- ❌ `titulo` nunca actualizado
- ❌ UI mostraba "Sesión 1", "Sesión 2", etc.

**DESPUÉS**:
- ✅ Session briefs usados exactamente como H1
- ✅ `titulo` extraído y persistido
- ✅ UI muestra temas del docente
- ✅ Contenido ANEP como información secundaria

---

## Contacto

Si encuentras problemas durante el testing:
1. Revisar consola del navegador (logs de extracción)
2. Revisar logs de Edge Function en Supabase Dashboard
3. Ejecutar queries SQL de verificación
4. Reportar hallazgos con ejemplos concretos

---

**Documentación Técnica Completa**: Ver `docs/phase3_2_1_session_brief_fix.md`











