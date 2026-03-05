import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
 base: (() => {
   const raw = process.env.BASE_URL?.trim();
   if (!raw) return "/";
 
   const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
   return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
 })(),
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
