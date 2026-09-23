---
slug: 2026/09/23/introducing-pyronaut
title: Introducing Pyronaut
description: Pyronaut is a batteries-included Python framework built on Micronaut and GraalPy, bringing HTTP, dependency injection, validation, data access, observability, testing, and packaging into one application model.
date: '2026-09-23T10:00:00'
category: announcements
categories:
  - announcements
tags:
  - pyronaut
  - python
  - graalpy
href: /2026/09/23/introducing-pyronaut/
---

Welcome to the Pyronaut blog! This is where we will share release announcements, technical deep dives, and news from the project. To start, here is what Pyronaut is and why we built it.

## What is Pyronaut?

Pyronaut is a batteries-included framework for building cloud-ready Python applications. It runs your Python code on [GraalPy](https://www.graalvm.org/python/), a Python implementation for the JVM, and gives it the full [Micronaut](https://micronaut.io) framework: an HTTP server built on Netty, dependency injection, configuration management, validation, serialization, data access, observability, and a test framework, all resolved at build time rather than at startup.

A typical production Python service is assembled from separate projects: an HTTP framework, an ASGI or WSGI server, a validation library, a settings library, pytest fixtures for Testcontainers, a logging setup, OpenAPI configuration, a Dockerfile, and CI templates. Each piece is good, but the integration work between them is yours. Pyronaut ships those concerns as one application model, so the same Python types and decorators drive HTTP, validation, serialization, OpenAPI, dependency injection, editor completion, and tests.

## The smallest Pyronaut application

Create `main.py`:

```python
from micronaut.http.annotation import Get


@Get("/")
def read_root() -> dict:
    return {"Hello": "World"}


@Get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None) -> dict:
    return {"item_id": item_id, "q": q}
```

Run it:

```bash
pyronaut dev
```

Pyronaut compiles the module, starts a server on port 8080, and reloads it when the file changes. The `item_id: int` type hint tells Pyronaut to convert and validate the path value, so `/items/foo` returns `400 Bad Request`. An OpenAPI description is generated and Swagger UI is served at `/swagger-ui/index.html`. No project file, virtual environment, or application server is needed for this first step.

## How it differs

- **Decorators are Micronaut annotations.** `@Get`, `@Singleton`, `@Value`, and every other decorator correspond to a Micronaut annotation, so anything documented for Micronaut is available from Python.
- **Work happens at build time.** Before the application starts, Pyronaut reads your decorators and type hints and generates the routing table, dependency graph, and serializers. A missing bean or an unsatisfiable dependency becomes a build error instead of a failure on the first request in production.
- **Java libraries are one import away.** JDBC drivers, Kafka and RabbitMQ clients, cloud SDKs, and thousands of other Java libraries can be declared in `pyproject.toml` and imported from Python.
- **Threads and asyncio both work.** Plain `def` routes run on a thread pool, `async def` routes run on the Netty event loop, and GraalPy runs Python in several interpreter contexts inside one process.

## One CLI for the whole lifecycle

The `pyronaut` command covers the application from creation to production:

```bash
pyronaut create demo          # new project from Micronaut Launch
pyronaut dev                  # development server with live reload
pyronaut test                 # pytest against the real application context
pyronaut validate-config      # check configuration and the DI graph
pyronaut build --native       # GraalVM native executable
```

`pyronaut test` and `pyronaut dev` use [Micronaut Test Resources](https://micronaut-projects.github.io/micronaut-test-resources/latest/guide/) to start the databases and message brokers your application needs in Docker, so local development and tests use real infrastructure without hand-written Docker Compose files. The same project can be packaged as a runnable JAR, a container image, or a native executable without changing application code.

## Get started

Install the CLI from PyPI with Python 3.10 or later, then provision the local SDK:

```bash
python3 -m pip install --upgrade pyronaut
pyronaut setup
```

If anything goes wrong, `pyronaut doctor` checks your environment and prints a fix for every failing check.

From there, read the [documentation](/docs/), follow the [guides](/guides/), and let us know what you build on [GitHub](https://github.com/micronaut-projects/pyronaut). Pyronaut is part of Micronaut, a Commonhaus Foundation project, and we look forward to building it with you.
