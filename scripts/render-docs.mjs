// Renders the Pyronaut user guide (micronaut-projects/pyronaut, branch 0.0.x,
// src/main/docs) into src/generated/docs.json for the /docs/ page.
//
// Mirrors how micronaut-web renders Micronaut docs: guide/toc.yml drives the
// section order and numbering, every section is its own .adoc file rendered by
// Asciidoctor, and code listings are highlighted with Shiki at build time so no
// highlighter ships to the browser.
//
// Set PYRONAUT_DOCS_REF to render a specific commit, or PYRONAUT_DOCS_DIR to a local pyronaut checkout to skip the git fetch.
import { convert } from "@asciidoctor/core";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import * as yaml from "js-yaml";
import { SnippetHtmlConverter, takeListings } from "./lib/asciidoc.mjs";
import { configurationHints } from "./lib/configuration.mjs";

const REPO = "micronaut-projects/pyronaut";
const BRANCH = process.env.PYRONAUT_DOCS_BRANCH ?? "0.0.x";
// A commit SHA or tag to render instead of the branch head (publish workflows).
const REF = process.env.PYRONAUT_DOCS_REF || BRANCH;
const OUTPUT = path.resolve("src/generated/docs.json");

const repoDir = process.env.PYRONAUT_DOCS_DIR ?? checkout();
const docsDir = path.join(repoDir, "src/main/docs");
const guideDir = path.join(docsDir, "guide");
const properties = readProperties(path.join(repoDir, "gradle.properties"));
const commit = (() => {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoDir, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
})();

function checkout() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "pyronaut-docs-"));
  const git = (...args) => execFileSync("git", args, { cwd: dir, stdio: "inherit" });
  git("init", "-q");
  git("remote", "add", "origin", `https://github.com/${REPO}.git`);
  git("sparse-checkout", "set", "--no-cone", "/src/main/docs/", "/gradle.properties");
  // pyronaut may be private: authenticate the fetch when a token is available.
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const auth = token
    ? ["-c", `http.https://github.com/.extraheader=AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`]
    : [];
  git(...auth, "fetch", "-q", "--depth", "1", "origin", REF);
  git("checkout", "-q", "FETCH_HEAD");
  return dir;
}

function readProperties(file) {
  if (!existsSync(file)) return {};
  const entries = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = /^\s*([^#=\s][^=]*?)\s*=\s*(.*)$/.exec(line);
    if (match) entries[match[1]] = match[2].trim();
  }
  return entries;
}

// ── TOC ────────────────────────────────────────────────────────────────────

async function readToc() {
  const parsed = yaml.load(await fs.readFile(path.join(guideDir, "toc.yml"), "utf8"));
  return tocNodes(parsed, [], "", 0);
}

function tocNodes(map, parentIds, prefix, level) {
  const nodes = [];
  let index = 1;
  for (const [id, value] of Object.entries(map)) {
    if (id === "title") continue;
    const number = prefix ? `${prefix}.${index}` : String(index);
    const title = typeof value === "string" ? value : value?.title;
    if (!title) throw new Error(`TOC section '${id}' has no title`);
    const children =
      value && typeof value === "object" ? tocNodes(value, [...parentIds, id], number, level + 1) : [];
    nodes.push({ id, title, number, level, file: sourceFile(parentIds, id), children });
    index += 1;
  }
  return nodes;
}

// A section file lives at the guide root or under any prefix of its parents.
function sourceFile(parentIds, id) {
  for (let depth = parentIds.length; depth >= 0; depth -= 1) {
    const candidate = path.join(...parentIds.slice(0, depth), `${id}.adoc`);
    if (existsSync(path.join(guideDir, candidate))) return candidate;
  }
  throw new Error(`Missing guide source for TOC section '${id}'`);
}

// ── Rendering ──────────────────────────────────────────────────────────────

const attributes = {
  ...properties,
  version: properties.projectVersion,
  sourceDir: repoDir,
  "source-highlighter": "none",
  icons: "font",
  idprefix: "",
  idseparator: "-",
  sectanchors: "",
};

const claimed = new Set();

function claimId(id) {
  let unique = id;
  for (let n = 2; claimed.has(unique); n += 1) unique = `${id}-${n}`;
  claimed.add(unique);
  return unique;
}

// Ids inside section bodies must not steal a TOC section's id, and repeats
// across files get a numeric suffix. Links to renamed ids are updated.
function uniquifyIds(html, reserved) {
  const renames = new Map();
  const out = html.replace(/\sid="([^"]+)"/g, (whole, id) => {
    const unique = claimId(id);
    if (unique !== id) renames.set(id, unique);
    return ` id="${unique}"`;
  });
  return out.replace(/href="#([^"]+)"/g, (whole, id) =>
    renames.has(id) && !reserved.has(id) ? `href="#${renames.get(id)}"` : whole,
  );
}

const editBase = `https://github.com/${REPO}/edit/${BRANCH}/src/main/docs/guide`;

// A section's own AsciiDoc headings (== and ===) for the "On this page" rail.
function sectionHeadings(html) {
  const headings = [];
  for (const match of html.matchAll(/<div class="sect([12])">\s*<h[23] id="([^"]+)">([\s\S]*?)<\/h[23]>/g)) {
    const title = match[3].replace(/<[^>]+>/g, "").replace(/&#8217;/g, "’").trim();
    headings.push({ id: match[2], title, depth: Number(match[1]) });
  }
  return headings;
}

async function renderNode(node, reserved) {
  const source = await fs.readFile(path.join(guideDir, node.file), "utf8");
  const html = String(
    await convert(source, {
      safe: "unsafe",
      base_dir: repoDir,
      header_footer: false,
      attributes,
      converter: SnippetHtmlConverter,
    }),
  );
  const body = uniquifyIds(html, reserved);
  node.headings = sectionHeadings(body);
  const tag = node.level === 0 ? "h2" : "h3";
  let out = `<section class="doc-section" data-level="${node.level}">
<div class="doc-section-heading">
<${tag} id="${node.id}"><a class="anchor" href="#${node.id}" aria-hidden="true"></a><span class="doc-number">${node.number}</span> ${escape(node.title)}</${tag}>
<a class="doc-edit" href="${editBase}/${node.file}" title="Improve this doc" aria-label="Improve this doc"></a>
</div>
${body}
</section>\n`;
  for (const child of node.children) out += await renderNode(child, reserved);
  return out;
}

function escape(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function allIds(nodes, ids = new Set()) {
  for (const node of nodes) {
    ids.add(node.id);
    allIds(node.children, ids);
  }
  return ids;
}

function stripFiles(nodes) {
  return nodes.map(({ id, title, number, level, headings, children }) => ({
    id,
    title,
    number,
    level,
    headings,
    children: stripFiles(children),
  }));
}

const toc = await readToc();
const reserved = allIds(toc);
for (const id of reserved) claimed.add(id);

let html = "";
for (const node of toc) html += await renderNode(node, reserved);

await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
await fs.writeFile(
  OUTPUT,
  JSON.stringify({
    version: properties.projectVersion ?? "",
    branch: BRANCH,
    commit,
    toc: stripFiles(toc),
    properties: await configurationHints(takeListings()),
    html,
  }),
);
console.log(`Rendered Pyronaut docs (${BRANCH} @ ${commit.slice(0, 7)}, ${reserved.size} sections) → ${path.relative(process.cwd(), OUTPUT)}`);
