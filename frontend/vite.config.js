import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, proxy API + link routes to the FastAPI backend on :8000.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/r": "http://127.0.0.1:8000",
      "/p": "http://127.0.0.1:8000",
      "/healthz": "http://127.0.0.1:8000",
    },
  },
});
