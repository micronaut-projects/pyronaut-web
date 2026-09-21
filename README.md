# pyronaut-web

This is the website for **Pyronaut** — A high-performance Python web framework built on Micronaut, with data access, cloud integrations, observability, build-time validation, testing, packaging, and Oracle enterprise support.

Built with [Astro](https://astro.build), [Tailwind CSS v4](https://tailwindcss.com),
and TypeScript, mirroring the page structure of `micronaut-web`.

## Design

The site is a single page built from the **Ignition** design direction:
editorial startup style — announcement bar, mono uppercase kickers, a huge
tight-tracking headline, dark pill buttons, a mascot artwork card with an
overlapping code window, and a foundation logo strip. Structure runs hero →
features → code showcase → workflow → deep dives → stack comparison →
personas → CTA → footer.

**Light and dark mode are both supported** — the moon/sun toggle in the
header persists the choice (`localStorage`, class-based Tailwind `dark:`
variant, falls back to the OS preference).

## Project layout

- `src/lib/site-content.ts` — all shared copy (hero, features, workflow,
  code examples, personas, footer), derived from the Pyronaut positioning
  material
- `src/components/CodeTabs.astro` — tabbed code showcase with dual Shiki
  themes (tokens switch with dark mode)
- `src/components/ThemeToggle.astro` — light/dark toggle button
- `src/components/Glyph.astro` — inline stroke icon set
- `src/layouts/BaseLayout.astro` — shared head/meta/fonts + pre-paint theme
  script
- `src/pages/index.astro` — the site homepage
- `resources/` — pristine mirror of the upstream artwork from
  [micronaut-projects/pyronaut](https://github.com/micronaut-projects/pyronaut)
  (`media/`); not served directly
- `public/pyronaut-assets/` — the logos and mascot actually shipped, generated
  from `resources/` by `scripts/build-logos.mjs`

## Logo assets

The header logo, full logo and mascot are served as SVG. The outputs are
committed, so regenerating them is only needed when the upstream artwork
changes:

```sh
npm i --no-save sharp && node scripts/build-logos.mjs
```

`sharp` is intentionally not a project dependency — the script is a one-off
asset pipeline, not part of `npm run build`. It tightens each viewBox to the
real ink bounds, crops a mascot-only variant, puts the Python mark on the
narrow header's nozzle to match the mascot's flamethrower, and re-encodes the
embedded rasters as palette PNGs (~1.2 MB total instead of ~4.9 MB). It also
emits `mascot.png` and `favicon.png`, since social cards cannot use SVG.

## Commands

```sh
npm install
npm run dev        # dev server on 127.0.0.1:4321
npm run build      # typecheck + static build into dist/
npm run preview    # preview the production build
```
