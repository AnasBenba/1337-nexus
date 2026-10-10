# 1337 Nexus — Makefile Guide

## Purpose

The root `Makefile` provides short, consistent commands for common 1337 Nexus development and operations tasks.

Instead of typing long Docker Compose, Python, or frontend commands, developers can use commands such as:

```bash
make dev
make down
make logs
make test
make lint
make backup
```

The Makefile is a **command interface** for the project. It does not contain application business logic.

## 1. Shell configuration

```make
SHELL := /bin/bash
```

This tells `make` to execute recipe commands with Bash.

## 2. Docker command

```make
DOCKER ?= docker
```

This defines the Docker command used throughout the Makefile.

Normally:

```text
DOCKER = docker
```

On a system where Docker requires sudo:

```bash
make DOCKER="sudo docker" dev
```

## 3. Compose file variables

```make
ENV_FILE := deploy/.env
COMPOSE_FILE := deploy/docker-compose.yml
DEV_COMPOSE_FILE := deploy/docker-compose.dev.yml
```

- `ENV_FILE` points to the local environment file.
- `COMPOSE_FILE` points to the base Compose configuration.
- `DEV_COMPOSE_FILE` points to the development override.

## 4. Compose command variables

```make
COMPOSE := $(DOCKER) compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE)
DEV_COMPOSE := $(COMPOSE) -f $(DEV_COMPOSE_FILE)
```

These avoid repeating long Docker Compose commands.

Conceptually:

```text
COMPOSE
→ docker compose + .env + docker-compose.yml

DEV_COMPOSE
→ COMPOSE + docker-compose.dev.yml
```

## 5. Script variables

```make
BACKUP_SCRIPT := deploy/scripts/backup.sh
PERF_SCRIPT := deploy/scripts/perf-smoke.sh
```

These point to the operational scripts.

## 6. `.PHONY`

The Makefile declares command targets as phony:

```make
.PHONY:     help     validate     dev-validate     dev     dev-build     down     ps     logs     logs-backend     logs-postgres     logs-nginx     postgres     backup     perf     lint     types     test     frontend-test     migrate     seed     ingest     gen-api     clean
```

This tells Make that these are commands, not files. They should run when requested even if a file with the same name exists.

## 7. `make help`

Shows the available commands and a short explanation.

```bash
make help
```

## 8. `make validate`

```make
validate:
    $(COMPOSE) config
```

Validates the base Compose configuration without starting containers.

```bash
make validate
```

## 9. `make dev-validate`

```make
dev-validate:
    $(DEV_COMPOSE) config
```

Validates the merged base + development Compose configuration without starting it.

```bash
make dev-validate
```

## 10. `make dev`

```make
dev:
    $(DEV_COMPOSE) up
```

Starts the development stack in the foreground.

The main services are:

```text
nginx
backend
postgres
```

## 11. `make dev-build`

```make
dev-build:
    $(DEV_COMPOSE) up --build
```

Builds the images and starts the development stack.

Use this after changes that require an image rebuild, such as Dockerfile or dependency changes.

## 12. `make down`

```make
down:
    $(DEV_COMPOSE) down
```

Stops and removes the development containers and Compose network.

Named volumes are normally preserved.

## 13. `make ps`

```make
ps:
    $(DEV_COMPOSE) ps
```

Shows the current development service status.

```bash
make ps
```

## 14. Logging commands

### `make logs`

Follows logs from all development services.

```bash
make logs
```

### `make logs-backend`

Follows only backend logs.

```bash
make logs-backend
```

### `make logs-postgres`

Follows only PostgreSQL logs.

```bash
make logs-postgres
```

### `make logs-nginx`

Follows only Nginx logs.

```bash
make logs-nginx
```

## 15. `make postgres`

```make
postgres:
    $(COMPOSE) up -d postgres
```

Starts only PostgreSQL in detached mode.

This is useful while the application code is still being developed.

```bash
make postgres
```

## 16. `make backup`

```make
backup:
    sudo ./$(BACKUP_SCRIPT)
```

Runs:

```text
deploy/scripts/backup.sh
```

The backup script handles the project's persistent data backup.

Database backup:

```text
PostgreSQL
    ↓
pg_dump
    ↓
database dump
```

Media backup:

```text
media_data
    ↓
compressed archive
```

The backup target uses `sudo` because the default backup directory is under `/var/backups/1337-nexus`.

## 17. `make perf`

```make
perf:
    sudo ./$(PERF_SCRIPT)
```

Runs:

```text
deploy/scripts/perf-smoke.sh
```

It is a bounded smoke test rather than a full load test.

It checks things such as:

- required services;
- health endpoints;
- a small number of requests;
- response latency;
- current container memory usage.

```bash
make perf
```

## 18. `make lint`

```make
lint:
    cd backend && python -m ruff check .
```

Runs Ruff against the backend.

```bash
make lint
```

## 19. `make types`

```make
types:
    cd backend && python -m mypy .
```

Runs mypy static type checking on the backend.

```bash
make types
```

## 20. `make test`

```make
test:
    cd backend && python -m pytest
```

Runs the backend test suite.

```bash
make test
```

## 21. `make frontend-test`

```make
frontend-test:
    cd frontend && npm run test
```

Runs the frontend test script defined by `frontend/package.json`.

This depends on the React frontend and its test setup being available.

```bash
make frontend-test
```

## 22. `make migrate`

```make
migrate:
    $(DEV_COMPOSE) exec backend alembic upgrade head
```

Runs the latest Alembic migrations inside the running backend container.

Conceptually:

```text
Alembic migration files
        ↓
Alembic
        ↓
PostgreSQL schema
```

This requires the backend container to be running.

```bash
make migrate
```

## 23. `make seed`

```make
seed:
    $(DEV_COMPOSE) exec backend python -m app.cli.seed
```

Runs:

```text
backend/app/cli/seed.py
```

The purpose is to create controlled seed/demo data for development and testing.

This requires the backend implementation to exist.

```bash
make seed
```

## 24. `make ingest`

```make
ingest:
    $(DEV_COMPOSE) exec backend python -m app.cli.ingest_subjects
```

Runs:

```text
backend/app/cli/ingest_subjects.py
```

This is for the curriculum/RAG ingestion workflow.

Conceptually:

```text
backend/content/subjects/
        ↓
ingest_subjects.py
        ↓
processing / indexing
        ↓
AI retrieval data
```

This depends on Zoubair's ingestion implementation and curriculum content.

```bash
make ingest
```

## 25. `make gen-api`

```make
gen-api:
    $(DEV_COMPOSE) exec backend python -m app.cli.export_openapi
```

Runs:

```text
backend/app/cli/export_openapi.py
```

Its purpose is to export the FastAPI OpenAPI API contract.

Conceptually:

```text
FastAPI
   ↓
OpenAPI
   ↓
export_openapi.py
   ↓
frontend API types
```

This helps keep frontend API types aligned with the backend API.

```bash
make gen-api
```

## 26. `make clean`

```make
clean:
    $(DEV_COMPOSE) down --remove-orphans
```

Stops the development stack and removes orphan containers belonging to the Compose project.

```bash
make clean
```

## 27. `DOCKER` override

The default is:

```make
DOCKER ?= docker
```

So on systems where the user can access Docker directly:

```bash
make dev
```

is enough.

On a system where Docker requires sudo:

```bash
make DOCKER="sudo docker" dev
```

Note that the `backup` and `perf` targets already call `sudo` directly.

## 28. Typical team workflow

A normal development cycle can be:

```text
Pull latest changes
      ↓
make dev-validate
      ↓
make dev
      ↓
Develop feature
      ↓
make lint
make types
make test
      ↓
Commit
      ↓
Pull Request
```

When dependencies or Dockerfiles change:

```text
Dockerfile / dependency change
      ↓
make dev-build
```

## 29. When commands are available

| Command | Purpose |
|---|---|
| `make validate` | Validate base Compose |
| `make dev-validate` | Validate base + dev Compose |
| `make dev` | Start development stack |
| `make dev-build` | Build + start development stack |
| `make down` | Stop development stack |
| `make ps` | Show service status |
| `make logs` | Follow all logs |
| `make logs-backend` | Backend logs |
| `make logs-postgres` | PostgreSQL logs |
| `make logs-nginx` | Nginx logs |
| `make postgres` | Start PostgreSQL only |
| `make backup` | Run backup script |
| `make perf` | Run performance smoke test |
| `make lint` | Run Ruff |
| `make types` | Run mypy |
| `make test` | Run backend tests |
| `make frontend-test` | Run frontend tests |
| `make migrate` | Run Alembic migrations |
| `make seed` | Seed development data |
| `make ingest` | Ingest curriculum/RAG content |
| `make gen-api` | Export OpenAPI |
| `make clean` | Stop and remove orphan containers |

## 30. Important principle

The Makefile is a **thin command layer**.

For example:

```text
make backup
    ↓
deploy/scripts/backup.sh
```

The backup logic belongs in `backup.sh`, not in the Makefile.

Likewise:

```text
make seed
    ↓
backend/app/cli/seed.py
```

The application logic belongs in the backend CLI.

This keeps responsibilities separate:

```text
Makefile
→ how to invoke an operation

Application/script
→ what the operation actually does
```

## 31. Final mental model

```text
                     Makefile
                        │
       ┌────────────────┼───────────────────┐
       │                │                   │
       ▼                ▼                   ▼
     Docker           Scripts            Application
       │                │                   │
       ▼                ▼                   ▼
    Compose        backup.sh             seed.py
    services       perf-smoke.sh         ingest_subjects.py
                                          export_openapi.py
```

When a developer forgets a project command, the first place to look is:

```bash
make help
```

The Makefile gives the team one consistent interface for the common development, testing, database, and infrastructure operations.
