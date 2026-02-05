# Configuración de Conexión con Supabase

## Valores Requeridos de Supabase

Para que la aplicación se conecte correctamente a Supabase, necesitas configurar dos variables de entorno:

### 1. `VITE_SUPABASE_URL`
- **Origen**: Dashboard de Supabase → **Project Settings** → **API** → **Project URL**
- **Formato**: `https://YOUR_PROJECT_ID.supabase.co`
- **Ejemplo**: `https://abcdefghijklmnop.supabase.co`

### 2. `VITE_SUPABASE_ANON_KEY`
- **Origen**: Dashboard de Supabase → **Project Settings** → **API** → **anon public** key
- **⚠️ IMPORTANTE**: Debes usar la clave **"anon public"**, NO uses la clave **"service_role"** en el frontend
- La clave `service_role` tiene permisos completos y nunca debe exponerse en código del cliente
- La clave `anon public` es segura para usar en el frontend ya que está protegida por Row Level Security (RLS)

## Requisitos de Vite

### Prefijo `VITE_`
Vite solo expone variables de entorno que comienzan con el prefijo `VITE_`. Cualquier variable sin este prefijo no estará disponible en el código del cliente.

### Ubicación del archivo `.env`
El archivo `.env` debe estar ubicado en la **raíz del proyecto** (mismo nivel que `package.json` y `vite.config.ts`), **NO** dentro de `src/`.

Estructura correcta:
```
aulaplus-v0/
├── .env                    ← Aquí
├── package.json
├── vite.config.ts
├── src/
│   └── ...
└── ...
```

## Cómo Configurar Supabase Localmente

Sigue estos pasos para configurar Supabase en tu entorno de desarrollo:

### Paso 1: Crear el archivo `.env`
Copia el archivo `.env.example` a `.env` en la raíz del proyecto:

```bash
cp .env.example .env
```

### Paso 2: Obtener las credenciales de Supabase
1. Ve al [Dashboard de Supabase](https://app.supabase.com/)
2. Selecciona tu proyecto (o crea uno nuevo si no tienes)
3. Navega a **Project Settings** (⚙️ en el menú lateral)
4. Haz clic en **API** en el menú de configuración

### Paso 3: Copiar Project URL
1. En la sección **Project URL**, copia la URL completa
2. Pégala en `.env` como valor de `VITE_SUPABASE_URL`:

```env
VITE_SUPABASE_URL=https://tu-proyecto-id.supabase.co
```

### Paso 4: Copiar Publishable Key
1. En la misma página, busca la sección **Project API keys**
2. Localiza la clave **"Publishable Key"** (también llamada "anon public" en versiones anteriores)
   - **Formato nuevo**: Empieza con `sb_publishable_` (~40 caracteres)
   - **Formato legacy**: Empieza con `eyJ...` (JWT, ~200+ caracteres) - ya no se recomienda
3. **IMPORTANTE**: NO uses la clave "service_role" (tiene permisos completos y nunca debe exponerse en el frontend)
4. Copia la clave completa
5. Pégala en `.env` como valor de `VITE_SUPABASE_ANON_KEY`:

```env
# Formato nuevo (recomendado):
VITE_SUPABASE_ANON_KEY=sb_publishable_5D-oXfd9WLrn1eP7fwkSaQ_pLY8-Aym

# Formato legacy (aún funciona pero no recomendado):
# VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Paso 5: Verificar el formato del archivo `.env`
El archivo `.env` debe tener este formato (sin comillas, sin espacios alrededor del `=`):

```env
VITE_SUPABASE_URL=https://tu-proyecto-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**❌ Incorrecto:**
```env
VITE_SUPABASE_URL = "https://tu-proyecto-id.supabase.co"  # Espacios y comillas
VITE_SUPABASE_ANON_KEY='eyJ...'                           # Comillas
```

**✅ Correcto:**
```env
VITE_SUPABASE_URL=https://tu-proyecto-id.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_5D-oXfd9WLrn1eP7fwkSaQ_pLY8-Aym
```

### Paso 6: Reiniciar el servidor de desarrollo
Después de crear o modificar el archivo `.env`, **debes reiniciar el servidor de desarrollo** para que Vite cargue las nuevas variables:

```bash
# Detén el servidor (Ctrl+C) y luego:
npm run dev
```

## Validaciones Implementadas

El cliente de Supabase incluye validaciones automáticas:

1. **Verificación de variables requeridas**: Si `VITE_SUPABASE_URL` o `VITE_SUPABASE_ANON_KEY` están ausentes, se lanzará un error descriptivo.

2. **Logging de debug (solo en desarrollo)**: En modo desarrollo, se registran en la consola:
   - El tipo de cada variable
   - Si son `undefined` o `null`
   - La longitud de cada valor
   - Un prefijo de cada valor (primeros 20 caracteres) para verificación sin exponer secretos completos

3. **Advertencia de longitud de clave**: Si la clave anon parece demasiado corta (< 50 caracteres), se muestra una advertencia en desarrollo.

## Solución de Problemas

### Error: "supabaseUrl is required"
**Causa**: `VITE_SUPABASE_URL` no está definida o es `undefined`.

**Soluciones**:
1. Verifica que el archivo `.env` existe en la raíz del proyecto
2. Verifica que la variable se llama exactamente `VITE_SUPABASE_URL` (con el prefijo `VITE_`)
3. Verifica que no hay espacios alrededor del `=` en `.env`
4. Reinicia el servidor de desarrollo después de crear/modificar `.env`

### Error: "Missing VITE_SUPABASE_URL environment variable"
**Causa**: La variable no está definida en `.env` o el archivo no existe.

**Solución**: Sigue los pasos de "Cómo Configurar Supabase Localmente" arriba.

### Las variables aparecen como `undefined` en la consola
**Causas comunes**:
1. El archivo `.env` está en la ubicación incorrecta (debe estar en la raíz, no en `src/`)
2. La variable no tiene el prefijo `VITE_`
3. El servidor de desarrollo no se reinició después de crear/modificar `.env`
4. Hay un error de sintaxis en `.env` (comillas, espacios, etc.)

## Seguridad

- ✅ **Nunca** commitees el archivo `.env` al repositorio (debe estar en `.gitignore`)
- ✅ **Siempre** usa la clave `anon public` en el frontend, nunca `service_role`
- ✅ La clave `anon public` es segura porque está protegida por Row Level Security (RLS) en Supabase
- ✅ El archivo `.env.example` puede commitearse con valores de ejemplo/placeholders

