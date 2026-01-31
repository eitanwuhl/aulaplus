# Checkpoint de Seguridad Pre-Cambios

> **Fecha**: 2026-01-31  
> **Propósito**: Verificar estado del repositorio antes de realizar cambios adicionales  
> **Tipo**: Safety Gate / Readiness Assessment

---

## 1) Estado de Git y Working Tree

### Resumen

**Estado general**: ✅ **Working tree tiene cambios, pero todos son documentación**

### Archivos Modificados

#### Archivos con Cambios (Staged/Unstaged)

1. **`docs/ARCHITECTURE_SSoT.md`** (Modified)
   - **Tipo**: Documentación
   - **Cambios**: Actualizaciones de alineación post-auditoría
   - **Contenido**: 
     - Actualización de fecha (Jan 26 → Jan 31)
     - Actualización de ubicación groupContext (utils → services)
     - Agregado disclaimer sobre conteos indicativos
     - Documentación de `ensure-demo-users` edge function
   - **Riesgo**: Ninguno (solo documentación)
   - **Recomendación**: ✅ **Seguro para commit**

#### Archivos No Rastreados (Untracked)

1. **`docs/PROJECT_ARCHITECTURE_OVERVIEW.md`** (Untracked)
   - **Tipo**: Documentación (nueva)
   - **Propósito**: Documentación exhaustiva de arquitectura para onboarding
   - **Riesgo**: Ninguno
   - **Recomendación**: ✅ **Seguro para commit**

2. **`docs/changes/2026-01-31_arch_overview_audit.md`** (Untracked)
   - **Tipo**: Documentación (reporte de auditoría)
   - **Propósito**: Registro de hallazgos de auditoría de documentación
   - **Riesgo**: Ninguno
   - **Recomendación**: ✅ **Seguro para commit**

3. **`docs/changes/2026-01-31_update_ssot_alignment.md`** (Untracked)
   - **Tipo**: Documentación (reporte de cambios)
   - **Propósito**: Registro de cambios aplicados al SSoT
   - **Riesgo**: Ninguno
   - **Recomendación**: ✅ **Seguro para commit**

### Clasificación

- **Documentación solamente**: 4 archivos ✅
- **Cambios de código/config**: 0 archivos ✅
- **Cambios de runtime**: 0 archivos ✅

### Recomendación Git

**Estado**: ✅ **Seguro para commit**

Todos los cambios son documentación. No hay cambios en código de aplicación, configuración crítica, o lógica de runtime.

**Acción sugerida**: 
```bash
git add docs/
git commit -m "docs: Update architecture documentation (SSoT alignment + overview + audit reports)"
```

---

## 2) Verificación de Consistencia Arquitectónica

### SSoT vs Overview: Verificación de Referencias Críticas

#### ✅ groupContext - CONSISTENTE

**SSoT** (`docs/ARCHITECTURE_SSoT.md`):
- Guardrail #10: `src/services/groupContext/provider.ts` ✅
- Known Gap #4: `src/services/groupContext/provider.ts` ✅
- Nota: `src/utils/groupContext.ts` está deprecado ✅

**Overview** (`docs/PROJECT_ARCHITECTURE_OVERVIEW.md`):
- Sección C: `src/services/groupContext/provider.ts` ✅
- Sección D: Nota sobre deprecación ✅
- Sección E: Referencia correcta en flujos ✅

**Estado**: ✅ **Consistente** - Ambos documentos referencian la ubicación correcta.

#### ⚠️ Retry baseDelay - INCONSISTENCIA MENOR

**SSoT** (`docs/ARCHITECTURE_SSoT.md` línea 128):
- Dice: "base delay: 2000ms"

**Código real** (`supabase/functions/generate-plan-completo/index.ts` línea 12):
- Usa: `baseDelay = 1000`

**Overview** (`docs/PROJECT_ARCHITECTURE_OVERVIEW.md`):
- Documentado correctamente como 1000ms ✅

**Estado**: ⚠️ **Inconsistencia menor** - SSoT tiene valor incorrecto, pero no afecta guardrails críticos.

**Impacto**: Bajo - El valor real en código es el que se ejecuta. La documentación incorrecta puede confundir, pero no rompe funcionalidad.

**Recomendación**: Corregir en futura actualización del SSoT (no crítico).

#### ✅ Edge Functions - CONSISTENTE

**SSoT**:
- Menciona 4 core + 1 demo auxiliary (`ensure-demo-users`) ✅
- Documenta `ensure-demo-users` como demo-only ✅

**Overview**:
- Lista 5 edge functions ✅
- Documenta `ensure-demo-users` ✅

**Estado**: ✅ **Consistente**

#### ✅ Guardrails Críticos - CONSISTENTES

Ambos documentos coinciden en:
- Plan parser backward compatibility (CRÍTICO) ✅
- Explicit save pattern ✅
- Soft delete pattern ✅
- RLS policies ✅
- AI generation contract ✅

**Estado**: ✅ **Consistente** - No hay contradicciones en guardrails críticos.

### Resumen de Consistencia

| Área | Estado | Notas |
|------|--------|-------|
| groupContext ubicación | ✅ Consistente | Ambos documentos correctos |
| Retry baseDelay | ⚠️ Menor discrepancia | SSoT incorrecto, código correcto |
| Edge Functions | ✅ Consistente | Ambos correctos |
| Guardrails críticos | ✅ Consistente | Sin contradicciones |

**Estado general**: ✅ **Consistente** - Una inconsistencia menor no crítica.

---

## 3) Inventario de Áreas Deprecadas y Riesgosas

### Áreas Deprecadas (Read-Only Inventory)

#### 1. `src/utils/groupContext.ts` - DEPRECADO

**Estado**: Deprecado pero activo (wrapper para compatibilidad)

**Evidencia**:
- Comentario `@deprecated` en líneas 4-12
- Documentación: "Use `getGroupContextForAI()` from `@/services/groupContext/provider` instead"
- Wrapper que delega a `provider.ts`

**Uso actual**:
- **4 archivos** aún importan desde `@/utils/groupContext`:
  1. `src/pages/PlanificacionWorkspace.tsx` (línea 19)
  2. `src/pages/PlanificacionWizard.tsx` (línea 18)
  3. `src/hooks/useFullSessionGeneration.ts` (línea 5)
  4. `src/components/planificacion/EditorSesionNuevo.tsx` (línea 15)

**Riesgo**: Medio
- Código legacy que debería migrarse
- Funciona correctamente (es wrapper), pero crea deuda técnica
- No rompe funcionalidad actual

**Recomendación**: Migrar imports en futura refactorización planificada.

---

### Configuraciones Riesgosas (Demo Mode)

#### 1. `verify_jwt = false` en Edge Functions

**Ubicaciones**:

1. **`supabase/config.toml`**:
   - `generate-plan-completo`: `verify_jwt = false` (línea 7)
   - `generate-bulletin-text`: `verify_jwt = false` (línea 4)

2. **`supabase/functions/ensure-demo-users/config.toml`**:
   - `verify_jwt = false` (línea 7)

3. **`modify-evaluation` y `extract-material-text`**:
   - Sin `config.toml` propio (usan default, probablemente `true`)

**Riesgo**: 🔴 **ALTO** (solo en demo mode)

**Impacto**:
- Cualquiera que conozca la URL puede invocar funciones
- Posible abuso de costos de OpenAI
- **NO PRODUCTION-READY**

**Estado actual**: Documentado como "demo mode" en SSoT y Overview ✅

**Recomendación**: ⚠️ **NO cambiar hasta implementar autenticación real**

---

#### 2. Autenticación Demo-Only

**Ubicación**: `src/contexts/AuthContext.tsx`

**Características**:
- Cualquier credencial es aceptada (validación: no vacías)
- Todos los usuarios comparten mismo usuario Supabase:
  - Email: `demo.teacher@example.com`
  - Password: `DemoPassword2024!`
- Auto-login en background

**Riesgo**: 🔴 **ALTO** (solo en demo mode)

**Impacto**:
- No hay aislamiento real de usuarios
- No production-ready

**Estado actual**: Documentado como "Known Gap #1" en SSoT ✅

**Recomendación**: ⚠️ **NO cambiar hasta planificar migración a autenticación real**

---

#### 3. Modelo Híbrido de Datos

**Ubicación**: `src/services/groupContext/provider.ts`

**Características**:
- Estudiantes en `mockData.ts` (no en base de datos)
- `teacher_sugerencias` en Supabase
- Contemplaciones en localStorage

**Riesgo**: 🟡 **MEDIO**

**Impacto**:
- Migración futura requerida
- No afecta funcionalidad actual
- Documentado como "Known Gap #4" en SSoT ✅

**Recomendación**: ✅ **Seguro para continuar** - Planificar migración a futuro

---

### Otras Áreas de Riesgo Conocidas

#### 4. Sin Infraestructura de Testing

**Estado**: No hay Jest/Vitest configurado

**Riesgo**: 🟡 **MEDIO**

**Impacto**: Cambios pueden romper funcionalidad sin detección

**Documentado**: "Known Gap #2" en SSoT ✅

**Recomendación**: ⚠️ **Considerar antes de refactorizaciones grandes**

#### 5. Parsing HTML Frágil

**Ubicación**: `src/lib/planParser.ts`

**Características**: Regex-based parsing

**Riesgo**: 🟡 **MEDIO**

**Impacto**: Cambios en formato de salida de IA pueden romper parser

**Documentado**: "Known Gap #3" en SSoT ✅

**Recomendación**: ⚠️ **Cuidado al modificar prompts de IA**

---

## 4) Evaluación de Preparación (Readiness Assessment)

### A) ¿Es Seguro Refactorizar Código Deprecado?

**Respuesta**: ✅ **SÍ, con precauciones**

**Justificación**:
- `src/utils/groupContext.ts` está bien documentado como deprecado
- Es wrapper que delega a `provider.ts`, por lo que funciona correctamente
- 4 archivos aún lo usan, pero pueden migrarse de forma incremental
- No hay dependencias circulares o problemas de arquitectura

**Precauciones requeridas**:
1. Migrar imports uno por uno, probando después de cada cambio
2. Verificar que `loadGroupContext` (función deprecada) solo se usa en UI, no en generación IA
3. Mantener wrapper durante período de transición

**Recomendación**: ✅ **Proceder con refactorización planificada**

---

### B) ¿Es Seguro Cambiar Autenticación / Seguridad?

**Respuesta**: ❌ **NO, sin planificación exhaustiva**

**Justificación**:
- Sistema actual es demo-only con `verify_jwt = false`
- Cambiar autenticación afecta:
  - Todas las rutas protegidas
  - Edge functions (requiere habilitar JWT)
  - Flujo de creación de perfiles
  - Persistencia de sesión
- No hay testing infrastructure para validar cambios
- Riesgo alto de romper funcionalidad existente

**Requisitos antes de proceder**:
1. Plan detallado de migración
2. Testing infrastructure configurada
3. Estrategia de rollback
4. Validación exhaustiva de todos los flujos

**Recomendación**: ❌ **NO proceder sin planificación exhaustiva**

---

### C) ¿Es Seguro Modificar Lógica de Generación IA?

**Respuesta**: ⚠️ **CON PRECAUCIÓN EXTREMA**

**Justificación**:
- Generación IA es guardrail crítico (#6 en SSoT)
- Cambios afectan:
  - Contrato de respuesta (`{ plan_html, argumento_competencias, recursos, titulo }`)
  - Estructura HTML requerida (`<section id="plan">` con H1, H2)
  - Parser HTML (regex-based, frágil)
- Backward compatibility es CRÍTICA (debe parsear planes existentes)

**Precauciones requeridas**:
1. ✅ Cambios aditivos solamente (no romper estructura existente)
2. ✅ Probar con planes guardados existentes
3. ✅ Validar que parser sigue funcionando
4. ⚠️ Considerar impacto en prompts (afecta todas las generaciones futuras)
5. ⚠️ Documentar cambios en contrato si es necesario

**Recomendación**: ⚠️ **Proceder con precaución extrema, validar backward compatibility**

---

## 5) Recomendación Final

### Estado General del Proyecto

**Estado**: ✅ **SEGURO PARA PROCEDER** (con precauciones específicas)

### Desglose por Categoría

| Categoría | Estado | Justificación |
|-----------|--------|---------------|
| **Git/Working Tree** | ✅ Seguro | Solo cambios de documentación |
| **Consistencia Arquitectónica** | ✅ Seguro | Consistente, una discrepancia menor no crítica |
| **Refactorización Deprecado** | ✅ Seguro | Código bien documentado, migración incremental posible |
| **Cambios de Autenticación** | ❌ No Seguro | Requiere planificación exhaustiva |
| **Modificaciones IA** | ⚠️ Con Precaución | Guardrail crítico, validar backward compatibility |

### Qué Puede Hacerse Seguramente

1. ✅ **Commit de documentación actual**
   - Todos los archivos de documentación son seguros para commit
   - No hay cambios en código de aplicación

2. ✅ **Refactorización de código deprecado**
   - Migrar imports de `groupContext` de utils a services
   - Hacerlo incrementalmente, probando después de cada cambio

3. ✅ **Cambios en UI/componentes no críticos**
   - Componentes que no afectan guardrails críticos
   - Cambios que no modifican contratos de API

4. ⚠️ **Modificaciones a generación IA (con precauciones)**
   - Cambios aditivos solamente
   - Validar backward compatibility
   - Probar con planes existentes

### Qué NO Debe Hacerse Aún

1. ❌ **Cambios a autenticación/seguridad**
   - Requiere planificación exhaustiva
   - Necesita testing infrastructure
   - Alto riesgo de romper funcionalidad

2. ❌ **Cambios breaking a contratos de IA**
   - Modificar estructura de respuesta
   - Cambiar formato HTML requerido
   - Romper backward compatibility del parser

3. ❌ **Eliminar código deprecado sin migración**
   - `src/utils/groupContext.ts` aún se usa en 4 archivos
   - Debe migrarse primero, luego eliminar

### Próximos Pasos Recomendados

**Inmediato** (Seguro):
1. Commit de documentación actual
2. Revisar y aprobar cambios de documentación

**Corto Plazo** (Seguro con precauciones):
1. Migrar imports de `groupContext` (refactorización incremental)
2. Corregir discrepancia menor en SSoT (retry baseDelay)

**Mediano Plazo** (Requiere planificación):
1. Configurar testing infrastructure
2. Planificar migración de autenticación
3. Considerar migración de estudiantes a DB

**Largo Plazo** (Requiere arquitectura):
1. Implementar autenticación real
2. Habilitar `verify_jwt = true` en edge functions
3. Migrar modelo híbrido a Supabase completo

---

## 6) Resumen Ejecutivo

### Declaración de Seguridad

**¿Es seguro proceder con desarrollo adicional?**

**Respuesta**: ✅ **SÍ, SEGURO PARA PROCEDER** (con precauciones específicas)

**Condiciones**:
- ✅ Working tree limpio después de commit de documentación
- ✅ No tocar autenticación/seguridad sin planificación
- ✅ Validar backward compatibility en cambios de IA
- ✅ Refactorización incremental de código deprecado

**Riesgos Conocidos**:
- 🔴 Autenticación demo-only (documentado, no cambiar aún)
- 🔴 `verify_jwt = false` en funciones (documentado, no cambiar aún)
- 🟡 Código deprecado en uso (migración planificada)
- 🟡 Sin testing infrastructure (considerar antes de cambios grandes)

**Estado de Documentación**:
- ✅ SSoT actualizado y consistente
- ✅ Overview completo y verificado
- ✅ Auditorías documentadas
- ⚠️ Una discrepancia menor (retry baseDelay) - no crítica

---

## 7) Checklist de Verificación

Antes de proceder con cambios, verificar:

- [x] Git working tree limpio (después de commit de docs)
- [x] SSoT y Overview consistentes en guardrails críticos
- [x] Áreas deprecadas identificadas y documentadas
- [x] Configuraciones riesgosas documentadas
- [x] Readiness assessment completado
- [x] Recomendaciones claras para cada categoría de cambio

**Estado**: ✅ **Checkpoint completado**

---

**Fin del Informe de Checkpoint de Seguridad**
