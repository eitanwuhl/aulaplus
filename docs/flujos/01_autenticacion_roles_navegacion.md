# Flujo 01 — Autenticación, roles y navegación

> **Documentación funcional de AulaPlus** · Prompt de reimplementación (React + Laravel + PostgreSQL).
> Describe QUÉ hace el sistema y POR QUÉ. No prescribe implementación.
> **Importancia:** Fundamental · **Depende de:** ninguno (es la base del resto de los flujos)

## 1. Propósito

AulaPlus es una plataforma para docentes uruguayos de educación media (marco ANEP) que reúne, en un solo lugar, la gestión de grupos, la planificación de clases, la generación de evaluaciones, las comunicaciones institucionales y una biblioteca de materiales. Existe una segunda experiencia, orientada al estudiante, centrada en un diagnóstico personal de aprendizaje.

Este flujo resuelve tres problemas fundamentales:

1. **Identificar quién entra y con qué rol** (docente o estudiante), porque cada rol ve una aplicación distinta.
2. **Aislar los datos de cada docente**: cada docente debe ver únicamente sus propios grupos, planificaciones, evaluaciones y materiales, nunca los de otro.
3. **Ofrecer una estructura de navegación clara** para el docente, que le permita llegar en pocos pasos a cualquiera de las áreas principales del sistema.

> ⚠️ A definir: En el proyecto viejo la autenticación es de tipo "demostración": cualquier usuario y contraseña son aceptados, y todos los docentes comparten un mismo usuario interno. Eso **no** es un requisito de negocio; es una limitación temporal. La intención real, documentada aquí, es **autenticación real por docente con aislamiento de datos**.

## 2. Actores y roles

| Actor | Rol en este flujo |
|---|---|
| **Docente** | Se autentica, obtiene acceso al panel completo de herramientas pedagógicas y trabaja siempre sobre sus propios datos. Es el usuario principal del sistema. |
| **Estudiante** | Se autentica con una identidad distinta y accede a una experiencia acotada (por ahora, un diagnóstico personal de aprendizaje). No tiene acceso a ninguna herramienta docente. |
| **Sistema** | Verifica identidad y rol, decide a qué área enviar a cada persona, protege el acceso a las secciones según el rol y garantiza que cada docente solo vea lo suyo. |

## 3. Glosario del dominio

- **Rol:** categoría de usuario que determina qué aplicación ve y qué puede hacer. Hay dos: **docente** y **estudiante**.
- **Sesión:** período durante el cual una persona está autenticada y puede operar sin volver a ingresar credenciales.
- **Panel del docente (dashboard):** pantalla de inicio del docente, con saludo, notificaciones institucionales y accesos rápidos.
- **Aislamiento de datos:** principio por el cual los datos creados por un docente (grupos, planificaciones, evaluaciones, materiales) pertenecen a ese docente y no son visibles para otros.
- **Área principal:** cada una de las grandes secciones funcionales del docente (grupos, planificación, evaluaciones, comunicaciones, biblioteca).

## 4. Precondiciones y dependencias

- No depende de ningún otro flujo: es el punto de entrada de toda la aplicación.
- Todos los demás flujos dependen de este, porque asumen que hay un docente autenticado e identificado como propietario de los datos.
- Debe existir un mecanismo de identidad por persona (una cuenta por docente y una identidad por estudiante).

> ⚠️ A definir: cómo se crean las cuentas (registro autogestionado, alta administrada por la institución, o integración con un sistema de identidad de ANEP), y cómo se recuperan contraseñas olvidadas. El proyecto viejo no resuelve nada de esto.

## 5. Flujo principal (happy path)

### 5.1 Elección de rol

1. Al entrar sin sesión activa, la persona ve una pantalla de bienvenida con el nombre de la marca (Aula+) y dos opciones claras: **"Soy Docente"** y **"Soy Alumno"**.
2. La persona elige su rol. Cada opción lleva a una pantalla de inicio de sesión propia.

### 5.2 Inicio de sesión del docente

3. El docente ingresa sus credenciales (identificador de usuario y contraseña).
4. El sistema valida la identidad y, si es correcta, crea una sesión asociada a ese docente.
5. El docente es dirigido a su **panel de inicio (dashboard)**.

### 5.3 Inicio de sesión del estudiante

3'. El estudiante ingresa sus credenciales (un código de estudiante y una contraseña).
4'. El sistema valida la identidad y crea una sesión asociada a ese estudiante.
5'. El estudiante es dirigido directamente a la experiencia de **diagnóstico**.

### 5.4 Navegación del docente ya autenticado

6. El docente ve una estructura persistente compuesta por:
   - Una **barra lateral** con las áreas principales.
   - Un **encabezado superior** con: buscador, nombre del docente, acceso a notificaciones y opción de **cerrar sesión**.
   - Una **traza de migas de pan (breadcrumbs)** que indica dónde está parado dentro de la jerarquía de secciones.
7. Desde la barra lateral y desde los accesos rápidos del panel, el docente puede navegar a cualquier área principal (ver sección 9).

### 5.5 Retorno y cierre de sesión

8. Mientras la sesión siga activa, si el docente vuelve a abrir la aplicación es llevado directamente a su panel (no vuelve a ver la pantalla de elección de rol). Lo mismo aplica al estudiante respecto de su diagnóstico.
9. Al cerrar sesión, la persona vuelve a la pantalla de elección de rol.

## 6. Flujos alternativos y casos borde

- **Persona ya autenticada que abre la raíz de la app:** se la redirige automáticamente a su área según rol (docente → panel; estudiante → diagnóstico). No debe ver la pantalla de elección de rol.
- **Acceso directo a una URL/sección protegida sin sesión:** se redirige a la pantalla de elección de rol / inicio de sesión.
- **Docente intenta acceder a una sección de estudiante (o viceversa):** se bloquea y se redirige al punto de entrada. Cada área es exclusiva de su rol.
- **Credenciales inválidas:** el inicio de sesión debe fallar con un mensaje claro y no crear sesión. (En el proyecto viejo esto no ocurre porque no hay validación; es un requisito nuevo.)
- **Sesión expirada:** al vencer, la persona debe ser tratada como no autenticada y redirigida a iniciar sesión. > ⚠️ A definir: duración de la sesión y política de expiración/renovación.

## 7. Reglas de negocio

- **R1.** Existen exactamente dos roles: **docente** y **estudiante**. Cada persona tiene un rol asociado a su sesión.
- **R2.** El destino tras iniciar sesión depende del rol: docente → panel de inicio; estudiante → diagnóstico.
- **R3.** Toda sección de docente solo es accesible por usuarios con rol docente; toda sección de estudiante solo por usuarios con rol estudiante.
- **R4.** Sin sesión activa, cualquier intento de acceso a una sección protegida redirige al inicio de sesión.
- **R5.** Cada docente solo puede ver y operar sobre datos de los que es propietario (aislamiento por usuario). Ningún docente accede a datos de otro docente.
- **R6.** Las credenciales deben validarse realmente; solo credenciales correctas crean sesión. *(Requisito nuevo: reemplaza el "modo demo" del proyecto viejo, donde toda credencial era aceptada.)*
- **R7.** Mientras la sesión esté vigente, reabrir la aplicación no vuelve a pedir credenciales y lleva directo al área del rol.
- **R8.** Cerrar sesión termina la sesión y devuelve a la persona a la pantalla de elección de rol.
- **R9.** El nombre del docente autenticado se muestra de forma visible (saludo en el panel y encabezado). *(En el proyecto viejo el nombre es ficticio y aleatorio; en el nuevo debe ser el nombre real del docente.)*

## 8. Estados y ciclo de vida

Estado de una persona respecto de la aplicación:

```
No autenticado ──(elige rol + credenciales válidas)──► Autenticado (docente | estudiante)
Autenticado ──(cerrar sesión)──► No autenticado
Autenticado ──(sesión expira)──► No autenticado
```

- En **No autenticado**, solo son accesibles: elección de rol e inicio de sesión de cada rol.
- En **Autenticado como docente**, son accesibles todas las áreas del docente.
- En **Autenticado como estudiante**, solo es accesible la experiencia de estudiante (diagnóstico).

## 9. Información que maneja el flujo

**Identidad de la persona autenticada:**
- Rol (docente o estudiante).
- Nombre para mostrar (del docente o del estudiante).
- Identificador propio del usuario (para docente, su usuario; para estudiante, su código).

**Estructura de navegación del docente (áreas principales):**

| Área | Para qué sirve (visión de negocio) |
|---|---|
| **Inicio / Panel** | Punto de llegada del docente. Muestra saludo personalizado, notificaciones institucionales importantes (comunicaciones de dirección, del equipo psicopedagógico, etc.) y accesos rápidos a tareas frecuentes. |
| **Grupos** | Gestión de los grupos de estudiantes del docente y de los perfiles individuales de cada estudiante. |
| **Planificaciones** | Creación y consulta de planificaciones de clase/unidad. Incluye tanto la herramienta de planificación como el listado de planificaciones guardadas. |
| **Evaluaciones** | Generación de evaluaciones (grupales) y consulta de las evaluaciones ya creadas por el docente. |
| **Comunicaciones** | Espacio de comunicaciones (institucionales y con familias/equipos). |
| **Biblioteca de materiales** | Repositorio de materiales didácticos propios del docente. |

> ⚠️ Supuesto: la barra lateral del proyecto viejo también menciona herramientas adicionales ("Diagnóstico individual", "Reportes ejecutivos", "Análisis y estadísticas") que aparecen como accesos previstos pero cuyo desarrollo puede estar incompleto. Se documentan como **áreas futuras/secundarias**, no como parte del núcleo garantizado.

**Elementos de contexto del panel de inicio:**
- Notificaciones institucionales (con nivel de importancia: informativa o urgente) que pueden enlazar a un perfil de estudiante o sección relacionada.
- Accesos rápidos a: planificar clase, generar evaluaciones y comunicaciones.

> ⚠️ Supuesto: en el proyecto viejo las notificaciones, las estadísticas rápidas ("estudiantes activos", "promedio general", etc.) y las frases motivacionales del panel son contenido de ejemplo fijo. En el proyecto nuevo, las notificaciones y métricas deberían derivarse de datos reales del docente; queda **a definir** su fuente exacta.

## 10. Interacción con IA

No aplica. La autenticación, el control de acceso por rol y la navegación no involucran generación con IA.

## 11. Criterios de aceptación

- [ ] El sistema debe presentar, a una persona sin sesión, una elección entre rol docente y rol estudiante.
- [ ] El sistema debe ofrecer una pantalla de inicio de sesión distinta para cada rol.
- [ ] El sistema debe crear sesión **solo** cuando las credenciales son válidas, y rechazar credenciales incorrectas con un mensaje claro.
- [ ] El sistema debe enviar al docente autenticado a su panel de inicio y al estudiante autenticado a su diagnóstico.
- [ ] El sistema debe impedir que un rol acceda a secciones del otro rol, redirigiendo al punto de entrada.
- [ ] El sistema debe impedir el acceso a cualquier sección protegida sin sesión activa.
- [ ] El sistema debe garantizar que cada docente solo vea y opere sobre sus propios datos.
- [ ] El sistema debe mostrar el nombre real del docente autenticado en el panel y el encabezado.
- [ ] El sistema debe ofrecer, en la vista del docente, una barra lateral con acceso a: grupos, planificaciones, evaluaciones, comunicaciones y biblioteca de materiales.
- [ ] El sistema debe ofrecer una traza de ubicación (migas de pan) coherente con la jerarquía de secciones.
- [ ] El sistema debe permitir cerrar sesión y devolver a la persona a la pantalla de elección de rol.
- [ ] Al reabrir la app con sesión vigente, el sistema debe llevar a la persona directo a su área según rol, sin volver a pedir credenciales.

## 12. Enlaces con otros flujos

- **Todos los flujos del docente** dependen de este: asumen un docente autenticado y propietario de los datos (aislamiento por usuario).
- **Flujo de grupos y perfiles de estudiantes:** las notificaciones del panel enlazan a perfiles de estudiantes.
- **Flujo de planificación** y **Flujo de evaluaciones:** son accesibles desde la navegación y los accesos rápidos definidos aquí.
- **Flujo 08 (Competencias ANEP):** es el marco de referencia pedagógico que atraviesa planificación y evaluaciones, ambas alcanzables desde esta navegación.
