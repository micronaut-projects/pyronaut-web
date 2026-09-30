// Hover docs for code snippets, ported from micronaut-web's
// code-api-type-hover: type names are resolved from the imports the snippets
// already carry (folded ones included) and configuration keys from the hints
// the page ships, so the rendered HTML needs no per-token markup. The word
// under the pointer is painted with the CSS Custom Highlight API and gets a
// popover with its qualified name, the javadoc's first sentence and a link.
import {
  importedTypes,
  javadocHref,
  javadocSummary,
  qualifiedReference,
  wildcardTypes,
} from "@/lib/code-api-types";
import { configurationKeyPath, isNestedConfigurationLanguage, kebabCase } from "@/lib/configuration-key-path";

/** A documented property, from scripts/lib/configuration.mjs. */
export interface ConfigurationPropertyHint {
  property: string;
  type: string;
  description: string;
  defaultValue: string;
  href: string;
}

type Properties = Record<string, ConfigurationPropertyHint>;

interface Word {
  name: string;
  qualifiedName: string;
  href: string;
  rect: DOMRect;
  range: Range;
  code: HTMLElement;
  property?: ConfigurationPropertyHint;
}

const SNIPPET_SELECTOR = ".docs-prose .snippet";
const CODE_SELECTOR = `${SNIPPET_SELECTOR} pre code`;
const HIGHLIGHT_NAME = "code-api-type";
const OPEN_DELAY_MS = 300;
const CLOSE_DELAY_MS = 250;

const properties: Properties = (() => {
  try {
    return JSON.parse(document.querySelector("[data-code-properties]")?.textContent || "{}") ?? {};
  } catch {
    return {};
  }
})();

const summaries = new Map<string, Promise<string | undefined>>();

function summaryOf(href: string) {
  let summary = summaries.get(href);
  if (!summary) {
    // A member link would get its class's summary, so it gets none.
    summary =
      href.startsWith("https://micronaut-projects.github.io/") && !href.includes("#")
        ? fetch(href)
            .then((response) => (response.ok ? response.text() : ""))
            .then((html) => (html ? javadocSummary(html) : undefined))
            .catch(() => undefined)
        : Promise.resolve(undefined);
    summaries.set(href, summary);
  }
  return summary;
}

function caretAt(x: number, y: number) {
  if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(x, y);
    return position && { node: position.offsetNode, offset: position.offset };
  }
  const range = document.caretRangeFromPoint?.(x, y);
  return range && { node: range.startContainer, offset: range.startOffset };
}

/** Imported types on this page, built on first use from the snippets' own imports. */
let pageTypes: Map<string, string> | undefined;

function typesOnPage() {
  pageTypes ??= importedTypes(Array.from(document.querySelectorAll(SNIPPET_SELECTOR), (snippet) => snippet.textContent || ""));
  return pageTypes;
}

/** A snippet's own imports win over the page's. */
const snippetResolvers = new WeakMap<Element, (name: string) => string | undefined>();

function resolverFor(code: HTMLElement) {
  // The folded imports are a code block of their own in the same snippet.
  const snippet = code.closest(SNIPPET_SELECTOR) || code;
  let resolve = snippetResolvers.get(snippet);
  if (!resolve) {
    const source = snippet.textContent || "";
    const types = importedTypes([source]);
    const wildcard = wildcardTypes(source);
    resolve = (name) => types.get(name) || typesOnPage().get(name) || wildcard(name) || undefined;
    snippetResolvers.set(snippet, resolve);
  }
  return resolve;
}

/** The dotted qualifiers written before a word: `Relation.` for `Kind`. */
function qualifiersBefore(node: Node, offset: number, code: HTMLElement) {
  const line = node.parentElement?.closest(".line") || code;
  const before = document.createRange();
  before.setStart(line, 0);
  before.setEnd(node, offset);
  const qualifiers = /(?:[A-Za-z_]\w*\.)+$/.exec(before.toString())?.[0];
  return qualifiers ? qualifiers.slice(0, -1).split(".") : [];
}

/** The snippet's text before or after an offset in one of its text nodes. */
function textAround(code: HTMLElement, node: Node, offset: number, side: "before" | "after") {
  const range = document.createRange();
  range.selectNodeContents(code);
  if (side === "before") range.setEnd(node, offset);
  else range.setStart(node, offset);
  return range.toString();
}

/** The configuration key or imported type name under the pointer. */
function wordAt(x: number, y: number): Word | undefined {
  const caret = caretAt(x, y);
  const node = caret?.node;
  if (!caret || !node || node.nodeType !== Node.TEXT_NODE) return undefined;
  const code = node.parentElement?.closest<HTMLElement>(CODE_SELECTOR);
  if (!code) return undefined;
  const language = code.closest<HTMLElement>(SNIPPET_SELECTOR)?.dataset.lang;
  const text = node.textContent || "";
  const around = (pattern: RegExp) => {
    let start = caret.offset;
    let end = caret.offset;
    while (start > 0 && pattern.test(text[start - 1])) start -= 1;
    while (end < text.length && pattern.test(text[end])) end += 1;
    return [start, end] as const;
  };
  let [start, end] = around(/[\w.\-[\]]/);
  let name = text.slice(start, end);
  let property = Object.hasOwn(properties, name) ? properties[name] : undefined;
  if (!property && language && isNestedConfigurationLanguage(language)) {
    [start, end] = around(/[\w.-]/);
    name = text.slice(start, end);
    const key =
      name &&
      configurationKeyPath(language, textAround(code, node, start, "before"), name, textAround(code, node, end, "after"));
    // A camelCase key is documented kebab-cased, and a list key is shipped
    // as its first entry.
    const found =
      key &&
      [key, kebabCase(key), `${key}[0]`, `${kebabCase(key)}[0]`].find((candidate) => Object.hasOwn(properties, candidate));
    if (found) property = properties[found];
  }
  let qualifiedName: string | undefined = property?.property;
  let href: string | undefined = property?.href;
  if (!property) {
    [start, end] = around(/\w/);
    name = text.slice(start, end);
    qualifiedName = qualifiedReference([...qualifiersBefore(node, start, code), name], resolverFor(code));
    href = qualifiedName && javadocHref(qualifiedName);
  }
  if (!qualifiedName || !href) return undefined;
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const rect = range.getBoundingClientRect();
  // The caret snaps to the nearest character, so check the word is hit.
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return undefined;
  return { name, qualifiedName, href, rect, range, code, property };
}

function paint(word: Word | undefined) {
  if (typeof Highlight === "undefined" || !CSS.highlights) return;
  if (word) CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(word.range));
  else CSS.highlights.delete(HIGHLIGHT_NAME);
}

// ── Popover ────────────────────────────────────────────────────────────────

const popover = document.createElement("div");
popover.className = "code-hover";
popover.hidden = true;
popover.setAttribute("role", "tooltip");
document.body.append(popover);

let shown: Word | undefined;
let overPopover = false;
let openTimer = 0;
let closeTimer = 0;
let current: Word | undefined;

const element = (tag: string, className: string, text: string) => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};

function hide() {
  shown = undefined;
  popover.hidden = true;
}

function show(word: Word) {
  shown = word;
  const name = element("p", "code-hover-name", "");
  const qualifier = word.qualifiedName.replace(/[^.]*$/, "");
  name.append(element("span", "code-hover-muted", qualifier), word.qualifiedName.slice(qualifier.length));
  const link = element("a", "code-hover-link", word.property ? "Configuration reference ↗" : "Open Javadoc ↗") as HTMLAnchorElement;
  link.href = word.href;
  link.target = "_blank";
  link.rel = "noopener";
  popover.replaceChildren(name);
  if (word.property) {
    const { type, defaultValue, description } = word.property;
    if (type) popover.append(element("p", "code-hover-type", defaultValue ? `${type} = ${defaultValue}` : type));
    if (description) popover.append(element("p", "code-hover-text", description));
  } else {
    void summaryOf(word.href).then((summary) => {
      if (summary && shown === word) {
        name.after(element("p", "code-hover-text", summary));
        place(word);
      }
    });
  }
  popover.append(link);
  popover.hidden = false;
  place(word);
}

// Above the word, or below it when there is no room; kept inside the viewport.
function place(word: Word) {
  const gap = 6;
  const { width, height } = popover.getBoundingClientRect();
  const above = word.rect.top - height - gap;
  popover.style.top = `${above >= 8 ? above : word.rect.bottom + gap}px`;
  popover.style.left = `${Math.max(8, Math.min(word.rect.left, window.innerWidth - width - 8))}px`;
}

function clearTimers() {
  window.clearTimeout(openTimer);
  window.clearTimeout(closeTimer);
}

function leaveWord() {
  if (!current) return;
  current.code.style.cursor = "";
  current = undefined;
  paint(undefined);
  clearTimers();
  closeTimer = window.setTimeout(() => {
    if (!overPopover) hide();
  }, CLOSE_DELAY_MS);
}

let frame = 0;
document.addEventListener(
  "pointermove",
  (event) => {
    if (event.pointerType !== "mouse") return;
    const { clientX, clientY, target } = event;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!(target instanceof Element) || !target.closest(CODE_SELECTOR)) {
        leaveWord();
        return;
      }
      const word = wordAt(clientX, clientY);
      if (
        word &&
        current?.range.startContainer === word.range.startContainer &&
        current.range.startOffset === word.range.startOffset
      ) {
        return;
      }
      leaveWord();
      if (!word) return;
      current = word;
      word.code.style.cursor = "pointer";
      paint(word);
      clearTimers();
      openTimer = window.setTimeout(() => show(word), OPEN_DELAY_MS);
    });
  },
  { passive: true },
);

// Click opens the popover at once; with Cmd/Ctrl it opens the reference.
document.addEventListener("click", (event) => {
  const word = current;
  if (!word || !document.getSelection()?.isCollapsed) return;
  if (event.metaKey || event.ctrlKey) {
    event.preventDefault();
    window.open(word.href, "_blank", "noopener");
    return;
  }
  clearTimers();
  show(word);
});

window.addEventListener(
  "scroll",
  () => {
    leaveWord();
    hide();
  },
  { passive: true },
);

popover.addEventListener("pointerenter", () => {
  overPopover = true;
  window.clearTimeout(closeTimer);
});
popover.addEventListener("pointerleave", () => {
  overPopover = false;
  closeTimer = window.setTimeout(hide, CLOSE_DELAY_MS);
});
