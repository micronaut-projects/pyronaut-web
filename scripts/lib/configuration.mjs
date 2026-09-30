// Hover text for the configuration keys in rendered snippets: the type,
// default and description the Micronaut configuration references document.
// Mirrors scripts/docs/configuration-references.ts in micronaut-web, reading
// the references from the published module docs instead of a local build.
import * as yaml from "js-yaml";

// Modules whose `configurationreference.html` is looked up; every module's
// build publishes that page next to its guide.
const MODULES = [
  "core",
  "security",
  "views",
  "data",
  "sql",
  "serialization",
  "validation",
  "micrometer",
  "tracing",
  "cache",
  "email",
  "flyway",
  "liquibase",
  "mongodb",
  "redis",
  "kafka",
  "discovery-client",
  "object-storage",
  "oracle-cloud",
  "aws",
  "gcp",
  "azure",
];
const referenceUrl = (module) =>
  `https://micronaut-projects.github.io/micronaut-${module}/latest/guide/configurationreference.html`;
// Where the hover links: the same reference on the Micronaut docs site, which
// keeps the table anchors and opens with Python / Pyronaut selected.
const referenceHref = (module, anchor) =>
  `https://docs.micronaut.io/latest/${module}/configuration-reference/?lang=python&build=pyronaut${anchor ? `#${anchor}` : ""}`;

const text = (html) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "’")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const cells = (row, tag) => Array.from(row.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "g")), (cell) => cell[1]);

// One page of "Configuration Properties for <Owner>" tables with Property /
// Type / Description / Default value columns, each preceded by its anchor.
function parseReference(html, module) {
  const rows = [];
  let anchor;
  for (const match of html.matchAll(/<a id="([^"]+)"|<table\b[\s\S]*?<\/table>/g)) {
    if (match[1]) {
      anchor = match[1];
      continue;
    }
    const header = cells(/<thead\b[\s\S]*?<\/thead>/.exec(match[0])?.[0] ?? "", "th").map((cell) => text(cell).toLowerCase());
    const column = (label, fallback) => {
      const index = header.findIndex((cell) => cell.startsWith(label));
      return index >= 0 ? index : fallback;
    };
    const body = /<tbody\b[\s\S]*?<\/tbody>/.exec(match[0])?.[0] ?? match[0];
    for (const row of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
      const values = cells(row[1], "td");
      const property = text(values[column("property", 0)] ?? "");
      if (!property) continue;
      rows.push({
        property,
        type: text(values[column("type", 1)] ?? ""),
        description: text(values[column("description", 2)] ?? ""),
        defaultValue: text(values[column("default", 3)] ?? ""),
        href: referenceHref(module, anchor),
      });
    }
    anchor = undefined;
  }
  return rows;
}

let references;

// The hints are an enhancement: a module that cannot be fetched is left out.
function loadReferences() {
  references ??= Promise.all(
    MODULES.map(async (module) => {
      try {
        const response = await fetch(referenceUrl(module), { signal: AbortSignal.timeout(20_000) });
        return response.ok ? parseReference(await response.text(), module) : [];
      } catch {
        return [];
      }
    }),
  ).then((modules) => {
    const exact = new Map();
    const patterns = [];
    for (const hint of modules.flat()) {
      const known = exact.get(hint.property);
      // The same key can be listed twice; keep the described one.
      if (known?.description || (known && !hint.description)) continue;
      exact.set(hint.property, hint);
      // `*` stands for any one key segment and `[*]` for any list index.
      if (hint.property.includes("*")) {
        const pattern = hint.property
          .replace(/[.[\]]/g, "\\$&")
          .replace(/\\\[\*\\\]/g, "\\[\\d+\\]")
          .replace(/\*/g, "[^.\\[]+");
        patterns.push([new RegExp(`^${pattern}$`), hint]);
      }
    }
    return { exact, patterns };
  });
  return references;
}

const kebabCase = (key) => key.replace(/([a-z\d])([A-Z])/g, "$1-$2").toLowerCase();

const join = (path, segment) => (!path ? segment : segment.startsWith("[") ? path + segment : `${path}.${segment}`);

function flatten(value, path, keys) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${path}[${index}]`, keys));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) flatten(child, join(path, key), keys);
  }
  if (path) keys.add(path);
}

// Dotted keys as snippets write them flat: `micronaut.server.port`,
// `micronaut.router.static-resources[0].paths`.
const FLAT_KEY = /(?<![\w.-])[a-z][\w-]*(?:\.[\w-]+|\[\d+\])+/g;

// The flat keys a listing sets. The page's hover rebuilds the same key from a
// nested snippet (src/lib/configuration-key-path.ts), so it has to be shipped
// under that spelling.
function listingKeys({ language, source }, keys) {
  for (const [key] of source.matchAll(FLAT_KEY)) keys.add(key);
  if (language === "toml") {
    const arrays = new Map();
    let table = "";
    for (const line of source.split("\n")) {
      const header = /^\s*(\[\[?)\s*([^\]]+?)\s*\]/.exec(line);
      if (header) {
        const name = header[2].replace(/["']/g, "");
        if (header[1] === "[[") {
          const index = (arrays.get(name) ?? -1) + 1;
          arrays.set(name, index);
          table = `${name}[${index}]`;
        } else {
          table = name;
        }
        continue;
      }
      const key = /^\s*([\w."'-]+)\s*=/.exec(line)?.[1];
      if (key) keys.add(join(table, key.replace(/["']/g, "")));
    }
  } else if (language === "yaml" || language === "yml") {
    try {
      flatten(yaml.load(source), "", keys);
    } catch {
      // Not a standalone document; the flat keys above are all it offers.
    }
  }
}

/** The documented properties the listings mention, keyed as written there. */
export async function configurationHints(listings) {
  const keys = new Set();
  for (const listing of listings) listingKeys(listing, keys);
  if (!keys.size) return {};
  const { exact, patterns } = await loadReferences();
  const mentioned = {};
  for (const key of keys) {
    // A list entry, `mongodb.package-names[0]`, is documented as the list,
    // and a camelCase key, `nThreads`, as its kebab-case form, `n-threads`.
    const list = key.replace(/(?:\[\d+\])+$/, "");
    const hint = [key, list, kebabCase(key), kebabCase(list)]
      .map((candidate) => exact.get(candidate) ?? patterns.find(([pattern]) => pattern.test(candidate))?.[1])
      .find(Boolean);
    if (hint) mentioned[key] = hint;
  }
  return mentioned;
}
