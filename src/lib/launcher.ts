import starter from "@/data/starter.json";

/**
 * Pyronaut Launch — Python-only counterpart of micronaut.io/launch, backed by
 * the same Micronaut Starter API (`lang=PYTHON`, `build=PYRONAUT`).
 * The feature catalog is a build-time snapshot (scripts/sync-starter.mjs).
 */

export interface Feature {
  title: string;
  description: string;
  category: string;
  preview?: boolean;
  community?: boolean;
}

export interface ApplicationType {
  value: string;
  title: string;
  description: string;
  features: string[];
}

export interface Project {
  type: string;
  name: string;
  package: string;
  features: string[];
}

export const STARTER = starter as {
  api: string;
  micronautVersion: string;
  lang: string;
  build: string;
  test: string;
  applicationTypes: ApplicationType[];
  features: Record<string, Feature>;
};

/** Starter API used for generated links (downloads, curl, sharing). */
export const PUBLIC_API: string =
  import.meta.env.PUBLIC_STARTER_API ?? STARTER.api;

export const DEFAULT_PROJECT: Project = {
  type: "DEFAULT",
  name: "demo",
  package: "com.example",
  features: [],
};

/** Short labels for the application type picker. */
export const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  DEFAULT: { label: "Application", icon: "rocket" },
  CLI: { label: "CLI", icon: "terminal" },
  FUNCTION: { label: "Function", icon: "cloud" },
  GRPC: { label: "gRPC", icon: "cube" },
  MESSAGING: { label: "Messaging", icon: "message" },
};

const NAME_PATTERN = /^[a-z][a-z0-9_-]*$/;
const PACKAGE_PATTERN = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)*$/;

export function validateName(name: string): string | null {
  if (!name) return "Enter a project name.";
  if (!NAME_PATTERN.test(name)) {
    return "Use lowercase letters, digits, - or _, starting with a letter.";
  }
  return null;
}

export function validatePackage(pkg: string): string | null {
  if (!pkg) return "Enter a base package.";
  if (!PACKAGE_PATTERN.test(pkg)) {
    return "Use dot-separated lowercase identifiers, e.g. com.example.";
  }
  return null;
}

export function applicationType(value: string): ApplicationType {
  return (
    STARTER.applicationTypes.find((type) => type.value === value) ??
    STARTER.applicationTypes[0]
  );
}

/** Starter endpoint URL: `create`, `preview` or `diff`. */
export function starterUrl(api: string, action: string, project: Project) {
  const params = new URLSearchParams({
    lang: STARTER.lang,
    build: STARTER.build,
    test: STARTER.test,
  });
  for (const feature of project.features) params.append("features", feature);
  const app = encodeURIComponent(`${project.package}.${project.name}`);
  return `${api}/${action}/${project.type.toLowerCase()}/${app}?${params}`;
}

export function curlCommand(project: Project) {
  return `curl --location '${starterUrl(PUBLIC_API, "create", project)}' --output ${project.name}.zip`;
}

/**
 * The equivalent Pyronaut CLI call. `pyronaut create-app` always generates an
 * Application and supplies `--lang python --build pyronaut --test pytest`
 * itself (micronaut-projects/pyronaut, pyronautCliV2.adoc).
 */
export function cliCommand(project: Project) {
  const args = ["pyronaut", "create-app", `${project.package}.${project.name}`];
  if (project.features.length) {
    args.push(`--features=${project.features.join(",")}`);
  }
  return args.join(" ");
}

/** Shown first in the feature browser before the user searches. */
export const POPULAR_FEATURES = [
  "data-jdbc",
  "flyway",
  "security-jwt",
  "openapi",
  "micrometer-prometheus",
  "tracing-opentelemetry-exporter-otlp",
  "redis-lettuce",
  "kafka",
  "langchain4j-openai",
  "mcp-http",
  "http-client",
];

/** Shareable launcher state, compatible with micronaut.io/launch params. */
export function toQuery(project: Project) {
  const params = new URLSearchParams();
  if (project.type !== DEFAULT_PROJECT.type) params.set("type", project.type);
  if (project.name !== DEFAULT_PROJECT.name) params.set("name", project.name);
  if (project.package !== DEFAULT_PROJECT.package) {
    params.set("package", project.package);
  }
  for (const feature of project.features) params.append("features", feature);
  return params.toString();
}

export function fromQuery(search: string): Project {
  const params = new URLSearchParams(search);
  const type = applicationType(
    (params.get("type") ?? DEFAULT_PROJECT.type).toUpperCase(),
  );
  const requested = params
    .getAll("features")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim());
  return {
    type: type.value,
    name: params.get("name") ?? DEFAULT_PROJECT.name,
    package: params.get("package") ?? DEFAULT_PROJECT.package,
    features: [...new Set(requested)].filter((name) =>
      type.features.includes(name),
    ),
  };
}

/** Pulls the readable message out of a starter API error response. */
export async function errorMessage(response: Response) {
  try {
    const body = await response.json();
    const messages = body?._embedded?.errors
      ?.map((error: { message: string }) => error.message)
      .filter(Boolean);
    if (messages?.length) return messages.join("\n");
    if (body?.message) return body.message as string;
  } catch {
    /* not JSON */
  }
  return `The starter API responded with ${response.status}.`;
}
