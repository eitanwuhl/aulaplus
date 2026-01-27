# Fix: Sidebar Logo - Using Real Asset Instead of Text-Based SVG

## Resumen
Se corrigió el bug donde el logo del sidebar se estaba renderizando como texto usando un SVG con elementos `<text>`, lo que causaba que se viera diferente (tipografía del navegador, espaciado incorrecto, "+" separado). Ahora el sidebar está preparado para usar el logo oficial como archivo de imagen real (PNG o SVG con paths).

## Causa Raíz

### Problema Identificado
El logo en el sidebar se veía diferente al logo oficial porque:
1. **SVG con elementos `<text>`**: El archivo `src/assets/logo/aulaplus-logo.svg` contenía elementos `<text>` que se renderizaban usando las fuentes del navegador, no como una imagen sólida.
2. **Renderizado como texto**: Aunque se usaba un tag `<img>`, el SVG interno con `<text>` se renderizaba como texto seleccionable, con espaciado y tipografía dependientes del navegador.
3. **Aspecto visual incorrecto**: El logo se veía como texto plano "Aula +" con el símbolo "+" separado, en lugar de una imagen de marca unificada.

### Por Qué se Veía Diferente
- Los elementos `<text>` en SVG usan las fuentes instaladas en el sistema del usuario
- El espaciado entre "Aula" y "+" dependía del renderizado del texto, no de un diseño fijo
- La tipografía podía variar entre navegadores y sistemas operativos
- No había control preciso sobre el diseño visual del logo

## Archivos Modificados

### 1. `src/components/AppSidebar.tsx`

**Cambio realizado**:
- ✅ Cambiado el import del logo de `.svg` a `.png` para usar un archivo de imagen real
- ✅ Mantenido el uso de `<img>` tag (correcto)
- ✅ Verificado que no hay texto renderizado en el sidebar brand slot

**Línea modificada**: 12

**Antes**:
```tsx
import logo from "@/assets/logo/aulaplus-logo.svg"
```

**Después**:
```tsx
import logo from "@/assets/logo/aulaplus-logo.png"
```

**Código del renderizado** (sin cambios, ya correcto):
```tsx
<img 
  src={logo} 
  alt="Aula+" 
  className={`transition-all duration-200 object-contain ${
    open ? "h-14 w-auto ml-8" : "h-10 w-10"
  }`}
  style={{
    maxWidth: open ? 'calc(100% - 2.5rem)' : '2.5rem',
    display: 'block'
  }}
  draggable="false"
/>
```

### 2. `src/assets/logo/aulaplus-logo.svg`

**Acción realizada**:
- ✅ Renombrado a `aulaplus-logo.svg.old` para evitar uso accidental
- ✅ El archivo ya no se referencia en el código

**Razón**: El SVG contenía elementos `<text>` y no es el logo oficial. Se mantiene con extensión `.old` por razones históricas pero no se usa.

## Asset del Logo Oficial

### Ruta Esperada
- **Import path**: `@/assets/logo/aulaplus-logo.png`
- **Ruta física**: `src/assets/logo/aulaplus-logo.png`
- **Tipo**: PNG (recomendado) o SVG con paths (no texto)

### Nota Importante
**El archivo `src/assets/logo/aulaplus-logo.png` debe ser agregado manualmente con el logo oficial proporcionado.**

Si el logo oficial es un SVG, debe:
- ✅ Contener paths (`<path>`, `<polygon>`, etc.) en lugar de `<text>`
- ✅ Ser una imagen vectorial real, no texto renderizado
- ✅ Si contiene `<text>`, debe convertirse a PNG o a paths SVG

### Verificación del SVG
Para verificar si un SVG es adecuado, abrirlo en un editor de texto y buscar:
- ❌ **No usar si contiene**: `<text>` elementos
- ✅ **Usar si contiene**: `<path>`, `<polygon>`, `<circle>`, etc. (elementos gráficos)

## Layout y Alineación

### Alineación Horizontal
El logo está alineado con el texto de navegación usando:
- **SidebarHeader padding**: `px-2` = 8px
- **Margin-left del logo**: `ml-8` = 32px (cuando sidebar abierto)
- **Total desde borde**: 8px + 32px = 40px

Esto coincide con donde comienza el texto de los items de navegación:
- SidebarContent: `px-2` = 8px
- SidebarMenuButton: `p-2` = 8px
- Icono: `h-4 w-4` = 16px
- Gap: `gap-2` = 8px
- **Total**: 8 + 8 + 16 + 8 = 40px ✅

### Tamaño del Logo
- **Sidebar abierto**: `h-14` (56px de altura), ancho automático manteniendo aspect ratio
- **Sidebar colapsado**: `h-10 w-10` (40px x 40px), con `object-contain`
- **Altura mínima del contenedor**: `min-h-[3.5rem]` (56px)

### Estilos Aplicados
- ✅ `object-contain`: Mantiene el aspect ratio del logo
- ✅ `transition-all duration-200`: Transición suave al colapsar/expandir
- ✅ `display: block`: Previene espacios en blanco
- ✅ `draggable="false"`: Previene arrastre accidental
- ✅ Sin fondos, bordes, gradientes, sombras u opacidad

## Verificación de Fuente Única

### Búsqueda en el Código
Se verificó que:
- ✅ Solo hay una referencia al logo: `src/components/AppSidebar.tsx` línea 12
- ✅ No hay texto "Aula+" renderizado en el sidebar brand slot
- ✅ El único "Aula+" en el código es el atributo `alt` (correcto para accesibilidad)
- ✅ No hay otros assets de logo compitiendo en el mismo slot

### Referencias Encontradas
- `src/components/AppSidebar.tsx`: Import y uso del logo (correcto)
- Otros componentes (HeroSection, Footer, etc.): Renderizan "Aula+" como texto en sus propios contextos (no afectan el sidebar)

## Validación Manual

### Pasos para Verificar

1. **Agregar el logo oficial**:
   - Colocar el archivo del logo oficial en `src/assets/logo/aulaplus-logo.png`
   - Si el logo es SVG, verificar que no contenga elementos `<text>`
   - Si contiene `<text>`, convertir a PNG o a SVG con paths

2. **Iniciar la aplicación**:
   ```bash
   npm run dev
   # o
   bun dev
   ```

3. **Verificar el logo en el sidebar (abierto)**:
   - Abrir la aplicación en el navegador
   - Expandir el sidebar si está colapsado
   - Verificar que el logo aparezca en la parte superior izquierda
   - ✅ **Correcto**: El logo se ve como una imagen sólida, no como texto
   - ✅ **Correcto**: El logo tiene el diseño exacto del archivo proporcionado
   - ✅ **Correcto**: El borde izquierdo del logo está alineado con el borde izquierdo del texto "Inicio"

4. **Verificar que es una imagen, no texto**:
   - Intentar seleccionar el logo con el mouse
   - ✅ **Correcto**: No se puede seleccionar como texto (es una imagen)
   - ✅ **Correcto**: Al hacer clic derecho, aparece opción "Guardar imagen" (si es PNG)
   - ❌ **Incorrecto**: Se puede seleccionar como texto o copiar texto del logo

5. **Verificar alineación**:
   - Comparar visualmente el borde izquierdo del logo con el borde izquierdo del texto "Inicio"
   - ✅ **Correcto**: Están alineados
   - ❌ **Incorrecto**: El logo está centrado o desalineado

6. **Verificar tamaño**:
   - ✅ El logo debe tener aproximadamente 56px de altura cuando el sidebar está abierto
   - ✅ El logo debe verse balanceado, no muy pequeño ni muy grande
   - ✅ El logo debe mantener sus proporciones (no distorsionado)

7. **Verificar sidebar colapsado**:
   - Colapsar el sidebar (click en el botón de toggle)
   - ✅ El logo debe reducirse a 40x40px
   - ✅ Debe mantener sus proporciones
   - ✅ No debe desbordarse del contenedor

8. **Verificar que coincide con el asset**:
   - Abrir el archivo `src/assets/logo/aulaplus-logo.png` en un visor de imágenes
   - Comparar visualmente con el logo mostrado en el sidebar
   - ✅ **Correcto**: Son idénticos (mismo diseño, mismos colores, misma forma)
   - ❌ **Incorrecto**: Se ven diferentes (tipografía diferente, espaciado diferente, "+" separado)

### Qué Buscar

#### ✅ Correcto
- Logo renderizado como imagen (no seleccionable como texto)
- Logo coincide exactamente con el archivo proporcionado
- Logo alineado con el texto de navegación
- Tamaño apropiado y balanceado
- Transición suave al colapsar/expandir
- Aspect ratio preservado

#### ❌ Incorrecto
- Logo se puede seleccionar como texto
- Logo se ve diferente al archivo proporcionado
- Tipografía diferente a la del logo oficial
- "+" separado de "Aula"
- Logo centrado en lugar de alineado
- Logo muy pequeño o muy grande
- Logo distorsionado (aspect ratio incorrecto)

## Notas Técnicas

### Procesamiento de Assets en Vite
- **PNG**: Vite procesa PNGs como assets estáticos y genera URLs optimizadas
- **SVG**: Vite puede procesar SVGs de dos maneras:
  1. Como URL (default): `import logo from './logo.svg'` → string URL
  2. Como componente React: requiere plugin adicional

En este proyecto, usamos el método 1 (URL) para ambos PNG y SVG.

### Caché del Navegador
Si el logo no se actualiza después de agregar el archivo:
1. Hard refresh: `Ctrl+Shift+R` (Windows/Linux) o `Cmd+Shift+R` (Mac)
2. Limpiar caché del navegador
3. Verificar que el archivo se guardó en la ruta correcta

### Fallback
Si el logo no carga:
- El navegador mostrará el texto alternativo "Aula+" del atributo `alt`
- No hay fallback de texto renderizado en el código (correcto)
- Verificar que el archivo existe en `src/assets/logo/aulaplus-logo.png`

## Archivos Relacionados

- `src/components/AppSidebar.tsx` - Componente que renderiza el logo (modificado)
- `src/assets/logo/aulaplus-logo.png` - Asset del logo oficial (debe agregarse)
- `src/assets/logo/aulaplus-logo.svg.old` - SVG antiguo con texto (no se usa)
- `src/components/ui/sidebar.tsx` - Componente base del sidebar (no modificado)

## Estado
✅ Preparado - El código está listo para usar el logo oficial. El archivo `src/assets/logo/aulaplus-logo.png` debe agregarse manualmente con el logo oficial proporcionado.

## Próximos Pasos
1. Agregar el archivo del logo oficial a `src/assets/logo/aulaplus-logo.png`
2. Si el logo es SVG, verificar que no contenga elementos `<text>`
3. Si contiene `<text>`, convertir a PNG o a SVG con paths
4. Validar manualmente siguiendo los pasos de validación

## Fecha de Implementación
19 de enero de 2026











