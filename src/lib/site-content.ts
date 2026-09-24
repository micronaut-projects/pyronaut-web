/**
 * Shared marketing content for every Pyronaut design variant.
 */

export const SITE_NAME = "Pyronaut";

export const SITE_DESCRIPTION =
  "Pyronaut is a high-performance Python web framework for building production services with rich data access, observability, cloud integrations, build-time validation, integrated testing, and enterprise support.";

export interface Feature {
  title: string;
  copy: string;
  icon: string;
  href: string;
}

/** Icon names map to inline SVG glyphs rendered by each design. */
export const FEATURES: Feature[] = [
  {
    title: "High performance",
    copy: "Pyronaut shifts application work to build time, preparing dependency injection, serialization, routing, and more before startup. A JIT compiler optimizes hot Python code, while a non-blocking HTTP runtime handles concurrent requests.",
    icon: "bolt",
    href: "/docs/performance/",
  },
  {
    title: "Rich data access",
    copy: "Define data access declaratively in Python. Pyronaut generates repository implementations and precomputes queries at build time, with a consistent programming model across supported databases.",
    icon: "annotations",
    href: "/docs/data-access/",
  },
  {
    title: "Production observability",
    copy: "Understand how your service behaves in production. Pyronaut brings together traces, correlated logs, health checks, and metrics with integrated Micrometer and OpenTelemetry support.",
    icon: "gauge",
    href: "/docs/observability/",
  },
  {
    title: "Cloud integrations",
    copy: "Make AWS, Azure, GCP, and Oracle Cloud services part of your Python application. Inject managed SDK clients, import cloud configuration and secrets, and work with messaging, storage, events, serverless workloads, and more through one application model.",
    icon: "flask",
    href: "/docs/cloud-integrations/",
  },
  {
    title: "Build-time validation",
    copy: "Catch configuration and dependency wiring problems at build time, giving coding agents and humans feedback before runtime.",
    icon: "shield",
    href: "/docs/source-processing/",
  },
  {
    title: "Enterprise support",
    copy: "Enterprise support for teams running business-critical Pyronaut services in production.",
    icon: "rocket",
    href: "/docs/support/",
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
    copy: "Generate a project with platform dependencies resolved.",
  },
  {
    command: "pyronaut dev",
    title: "Develop",
    copy: "Local server with automatic reload and managed Test Resources.",
  },
  {
    command: "pyronaut test",
    title: "Test",
    copy: "Run pytest against the real application context and test infrastructure.",
  },
  {
    command: "pyronaut validate-config",
    title: "Validate",
    copy: "Check configuration and DI wiring for dev, run, test, and production.",
  },
  {
    command: "pyronaut build",
    title: "Package",
    copy: "Produce a wheel, container image, or native executable.",
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
      "Use Micronaut annotations directly from Python for data access, routing, dependency injection, validation, and serialization.",
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


@dataclass
@MappedEntity
@Serdeable
class Rocket:
    id: Annotated[int | None, Id, GeneratedValue]
    name: str
    thrust_kn: float


@Serdeable
@dataclass
class LaunchCommand:
    name: Annotated[str, NotBlank]
    thrust_kn: Annotated[float, Positive]


@JdbcRepository(dialect="MYSQL")
class RocketRepository(CrudRepository[Rocket, int]):

    def findByNameContains(self, fragment: str) -> List[Rocket]: ...


rockets: Annotated[RocketRepository, Inject]


@Get("/rockets")
def fleet() -> List[Rocket]:
    return rockets.findAll()


@Get("/rockets/search/{fragment}")
def search(fragment: str) -> List[Rocket]:
    return rockets.findByNameContains(fragment)


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
      "pytest runs against the same embedded server, DI context, and Test Resources database the application uses.",
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
      "One CLI coordinates creation, development, testing, validation, and production packaging.",
    code: `$ pyronaut create rocket-service
  Resolved Micronaut platform 5.x via Maven
  Created rocket-service/ with pyproject.toml

$ pyronaut dev
  Test Resources: mysql:8 ready on :3306
  Server running on http://localhost:8080 (reload on)

$ pyronaut test
  12 passed in 3.4s (JUnit XML + HTML report)

$ pyronaut validate-config --env production
  Configuration OK · DI graph OK

$ pyronaut build --native-base
  Native executable: build/rocket-service`,
  },
];

export const CODE_PROOFS = [
  "One type definition drives the application model",
  "Check configuration and dependency wiring before runtime",
  "One application model spans development, tests, and packaging",
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

export const PERSONAS: Persona[] = [
  {
    role: "Python developers",
    value:
      "Build with one consistent application model.",
  },
  {
    role: "Architects",
    value:
      "Standardize how teams build and run production Python services.",
  },
  {
    role: "Platform engineering",
    value:
      "Give teams one path from project creation to production artifact.",
  },
  {
    role: "Engineering leadership",
    value:
      "Adopt a high-performance Python framework with enterprise support.",
  },
];

export interface ComparisonRow {
  area: string;
  conventional: string;
  pyronaut: string;
}

export const STACK_COMPARISON = {
  conventionalTitle: "A representative FastAPI stack",
  pyronautTitle: "Pyronaut",
  rows: [
    {
      area: "HTTP & data",
      conventional: "FastAPI + Uvicorn + SQLAlchemy",
      pyronaut: "Micronaut HTTP on Netty + Micronaut Data",
    },
    {
      area: "Types & config",
      conventional: "Pydantic + Pydantic Settings",
      pyronaut: "Build-time processing for DI, validation, and serialization",
    },
    {
      area: "Testing",
      conventional: "pytest + Testcontainers + fixtures",
      pyronaut: "pytest + Micronaut Test + Test Resources",
    },
    {
      area: "Observability",
      conventional: "structlog + OpenTelemetry + OpenAPI",
      pyronaut:
        "Micrometer metrics + OpenTelemetry tracing + observability integrations",
    },
    {
      area: "Deployment",
      conventional: "Dockerfiles + CI templates",
      pyronaut: "Production packaging + supported cloud integrations",
    },
  ] satisfies ComparisonRow[],
  conventionalFootnote: "…and every integration between them",
  pyronautFootnote: "…designed to work together",
};

export const FOOTER_COLUMNS = [
  {
    title: "Platform",
    links: [
      { label: "Documentation", href: "/docs/" },
      { label: "Guides", href: "/guides/" },
      { label: "CLI reference", href: "/docs/cli/" },
      { label: "Python package compatibility", href: "/docs/compatibility/" },
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
