// Asciidoctor pieces shared by render-docs.mjs and render-guides.mjs: code
// listings are highlighted with Shiki at build time, so no highlighter ships to
// the browser.
import { Html5Converter } from "@asciidoctor/core";
import { codeToHtml } from "shiki";

const LANGUAGE_LABELS = {
  python: "Python",
  toml: "TOML",
  bash: "Shell",
  shell: "Shell",
  sh: "Shell",
  java: "Java",
  json: "JSON",
  yaml: "YAML",
  xml: "XML",
  html: "HTML",
  css: "CSS",
  groovy: "Groovy",
  kotlin: "Kotlin",
  properties: "Properties",
  dockerfile: "Dockerfile",
  text: "Text",
};

// Trailing callout markers such as `# <1>`, `// <2>`, `<!--3-->` or `<3>`.
const CALLOUT = /\s*(?:(?:#|\/\/|--|;;)\s*)?((?:<(?:!--)?\d+(?:--)?>\s*)+)$/;

export async function highlight(source, language) {
  const lines = source.replace(/\s+$/, "").split("\n");
  const callouts = lines.map((line) => {
    const match = CALLOUT.exec(line);
    return match ? [...match[1].matchAll(/<(?:!--)?(\d+)(?:--)?>/g)].map((m) => m[1]) : [];
  });
  const code = lines.map((line, i) => (callouts[i].length ? line.replace(CALLOUT, "") : line)).join("\n");

  let highlighted;
  try {
    highlighted = await codeToHtml(code, {
      lang: language,
      themes: { light: "one-light", dark: "one-dark-pro" },
      defaultColor: false,
    });
  } catch {
    highlighted = await codeToHtml(code, {
      lang: "text",
      themes: { light: "one-light", dark: "one-dark-pro" },
      defaultColor: false,
    });
  }

  let line = -1;
  return highlighted.replace(/<span class="line">([\s\S]*?)(?=<span class="line">|<\/code>)/g, (whole) => {
    line += 1;
    const marks = callouts[line] ?? [];
    if (!marks.length) return whole;
    const conums = marks.map((n) => `<i class="conum" data-value="${n}"></i>`).join("");
    return whole.replace(/<\/span>(\s*)$/, `${conums}</span>$1`);
  });
}

const IMPORT_LINE = /^(package\s|import\s|from\s+\S+\s+import\b)/;

// Splits a sample into its leading package and import block and the rest, so
// snippets can fold the imports away like an IDE. Blank lines between imports
// stay in the block; parenthesised Python imports are followed to their
// closing paren. Mirrors `splitLeadingImports` in micronaut-web.
function splitLeadingImports(code) {
  const lines = code.split("\n");
  let end = 0;
  let open = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (open > 0 || IMPORT_LINE.test(line)) {
      open += (line.match(/\(/g) ?? []).length - (line.match(/\)/g) ?? []).length;
      end = i + 1;
    } else if (line.trim() !== "") {
      break;
    }
  }
  const body = lines.slice(end).join("\n").replace(/^\s*\n/, "");
  // A sample that is all imports has nothing to fold them above.
  if (end === 0 || !body.trim()) return { body: code };
  return { imports: lines.slice(0, end).join("\n").trimEnd(), body };
}

// Every listing rendered since the last `takeListings()`, for the
// configuration property hints (see configuration.mjs).
let listings = [];

export function takeListings() {
  const taken = listings;
  listings = [];
  return taken;
}

export class SnippetHtmlConverter extends Html5Converter {
  async convert_listing(node) {
    const language = String(node.getAttribute("language") || "text").toLowerCase();
    let source = node.getSource();
    if (node.getSubstitutions?.().includes("attributes")) source = node.subAttributes(source);
    listings.push({ language, source });
    const title = node.hasTitle() ? `<div class="snippet-title">${node.getTitle()}</div>` : "";
    const label = LANGUAGE_LABELS[language] ?? language.toUpperCase();
    const { imports, body } = splitLeadingImports(source);
    const count = imports?.split("\n").filter((line) => IMPORT_LINE.test(line)).length;
    const folded = imports
      ? `<details class="snippet-imports"><summary>${count} import${count === 1 ? "" : "s"}</summary>
${await highlight(imports, language)}
</details>\n`
      : "";
    return `<div class="snippet" data-lang="${language}"${node.getId() ? ` id="${node.getId()}"` : ""}>
<div class="snippet-header">${title}<span class="snippet-lang">${label}</span>
<button type="button" class="snippet-copy" data-copy aria-label="Copy code" title="Copy code"></button></div>
${folded}${await highlight(body, language)}
</div>`;
  }
}
