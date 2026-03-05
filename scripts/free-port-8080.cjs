/**
 * Intenta liberar el puerto 8080 antes de arrancar el dev server.
 * Así, si Ctrl+C no cerró bien el proceso anterior, el siguiente `npm run dev` lo libera.
 * Siempre sale con 0 para que npm continúe con `vite`.
 * (.cjs para que Node lo trate como CommonJS aunque el proyecto sea ESM)
 */
const { execSync } = require('child_process');
try {
  execSync('npx kill-port 8080', { stdio: 'inherit' });
} catch (_) {
  // Port libre o kill-port no disponible; seguir igual
}
process.exit(0);
