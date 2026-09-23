import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

/**
 * Syntax highlighting for the /launch/ preview. Only the languages a
 * generated Pyronaut project contains are bundled, with the same dual
 * themes as the homepage code showcase (CodeTabs).
 */

const LANGUAGES: Record<string, string> = {
  py: "python",
  toml: "toml",
  yml: "yaml",
  yaml: "yaml",
  md: "markdown",
  json: "json",
  xml: "xml",
  sh: "shellscript",
  properties: "ini",
  Dockerfile: "dockerfile",
};

let highlighter: Promise<HighlighterCore> | undefined;

function load() {
  highlighter ??= createHighlighterCore({
    themes: [import("shiki/themes/one-light.mjs"), import("shiki/themes/one-dark-pro.mjs")],
    langs: [
      import("shiki/langs/python.mjs"),
      import("shiki/langs/toml.mjs"),
      import("shiki/langs/yaml.mjs"),
      import("shiki/langs/markdown.mjs"),
      import("shiki/langs/json.mjs"),
      import("shiki/langs/xml.mjs"),
      import("shiki/langs/shellscript.mjs"),
      import("shiki/langs/ini.mjs"),
      import("shiki/langs/dockerfile.mjs"),
    ],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighter;
}

export function languageFor(path: string) {
  const file = path.split("/").at(-1)!;
  return LANGUAGES[file] ?? LANGUAGES[file.split(".").at(-1)!] ?? "text";
}

/** Highlighted `<pre>` HTML, or null when the file type is not supported. */
export async function highlight(code: string, path: string) {
  const lang = languageFor(path);
  if (lang === "text") return null;
  return (await load()).codeToHtml(code, {
    lang,
    themes: { light: "one-light", dark: "one-dark-pro" },
    defaultColor: "light",
  });
}
