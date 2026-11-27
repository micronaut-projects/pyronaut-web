/**
 * Shared marketing content for every Pyronaut design variant.
 */

import { BENCHMARKS } from "@/data/benchmarks";

/** Sustained req/s from the HTTPS/HTTP2 benchmark, formatted for copy. */
const sustained = (id: string) =>
  (BENCHMARKS.find((f) => f.id === id)?.sustained ?? 0).toLocaleString("en-US");

export const SITE_NAME = "Pyronaut";

export const SITE_DESCRIPTION =
  "Pyronaut is a Python web framework that runs on GraalPy with the Micronaut framework underneath. It serves single-row database reads about four times faster than FastAPI, and checks validation, database queries, and configuration when you build the app instead of when a request arrives.";

/**
 * Install commands. uv is the primary path; pip is the documented
 * alternative. `pyronaut setup` provisions the JDK and GraalPy the CLI needs.
 */
export const INSTALL = {
  commands: ["uv tool install pyronaut", "pyronaut setup", "pyronaut create rocket-service"],
  pip: "python3 -m pip install pyronaut",
  size: "about 3.4 GiB",
};

/**
 * Single-row database read benchmark, quoted on the homepage. FastAPI ran
 * with 4 uvicorn workers. A 20-row list endpoint came out about even.
 */
export const DB_BENCHMARK = {
  pyronaut: { rps: "16,800", p99: "2.7 ms" },
  fastapi: { rps: "4,100", p99: "18.2 ms", server: "4 uvicorn workers" },
};

/**
 * Documentation destinations. The Micronaut sites keep the reader's code
 * language and build tool in `lang` / `build`, so Pyronaut readers land on the
 * Python + Pyronaut variants.
 */
export const DOCS_LINKS = {
  pyronaut: "/docs/",
  micronaut: "https://docs.micronaut.io/?lang=python&build=pyronaut&config-format=toml",
  guides: "/guides/",
  micronautGuides: "https://guides.micronaut.io/?lang=python&build=pyronaut&config-format=toml",
};

export interface Feature {
  title: string;
  copy: string;
  icon: string;
  href: string;
}

/** Icon names map to inline SVG glyphs rendered by each design. */
export const FEATURES: Feature[] = [
  {
    title: "Fast HTTP",
    copy: "Requests are served by Netty, an event-driven HTTP server that does the job uvicorn does for FastAPI. Your route functions run on GraalPy, a Python implementation with a JIT compiler that speeds up code that runs often.",
    icon: "bolt",
    href: "/performance/",
  },
  {
    title: "Generated database queries",
    copy: "Write a repository class with methods such as findByNameContains and Pyronaut generates the SQL when it builds the app. A method that names a field your model doesn't have fails the build. Works with MySQL, PostgreSQL, Oracle, SQL Server, and H2.",
    icon: "annotations",
    href: "https://docs.micronaut.io/latest/data/?lang=python&build=pyronaut&config-format=toml",
  },
  {
    title: "Metrics and tracing included",
    copy: "Metrics, OpenTelemetry tracing, health check endpoints, and logs tagged with trace IDs are part of the framework. You don't add and configure separate instrumentation packages.",
    icon: "gauge",
    href: "https://docs.micronaut.io/latest/micrometer/?lang=python&build=pyronaut&config-format=toml",
  },
  {
    title: "Cloud SDK clients",
    copy: "Ask for an AWS, Azure, Google Cloud, or Oracle Cloud client as a typed parameter and Pyronaut creates and configures it. Configuration and secrets can be read from the provider's secret store.",
    icon: "flask",
    href: "https://guides.micronaut.io/latest/tag-cloud.html?lang=python&build=pyronaut",
  },
  {
    title: "Mistakes fail the build",
    copy: "Pydantic checks your models when a request comes in. Pyronaut reads your type hints when it builds the app, so a misspelled config key, a bad repository method, or a dependency nothing provides is reported before the app starts.",
    icon: "shield",
    href: "/docs/#validateConfig",
  },
  {
    title: "Commercial support",
    copy: "Paid support is available for teams that run Pyronaut services in production.",
    icon: "rocket",
    href: "https://micronaut.io/support/",
  },
];

export interface WorkflowStage {
  command: string;
  title: string;
  copy: string;
}

export const WORKFLOW: WorkflowStage[] = [
  {
    command: "pyronaut create",
    title: "Create",
    copy: "Generate a project with a pyproject.toml and its dependencies resolved.",
  },
  {
    command: "pyronaut dev",
    title: "Develop",
    copy: "Run the app on localhost:8080 and reload on save. A database the app needs is started for you in Docker.",
  },
  {
    command: "pyronaut test",
    title: "Test",
    copy: "Run pytest against the running app and a real database, without writing Testcontainers fixtures.",
  },
  {
    command: "pyronaut validate-config",
    title: "Validate",
    copy: "Check configuration files and which objects get injected where, per environment, without starting the app.",
  },
  {
    command: "pyronaut build",
    title: "Package",
    copy: "Build a wheel, a native executable that needs no Python or Java installed, or a container image.",
  },
];

export interface CodeExample {
  id: string;
  label: string;
  filename: string;
  language: "python" | "shell" | "yaml";
  code: string;
  caption: string;
}

export const CODE_EXAMPLES: CodeExample[] = [
  {
    id: "controller",
    label: "Controller",
    filename: "rockets.py",
    language: "python",
    caption:
      "Entity, repository, and routes in one module. The decorators come from Micronaut, the Java framework underneath; everything else is ordinary Python.",
    code: `from dataclasses import dataclass
from typing import Annotated, List

from jakarta.inject import Inject
from jakarta.validation import Valid
from jakarta.validation.constraints import NotBlank, Positive
from micronaut.data.annotation import GeneratedValue, Id, MappedEntity
from micronaut.data.jdbc.annotation import JdbcRepository
from micronaut.data.repository import CrudRepository
from micronaut.http import HttpResponse
from micronaut.http.annotation import Body, Get, Post
from micronaut.serde.annotation import Serdeable


# A table row, like a SQLAlchemy model. Its JSON serializer
# is generated when the app is built.
@dataclass
@MappedEntity
@Serdeable
class Rocket:
    id: Annotated[int | None, Id, GeneratedValue]
    name: str
    thrust_kn: float


# A request body with field constraints, like a Pydantic model.
@Serdeable
@dataclass
class LaunchCommand:
    name: Annotated[str, NotBlank]
    thrust_kn: Annotated[float, Positive]


# The SQL for each method is generated from its name at build time.
# Misspell the field (findByNmeContains) and the build fails.
@JdbcRepository(dialect="MYSQL")
class RocketRepository(CrudRepository[Rocket, int]):

    def findByNameContains(self, fragment: str) -> List[Rocket]: ...


# Injected when the app starts, similar to FastAPI's Depends().
rockets: Annotated[RocketRepository, Inject]


@Get("/rockets/search/{fragment}")
def search(fragment: str) -> List[Rocket]:
    return rockets.findByNameContains(fragment)


# An invalid body gets a 400 before this function runs.
@Post("/rockets")
def launch(command: Annotated[LaunchCommand, Body, Valid]) -> HttpResponse:
    rocket = Rocket(None, command.name, command.thrust_kn)
    return HttpResponse.created(rockets.save(rocket))`,
  },
  {
    id: "test",
    label: "Test",
    filename: "test_rockets.py",
    language: "python",
    caption:
      "Plain pytest. The fixture starts the app on a test port, and Pyronaut starts a MySQL container for it, so the test talks to a real database.",
    code: `from typing import Any

import pytest
import requests

from pyronaut.test import MicronautTest, micronaut_test_fixture


@pytest.fixture
def application_context(request: Any) -> Any:
    fixture = micronaut_test_fixture(request, MicronautTest())
    yield fixture
    fixture.stop()


@pytest.fixture
def client(application_context: Any) -> requests.Session:
    return requests.with_context(application_context)


def test_launch(client: requests.Session):
    rocket = {"name": "Ariane 7", "thrust_kn": 15000}

    created = client.post("/rockets", json=rocket)
    assert created.status_code == 201
    assert created.json()["id"] is not None

    found = client.get("/rockets/search/Ariane").json()
    assert "Ariane 7" in [r["name"] for r in found]


def test_validation(client: requests.Session):
    response = client.post(
        "/rockets", json={"name": "", "thrust_kn": -1}
    )
    assert response.status_code == 400`,
  },
  {
    id: "workflow",
    label: "Workflow",
    filename: "terminal",
    language: "shell",
    caption:
      "From an empty directory to a deployable file. With pip, run python3 -m pip install pyronaut instead of the first command.",
    code: `$ uv tool install pyronaut
$ pyronaut setup
  GraalVM JDK and GraalPy ready

$ pyronaut create rocket-service
  Created rocket-service/ with pyproject.toml

$ pyronaut dev
  Started mysql:8 in Docker on :3306
  Server running on http://localhost:8080 (reload on)

$ pyronaut test
  12 passed in 3.4s (JUnit XML + HTML report)

$ pyronaut validate-config --env production
  Configuration OK · DI graph OK

$ pyronaut build --native
  Native executable: build/rocket-service`,
  },
];

export const CODE_PROOFS = [
  "@MappedEntity is roughly a SQLAlchemy model; @JdbcRepository writes the queries for you",
  "Annotated[str, NotBlank] works like a Pydantic field constraint: bad input gets a 400",
  "pyronaut test runs pytest against the app and a MySQL container it starts itself",
];

export const MICRONAUT_AUDIENCE = {
  kicker: "Already building on Micronaut?",
  copy: "Add Python without adding a second application platform. Use Python on the Micronaut platform you already know.",
};

export interface DeepDive {
  title: string;
  copy: string;
  bullets: string[];
  linkLabel: string;
  href: string;
  icon: string;
}

export const DEEP_DIVES: DeepDive[] = [
  {
    title: "Process at build time",
    copy: "Pyronaut processes source and metadata at build time, before the application starts.",
    bullets: [
      "Earlier error detection",
      "Stronger IDE support and stubs",
      "Less reliance on runtime reflection",
      "Native packaging support",
    ],
    linkLabel: "How source processing works",
    href: "/docs/source-processing/",
    icon: "bolt",
  },
  {
    title: "Validate before production",
    copy: "Check configuration for dev, test, and production environments, and optionally validate the dependency injection graph before deploying.",
    bullets: [
      "validate-config per environment",
      "DI graph validation",
      "Config schemas from processing",
      "Fail in CI, not at 3 a.m.",
    ],
    linkLabel: "Production validation",
    href: "/docs/validation/",
    icon: "shield",
  },
  {
    title: "Package for production",
    copy: "From Python source through a tested and validated production artifact. Pick the packaging that fits the workload.",
    bullets: [
      "JVM wheel or container image",
      "GraalVM native executable",
      "Native container image",
      "Reusable Crema runtime",
    ],
    linkLabel: "Packaging options",
    href: "/docs/packaging/",
    icon: "rocket",
  },
];

export interface Persona {
  role: string;
  value: string;
}

/**
 * Where Pyronaut is fast and where it is not. Rendered in the homepage
 * trade-offs section (formerly personas).
 */
export const PERSONAS: Persona[] = [
  {
    role: "Single-row reads: about 4x",
    value:
      "Fetching one row by ID and returning it as JSON: about 16,800 requests per second, against about 4,100 for FastAPI on 4 uvicorn workers. p99 latency was 2.7 ms against 18.2 ms.",
  },
  {
    role: "Small lists: about even",
    value:
      "Returning a 20-row list came out roughly the same as FastAPI.",
  },
  {
    role: "Python loops over rows: slower",
    value:
      "Endpoints that loop over many database rows in Python code are currently much slower than the same code under FastAPI.",
  },
  {
    role: "Install size: about 3.4 GiB",
    value:
      "The CLI is a normal Python package, but pyronaut setup downloads a JDK, GraalPy, and native launchers. Expect about 3.4 GiB on disk.",
  },
  {
    role: "C extensions: check first",
    value:
      "Apps run on GraalPy, not CPython. Pure-Python packages generally work; packages with C extensions may not. pyronaut doctor checks the packages your project declares.",
  },
];

export interface ComparisonRow {
  area: string;
  flask: string;
  fastapi: string;
  pyronaut: string;
}

export const STACK_COMPARISON = {
  columns: { flask: "Flask", fastapi: "FastAPI", pyronaut: "Pyronaut" },
  rows: [
    {
      area: "Runs on",
      flask: "CPython",
      fastapi: "CPython",
      pyronaut: "GraalPy (Python 3.13) on the JVM",
    },
    {
      area: "HTTP server",
      flask: "Gunicorn or uWSGI, installed separately",
      fastapi: "Uvicorn or Granian, installed separately",
      pyronaut: "Netty, built in. It fills the role of uvicorn.",
    },
    {
      area: "HTTP benchmark",
      flask: `${sustained("flask")} req/s (Gunicorn)`,
      fastapi: `${sustained("fastapi")} req/s (Granian)`,
      pyronaut: `${sustained("pyronaut")} req/s`,
    },
    {
      area: "Single-row DB read",
      flask: "Not measured",
      fastapi: "~4,100 req/s, p99 18.2 ms (4 uvicorn workers)",
      pyronaut: "~16,800 req/s, p99 2.7 ms",
    },
    {
      area: "Validation and JSON",
      flask: "Add a library such as marshmallow or Pydantic",
      fastapi: "Pydantic models, checked at request time",
      pyronaut: "Dataclasses with constraint annotations; serializers generated at build time",
    },
    {
      area: "Database",
      flask: "Flask-SQLAlchemy or raw SQL",
      fastapi: "SQLAlchemy or SQLModel, queries written by you",
      pyronaut: "Repository methods; SQL generated and checked at build time",
    },
    {
      area: "Dependency injection",
      flask: "None built in",
      fastapi: "Depends(), resolved on each request",
      pyronaut: "Type-annotated injection, wiring checked at build time",
    },
    {
      area: "Testing",
      flask: "pytest + test client",
      fastapi: "pytest + TestClient; Testcontainers if you want a real database",
      pyronaut: "pytest; database containers started automatically",
    },
    {
      area: "Metrics and tracing",
      flask: "Add-on packages",
      fastapi: "Add-on packages",
      pyronaut: "Built in (Micrometer metrics, OpenTelemetry tracing)",
    },
    {
      area: "Deployment",
      flask: "Usually a Dockerfile you write",
      fastapi: "Usually a Dockerfile you write",
      pyronaut: "A wheel, a native executable, or a container image. Docker is optional.",
    },
    {
      area: "Python packages",
      flask: "Anything on PyPI",
      fastapi: "Anything on PyPI",
      pyronaut: "Pure-Python packages generally work; C extensions are limited",
    },
    {
      area: "Install size",
      flask: "A small virtualenv",
      fastapi: "A small virtualenv",
      pyronaut: "About 3.4 GiB including the JDK and GraalPy",
    },
    {
      area: "First released",
      flask: "2010",
      fastapi: "2018",
      pyronaut: "2026 (Micronaut underneath: 2018)",
    },
  ] satisfies ComparisonRow[],
  footnote:
    "HTTP benchmark throughput is the highest rate that met the latency targets in our HTTPS/HTTP2 benchmark on a 3-OCPU VM; see the performance page for the method. The single-row read is a separate database benchmark.",
};

export const FOOTER_COLUMNS = [
  {
    title: "Platform",
    links: [
      { label: "Pyronaut Documentation", href: DOCS_LINKS.pyronaut },
      { label: "Micronaut Docs", href: DOCS_LINKS.micronaut },
      { label: "Pyronaut Guides", href: DOCS_LINKS.guides },
      { label: "CLI reference", href: "/docs/#pyronautCliV2" },
      { label: "Python package compatibility", href: "https://graalpy.org/python-developers/compatibility/" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "GitHub", href: "https://github.com/micronaut-projects/pyronaut" },
      { label: "Blog", href: "/blog/" },
    ],
  },
  {
    title: "Ecosystem",
    links: [
      { label: "Micronaut", href: "https://micronaut.io" },
      { label: "GraalPy", href: "https://www.graalpy.org" },
      { label: "GraalVM", href: "https://www.graalvm.org" },
    ],
  },
];
