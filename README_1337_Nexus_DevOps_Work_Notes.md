# 1337 Nexus - DevOps Work Notes

This document is a practical reference for the DevOps work completed so far on the 1337 Nexus project. It explains the architecture, why each infrastructure file exists, the concepts behind the configuration, and the commands used to validate the work.

> Scope: DevOps/infrastructure work discussed and implemented so far. The application-level backend and frontend code are developed by the application team and are not covered as implementation work here.

---

## 1. Project Architecture

The deployment target is a lightweight three-container Docker Compose stack:

```text
                         HOST
                          |
                       HTTPS :443
                          |
                          v
                 +------------------+
                 |      Nginx       |
                 |    container     |
                 |   internal :8443 |
                 +---------+--------+
                           |
                     Docker network
                           |
              +------------+------------+
              |                         |
              v                         v
      +---------------+          +---------------+
      |    Backend    |          |  PostgreSQL   |
      | FastAPI/Uvic. |          |   + pgvector  |
      | internal 8000 |          | internal 5432 |
      +---------------+          +---------------+
```

The important deployment rule is that **only Nginx publishes a host port** in the base Compose file. The backend and PostgreSQL communicate over the Docker network and are not directly published to the host.

The application team supplies the actual FastAPI and React code. The DevOps layer provides the containers, networking, configuration, startup logic, TLS handling, and later CI/CD and operational tooling.

---

## 2. Repository Areas Owned by DevOps

The main infrastructure areas are:

```text
1337-nexus/
├── nginx/                 # Edge server and frontend runtime image
├── deploy/                # Compose, environment and operational scripts
├── backend/Dockerfile     # Backend container build
├── backend/entrypoint.sh  # Backend startup/migration process
├── .github/               # CI/CD and repository automation
├── Makefile               # Shared project commands
├── .dockerignore          # Docker build-context filtering
└── .gitignore             # Git exclusions and secret protection
```

The application developers mainly work in:

```text
backend/app/
frontend/
```

---

# 3. PostgreSQL Container

## 3.1 Why PostgreSQL?

PostgreSQL is the main relational database for the project.

It stores structured application data such as users, projects/pitches, teams, boards, chat, notifications, AI/RAG metadata, gamification data, moderation data, and other application records.

We use the PostgreSQL container image with pgvector support:

```text
pgvector/pgvector:pg17
```

The pgvector extension allows PostgreSQL to store and query vector embeddings, which is needed later for the project's RAG/AI retrieval functionality.

## 3.2 PostgreSQL Compose service

The Compose service defines:

```yaml
image: pgvector/pgvector:pg17
```

The database credentials are supplied through environment variables instead of hardcoding secrets into Compose.

The database data directory is stored in a named Docker volume:

```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
```

This is what makes the database persistent across container recreation.

### Important concept

A **container is disposable**. A **named volume stores persistent data**.

Therefore:

```text
remove container
      |
      v
volume remains
      |
      v
new container mounts same data
```

That is why earlier we tested persistence by inserting a row and recreating the container while keeping the volume.

---

# 4. PostgreSQL Configuration

File:

```text
deploy/postgres/postgresql.conf
```

This file controls PostgreSQL server settings that were derived for the project's resource budget.

The settings we configured were:

```conf
max_connections = 40
shared_buffers = 256MB
work_mem = 8MB
maintenance_work_mem = 128MB
autovacuum_max_workers = 2
```

## What each setting means

### `max_connections = 40`

Maximum number of PostgreSQL client connections the server can have at once.

This was deliberately bounded so the database does not consume excessive memory through an unnecessarily large connection limit.

### `shared_buffers = 256MB`

Memory PostgreSQL uses for shared database page caching.

### `work_mem = 8MB`

Memory available per sort/hash operation before PostgreSQL may spill work to disk.

It is **per operation**, not simply "8 MB total" for the entire database.

### `maintenance_work_mem = 128MB`

Memory available for maintenance operations such as VACUUM and index creation.

### `autovacuum_max_workers = 2`

Maximum number of autovacuum worker processes that can run concurrently.

---

# 5. PostgreSQL Health Check

Compose uses:

```yaml
healthcheck:
  test:
    [
      "CMD-SHELL",
      "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"
    ]
```

The command `pg_isready` asks PostgreSQL whether it is accepting connections.

We used:

```text
$${POSTGRES_USER}
$${POSTGRES_DB}
```

instead of:

```text
${POSTGRES_USER}
${POSTGRES_DB}
```

because Compose would otherwise substitute the variables **before the command reaches the container**.

The double `$` escapes Compose's interpolation and leaves the container-side shell variable available to `pg_isready`.

We also configured:

```yaml
interval: 5s
timeout: 5s
retries: 5
start_period: 10s
```

`start_period: 10s` gives PostgreSQL ten seconds of startup grace before health-check failures begin counting against the retry threshold.

---

# 6. pgvector Verification

We verified that the image includes the extension before using it.

To check whether the extension is available:

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  exec postgres \
  psql -U nexus -d nexus \
  -c "SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name = 'vector';"
```

We found that vector was available.

Then we created it in the database:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

A later check of `pg_extension` confirmed that the extension was installed/available as expected for the database.

---

# 7. Backend Container

The backend container is responsible for running the FastAPI application.

Files:

```text
backend/
├── Dockerfile
└── entrypoint.sh
```

The container is designed to run as a **non-root user**.

The idea is:

```text
root user
   |
   X  avoid for application runtime
   |
   v
non-root application user
```

The non-root user is an application/runtime identity created for the container. It is not intended to be a normal human login account on the host machine.

Running as non-root limits what the backend process can do if the application is compromised.

---

# 8. Docker `ARG` in the Backend Dockerfile

We used a pattern like:

```dockerfile
ARG PYTHON_IMAGE=python:3.12-slim-bookworm
FROM ${PYTHON_IMAGE}
```

`ARG` is a **build-time variable**.

The important distinction is:

```text
ARG -> build time
ENV -> runtime environment
```

The reason for the `ARG` is to allow the base image to be supplied centrally by deployment configuration and CI instead of hardcoding the final image reference independently in every Dockerfile.

Conceptually:

```text
Compose / CI
     |
     v
PYTHON_IMAGE
     |
     v
Dockerfile ARG
     |
     v
FROM ${PYTHON_IMAGE}
```

Later the project intends to pin the final base image using an exact patch tag plus a SHA256 digest.

---

# 9. Docker Image Digest

An image tag such as:

```text
python:3.12-slim-bookworm
```

is a movable label.

A digest such as:

```text
sha256:...
```

identifies a specific image artifact.

A pinned reference looks conceptually like:

```text
python:3.12.x-slim-bookworm@sha256:...
```

This provides reproducibility:

```text
Developer A -> exact image artifact
Developer B -> exact image artifact
CI          -> exact image artifact
```

The trade-off is that useful future updates do not arrive automatically. An image update becomes an explicit, controlled change: review the new image, test it, then change the pinned reference.

---

# 10. Backend Entrypoint

File:

```text
backend/entrypoint.sh
```

Its role is to prepare the backend process before Uvicorn starts.

The intended sequence is:

```text
container starts
     |
     v
wait for PostgreSQL readiness
     |
     v
run Alembic migration in child process
     |
     v
start Uvicorn as the main process
```

The migration command is:

```bash
alembic upgrade head
```

This means:

> Apply all database migrations up to the latest migration known to Alembic.

Alembic tracks database schema evolution through migration files.

For example:

```text
revision A
    |
    v
revision B
    |
    v
revision C  <- head
```

When the application starts, `alembic upgrade head` brings the database schema to revision C.

The backend application developers define the SQLAlchemy models, while migrations represent the database changes that must be applied to existing databases.

---

# 11. `requirements.lock`

File:

```text
backend/requirements.lock
```

This is a resolved dependency lock file.

The dependency source is the project configuration (`pyproject.toml`), while the lock records the exact resolved dependency set used to build/install the backend.

The DevOps responsibility is to **consume the lock reproducibly** in the Docker build and CI. The application team owns dependency declarations and changes to the application dependency set.

---

# 12. Nginx Container

The Nginx image has two build stages:

```text
Node build stage
       |
       | npm ci + npm run build
       v
React dist/
       |
       v
Nginx runtime image
       |
       v
serve static files + reverse proxy
```

This means there is no separate frontend runtime container.

The selected architecture keeps the deployment lightweight by using Nginx as the final frontend-serving image.

---

# 13. Nginx Dockerfile

File:

```text
nginx/Dockerfile
```

It uses two image arguments:

```dockerfile
ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginx:1.27-alpine
```

The Node image is used only during the frontend build stage.

The Nginx image is the final runtime stage.

We learned an important Docker rule here:

> A build `ARG` has scope rules. If a later `FROM` uses an argument, that argument must be declared in the appropriate scope before that `FROM`.

This was the cause of the earlier error:

```text
base name (${NGINX_IMAGE}) should not be blank
```

We fixed it by declaring the image arguments before the relevant `FROM` instructions.

---

# 14. Nginx Base Image Verification

We pulled:

```bash
sudo docker pull nginx:1.27-alpine
```

The actual image we inspected contained:

```text
Nginx version: 1.27.5
nginx user: UID 101 / GID 101
```

We also verified:

```text
/usr/share/nginx/html -> exists
/tmp                  -> writable
```

and tested the stock Nginx configuration with:

```bash
sudo docker run --rm nginx:1.27-alpine nginx -t
```

which succeeded.

The digest observed for the image pulled during this work was:

```text
sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10
```

That value was observed from the actual pull during development; final project-wide digest pinning is a separate deliberate step.

---

# 15. Why Nginx Runs as `nginx`

The base image already contains:

```text
nginx user
UID 101
GID 101
```

Our runtime is therefore intended to be unprivileged.

That affects writable paths.

For example, the default Nginx configuration uses locations such as:

```text
/run/nginx.pid
/var/log/nginx/
/var/cache/nginx
```

which may not be writable by UID 101 without extra permissions.

We therefore changed the design to use writable paths under `/tmp` and send logs to Docker stdout/stderr.

---

# 16. `nginx.conf`

File:

```text
nginx/nginx.conf
```

This is the global Nginx configuration.

Its responsibilities include:

```text
worker configuration
PID location
HTTP defaults
MIME types
logging
gzip
temporary paths
loading conf.d/*.conf
```

Important choices:

### PID

```nginx
pid /tmp/nginx.pid;
```

The PID file is placed somewhere writable by the runtime user.

### Docker logs

```nginx
access_log /dev/stdout;
error_log /dev/stderr warn;
```

This follows the container logging model:

```text
Nginx -> stdout/stderr -> Docker logs
```

### Gzip

Gzip is enabled for appropriate text-based response types.

The project does not rely on Brotli because the selected Alpine Nginx image does not provide the required Brotli module.

### Temporary directories

Temporary paths are placed under `/tmp`:

```text
/tmp/client_temp
/tmp/proxy_temp
/tmp/fastcgi_temp
/tmp/uwsgi_temp
/tmp/scgi_temp
```

This avoids permission failures when Nginx runs unprivileged.

---

# 17. `nexus.conf`

File:

```text
nginx/conf.d/nexus.conf
```

This is application-specific routing.

It separates generic Nginx behavior (`nginx.conf`) from 1337 Nexus request routing.

The intended request flow is:

```text
Browser
   |
   v
Nginx
   |
   +--> /              -> React SPA
   |
   +--> /api/          -> backend:8000
   |
   +--> /health       -> backend
   |
   +--> /health/ready -> backend
   |
   +--> /socket.io/   -> backend + upgrade headers
   |
   +--> /media/       -> mounted media volume
   |
   +--> /api/v1/copilot/ask -> backend, SSE streaming
```

## SPA fallback

The configuration uses:

```nginx
try_files $uri $uri/ /index.html;
```

This is necessary for client-side React routing.

For example:

```text
https://localhost/dashboard
```

may not correspond to a physical `/dashboard` file. Nginx therefore falls back to `index.html`, and React Router handles the route.

## Backend proxying

Nginx uses the Docker service name:

```text
backend:8000
```

rather than a hardcoded container IP.

Docker's internal DNS resolves the service name.

This is more stable because container IP addresses can change when containers are recreated.

## Socket.IO

The `/socket.io/` route needs WebSocket upgrade headers so the realtime connection can pass through Nginx.

## SSE / Co-Pilot

The Co-Pilot streaming route disables proxy buffering:

```nginx
proxy_buffering off;
```

Without this, Nginx could buffer chunks and prevent the frontend from receiving incremental tokens promptly.

## Media

Nginx mounts the media volume read-only:

```yaml
- media_data:/media:ro
```

The backend owns media writes; Nginx only serves the files.

---

# 18. Nginx Entrypoint

File:

```text
nginx/entrypoint.sh
```

Its role is:

```text
read TLS values from environment
        |
        v
write certificate/key under /tmp
        |
        v
chmod 600
        |
        v
nginx -t
        |
        v
exec nginx -g 'daemon off;'
```

`exec` is important because it replaces the shell process with Nginx, so Nginx becomes the main container process and receives lifecycle signals correctly.

`daemon off;` keeps Nginx in the foreground, which is required for normal container operation.

---

# 19. TLS Environment Design

The project uses two environment values:

```text
TLS_CERT_PEM
TLS_KEY_PEM
```

The intended concept is:

```text
.env
  |
  | escaped, single-line representation
  v
Compose
  |
  v
Nginx entrypoint
  |
  | convert \n to real newlines
  v
/tmp/nginx/tls/tls.crt
/tmp/nginx/tls/tls.key
  |
  v
Nginx TLS configuration
```

This was an important debugging lesson.

A normal dotenv file expects a valid variable assignment. A multiline raw PEM pasted directly across physical lines can break dotenv parsing.

Therefore the environment representation must remain syntactically valid for Compose while the entrypoint reconstructs the real PEM file before Nginx starts.

The bootstrap script was adjusted after we discovered that the first implementation was incorrectly writing multiline PEM data into `.env` and caused:

```text
unexpected character "+" in variable name
```

The root cause was not the `+` itself; Base64 certificate/key data legitimately contains characters such as `+`. The real problem was that the generated PEM content had been written into `.env` in an invalid multiline representation.

---

# 20. `bootstrap.sh`

File:

```text
deploy/scripts/bootstrap.sh
```

This is intended to become the canonical first-run setup script.

The conceptual responsibilities are:

```text
1. Locate repository root
2. Ensure deploy/.env exists
3. Generate local TLS material if required
4. Put TLS values into .env
5. Validate Compose
6. Start the base stack
```

The script is designed to make first boot reproducible for team members.

It uses the explicit Compose file:

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml ...
```

rather than relying on Docker Compose's automatic discovery of default/override files.

---

# 21. Why `docker-compose.dev.yml` Is Separate

The project architecture intentionally keeps development additions in:

```text
deploy/docker-compose.dev.yml
```

instead of an automatically loaded override file.

The reason is safety.

A development file may intentionally expose the database port or change backend behavior. We do not want those development changes to silently alter the base deployment when someone runs:

```bash
docker compose up
```

The base configuration therefore remains explicit and controlled.

---

# 22. Compose Environment Variables

We learned that `.env.example` and `.env` serve different purposes.

## `.env.example`

Committed to Git.

Contains variable names and safe placeholders/default examples.

Example:

```env
POSTGRES_DB=nexus
POSTGRES_USER=nexus
POSTGRES_PASSWORD=CHANGE_ME
```

## `.env`

Local/private file.

Contains the real local secrets and values.

It should **not** be committed to Git.

The relationship is:

```text
.env.example
      |
      | copy
      v
.env
      |
      v
local secrets/configuration
```

---

# 23. Compose Validation

The command we use repeatedly is:

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  config
```

`config` does **not** start containers.

It asks Compose to:

```text
read .env
     +
read docker-compose.yml
     |
     v
substitute variables
     |
     v
render final configuration
     |
     v
validate
```

This is one of the safest ways to test Compose changes before deployment.

---

# 24. Docker Compose Topology

The final base topology is designed around three services:

```text
postgres
backend
nginx
```

All three share the dedicated network:

```text
nexus
```

The subnet is explicitly declared. During our work we used:

```text
172.28.0.0/24
```

The same subnet is supplied through:

```text
TRUSTED_PROXY_SUBNET
```

so the backend's trusted-proxy configuration has a fixed boundary.

---

# 25. `ports` vs `expose`

This distinction was important.

### `ports`

Publishes a container port to the host.

Example:

```yaml
ports:
  - "443:8443"
```

means:

```text
Host :443
   |
   v
Container :8443
```

### `expose`

Makes the port available to other containers on the Docker network without publishing it to the host.

Example:

```yaml
expose:
  - "8000"
```

means Nginx can reach:

```text
backend:8000
```

but the base Compose file does not create a direct host mapping for port 8000.

---

# 26. Networking and Service Names

Docker Compose provides internal DNS.

If the service is named:

```yaml
backend:
```

other containers can use:

```text
backend
```

as a hostname.

Therefore Nginx can use:

```nginx
server backend:8000;
```

and PostgreSQL is reachable as:

```text
postgres:5432
```

This is preferable to hardcoding container IP addresses.

---

# 27. Health and Readiness

We distinguished between:

```text
health check
```

and:

```text
application readiness
```

PostgreSQL's health check determines whether the database is accepting connections.

The backend startup process then waits for PostgreSQL before applying migrations.

Later, the backend exposes:

```text
/health
/health/ready
```

and Nginx proxies those endpoints so health can be checked through the same edge path used by real clients.

---

# 28. Team Git Workflow

Because there are five developers, we decided not to create one permanent branch per person.

The rule is:

> **A branch represents a piece of work, not a person.**

Example:

```text
main
 |
 +-- feature/nginx
 +-- feature/auth
 +-- feature/frontend
 +-- feature/database
 +-- feature/ai
```

When the Nginx task is complete:

```text
feature/nginx
      |
      v
Pull Request
      |
      v
CI
      |
      v
review
      |
      v
main
```

After merging, the feature branch can be deleted.

If the same developer later works on CI, they create:

```text
feature/ci
```

rather than keeping a permanent personal branch.

---

# 29. Current Team Responsibilities

The practical division discussed was approximately:

```text
DevOps
├── Dockerfiles
├── Nginx
├── Compose
├── deployment
├── CI/CD
├── operational scripts
└── infrastructure documentation

Backend developers
├── FastAPI application
├── SQLAlchemy models
├── Alembic migrations
├── API/domain logic
└── backend tests

Frontend developers
├── React application
├── package.json
├── package-lock.json
├── UI/features
└── frontend tests

AI developer
├── Co-Pilot workflows
├── RAG/retrieval
├── embeddings
├── AI provider integration
├── background AI work
└── corpus ingestion
```

The AI developer's work crosses both application logic and supporting AI infrastructure; the final source layout is an application architecture decision, not a Docker responsibility.

---

# 30. What Is Complete vs. Dependent on Application Code

## Infrastructure work completed or substantially established

```text
PostgreSQL container                ✅
pgvector availability               ✅
PostgreSQL tuning                   ✅
Persistent database volume          ✅
PostgreSQL health check             ✅

Backend Dockerfile                  ✅
Backend non-root runtime            ✅
Backend entrypoint structure        ✅

Nginx Dockerfile                    ✅
Nginx image verification            ✅
Nginx global configuration          ✅
Nginx application routing           ✅
Nginx non-root structure             ✅
Nginx TLS entrypoint                ✅

Compose three-service topology      ✅
Dedicated network                   ✅
Only Nginx host publication         ✅
Environment-variable structure     ✅
Bootstrap concept                   ✅
```

## Still dependent on the application team / later integration

```text
Final FastAPI source implementation     ⏳
Final React source implementation        ⏳
Frontend package.json + lockfile         ⏳
SQLAlchemy application models            ⏳
First complete Alembic revision          ⏳
Application database roles               ⏳
Full application health behavior         ⏳
End-to-end Nginx -> backend testing      ⏳
Final image digest pinning               ⏳
Complete CI workflow                     ⏳
Backup/restore operational validation   ⏳
```

Therefore the infrastructure work is well advanced, but the project's Foundation phase is not considered fully finished until the real application can run through the infrastructure and the required validation succeeds.

---

# 31. Useful Commands Learned

## Validate Compose

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  config
```

## Start PostgreSQL only

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  up -d postgres
```

## Show service status

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  ps
```

## View logs

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  logs postgres
```

## Open PostgreSQL shell through Compose

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  exec postgres \
  psql -U nexus -d nexus
```

## Validate Nginx configuration inside an image

```bash
sudo docker run --rm nginx:1.27-alpine nginx -t
```

## Inspect Nginx user

```bash
sudo docker run --rm nginx:1.27-alpine id nginx
```

## Build the Nginx image

```bash
sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  build nginx
```

## Check Git status

```bash
git status --short
```

## Create a feature branch

```bash
git checkout -b feature/nginx
```

---

# 32. Important Troubleshooting Lessons

## Compose says a variable is not set

Example:

```text
The "PYTHON_IMAGE" variable is not set.
```

Check the real file:

```bash
grep -E '^[A-Za-z_][A-Za-z0-9_]*=' deploy/.env | cut -d= -f1
```

Do not print the complete `.env` if it contains secrets.

## `.env` reports `unexpected character "+"`

This occurred during TLS generation.

The problem was malformed multiline PEM data in `.env`, not the plus sign itself.

The solution is to keep each environment variable syntactically valid and reconstruct the PEM file inside the Nginx container.

## Docker says an `ARG` is blank in `FROM`

Example:

```text
base name (${NGINX_IMAGE}) should not be blank
```

Check the scope and location of the `ARG` declaration. A `FROM` that uses an `ARG` must have that argument available in the appropriate build scope before the `FROM` is processed.

## Nginx build says `frontend/package-lock.json` not found

This does not necessarily mean the Nginx Dockerfile is wrong.

The multi-stage image intentionally builds the React application. Therefore it requires the frontend project files:

```text
frontend/package.json
frontend/package-lock.json
frontend/src/...
```

If those files have not yet been supplied by the frontend team, the final Nginx image cannot be built completely.

---

# 33. Mental Model to Remember

When working on this project, keep these layers separate:

```text
APPLICATION CODE
    |
    v
Backend / Frontend / AI
    |
    v
CONTAINERS
    |
    v
Dockerfiles
    |
    v
COMPOSE
    |
    v
NETWORK + VOLUMES + ENVIRONMENT
    |
    v
HOST
```

Nginx is the edge of the application:

```text
Browser
   |
 HTTPS
   v
Nginx
   |
   +---- static React
   |
   +---- API ----> Backend
   |
   +---- Socket.IO -> Backend
   |
   +---- SSE ------> Backend
   |
   +---- media ----> volume
```

PostgreSQL is the persistent data layer:

```text
Backend
   |
   v
PostgreSQL
   |
   +--> relational data
   |
   +--> pgvector embeddings
```

Docker Compose is the piece that connects these components into one reproducible local deployment.

---

# 34. Where We Continue

The next major DevOps task is the GitHub Actions workflow:

```text
.github/workflows/ci.yml
```

The purpose is to automatically validate changes from feature branches before they are merged into `main`.

The eventual CI flow is:

```text
feature branch
      |
      v
Pull Request
      |
      v
GitHub Actions
      |
      +--> backend checks
      +--> frontend checks
      +--> Docker checks
      +--> Compose validation
      |
      v
review
      |
      v
main
```

The complete CI workflow depends on the actual backend/frontend application files, so the workflow can be established incrementally as the application team delivers them.

---

# 35. Key Concepts to Remember

### Container vs image

```text
Image     = blueprint/package
Container = running instance of an image
```

### Volume vs container

```text
Container -> disposable
Volume    -> persistent data
```

### `ARG` vs `ENV`

```text
ARG -> build time
ENV -> runtime
```

### Tag vs digest

```text
Tag     -> movable label
Digest  -> exact image artifact identity
```

### `ports` vs `expose`

```text
ports  -> host publication
expose -> container/network visibility
```

### `docker compose config`

```text
Validate/render configuration
without starting containers
```

### Health check vs readiness

```text
Health check -> process/service is responding
Readiness    -> application is ready for real work
```

### Branch vs developer

```text
Branch = task/workstream
Developer = person
```

### Nginx vs backend

```text
Nginx    -> edge, TLS, static files, routing
Backend  -> application/business/API logic
```

---

## Final Reminder

The DevOps layer is designed to be **reproducible, bounded, explicit and safe**:

```text
explicit images
explicit environment
explicit network
persistent volumes
non-root containers
health checks
controlled startup
centralized routing
Git-based review
```

When something breaks, first identify which layer is responsible:

```text
Code?
Dockerfile?
Compose?
Environment?
Network?
Volume?
Nginx?
Database?
CI?
```

That separation makes troubleshooting much faster and prevents application problems from being mistaken for infrastructure problems.
