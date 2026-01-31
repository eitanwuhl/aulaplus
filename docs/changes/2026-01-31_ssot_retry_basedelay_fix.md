# Corrección SSoT: Retry baseDelay

> **Fecha**: 2026-01-31  
> **Tipo**: Corrección menor de documentación  
> **Objetivo**: Alinear valor de retry baseDelay en SSoT con código real

---

## Resumen

Se corrigió una discrepancia menor en `docs/ARCHITECTURE_SSoT.md`: el valor de retry baseDelay estaba documentado como 2000ms, pero el código real usa 1000ms.

**Cambio**: Una línea actualizada  
**Impacto**: Bajo - Reduce confusión sobre comportamiento real de retry  
**Riesgo**: Ninguno - Solo documentación

---

## Cambio Aplicado

### Archivo: `docs/ARCHITECTURE_SSoT.md`

**Ubicación**: Línea 128, sección "Edge Function Contracts" → `generate-plan-completo`

**Antes**:
```markdown
**Retry**: 3 attempts, exponential backoff (base delay: 2000ms)
```

**Después**:
```markdown
**Retry**: 3 attempts, exponential backoff (base delay: 1000ms)
```

**Cambio**: `2000ms` → `1000ms`

---

## Por Qué Importa

### Reducción de Confusión

- **Problema**: Desarrolladores que consultan el SSoT esperarían retry con delay de 2000ms
- **Realidad**: El código usa 1000ms, causando comportamiento diferente al documentado
- **Impacto**: Confusión al depurar problemas de rate limiting o timeouts

### Consistencia Documentación-Código

- **SSoT es referencia operacional**: Debe reflejar comportamiento real
- **BaseDelay afecta latencia**: Valor incorrecto puede llevar a estimaciones erróneas
- **Debugging**: Valores documentados incorrectos dificultan diagnóstico

### Riesgo

- **Riesgo**: 🟢 **BAJO** - No afecta funcionalidad, solo documentación
- **Impacto**: Reducción de confusión, mejor alineación con código

---

## Evidencia

### Código Real

**Archivo**: `supabase/functions/generate-plan-completo/index.ts`  
**Línea**: 12  
**Código**:
```typescript
async function retryWithBackoff(fn: () => Promise<any>, maxRetries = 3, baseDelay = 1000) {
```

**Evidencia**: El parámetro por defecto es `1000`, no `2000`.

### Documentación Anterior

**Archivo**: `docs/ARCHITECTURE_SSoT.md` (antes del cambio)  
**Línea**: 128  
**Texto**: "base delay: 2000ms"

### Auditoría

**Referencia**: `docs/CHANGES/2026-01-31_arch_overview_audit.md`

- **Sección 2**: "Drift en Detalles Técnicos"
- **Tabla**: "Retry baseDelay"
  - SSoT dice: 2000ms
  - Código real: 1000ms
  - Impacto: Medio

---

## Verificación

### Cómo Verificar el Cambio

#### 1. Verificar valor en código

```bash
# Buscar definición de retryWithBackoff
grep -n "baseDelay = " supabase/functions/generate-plan-completo/index.ts

# Resultado esperado: línea 12, valor 1000
```

#### 2. Verificar valor en SSoT

```bash
# Buscar mención de baseDelay en SSoT
grep -n "base delay" docs/ARCHITECTURE_SSoT.md

# Resultado esperado: línea 128, valor 1000ms
```

#### 3. Verificar que no quedan referencias a 2000ms

```bash
# Buscar cualquier referencia a 2000 en SSoT
grep -n "2000" docs/ARCHITECTURE_SSoT.md

# Resultado esperado: Sin matches (o solo en otros contextos no relacionados)
```

### Verificación Manual

1. **Abrir** `docs/ARCHITECTURE_SSoT.md`
2. **Navegar** a sección "Edge Function Contracts" → `generate-plan-completo`
3. **Verificar** que dice "base delay: 1000ms"
4. **Abrir** `supabase/functions/generate-plan-completo/index.ts`
5. **Verificar** línea 12: `baseDelay = 1000`

---

## Contexto

### Por Qué Ocurrió la Discrepancia

**Hipótesis**: El valor pudo haber sido cambiado en el código sin actualizar la documentación, o viceversa. El SSoT se actualiza menos frecuentemente que el código.

**Evidencia de auditoría**: La discrepancia fue identificada en la auditoría de arquitectura del 2026-01-31, pero no se corrigió en ese momento para mantener el alcance mínimo de cambios.

### Relación con Otros Documentos

- **`docs/PROJECT_ARCHITECTURE_OVERVIEW.md`**: Ya documenta correctamente 1000ms (corregido en auditoría)
- **`docs/CHANGES/2026-01-31_arch_overview_audit.md`**: Documenta la discrepancia como "drift menor"

---

## Impacto

### Áreas Afectadas

- **Ninguna** - Solo documentación
- **Desarrolladores**: Ahora verán valor correcto en SSoT
- **Debugging**: Estimaciones de tiempo de retry serán más precisas

### Riesgo de Cambio

- **Riesgo**: 🟢 **NINGUNO** - Solo corrección de documentación
- **Breaking changes**: Ninguno
- **Comportamiento**: Sin cambios (código ya usaba 1000ms)

---

## Conclusión

✅ **Corrección completada**

- SSoT ahora refleja valor real del código (1000ms)
- Documentación alineada con comportamiento real
- Sin riesgo - solo actualización de documentación

**Estado**: Listo para commit.

---

**Fin del Informe de Corrección**
