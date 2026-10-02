---
slug: 2026/10/02/introducing-pyronaut
title: Introducing Pyronaut
description: Pyronaut is a high-performance Python application framework for building production services with rich data access, observability, cloud integrations, build-time validation, integrated testing, and enterprise support.
date: '2026-10-02T10:00:00'
category: announcements
categories:
  - announcements
tags:
  - pyronaut
  - python
  - graalpy
href: /2026/10/02/introducing-pyronaut/
---

Today we are pleased to announce the availability of [Pyronaut](https://pyronaut.io), a high-performance Python application platform for building production-ready services built on [GraalVM](https://graalvm.org) and [Micronaut](https://micronaut.io).

## What is Pyronaut?

Pyronaut brings the same ideas and benefits of [Micronaut](https://micronaut.io) and [GraalVM](https://graalvm.org) (AOT compilation, build time validation, source code processing etc.) to Python by fusing the Python AST with the Java compiler and optimizing runtime execution with GraalVM and the Graal JIT to enable highly performant and scalable Python services.

Thanks to the growth of AI, Python is one of the most popular languages in the world today, and from today Python can be used on one of the most mature, scalable and popular frameworks in the JVM ecosystem. Choosing Python as your server side language no longer means reduced throughput and higher latency.

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
pyronaut dev main.py
```

Deploy it:

```bash
pyronaut run main.py
```

## Scalability Powered by Netty

Micronaut is built on Netty, one of the most scalable and performant asynchronous frameworks in the world in any language.

With Pyronaut your Python code is served by that same Netty-based HTTP server and optimized by the Graal JIT. In our benchmarks that means more than twice the throughput of the next fastest Python framework, at lower latency (more on that [later in this post](#jvm-level-performance-for-python-services)).

We wired the Python `asyncio` plumbing directly into the Netty event loop so that you can natively use `async/await` with Pyronaut to write scalable non-blocking services.

```python
import asyncio

from micronaut.http.annotation import Get


@Get("/slow-hello")
async def slow_hello() -> str:
    await asyncio.sleep(0.5)   # suspends the coroutine, not the event loop
    return "hello"
```

There is no `asyncio.run()` and no `uvicorn`. The event loop already exists when Pyronaut calls your function, and things like `asyncio.gather` and `asyncio.TaskGroup` work as you would expect.

We extended this to streaming so you can use `async for` to write streaming services for SSE, websockets and other use cases. Any `async def` route that contains a `yield` is streamed back to the client with back-pressure:

```python
from dataclasses import dataclass
from typing import AsyncIterator

from java.time import Duration
from micronaut.http import MediaType
from micronaut.http.annotation import Get
from micronaut.http.sse import Event
from micronaut.serde.annotation import Serdeable
from micronaut_asyncio import as_async_iterable
from reactor.core.publisher import Flux


@Serdeable
@dataclass
class Tick:
    index: int
    label: str


@Get(value="/ticks", produces=MediaType.TEXT_EVENT_STREAM)
async def ticks() -> AsyncIterator[Event[Tick]]:
    every_second = Flux.interval(Duration.ofSeconds(1)).take(3)
    async with as_async_iterable(every_second) as seconds:
        async for second in seconds:
            yield Event.of(Tick(second, f"tick-{second}"))
```

Any reactive `Publisher` or Java `CompletableFuture` can be leveraged with `await` such that Java libraries like Reactor and others "just work" with native Python `async/await`. For example, you can use the built in Micronaut `HttpClient` to make non-blocking REST calls with `async/await`:

```python
from dataclasses import dataclass
from typing import Annotated

from jakarta.inject import Inject
from micronaut.http import HttpRequest
from micronaut.http.annotation import Get
from micronaut.http.client import HttpClient
from micronaut.http.client.annotation import Client
from micronaut.serde.annotation import Serdeable


@Serdeable
@dataclass
class Repo:
    name: str
    stargazers_count: int


github: Annotated[HttpClient, Inject, Client("https://api.github.com")]


@Get("/repos/{owner}/{name}")
async def repo(owner: str, name: str) -> Repo:
    request = HttpRequest.GET(f"/repos/{owner}/{name}").header("User-Agent", "pyronaut")
    return await github.retrieve(request, Repo)
```

## Data Access with Micronaut Data

Most Python web frameworks leave data access up to you. You pick an ORM, wire up sessions and find out at runtime whether your queries actually work.

Pyronaut includes [Micronaut Data](https://docs.micronaut.io/5.2.x/data/?lang=python&build=pyronaut&config-format=toml), which lets you define repositories in Python and precomputes SQL queries at build time for your favourite database. There is no runtime query translation, and a query that references a property that doesn't exist fails the build instead of a request in production:

```python
from dataclasses import dataclass
from typing import Annotated

from jakarta.inject import Inject
from jakarta.transaction import Transactional
from micronaut.data.annotation import GeneratedValue, Id, MappedEntity, Query
from micronaut.data.jdbc.annotation import JdbcRepository
from micronaut.data.model import Page, Pageable
from micronaut.data.repository import CrudRepository
from micronaut.http.annotation import Body, Get, Post
from micronaut.serde.annotation import Serdeable


@Serdeable
@MappedEntity
@dataclass
class Rocket:
    id: Annotated[int | None, Id, GeneratedValue]
    name: str
    thrust: float


@JdbcRepository(dialect="ORACLE")
class RocketRepository(CrudRepository[Rocket, int]):

    def findByNameContains(self, fragment: str) -> list[Rocket]: ...

    def findTop3ByThrustGreaterThanOrderByThrustDesc(self, thrust: float) -> list[Rocket]: ...

    def findNameByThrustLessThan(self, thrust: float) -> list[str]: ...

    def findAll(self, pageable: Pageable) -> Page[Rocket]: ...

    @Query("SELECT * FROM rocket WHERE LOWER(name) LIKE LOWER(:pattern)")
    def search(self, pattern: str) -> list[Rocket]: ...

    def update(self, id: Annotated[int, Id], thrust: float) -> None: ...


rockets: Annotated[RocketRepository, Inject]


@Post("/rockets")
@Transactional
def launch(fleet: Annotated[list[Rocket], Body]) -> list[Rocket]:
    return [rockets.save(rocket) for rocket in fleet]


@Get("/rockets/strongest/{thrust}")
def strongest(thrust: float) -> list[Rocket]:
    return rockets.findTop3ByThrustGreaterThanOrderByThrustDesc(thrust)


@Get("/rockets/page/{number}")
def page(number: int) -> Page[Rocket]:
    return rockets.findAll(Pageable.from_(number, 2))
```

Derived finders, projections, pagination, explicit queries, partial updates and transactions all come out of the box:

```
$ curl http://localhost:8080/rockets/strongest/5000
[{"id":5,"name":"Starship","thrust":74000.0},{"id":1,"name":"Saturn V","thrust":35100.0},{"id":3,"name":"Ariane 6","thrust":10400.0}]
```

The same programming model works with JDBC, R2DBC, Hibernate/JPA, Hibernate Reactive, MongoDB and Azure Cosmos DB, so Python developers get the same mature data access layer that Micronaut users have relied on for years.

## We married Python and javac 

Pyronaut is a source code processor for Python that analyzes the Python sources and automatically surfaces Python decorators every time it sees a Java annotation. Using this approach we were able to bring the entirety of the mature Micronaut framework core to the Python language including build time validation and ahead of time computation.

What this means in practice is that every part of Micronaut "just works" in Python and Python developers have fully fledged access to the entirety of the platform.

You can write serializable data classes with [Micronaut Serialization](https://micronaut-projects.github.io/micronaut-serialization/latest/guide/#introduction) which computes build time serializers/deserializers that provide fast efficient JSON serialization/deserialization:

```python
from dataclasses import dataclass
from typing import Annotated

from com.fasterxml.jackson.annotation import JsonProperty
from micronaut.serde.annotation import Serdeable


@Serdeable 
@dataclass
class Book:
    title: str
    quantity: Annotated[int, JsonProperty("qty")] 
```

You can generate OpenAPI specifications at build time from Micronaut routes defined in Python, with docstrings used to describe the API:

```python
from io.swagger.v3.oas.annotations import OpenAPIDefinition
from io.swagger.v3.oas.annotations.info import Info
from micronaut.http.annotation import Get


OpenAPIDefinition(info=Info(title="Greetings", version="1.0"))


@Get("/hello/{name}")
def greet(name: str) -> str:
    """
    Greets a person by name.

    @param name The person's name
    @return The greeting
    """
    return f"Hello {name}!"
```

The specification is written during compilation and served at `/swagger/greetings-1.0.yml`:

```yaml
openapi: 3.0.1
info:
  title: Greetings
  version: "1.0"
paths:
  /hello/{name}:
    get:
      summary: Greets a person by name.
      description: Greets a person by name.
      operationId: greet
      parameters:
      - name: name
        in: path
        description: The person's name
        required: true
        schema:
          type: string
      responses:
        "200":
          description: The greeting
          content:
            application/json:
              schema:
                type: string
```

You can define message consumers and producers in [Kafka](https://docs.micronaut.io/5.2.x/kafka/?lang=python&build=pyronaut&config-format=toml#kafka-kafkaQuickStart), [RabbitMQ](https://docs.micronaut.io/5.2.x/rabbitmq/?lang=python&build=pyronaut&config-format=toml#rabbitmq-quickStart), [JMS](https://docs.micronaut.io/5.2.x/jms/?lang=python&build=pyronaut&config-format=toml#jms-quickStart) and other messaging systems using Python:

```python
from micronaut.configuration.kafka.annotation import KafkaKey, KafkaListener, OffsetReset, Topic
from micronaut.context.annotation import Requires

@KafkaListener(offsetReset=OffsetReset.EARLIEST)  
class ProductListener:

    @Topic("my-products")
    def receive(self, brand: Annotated[str, KafkaKey], name: str) -> None:  
        LOG.info("Got Product - %s by %s", name, brand)
```

And you can write highly performant, low memory [MCP Tools](https://docs.micronaut.io/5.2.x/mcp?lang=python&build=pyronaut&config-format=toml) using Pyronaut:

```python
from micronaut.context.annotation import Requires, Prototype
from micronaut.mcp.annotations import Tool
from micronaut.mcp.server.context import MicronautMcpTransportContext

@Prototype
class Tools:
    @Tool(description="Evaluate a chess position using a FEN string.")
    def fen_evaluation(self, fen: str, ctx: MicronautMcpTransportContext) -> str:
        if fen == "r1bqk2r/ppp2ppp/2n5/1BbpP3/3Nn3/8/PPP2PPP/RNBQK2R w KQkq - 1 8":
            return "+0.12"
        return "+0.0"
```        

## Build Time Processing for Python

By doing everything at build time Pyronaut provides early validation of errors to humans and coding agents that would otherwise have to run your application to identify the issue. Mistakes made on source code are surfaced as build time errors. Configuration errors are detected before the application is run.

The development loop for both agents and humans is greatly shortened when using Pyronaut.

For example, if you misspell a property in a Micronaut Data query method:

```python
@JdbcRepository(dialect=Dialect.ORACLE)
class BookRepository(CrudRepository[Book, int], Protocol):
    def findByTitelContains(self, fragment: str) -> list[Book]: ...
```

Pyronaut refuses to process it and tells you exactly what is wrong:

```
$ pyronaut process
Checking main sources...
Full rebuild selected for main sources (2 files)
Processing failed: Pyronaut processing failed: Unable to implement Repository method: python.BookRepository.findByTitelContains(String fragment). Cannot query entity [Book] on non-existent property: Titel [title]
```

Configuration gets the same treatment. `pyronaut validate-config` checks your `application.toml` against the resolved application classpath, and `pyronaut dev`, `pyronaut run` and `pyronaut test` run the same validation automatically before your application starts, writing JSON and HTML reports to `__pyronaut__/reports/config-validation`:

```bash
pyronaut validate-config --scenario production
```

## Optimized Execution on JVM or Crema

Pyronaut features an ergonomic agent-friendly CLI that executes Python or Java code on either the JVM or [GraalVM Crema](https://github.com/oracle/graal/issues/11327).

Crema provides a pre-compiled native base image that lowers memory requirements, shortens startup time and speeds up the development loop for agents. Applications can be deployed to either the JVM or Crema depending on whether peak performance or faster startup is the priority. Native image builds are not required (although still possible if you want to go fully native).

Building a Docker image for the JVM, which offers the best peak throughput after warm-up:

```bash
pyronaut build main.py --jvm --docker
```

Building a Docker image on top of the Crema base image, which gives you native startup time and memory usage without a per-application native image build:

```bash
pyronaut build main.py --native-base --docker
```

With Crema only the reusable base image is ever built with native image. Subsequent application builds just add your processed classes and dependencies as a thin layer on top, so you don't pay the cost of a native image build every time your code changes.

## Use Python and Java Libraries, power it all with Testcontainers

GraalPy is [broadly compatible with many existing Python libraries](https://graalpy.org/python-developers/compatibility/), all of which are usable from a Pyronaut application.

Developers and agents also have the entire JVM ecosystem of libraries available at their fingertips.

You can easily [include Java libraries](https://pyronaut.io/docs/#use-a-java-library-from-python) and spin up [test resources in Docker containers](https://pyronaut.io/docs/#testResources) all from a single Python script. The following is a full Pyronaut application with HTTP endpoints and database access:


```python
from dataclasses import dataclass
from typing import Annotated, Protocol

from jakarta.inject import Inject
from micronaut.data.annotation import GeneratedValue, Id, MappedEntity
from micronaut.data.jdbc.annotation import JdbcRepository
from micronaut.data.model.query.builder.sql import Dialect
from micronaut.data.repository import CrudRepository
from micronaut.http.annotation import Get, Post
from micronaut.serde.annotation import Serdeable
from pyronaut.build import AppConfig, Dependency

Dependency(group="io.micronaut.data", module="micronaut-data-jdbc")
Dependency(group="io.micronaut.sql", module="micronaut-jdbc-hikari")
Dependency(group="com.oracle.database.jdbc", module="ojdbc11")
AppConfig(name="datasources.default.db-type", value="oracle")
AppConfig(name="datasources.default.dialect", value="ORACLE")
AppConfig(name="datasources.default.schema-generate", value="CREATE_DROP")


@Serdeable
@MappedEntity
@dataclass
class Book:
    id: Annotated[int | None, Id, GeneratedValue]
    title: str


@JdbcRepository(dialect=Dialect.ORACLE)
class BookRepository(CrudRepository[Book, int], Protocol):
    def findByTitleContains(self, fragment: str) -> list[Book]: ...


books: Annotated[BookRepository, Inject]


@Post("/books/{title}")
def create(title: str) -> Book:
    return books.save(Book(None, title))


@Get("/books/search/{fragment}")
def search(fragment: str) -> list[Book]:
    return books.findByTitleContains(fragment)


@Get("/books/count")
def count() -> int:
    return books.count()
```

Start it up with `pyronaut dev main.py` and a Docker container with Testcontainers will automatically spin up to start Oracle database. Changes to the code only reload the code and not the database.

```
$ curl -X POST http://localhost:8080/books/Dune
{"id":1,"title":"Dune"}

$ curl http://localhost:8080/books/search/Du
[{"id":1,"title":"Dune"}]
```

## JVM level performance for Python services

Performance has been a big focus of Micronaut and GraalVM since forever. We have continuously worked to optimize performance across every metric (startup time, memory, throughput).

That philosophy is no different today and with Pyronaut it already provides more throughput at reduced latency than any other comparable Python framework.

We drove Pyronaut, Emmett on Granian and Flask on Gunicorn with the same Hyperfoil load ramp over HTTPS/HTTP2 against the same 3 OCPU VM. A step only counts if it meets every latency SLA (p50 under 100ms, p95 under 200ms, p99 under 1s). Pyronaut sustained 33,802 requests per second, more than twice the next fastest Python framework and nearly six times Flask:

![Sustained throughput: Pyronaut 33,802 req/s, Emmett + Granian at least 14,569 req/s, Flask + Gunicorn 5,675 req/s](/pyronaut-assets/blog/introducing-pyronaut/performance-throughput.png)

And latency stays flat as the load increases, with p99 latency under 1ms all the way up to around 18,000 requests per second:

![p99 latency as load increases, on a log scale. Pyronaut stays near 0.5ms until around 15k req/s and reaches about 2ms at 28k req/s, while Emmett and Flask climb sooner](/pyronaut-assets/blog/introducing-pyronaut/performance-latency.png)

The test setup, along with the p50 and p95 numbers, is available on the [performance page](https://pyronaut.io/performance/).

To be clear, Pyronaut's performance is not yet comparable to Micronaut with Java. Python code still runs behind the GIL, which limits how much work can happen in parallel.

We are only getting started however, and the GraalPy team are hard at work on a GIL-free version of GraalPy where we anticipate we will be able to greatly increase throughput numbers in the near future. With the GIL eliminated we believe we can get close to the performance of Micronaut with Java.


## A Single VM for Your Entire Application

GraalVM has always been about one VM to rule them all. A single VM capable of running Java and other Truffle languages. 

With Pyronaut that advantage is clearer than ever to see.

We took the [FastAPI full stack template](https://github.com/fastapi/full-stack-fastapi-template) for Python and [converted it to Pyronaut](https://github.com/micronaut-projects/pyronaut-full-stack-template). It went from a mishmash of scripts cobbled together into everything being runnable and testable with a single `pyronaut dev` or `pyronaut test` command.

Instead of different VMs to run the management UI, Node, Python and a reverse proxy with Pyronaut you can run the entire stack on a single VM with Python served by GraalPy and the React SPA served by GraalJS.


## Not Just a Runtime for Python

During the development of Pyronaut, we realized a lot of the benefits of Python are benefits for Java developers as well. So with Pyronaut you can not only run and execute Python code directly, but you can also run Java code.

The following is a similar Micronaut Data application to the one shown earlier, this time using MySQL, executable with `pyronaut dev App.java`:

```java
@Dependency(group = "io.micronaut.data", module = "micronaut-data-jdbc")
@Dependency(group = "io.micronaut.sql", module = "micronaut-jdbc-hikari")
@Dependency(group = "com.mysql", module = "mysql-connector-j")
@Dependency(
    group = "io.micronaut.data",
    module = "micronaut-data-processor",
    scope = Dependency.Scope.BUILD
)
@AppConfig(name = "datasources.default.db-type", value = "mysql")
@AppConfig(name = "datasources.default.dialect", value = "MYSQL")
@AppConfig(name = "datasources.default.schema-generate", value = "CREATE_DROP")
public class App {
    public static void main(String[] args) {
        Micronaut.run(App.class, args);
    }
}

@MappedEntity
record Book(@Id @GeneratedValue Long id, @NonNull String title) {
}

@JdbcRepository(dialect = Dialect.MYSQL)
interface BookRepository extends CrudRepository<Book, Long> {
}

@Controller("/books")
@ExecuteOn(TaskExecutors.BLOCKING)
final class BookController {
    private final BookRepository books;

    BookController(BookRepository books) {
        this.books = books;
    }

    @Post("/{title}")
    long create(@PathVariable String title) {
        books.save(new Book(null, title));
        return books.count();
    }

    @Get("/count")
    long count() {
        return books.count();
    }
}
```

## Why Pyronaut now?

AI is changing how we write software, and AI models have a particularly strong grasp of Python. At the same time the importance of frameworks, libraries and guardrails has never been more prevalent.

Build time frameworks like Micronaut are particularly valuable since they fail earlier with informative errors that help humans and agents to shorten the development loop and avoid wasting time and resources starting the application.

## Where to from here

This is only the first release and we are not stopping here.

We are working on a static type checker for Python that understands both your Python code and the Java APIs it calls. Combined with build time processing this means even more mistakes are caught before the application ever runs, which is particularly useful for coding agents that can check their work without starting the application.

We are also working on experimental support for statically compiling Python code directly to JVM bytecode. For code that opts in, this removes the interpreter from the picture altogether and should offer even more performance on top of what GraalPy and the Graal JIT already deliver.

At the same time the GraalPy team are working on improving support for Python libraries that invoke native code, and on removing the GIL, so that performance and throughput get even better.

Stay tuned for more on all of these in the coming months.


## Find out more

The quickest way to get started is to install the CLI from PyPI and provision the SDK:

```bash
python3 -m pip install --upgrade pyronaut
pyronaut setup
```

Then follow along with one of these:

- [Installing Pyronaut](https://pyronaut.io/docs/#installation)
- [Getting Started](https://pyronaut.io/docs/#gettingStarted), including a port of [the FastAPI tutorial](https://pyronaut.io/docs/#fastApiTutorial)
- [Micronaut Concepts for Python Developers](https://pyronaut.io/docs/#concepts)
- [Pyronaut Launch](https://pyronaut.io/launch/) to generate a new project in your browser
- [Performance benchmarks](https://pyronaut.io/performance/)
- [The Pyronaut full stack template](https://github.com/micronaut-projects/pyronaut-full-stack-template)

From there, read the [documentation](/docs/), follow the [guides](/guides/), and let us know what you build on [GitHub](https://github.com/micronaut-projects/pyronaut). Pyronaut is part of Micronaut, a Commonhaus Foundation project, and we look forward to building it with you.


## See Pyronaut live at Devoxx

If you are at [Devoxx Belgium](https://devoxx.be) in Antwerp next week, come and see Thomas Wuerthinger and me present [Faster Development with Java, Python, and Micronaut](https://m.devoxx.com/events/dvbe26/talks/16444/faster-development-with-java-python-and-micronaut) on Thursday 8 October at 15:00.

We will be showing the pre-compiled, pre-optimized Micronaut runtime built on GraalVM that powers Pyronaut, and how it gives you fast startup, a low memory footprint and a consistent programming model across Java, Kotlin and Python, all without waiting on a native image build every time you change your code. Come and say hello!
