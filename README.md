# pyronaut-web

This is the website for **Pyronaut** — A high-performance Python web framework built on Micronaut, with data access, cloud integrations, observability, build-time validation, testing, packaging, and Oracle enterprise support.

Built with [Astro](https://astro.build), [Tailwind CSS v4](https://tailwindcss.com),
and TypeScript, mirroring the page structure of `micronaut-web`.

## Design

The site is a single page where the mascot's flame is the light source:
the dark hero and CTA bands sit in a sparse seeded starfield, lit warm from
where the flamethrower points. Headings use Bricolage Grotesque; flame
orange is kept for things you act on (buttons, commands, the active tab).
Code panels are always editor-dark, the CLI workflow is drawn as a
pipeline, and the FastAPI comparison is a real table. No fake window
chrome, decorative shapes or scroll animations. Structure runs hero → features → code showcase → workflow →
stack comparison → personas → CTA → footer.

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
- `src/pages/launch.astro` + `src/lib/launcher.ts` — Pyronaut Launch, the
  project generator (see below)
- `src/components/SiteHeader.astro`, `src/components/SiteFooter.astro` —
  header and footer shared by every page
- `src/content/blog/` — blog posts (see [Blog](#blog))
- `resources/` — pristine mirror of the upstream artwork from
  [micronaut-projects/pyronaut](https://github.com/micronaut-projects/pyronaut)
  (`media/`); not served directly
- `public/pyronaut-assets/` — the logos and mascot actually shipped, generated
  from `resources/` by `scripts/build-logos.mjs`

## Blog

The blog mirrors the micronaut-web structure. Each post is a Markdown file
under `src/content/blog/YYYY/MM/DD/<name>.md`:

```md
---
slug: 2026/09/23/introducing-pyronaut
title: Introducing Pyronaut
description: One or two sentences shown on the blog index and in meta tags.
date: '2026-09-23T10:00:00'
category: announcements
categories:
  - announcements
tags:
  - pyronaut
href: /2026/09/23/introducing-pyronaut/
---
```

The schema is in `src/content.config.ts` and the helpers in `src/lib/blog.ts`.
Routes:

- `/blog/` and `/blog/page/<n>/` — newest first, 24 posts per page
- `/<slug>/` — the post itself, e.g. `/2026/09/23/introducing-pyronaut/`
- `/category/<category>/` and `/tag/<tag>/` — archives

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

## Pyronaut Launch (`/launch/`)

A Python-only take on [micronaut.io/launch](https://micronaut.io/launch/),
backed by the same [Micronaut Starter](https://github.com/micronaut-projects/micronaut-starter)
API with `lang=PYTHON`, `build=PYRONAUT`, `test=PYTEST`. It is the web
counterpart of the Pyronaut CLI from
[micronaut-projects/pyronaut@0.0.x](https://github.com/micronaut-projects/pyronaut/tree/0.0.x):
it always generates an Application, and shows the equivalent
`pyronaut create-app` (or curl) command. Name the project, pick features, then
preview the generated files, copy a link, or download the ZIP.

- **Feature catalog** — `src/data/starter.json` is a committed snapshot of
  the starter's Python options, minus the JVM-only features that
  `pyronaut create --list-features` hides (the denylist in
  `scripts/sync-starter.mjs` mirrors the Pyronaut CLI's). Builds need no
  network. Refresh it when the starter or the denylist changes:

  ```sh
  node scripts/sync-starter.mjs                    # snapshot.micronaut.io
  node scripts/sync-starter.mjs https://launch.micronaut.io
  ```

- **API endpoint** — defaults to the API the snapshot was taken from;
  override with `PUBLIC_STARTER_API` at build time.
- **CORS** — the starter API only allows `micronaut.io` origins. In
  `npm run dev` requests go through a Vite proxy (`/starter-api`), so
  everything works locally. In production, Preview needs the API to allow
  `pyronaut.io`; until then it shows a notice, and Generate falls back to
  navigating to the ZIP URL (served as an attachment).
- **Archived design** — the first launcher (application type picker and
  feature dialog) is kept in `src/archive/LaunchV1.astro`, outside
  `src/pages`, so it is not published.

## Commands

```sh
npm install
npm run dev        # dev server on 127.0.0.1:4321
npm run build      # typecheck + static build into dist/
npm run preview    # preview the production build
```
