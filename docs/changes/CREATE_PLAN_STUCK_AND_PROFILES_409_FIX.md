# Fix: Navegación Bloqueada y Spam de Errores 409 en /profiles

**Fecha**: 2025-01-XX  
**Tipo**: Bugfix  
**Alcance**: Corrección de loop de upsert de perfiles y mejoramiento de UX de creación de planificaciones

## Problemas Identificados

### Problema 1: Spam de Errores 409 en /rest/v1/profiles

#### Síntoma
La consola de DevTools mostraba múltiples errores repetidos:
```
Failed to load resource: 409 (Conflict) on /rest/v1/profiles
```
Y logs repetidos de:
```
Profile updated silently
```

#### Causa Raíz
**Archivo**: `src/contexts/AuthContext.tsx` (líneas 74-103)

El código original tenía varios problemas:

1. **Upsert sin manejo de errores**: El `upsert` se ejecutaba en un `setTimeout` sin `.catch()`, por lo que los errores 409 no se manejaban.

```typescript
// Código problemático (ANTES)
if (session?.user) {
  setTimeout(() => {
    supabase.from('profiles').upsert({
      user_id: session.user.id,
      display_name: 'Profesor Demo',
      role: 'teacher'
    }).then(() => {
      console.log('Profile updated silently');
    });
  }, 0);
}
```

2. **Ejecución múltiple**: El `onAuthStateChange` puede dispararse múltiples veces (en cada cambio de estado de autenticación), causando múltiples intentos de upsert simultáneos.

3. **409 no tratado como éxito**: Cuando un perfil ya existe, Supabase puede retornar 409 (Conflict) si hay problemas de concurrencia o políticas RLS, pero el código no trataba esto como un caso exitoso.

4. **Sin protección contra ejecuciones concurrentes**: No había ninguna protección para evitar que se ejecutaran múltiples upserts para el mismo usuario al mismo tiempo.

#### Impacto
- Spam de errores en consola que dificultaba el debugging
- Posible inestabilidad de la aplicación por múltiples requests simultáneos
- Confusión al ver errores 409 aunque la funcionalidad funcionara

### Problema 2: Botón "Crear Planificación" No Navega

#### Síntoma
Después de hacer clic en "Crear planificación", la aplicación:
- No navegaba al workspace (`/planificacion/:id`)
- No mostraba errores visibles en la UI
- Permaneció en la pantalla de resumen sin feedback claro

#### Causa Raíz
**Archivo**: `src/pages/PlanificacionWizard.tsx` (función `handleFinish`)

Problemas identificados:

1. **Manejo de errores silencioso**: Algunos errores se logueaban en consola pero no se mostraban al usuario con toasts claros.

2. **Falta de protección contra doble clicks**: No había un estado `isCreating` que previera múltiples ejecuciones simultáneas.

3. **Navegación condicional problemática**: La navegación solo ocurría si `planesGenerados === true`, pero si había errores en la generación (aunque la planificación se hubiera creado), la navegación no ocurría.

4. **Errores de autenticación mal manejados**: Si había problemas con la autenticación, el error no se mostraba claramente.

#### Impacto
- Usuarios no podían completar la creación de planificaciones
- Falta de feedback visual sobre qué estaba pasando
- Experiencia de usuario frustrante

## Soluciones Implementadas

### Solución 1: Fix del Upsert de Perfiles (Idempotente y Robusto)

**Archivo**: `src/contexts/AuthContext.tsx`

#### Cambios Realizados

1. **Agregado `useRef` para trackear upserts en progreso**:
```typescript
const profileUpsertInProgress = useRef<Set<string>>(new Set());
```

2. **Protección contra ejecuciones múltiples**:
```typescript
// Prevent multiple concurrent upserts for the same user
if (profileUpsertInProgress.current.has(userId)) {
  if (import.meta.env.DEV) {
    console.log(`[AuthContext] Profile upsert already in progress for user ${userId}, skipping`);
  }
  return;
}

profileUpsertInProgress.current.add(userId);
```

3. **Upsert con `onConflict` y manejo completo de errores**:
```typescript
supabase.from('profiles').upsert({
  user_id: userId,
  display_name: 'Profesor Demo',
  role: 'teacher'
}, {
  onConflict: 'user_id'
}).then(({ error }) => {
  if (error) {
    // Treat 409-like errors as success - profile already exists
    if (error.code === '23505' || error.code === 'PGRST116' || 
        error.message?.includes('duplicate') || error.message?.includes('unique')) {
      if (import.meta.env.DEV) {
        console.log(`[AuthContext] Profile already exists for user ${userId} (this is OK)`);
      }
    } else {
      // Only log non-409 errors
      console.error(`[AuthContext] Error upserting profile for user ${userId}:`, error);
    }
  } else {
    if (import.meta.env.DEV) {
      console.log(`[AuthContext] Profile upserted successfully for user ${userId}`);
    }
  }
}).catch((error) => {
  // Handle unexpected errors (same logic as .then)
  // ...
}).finally(() => {
  // Remove from in-progress set after delay
  setTimeout(() => {
    profileUpsertInProgress.current.delete(userId);
  }, 1000);
});
```

#### Mejoras Clave

- ✅ **Idempotente**: Trata errores 409 como éxito (perfil ya existe)
- ✅ **Sin ejecuciones múltiples**: Usa `Set` para trackear upserts en progreso
- ✅ **Manejo completo de errores**: Tanto `.then()` como `.catch()` manejan todos los casos
- ✅ **Logging condicional**: Solo loguea en modo DEV para no saturar producción
- ✅ **Cleanup automático**: Limpia el set después de 1 segundo para permitir reintentos si es necesario

### Solución 2: Mejora del Manejo de Errores y Navegación

**Archivo**: `src/pages/PlanificacionWizard.tsx`

#### Cambios Realizados

1. **Agregado estado `isCreating` para prevenir doble clicks**:
```typescript
const [isCreating, setIsCreating] = useState(false);
```

2. **Validación temprana con toast**:
```typescript
if (!wizardData.contexto || !wizardData.horario || !wizardData.enfoque) {
  toast({
    title: "Error",
    description: "Faltan datos requeridos para crear la planificación",
    variant: "destructive"
  });
  return;
}
```

3. **Protección contra ejecuciones concurrentes**:
```typescript
if (isCreating || isLoading || isGeneratingPlans) {
  console.warn('[PlanificacionWizard] Creation already in progress, ignoring duplicate request');
  return;
}
```

4. **Manejo mejorado de errores de autenticación**:
```typescript
if (signInError) {
  const errorMsg = `No se pudo autenticar: ${signInError.message}`;
  if (import.meta.env.DEV) {
    console.error('[PlanificacionWizard] Sign-in error:', signInError);
  }
  throw new Error(errorMsg);
}
```

5. **Mensajes de error más descriptivos**:
```typescript
if (planError) {
  if (import.meta.env.DEV) {
    console.error('[PlanificacionWizard] Plan creation error:', planError);
  }
  throw new Error(`Error al crear la planificación: ${planError.message || planError.code || 'Error desconocido'}`);
}
```

6. **Navegación garantizada en éxito**:
```typescript
if (planesGenerados) {
  toast({
    title: "¡Planificación completa!",
    description: "Todos los planes de clase han sido generados y guardados.",
  });
  
  // Navigate to workspace after successful creation
  const planificacionId = planificacion.id;
  console.log(`[PlanificacionWizard] Navigating to workspace: /planificacion/${planificacionId}`);
  navigate(`/planificacion/${planificacionId}`);
  return; // Exit early on success
}
```

7. **Navegación parcial en caso de errores de generación**:
```typescript
catch (generationError) {
  // ... error handling ...
  
  // Navigate anyway if plan was created (partial success)
  if (planificacion?.id) {
    console.log(`[PlanificacionWizard] Navigating to workspace despite generation errors: /planificacion/${planificacion.id}`);
    navigate(`/planificacion/${planificacion.id}`);
    return;
  }
}
```

8. **Toasts más informativos y visibles**:
```typescript
toast({
  title: "Error al crear planificación",
  description: errorMessage,
  variant: "destructive",
  duration: 5000 // Show longer for errors
});
```

9. **Actualización del prop `isLoading` para incluir `isCreating`**:
```typescript
<WizardSteps
  // ... other props ...
  isLoading={isLoading || isGenerating || isCreating}
/>
```

#### Mejoras Clave

- ✅ **Prevención de doble clicks**: Estado `isCreating` bloquea ejecuciones concurrentes
- ✅ **Feedback visual claro**: Todos los errores muestran toasts descriptivos
- ✅ **Navegación garantizada**: Si la planificación se crea, siempre navega (incluso si hay errores parciales en generación)
- ✅ **Logging estructurado**: Todos los logs usan prefijo `[PlanificacionWizard]` para fácil debugging
- ✅ **Manejo de errores exhaustivo**: Cada operación tiene su propio manejo de errores con mensajes claros

## Archivos Modificados

### 1. `src/contexts/AuthContext.tsx`
- **Líneas afectadas**: 1, 44, 74-103
- **Cambios**:
  - Agregado `useRef` para trackear upserts en progreso
  - Mejorado el `useEffect` del `onAuthStateChange` con:
    - Protección contra ejecuciones múltiples
    - Upsert con `onConflict: 'user_id'`
    - Manejo completo de errores (409 tratado como éxito)
    - Logging condicional (solo DEV)

### 2. `src/pages/PlanificacionWizard.tsx`
- **Líneas afectadas**: 563, 655-922, 1084
- **Cambios**:
  - Agregado estado `isCreating`
  - Mejorado `handleFinish` con:
    - Validación temprana con toasts
    - Protección contra ejecuciones concurrentes
    - Manejo mejorado de errores en cada paso
    - Navegación garantizada en éxito
    - Navegación parcial si plan se crea pero generación falla
    - Toasts más informativos
  - Actualizado prop `isLoading` en `WizardSteps` para incluir `isCreating`

## Verificación

### Verificación del Fix de Perfiles

#### Antes
1. Abrir DevTools → Network tab
2. Navegar por la app
3. **Resultado**: Múltiples requests 409 a `/rest/v1/profiles` y spam de logs

#### Después
1. Abrir DevTools → Network tab
2. Navegar por la app
3. **Resultado esperado**:
   - ✅ No hay requests 409 (o si los hay, se manejan silenciosamente)
   - ✅ Solo un upsert por usuario por sesión
   - ✅ Logs claros en DEV mode indicando estado del upsert

### Verificación de Navegación

#### Caso de Prueba 1: Creación Exitosa
1. Ir a `/planificacion/wizard`
2. Completar todos los pasos:
   - Seleccionar "Sin Período Específico"
   - Cantidad de Sesiones: 3, Duración: 80
   - Crear unidades y asignar clases
3. Hacer clic en "Crear Planificación"
4. **Resultado esperado**:
   - ✅ Botón se deshabilita inmediatamente
   - ✅ Toast de "Generando planes automáticamente"
   - ✅ Después de generar, toast de "¡Planificación completa!"
   - ✅ Navega automáticamente a `/planificacion/{id}`

#### Caso de Prueba 2: Error en Autenticación
1. Simular error de autenticación (modificar temporalmente credenciales)
2. Intentar crear planificación
3. **Resultado esperado**:
   - ✅ Toast rojo con mensaje: "Error al crear planificación: No se pudo autenticar: ..."
   - ✅ Log en consola (DEV) con detalles del error
   - ✅ No navega (correcto, porque falló)

#### Caso de Prueba 3: Error en Creación de Plan
1. Simular error en creación (ej: campo requerido faltante)
2. Intentar crear planificación
3. **Resultado esperado**:
   - ✅ Toast rojo con mensaje descriptivo del error
   - ✅ Log en consola (DEV) con detalles
   - ✅ No navega (correcto, porque falló)

#### Caso de Prueba 4: Error Parcial (Plan Creado pero Generación Falla)
1. Crear planificación exitosamente
2. Simular error en generación de planes (ej: timeout)
3. **Resultado esperado**:
   - ✅ Toast de advertencia: "La planificación se creó pero hubo problemas..."
   - ✅ Navega al workspace de todas formas (plan existe)
   - ✅ Usuario puede regenerar planes desde el workspace

#### Caso de Prueba 5: Prevención de Doble Click
1. Completar wizard
2. Hacer clic rápido múltiples veces en "Crear Planificación"
3. **Resultado esperado**:
   - ✅ Solo se ejecuta una vez
   - ✅ Botón se deshabilita después del primer click
   - ✅ Log en consola: "Creation already in progress, ignoring duplicate request"

## Comportamiento Antes y Después

### Antes: Upsert de Perfiles
- **Problema**: Múltiples upserts simultáneos causaban 409
- **Comportamiento**: Spam de errores en consola, posible inestabilidad
- **Feedback**: Ninguno (errores silenciados)

### Después: Upsert de Perfiles
- **Solución**: Upsert idempotente con protección contra ejecuciones múltiples
- **Comportamiento**: Un solo upsert por usuario, 409 tratado como éxito
- **Feedback**: Logs claros en DEV mode

### Antes: Creación de Planificación
- **Problema**: No navegaba si había errores en generación
- **Comportamiento**: Usuario quedaba en pantalla de resumen sin feedback
- **Feedback**: Errores solo en consola (invisibles para usuario)

### Después: Creación de Planificación
- **Solución**: Navegación garantizada si plan se crea, toasts visibles para todos los errores
- **Comportamiento**: Siempre navega si la planificación existe, muestra errores claramente
- **Feedback**: Toasts descriptivos para todos los casos (éxito, error, advertencia)

## Consideraciones Técnicas

### Preservación de Funcionalidad
- ✅ No se cambió el esquema de BD
- ✅ No se modificó la lógica de autenticación demo
- ✅ El flujo "Período Específico" sigue funcionando igual
- ✅ Todas las validaciones existentes se mantienen

### Compatibilidad
- ✅ Backward compatible: no afecta datos existentes
- ✅ No requiere migraciones
- ✅ No rompe APIs existentes

### Rendimiento
- ✅ Reduce carga en Supabase (menos requests repetidos)
- ✅ Mejora UX con feedback inmediato
- ✅ Previene race conditions en creación de planificaciones

## Conclusión

Este bugfix resuelve dos problemas críticos:

1. **Spam de errores 409**: El upsert de perfiles ahora es idempotente y maneja correctamente los conflictos, eliminando el spam de errores en consola.

2. **Navegación bloqueada**: La creación de planificaciones ahora:
   - Siempre muestra feedback visual claro (toasts)
   - Siempre navega si la planificación se crea exitosamente
   - Previene doble clicks
   - Maneja errores de forma visible y descriptiva

Los cambios son mínimos y focalizados:
- **2 archivos modificados**
- **Mejoras incrementales sin cambios breaking**
- **Mejor experiencia de usuario y debugging**















