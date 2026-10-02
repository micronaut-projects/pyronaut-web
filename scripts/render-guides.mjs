// Renders the Python guides from micronaut-projects/micronaut-guides into
// src/generated/guides.json (the /guides/ pages) and public/guides/ (sample
// project ZIPs and images).
//
// Only guides with a Python variant are rendered, and only that variant. The
// guides' own Gradle build does the heavy lifting: per guide it generates the
// Pyronaut sample project with Micronaut Starter (build/code), zips it
// (build/dist) and expands the guide macros into plain AsciiDoc
// (src/docs/asciidoc/<slug>-pyronaut-python.adoc). That AsciiDoc is rendered
// here exactly like the docs. Needs a JDK.
//
// Set GUIDES_REF to render a specific branch, tag or commit, or
// MICRONAUT_GUIDES_DIR to a local micronaut-guides checkout to skip the clone.
// A published revision that is already rendered is not rendered again; pass
// --force to render it anyway.
import { convert } from "@asciidoctor/core";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { SnippetHtmlConverter, takeListings } from "./lib/asciidoc.mjs";
import { configurationHints } from "./lib/configuration.mjs";

const REPO = process.env.GUIDES_REPOSITORY || "micronaut-projects/micronaut-guides";
const REF = process.env.GUIDES_REF || "master";
const OUTPUT = path.resolve("src/generated/guides.json");
const PUBLIC_DIR = path.resolve("public/guides");
const ROUTE = "/guides";
const SITE = "https://pyronaut.io";
const UPSTREAM_SITE = "https://guides.micronaut.io/latest";
// Opens Micronaut docs pages on Python / Pyronaut code and TOML configuration,
// like the site's other docs.micronaut.io links.
const DOCS_SITE = "https://docs.micronaut.io/";
const DOCS_QUERY = { lang: "python", build: "pyronaut", "config-format": "toml" };

// Javadoc pages have no code or configuration tabs, so they are left alone.
function withDocsQuery(value) {
  if (!value.startsWith(DOCS_SITE) || /\/api\//.test(value)) return value;
  const url = new URL(value);
  for (const [name, setting] of Object.entries(DOCS_QUERY)) url.searchParams.set(name, setting);
  return url.href;
}
const OPTION = "pyronaut-python";
const force = process.argv.includes("--force");
// CI must publish what it was asked to; locally a missing JDK or network
// should not stop `npm run dev`.
const strict = process.env.CI === "true" || process.env.GUIDES_RENDER_STRICT === "true";

const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function upToDate(commit) {
  if (force || !commit) return false;
  const rendered = await readJson(OUTPUT);
  return (
    rendered?.commit === commit &&
    rendered.repository === REPO &&
    rendered.guides.every((guide) => existsSync(path.join(PUBLIC_DIR, guide.zip)))
  );
}

function remoteCommit() {
  const url = `https://github.com/${REPO}.git`;
  // A SHA is its own revision; anything else is resolved against the remote.
  if (/^[0-9a-f]{40}$/.test(REF)) return REF;
  // Full ref names: a bare `master` also matches branches such as `x/master`.
  return git(process.cwd(), "ls-remote", url, `refs/heads/${REF}`, `refs/tags/${REF}`).split(/\s+/)[0] ?? "";
}

function checkout() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "micronaut-guides-"));
  const run = (...args) => execFileSync("git", args, { cwd: dir, stdio: "inherit" });
  run("init", "-q");
  run("remote", "add", "origin", `https://github.com/${REPO}.git`);
  run("fetch", "-q", "--depth", "1", "origin", REF);
  run("checkout", "-q", "FETCH_HEAD");
  return dir;
}

// ── Guides ─────────────────────────────────────────────────────────────────

async function pythonGuides(guidesDir) {
  const root = path.join(guidesDir, "guides");
  const guides = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const metadata = await readJson(path.join(root, entry.name, "metadata.json"));
    if (!metadata || metadata.publish === false) continue;
    const languages = (metadata.languages ?? []).map((language) => String(language).toLowerCase());
    if (!languages.includes("python") && metadata.python !== true) continue;
    guides.push({
      slug: metadata.slug ?? entry.name,
      directory: path.join(root, entry.name),
      intro: metadata.intro ?? "",
      categories: metadata.categories ?? [],
      tags: metadata.tags ?? [],
      publicationDate: metadata.publicationDate ?? "1970-01-01",
    });
  }
  return guides.sort(
    (a, b) => b.publicationDate.localeCompare(a.publicationDate) || a.slug.localeCompare(b.slug),
  );
}

// `micronaut-http-client` → `micronautHttpClient`, as GuidesPlugin names tasks.
const taskSlug = (slug) => slug.replace(/-(.)/g, (_, letter) => letter.toUpperCase());

// Generates each guide's Pyronaut sample project, its ZIP and its expanded
// AsciiDoc, and returns the guides the build has tasks for. Task names differ
// between guides branches: some register per-language tasks, others generate
// every option of a guide at once and name the ZIP task after the option.
function generate(guidesDir, guides) {
  const gradle = (args, options) => execFileSync("./gradlew", ["--console=plain", "-q", ...args], { cwd: guidesDir, ...options });
  const known = new Set(
    gradle(["tasks", "--all"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] })
      .split("\n")
      .map((line) => line.split(" ")[0]),
  );
  const tasks = [];
  const generated = guides.filter((guide) => {
    const name = taskSlug(guide.slug);
    const docs = [`${name}GenerateDocsPython`, `${name}GenerateDocs`].find((task) => known.has(task));
    const zip = [`${name}PythonZipCode`, `${name}PyronautPythonZipCode`].find((task) => known.has(task));
    // The build registers no tasks for a guide it cannot generate, such as
    // one capped below the running JDK.
    if (!docs || !zip) {
      console.warn(`Skipping ${guide.slug}: the guides build has no Python tasks for it`);
      return false;
    }
    tasks.push(docs, zip);
    return true;
  });
  // One guide the build cannot generate must not take the others down with it.
  try {
    gradle(["--continue", ...tasks], { stdio: "inherit" });
  } catch {
    // Reported per guide below.
  }
  return generated.filter((guide) => {
    const complete =
      existsSync(path.join(guidesDir, "src/docs/asciidoc", `${guide.slug}-${OPTION}.adoc`)) &&
      existsSync(path.join(guidesDir, "build/dist", `${guide.slug}-${OPTION}.zip`));
    if (!complete) console.warn(`Skipping ${guide.slug}: the guides build failed to generate it`);
    return complete;
  });
}

// ── Rendering ──────────────────────────────────────────────────────────────

const text = (html) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&#8217;/g, "’")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .trim();

// The guide's `==` and `===` headings for the "On this page" rail.
function headings(html) {
  return [...html.matchAll(/<div class="sect([12])">\s*<h[23] id="([^"]+)">([\s\S]*?)<\/h[23]>/g)].map(
    (match) => ({ id: match[2], title: text(match[3]), depth: Number(match[1]) }),
  );
}

// The generated AsciiDoc links the way the upstream site is laid out: every
// page, ZIP and image is a sibling file. Point those at this site's routes,
// and at the upstream site for guides that have no Python variant.
function rewriteUrls(html, slugs, images) {
  // Only attributes of real tags: a code sample's own `href="` or `src="` is
  // text, which highlighting splits across spans.
  return html.replace(/<[a-z][a-z0-9]*\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi, (tag) => rewriteTagUrls(tag, slugs, images));
}

function rewriteTagUrls(tag, slugs, images) {
  return tag.replace(/\b(href|src)="([^"]*)"/g, (whole, attribute, value) => {
    if (attribute === "href" && value.startsWith(DOCS_SITE)) return `href="${withDocsQuery(value.replace(/&amp;/g, "&")).replace(/&/g, "&amp;")}"`;
    // Links to this site stay on whichever host serves it.
    if (value.startsWith(`${SITE}/`)) {
      const target = value.slice(SITE.length);
      return `${attribute}="${/(\/|\.[a-z0-9]+)([?#].*)?$/i.test(target) ? target : target.replace(/(?=[?#]|$)/, "/")}"`;
    }
    const local = value.startsWith(`${UPSTREAM_SITE}/`) ? value.slice(UPSTREAM_SITE.length + 1) : value;
    if (/^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(local) || !local) return whole;
    const [, file, suffix] = /^([^?#]*)(.*)$/.exec(local.replace(/^(\.\.?\/)+/, ""));
    if (attribute === "src") {
      images.add(file);
      return `src="${ROUTE}/images/${file}${suffix}"`;
    }
    if (file.endsWith(".zip")) return `href="${ROUTE}/${file}${suffix}"`;
    const page = /^(.+?)(?:-(?:gradle|maven|pyronaut)-(?:java|kotlin|groovy|python))?\.html$/.exec(file);
    if (page && slugs.has(page[1])) return `href="${ROUTE}/${page[1]}/${suffix}"`;
    return `href="${UPSTREAM_SITE}/${file}${suffix}"`;
  });
}

async function render(guidesDir, guide, slugs, images) {
  // Some guides branches write the authors and the Micronaut version under the
  // title; neither is published here.
  const source = (
    await fs.readFile(path.join(guidesDir, "src/docs/asciidoc", `${guide.slug}-${OPTION}.adoc`), "utf8")
  ).replace(/^(Authors:|Micronaut Version:).*\n?/gm, "");
  takeListings();
  let html = String(
    await convert(source, {
      safe: "unsafe",
      base_dir: path.join(guidesDir, "src/docs/asciidoc"),
      header_footer: false,
      attributes: {
        sourceDir: path.join(guidesDir, "build/code"),
        "source-highlighter": "none",
        icons: "font",
        idprefix: "",
        idseparator: "-",
        sectanchors: "",
      },
      converter: SnippetHtmlConverter,
    }),
  );
  if (/Unresolved directive/.test(html)) throw new Error(`${guide.slug}: unresolved include`);

  // The page header shows the title and intro, so the preamble repeating the
  // intro is dropped from the body.
  // Falls back to the metadata's intro when the preamble is not just the intro.
  let intro = guide.intro;
  html = html.replace(/<div id="preamble">\s*<div class="sectionbody">([\s\S]*?)<\/div>\s*<\/div>\s*(?=<div class="sect1">)/, (whole, body) => {
    const paragraphs = [...body.matchAll(/<p>([\s\S]*?)<\/p>/g)];
    if (paragraphs.length !== 1) return whole;
    intro = text(paragraphs[0][1]);
    return "";
  });
  html = rewriteUrls(html, slugs, images);

  const title = /^= (.+)$/m.exec(source)?.[1].trim() ?? guide.slug;
  // Authors and the publication date are not published; the date only orders
  // the guides.
  const { directory, publicationDate, ...metadata } = guide;
  const properties = await configurationHints(takeListings());
  return { ...metadata, title, intro: intro.trim(), zip: `${guide.slug}-${OPTION}.zip`, headings: headings(html), properties, html };
}

// Images live in the shared src/docs/images, or beside the guide.
async function copyImage(guidesDir, guides, image) {
  const candidates = [
    path.join(guidesDir, "src/docs/images", image),
    ...guides.map((guide) => path.join(guide.directory, image)),
  ];
  const source = candidates.find((candidate) => existsSync(candidate));
  if (!source) throw new Error(`Missing guide image '${image}'`);
  const target = path.join(PUBLIC_DIR, "images", image);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

async function renderAll() {
  const local = process.env.MICRONAUT_GUIDES_DIR;
  if (!local && (await upToDate(remoteCommit()))) {
    console.log(`Python guides are up to date (${REPO}@${REF}).`);
    return;
  }

  const guidesDir = local ? path.resolve(local) : checkout();
  const commit = (() => {
    try {
      return git(guidesDir, "rev-parse", "HEAD");
    } catch {
      return "";
    }
  })();

  const found = await pythonGuides(guidesDir);
  if (!found.length) throw new Error(`No Python guides found in ${guidesDir}`);
  const guides = generate(guidesDir, found);
  if (!guides.length) throw new Error("The guides build generated no Python guide");

  const slugs = new Set(guides.map((guide) => guide.slug));
  const images = new Set();
  const rendered = [];
  for (const guide of guides) {
    try {
      rendered.push(await render(guidesDir, guide, slugs, images));
    } catch (error) {
      console.warn(`Skipping ${guide.slug}: ${error.message}`);
    }
  }

  await fs.rm(PUBLIC_DIR, { recursive: true, force: true });
  await fs.mkdir(PUBLIC_DIR, { recursive: true });
  for (const guide of rendered) {
    await fs.copyFile(path.join(guidesDir, "build/dist", guide.zip), path.join(PUBLIC_DIR, guide.zip));
  }
  for (const image of images) await copyImage(guidesDir, guides, image);

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, JSON.stringify({ repository: REPO, ref: REF, commit, guides: rendered }));
  console.log(
    `Rendered ${rendered.length} Python guides (${REF} @ ${commit.slice(0, 7)}) → ${path.relative(process.cwd(), OUTPUT)}`,
  );
}

try {
  await renderAll();
} catch (error) {
  if (strict) throw error;
  // Keep whatever was rendered before; the pages need the file to exist.
  if (!existsSync(OUTPUT)) {
    await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
    await fs.writeFile(OUTPUT, JSON.stringify({ repository: REPO, ref: REF, commit: "", guides: [] }));
  }
  console.warn(`Skipped rendering the Python guides: ${error.message}`);
}
