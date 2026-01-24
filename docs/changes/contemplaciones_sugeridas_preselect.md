# Cambio: Auto-preselección de Contemplaciones Sugeridas

**Fecha:** 2026-01-23  
**Rama:** `Nuevos-perfiles-y-reglas-para-contemplaciones`  
**Commit:** (pendiente)

---

## Resumen

Implementación de auto-preselección de contemplaciones sugeridas en el perfil del estudiante. Las contemplaciones que vienen del equipo psicopedagógico (legacy `student.contemplaciones`) se preseleccionan automáticamente al cargar el perfil, **solo si el docente aún no ha hecho selecciones manuales**.

---

## ¿Qué se Cambió?

### Archivo Modificado

**`src/components/StudentProfile.tsx`**

### Cambios Realizados

1. **Agregado import de `normalizeContemplacionId`** desde `@/lib/contemplaciones/catalog`

2. **Agregada función helper `normalizeLabel()`**:
   - Normaliza labels para matching robusto
   - Aplica: trim, lowercase, remove diacritics, collapse whitespace
   - Permite matching case-insensitive y sin considerar acentos

3. **Agregada función helper `mapLegacyToCatalogIds()`**:
   - Mapea items legacy (`student.contemplaciones`) a IDs del catálogo
   - Soporta matching por ID (normalizado) o por label (normalizado)
   - Filtra por categoría apropiada (clase/evaluaciones/ambas)
   - Retorna array de IDs normalizados

4. **Agregado `useEffect` para auto-preselección**:
   - Se ejecuta al montar el componente o cuando cambia el estudiante
   - Verifica si hay selecciones existentes en localStorage
   - Si NO hay selecciones (array vacío o key no existe):
     - Mapea `student.contemplaciones` a IDs del catálogo
     - Filtra por categoría (clase vs evaluaciones)
     - Persiste usando `writeSelected()`
     - Actualiza el estado local para reflejar los cambios inmediatamente

---

## ¿Por Qué?

### Problema Anterior

- Las contemplaciones sugeridas mostraban el badge "Sugerido" pero NO estaban preseleccionadas
- El docente tenía que seleccionarlas manualmente cada vez
- Esto generaba fricción innecesaria en el flujo de trabajo

### Solución

- Auto-preseleccionar contemplaciones sugeridas al cargar el perfil
- **Solo si el docente no ha hecho selecciones previas** (respeta elecciones del usuario)
- Mejora la UX sin forzar cambios en selecciones existentes

---

## Reglas Críticas

### 1. No Sobrescribir Selecciones Existentes

**Regla fundamental:** Si el docente ya ha hecho selecciones, NO se modifican.

**Implementación:**
```typescript
const existingClase = readSelected(student.id, 'clase');
if (existingClase.length === 0 && ...) {
  // Solo preseleccionar si NO hay selecciones existentes
}
```

**Comportamiento:**
- Si `contemplacionesClase:${studentId}` existe y tiene items → NO se modifica
- Si `contemplacionesClase:${studentId}` no existe → Se inicializa con sugeridas
- Si `contemplacionesClase:${studentId}` existe pero está vacío `[]` → Se inicializa con sugeridas

### 2. Mapeo Robusto de Legacy a Catalog

**Soporta dos formatos en `student.contemplaciones`:**

1. **IDs del catálogo** (ej: `"contemplacion-1"`, `"contemplacion-9"`)
   - Se normalizan automáticamente (#9/#22 → `contemplacion-9-22`)
   - Se buscan directamente en el catálogo

2. **Labels** (ej: `"Lectura oral de consignas"`)
   - Se normalizan (trim, lowercase, sin diacritics)
   - Se comparan con labels del catálogo (también normalizados)
   - Matching case-insensitive y sin considerar acentos

**Ejemplo de matching:**
- Legacy: `"Lectura oral de consignas"` → Match con `contemplacion-1`
- Legacy: `"LECTURA ORAL DE CONSIGNAS"` → Match (case-insensitive)
- Legacy: `"Lectura  oral   de  consignas"` → Match (whitespace collapse)
- Legacy: `"Lectura oral de consignás"` → Match (sin diacritics)

### 3. Filtrado por Categoría

**Solo se preseleccionan contemplaciones aplicables a cada sección:**

- **"Contemplaciones para la clase"**: Solo contemplaciones con `category === 'clase'` o `category === 'ambas'`
- **"Contemplaciones para evaluaciones"**: Solo contemplaciones con `category === 'evaluaciones'` o `category === 'ambas'`

**Ejemplo:**
- Si legacy tiene `"contemplacion-3"` (Tiempo adicional y pausas, category: 'evaluaciones')
  - Se preselecciona en "evaluaciones" ✅
  - NO se preselecciona en "clase" ❌

### 4. Deduplicación #9/#22

**Siempre se normaliza a `contemplacion-9-22`:**

- Legacy: `"contemplacion-9"` → Se guarda como `"contemplacion-9-22"`
- Legacy: `"contemplacion-22"` → Se guarda como `"contemplacion-9-22"`
- Legacy: `"Corrección centrada en contenido (no forma)"` → Se mapea a `"contemplacion-9-22"`

### 5. Badge "Sugerido" No Cambia

- El badge "Sugerido" sigue siendo visual-only
- NO es parte del label de la contemplación
- Se muestra basado en `student.contemplaciones` (legacy)
- El badge y la preselección son independientes (aunque normalmente coinciden)

---

## Cómo Probar

### Test 1: Preselección Inicial (Sin Selecciones Previas)

**Pasos:**
1. Abrir DevTools → Application → Local Storage
2. Eliminar keys:
   - `contemplacionesClase:${studentId}`
   - `contemplacionesEval:${studentId}`
3. Recargar la página del perfil del estudiante
4. Verificar que:
   - Las contemplaciones sugeridas aparecen **seleccionadas** (checkbox marcado)
   - El badge "Sugerido" aparece junto a las contemplaciones sugeridas
   - Solo se preseleccionan contemplaciones aplicables a cada sección

**Resultado esperado:**
- Contemplaciones sugeridas preseleccionadas automáticamente
- Badge "Sugerido" visible
- Selecciones guardadas en localStorage

### Test 2: No Sobrescribir Selecciones Existentes

**Pasos:**
1. En el perfil del estudiante, **deseleccionar** una contemplación sugerida
2. Recargar la página
3. Verificar que:
   - La contemplación deseleccionada **permanece deseleccionada**
   - NO se vuelve a preseleccionar automáticamente
   - Las otras contemplaciones sugeridas siguen seleccionadas

**Resultado esperado:**
- Las selecciones del docente se respetan
- No hay re-preselección automática

### Test 3: Preselección Solo de Aplicables

**Pasos:**
1. Verificar que `student.contemplaciones` contiene contemplaciones de diferentes categorías
2. Limpiar localStorage (como en Test 1)
3. Recargar el perfil
4. Verificar que:
   - En "Contemplaciones para la clase": Solo aparecen preseleccionadas contemplaciones de categoría 'clase' o 'ambas'
   - En "Contemplaciones para evaluaciones": Solo aparecen preseleccionadas contemplaciones de categoría 'evaluaciones' o 'ambas'

**Resultado esperado:**
- Filtrado correcto por categoría
- No hay contemplaciones inaplicables preseleccionadas

### Test 4: Deduplicación #9/#22

**Pasos:**
1. Modificar `student.contemplaciones` para incluir:
   - `"contemplacion-9"` o `"contemplacion-22"` o ambos
2. Limpiar localStorage
3. Recargar el perfil
4. Verificar en localStorage que:
   - Se guarda como `"contemplacion-9-22"` (no como #9 o #22)
   - Solo aparece UNA vez (deduplicado)

**Resultado esperado:**
- Normalización correcta a `contemplacion-9-22`
- Sin duplicados

### Test 5: Matching por Label

**Pasos:**
1. Modificar `student.contemplaciones` para incluir labels en lugar de IDs:
   - `"Lectura oral de consignas"` (en lugar de `"contemplacion-1"`)
2. Limpiar localStorage
3. Recargar el perfil
4. Verificar que:
   - Se mapea correctamente a `"contemplacion-1"`
   - Se preselecciona en la sección apropiada

**Resultado esperado:**
- Matching robusto por label
- Preselección correcta

### Test 6: Matching Case-Insensitive y Sin Diacritics

**Pasos:**
1. Modificar `student.contemplaciones` para incluir:
   - `"LECTURA ORAL DE CONSIGNAS"` (mayúsculas)
   - `"Lectura  oral   de  consignas"` (espacios extra)
   - `"Lectura oral de consignás"` (con acento)
2. Limpiar localStorage
3. Recargar el perfil
4. Verificar que todas se mapean correctamente a `"contemplacion-1"`

**Resultado esperado:**
- Matching robusto independiente de mayúsculas/minúsculas y acentos

---

## Verificación Manual Rápida

### Checklist de Verificación

- [ ] Al cargar perfil sin selecciones previas, las contemplaciones sugeridas aparecen preseleccionadas
- [ ] El badge "Sugerido" sigue apareciendo (visual-only, no parte del label)
- [ ] Al deseleccionar una sugerida y recargar, permanece deseleccionada
- [ ] Solo se preseleccionan contemplaciones aplicables a cada sección
- [ ] #9 y #22 se normalizan a `contemplacion-9-22`
- [ ] Matching funciona con IDs y con labels
- [ ] Matching es case-insensitive y sin diacritics

---

## Impacto

### Nivel de Cambio

🟢 **BAJO**

### Razón

- Solo afecta la inicialización de selecciones
- No modifica selecciones existentes del docente
- No cambia la lógica de badges
- No afecta flags de adecuación
- Cambio aislado en un solo componente

### Consideraciones

- Mejora la UX sin romper funcionalidad existente
- Respeta completamente las elecciones del docente
- Compatible con datos legacy (IDs y labels)

---

## Notas Técnicas

### Dependencias

- `getAllContemplaciones()` - Para obtener todas las contemplaciones del catálogo
- `normalizeContemplacionId()` - Para normalizar IDs (#9/#22)
- `readSelected()` / `writeSelected()` - Para leer/escribir en localStorage
- `useEffect` de React - Para ejecutar al montar el componente

### Performance

- El `useEffect` se ejecuta solo al montar o cuando cambia el estudiante
- El mapeo es O(n*m) donde n = items legacy, m = contemplaciones del catálogo
- En la práctica, n y m son pequeños (< 30), por lo que es eficiente

### Compatibilidad

- Compatible con datos legacy (IDs y labels)
- Compatible con selecciones existentes del docente
- No rompe funcionalidad existente

---

## Próximos Pasos

Este cambio es solo la inicialización automática. Las siguientes mejoras podrían venir después:

1. **Migración de datos legacy**: Migrar `student.contemplaciones` a formato nuevo
2. **Sincronización con backend**: Cuando se migre a base de datos
3. **Notificaciones**: Avisar al docente cuando se auto-preseleccionan items

---

**Última actualización:** 2026-01-23


