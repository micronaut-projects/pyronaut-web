// Resolves type names in rendered code snippets to their javadoc from the
// imports the snippets already carry, so the pages need no per-token markup.

const IMPORT_PATTERN =
  /^[ \t]*import[ \t]+(static[ \t]+)?([A-Za-z_][\w.]*)\.(\w+|\*)(?:[ \t]+as[ \t]+(\w+))?[ \t]*;?[ \t]*$/gm;

// Python: `from micronaut.http.client import HttpClient, HttpRequest as Req`,
// optionally parenthesised across lines.
const PYTHON_IMPORT_PATTERN =
  /^[ \t]*from[ \t]+([A-Za-z_][\w.]*)[ \t]+import[ \t]+(\([^)]*\)|[^\n#]+)/gm;

/** Maps each imported simple name (or its alias) to its class. */
export function importedTypes(sources: Iterable<string>) {
  const types = new Map<string, string>();
  const add = (name: string, qualifiedName: string) => {
    if (!types.has(name)) {
      types.set(name, qualifiedName);
    }
  };
  for (const source of sources) {
    for (const [, isStatic, owner, simpleName, alias] of source.matchAll(
      IMPORT_PATTERN,
    )) {
      // A static import names a member: `MediaType.TEXT_PLAIN`, `assertEquals`.
      if (simpleName === "*") {
        continue;
      }
      if (isStatic) {
        add(alias || simpleName, `${owner}#${simpleName}`);
      } else if (/^[A-Z]/.test(simpleName)) {
        add(alias || simpleName, `${owner}.${simpleName}`);
      }
    }
    for (const [, module, names] of source.matchAll(PYTHON_IMPORT_PATTERN)) {
      // Micronaut's Python modules mirror the Java packages under `io.`.
      const javaPackage = module.startsWith("micronaut.")
        ? `io.${module}`
        : module;
      for (const entry of names.replace(/[()\\]/g, "").split(",")) {
        const [, simpleName, alias] =
          /^\s*([A-Z]\w*)(?:\s+as\s+(\w+))?\s*$/.exec(entry) || [];
        if (simpleName) {
          add(alias || simpleName, `${javaPackage}.${simpleName}`);
        }
      }
    }
  }
  return types;
}

// Names a wildcard import would otherwise claim: `java.lang`, which needs no
// import, and the Kotlin and Groovy defaults.
const IMPLICIT_TYPES = new Set(
  (
    "Any Boolean Byte Char Character CharSequence Class Comparable Deprecated " +
    "Double Enum Error Exception Float FunctionalInterface Int Integer " +
    "Iterable List Long Map Math Number Object Override Record Runnable " +
    "RuntimeException Set Short String StringBuilder SuppressWarnings System " +
    "Thread Throwable Unit Void"
  ).split(" "),
);

/**
 * Resolves the uppercase names a snippet takes from a package it imports
 * whole, `import jakarta.persistence.criteria.*` (static too), except the
 * ones it declares itself. A class's static members are not guessed.
 */
export function wildcardTypes(source: string) {
  const [wildcardPackage] = Array.from(
    source.matchAll(IMPORT_PATTERN),
    ([, , owner, simpleName]) => (simpleName === "*" ? owner : ""),
  ).filter((owner) => /(?:^|\.)[a-z]\w*$/.test(owner));
  return (name: string) =>
    wildcardPackage &&
    /^[A-Z]\w+$/.test(name) &&
    !IMPLICIT_TYPES.has(name) &&
    !new RegExp(
      `\\b(?:class|interface|enum|record|object|trait)\\s+${name}\\b`,
    ).test(source)
      ? `${wildcardPackage}.${name}`
      : undefined;
}

/**
 * The qualified name of a dotted reference, resolved from its first segment:
 * `Relation.Kind` is a nested class, `Relation.Kind.ONE_TO_MANY` and
 * `HttpRequest.GET` are members. One that starts with a package,
 * `io.micronaut.http.HttpRequest`, is qualified already.
 */
export function qualifiedReference(
  chain: string[],
  resolve: (name: string) => string | undefined,
): string | undefined {
  if (/^[a-z]/.test(chain[0])) {
    return chain.length > 1 && /^[A-Z]/.test(chain[chain.length - 1])
      ? chain.join(".")
      : undefined;
  }
  let name = resolve(chain[0]);
  for (const segment of chain.slice(1)) {
    if (!name || name.includes("#")) {
      return undefined;
    }
    const nestedClass =
      /^[A-Z]/.test(segment) && !/^[A-Z][A-Z\d_]+$/.test(segment);
    name += `${nestedClass ? "." : "#"}${segment}`;
  }
  return name;
}

const PAGES = "https://micronaut-projects.github.io";

// The `micronaut-*` repository publishing each `io.micronaut.*` package's
// javadoc, by longest package prefix, where it is not the one named after the
// package's first segment. `docs` is Core's javadoc, published with the
// platform release. Derived from every repository's published
// `latest/api/element-list`.
const PACKAGE_REPOSITORIES: Record<string, string> = {
  annotation: "docs",
  aop: "docs",
  ast: "docs",
  "aws.cdk": "starter",
  beanvalidation: "hibernate-validator",
  buffer: "docs",
  "cache.coherence": "coherence",
  "coherence.data.model": "data",
  "coherence.data.repositories": "data",
  "coherence.data.util": "data",
  "configuration.graphql": "graphql",
  "configuration.hibernate": "sql",
  "configuration.hibernate.validator": "hibernate-validator",
  "configuration.jasync": "sql",
  "configuration.jdbc": "sql",
  "configuration.jdbi": "sql",
  "configuration.jmx": "jmx",
  "configuration.jooq": "sql",
  "configuration.kafka": "kafka",
  "configuration.lettuce": "redis",
  "configuration.metrics": "micrometer",
  "configuration.mongo": "mongodb",
  "configuration.mybatis": "sql",
  "configuration.picocli": "picocli",
  "configuration.vertx": "sql",
  consul: "discovery-client",
  context: "docs",
  "context.env.groovy": "groovy",
  controlpanel: "control-panel",
  core: "docs",
  discovery: "docs",
  "discovery.aws": "aws",
  "discovery.client": "discovery-client",
  "discovery.cloud.aws": "aws",
  "discovery.cloud.gcp": "gcp",
  "discovery.cloud.oraclecloud": "oracle-cloud",
  "discovery.consul": "discovery-client",
  "discovery.eureka": "discovery-client",
  "discovery.imports": "discovery-client",
  "discovery.info": "discovery-client",
  "discovery.spring": "discovery-client",
  "discovery.vault": "discovery-client",
  el: "jakarta-el",
  expressions: "docs",
  function: "docs",
  "function.aws": "aws",
  "function.client.aws": "aws",
  "function.groovy": "groovy",
  graal: "graal-languages",
  "graal.reflect": "docs",
  gradle: "gradle-plugin",
  guides: "guides-sdk",
  health: "docs",
  http: "docs",
  "http.poja": "servlet",
  inject: "docs",
  jackson: "docs",
  jdbc: "sql",
  json: "docs",
  jsonschema: "json-schema",
  localstack: "aws",
  logging: "docs",
  management: "docs",
  messaging: "docs",
  module: "docs",
  objectstorage: "object-storage",
  oraclecloud: "oracle-cloud",
  problem: "problem-json",
  protobuf: "grpc",
  pubsub: "gcp",
  retry: "docs",
  runtime: "docs",
  scheduling: "docs",
  serde: "serialization",
  "serde.toml": "toml",
  "starter.buildtools": "projectgen",
  "starter.feature.buildtools": "projectgen",
  "starter.feature.microstream": "projectgen",
  "test.extensions.testresources": "test-resources",
  "testcontainers.kafka": "kafka",
  testresources: "test-resources",
  transaction: "data",
  "validation.routes": "docs",
  "validation.visitor.async": "docs",
  "validation.websocket": "docs",
  web: "docs",
  websocket: "docs",
  xml: "jackson-xml",
};

function micronautRepository(packages: string[]) {
  for (let length = packages.length; length > 2; length -= 1) {
    const repository =
      PACKAGE_REPOSITORIES[packages.slice(2, length).join(".")];
    if (repository) {
      return `micronaut-${repository}`;
    }
  }
  return `micronaut-${packages[2]}`;
}

// Other libraries the snippets import, by package prefix: where their javadoc
// lives, as a base the package path is appended to.
const LIBRARY_JAVADOCS: [prefix: string, base: string][] = [
  [
    "com.fasterxml.jackson.annotation",
    "https://javadoc.io/doc/com.fasterxml.jackson.core/jackson-annotations/latest",
  ],
  [
    "com.fasterxml.jackson.core",
    "https://javadoc.io/doc/com.fasterxml.jackson.core/jackson-core/latest",
  ],
  [
    "com.fasterxml.jackson.databind",
    "https://javadoc.io/doc/com.fasterxml.jackson.core/jackson-databind/latest",
  ],
  ["com.oracle.bmc", "https://docs.oracle.com/en-us/iaas/tools/java/latest"],
  ["groovy", "https://docs.groovy-lang.org/latest/html/gapi"],
  ["io.grpc", "https://grpc.github.io/grpc-java/javadoc"],
  [
    "io.micrometer.core",
    "https://javadoc.io/doc/io.micrometer/micrometer-core/latest",
  ],
  ["io.netty", "https://netty.io/4.2/api"],
  [
    "io.opentelemetry.api",
    "https://javadoc.io/doc/io.opentelemetry/opentelemetry-api/latest",
  ],
  [
    "io.reactivex.rxjava3",
    "https://javadoc.io/doc/io.reactivex.rxjava3/rxjava/latest",
  ],
  [
    "io.swagger.v3.oas.annotations",
    "https://javadoc.io/doc/io.swagger.core.v3/swagger-annotations/latest",
  ],
  ["jakarta", "https://jakarta.ee/specifications/platform/11/apidocs"],
  [
    "org.assertj.core",
    "https://javadoc.io/doc/org.assertj/assertj-core/latest",
  ],
  ["org.bson", "https://mongodb.github.io/mongo-java-driver/5.6/apidocs/bson"],
  ["org.mockito", "https://javadoc.io/doc/org.mockito/mockito-core/latest"],
  [
    "org.reactivestreams",
    "https://javadoc.io/doc/org.reactivestreams/reactive-streams/latest",
  ],
  ["org.slf4j", "https://javadoc.io/doc/org.slf4j/slf4j-api/latest"],
  [
    "org.testcontainers",
    "https://javadoc.io/doc/org.testcontainers/testcontainers/latest",
  ],
  ["reactor", "https://projectreactor.io/docs/core/release/api"],
  ["software.amazon.awssdk", "https://sdk.amazonaws.com/java/api/latest"],
  ["spock.lang", "https://javadoc.io/doc/org.spockframework/spock-core/latest"],
];

// Packages of the documentation's own example code, which has no javadoc.
const EXAMPLE_PACKAGES = new Set(["docs", "example", "examples"]);

/**
 * The javadoc page of a class, or of a `Class#member`, or undefined when no
 * known site hosts it.
 */
export function javadocHref(qualifiedName: string): string | undefined {
  const [typeName, member] = qualifiedName.split("#");
  const segments = typeName.split(".");
  const packageIndex = segments.findIndex((segment) => /^[A-Z]/.test(segment));
  const packages = segments.slice(0, packageIndex);
  if (
    packageIndex <= 0 ||
    packages.some((segment) => EXAMPLE_PACKAGES.has(segment))
  ) {
    return undefined;
  }
  const packagePath = packages.join("/");
  const classPath = segments.slice(packageIndex).join(".");
  const anchor = member ? `#${member}` : "";
  const page = `${packagePath}/${classPath}.html${anchor}`;
  if (segments[0] === "io" && segments[1] === "micronaut") {
    if (packages.length < 3) {
      return undefined;
    }
    return `${PAGES}/${micronautRepository(packages)}/latest/api/${page}`;
  }
  if (segments[0] === "java" || segments[0] === "javax") {
    return `https://docs.oracle.com/en/java/javase/21/docs/api/search.html?q=${classPath}`;
  }
  if (segments[0] === "org" && segments[1] === "junit") {
    // JUnit's javadoc is split by module, named after its first packages.
    const module = packages.slice(0, 4).join(".");
    return `https://docs.junit.org/current/api/${module}/${page}`;
  }
  const packageName = packages.join(".");
  const base = LIBRARY_JAVADOCS.find(
    ([prefix]) =>
      packageName === prefix || packageName.startsWith(`${prefix}.`),
  )?.[1];
  return base && `${base}/${page}`;
}

/** The first sentence of a javadoc class page's description. */
export function javadocSummary(pageHtml: string): string | undefined {
  const document = new DOMParser().parseFromString(pageHtml, "text/html");
  const block = document.querySelector(
    ".class-description .block, .description .block",
  );
  const text = block?.textContent?.replace(/\s+/g, " ").trim();
  if (!text) {
    return undefined;
  }
  const sentence = /^.*?[.!?](?=\s|$)/.exec(text)?.[0] || text;
  return sentence.length > 240 ? `${sentence.slice(0, 237)}…` : sentence;
}
