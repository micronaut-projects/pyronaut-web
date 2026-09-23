// Snapshots the Python/Pyronaut options of the Micronaut Starter API into
// src/data/starter.json, which the /launch/ page renders at build time.
//
// The starter API only sends CORS headers for micronaut.io, so the launcher
// cannot load its feature catalog from the browser; committing a snapshot
// also keeps `npm run build` free of network access. Re-run after the
// starter adds or changes Python features:
//
//   node scripts/sync-starter.mjs [apiBaseUrl]

import { writeFile } from "node:fs/promises";

const api = (process.argv[2] ?? "https://snapshot.micronaut.io").replace(/\/$/, "");
const output = new URL("../src/data/starter.json", import.meta.url);

// Categories the starter reports as Python-compatible but that only make
// sense on the JVM languages.
const EXCLUDED_CATEGORIES = new Set(["Groovy Optional Modules"]);

// Features `pyronaut create --list-features` hides (reflection-dependent or
// JVM-only). Mirrors _PYRONAUT_CREATE_DENYLIST_BY_MINOR[(5, 2)] in
// micronaut-projects/pyronaut@0.0.x
// pyronaut/src/main/python/pyronaut_cli_v2/cli.py — keep the two aligned.
const EXCLUDED_FEATURES = new Set([
  "jackson-databind", "sourcegen-generator",
  "aws-codebuild-workflow-ci", "github-workflow-azure-container-instance",
  "github-workflow-azure-container-instance-graalvm", "github-workflow-ci",
  "github-workflow-docker-registry", "github-workflow-google-cloud-run",
  "github-workflow-google-cloud-run-graalvm", "github-workflow-graal-docker-registry",
  "github-workflow-oracle-cloud-functions", "github-workflow-oracle-cloud-functions-graalvm",
  "gitlab-workflow-ci", "google-cloud-workflow-ci", "oracle-cloud-devops-build-ci",
  "chatbots-basecamp-http", "chatbots-telegram-http", "http-client-jdk", "knative", "kubernetes",
  "config4k", "properties", "yaml", "data-hibernate-reactive", "hibernate-jpa", "hibernate-reactive-jpa",
  "jasync-sql", "mybatis", "assertj", "awaitility", "buildless", "hamcrest", "junit-params", "lombok",
  "mockito", "openrewrite", "aws-parameter-store", "aws-secrets-manager", "azure-key-vault",
  "coherence-distributed-configuration", "config-consul", "config-kubernetes", "gcp-secrets-manager",
  "netflix-archaius", "oracle-cloud-vault", "groovy-datetime", "groovy-dateutil", "groovy-ginq",
  "groovy-json", "groovy-sql", "groovy-toml", "groovy-xml", "groovy-yaml", "aws-alexa", "graalpy",
  "kapt", "kotlin-extension-functions", "ksp", "amazon-cloudwatch-logging", "azure-logging", "gcp-logging",
  "jul-to-slf4j", "liquibase-slf4j", "log4j2", "oracle-cloud-logging", "slf4j-simple", "slf4j-simple-logger",
  "jmx", "crac", "jib", "micronaut-aot", "shade", "opensearch-restclient",
  "http-poja", "http-server-jdk", "jetty-server", "ktor", "tomcat-server", "undertow-server",
  "amazon-api-gateway", "amazon-api-gateway-http", "aws-lambda", "aws-lambda-custom-runtime", "azure-function",
  "oracle-function", "discovery-kubernetes", "json-path", "json-smart", "junit-platform-suite-engine",
  "test-netty-leak", "hibernate-validator", "views-react",
]);

const supportedFeature = (feature) =>
  !EXCLUDED_CATEGORIES.has(feature.category) && !EXCLUDED_FEATURES.has(feature.name);

async function get(path) {
  const response = await fetch(`${api}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`GET ${path} failed: ${response.status}`);
  }
  return response.json();
}

const [options, { types }, { versions }] = await Promise.all([
  get("/select-options"),
  get("/application-types"),
  get("/versions"),
]);

const python = options.lang.options.find((option) => option.value === "PYTHON");
if (!python) {
  throw new Error(`${api} does not support Python yet`);
}

// Features are shared across application types; store each one once.
const features = {};
const applicationTypes = await Promise.all(
  types.map(async (type) => {
    const { features: list } = await get(`/application-types/${type.value}/features/PYTHON`);
    const supported = list.filter(supportedFeature);
    for (const feature of supported) {
      features[feature.name] = {
        title: feature.title,
        description: feature.description,
        category: feature.category,
        ...(feature.preview && { preview: true }),
        ...(feature.community && { community: true }),
      };
    }
    return {
      value: type.value,
      title: type.title,
      description: type.description,
      features: supported.map((feature) => feature.name),
    };
  }),
);

const snapshot = {
  api,
  micronautVersion: versions["micronaut.version"],
  lang: python.value,
  build: python.defaults.build,
  test: python.defaults.test,
  applicationTypes,
  features: Object.fromEntries(
    Object.entries(features).sort(([a], [b]) => a.localeCompare(b)),
  ),
};

await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(
  `Wrote ${Object.keys(snapshot.features).length} features for ` +
    `${applicationTypes.length} application types (Micronaut ` +
    `${snapshot.micronautVersion}) to ${output.pathname}`,
);
