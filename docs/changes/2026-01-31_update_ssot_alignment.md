# Actualización SSoT: Alineación con Auditoría

> **Fecha**: 2026-01-31  
> **Tipo**: Actualización mínima y dirigida del SSoT  
> **Justificación**: `docs/CHANGES/2026-01-31_arch_overview_audit.md`

---

## Resumen de Cambios

Se aplicaron **3 actualizaciones mínimas y dirigidas** a `docs/ARCHITECTURE_SSoT.md` para corregir ambigüedades de alto impacto identificadas en la auditoría de documentación.

**Principio rector**: Mantener el SSoT como referencia operacional compacta, no convertirlo en documentación exhaustiva.

---

## Cambios Aplicados

### A) Ubicación de groupContext

**Problema identificado**: El SSoT referenciaba `src/utils/groupContext.ts`, pero el código real migró a `src/services/groupContext/provider.ts`. El archivo antiguo está deprecado pero se mantiene por compatibilidad.

**Riesgo**: Desarrolladores podrían usar la ubicación incorrecta, causando confusión y código legacy.

**Cambios aplicados**:

1. **Repo Map** (línea ~32-33):
   - Agregado: `services/groupContext/` con nota "use provider.ts"
   - Actualizado: `utils/` con nota "groupContext deprecated, kept for backward compatibility"

2. **Guardrail #10** (línea ~245):
   - **Antes**: `src/utils/groupContext.ts`
   - **Después**: `src/services/groupContext/provider.ts`
   - Agregado: Nota sobre deprecación de `src/utils/groupContext.ts`

3. **Known Gap #4** (línea ~316):
   - **Antes**: `src/utils/groupContext.ts`
   - **Después**: `src/services/groupContext/provider.ts`
   - Agregado: Nota sobre deprecación

**Evidencia**: 
- `src/utils/groupContext.ts` líneas 4-12: comentario `@deprecated`
- `src/services/groupContext/provider.ts`: archivo principal actual
- Audit report sección 2: "Drift en Detalles Técnicos" - Alto impacto

---

### B) Edge Function `ensure-demo-users`

**Problema identificado**: El SSoT mencionaba "4 functions" pero el código tiene 5. La función `ensure-demo-users` no estaba documentada, causando ambigüedad sobre su propósito y estado.

**Riesgo**: Desarrolladores podrían no entender el propósito de esta función o intentar usarla en producción.

**Cambios aplicados**:

1. **Repo Map** (línea ~37):
   - **Antes**: `# Edge functions (4 functions)`
   - **Después**: `# Edge functions (4 core + 1 demo auxiliary: ensure-demo-users)`

2. **Edge Function Contracts** (después de `generate-bulletin-text`):
   - Agregada nueva sección para `ensure-demo-users`
   - Documentado como "Demo Only"
   - Nota explícita: "not used in production flows"

**Evidencia**:
- `supabase/functions/ensure-demo-users/`: función existe
- `supabase/functions/ensure-demo-users/config.toml`: `verify_jwt = false` (demo mode)
- Audit report sección 2: "Drift en Conteos" - Edge Functions: SSoT dice 4, código tiene 5

---

### C) Disclaimer sobre Conteos de Archivos

**Problema identificado**: El SSoT incluía conteos específicos de archivos (13 páginas, 7 hooks, etc.) que están desactualizados y pueden seguir cambiando. Esto crea expectativas incorrectas y requiere mantenimiento constante.

**Riesgo**: Desarrolladores pueden confiar en conteos incorrectos o esperar que el SSoT mantenga inventarios exhaustivos, contradiciendo su propósito como referencia operacional.

**Cambios aplicados**:

1. **Repo Map** (línea ~18):
   - Agregado disclaimer: "**Note**: File counts are indicative and may drift as the codebase evolves. Focus on structure and boundaries, not exact counts."

2. **Conteos específicos reemplazados**:
   - **Antes**: "(13 files)", "(7 files)", "(63 files)", etc.
   - **Después**: "(indicative count)" en todos los lugares

**Evidencia**:
- Audit report sección 2: Múltiples discrepancias en conteos (páginas: 13 vs 14, hooks: 7 vs 9, etc.)
- Audit report sección 2: "SSoT es referencia operacional compacta, no documentación exhaustiva"

---

## Secciones Editadas

| Sección | Líneas Aproximadas | Tipo de Cambio |
|---------|-------------------|-----------------|
| **Header** | 5 | Actualización de fecha |
| **Repo Map** | 18-39 | Disclaimer agregado, conteos cambiados a "indicative", estructura actualizada |
| **Edge Function Contracts** | ~160 | Nueva sección para `ensure-demo-users` |
| **Guardrail #10** | ~245-249 | Ubicación actualizada, nota de deprecación |
| **Known Gap #4** | ~316-320 | Ubicación actualizada, nota de deprecación |

**Total de cambios**: 5 secciones, ~15 líneas modificadas/agregadas

---

## Reducción de Riesgo Arquitectónico

### Riesgo Reducido: Ubicación Incorrecta de groupContext

**Antes**: 
- Desarrolladores podrían importar desde `src/utils/groupContext.ts` (deprecado)
- Confusión sobre cuál archivo usar
- Código legacy sin migrar

**Después**:
- Ubicación canónica clara: `src/services/groupContext/provider.ts`
- Nota explícita sobre deprecación
- Reducción de ambigüedad en punto de entrada crítico

**Impacto**: Alto - Afecta todos los flujos de generación IA

---

### Riesgo Reducido: Función Demo No Documentada

**Antes**:
- `ensure-demo-users` no mencionada en SSoT
- Desarrolladores podrían no entender su propósito
- Posible uso incorrecto en producción

**Después**:
- Función explícitamente documentada como "Demo Only"
- Nota clara: "not used in production flows"
- Conteo actualizado para reflejar función auxiliar

**Impacto**: Medio - Previene uso incorrecto de función demo

---

### Riesgo Reducido: Expectativas Incorrectas sobre Conteos

**Antes**:
- Conteos específicos crean expectativa de exactitud
- Desarrolladores pueden confiar en números desactualizados
- Mantenimiento constante requerido

**Después**:
- Disclaimer explícito: conteos son indicativos
- Enfoque en estructura, no en números exactos
- Alineado con propósito del SSoT (referencia operacional, no inventario)

**Impacto**: Medio - Reduce confusión y carga de mantenimiento

---

## Referencia a Auditoría

Todos los cambios están justificados por hallazgos en:

**`docs/CHANGES/2026-01-31_arch_overview_audit.md`**

### Secciones Específicas:

1. **groupContext**:
   - Sección 2: "Drift en Detalles Técnicos" - Tabla "groupContext ubicación"
   - Sección 3: "Cambio 1" - Actualización de ubicación
   - Sección 5: "Riesgo Reducido: groupContext Deprecado pero en Uso" (Alto riesgo)

2. **ensure-demo-users**:
   - Sección 2: "Drift en Conteos" - Tabla "Edge Functions"
   - Sección 1: "Discrepancias SSoT vs Código" - Edge Functions: SSoT dice 4, código tiene 5

3. **Conteos**:
   - Sección 2: "Drift en Conteos" - Múltiples discrepancias documentadas
   - Sección 1: "Discrepancias SSoT vs Código" - Lista completa de drift

---

## Verificación

### Cómo Verificar los Cambios

1. **groupContext**:
   ```bash
   # Verificar que provider.ts existe
   test -f src/services/groupContext/provider.ts && echo "EXISTS"
   
   # Verificar deprecación en utils
   grep -n "@deprecated" src/utils/groupContext.ts
   ```

2. **ensure-demo-users**:
   ```bash
   # Verificar función existe
   ls -d supabase/functions/ensure-demo-users
   
   # Verificar config demo
   grep "verify_jwt" supabase/functions/ensure-demo-users/config.toml
   ```

3. **Conteos**:
   - Verificar que todos los conteos específicos fueron reemplazados por "(indicative count)"
   - Verificar que disclaimer está presente al inicio de Repo Map

---

## Notas Adicionales

### Cambios NO Aplicados (Intencionalmente)

1. **Retry baseDelay**: El SSoT dice 2000ms, código usa 1000ms. **No corregido** porque:
   - No estaba en la lista de cambios solicitados
   - Cambio mínimo requeriría verificación adicional
   - Puede ser actualizado en futura iteración

2. **Conteos específicos en otras secciones**: Solo se actualizó Repo Map. **No expandido** porque:
   - Mantiene el SSoT compacto
   - Repo Map es la sección principal de estructura
   - Otros conteos son menos críticos

### Principios Mantenidos

- ✅ **Minimalismo**: Solo 3 cambios específicos, no refactorización
- ✅ **Propósito preservado**: SSoT sigue siendo referencia operacional compacta
- ✅ **Trazabilidad**: Todos los cambios referencian la auditoría
- ✅ **Enfoque en guardrails**: Cambios reducen ambigüedad en puntos críticos

---

## Conclusión

Los cambios aplicados **reducen ambigüedad de alto impacto** sin convertir el SSoT en documentación exhaustiva. El documento mantiene su propósito como referencia operacional compacta mientras corrige puntos críticos identificados en la auditoría.

**Estado**: ✅ **Completado** - Cambios aplicados, documentados, y verificables.

---

**Fin del Informe de Cambios**
