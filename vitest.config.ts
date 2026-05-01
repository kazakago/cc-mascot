import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "dist-electron/", "**/*.config.ts", "**/*.d.ts"],
    },
    projects: [
      {
        test: {
          name: "src",
          globals: true,
          environment: "jsdom",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.spec.ts", "src/**/*.spec.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
      {
        test: {
          name: "electron",
          globals: true,
          environment: "node",
          include: ["electron/**/*.test.ts", "electron/**/*.spec.ts"],
        },
      },
    ],
  },
});
