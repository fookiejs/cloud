import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, "../.."), "");
  const backend = env.VITE_BACKEND_URL?.trim() || "http://127.0.0.1:8080";
  const scriptAgent = env.VITE_SCRIPT_AGENT_URL?.trim() || "http://127.0.0.1:4317";
  const proxy = {
    "/api": { target: backend, changeOrigin: true },
    "/health": { target: backend, changeOrigin: true },
    "/healthz": { target: backend, changeOrigin: true },
    "/mobile": { target: backend, changeOrigin: true },
    "/downloads": { target: backend, changeOrigin: true },
    "/v1": { target: scriptAgent, changeOrigin: true, ws: true },
    "/api/v1": { target: scriptAgent, changeOrigin: true, ws: true },
  };

  return {
    base: process.env.VITE_PUBLIC_BASE_PATH?.trim() || "/",
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@script": path.resolve(__dirname, "src/features/script"),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy,
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
