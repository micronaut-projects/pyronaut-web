// Rebuilds the flat key, `micronaut.server.port`, of a key written nested in a
// YAML, TOML, HOCON, JSON or Groovy configuration snippet, so the code hover
// can look it up the way it looks up a Properties key.

const NESTED_LANGUAGES = new Set([
  "yaml",
  "toml",
  "hocon",
  "json",
  "json-config",
  "groovy-config",
]);

export function isNestedConfigurationLanguage(language: string | undefined) {
  return Boolean(language && NESTED_LANGUAGES.has(language));
}

const join = (segments: string[]) =>
  segments.reduce(
    (path, segment) =>
      !path
        ? segment
        : segment.startsWith("[")
          ? path + segment
          : `${path}.${segment}`,
    "",
  );

/** Micronaut binds `nThreads` and `n-threads` alike; references list the latter. */
export const kebabCase = (key: string) =>
  key.replace(/([a-z\d])([A-Z])/g, "$1-$2").toLowerCase();

const unquote = (key: string) => key.replace(/^(["'])(.*)\1$/, "$2");

/**
 * The flat key of `word` when it is a key in the snippet: `before` is the
 * snippet's text up to the word, `after` the text following it.
 */
export function configurationKeyPath(
  language: string,
  before: string,
  word: string,
  after: string,
): string | undefined {
  // A quoted key: the quotes stay outside the hovered word.
  before = before.replace(/["']$/, "");
  after = after.replace(/^["']/, "");
  if (language === "yaml") {
    return yamlKeyPath(before, word, after);
  }
  if (language === "toml") {
    return tomlKeyPath(before, word, after);
  }
  return bracedKeyPath(before, word, after);
}

const YAML_KEY =
  /^[ \t]*(?:-[ \t]+)*("[^"]*"|'[^']*'|[^\s:#'"-][^:#]*?)[ \t]*:(?:\s|$)/;

function yamlKeyPath(before: string, word: string, after: string) {
  const lines = before.split("\n");
  const current = lines.pop()!;
  if (
    !/^[ \t]*:(?:\s|$)/.test(after) ||
    !/^[ \t]*(?:-[ \t]+)*$/.test(current)
  ) {
    return undefined;
  }
  type Entry = { indent: number; segment: string; items: number };
  const stack: Entry[] = [];
  const popTo = (indent: number) => {
    while (stack.length && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
  };
  // Each `- ` opens a list item of the key above it: `[0]`, `[1]`, ...
  const enter = (line: string, key: string | undefined) => {
    const match = /^([ \t]*)((?:-[ \t]+)*)/.exec(line)!;
    let indent = match[1].length;
    for (const dash of match[2].match(/-[ \t]+/g) || []) {
      popTo(indent);
      const parent = stack[stack.length - 1];
      if (!parent) {
        return false;
      }
      parent.items += 1;
      stack.push({ indent, segment: `[${parent.items - 1}]`, items: 0 });
      indent += dash.length;
    }
    if (key !== undefined) {
      popTo(indent);
      stack.push({ indent, segment: unquote(key), items: 0 });
    }
    return true;
  };
  for (const line of lines) {
    if (/^\s*(?:#|$)/.test(line) || /^\s*(?:---|\.\.\.)\s*$/.test(line)) {
      continue;
    }
    enter(line, YAML_KEY.exec(line)?.[1]);
  }
  if (!enter(current, word)) {
    return undefined;
  }
  return join(stack.map((entry) => entry.segment));
}

function tomlKeyPath(before: string, word: string, after: string) {
  const lines = before.split("\n");
  const current = lines.pop()!;
  // A header names a table, which the references do not describe.
  if (!/^[ \t]*$/.test(current) || !/^[ \t]*=/.test(after)) {
    return undefined;
  }
  const arrays = new Map<string, number>();
  let table = "";
  for (const line of lines) {
    const header = /^\s*(\[\[?)\s*([^\]]+?)\s*\]/.exec(line);
    if (!header) {
      continue;
    }
    const name = header[2]
      .split(".")
      .map((part) => unquote(part.trim()))
      .join(".");
    // A table under an array of tables belongs to its latest entry.
    const parent = [...arrays.keys()]
      .filter((array) => name.startsWith(`${array}.`))
      .sort((a, b) => b.length - a.length)[0];
    const resolved = parent
      ? `${parent}[${arrays.get(parent)}]${name.slice(parent.length)}`
      : name;
    if (header[1] === "[[") {
      const index = (arrays.get(name) ?? -1) + 1;
      arrays.set(name, index);
      table = `${resolved}[${index}]`;
    } else {
      table = resolved;
    }
  }
  return join([table, word].filter(Boolean));
}

const BRACED_TOKEN =
  /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|#[^\n]*|\/\/[^\n]*|[A-Za-z_][\w.-]*|[{}[\]:=]|\S/g;

/** HOCON, JSON and Groovy configuration nest keys in braces. */
function bracedKeyPath(before: string, word: string, after: string) {
  if (!/^\s*[:={]/.test(after)) {
    return undefined;
  }
  type Frame = { segment?: string; list: boolean; items: number };
  const stack: Frame[] = [];
  let pending: string | undefined;
  for (const { 0: text, index } of before.matchAll(BRACED_TOKEN)) {
    if (text.startsWith("#") || text.startsWith("//")) {
      continue;
    }
    if (text === "{" || text === "[") {
      const top = stack[stack.length - 1];
      let segment = pending;
      if (segment === undefined && top?.list) {
        top.items += 1;
        segment = `[${top.items - 1}]`;
      }
      stack.push({ segment, list: text === "[", items: 0 });
      pending = undefined;
    } else if (text === "}" || text === "]") {
      stack.pop();
      pending = undefined;
    } else if (text !== ":" && text !== "=") {
      // A key is followed by its separator or its block.
      pending = /^\s*[:={]/.test(before.slice(index + text.length))
        ? unquote(text)
        : undefined;
    }
  }
  return join([
    ...stack.flatMap((frame) => (frame.segment ? [frame.segment] : [])),
    word,
  ]);
}
