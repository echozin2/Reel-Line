import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // During local dev, `vercel dev` serves /api itself. This proxy is a
      // fallback for `npm run dev` without the Vercel CLI — see README.
      "/api": "http://localhost:3000",
    },
  },
});
