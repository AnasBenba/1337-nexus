# 1337 Nexus — `backend/pyproject.toml` Guide

## What is `pyproject.toml`?

`backend/pyproject.toml` is the **main configuration and dependency file for the Python backend**.

It tells Python tooling and the development environment:

- what the backend project is;
- which Python version it supports;
- which packages the backend needs;
- which tools are used for linting, formatting, type checking, testing, and architecture checks;
- how the backend package is discovered.

In our repository it belongs here:

```text
1337-nexus/
└── backend/
    ├── app/
    ├── tests/
    ├── pyproject.toml       <-- this file
    └── requirements.lock
```

---

## Why do we need it?

Without one central project definition, every developer could install and configure Python tools differently.

We want the team to use **one agreed backend environment**.

The important flow is:

```text
pyproject.toml
      ↓
Declares dependencies + tool configuration
      ↓
Resolve dependencies
      ↓
requirements.lock
      ↓
Exact reproducible environment
      ↓
Docker + CI + developers
```

So `pyproject.toml` is the **source of dependency and tooling intent**, while `requirements.lock` is the **resolved, reproducible result**.

The project plan explicitly uses this model: `pyproject.toml` is the dependency source and the lock file is the compiled/hashed environment used by CI and the build.

---

## What are the main parts of the file?

### 1. `[build-system]`

Defines how the Python project itself is built/installed.

For us, this establishes the build backend used by Python packaging tools.

```toml
[build-system]
requires = ["setuptools>=75,<76"]
build-backend = "setuptools.build_meta"
```

You normally do not change this when adding a feature.

### 2. `[project]`

This is the most important section for dependencies.

It defines:

```text
project name
version
supported Python version
direct runtime dependencies
```

For example:

```toml
requires-python = ">=3.12,<3.13"
```

and the `dependencies = [...]` list contains the backend libraries the application needs.

### 3. `[project.optional-dependencies]`

Contains development-only tools.

Our `dev` group includes tools such as:

```text
Ruff
mypy
import-linter
pytest
pytest-asyncio
pytest-cov
asgi-lifespan
```

These are needed to develop and validate the backend but are not application runtime features.

The project plan requires Ruff, strict mypy, import-linter, and the pytest-based test stack.

### 4. `[tool.ruff]`

Defines how **Ruff** checks and formats Python code.

Ruff is used for code quality and formatting, so the team does not need a separate Python formatter.

### 5. `[tool.mypy]`

Defines **strict Python type checking**.

This helps catch incorrect types before code reaches runtime.

The project quality standard explicitly calls for strict mypy.

### 6. `[tool.pytest.ini_options]`

Defines how the backend tests are discovered and run.

For example, it identifies:

```text
tests/
unit tests
integration tests
realtime tests
CRDT tests
```

### 7. `[tool.coverage.*]`

Defines how test coverage is measured.

The project uses separate coverage expectations for backend services and routers, with CI enforcing them through a dedicated coverage-check script rather than relying only on one global number. fileciteturn36file7

### 8. `[tool.importlinter]`

Defines architectural import rules.

This is important for our chosen repository structure because we want to prevent infrastructure code from accidentally becoming dependent on application features.

Our architecture is:

```text
app/
├── core/
├── flows/
├── admin/
├── user/
├── teams/
├── collaboration/
├── integrations/
├── gamification/
├── realtime/
├── jobs/
├── shared/
└── cli/
```

The import rules must be written against **this structure**, not the original `app/modules/` architecture from the initial project plan.

---

# Relationship with the other developers

`pyproject.toml` is a **shared team file**, even though Anas is responsible for maintaining the build/tooling side.

The rule is:

```text
Feature developer
      ↓
Needs a Python package for the feature
      ↓
Tells team / adds requirement
      ↓
pyproject.toml is updated
      ↓
requirements.lock is regenerated
      ↓
Docker + CI use the locked result
```

### Sfy

Sfy may need packages for:

```text
42 Intra OAuth
security
TOTP
campus/admin functionality
```

Those dependencies belong in the shared backend dependency definition when they are actually required by the implementation.

### Zoubair

Zoubair may need packages for:

```text
AI/RAG
embeddings
pycrdt / CRDT handling
Co-Pilot
```

The project plan specifically includes `pycrdt`, `pgvector`, the AI HTTP client path, and tokenization tooling.

### Ayoub

Ayoub may introduce dependencies required by:

```text
recruitment
teams
Kanban
GitHub integration
```

### Yassin

Yassin may introduce dependencies required by:

```text
pitches
Markdown rendering/sanitization
chat
search
notifications
gamification
```

### Anas

Anas owns the **project/tooling/build side**:

```text
pyproject.toml
Ruff configuration
mypy configuration
pytest configuration
coverage configuration
import-linter configuration
requirements.lock generation
CI usage of the environment
Docker usage of the environment
```

But Anas should **not invent feature dependencies** that the feature developers do not need.

---

# `pyproject.toml` vs `requirements.lock`

This distinction is important.

### `pyproject.toml`

Answers:

> **What does the project require?**

Example:

```text
FastAPI ~= 0.141
SQLAlchemy ~= 2.0
asyncpg ~= 0.31
```

### `requirements.lock`

Answers:

> **What exact packages and versions did we resolve and agree to install?**

So:

```text
pyproject.toml
     = dependency rules / intent

requirements.lock
     = exact resolved installation set
```

The project plan requires the lock to be committed and used for deterministic CI/builds.

---

# When should we change this file?

Change `pyproject.toml` when:

- a new backend dependency is genuinely required;
- an existing dependency's allowed version range needs to change;
- a backend tool configuration changes;
- the project's Python packaging/build configuration changes;
- architecture import rules need to be updated because the repository structure changed.

Do **not** change it just because another developer created a new Python file. A new file does not automatically mean a new dependency.

---

# When should we generate `requirements.lock`?

Generate or update the lock file **after the dependency requirements are agreed and `pyproject.toml` is updated**.

```text
Developer work
      ↓
Confirm required packages
      ↓
Update pyproject.toml
      ↓
Resolve/lock dependencies
      ↓
Commit requirements.lock
      ↓
CI and Docker install from the locked set
```

For our project, this is why we do **not** want to create a final lock file before the feature developers have added/confirmed their real dependencies.

---

# What Anas should remember

```text
pyproject.toml
      │
      ├── Project definition
      ├── Runtime dependencies
      ├── Dev dependencies
      ├── Ruff
      ├── mypy
      ├── pytest
      ├── coverage
      └── architecture checks

requirements.lock
      │
      └── Exact resolved dependency set

Docker
      ↑
      └── installs the backend environment

CI
      ↑
      └── runs the same quality/testing environment

Other developers
      ↑
      └── contribute feature dependency requirements
```

### The key idea

> **`pyproject.toml` is the shared contract for how the Python backend is built, checked, and what it depends on. Anas maintains the infrastructure/tooling side, while every feature developer contributes the dependencies required by their own implementation.**
