// Behaviour of Asciidoctor-rendered prose (`.docs-prose`), shared by the docs
// and guide pages.

import "@/scripts/code-hover";

// Copy buttons on code snippets; folded imports are copied too.
document.addEventListener("click", async (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("[data-copy]");
  const snippet = button?.closest(".snippet");
  if (!button || !snippet) return;
  const text = [...snippet.querySelectorAll("pre code .line")]
    .map((line) => [...line.childNodes].filter((n) => !(n instanceof Element && n.classList.contains("conum"))).map((n) => n.textContent).join(""))
    .join("\n");
  try {
    await navigator.clipboard.writeText(text);
    button.dataset.copied = "";
    setTimeout(() => delete button.dataset.copied, 1500);
  } catch {
    // Clipboard access denied; nothing to do.
  }
});

// Heading "#" permalinks: jump to the section and copy its full URL.
document.addEventListener("click", async (event) => {
  const anchor = (event.target as Element).closest<HTMLAnchorElement>(".docs-prose .anchor");
  if (!anchor || event.metaKey || event.ctrlKey || event.shiftKey) return;
  event.preventDefault();
  history.replaceState(null, "", anchor.hash);
  anchor.parentElement?.scrollIntoView({ behavior: "smooth" });
  try {
    await navigator.clipboard.writeText(anchor.href);
    anchor.dataset.copied = "";
    anchor.title = "Link copied";
    setTimeout(() => {
      delete anchor.dataset.copied;
      anchor.title = "Copy link to this section";
    }, 1500);
  } catch {
    // Clipboard access denied; the address bar still has the link.
  }
});
for (const anchor of document.querySelectorAll<HTMLAnchorElement>(".docs-prose .anchor")) {
  anchor.title = "Copy link to this section";
  anchor.removeAttribute("aria-hidden");
  anchor.setAttribute("aria-label", `Copy link to ${anchor.parentElement?.textContent?.trim() ?? "this section"}`);
}
