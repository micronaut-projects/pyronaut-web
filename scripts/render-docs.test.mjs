import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const renderer = fileURLToPath(new URL("./render-docs.mjs", import.meta.url));

for (const [ref, projectVersion, expected] of [
  ["v0.1.1", "0.1.1-SNAPSHOT", "0.1.1"],
  ["refs/tags/v0.1.1", "0.1.1-SNAPSHOT", "0.1.1"],
  ["0.1.1", "0.1.1-SNAPSHOT", "0.1.1"],
  ["v0.1.2-RC1", "0.1.2-SNAPSHOT", "0.1.2-RC1"],
  ["0.1.x", "0.1.2-SNAPSHOT", "0.1.2-SNAPSHOT"],
  ["0e635e88bfe98ba38a8e5b24a68391f0c140f52d", "0.1.1-SNAPSHOT", "0.1.1-SNAPSHOT"],
]) {
  test(`renders version ${expected} from ${ref}`, async (t) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "pyronaut-docs-version-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const source = path.join(root, "source");
    const guide = path.join(source, "src/main/docs/guide");
    await mkdir(guide, { recursive: true });
    await writeFile(path.join(source, "gradle.properties"), `projectVersion=${projectVersion}\n`);
    await writeFile(path.join(guide, "toc.yml"), "installing: Installing Pyronaut\n");
    await writeFile(path.join(guide, "installing.adoc"), [
      "Install pyronaut=={version}.",
      "https://github.com/micronaut-projects/pyronaut/releases/tag/v{version}[Release]",
      "Project version: {projectVersion}",
    ].join("\n\n"));

    execFileSync(process.execPath, [renderer], {
      cwd: root,
      env: { ...process.env, PYRONAUT_DOCS_DIR: source, PYRONAUT_DOCS_REF: ref },
      stdio: "pipe",
    });
    const docs = JSON.parse(await readFile(path.join(root, "src/generated/docs.json"), "utf8"));
    assert.equal(docs.version, expected);
    assert.equal(docs.ref, ref);
    assert.ok(docs.html.includes(`pyronaut==${expected}`));
    assert.ok(docs.html.includes(`/releases/tag/v${expected}`));
    assert.ok(docs.html.includes(`Project version: ${expected}`));
  });
}
