# Security & Stability — Eliminación de credenciales demo del helper de Edge Functions

## Resumen

Se eliminaron las credenciales demo hardcodeadas del helper de Edge Functions y se centralizó el login demo en AuthContext. El helper ya no hace `signInWithPassword`; solo valida/refresca la sesión y, si no hay sesión válida, hace `signOut()` y lanza un error claro (`AUTH_REQUIRED`). La recuperación de sesión demo ante `SIGNED_OUT` queda únicamente en AuthContext.

---

## Qué era inseguro y por qué

1. **Credenciales en el frontend**
   - En `src/lib/edgeFunctionAuth.ts` había constantes `DEMO_TEACHER_EMAIL` y `DEMO_TEACHER_PASSWORD` duplicadas respecto a AuthContext.
   - Cualquier código que importara el helper (o un bundle que lo incluyera) exponía las credenciales en el cliente.
   - En producción o con bundles inspeccionables, las credenciales quedan expuestas; además, duplicar credenciales aumenta el riesgo de desincronización y de que se usen en más sitios.

2. **Login fuera del contexto de auth**
   - El helper llamaba a `signInWithPassword()` cuando no había sesión o el refresh fallaba, mezclando “validar sesión para una llamada” con “establecer identidad del usuario”.
   - La responsabilidad de “quién está logueado” debe vivir en un solo lugar (AuthContext); los helpers de Edge Functions solo deben comprobar que haya sesión válida para la petición.

3. **Riesgo de bucles y abuso**
   - Re-login automático en un helper genérico podría ejecutarse en contextos no deseados (p. ej. si en el futuro se usa el mismo helper en flujos no-demo) y dificulta controlar cuándo y cómo se hace login.

---

## Cambios realizados

### 1. `src/lib/edgeFunctionAuth.ts`

- **Eliminado:** constantes `DEMO_TEACHER_EMAIL` y `DEMO_TEACHER_PASSWORD` y cualquier llamada a `signInWithPassword`.
- **`ensureValidSession()`**
  - Ahora devuelve `Promise<boolean>` (no `void`).
  - Obtiene la sesión con `getSession()`.
  - Si no hay sesión o no hay `access_token`, devuelve `false` (no hace login).
  - Si hay sesión, solo llama a `refreshSession()` cuando el access token está vencido o por vencer en los próximos 60 segundos (se decodifica el JWT y se mira `exp`), para reducir refreshes innecesarios.
  - Si el refresh falla (p. ej. refresh token inválido), hace `signOut()` y devuelve `false`.
  - No realiza ningún login; las credenciales ya no existen en este archivo.
- **`invokeEdgeFunctionAuthed()`**
  - Llama a `ensureValidSession()`.
  - Si el resultado es `false`, lanza `AuthRequiredError` (código `AUTH_REQUIRED`) con mensaje claro para el usuario.
  - Si hay sesión válida, llama a `supabase.functions.invoke()` como antes.
- **Nuevo:** clase `AuthRequiredError` y constante `AUTH_REQUIRED_CODE` exportadas para que los call sites puedan detectar “sesión requerida” si quieren mostrar un mensaje específico o redirigir.

### 2. `src/contexts/AuthContext.tsx`

- **Nuevo:** ref `signOutRecoveryInProgress` para evitar ejecutar la recuperación varias veces seguidas.
- **En `onAuthStateChange`:**
  - Si `event === 'SIGNED_OUT'`, se llama a `ensureSupabaseAuth()` (misma función que ya hace ensure-demo-users + `signInWithPassword` con las credenciales demo).
  - Así, cuando el helper hace `signOut()` por refresh token inválido, AuthContext reestablece la sesión demo y la siguiente acción del usuario (p. ej. volver a generar) ya tiene JWT válido.
  - El ref evita bucles o múltiples intentos simultáneos de recuperación.

### 3. Call sites (sin cambios de contrato)

- **`requestService.ts`**, **`EvaluacionesGrupo.tsx`**, **`EvaluationAdjustmentsPanel.tsx`** siguen usando `invokeEdgeFunctionAuthed()` sin esperar auto-login.
- Si no hay sesión válida, el helper lanza `AuthRequiredError`; el error se propaga y la UI muestra el mensaje (o el genérico de “error al llamar al servidor”). No se añadió lógica de retry ni login en estos archivos; la recuperación es vía AuthContext en `SIGNED_OUT`.

---

## Cómo se valida/refresca la sesión ahora

1. **`getSession()`**  
   Se usa para saber si hay sesión y access token.

2. **¿Refrescar o no?**  
   Solo se llama a `refreshSession()` cuando el access token está vencido o vence en los próximos 60 segundos (lectura de `exp` del JWT). Así se evitan refreshes innecesarios en cada invocación.

3. **Si el refresh falla**  
   (p. ej. “Refresh Token Not Found”): se llama a `signOut()` y `ensureValidSession()` devuelve `false`. No hay login en el helper.

4. **Resultado**  
   - Sesión existente y token aún válido → no se refresca, se devuelve `true`.  
   - Sesión existente y token por vencer/vencido → refresh; si falla → `signOut()` y `false`.  
   - Sin sesión → `false`.  
   - En todos los casos “sin sesión válida”, `invokeEdgeFunctionAuthed()` lanza `AuthRequiredError` (código `AUTH_REQUIRED`).

---

## Cómo AuthContext maneja el login demo tras signOut

- Las credenciales demo siguen **solo** en AuthContext (`DEMO_TEACHER_EMAIL`, `DEMO_TEACHER_PASSWORD`).
- **Al montar:** se sigue llamando a `ensureSupabaseAuth()` en el efecto inicial (comportamiento ya existente).
- **Al recibir `SIGNED_OUT`** en `onAuthStateChange`:  
  - Se llama a `ensureSupabaseAuth()` (invoca `ensure-demo-users` y luego `signInWithPassword` con el usuario demo).  
  - El ref `signOutRecoveryInProgress` evita reentradas y bucles.  
- Así, cuando el helper hace `signOut()` por refresh token inválido, el listener reestablece la sesión demo; el usuario puede ver un error en la acción que falló (AUTH_REQUIRED) y, al intentar de nuevo o al recargar, ya tiene sesión.

---

## Pasos manuales para confirmar que V2 no devuelve 401 en demo

1. **Sesión sana**
   - Iniciar sesión como profesor (demo).
   - Ir a evaluaciones por grupo, activar Beta V2 y generar una evaluación.
   - Verificar en Network que la llamada a `modify-evaluation-v2` devuelve **200** (no 401).

2. **Sesión rota (refresh token inválido)**
   - Con la app abierta y ya logueado: en DevTools → Application → Local Storage, borrar las claves de Supabase Auth (o limpiar storage del origen).
   - Sin recargar, disparar de nuevo una generación V2 (o un ajuste que llame a `modify-evaluation-v2`).
   - Esperado: la primera llamada puede fallar con error de sesión (AUTH_REQUIRED o mensaje de “no hay sesión válida”) porque el helper hace `signOut()` y lanza.
   - Tras ese fallo, AuthContext habrá recibido `SIGNED_OUT` y habrá ejecutado `ensureSupabaseAuth()`.
   - Volver a intentar “Generar” o “Aplicar ajustes”: la segunda llamada debe devolver **200** (sesión demo reestablecida por AuthContext).

3. **Sin 401 por JWT**
   - En ningún caso debería verse en Network un 401 por “missing/invalid JWT” cuando el usuario está en flujo demo y la sesión se ha reestablecido; si aparece AUTH_REQUIRED es por no haber sesión válida en ese momento, y la corrección es vía login en AuthContext, no vía credenciales en el helper.

---

## Constraints respetados

- No se deshabilitó la verificación JWT en el servidor.
- No se modificó código de Edge Functions.
- Cambios acotados a la capa de auth/invocación en el frontend y a AuthContext.
