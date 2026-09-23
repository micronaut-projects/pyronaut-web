// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://pyronaut.io",
  markdown: {
    // Dual themes; global.css switches token colors when `.dark` is active.
    shikiConfig: {
      themes: { light: "one-light", dark: "one-dark-pro" },
    },
  },
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
