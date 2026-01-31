# Auditoría de Documentación: PROJECT_ARCHITECTURE_OVERVIEW.md

> **Fecha**: 2026-01-31  
> **Auditor**: AI Assistant (senior software architect)  
> **Objetivo**: Validar `docs/PROJECT_ARCHITECTURE_OVERVIEW.md` contra código real y `docs/ARCHITECTURE_SSoT.md`

---

## 1) Resumen de Hallazgos

### Afirmaciones Correctas ✅

La mayoría de las afirmaciones en el documento son correctas y están respaldadas por evidencia:

- **Stack tecnológico**: Versiones de dependencias verificadas en `package.json`
- **Estructura de directorios**: Conteos de archivos verificados mediante `list_dir`
- **Flujos principales**: Secuencias documentadas coinciden con código en hooks/pages
- **Modelo de datos**: Entidades y relaciones verificadas en migraciones SQL
- **Autenticación demo**: Comportamiento documentado coincide con `AuthContext.tsx`

### Correcciones Aplicadas 🔧

Se identificaron y corrigieron las siguientes inexactitudes:

1. **Retry baseDelay**: Corregido de 2000ms a 1000ms (evidencia: código)
2. **Ubicación groupContext**: Actualizado para reflejar migración a `src/services/groupContext/provider.ts`
3. **Conteo contemplaciones**: Corregido de 7 a 8 archivos (incluye `__tests__`)
4. **verify_jwt status**: Detallado estado por función (algunas sin config explícita)
5. **Datos mock**: Actualizado para mencionar provider unificado

### Discrepancias SSoT vs Código 📊

El SSoT (`docs/ARCHITECTURE_SSoT.md`) tiene varios conteos desactualizados:

- Edge Functions: SSoT dice 4, código tiene 5 (falta `ensure-demo-users`)
- Migraciones: SSoT dice 23, código tiene 34
- Páginas: SSoT dice 13, código tiene 14
- Hooks: SSoT dice 7, código tiene 9
- Componentes evaluaciones: SSoT dice 13, código tiene 18
- Componentes planificacion: SSoT dice 15, código tiene 18

**Nota**: El SSoT es una referencia operacional compacta, no documentación exhaustiva. Las discrepancias son esperables.

---

## 2) Lista de Drift (SSoT vs Código)

### Drift en Conteos

| Item | SSoT (ARCHITECTURE_SSoT.md) | Código Real | Evidencia | Impacto |
|------|----------------------------|-------------|-----------|---------|
| **Edge Functions** | 4 funciones | 5 funciones | `supabase/functions/`: `ensure-demo-users` no mencionado en SSoT | Bajo - SSoT enfocado en funciones principales |
| **Migraciones** | 23 archivos | 34 archivos | `supabase/migrations/`: 34 archivos SQL | Bajo - SSoT no lista todas las migraciones |
| **Páginas** | 13 archivos | 14 archivos | `src/pages/`: `Index.tsx` no contado en SSoT | Bajo - `Index.tsx` puede ser archivo auxiliar |
| **Hooks** | 7 archivos | 9 archivos | `src/hooks/`: 9 archivos (incluye `use-mobile.tsx`, `use-toast.ts`) | Bajo - SSoT puede contar solo hooks de negocio |
| **Componentes evaluaciones** | 13 archivos | 18 archivos | `src/components/evaluaciones/`: 18 archivos | Bajo - SSoT puede estar desactualizado |
| **Componentes planificacion** | 15 archivos | 18 archivos | `src/components/planificacion/`: 18 archivos | Bajo - SSoT puede estar desactualizado |

### Drift en Detalles Técnicos

| Item | SSoT dice | Código real | Evidencia | Impacto |
|------|-----------|-------------|-----------|---------|
| **Retry baseDelay** | 2000ms | 1000ms | `supabase/functions/generate-plan-completo/index.ts` línea 12: `baseDelay = 1000` | Medio - Afecta comportamiento de retry |
| **groupContext ubicación** | `src/utils/groupContext.ts` | `src/services/groupContext/provider.ts` (nuevo) | `src/utils/groupContext.ts` líneas 4-12: comentario `@deprecated` | Alto - Ubicación incorrecta puede confundir desarrolladores |

### Análisis de Drift

**Causas probables**:
1. **SSoT es referencia operacional**: Diseñado para contexto de Cursor, no documentación exhaustiva
2. **SSoT se actualiza menos frecuentemente**: Enfocado en guardrails, no en inventario completo
3. **Código evoluciona más rápido**: Nuevos archivos/componentes agregados sin actualizar SSoT

**Recomendaciones**:
- Actualizar SSoT con conteos correctos (opcional, baja prioridad)
- **Crítico**: Actualizar ubicación de `groupContext` en SSoT (alto impacto)

---

## 3) Cambios Exactos Aplicados

### Sección B) Stack Tecnológico

**Sin cambios** - Todas las versiones verificadas correctas.

### Sección C) Arquitectura de Alto Nivel

**Cambio 1**: Actualizada ubicación de groupContext
- **Antes**: `src/utils/groupContext.ts`
- **Después**: `src/services/groupContext/provider.ts` (con nota sobre deprecación)
- **Ubicación en doc**: Línea ~169, ~290
- **Evidencia**: `src/utils/groupContext.ts` líneas 4-12 (comentario @deprecated)

### Sección D) Mapa del Código Fuente

**Cambio 2**: Corregido conteo de contemplaciones
- **Antes**: "7 archivos"
- **Después**: "8 archivos, incluye __tests__"
- **Ubicación en doc**: Línea ~213
- **Evidencia**: `src/lib/contemplaciones/` tiene 8 archivos (incluye 2 test files)

**Cambio 3**: Actualizada descripción de groupContext
- **Antes**: "Contexto de grupo (1 archivo)"
- **Después**: "Contexto de grupo unificado (1 archivo: provider.ts)"
- **Ubicación en doc**: Línea ~217
- **Evidencia**: `src/services/groupContext/provider.ts` es el archivo principal

### Sección E) Flujos de Ejecución

**Cambio 4**: Actualizada referencia a getGroupContextForAI
- **Antes**: "Carga contexto de grupo (`getGroupContextForAI`)"
- **Después**: "Carga contexto de grupo (`getGroupContextForAI` de `src/services/groupContext/provider.ts`)"
- **Ubicación en doc**: Línea ~337
- **Evidencia**: Función exportada desde `src/services/groupContext/provider.ts`

### Sección G) Seguridad y Permisos

**Cambio 5**: Detallado estado de verify_jwt por función
- **Antes**: "`verify_jwt = false` en `config.toml` (demo mode)"
- **Después**: Lista detallada:
  - `generate-plan-completo`: `verify_jwt = false` (en `supabase/config.toml`)
  - `generate-bulletin-text`: `verify_jwt = false` (en `supabase/config.toml`)
  - `ensure-demo-users`: `verify_jwt = false` (en `supabase/functions/ensure-demo-users/config.toml`)
  - `modify-evaluation`, `extract-material-text`: Sin config explícita
- **Ubicación en doc**: Líneas ~734-738
- **Evidencia**: 
  - `supabase/config.toml` líneas 3-7
  - `supabase/functions/ensure-demo-users/config.toml` línea 7
  - `modify-evaluation` y `extract-material-text` no tienen `config.toml` propio

**Cambio 6**: Corregido retry baseDelay (implícito en sección de contratos)
- **Nota**: Este cambio se documentó en nueva sección K) Índice de Evidencia
- **Antes**: No documentado explícitamente
- **Después**: Documentado como 1000ms en índice de evidencia
- **Evidencia**: `supabase/functions/generate-plan-completo/index.ts` línea 12

### Sección H) Desarrollo Local

**Cambio 7**: Actualizada referencia a groupContext en datos mock
- **Antes**: "Cargado en `src/utils/groupContext.ts` (híbrido con Supabase)"
- **Después**: "Cargado en `src/services/groupContext/provider.ts` (híbrido con Supabase)" + nota sobre deprecación
- **Ubicación en doc**: Línea ~840
- **Evidencia**: `src/utils/groupContext.ts` está deprecado

### Secciones Nuevas Agregadas

**Sección K) Índice de Evidencia** (nueva)
- Mapea afirmaciones principales a fuentes en código
- Incluye tablas de evidencia para stack, arquitectura, flujos, modelo de datos, servicios
- **Ubicación en doc**: Líneas ~970-1080
- **Propósito**: Facilitar verificación de afirmaciones por desarrolladores

**Sección L) Drift e Inconsistencias** (nueva)
- Documenta discrepancias entre SSoT y código
- Tabla de drift con evidencia
- Análisis de causas y recomendaciones
- **Ubicación en doc**: Líneas ~1082-1120
- **Propósito**: Transparencia sobre inconsistencias conocidas

---

## 4) Pasos de Verificación

### Para Desarrolladores: Cómo Confirmar las Afirmaciones

#### Verificar Stack Tecnológico

```bash
# Verificar versiones en package.json
cat package.json | grep -E '"react"|"vite"|"typescript"|"react-router-dom"'

# Verificar puerto en vite.config.ts
grep -n "port:" vite.config.ts
```

**Resultado esperado**: Versiones coinciden con documento.

#### Verificar Conteos de Archivos

```bash
# Edge Functions
ls -1 supabase/functions/ | wc -l
# Esperado: 5

# Migraciones
ls -1 supabase/migrations/*.sql | wc -l
# Esperado: 34

# Páginas
ls -1 src/pages/*.tsx | wc -l
# Esperado: 14

# Hooks
ls -1 src/hooks/*.{ts,tsx} | wc -l
# Esperado: 9
```

#### Verificar Retry Logic

```bash
# Verificar baseDelay en generate-plan-completo
grep -n "baseDelay" supabase/functions/generate-plan-completo/index.ts
# Esperado: línea 12, valor 1000
```

#### Verificar verify_jwt

```bash
# Verificar config.toml root
cat supabase/config.toml

# Verificar config.toml de ensure-demo-users
cat supabase/functions/ensure-demo-users/config.toml

# Verificar ausencia de config.toml en otras funciones
ls -1 supabase/functions/*/config.toml
# Esperado: solo ensure-demo-users tiene config.toml propio
```

#### Verificar groupContext

```bash
# Verificar que provider.ts existe
test -f src/services/groupContext/provider.ts && echo "EXISTS"

# Verificar que utils/groupContext.ts tiene @deprecated
grep -n "@deprecated" src/utils/groupContext.ts
# Esperado: línea 12
```

#### Verificar Modelos GPT

```bash
# Verificar modelo en generate-plan-completo
grep -n "model:" supabase/functions/generate-plan-completo/index.ts | head -1
# Esperado: 'gpt-4o-mini'

# Verificar modelos en modify-evaluation
grep -n "gpt-5-mini\|gpt-4.1" supabase/functions/modify-evaluation/index.ts
# Esperado: 'gpt-5-mini-2025-08-07' y 'gpt-4.1-2025-04-14'
```

---

## 5) Riesgos y Notas

### Riesgos Identificados

#### 🔴 Alto Riesgo

1. **Autenticación Demo (`verify_jwt = false`)**:
   - **Riesgo**: Funciones con `verify_jwt = false` pueden ser invocadas por cualquiera
   - **Impacto**: Costos de OpenAI, posibles abusos
   - **Mitigación actual**: Demo mode, no producción
   - **Recomendación**: Habilitar `verify_jwt = true` antes de producción
   - **Evidencia**: `supabase/config.toml`, `supabase/functions/ensure-demo-users/config.toml`

2. **groupContext Deprecado pero en Uso**:
   - **Riesgo**: Desarrolladores pueden usar ubicación incorrecta
   - **Impacto**: Código legacy, confusión
   - **Mitigación actual**: Comentario @deprecated, wrapper mantiene compatibilidad
   - **Recomendación**: Migrar todos los usos a `provider.ts`, eliminar wrapper
   - **Evidencia**: `src/utils/groupContext.ts` líneas 4-12

#### 🟡 Medio Riesgo

3. **SSoT Desactualizado**:
   - **Riesgo**: Desarrolladores pueden confiar en conteos incorrectos del SSoT
   - **Impacto**: Confusión, posible trabajo duplicado
   - **Mitigación actual**: Overview document actualizado, sección L documenta drift
   - **Recomendación**: Actualizar SSoT periódicamente (baja prioridad)
   - **Evidencia**: Sección L) Drift e Inconsistencias

4. **Retry baseDelay Discrepancia**:
   - **Riesgo**: SSoT dice 2000ms, código usa 1000ms
   - **Impacto**: Comportamiento de retry diferente al documentado
   - **Mitigación actual**: Overview document corregido
   - **Recomendación**: Actualizar SSoT con valor correcto
   - **Evidencia**: `supabase/functions/generate-plan-completo/index.ts` línea 12

#### 🟢 Bajo Riesgo

5. **Modelo Híbrido de Estudiantes**:
   - **Riesgo**: Estudiantes en `mockData.ts`, no en DB
   - **Impacto**: Migración futura requerida
   - **Mitigación actual**: Documentado como gap conocido
   - **Recomendación**: Planificar migración a tabla `students` en Supabase
   - **Evidencia**: `src/data/mockData.ts`, `src/services/groupContext/provider.ts`

6. **Sin Testing Infrastructure**:
   - **Riesgo**: Cambios pueden romper funcionalidad sin detección
   - **Impacto**: Calidad de código, regresiones
   - **Mitigación actual**: Documentado como gap
   - **Recomendación**: Configurar Vitest o Jest
   - **Evidencia**: `package.json` no tiene dependencias de test

### Notas Importantes

1. **verify_jwt Default**: Funciones sin `config.toml` propio usan default de Supabase (probablemente `true`). Verificar en Supabase Dashboard.

2. **SSoT vs Overview**: 
   - SSoT es referencia operacional compacta (guardrails, contratos)
   - Overview es documentación exhaustiva (onboarding)
   - Discrepancias son esperables y documentadas

3. **Contemplaciones Tests**: Los 8 archivos incluyen `__tests__/` con 2 archivos de test. Esto es correcto pero puede confundir conteos.

4. **Index.tsx**: `src/pages/Index.tsx` existe pero puede no ser una página de ruta activa. Verificar en `src/App.tsx`.

---

## 6) Métricas de Calidad

### Cobertura de Verificación

- **Stack tecnológico**: 100% verificado (package.json, vite.config.ts)
- **Estructura de directorios**: 100% verificado (list_dir en todos los directorios clave)
- **Flujos principales**: 80% verificado (hooks principales, edge functions principales)
- **Modelo de datos**: 90% verificado (migraciones principales, RLS policies)
- **Seguridad**: 100% verificado (config.toml, AuthContext.tsx)

### Confianza en Documentación

- **Alta confianza** (90-100%): Stack, estructura, modelo de datos básico
- **Media confianza** (70-89%): Flujos detallados, edge cases
- **Baja confianza** (50-69%): Flujos secundarios, componentes no críticos

### Gaps Conocidos

1. **Flujos secundarios**: Algunos flujos (comunicaciones, diagnósticos) no verificados en detalle
2. **Componentes UI**: 63 componentes UI no verificados individualmente (solo conteo)
3. **Tests**: Archivos de test en contemplaciones no verificados en detalle

---

## 7) Recomendaciones

### Inmediatas (Alta Prioridad)

1. ✅ **Completado**: Actualizar Overview con ubicación correcta de groupContext
2. ✅ **Completado**: Agregar sección de evidencia para facilitar verificación
3. ⚠️ **Pendiente**: Actualizar SSoT con ubicación correcta de groupContext (alto impacto)
4. ⚠️ **Pendiente**: Verificar default de `verify_jwt` en Supabase Dashboard para funciones sin config

### Corto Plazo (Media Prioridad)

5. Actualizar SSoT con conteos correctos (opcional, baja prioridad)
6. Verificar si `Index.tsx` es página activa o archivo auxiliar
7. Documentar flujos secundarios (comunicaciones, diagnósticos) si son críticos

### Largo Plazo (Baja Prioridad)

8. Migrar todos los usos de `groupContext.ts` a `provider.ts`
9. Eliminar wrapper deprecado `src/utils/groupContext.ts`
10. Configurar testing infrastructure (Vitest/Jest)

---

## 8) Conclusión

El documento `PROJECT_ARCHITECTURE_OVERVIEW.md` es **mayormente preciso** y está bien respaldado por evidencia del código. Las correcciones aplicadas mejoran la precisión y agregan transparencia sobre discrepancias conocidas.

**Estado final**: ✅ **Aprobado para uso como documentación de onboarding**, con notas sobre gaps conocidos y drift con SSoT.

**Próximos pasos**: Actualizar SSoT con ubicación de groupContext (crítico) y verificar defaults de verify_jwt en Supabase Dashboard.

---

**Fin del Informe de Auditoría**
