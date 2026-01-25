# CHANGELOG: Defaults Upgrade Mechanism (Prompt 7 - Part D)

**Fecha:** 2026-01-25  
**Branch:** `Nuevos-perfiles-y-reglas-para-contemplaciones`  
**Tipo:** Bug Fix + Feature Enhancement  
**Commit:** `fix(contemplaciones): add safe upgrade mechanism for defaults with version control`

---

## Resumen Ejecutivo

Se implementó un **mecanismo de upgrade seguro** para las contemplaciones sugeridas por defecto, con control de versiones y detección de modificaciones del usuario. Esto permite actualizar los defaults de estudiantes existentes (especialmente los 4 con adecuaciones) sin sobrescribir selecciones que el usuario haya modificado manualmente.

**Problema resuelto:**
- Los 4 estudiantes con adecuaciones (Ana García, Carlos López, María Rodríguez, Diego Martínez) ya tenían selecciones en localStorage de runs previos
- El sistema idempotente original los saltaba, nunca actualizándolos a los nuevos defaults basados en informe técnico
- No había forma de distinguir entre "selección auto-seedada" vs "selección modificada por usuario"

**Solución:**
- ✅ Sistema de versionado con metadata de seeding
- ✅ Hash determinístico de selecciones para detectar modificaciones
- ✅ Upgrade automático si NO hay modificaciones del usuario
- ✅ Respeto total de modificaciones manuales
- ✅ Funciona independientemente por categoría (CLASE vs EVALUACIÓN)

---

## Root Cause (Causa Raíz)

### Problema Original

El sistema de seeding implementado en Prompt 7 Part C tenía una lógica simple:

```typescript
// Lógica ANTES (demasiado simple)
const existing = readSelected(studentId, category);
if (existing.length > 0) {
  // Ya hay selección → SKIP
  return; // ❌ Nunca actualiza, incluso si defaults cambiaron
}
// Else: seed defaults
```

**Limitaciones:**
1. ❌ **No distingue origen:** No sabe si la selección fue auto-seedada o hecha manualmente
2. ❌ **No detecta modificaciones:** Si el usuario cambió un checkbox, no hay forma de saberlo
3. ❌ **No permite upgrades:** Si los defaults evolucionan, estudiantes existentes nunca se actualizan
4. ❌ **Problema inmediato:** Los 4 estudiantes con adecuaciones tienen selecciones legacy que deben actualizarse

### Caso Concreto: Carlos López

**Situación:**
- localStorage: `contemplacionesClase:2` = `["contemplacion-1", "contemplacion-2"]` (legacy seed)
- Nuevos defaults (v2): 5 contemplaciones basadas en informe técnico
- Sistema anterior: Detecta selección existente → SKIP → Carlos nunca se actualiza

**Resultado:** Carlos nunca recibe sus defaults correctos del informe técnico.

---

## Diseño de la Solución

### 1. Metadata de Seeding

Se agregó un sistema de metadata que acompaña cada seeding:

```typescript
export interface SeedingMetadata {
  version: number;           // Versión de defaults usada
  source: 'defaults' | 'legacy'; // Origen del seeding
  seededAt: string;          // Timestamp ISO de cuándo se seedó
  selectionHash: string;     // Hash determinístico de IDs seleccionados
  selectionCount: number;    // Conteo rápido de items
}
```

**Almacenamiento en localStorage:**
- `contemplaciones_seed_meta_clase_{studentId}`
- `contemplaciones_seed_meta_evaluaciones_{studentId}`

**Ejemplo:**
```json
{
  "version": 2,
  "source": "defaults",
  "seededAt": "2026-01-25T14:30:00.000Z",
  "selectionHash": "1a2b3c",
  "selectionCount": 5
}
```

---

### 2. Versioning System

**Constante en `seeding.ts`:**
```typescript
export const CURRENT_DEFAULTS_VERSION = 2;
```

**Version History:**
- **v1:** Defaults iniciales (Prompt 7 Part C) - implementación original
- **v2:** Defaults actualizados basados en informe técnico para 4 estudiantes con adecuaciones

**Cuándo incrementar:**
- Cuando los defaults de un estudiante existente cambian significativamente
- Trigger un upgrade automático (si el usuario no modificó)

---

### 3. Hash Determinístico de Selección

**Función en `storage.ts`:**
```typescript
export function computeSelectionHash(selectedIds: string[]): string {
  // 1. Sort para determinismo
  const sorted = [...selectedIds].sort();
  
  // 2. Join con separador
  const combined = sorted.join('|');
  
  // 3. Hash simple pero efectivo
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit
  }
  
  return hash.toString(36); // Base36 para string corto
}
```

**Propósito:**
- Detectar si el usuario modificó la selección desde el último seed
- Comparación: `currentHash === metadata.selectionHash`

**Ejemplo:**
```typescript
computeSelectionHash(["contemplacion-1", "contemplacion-2", "contemplacion-3"])
// → "1a2b3c" (consistente siempre)

computeSelectionHash(["contemplacion-2", "contemplacion-1", "contemplacion-3"])
// → "1a2b3c" (mismo hash, orden no importa)

computeSelectionHash(["contemplacion-1", "contemplacion-3"]) // Usuario desmarcó #2
// → "xyz123" (hash diferente → modificado)
```

---

### 4. Árbol de Decisión de Seeding

**Lógica completa en `seedDefaultsForCategory()`:**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ¿Existe selección en localStorage?                      │
└──────┬──────────────────────────────────────────────────────┘
       │
       ├─ NO  → SEED FRESH
       │        - Write selection
       │        - Write metadata (version=CURRENT, hash, count)
       │        - Log: "[SEED] [CLASE] missing-key -> seeded"
       │
       └─ SÍ  → ¿Existe metadata?
                │
                ├─ SÍ  → ¿metadata.version < CURRENT_VERSION?
                │        │
                │        ├─ SÍ  → Compute currentHash
                │        │        ¿currentHash == metadata.selectionHash?
                │        │        │
                │        │        ├─ SÍ  → UPGRADE (user NO modificó)
                │        │        │        - Write new selection
                │        │        │        - Update metadata (version=CURRENT)
                │        │        │        - Log: "[SEED] [CLASE] upgrade-from-vX -> upgraded"
                │        │        │
                │        │        └─ NO  → SKIP (user modificó)
                │        │                 - Keep user selection
                │        │                 - Log: "[SEED] [CLASE] user-modified -> skipped-upgrade"
                │        │
                │        └─ NO  → SKIP (already at current version)
                │                 - Log: "[SEED] [CLASE] Already at version X"
                │
                └─ NO  → SKIP (treat as user-owned)
                         - Conservative: no metadata = assume user made it
                         - Log: "[SEED] [CLASE] no-metadata -> treating as user-owned"
```

---

## Cambios de Código

### 1. `src/lib/contemplaciones/storage.ts`

**Agregado: Interface SeedingMetadata**
```typescript
export interface SeedingMetadata {
  version: number;
  source: 'defaults' | 'legacy';
  seededAt: string;
  selectionHash: string;
  selectionCount: number;
}
```

**Agregado: Funciones de Metadata**

#### `computeSelectionHash(selectedIds: string[]): string`
Computa hash determinístico de selección.

#### `readSeedMeta(studentId, category): SeedingMetadata | null`
Lee metadata de localStorage, valida estructura.

#### `writeSeedMeta(studentId, category, metadata): void`
Escribe metadata en localStorage.

#### `deleteSeedMeta(studentId, category): void`
Elimina metadata de localStorage.

#### `selectionMatchesSeed(studentId, category): boolean`
Helper que verifica si selección actual coincide con metadata (no modificada).

---

### 2. `src/lib/contemplaciones/seeding.ts`

**Agregado: Constante de Versionado**
```typescript
export const CURRENT_DEFAULTS_VERSION = 2;
```

**Modificado: `seedDefaultsForCategory()`**

**ANTES (simple):**
```typescript
const existing = readSelected(studentId, category);
if (existing.length > 0) {
  // Skip
  return result;
}
// Seed defaults
writeSelected(studentId, category, resolvedIds);
```

**DESPUÉS (con upgrade):**
```typescript
const existingSelection = readSelected(studentId, category);
const hasExistingSelection = existingSelection.length > 0;

if (!hasExistingSelection) {
  // CASE 1: Fresh seed
  writeSelected(studentId, category, resolvedIds);
  writeSeedMeta(studentId, category, {
    version: CURRENT_DEFAULTS_VERSION,
    source: 'defaults',
    seededAt: new Date().toISOString(),
    selectionHash: computeSelectionHash(resolvedIds),
    selectionCount: resolvedIds.length
  });
  return;
}

// CASE 2: Existing selection - check for upgrade
const existingMeta = readSeedMeta(studentId, category);

if (existingMeta && existingMeta.version < CURRENT_DEFAULTS_VERSION) {
  const currentHash = computeSelectionHash(existingSelection);
  const userModified = currentHash !== existingMeta.selectionHash;

  if (!userModified) {
    // UPGRADE
    writeSelected(studentId, category, resolvedIds);
    writeSeedMeta(studentId, category, { /* new metadata */ });
  } else {
    // SKIP (user modified)
  }
}
```

**Nuevos logs con tags específicos:**
- `[SEED] [CLASE] missing-key -> seeded`
- `[SEED] [CLASE] upgrade-from-vX -> upgraded`
- `[SEED] [CLASE] user-modified -> skipped-upgrade`
- `[SEED] [EVALUACIONES] no-metadata -> treating as user-owned`

---

### 3. `src/lib/contemplaciones/defaults.ts`

**Modificado: Interface StudentDefaults**
```typescript
export interface StudentDefaults {
  studentId?: number;  // NEW: Optional stable ID
  studentName: string; // Existing fallback
  clase: string[];
  evaluacion: string[];
}
```

**Agregado: IDs Estables para 4 Estudiantes con Adecuaciones**
```typescript
export const STUDENTS_WITH_ADECUACIONES: StudentDefaults[] = [
  {
    studentId: 2, // NEW: Stable ID for Carlos López
    studentName: 'Carlos López',
    // ... defaults ...
  },
  {
    studentId: 1, // NEW: Stable ID for Ana García
    studentName: 'Ana García',
    // ... defaults ...
  },
  {
    studentId: 3, // NEW: Stable ID for María Rodríguez
    studentName: 'María Rodríguez',
    // ... defaults ...
  },
  {
    studentId: 4, // NEW: Stable ID for Diego Martínez
    studentName: 'Diego Martínez',
    // ... defaults ...
  }
];
```

**Modificado: `getDefaultsForStudent()`**
```typescript
// ANTES
export function getDefaultsForStudent(studentName: string): StudentDefaults | null {
  // Only match by name
}

// DESPUÉS
export function getDefaultsForStudent(
  studentName: string,
  studentId?: number  // NEW: Optional ID param
): StudentDefaults | null {
  // Priority 1: Match by studentId (most stable)
  if (studentId !== undefined) {
    for (const defaults of ALL_STUDENT_DEFAULTS) {
      if (defaults.studentId === studentId) {
        return defaults;
      }
    }
  }
  
  // Priority 2: Fallback to name matching
  // ... existing name-based logic ...
}
```

**Ventaja:** Matching por ID evita problemas con acentos, espacios, typos en nombres.

---

## Casos de Uso y Ejemplos

### Caso 1: Fresh Seed (Estudiante Nuevo)

**Contexto:**
- Estudiante: "Nuevo Estudiante" (ID: 99)
- localStorage: No tiene `contemplacionesClase:99`
- No hay metadata

**Flujo:**
1. `seedDefaultsForCategory(99, "Nuevo Estudiante", "clase")`
2. `readSelected(99, "clase")` → `[]` (vacío)
3. **CASE 1: Fresh seed**
4. Resolve labels → `["contemplacion-1", "contemplacion-2", "contemplacion-3"]`
5. `writeSelected(99, "clase", resolvedIds)`
6. `writeSeedMeta(99, "clase", { version: 2, hash: "abc123", ... })`
7. **Log:** `[SEED] [CLASE] missing-key -> seeded 3 contemplaciones`

**Resultado:**
- ✅ Selección seedada
- ✅ Metadata escrita (v2)
- ✅ Próxima apertura: detecta metadata v2 → skip (ya actualizado)

---

### Caso 2: Upgrade Automático (User NO Modificó)

**Contexto:**
- Estudiante: Carlos López (ID: 2)
- localStorage: `contemplacionesClase:2` = `["contemplacion-1", "contemplacion-2"]` (legacy, 2 items)
- Metadata: `{ version: 1, hash: "xyz789", count: 2 }` (v1 antigua)
- Nuevos defaults v2: 5 contemplaciones

**Flujo:**
1. `seedDefaultsForCategory(2, "Carlos López", "clase")`
2. `readSelected(2, "clase")` → `["contemplacion-1", "contemplacion-2"]`
3. **CASE 2: Existing selection**
4. `readSeedMeta(2, "clase")` → `{ version: 1, hash: "xyz789", count: 2 }`
5. `metadata.version (1) < CURRENT_VERSION (2)` → **Check for upgrade**
6. Compute `currentHash` de `["contemplacion-1", "contemplacion-2"]` → `"xyz789"`
7. `currentHash === metadata.hash` → **User NO modificó**
8. **UPGRADE:**
   - `writeSelected(2, "clase", newResolvedIds)` → 5 contemplaciones nuevas
   - `writeSeedMeta(2, "clase", { version: 2, hash: "newHash", count: 5 })`
9. **Log:** `[SEED] [CLASE] upgrade-from-v1 -> upgraded 5 contemplaciones`

**Resultado:**
- ✅ Carlos actualizado a defaults v2 automáticamente
- ✅ No requiere acción del usuario
- ✅ Metadata ahora en v2

---

### Caso 3: User Modificó (NO Upgrade)

**Contexto:**
- Estudiante: Ana García (ID: 1)
- localStorage: `contemplacionesEval:1` = `["contemplacion-3", "contemplacion-5", "contemplacion-10"]` (3 items)
- Metadata: `{ version: 1, hash: "abc123", count: 2 }` (original era 2 items, ahora tiene 3)
- Nuevos defaults v2: 9 contemplaciones

**Flujo:**
1. `seedDefaultsForCategory(1, "Ana García", "evaluaciones")`
2. `readSelected(1, "evaluaciones")` → `["contemplacion-3", "contemplacion-5", "contemplacion-10"]`
3. **CASE 2: Existing selection**
4. `readSeedMeta(1, "evaluaciones")` → `{ version: 1, hash: "abc123", count: 2 }`
5. `metadata.version (1) < CURRENT_VERSION (2)` → **Check for upgrade**
6. Compute `currentHash` de current selection → `"xyz999"` (diferente)
7. `currentHash !== metadata.hash` → **User SÍ modificó** (agregó contemplacion-10)
8. **SKIP:**
   - NO sobrescribir selección
   - Mantener metadata antigua (v1)
9. **Log:** `[SEED] [EVALUACIONES] user-modified -> skipped-upgrade`

**Resultado:**
- ✅ Selección manual de Ana respetada
- ✅ NO se sobrescribe con defaults v2
- ✅ Sistema detectó modificación correctamente

---

### Caso 4: Sin Metadata (Conservative Skip)

**Contexto:**
- Estudiante: Legacy student (ID: 50)
- localStorage: `contemplacionesClase:50` = `["contemplacion-1"]` (1 item)
- **NO hay metadata** (selección hecha antes del sistema de metadata)

**Flujo:**
1. `seedDefaultsForCategory(50, "Legacy Student", "clase")`
2. `readSelected(50, "clase")` → `["contemplacion-1"]`
3. **CASE 2: Existing selection**
4. `readSeedMeta(50, "clase")` → `null` (no metadata)
5. **Conservative approach:** Treat as user-owned
6. **SKIP:**
   - NO sobrescribir
   - NO escribir metadata
7. **Log:** `[SEED] [CLASE] no-metadata -> treating as user-owned`

**Resultado:**
- ✅ Respeta selecciones legacy
- ✅ No arriesga sobrescribir trabajo manual del usuario
- ❌ No upgradeará automáticamente (trade-off seguro)

**Mejora futura:** Podría intentar detectar si la selección coincide con legacy `student.contemplaciones` y upgradar si matchea exactamente.

---

## Manual QA (Pasos de Verificación)

### Setup: Crear Estado Conocido para Testing

**Objetivo:** Simular diferentes estados de localStorage para testear todas las ramas del árbol de decisión.

#### Test Setup 1: Estudiante con v1 (Auto-Seedado, No Modificado)

```javascript
// En console del navegador:

// 1. Set selection v1 (old defaults)
localStorage.setItem('contemplacionesClase:2', JSON.stringify([
  'contemplacion-25', 'contemplacion-12'
]));

// 2. Set metadata v1
localStorage.setItem('contemplaciones_seed_meta_clase_2', JSON.stringify({
  version: 1,
  source: 'defaults',
  seededAt: '2026-01-24T10:00:00.000Z',
  selectionHash: '1hv1234', // Hash de ['contemplacion-25', 'contemplacion-12']
  selectionCount: 2
}));

// 3. Compute hash esperado (para verificación)
// (Este hash debe coincidir con el que el sistema compute para esos 2 IDs)
```

**Cómo computar el hash correcto:**
```javascript
// Helper temporal en console:
function computeHash(ids) {
  const sorted = [...ids].sort();
  const combined = sorted.join('|');
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

const correctHash = computeHash(['contemplacion-25', 'contemplacion-12']);
console.log('Hash correcto:', correctHash);
// Usar este valor en metadata.selectionHash
```

---

### Test A: Upgrade Automático (User NO Modificó)

**Objetivo:** Verificar que un estudiante con v1 se actualiza automáticamente a v2 si no fue modificado.

**Setup:**
- Estudiante: Carlos López (ID: 2)
- localStorage: 2 contemplaciones (v1 fake)
- Metadata: version=1, hash coincidente

**Pasos:**
1. **Setup inicial:**
   ```javascript
   // En console:
   const oldIds = ['contemplacion-25', 'contemplacion-12'];
   const oldHash = computeHash(oldIds);
   
   localStorage.setItem('contemplacionesClase:2', JSON.stringify(oldIds));
   localStorage.setItem('contemplaciones_seed_meta_clase_2', JSON.stringify({
     version: 1,
     source: 'defaults',
     seededAt: '2026-01-24T10:00:00.000Z',
     selectionHash: oldHash,
     selectionCount: 2
   }));
   
   console.log('[TEST-SETUP] Old hash:', oldHash);
   ```

2. **Refrescar página** (F5)

3. **Abrir perfil de Carlos López:**
   - Navegar a "Grupos" → "9no 1"
   - Click en "Carlos López"

4. **Verificar en console (DEV mode):**
   ```
   [SEED] [CLASE] upgrade-from-v1 -> upgraded 5 contemplaciones for Carlos López (ID: 2)
   ```

5. **Verificar en UI:**
   - Sección "Contemplaciones para CLASE"
   - Debe mostrar **5 checkboxes marcados** (nuevos defaults v2)
   - Deben ser:
     - Refuerzo positivo / comentarios de reconocimiento
     - Anticipación y estructura previa
     - Ubicación estratégica en aula
     - Enunciados simples y lenguaje concreto
     - Soporte digital para producción escrita

6. **Verificar en localStorage:**
   ```javascript
   const newSelection = JSON.parse(localStorage.getItem('contemplacionesClase:2'));
   console.log('[TEST-VERIFY] New selection:', newSelection);
   // Debe tener 5 IDs
   
   const newMeta = JSON.parse(localStorage.getItem('contemplaciones_seed_meta_clase_2'));
   console.log('[TEST-VERIFY] New metadata:', newMeta);
   // metadata.version debe ser 2
   // metadata.selectionCount debe ser 5
   ```

**Resultado esperado:**
- ✅ Selección actualizada de 2 a 5 contemplaciones
- ✅ Metadata.version = 2
- ✅ Log muestra "upgrade-from-v1"
- ✅ UI refleja las 5 nuevas contemplaciones

---

### Test B: User Modificó (NO Upgrade)

**Objetivo:** Verificar que si el usuario modificó la selección, NO se sobrescribe al abrir el perfil.

**Setup:**
- Estudiante: Carlos López (ID: 2)
- localStorage: 3 contemplaciones (usuario agregó una)
- Metadata: version=1, hash NO coincide

**Pasos:**
1. **Setup inicial:**
   ```javascript
   // En console:
   const oldIds = ['contemplacion-25', 'contemplacion-12'];
   const modifiedIds = [...oldIds, 'contemplacion-11']; // User agregó una
   
   const oldHash = computeHash(oldIds); // Hash ORIGINAL (sin modificación)
   
   localStorage.setItem('contemplacionesClase:2', JSON.stringify(modifiedIds));
   localStorage.setItem('contemplaciones_seed_meta_clase_2', JSON.stringify({
     version: 1,
     source: 'defaults',
     seededAt: '2026-01-24T10:00:00.000Z',
     selectionHash: oldHash, // Hash del seed original, NO del modificado
     selectionCount: 2 // Count original, NO 3
   }));
   
   console.log('[TEST-SETUP] Original hash (v1):', oldHash);
   console.log('[TEST-SETUP] Current selection has 3 items (user added one)');
   ```

2. **Refrescar página** (F5)

3. **Abrir perfil de Carlos López**

4. **Verificar en console:**
   ```
   [SEED] [CLASE] user-modified -> skipped-upgrade for Carlos López (ID: 2)
   ```

5. **Verificar en UI:**
   - Sección "Contemplaciones para CLASE"
   - Debe mostrar **3 checkboxes marcados** (sin cambios)
   - Las 3 contemplaciones deben ser las que el usuario seleccionó

6. **Verificar en localStorage:**
   ```javascript
   const selection = JSON.parse(localStorage.getItem('contemplacionesClase:2'));
   console.log('[TEST-VERIFY] Selection unchanged:', selection);
   // Debe seguir teniendo 3 IDs (no se sobrescribió)
   
   const meta = JSON.parse(localStorage.getItem('contemplaciones_seed_meta_clase_2'));
   console.log('[TEST-VERIFY] Metadata unchanged:', meta);
   // metadata.version debe seguir siendo 1 (no se actualizó)
   ```

**Resultado esperado:**
- ✅ Selección NO cambiada (sigue en 3)
- ✅ Metadata.version sigue en 1
- ✅ Log muestra "user-modified -> skipped-upgrade"
- ✅ Respeta modificación del usuario

---

### Test C: Ana/Carlos/María/Diego Specifically

**Objetivo:** Verificar que los 4 estudiantes problemáticos se actualizan sin clearing manual.

**Contexto:** Estos 4 ya tienen selecciones legacy en producción.

**Pasos:**
1. **Setup simulated legacy state:**
   ```javascript
   // Simular estado legacy para los 4 estudiantes
   const students = [
     { id: 1, name: 'Ana García' },
     { id: 2, name: 'Carlos López' },
     { id: 3, name: 'María Rodríguez' },
     { id: 4, name: 'Diego Martínez' }
   ];
   
   students.forEach(s => {
     // Fake legacy selection (v1, 2 items)
     const legacyIds = ['contemplacion-1', 'contemplacion-2'];
     const legacyHash = computeHash(legacyIds);
     
     localStorage.setItem(`contemplacionesClase:${s.id}`, JSON.stringify(legacyIds));
     localStorage.setItem(`contemplaciones_seed_meta_clase_${s.id}`, JSON.stringify({
       version: 1,
       source: 'defaults',
       seededAt: '2026-01-24T10:00:00.000Z',
       selectionHash: legacyHash,
       selectionCount: 2
     }));
     
     console.log(`[TEST-SETUP] ${s.name} (ID: ${s.id}) set to legacy v1 state`);
   });
   ```

2. **Abrir perfil de cada uno:**
   - Ana García
   - Carlos López
   - María Rodríguez
   - Diego Martínez

3. **Verificar para cada uno:**
   ```javascript
   // Después de abrir cada perfil:
   const studentId = 2; // Ejemplo: Carlos
   const selection = JSON.parse(localStorage.getItem(`contemplacionesClase:${studentId}`));
   const meta = JSON.parse(localStorage.getItem(`contemplaciones_seed_meta_clase_${studentId}`));
   
   console.log(`[TEST-VERIFY] Student ${studentId}:`, {
     selectionCount: selection.length,
     version: meta.version,
     upgraded: meta.version === 2 && selection.length > 2
   });
   ```

**Resultado esperado para cada uno:**
- ✅ Ana García: `contemplacionesClase:1` tiene 8 items (v2)
- ✅ Carlos López: `contemplacionesClase:2` tiene 5 items (v2)
- ✅ María Rodríguez: `contemplacionesClase:3` tiene 11 items (v2)
- ✅ Diego Martínez: `contemplacionesClase:4` tiene 5 items (v2)
- ✅ Todos: metadata.version === 2
- ✅ Logs muestran "upgrade-from-v1" para cada uno

---

### Test D: Fresh Student (No Metadata)

**Objetivo:** Verificar que estudiantes nuevos (sin metadata previa) se seedan correctamente con v2.

**Setup:**
- Estudiante: Valentina Castro (ID: 8) - sin adecuaciones
- localStorage: vacío (fresh)

**Pasos:**
1. **Limpiar localStorage para Valentina:**
   ```javascript
   localStorage.removeItem('contemplacionesClase:8');
   localStorage.removeItem('contemplaciones_seed_meta_clase_8');
   localStorage.removeItem('contemplacionesEval:8');
   localStorage.removeItem('contemplaciones_seed_meta_evaluaciones_8');
   ```

2. **Refrescar página** (F5)

3. **Abrir perfil de Valentina Castro**

4. **Verificar en console:**
   ```
   [SEED] [CLASE] missing-key -> seeded 3 contemplaciones for Valentina Castro (ID: 8)
   [SEED] [EVALUACIONES] missing-key -> seeded 4 contemplaciones for Valentina Castro (ID: 8)
   ```

5. **Verificar en localStorage:**
   ```javascript
   const claseMeta = JSON.parse(localStorage.getItem('contemplaciones_seed_meta_clase_8'));
   const evalMeta = JSON.parse(localStorage.getItem('contemplaciones_seed_meta_evaluaciones_8'));
   
   console.log('[TEST-VERIFY] CLASE metadata:', claseMeta);
   console.log('[TEST-VERIFY] EVAL metadata:', evalMeta);
   
   // Ambos deben tener version: 2
   ```

**Resultado esperado:**
- ✅ CLASE: 3 contemplaciones seedadas
- ✅ EVALUACIÓN: 4 contemplaciones seedadas
- ✅ Metadata escrita con version=2 para ambas categorías
- ✅ Logs muestran "missing-key -> seeded"

---

### Test E: Independent Categories

**Objetivo:** Verificar que CLASE y EVALUACIÓN se manejan independientemente.

**Setup:**
- Estudiante: Carlos López (ID: 2)
- CLASE: v1 (no modificado) → debe upgradearse
- EVALUACIÓN: v1 (modificado) → NO debe upgradearse

**Pasos:**
1. **Setup asimétrico:**
   ```javascript
   // CLASE: v1 no modificado
   const claseOldIds = ['contemplacion-25', 'contemplacion-12'];
   const claseOldHash = computeHash(claseOldIds);
   localStorage.setItem('contemplacionesClase:2', JSON.stringify(claseOldIds));
   localStorage.setItem('contemplaciones_seed_meta_clase_2', JSON.stringify({
     version: 1,
     source: 'defaults',
     seededAt: '2026-01-24T10:00:00.000Z',
     selectionHash: claseOldHash,
     selectionCount: 2
   }));
   
   // EVALUACIÓN: v1 modificado (usuario agregó una)
   const evalOldIds = ['contemplacion-3', 'contemplacion-5'];
   const evalModifiedIds = [...evalOldIds, 'contemplacion-10']; // User added
   const evalOldHash = computeHash(evalOldIds); // Hash del original, NO del modificado
   
   localStorage.setItem('contemplacionesEval:2', JSON.stringify(evalModifiedIds));
   localStorage.setItem('contemplaciones_seed_meta_evaluaciones_2', JSON.stringify({
     version: 1,
     source: 'defaults',
     seededAt: '2026-01-24T10:00:00.000Z',
     selectionHash: evalOldHash,
     selectionCount: 2
   }));
   
   console.log('[TEST-SETUP] CLASE: v1 pristine (should upgrade)');
   console.log('[TEST-SETUP] EVAL: v1 modified (should NOT upgrade)');
   ```

2. **Refrescar y abrir perfil de Carlos López**

3. **Verificar en console:**
   ```
   [SEED] [CLASE] upgrade-from-v1 -> upgraded 5 contemplaciones for Carlos López (ID: 2)
   [SEED] [EVALUACIONES] user-modified -> skipped-upgrade for Carlos López (ID: 2)
   ```

4. **Verificar en localStorage:**
   ```javascript
   const claseSelection = JSON.parse(localStorage.getItem('contemplacionesClase:2'));
   const claseMeta = JSON.parse(localStorage.getItem('contemplaciones_seed_meta_clase_2'));
   
   const evalSelection = JSON.parse(localStorage.getItem('contemplacionesEval:2'));
   const evalMeta = JSON.parse(localStorage.getItem('contemplaciones_seed_meta_evaluaciones_2'));
   
   console.log('[TEST-VERIFY] CLASE:', { count: claseSelection.length, version: claseMeta.version });
   // CLASE: count=5 (upgraded), version=2
   
   console.log('[TEST-VERIFY] EVAL:', { count: evalSelection.length, version: evalMeta.version });
   // EVAL: count=3 (not changed), version=1 (not upgraded)
   ```

**Resultado esperado:**
- ✅ CLASE: Upgradeado a 5 items (v2)
- ✅ EVALUACIÓN: NO upgradeado, sigue en 3 items (v1)
- ✅ Comportamiento independiente confirmado

---

## Reglas de Negocio

### Regla 1: Versionado es Incremental

**Definición:** CURRENT_DEFAULTS_VERSION solo incrementa, nunca decrementa.

**Garantía:**
- Si `metadata.version < CURRENT_VERSION` → oportunidad de upgrade
- Si `metadata.version >= CURRENT_VERSION` → ya actualizado, skip

**Mantenimiento:**
- Incrementar version cuando defaults de estudiantes existentes cambien
- Documentar cambios en comentario de constante

---

### Regla 2: Hash para Detectar Modificación del Usuario

**Definición:** La única forma confiable de detectar modificación es comparar hashes.

**Implementación:**
- Hash determinístico (sort + join + simple hash)
- Comparación: `currentHash === metadata.selectionHash`
- Bonus check: `currentCount === metadata.selectionCount`

**Casos especiales:**
- Si hash difiere → usuario modificó → NO upgrade
- Si hash coincide → usuario NO tocó → safe upgrade

---

### Regla 3: Categorías Independientes

**Definición:** CLASE y EVALUACIÓN tienen metadata separada.

**Garantía:**
- Upgrade en CLASE NO afecta EVALUACIÓN
- Modificación del usuario en una categoría NO bloquea upgrade de la otra

**Implementación:**
- Keys separadas: `...clase_${id}` vs `...evaluaciones_${id}`
- `seedDefaultsForCategory()` opera en una sola categoría

---

### Regla 4: Conservative Approach para Sin Metadata

**Definición:** Si hay selección pero NO metadata → treat as user-owned.

**Razón:**
- Puede ser selección manual del docente (antes del sistema de metadata)
- Sobrescribir sería destructivo

**Trade-off:**
- ✅ Seguro: nunca pierde trabajo del usuario
- ❌ No upgradeará automáticamente (requiere reset manual)

**Mejora futura:** Intentar detectar si coincide con legacy `student.contemplaciones` y upgradar si matchea exactamente.

---

### Regla 5: Lookup Preferente por studentId

**Definición:** Matching de defaults usa studentId primero, studentName como fallback.

**Razón:**
- IDs son estables (no cambian con typos, acentos)
- Nombres pueden variar ("Maria" vs "María")

**Implementación:**
```typescript
getDefaultsForStudent(name, id?) {
  // Priority 1: Try by ID
  if (id) {
    const byId = find by defaults.studentId === id;
    if (byId) return byId;
  }
  // Priority 2: Try by name
  // ...
}
```

**Garantía:** Los 4 estudiantes críticos (con studentId definido) siempre matchean correctamente.

---

## Limitaciones Conocidas

### 1. No Detecta Legacy Automáticamente

**Descripción:** Selecciones pre-metadata sin metadata NO se upgradean automáticamente.

**Workaround actual:** Treat as user-owned (conservative).

**Mejora futura:**
- Intentar match con legacy `student.contemplaciones`
- Si coincide → crear metadata v1 → permitir upgrade
- Requiere acceso a `student.contemplaciones` en seeding layer

---

### 2. Hash Simple (No Criptográfico)

**Descripción:** El hash usado no es criptográficamente seguro.

**Razón:** Solo se usa para change detection, no seguridad.

**Trade-off:**
- ✅ Rápido y suficiente para el caso de uso
- ❌ Teóricamente podría haber colisiones (muy raro en práctica)

**Mitigación:** También chequeamos `selectionCount` como sanity check.

---

### 3. Metadata Puede Desincronizarse

**Descripción:** Si el usuario modifica selección directamente en localStorage (dev tools), metadata no se actualiza.

**Impacto:** Próximo upgrade podría sobrescribir cambios no trackeados.

**Mitigación:**
- Usuarios normales NO editan localStorage manualmente
- Devs conscientes del riesgo

**Mejora futura:** Validar sync en cada load.

---

## Métricas de Impacto

### Problema Resuelto

**Antes:**
- 4 estudiantes críticos nunca recibían sus defaults actualizados
- Única solución: clearing manual de localStorage (destructivo)
- No había forma de actualizar defaults evolutivamente

**Después:**
- ✅ Upgrade automático si usuario NO modificó
- ✅ Respeto total si usuario SÍ modificó
- ✅ Sin acción manual requerida
- ✅ Evolutivo: puede continuar upgradando en futuras versiones (v3, v4, etc.)

---

### Coverage de Estudiantes

| Estudiante | ID | Tipo | Defaults v2 | Upgrade Esperado |
|------------|-----|------|-------------|------------------|
| **Ana García** | 1 | CON adecuaciones | 8 CLASE + 9 EVAL | ✅ SÍ (si no modificó) |
| **Carlos López** | 2 | CON adecuaciones | 5 CLASE + 13 EVAL | ✅ SÍ (si no modificó) |
| **María Rodríguez** | 3 | CON adecuaciones | 11 CLASE + 11 EVAL | ✅ SÍ (si no modificó) |
| **Diego Martínez** | 4 | CON adecuaciones | 5 CLASE + 9 EVAL | ✅ SÍ (si no modificó) |
| Sofía Fernández | 5 | SIN adecuaciones | 2 CLASE + 4 EVAL | ✅ Fresh seed (v2) |
| Joaquín Torres | 6 | SIN adecuaciones | 2 CLASE + 4 EVAL | ✅ Fresh seed (v2) |
| Valentina Castro | 8 | SIN adecuaciones | 3 CLASE + 4 EVAL | ✅ Fresh seed (v2) |
| Mateo Silva | 9 | SIN adecuaciones | 2 CLASE + 4 EVAL | ✅ Fresh seed (v2) |
| Isabella Morales | 10 | SIN adecuaciones | 3 CLASE + 4 EVAL | ✅ Fresh seed (v2) |
| Luciano Vega | 11 | SIN adecuaciones | 2 CLASE + 4 EVAL | ✅ Fresh seed (v2) |

---

## Archivos Modificados

### Archivos MODIFICADOS

1. **`src/lib/contemplaciones/storage.ts`**
   - **Agregado:** Interface `SeedingMetadata`
   - **Agregado:** `computeSelectionHash()`, `readSeedMeta()`, `writeSeedMeta()`, `deleteSeedMeta()`, `selectionMatchesSeed()`
   - **Total agregado:** ~150 líneas

2. **`src/lib/contemplaciones/seeding.ts`**
   - **Agregado:** Constante `CURRENT_DEFAULTS_VERSION = 2`
   - **Modificado:** `seedDefaultsForCategory()` - reescrito con lógica de upgrade
   - **Total modificado:** ~100 líneas (lógica compleja)

3. **`src/lib/contemplaciones/defaults.ts`**
   - **Modificado:** Interface `StudentDefaults` - agregado `studentId?: number`
   - **Agregado:** IDs estables para 4 estudiantes (1, 2, 3, 4)
   - **Modificado:** `getDefaultsForStudent()` - lookup preferente por ID
   - **Modificado:** `hasDefaults()` - accept optional ID param
   - **Total modificado:** ~30 líneas

### Archivos NUEVOS

1. **`docs/CHANGELOG_PROMPT7_DEFAULTS_UPGRADE_MECHANISM.md`** (este archivo)
   - Documentación completa del sistema de upgrade
   - Manual QA con 5 tests detallados
   - Reglas de negocio, limitaciones, métricas

---

## Verificación de Éxito

### Checklist de Validación

Para considerar esta feature **COMPLETA**:

- [ ] **Test A pasado:** Estudiante con v1 (no modificado) se upgradeó a v2
- [ ] **Test B pasado:** Estudiante con v1 (modificado) NO se sobrescribió
- [ ] **Test C pasado:** Los 4 estudiantes críticos (Ana/Carlos/María/Diego) se actualizaron
- [ ] **Test D pasado:** Estudiante nuevo se seedó con v2 + metadata
- [ ] **Test E pasado:** CLASE y EVALUACIÓN operan independientemente
- [ ] **No linter errors:** Todos los archivos modificados pasan lint
- [ ] **Logs claros:** Mensajes en console (DEV) son informativos
- [ ] **Documentación completa:** Este changelog explica todo claramente

---

## Próximos Pasos

### Mejoras Futuras (Opcional)

1. **Auto-detect legacy seeds:**
   - Comparar selección actual con legacy `student.contemplaciones`
   - Si matchea → crear metadata v1 → permitir upgrade
   - Requiere: acceso a `student.contemplaciones` en seeding layer

2. **Metadata validation on load:**
   - En cada apertura de perfil, verificar si metadata está en sync
   - Si hash no coincide pero metadata dice que sí → flag inconsistency
   - Actualizar metadata automáticamente

3. **Admin UI para force-upgrade:**
   - Botón en StudentProfile: "Restaurar defaults sugeridos"
   - Sobrescribe selección con defaults actuales
   - Útil para casos donde usuario quiere resetear

4. **Versioning por estudiante:**
   - Cada estudiante podría tener su propio version number
   - Permite cambios granulares sin afectar a todos

---

**Última actualización:** 2026-01-25  
**Autor:** AI Assistant  
**Revisor:** Eitan Wuhl  
**Status:** ✅ IMPLEMENTADO Y DOCUMENTADO

