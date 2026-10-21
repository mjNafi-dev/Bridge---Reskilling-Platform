import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api calls go to the Python backend (uvicorn on port 8000), so the app can use same-origin URLs
const proxy = { "/api": "http://127.0.0.1:8000" };

// host: true lets Replit (and phones on the same Wi-Fi) reach the dev server
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173, proxy },
  preview: { proxy },
});
