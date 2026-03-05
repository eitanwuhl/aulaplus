# Manejo del puerto del servidor de desarrollo

**Objetivo:** Que `npm run dev` arranque siempre y que quede claro en qué puerto está corriendo la app (por defecto 8080).

---

## 1) Por qué Ctrl+C a veces no libera el puerto en Windows

En Windows, cuando detienes el servidor con **Ctrl+C**:

- El proceso Node/Vite recibe la señal de interrupción y puede terminar, pero el **puerto (p. ej. 8080) no se libera al instante**.
- El sistema puede dejar el socket en estado **TIME_WAIT** durante un tiempo (segundos o más).
- Si ejecutas `npm run dev` de nuevo enseguida, el puerto sigue ocupado y Vite podría intentar usar otro (8081, 8084, etc.) o, con `strictPort: true`, fallar.

Además, a veces el proceso no termina por completo (p. ej. terminal en segundo plano o varios procesos usando el mismo puerto), y el puerto queda tomado hasta que ese proceso se cierre.

---

## 2) Solución en dos capas

### Capa 1: Script que intenta liberar el 8080

Antes de arrancar Vite, `npm run dev` ejecuta:

```bash
node scripts/free-port-8080.cjs
```

Ese script (CommonJS, extensión `.cjs` para ser compatible con el proyecto ESM) llama a `npx kill-port 8080`. Si hay un proceso escuchando en el 8080, se intenta terminar para liberar el puerto. El script **siempre sale con código 0**, así que aunque el puerto ya estuviera libre o `kill-port` falle, el siguiente paso (`vite`) se ejecuta igual.

- **Ubicación:** `scripts/free-port-8080.cjs`
- **Por qué .cjs:** El proyecto tiene `"type": "module"` en `package.json`. Un `.js` se interpreta como ESM y no puede usar `require()`. Con extensión `.cjs`, Node lo trata como CommonJS y el script sigue funcionando sin tocar la configuración ESM del repo.

### Capa 2: Vite con `strictPort: false`

En `vite.config.ts`:

- **port: 8080** — Puerto preferido.
- **strictPort: false** — Si el 8080 sigue ocupado tras el script, Vite usa el siguiente puerto libre en lugar de fallar.

Así `npm run dev` **siempre** inicia el servidor. La consola de Vite muestra la URL final, por ejemplo:

```text
  ➜  Local:   http://localhost:8080/
```

o, si usó otro puerto:

```text
  ➜  Local:   http://localhost:8084/
```

Siempre puedes ver en esa línea en qué puerto está realmente el servidor.

---

## 3) Cómo liberar el 8080 a mano (si hace falta)

Si el script no libera el puerto o quieres cerrar tú el proceso:

### Windows (PowerShell o CMD)

1. Ver qué proceso usa el 8080:
   ```powershell
   netstat -ano | findstr :8080
   ```
2. La última columna es el **PID**. Cerrar ese proceso:
   ```powershell
   taskkill /PID <PID> /F
   ```
   (sustituir `<PID>` por el número)

### macOS / Linux

1. Ver proceso en el 8080:
   ```bash
   lsof -i :8080
   ```
2. Cerrar por PID:
   ```bash
   kill -9 <PID>
   ```

### Usando npx (cualquier OS)

```bash
npx kill-port 8080
```

(No es una dependencia del proyecto; npx lo descarga al usarlo.)

---

## 4) Resumen

| Aspecto | Detalle |
|--------|--------|
| **Por qué falla a veces** | Ctrl+C en Windows no siempre libera el puerto al momento; el proceso o TIME_WAIT pueden dejar 8080 ocupado. |
| **Capa 1** | `scripts/free-port-8080.cjs` intenta liberar 8080 antes de Vite; siempre sale 0 para que `vite` se ejecute. |
| **Capa 2** | Vite con `strictPort: false` usa 8080 si está libre, o el siguiente disponible; la consola muestra la URL con el puerto real. |
| **Liberar 8080 a mano** | Windows: `netstat -ano \| findstr :8080` y `taskkill /PID <PID> /F`. Unix: `lsof -i :8080` y `kill -9 <PID>`. O `npx kill-port 8080`. |
