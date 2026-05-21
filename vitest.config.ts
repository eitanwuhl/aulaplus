import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/services/auth/**/*.test.ts",
      "src/services/notifications/**/*.test.ts",
      "src/services/teacherGroups/**/*.test.ts",
      "src/lib/teacherGroups/**/*.test.ts",
      "src/lib/planificacion/**/*.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
