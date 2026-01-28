# Resumen de Cambios - SSoT Hardening y Configuración Cursor

> **Fecha**: 26 de enero de 2026  
> **Contexto**: Configuración del Architecture Single Source of Truth (SSoT) como referencia siempre activa en Cursor

---

## Archivos Creados

### 1. `docs/ARCHITECTURE_SSoT.md` (NUEVO - ~371 líneas)
**Propósito**: Documento compacto y operacional que sirve como Single Source of Truth para la arquitectura del proyecto.

**Contenido principal**:
- Descripción del sistema (una línea)
- Mapa del repositorio (estructura de directorios y responsabilidades)
- Límites de runtime (frontend, Supabase, Edge Functions)
- Contratos primarios:
  - Invariantes de base de datos (explicit save, soft delete, user isolation, etc.)
  - Contratos de edge functions (request/response shapes para cada función)
  - Contrato de parsing (planParser con backward compatibility crítica)
- Guardrails (top 10 cosas que NO deben romperse)
- Guía "Dónde cambiar cosas" (patrones comunes de cambios)
- Gaps conocidos (demo auth, no testing, parsing frágil, etc.)
- Variables de entorno
- Referencias a archivos clave

**Correcciones realizadas durante validación**:
- ✅ Corregido modelo de `modify-evaluation`: era "gpt-4o-mini (default), fallback gpt-4.1-2025-04-14" → ahora "gpt-5-mini-2025-08-07 (if type === 'chat'), gpt-4.1-2025-04-14 (otherwise)"
  - Evidencia: `supabase/functions/modify-evaluation/index.ts:600`

### 2. `.cursor/rules/ARCHITECTURE_SSoT.md` (NUEVO - ~139 líneas)
**Propósito**: Reglas detalladas de Cursor que hacen cumplir el SSoT como contrato primario.

**Contenido**:
- Referencia primaria al SSoT (siempre leer antes de cambios)
- Verificaciones obligatorias antes de cambios de código
- Enforcement de guardrails (top 10)
- Requisitos de análisis de impacto para cambios en áreas críticas
- Patrones comunes de cambio (agregar página, modificar DB, etc.)
- Checklist de prevención de errores
- Instrucciones sobre qué hacer si hay dudas

**Áreas que requieren análisis de impacto**:
- `src/lib/planParser.ts` (backward compatibility crítica)
- `supabase/functions/*` (contratos de edge functions)
- Migraciones/RLS de base de datos
- `src/lib/contemplaciones/*` (sistema de contemplaciones)
- `src/contexts/AuthContext.tsx` (autenticación)
- `src/utils/groupContext.ts` (carga de grupos)

### 3. `.cursorrules` (NUEVO - ~47 líneas)
**Propósito**: Archivo de reglas legacy de Cursor para compatibilidad con versiones antiguas.

**Contenido**:
- Versión compacta que referencia el SSoT
- Guardrails principales (top 5)
- Patrones comunes
- Referencia al archivo de reglas detallado

**Formato**: Compatible con todas las versiones de Cursor (fallback si el formato de carpeta no funciona)

### 4. `AGENTS.md` (NUEVO - ~106 líneas)
**Propósito**: Referencia rápida operacional para agentes de IA y desarrolladores.

**Contenido**:
- Referencia primaria al SSoT
- Comandos comunes (dev/build/lint)
- Invariantes de alto riesgo (top 5)
- Referencias a archivos clave (entry points, core flows, data layer)
- Variables de entorno requeridas
- Gaps conocidos (sin duplicar toda la arquitectura)

**Diseño**: Compacto, solo información operacional esencial

### 5. `docs/changes/2026-01-26_cursor_context_ssot_setup.md` (NUEVO - ~215 líneas)
**Propósito**: Reporte completo de cambios de la sesión de configuración SSoT.

**Contenido**:
- Resumen de lo que cambió y por qué
- Lista completa de archivos creados/modificados
- Correcciones realizadas al SSoT (antes → después)
- Cómo usar las nuevas reglas en Cursor
- Riesgos y seguimientos
- Validación realizada contra el código
- Decisiones arquitectónicas (por qué dos formatos de reglas, etc.)

---

## Archivos Modificados

### 1. `docs/ARCHITECTURE.md` (ACTUALIZADO)
**Cambios**:
- ✅ Corregido retry delay: de "baseDelay=1000ms" → "baseDelay=2000ms" (línea 300)
  - Evidencia: `supabase/functions/generate-plan-completo/index.ts:291` usa `retryWithBackoff(..., 3, 2000)`

### 2. `docs/PROJECT_OVERVIEW.md` (ACTUALIZADO)
**Cambios**:
- ✅ Corregido fallback de modelo AI: aclarado que `generate-plan-completo` NO tiene fallback; solo `modify-evaluation` y `generate-bulletin-text` usan `gpt-4.1-2025-04-14` (líneas 176, 336, 834)
- ✅ Corregido retry delay: de "baseDelay=1000" → "baseDelay=2000" (línea 1407)
  - Evidencia: Código usa 2000ms, no 1000ms

### 3. `docs/ARCHITECTURE_SOT.md` (ACTUALIZADO)
**Cambios**:
- ✅ Corregido retry delay: de "baseDelay=1000ms" → "baseDelay=2000ms" (línea 300)

### 4. `docs/CHANGELOG_CURSOR.md` (ACTUALIZADO)
**Cambios**:
- ✅ Agregada sección completa "SSoT Hardening Session (January 26, 2026)"
- ✅ Documentadas todas las correcciones realizadas
- ✅ Listados hechos verificados (sin cambios necesarios)
- ✅ Documentadas incógnitas restantes

---

## Validaciones Realizadas

### Contra el Código Real

✅ **Verificado**:
- Contratos de edge functions coinciden con código (request/response shapes)
- Nombres de modelos coinciden con código (`gpt-4o-mini`, `gpt-5-mini-2025-08-07`, `gpt-4.1-2025-04-14`)
- Lógica de retry coincide con código (3 intentos, 2000ms base delay)
- Configuración de temperature coincide con código (0.7)
- Max tokens: No está configurado en código (usa defaults de OpenAI) - correcto
- Rutas de archivos existen y son correctas
- Invariantes de base de datos coinciden con migraciones
- Guardrails son precisos

✅ **Corregido**:
- Descripción del modelo de `modify-evaluation` (estaba incorrecta)
- Retry delay en múltiples documentos (estaba como 1000ms, es 2000ms)
- Claims de fallback de modelo AI (aclarados correctamente)

---

## Cómo Funciona el Sistema

### Flujo de Trabajo con Cursor

1. **Agente recibe solicitud de cambio**
2. **Cursor carga reglas automáticamente**:
   - Formato moderno: `.cursor/rules/ARCHITECTURE_SSoT.md`
   - Formato legacy: `.cursorrules` (fallback)
3. **Agente debe**:
   - Leer `docs/ARCHITECTURE_SSoT.md` primero
   - Identificar restricciones relevantes
   - Proporcionar análisis de impacto si toca guardrails
   - Implementar cambio de forma mínima y segura
   - Actualizar SSoT si cambian contratos
   - Crear reporte de cambios

### Guardrails Enforzados

Los siguientes cambios **requieren análisis de impacto obligatorio**:
- Modificar `src/lib/planParser.ts` (backward compatibility crítica)
- Modificar `supabase/functions/*` (contratos de edge functions)
- Modificar migraciones/RLS (invariantes de datos)
- Modificar `src/lib/contemplaciones/*` (estabilidad del catálogo)
- Modificar `src/contexts/AuthContext.tsx` (flujo de auth)
- Modificar `src/utils/groupContext.ts` (carga de grupos)

---

## Impacto

### Antes
- Documentación arquitectónica dispersa
- Sin enforcement automático de contratos
- Riesgo de romper invariantes críticos
- Sin referencia única de verdad

### Después
- ✅ SSoT único y validado contra código real
- ✅ Reglas de Cursor que hacen cumplir contratos
- ✅ Referencia rápida para agentes (AGENTS.md)
- ✅ Proceso claro para cambios seguros
- ✅ Documentación de cambios obligatoria

---

## Archivos Clave para Referencia

**Para entender la arquitectura**:
- `docs/ARCHITECTURE_SSoT.md` - Single Source of Truth (LEER PRIMERO)

**Para agentes de IA**:
- `AGENTS.md` - Referencia rápida operacional
- `.cursor/rules/ARCHITECTURE_SSoT.md` - Reglas detalladas
- `.cursorrules` - Reglas legacy (compatibilidad)

**Para desarrolladores**:
- `docs/ARCHITECTURE.md` - Documentación arquitectónica completa
- `docs/PROJECT_OVERVIEW.md` - Visión general del proyecto
- `docs/CHANGELOG_CURSOR.md` - Historial de cambios

**Para cambios específicos**:
- `docs/changes/2026-01-26_cursor_context_ssot_setup.md` - Reporte de esta sesión

---

## Próximos Pasos Recomendados

1. **Probar enforcement**: Intentar modificar `src/lib/planParser.ts` y verificar que el agente referencia el SSoT
2. **Monitorear uso**: Verificar que los agentes consistentemente referencian el SSoT
3. **Mantener actualizado**: Actualizar SSoT cuando el código evolucione
4. **Iterar**: Ajustar reglas basándose en efectividad

---

**Este resumen puede compartirse con ChatGPT u otros agentes para contexto completo de los cambios realizados.**







