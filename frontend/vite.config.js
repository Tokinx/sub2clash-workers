import path from "path";
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  plugins: [
    ...(command === "serve"
      ? [
          cloudflare({
            configPath: "../wrangler.local.jsonc"
          })
        ]
      : []),
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    host: "127.0.0.1",
    port: 8787
  },
  build: {
    outDir: "../public",
    emptyOutDir: false
  }
}));
