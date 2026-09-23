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
  },
});
