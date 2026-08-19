# Plantilla y convenciones — Documentación funcional de AulaPlus

> Este archivo define la estructura y las reglas de estilo que **todos** los documentos de `docs/flujos/` deben seguir. No es un flujo en sí mismo; es la guía de autoría.

## Para qué sirve esta documentación

AulaPlus se está **reimplementando desde cero** con arquitectura profesional (Frontend en **React**, Backend en **Laravel**, Base de datos en **PostgreSQL**). Estos documentos se usarán como **prompts** para sesiones de IA (Claude Code) que implementarán cada funcionalidad en el proyecto nuevo.

Por lo tanto, cada documento describe **QUÉ debe hacer el sistema y POR QUÉ** (lógica de negocio), **no CÓMO** estaba implementado en el proyecto viejo.

## Reglas de oro (obligatorias)

1. **Idioma: español.** Todo el contenido en español neutro-rioplatense, claro y profesional.
2. **Lógica de negocio, agnóstica al stack.** Prohibido incluir:
   - Nombres de archivos, componentes o clases del proyecto viejo (ej. `PlanificacionWizard.tsx`, `useFullSessionGeneration`).
   - Esquemas de tablas SQL, nombres de columnas, migraciones.
   - Endpoints REST concretos, rutas de API, nombres de funciones edge.
   - Referencias a Supabase, React Router, shadcn u otras tecnologías específicas del viejo stack.
   - En su lugar, describir la **información**, las **reglas** y los **comportamientos** en términos de negocio.
3. **Extraer, no copiar.** Leé el código del proyecto viejo para entender la lógica real, pero traducila a requisitos funcionales. Si el código tiene un comportamiento, describí la intención de negocio detrás de él.
4. **No inventar.** Documentá solo lo que existe en el código/behavior. Si algo es ambiguo o parece incompleto, marcalo explícitamente con `> ⚠️ Supuesto:` o `> ⚠️ A definir:`.
5. **Verificable.** Las reglas de negocio y los criterios de aceptación deben poder chequearse (evitá vaguedades).
6. **La IA es un actor de primera clase.** Cuando un flujo usa generación con IA, documentala como parte central: objetivo pedagógico, contexto que recibe, resultado esperado y reglas que debe respetar.

## Estructura obligatoria de cada documento

Usá exactamente estas secciones (podés omitir una sección solo si de verdad no aplica, indicándolo con "No aplica"):

```markdown
# Flujo NN — <Título>

> **Documentación funcional de AulaPlus** · Prompt de reimplementación (React + Laravel + PostgreSQL).
> Describe QUÉ hace el sistema y POR QUÉ. No prescribe implementación.
> **Importancia:** <Fundamental | Alta | Media | Baja> · **Depende de:** <flujos NN, NN>

## 1. Propósito
Para qué existe la funcionalidad y qué problema real del docente (o estudiante) resuelve.

## 2. Actores y roles
Quién participa: Docente, Estudiante, Sistema/IA. Qué hace cada uno aquí.

## 3. Glosario del dominio
Términos propios de este flujo con su significado pedagógico/institucional
(ej. "unidad didáctica", "contemplación", "competencia ANEP", "sesión", "rúbrica").

## 4. Precondiciones y dependencias
Qué debe existir antes de usar este flujo. Enlazar a otros flujos por número.

## 5. Flujo principal (happy path)
Paso a paso desde la perspectiva del usuario. Numerado.

## 6. Flujos alternativos y casos borde
Variantes, errores esperables, estados vacíos, cancelaciones, límites.

## 7. Reglas de negocio
Lista numerada (R1, R2, …). Cada regla concreta y verificable.

## 8. Estados y ciclo de vida
Si alguna entidad tiene estados (ej. borrador → guardado → archivado, o estados de una sesión),
listarlos con sus transiciones válidas. Usar diagrama textual si ayuda.

## 9. Información que maneja el flujo
Los conceptos de datos en términos de negocio (NO esquema): qué se captura, qué se muestra,
qué se deriva/calcula. Describir cada dato por su significado, no por su tipo o columna.

## 10. Interacción con IA
(Si el flujo usa IA; si no, "No aplica".)
- **Objetivo:** qué produce la IA y con qué fin pedagógico.
- **Contexto que recibe:** qué información de negocio se le pasa como insumo (conceptual).
- **Resultado esperado:** forma y contenido del output, y cómo se usa.
- **Reglas que la IA debe respetar:** (ej. respetar contemplaciones activas, ceñirse a las
  competencias seleccionadas, no exceder la duración de la clase).
- **Comportamiento ante fallos:** reintentos, degradación, qué ve el usuario si falla.

## 11. Criterios de aceptación
Checklist verificable. Formato: `- [ ] El sistema debe …`.

## 12. Enlaces con otros flujos
Lista de flujos relacionados con una frase de por qué se relacionan.
```

## Estilo

- Preferí listas y tablas a párrafos largos.
- Numerá las reglas de negocio y los pasos para poder referenciarlos.
- Cuando describas comportamiento de IA, separá claramente "insumo" de "resultado" de "reglas".
- Mantené cada documento autocontenido: alguien debería poder implementar el flujo leyendo solo ese archivo (más los enlaces).
