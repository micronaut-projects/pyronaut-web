// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://pyronaut.io",
  vite: {
    plugins: [tailwindcss()],
    server: {
      // The Micronaut Starter API only allows CORS from micronaut.io, so the
      // /launch/ page talks to it through this proxy during development.
      proxy: {
        "/starter-api": {
          target: process.env.PUBLIC_STARTER_API ?? "https://snapshot.micronaut.io",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/starter-api/, ""),
        },
      },
    },
  },
});
