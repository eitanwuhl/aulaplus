# Fix V2 Edge Function 401 — Authorization y auth demo estable

## Resumen

Se corrigió el 401 en las Edge Functions `modify-evaluation-v2` y `modify-evaluation` en entorno local/demo asegurando una sesión Supabase válida antes de cada invocación y recuperando sesiones con refresh token inválido mediante signOut + re-login con el usuario demo.

---

## Causa raíz

1. **Por qué V2 (y V1) devolvían 401**
   - Las llamadas usaban `supabase.functions.invoke()`, que **sí** envía el header `Authorization: Bearer <access_token>` usando la sesión actual del cliente.
   - El problema no era la ausencia del header, sino que la **sesión era inválida**: refresh token no encontrado (400 en `/auth/v1/token`) y 403 en `/auth/v1/user`.
   - Con sesión rota o expirada, el cliente seguía usando un JWT inexistente o caducado, y la Edge Function rechazaba la petición con 401.

2. **Por qué la sesión quedaba rota**
   - En demo, el usuario se autentica con `signInWithPassword` (AuthContext). Si el refresh token guardado en localStorage deja de ser válido (por ejemplo, después de un reset de DB, rotación de secretos o expiración), `getSession()` puede seguir devolviendo una sesión en memoria/caché.
   - El intento de refresh falla con "Refresh Token Not Found" y la sesión no se actualizaba; las siguientes llamadas a Edge Functions seguían usando ese estado inválido.

3. **Comportamiento observado**
   - Console: `/auth/v1/token` → 400 "Invalid Refresh Token: Refresh Token Not Found", `/auth/v1/user` → 403.
   - `modify-evaluation-v2` → 401 y la app hacía fallback a V1 correctamente.

---

## Archivos modificados

| Archivo | Cambio |
|--------|--------|
| **`src/lib/edgeFunctionAuth.ts`** | **Nuevo.** Helper `ensureValidSession()` + `invokeEdgeFunctionAuthed(name, options)`. Asegura sesión válida (refresh o re-login demo) antes de invocar. |
| **`src/services/evaluations/requestService.ts`** | Sustitución de `supabase.functions.invoke` por `invokeEdgeFunctionAuthed` en `requestV1` y `requestV2`. |
| **`src/pages/EvaluacionesGrupo.tsx`** | Import de `invokeEdgeFunctionAuthed`. Todas las llamadas a `modify-evaluation` y `modify-evaluation-v2` (pipeline principal, adaptación desde texto, feedback, regenerar, chat) usan el helper. |
| **`src/components/evaluaciones/v2/EvaluationAdjustmentsPanel.tsx`** | Sustitución de `supabase.functions.invoke('modify-evaluation-v2', ...)` por `invokeEdgeFunctionAuthed('modify-evaluation-v2', ...)`. |

**No se modificó:** código de las Edge Functions; no se desactivó la verificación JWT en servidor.

---

## Cómo se garantiza ahora el Authorization

1. **`ensureValidSession()`** (en `src/lib/edgeFunctionAuth.ts`):
   - Obtiene la sesión con `supabase.auth.getSession()`.
   - Si hay sesión con `access_token`, llama a `supabase.auth.refreshSession()` para refrescar el access token.
   - Si el refresh falla (p. ej. refresh token inválido) o no hay sesión válida: `supabase.auth.signOut()` y luego `signInWithPassword` con el usuario demo (mismas credenciales que en AuthContext).
   - Evita bucles: un solo re-login por llamada; si el login falla se lanza error.

2. **`invokeEdgeFunctionAuthed(name, options)`**:
   - Llama a `ensureValidSession()`.
   - Luego llama a `supabase.functions.invoke(name, options)`.
   - El cliente Supabase usa la sesión ya actualizada, por lo que incluye un JWT válido en `Authorization: Bearer <access_token>`.

3. **Consistencia V1/V2**  
   Todas las rutas de evaluación que usan `modify-evaluation` o `modify-evaluation-v2` en los archivos indicados pasan por `invokeEdgeFunctionAuthed`, por lo que el comportamiento de auth es el mismo para V1 y V2.

---

## Pasos manuales para verificar (V2 devuelve 200, sin fallback a V1)

1. **Recrear sesión rota (opcional)**  
   - En DevTools → Application → Local Storage, borrar las claves de Supabase Auth (o limpiar todo el storage del origen).  
   - Recargar la app y volver a iniciar sesión como profesor (demo).

2. **Probar V2 en Evaluaciones Grupo**  
   - Ir a una evaluación por grupo (ruta que use el pipeline de generación).  
   - Activar el toggle "Beta V2" (o equivalente) si existe.  
   - Disparar una generación (por ejemplo, "Generar evaluación" o "Aplicar" con un plan de diseño).  
   - En consola: no debe aparecer 401; no debe verse fallback a V1 por error de auth.  
   - En Network: la petición a la Edge Function `modify-evaluation-v2` debe devolver **200** y un cuerpo con `success: true` (o la estructura esperada).

3. **Probar panel de ajustes V2**  
   - Con una evaluación ya generada en V2, abrir el panel de ajustes y aplicar un cambio (texto de ajuste + Aplicar).  
   - La llamada a `modify-evaluation-v2` debe ser 200 y aplicarse el ajuste sin error de auth.

4. **Comprobar que no hay fallback por 401**  
   - Si antes veías en consola algo como "V2 endpoint error, falling back to V1" por 401, tras el fix no debería aparecer por causa de autenticación; V2 debería responder 200 cuando el toggle esté activado y la request sea válida.

---

## Notas

- Las credenciales demo están definidas en `src/lib/edgeFunctionAuth.ts` (y en AuthContext); se mantienen alineadas para el flujo demo.
- Otras Edge Functions (p. ej. `generate-plan-completo`, `ensure-demo-users`) no se cambiaron en esta tarea; solo las invocaciones relacionadas con `modify-evaluation` y `modify-evaluation-v2` en los archivos listados usan el helper.
