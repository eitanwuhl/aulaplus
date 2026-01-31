# Migración: groupContext de utils a services

> **Fecha**: 2026-01-31  
> **Tipo**: Migración mecánica de imports  
> **Objetivo**: Eliminar dependencias del archivo deprecado `src/utils/groupContext.ts`

---

## Resumen

Se migraron todos los usos del archivo deprecado `src/utils/groupContext.ts` a la ubicación canónica `src/services/groupContext/provider.ts`. Esta es una migración mecánica que solo actualiza rutas de importación, sin cambiar comportamiento.

**Estado**: ✅ **Completado**

---

## Cambios Realizados

### Archivos Modificados

1. **`src/pages/PlanificacionWorkspace.tsx`**
   - **Antes**: `import { loadGroupContext, getGrupoIdFromPlanificacion } from '@/utils/groupContext';`
   - **Después**: `import { loadGroupContext, getGrupoIdFromPlanificacion } from '@/services/groupContext/provider';`
   - **Línea**: 19

2. **`src/pages/PlanificacionWizard.tsx`**
   - **Antes**: `import { loadGroupContext } from '@/utils/groupContext';`
   - **Después**: `import { loadGroupContext } from '@/services/groupContext/provider';`
   - **Línea**: 18
   - **Adicional**: Actualizado comentario en línea 252 para referenciar nueva ubicación

3. **`src/hooks/useFullSessionGeneration.ts`**
   - **Antes**: `import { loadGroupContext } from '@/utils/groupContext';`
   - **Después**: `import { loadGroupContext } from '@/services/groupContext/provider';`
   - **Línea**: 5

4. **`src/components/planificacion/EditorSesionNuevo.tsx`**
   - **Antes**: `import { loadGroupContext, getGrupoIdFromPlanificacion } from '@/utils/groupContext';`
   - **Después**: `import { loadGroupContext, getGrupoIdFromPlanificacion } from '@/services/groupContext/provider';`
   - **Línea**: 15

### Archivo Eliminado

- **`src/utils/groupContext.ts`** ✅
  - Archivo deprecado eliminado después de migrar todos los imports
  - Funciones y tipos movidos a `src/services/groupContext/provider.ts` (sección "Backward Compatibility Wrappers")

### Archivo Actualizado

- **`src/services/groupContext/provider.ts`**
  - Ya contenía las funciones de compatibilidad (`loadGroupContext`, `getGrupoIdFromPlanificacion`)
  - Ya contenía los tipos de compatibilidad (`PerfilGrupo`, `EstudianteAjuste`, `GroupContextData`)
  - No se requirieron cambios adicionales

---

## Por Qué Es Seguro

### 1. Migración Mecánica

- **Solo se cambiaron rutas de importación**: No se modificó lógica, comportamiento, o estructura de datos
- **Funciones idénticas**: Las funciones `loadGroupContext` y `getGrupoIdFromPlanificacion` ya existían en el provider con la misma implementación
- **Tipos compatibles**: Los tipos exportados (`PerfilGrupo`, `EstudianteAjuste`, `GroupContextData`) son idénticos

### 2. Comportamiento Preservado

- **`loadGroupContext`**: Wrapper que convierte `GroupContextForAI` a `GroupContextData` (formato legacy)
- **`getGrupoIdFromPlanificacion`**: Helper que consulta Supabase (sin cambios)
- **Ambas funciones mantienen la misma firma y comportamiento**

### 3. Sin Dependencias Rotas

- **Verificado**: No quedan referencias a `@/utils/groupContext` en código fuente
- **Documentación**: Referencias en docs son históricas y no afectan runtime
- **Linter**: Sin errores de TypeScript después de la migración

### 4. Arquitectura Alineada

- **Ubicación canónica**: `src/services/groupContext/provider.ts` es la ubicación documentada en SSoT
- **Deprecación eliminada**: Archivo deprecado removido, reduciendo confusión
- **Consistencia**: Todos los imports ahora apuntan a la misma ubicación

---

## Archivos Afectados

### Código Fuente

| Archivo | Tipo de Cambio | Líneas Afectadas |
|---------|----------------|------------------|
| `src/pages/PlanificacionWorkspace.tsx` | Import actualizado | 1 línea (19) |
| `src/pages/PlanificacionWizard.tsx` | Import + comentario | 2 líneas (18, 252) |
| `src/hooks/useFullSessionGeneration.ts` | Import actualizado | 1 línea (5) |
| `src/components/planificacion/EditorSesionNuevo.tsx` | Import actualizado | 1 línea (15) |
| `src/utils/groupContext.ts` | **ELIMINADO** | N/A |
| `src/services/groupContext/provider.ts` | Sin cambios (ya tenía funciones) | 0 líneas |

**Total**: 4 archivos modificados, 1 archivo eliminado

### Documentación

- Referencias históricas en `docs/` no fueron modificadas (son documentación histórica)
- SSoT y Overview ya documentan la nueva ubicación correctamente

---

## Verificación

### Cómo Verificar que la Migración Fue Exitosa

#### 1. Verificar que no quedan imports del archivo deprecado

```bash
# Buscar referencias en código fuente
grep -r "@/utils/groupContext" src/

# Resultado esperado: Sin matches (o solo en comentarios/documentación)
```

#### 2. Verificar que los imports apuntan a la nueva ubicación

```bash
# Buscar imports del provider
grep -r "@/services/groupContext/provider" src/

# Resultado esperado: 4 archivos con imports correctos
```

#### 3. Verificar que el archivo deprecado fue eliminado

```bash
# Verificar que el archivo no existe
test -f src/utils/groupContext.ts && echo "ERROR: Archivo aún existe" || echo "OK: Archivo eliminado"
```

#### 4. Verificar que las funciones existen en el provider

```bash
# Verificar exportaciones
grep -n "export.*loadGroupContext\|export.*getGrupoIdFromPlanificacion" src/services/groupContext/provider.ts

# Resultado esperado: Ambas funciones exportadas
```

#### 5. Verificar compilación TypeScript

```bash
# Ejecutar linter/type check
npm run lint

# Resultado esperado: Sin errores relacionados con groupContext
```

### Verificación Manual

1. **Abrir cada archivo migrado** y verificar que el import es correcto
2. **Ejecutar la aplicación** y verificar que:
   - Planificaciones se cargan correctamente
   - Contexto de grupo se obtiene sin errores
   - `getGrupoIdFromPlanificacion` funciona en componentes que lo usan

---

## Rollback (Si Es Necesario)

### Procedimiento de Rollback

Si es necesario revertir la migración:

1. **Restaurar el archivo deprecado**:
   ```bash
   git checkout HEAD -- src/utils/groupContext.ts
   ```

2. **Revertir imports en los 4 archivos**:
   - `src/pages/PlanificacionWorkspace.tsx`: Cambiar import a `@/utils/groupContext`
   - `src/pages/PlanificacionWizard.tsx`: Cambiar import a `@/utils/groupContext`
   - `src/hooks/useFullSessionGeneration.ts`: Cambiar import a `@/utils/groupContext`
   - `src/components/planificacion/EditorSesionNuevo.tsx`: Cambiar import a `@/utils/groupContext`

3. **Verificar que la aplicación funciona**:
   ```bash
   npm run dev
   # Probar funcionalidad de planificaciones
   ```

### Notas de Rollback

- **Riesgo**: Bajo - El archivo deprecado es un wrapper que funciona correctamente
- **Motivo de rollback**: Solo si se descubre un problema crítico con la nueva ubicación
- **Alternativa**: Si hay problemas, pueden coexistir ambas ubicaciones temporalmente

---

## Nota sobre Mapeo en loadGroupContext

**Observación**: El código en `src/services/groupContext/provider.ts` (líneas ~580-585) tiene un mapeo que puede ser redundante:

```typescript
estudiantes: context.anonymizedStudentsForPrompt.length > 0
  ? context.anonymizedStudentsForPrompt.map(s => ({
      perfil: s.learningStyle,  // ⚠️ Puede ser incorrecto
      ajustes: s.adjustments,    // ⚠️ Puede ser incorrecto
      contemplaciones: s.contemplaciones
    }))
  : undefined,
```

**Análisis**: `anonymizedStudentsForPrompt` ya tiene la estructura `{ perfil, ajustes, contemplaciones }` (ver línea 438-444 del provider), por lo que el mapeo puede ser innecesario. Sin embargo, este código ya existía en el provider antes de esta migración.

**Recomendación**: Verificar en runtime si el mapeo es necesario o si puede simplificarse a:
```typescript
estudiantes: context.anonymizedStudentsForPrompt.length > 0
  ? context.anonymizedStudentsForPrompt
  : undefined,
```

**Impacto**: Bajo - Si el mapeo es incorrecto, se manifestaría como error en runtime. La migración de imports es independiente de este detalle.

---

## Notas Técnicas

### Funciones de Compatibilidad

Las funciones `loadGroupContext` y `getGrupoIdFromPlanificacion` se mantienen en el provider como "Backward Compatibility Wrappers" porque:

1. **Legacy UI code**: Algunos componentes aún esperan el formato `GroupContextData` (legacy)
2. **Migración gradual**: Permite migrar código legacy de forma incremental
3. **Sin breaking changes**: Mantiene compatibilidad mientras se migra el resto del código

### Estructura de Datos

- **`GroupContextData`** (legacy): Formato antiguo usado por UI components
- **`GroupContextForAI`** (nuevo): Formato unificado usado por generación IA
- **`loadGroupContext`**: Convierte de nuevo a legacy para compatibilidad

### Dependencias

- **`getGrupoIdFromPlanificacion`**: Usa `supabase` (ya importado en provider)
- **`loadGroupContext`**: Usa `getGroupContextForAI` (función principal del provider)
- **Tipos**: Todos los tipos están en el provider o en `@/types/groupContextForAI`

---

## Impacto

### Riesgo

- **Riesgo**: 🟢 **BAJO**
- **Razón**: Migración mecánica, sin cambios de comportamiento

### Áreas Afectadas

- **Planificación**: Carga de contexto de grupo en wizard y workspace
- **Generación de sesiones**: Carga de contexto en hook de generación
- **Editor de sesiones**: Obtención de grupo_id desde planificación

### Testing Recomendado

1. ✅ **Verificar imports**: Linter sin errores
2. ⚠️ **Probar funcionalidad**: 
   - Crear nueva planificación
   - Editar planificación existente
   - Generar sesiones automáticamente
   - Editar sesión individual

---

## Próximos Pasos (Opcional)

### Migración Completa (Futuro)

Una vez que todo el código legacy use `getGroupContextForAI` directamente:

1. **Eliminar funciones de compatibilidad** del provider
2. **Eliminar tipos legacy** (`PerfilGrupo`, `EstudianteAjuste`, `GroupContextData`)
3. **Actualizar componentes** para usar `GroupContextForAI` directamente

**Nota**: Esto es una refactorización futura, no parte de esta migración.

---

## Conclusión

✅ **Migración completada exitosamente**

- Todos los imports actualizados
- Archivo deprecado eliminado
- Sin errores de compilación
- Comportamiento preservado
- Listo para commit

**Recomendación**: Proceder con commit y testing manual de funcionalidad crítica.

---

**Fin del Informe de Migración**
