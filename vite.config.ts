import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
            rollupOptions: {
              external: ["chokidar", "fsevents"],
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, "electron/preload.ts"),
        vite: {
          build: {
            outDir: "dist-electron",
            rollupOptions: {
              output: {
                format: "cjs",
                entryFileNames: "preload.js",
              },
            },
          },
        },
      },
    }),
  ],
  server: {
    port: 8563,
  },
  base: "./",
  build: {
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "index.html"),
        settings: path.resolve(__dirname, "settings.html"),
      },
    },
  },
});
