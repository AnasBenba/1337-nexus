# 1337 Nexus — Development Docker Compose Guide

## Purpose

`deploy/docker-compose.dev.yml` is the **development override** for the main Docker Compose configuration.

It is **not a separate application architecture** and it does not replace `deploy/docker-compose.yml`.

The two files are used together:

```text
deploy/docker-compose.yml
        +
deploy/docker-compose.dev.yml
        ↓
development configuration
```

The base Compose file defines the main 1337 Nexus container topology:

```text
Nginx
  ↓
Backend
  ↓
PostgreSQL
```

The development override adds settings that are useful while writing and testing code locally.

---

# 1. Why the project has two Compose files

## `deploy/docker-compose.yml`

This is the base configuration.

It defines the main services, networking, volumes, resource limits, health checks, build configuration, and environment variables.

## `deploy/docker-compose.dev.yml`

This is an **opt-in development override**.

It adds development behavior without changing the core architecture.

For the current project it provides:

- backend source bind mounts;
- Alembic source mounts;
- Uvicorn reload mode;
- a host-exposed PostgreSQL port for development.

This keeps development conveniences separate from the base deployment configuration.

---

# 2. Current development override

The current file is:

```yaml
services:
  backend:
    environment:
      UVICORN_RELOAD: "1"

    volumes:
      - ../backend/app:/app/app
      - ../backend/alembic:/app/alembic
      - ../backend/alembic.ini:/app/alembic.ini:ro

  postgres:
    ports:
      - "5432:5432"
```

The file intentionally does **not** repeat the full contents of `docker-compose.yml`.

Docker Compose merges the two files when both are supplied.

---

# 3. Backend development behavior

## `UVICORN_RELOAD`

The development override sets:

```yaml
UVICORN_RELOAD: "1"
```

The backend startup script reads this variable.

The relevant logic is:

```sh
${UVICORN_RELOAD:+--reload}
```

This means:

```text
Production
UVICORN_RELOAD is not set
        ↓
Uvicorn starts normally

Development
UVICORN_RELOAD=1
        ↓
Uvicorn starts with --reload
```

`--reload` watches the application source and restarts the Uvicorn process when code changes are detected.

This means developers can edit backend code without rebuilding the backend image after every change.

---

# 4. Why the development override keeps `entrypoint.sh`

The backend image already defines:

```dockerfile
ENTRYPOINT ["/app/entrypoint.sh"]
```

The entrypoint is therefore still used in development.

Its normal startup sequence is:

```text
Container starts
      ↓
wait for PostgreSQL
      ↓
run Alembic migrations
      ↓
start Uvicorn
```

The development override only enables the optional reload behavior through `UVICORN_RELOAD`.

It does not replace the entrypoint.

---

# 5. Backend source mounts

The development override contains:

```yaml
volumes:
  - ../backend/app:/app/app
```

This maps:

```text
Host
backend/app/
      ↓
Container
/app/app/
```

The backend Dockerfile uses:

```text
/app/
└── app/
    ├── main.py
    ├── api.py
    └── ...
```

Therefore the mount matches the application's container path.

### Why this is useful

Suppose a developer changes:

```text
backend/app/user/pitches/...
```

The container sees the changed file immediately because the host directory is mounted into the container.

The normal development cycle becomes:

```text
edit code
   ↓
file appears in container
   ↓
Uvicorn --reload detects change
   ↓
backend restarts
```

No backend image rebuild is required for each source-code edit.

---

# 6. Alembic mounts

The development override also mounts:

```yaml
- ../backend/alembic:/app/alembic
- ../backend/alembic.ini:/app/alembic.ini:ro
```

These correspond to files used by the backend image.

## `../backend/alembic:/app/alembic`

Allows developers to work with migration files directly from the host.

## `../backend/alembic.ini:/app/alembic.ini:ro`

Makes the local Alembic configuration available inside the container.

The `:ro` means **read-only**.

---

# 7. PostgreSQL development port

The development override adds:

```yaml
postgres:
  ports:
    - "5432:5432"
```

This creates:

```text
Host machine
localhost:5432
      ↓
PostgreSQL container
5432
```

Developers can therefore connect to PostgreSQL from local tools such as:

- `psql`;
- database GUI clients;
- IDE database tools;
- local debugging scripts.

The PostgreSQL container remains on the Docker `nexus` network as well, so the backend continues to connect using:

```text
postgres:5432
```

The host port is a **development convenience**.

---

# 8. What the development override does NOT do

`docker-compose.dev.yml` does not create a new service architecture.

It does not remove:

```text
nginx
backend
postgres
```

It does not replace the base Compose file.

It also does not contain application business logic.

The following remain defined by the base Compose file:

- container images/builds;
- Docker network;
- persistent volumes;
- PostgreSQL healthcheck;
- resource limits;
- Nginx public port;
- backend internal port;
- base environment configuration.

---

# 9. How to use it

Run the development stack by specifying **both** files:

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.dev.yml \
  up
```

The files are processed in this order:

```text
docker-compose.yml
        ↓
docker-compose.dev.yml
        ↓
merged development configuration
```

The second file overrides/adds development-specific settings.

---

# 10. Build and start development containers

When images need to be rebuilt:

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.dev.yml \
  up --build
```

Use `--build` when you changed something that belongs to the image itself, such as:

- a Dockerfile;
- dependency files;
- build configuration;
- other files copied into the image during build.

You normally do **not** need `--build` for every Python source edit when the source is bind-mounted.

---

# 11. Run the stack in the background

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.dev.yml \
  up -d
```

Check status:

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.dev.yml \
  ps
```

---

# 12. View logs

All services:

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.dev.yml \
  logs -f
```

Backend only:

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.dev.yml \
  logs -f backend
```

PostgreSQL only:

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.dev.yml \
  logs -f postgres
```

Nginx only:

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.dev.yml \
  logs -f nginx
```

---

# 13. Stop the development stack

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.dev.yml \
  down
```

This stops and removes the development containers and network created for the Compose project.

Named volumes are normally preserved unless you explicitly remove them.

Therefore PostgreSQL data remains available for the next development run.

---

# 14. Validate the merged configuration before starting

Use:

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.dev.yml \
  config
```

This does not start the containers.

It verifies that Docker Compose can parse and merge the configuration.

Expected conceptually:

```text
base Compose
      +
development override
      ↓
valid merged Compose configuration
```

Run this after changing either Compose file.

---

# 15. Development environment file

Development commands should use:

```text
deploy/.env
```

This is the local environment containing actual local configuration values.

The committed template is:

```text
deploy/.env.example
```

The normal relationship is:

```text
.env.example
      ↓
copy/create
      ↓
.env
      ↓
real local values
      ↓
docker compose
```

Do not commit the real `.env`.

---

# 16. How developers should think about source changes

### Normal source-code change

Example:

```text
backend/app/user/messages/...
```

or:

```text
backend/app/collaboration/...
```

Because the application source is mounted:

```text
host source
    ↓
container source
    ↓
Uvicorn reload
```

A rebuild is normally unnecessary.

### Dependency change

Example:

```text
backend/requirements.lock
```

A new image build is normally required because dependencies are installed when the backend image is built.

Use:

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.dev.yml \
  up --build
```

### Dockerfile change

If a developer changes:

```text
backend/Dockerfile
```

or:

```text
nginx/Dockerfile
```

rebuild the affected image.

---

# 17. Important distinction: image vs bind mount

A Docker image contains the application source copied during the build.

The development Compose file then mounts the current host source over the corresponding container directory.

Conceptually:

```text
Docker image
    ↓
initial application files

development bind mount
    ↓
current host source replaces the mounted path
```

This is why development can use the same container image structure while allowing rapid source editing.

---

# 18. PostgreSQL in development

PostgreSQL uses the same service from the base Compose file:

```text
postgres
```

The development override only exposes:

```text
5432
```

to the host.

The database still uses the persistent named volume:

```text
postgres_data
```

and the configured PostgreSQL runtime configuration:

```text
deploy/postgres/postgresql.conf
```

The PostgreSQL image is:

```text
pgvector/pgvector:pg17
```

The development Compose file does not install pgvector itself; the image already provides the extension software.

Database schema and extension activation are handled separately by the application's database/migration process.

---

# 19. Development vs production

Development configuration is intentionally different from the base deployment configuration.

Development:

```text
source mounts
reload
host PostgreSQL port
```

Base/deployment:

```text
image-based execution
no source mounts
PostgreSQL not published to host
```

This separation reduces the chance of accidentally bringing development-only behavior into the normal deployment configuration.

---

# 20. Recommended team workflow

When working on a feature:

```text
1. Pull the latest repository changes
        ↓
2. Make sure deploy/.env exists
        ↓
3. Validate Compose
        ↓
4. Start development stack
        ↓
5. Edit feature source
        ↓
6. Uvicorn reloads backend changes
        ↓
7. Run tests / checks
        ↓
8. Commit feature changes
        ↓
9. Open Pull Request
```

The feature owner remains responsible for the application's feature code; this Compose override only provides the shared local runtime.

---

# 21. Quick reference

## Validate

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.dev.yml \
  config
```

## Start

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.dev.yml \
  up
```

## Start with rebuild

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.dev.yml \
  up --build
```

## Start in background

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.dev.yml \
  up -d
```

## Status

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.dev.yml \
  ps
```

## Logs

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.dev.yml \
  logs -f
```

## Stop

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.dev.yml \
  down
```

---

# 22. Final mental model

```text
docker-compose.yml
        │
        │ base architecture
        ↓
┌─────────────────────────────┐
│ nginx                       │
│ backend                     │
│ postgres                    │
└─────────────────────────────┘
        +
docker-compose.dev.yml
        │
        ├── backend source mounts
        ├── Alembic mounts
        ├── Uvicorn reload
        └── host PostgreSQL :5432
        ↓
Development environment
```

The development override exists to make **local development faster and easier without changing the project's core three-container architecture**.
