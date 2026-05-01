import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    environmentMatchGlobs: [["electron/**/*.test.ts", "node"]],
    include: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "dist-electron/", "**/*.config.ts", "**/*.d.ts"],
    },
    setupFiles: ["./vitest.setup.ts"],
  },
});
