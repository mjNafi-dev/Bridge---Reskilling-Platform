import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// host: true lets Replit (and phones on the same Wi-Fi) reach the dev server
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
});
