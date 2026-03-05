# Corrección del crash de Hooks en EvaluacionDetalle

**Objetivo:** Eliminar el error de React "Rendered more hooks than during the previous render" al abrir una evaluación guardada desde "Mis Evaluaciones".

---

## 1) Por qué seguía fallando (early returns antes de hooks)

Aunque en un refactor previo se intentó mover los returns de loading/error "después" de los hooks, el componente seguía usando **returns condicionales** en medio del flujo:

- `if (isLoading) return (...);`
- `if (error || !evaluacion) return (...);`
- `return (...);` (contenido principal)

Eso implica que **cualquier return ocurre antes del return final**. Si en alguna versión del archivo (o en una rama/merge) los `useMemo` quedaron declarados *después* de esos `if (isLoading)` o `if (error || !evaluacion)`, entonces:

- En el **primer render** (loading): React ejecuta solo los hooks hasta el primer `return` y sale.
- En el **siguiente render** (datos cargados): ya no se toma el return de loading y se ejecutan más hooks (los `useMemo` que estaban debajo).

Resultado: **número y orden de hooks distintos entre renders** → violación de las reglas de Hooks → "Rendered more hooks than during the previous render".

Mientras existan **varios returns** en el componente, es fácil que un cambio futuro (o un merge) vuelva a colocar un return por delante de algún hook. La solución estable es **no tener ningún return temprano**: un solo return al final.

---

## 2) Cambios aplicados (refactor final)

1. **Un único return al final**  
   No hay `return` antes de haber ejecutado todos los hooks. Se elige el contenido según estado y luego se devuelve una sola vez:
   - Se declara `let content: React.ReactNode;`.
   - `if (isLoading)` → `content = <LoadingState />;`
   - `else if (error || !evaluacion)` → `content = <ErrorState ... />;`
   - `else` → `content = ( ... JSX principal ... );`
   - **Al final:** `return <ErrorBoundary>{content}</ErrorBoundary>;`

2. **Componentes de presentación sin hooks**  
   - **LoadingState:** solo muestra spinner y texto "Cargando evaluación...". Sin hooks.  
   - **ErrorState:** recibe `message` y `onBack`, muestra mensaje y botón "Volver a Mis Evaluaciones". Sin hooks.  
   Así la rama loading/error no introduce hooks y el orden de hooks del padre no depende del estado.

3. **Todos los hooks incondicionales**  
   - useParams, useNavigate, useToast, useAuth, useState (x4), useEffect.  
   - Variables derivadas con `evaluacion?....` (seguras cuando `evaluacion === null`).  
   - useMemo (normalizedAssignments, v2ResponseForDetail, useV2Renderer, hasPerItemRubricInDetail, displayEvaluations, selectedContent), con valores por defecto cuando `evaluacion` es null (`[]`, `null`, `false` según corresponda).

4. **Comentario de barrera**  
   Antes del bloque que asigna `content` se dejó:  
   `// ——— No returns above this line. All hooks must be declared above. ———`  
   para evitar que en el futuro se añada un return por encima de los hooks.

---

## 3) Archivos modificados

- **src/pages/EvaluacionDetalle.tsx**
  - Añadidos componentes presentacionales `LoadingState` y `ErrorState` (sin hooks).
  - Eliminados los dos returns condicionales (`if (isLoading) return ...` e `if (error || !evaluacion) return ...`).
  - Sustituidos por asignación a `content` según estado y un único `return <ErrorBoundary>{content}</ErrorBoundary>` al final.
  - Comentario que indica que no debe haber returns por encima de la zona de elección de `content`.

---

## 4) Pasos para probar a mano

1. Abrir **Mis Evaluaciones** (lista de evaluaciones guardadas).  
2. Hacer clic en una evaluación guardada que tenga contenido.  
3. Comprobar que:
   - No aparece en consola "React has detected a change in the order of Hooks" ni "Rendered more hooks than during the previous render".
   - La vista de detalle se muestra bien (header, contenido V2 o HTML, rúbricas si aplica).  
4. Recargar la página estando en la pantalla de detalle: debe verse primero el loading y luego el contenido, **sin** warnings ni errores de hooks.  
5. Abrir una evaluación con ID inexistente (o eliminada): debe mostrarse la pantalla de error con "Volver a Mis Evaluaciones", sin errores de hooks.

---

## 5) Checklist de regresión

- [ ] Ir a Mis Evaluaciones.  
- [ ] Abrir una evaluación guardada.  
- [ ] No hay warnings ni errores de Hooks en consola.  
- [ ] El detalle renderiza correctamente (V2 o V1 según corresponda).  
- [ ] Recargar en la página de detalle: loading → contenido, sin errores.  
- [ ] ID inexistente: se muestra error y botón de volver, sin crash de hooks.
