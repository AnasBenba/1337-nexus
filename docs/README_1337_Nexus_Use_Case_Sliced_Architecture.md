# 1337 Nexus - Repository Architecture Guide

> **Architecture style:** Flow-oriented / use-case-sliced monorepo
>
> This README explains what each directory and important file in the repository is responsible for, and how the structure follows the application's user journeys: Landing -> Authentication -> Role -> Admin/User Dashboard -> Feature workflows.

---

## 1. Repository at a glance

```text
1337-nexus/
├── backend/                 # FastAPI backend application
├── frontend/                # React/Vite frontend application
├── nginx/                   # Edge server and reverse proxy
├── deploy/                  # Docker Compose, database config, operational scripts
├── docs/                    # Project documentation
├── .github/                 # GitHub workflow and repository automation
├── .gitignore               # Files Git must not track
├── .dockerignore            # Files Docker must not send into build context
├── .editorconfig            # Shared editor formatting rules
├── Makefile                 # Common developer/DevOps commands
└── README.md                # Main project documentation
```

The repository is split into two broad concerns:

```text
Application code
    ├── backend/
    └── frontend/

Infrastructure / delivery
    ├── nginx/
    ├── deploy/
    └── .github/
```

The application code is further organized around **user flows and use cases**, rather than placing every router, service, and repository into global technical folders.

---

# 2. Backend

```text
backend/
├── app/
├── alembic/
├── content/
├── tests/
├── pyproject.toml
├── requirements.lock
├── Dockerfile
└── entrypoint.sh
```

## 2.1 `backend/`

Contains everything needed to develop, test, migrate, and package the FastAPI backend.

The backend is a modular monolith: one application process contains the product's API, real-time features, background jobs, and business workflows.

---

## 2.2 `backend/app/`

This is the actual Python application package.

```text
backend/app/
├── main.py
├── api.py
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

The important idea is that `app/` contains both:

1. cross-cutting infrastructure used by the application, and
2. business workflows grouped according to what the user or operator is trying to do.

---

# 3. Backend application entry points

## `backend/app/main.py`

The application's top-level ASGI entry point.

It is responsible for exposing the object that the ASGI server (Uvicorn) actually serves.

Typical responsibilities:

- construct or obtain the FastAPI application;
- attach the Socket.IO ASGI application where required;
- expose the final ASGI callable used by the container.

Think of it as:

```text
Uvicorn
   ↓
main.py
   ↓
application
```

---

## `backend/app/api.py`

Application assembly / composition point.

Typical responsibilities:

- create the FastAPI application;
- register routers from the different workflows;
- configure middleware order;
- configure the application's lifespan/startup/shutdown behavior;
- set OpenAPI metadata.

It answers:

> **How are all of the backend features assembled into one FastAPI application?**

---

# 4. `backend/app/core/`

```text
core/
├── config.py
├── db.py
├── security.py
├── errors.py
├── middleware.py
├── logging.py
└── uow.py
```

`core/` contains infrastructure that is shared by many or all workflows.

It should not become a place for product-specific business logic.

---

## `core/config.py`

Central application settings.

Contains the definitions used to load and validate configuration such as:

- database connection settings;
- JWT/CSRF/encryption secrets;
- cookie behavior;
- CORS configuration;
- trusted proxy settings;
- AI provider configuration;
- media paths;
- plan-set limits and other operational settings.

The distinction is important:

```text
.env
  ↓
configuration values
  ↓
config.py
  ↓
validated application settings
```

It should not contain actual secret values committed to Git.

---

## `core/db.py`

Database infrastructure.

Responsible for things such as:

- creating the SQLAlchemy async engine;
- creating the session factory;
- database connection/pool settings;
- shared database lifecycle helpers.

Business queries do not belong here.

---

## `core/security.py`

Reusable security primitives.

Examples of responsibilities:

- password hashing/verification;
- JWT creation and verification;
- session cookie construction;
- CSRF token generation/verification;
- cryptographic helper functions.

Use cases call these helpers; they do not reimplement cryptography themselves.

---

## `core/errors.py`

Defines the application's standardized error model.

Responsibilities include:

- domain/application exception types;
- mapping known failures to HTTP status codes;
- the common JSON error envelope;
- global exception handlers.

The goal is that different workflows return errors in the same format.

---

## `core/middleware.py`

Application middleware.

Examples:

- request ID assignment;
- CORS handling;
- error-envelope wrapping;
- rate limiting;
- CSRF protection.

Middleware is cross-cutting behavior, so it stays outside individual use-case directories.

---

## `core/logging.py`

Structured application logging.

Responsible for:

- JSON log formatting;
- request/context fields;
- log redaction rules;
- preventing sensitive values from appearing in logs.

Infrastructure services can log independently, but application logging rules belong here.

---

## `core/uow.py`

Unit of Work infrastructure.

The Unit of Work coordinates database work across a workflow so that multiple operations can succeed or fail as one transaction.

For example:

```text
Accept application
   ↓
update application
   ↓
create team
   ↓
create board
   ↓
create channel
   ↓
award XP
   ↓
create notification
   ↓
COMMIT ONCE
```

This is infrastructure for coordinating a workflow, not a specific feature.

---

# 5. Backend user flows

## `backend/app/flows/`

```text
flows/
├── landing/
├── authentication/
└── role-selection/
```

This directory represents the initial application journey before the user reaches the admin or normal-user areas.

The conceptual flow is:

```text
Landing
   ↓
Authentication
   ↓
Role selection / resolution
   ↓
Admin or User experience
```

---

## `flows/landing/`

```text
landing/
├── router.py
├── schemas.py
└── service.py
```

### `router.py`
Defines HTTP routes exposed for the landing/public entry experience.

### `schemas.py`
Defines request/response validation models used by the landing workflow.

### `service.py`
Contains the business/application logic for landing-related operations.

---

# 6. Authentication

```text
flows/authentication/
├── login/
├── oauth/
├── refresh-session/
└── logout/
```

Authentication is a parent workflow containing several distinct use cases.

---

## `authentication/login/`

```text
login/
├── router.py
├── schemas.py
├── service.py
└── repository.py
```

### `router.py`
Receives the login request and returns the login response.

### `schemas.py`
Validates login input and output data.

### `service.py`
Contains the login process itself: validation, credential verification, session issuance, and related rules.

### `repository.py`
Contains database access needed specifically by the login workflow.

---

## `authentication/oauth/`

Handles OAuth-related login flows.

The directory contains the same basic separation:

```text
router.py       # HTTP endpoints
schemas.py      # request/response structures
service.py      # OAuth workflow
repository.py   # persistence queries
```

Providers such as 42 or Google are integrated here or through provider-specific support used by the service.

---

## `authentication/refresh-session/`

Handles refresh-token/session renewal.

Typical responsibilities:

- validate the refresh token;
- rotate session credentials when required;
- revoke or reject invalid/reused sessions;
- persist session state.

---

## `authentication/logout/`

The logout use case.

It typically invalidates the current session/family and clears authentication cookies.

It needs only the files it actually requires; use-case slices do not have to contain a repository if they do not need direct persistence access.

---

## `flows/role-selection/`

```text
role-selection/
├── service.py
└── schemas.py
```

Responsible for resolving or presenting the user's application role after authentication.

Conceptually:

```text
Authenticated user
       ↓
resolve role / scope
       ↓
Admin experience OR User experience
```

---

# 7. Admin workflows

## `backend/app/admin/`

The administrator experience mirrors the Admin Dashboard in the user-flow diagram.

```text
admin/
├── dashboard/
├── users/
├── projects/
├── campuses/
├── moderation/
└── configuration/
```

An administrator therefore navigates from:

```text
Admin Dashboard
 ├── Users
 ├── Projects
 ├── Campuses
 ├── Moderation
 └── Configuration
```

---

## `admin/dashboard/`

```text
dashboard/
├── router.py
├── schemas.py
└── service.py
```

Builds the data needed by the administrator's dashboard: counts, summaries, recent activity, or other dashboard-specific information.

---

# 8. Admin user-management workflows

```text
admin/users/
├── list-users/
├── view-user/
├── manage-user/
└── suspend-user/
```

Each directory is a separate use case.

### `list-users/`
Lists users visible to the administrator's allowed scope.

### `view-user/`
Retrieves the details needed to view one user.

### `manage-user/`
Handles administrative user-management actions that are distinct from suspension.

### `suspend-user/`
Implements the suspension workflow.

A use-case slice normally contains the smallest set of files needed by that operation, for example:

```text
router.py      # endpoint
schemas.py     # data contract
service.py     # workflow logic
repository.py  # database access, when needed
```

---

# 9. Admin project workflows

```text
admin/projects/
├── view-projects/
├── review-project/
├── moderate-project/
└── feature-project/
```

These correspond to administrator actions against project/pitch content.

- `view-projects/` - retrieve administrator-visible projects.
- `review-project/` - inspect project information as part of review.
- `moderate-project/` - moderation actions.
- `feature-project/` - feature/promote a project according to the product rules.

---

# 10. Admin campus workflows

```text
admin/campuses/
├── view-campus/
├── create-campus/
└── manage-campus/
```

These handle administration of campus entities.

- `view-campus/` - retrieve campus information.
- `create-campus/` - create a campus.
- `manage-campus/` - modify/manage an existing campus.

---

# 11. Admin moderation

```text
admin/moderation/
├── flags/
└── reports/
```

These are operator-facing moderation workflows.

- `flags/` - work with content flags/moderation flags.
- `reports/` - retrieve or process moderation/report information.

---

# 12. Admin configuration

```text
admin/configuration/
├── platform-settings/
└── system-settings/
```

Separates settings that affect product behavior from settings that affect system/deployment behavior.

---

# 13. Normal user workflows

## `backend/app/user/`

This directory corresponds to the **Normal User Dashboard** in the diagram.

```text
user/
├── dashboard/
├── projects/
├── opportunities/
├── messages/
├── copilot/
├── quick-actions/
└── profile/
```

Conceptually:

```text
User Dashboard
 ├── Projects
 ├── Opportunities
 ├── Messages
 ├── Co-Pilot
 ├── Quick Actions
 └── Profile
```

---

## `user/dashboard/`

```text
dashboard/
├── router.py
├── schemas.py
└── service.py
```

Builds the normal user's dashboard view.

For example, it can aggregate:

- recent projects;
- recommendations;
- opportunities;
- notification summaries;
- quick actions.

---

# 14. User project workflows

```text
user/projects/
├── my-projects/
├── recommended-projects/
├── create-project/
├── edit-project/
├── publish-project/
├── archive-project/
└── refine-project/
```

This is where project creation and lifecycle actions live.

### `my-projects/`
Retrieves the user's projects.

### `recommended-projects/`
Retrieves project recommendations for the user.

### `create-project/`
Creates a new project/pitch.

### `edit-project/`
Updates an existing project.

### `publish-project/`
Moves a project into its published state.

### `archive-project/`
Archives a project.

### `refine-project/`
An AI-assisted project refinement workflow. This is one place where the AI developer contributes directly to a user-facing use case.

---

# 15. User opportunities

```text
user/opportunities/
├── browse-opportunities/
├── view-opportunity/
├── apply/
└── withdraw-application/
```

These represent actions a user takes when looking for team/project opportunities.

- `browse-opportunities/` - browse available opportunities.
- `view-opportunity/` - inspect one opportunity.
- `apply/` - submit an application.
- `withdraw-application/` - withdraw an existing application.

---

# 16. User messaging

```text
user/messages/
├── team-chat/
├── direct-message/
└── notifications/
```

These directories represent user-facing communication features.

Real-time transport itself is handled by `app/realtime/`; these use-case directories contain the product workflow around communication.

---

# 17. User Co-Pilot / AI

## `user/copilot/`

```text
copilot/
├── ask/
├── retrieve-curriculum/
├── threads/
└── cancel-job/
```

This is the main user-facing AI area.

### `ask/`
The user asks the Co-Pilot a question.

The workflow can be thought of as:

```text
User question
   ↓
validate request
   ↓
authorize thread/team access
   ↓
retrieve relevant context
   ↓
call AI provider
   ↓
stream response
   ↓
persist result
```

### `retrieve-curriculum/`
Handles curriculum retrieval functionality used by the Co-Pilot/RAG path.

### `threads/`
Handles creation/retrieval of Co-Pilot conversation threads.

### `cancel-job/`
Allows a user to cancel a running AI job when the workflow supports cancellation.

---

# 18. AI shared infrastructure

## `backend/app/shared/ai/`

```text
shared/ai/
├── provider.py
├── client.py
├── embeddings.py
├── tokenizer.py
└── stub.py
```

This is **not** a user flow. It contains reusable AI infrastructure used by several AI workflows.

### `provider.py`
Defines the provider-facing abstraction/interface.

The rest of the application should depend on the interface rather than a particular vendor implementation.

### `client.py`
Handles communication with the configured external AI service.

### `embeddings.py`
Handles embedding generation needed by RAG/retrieval workflows.

### `tokenizer.py`
Provides token counting/sizing support for chunking and prompt budgets.

### `stub.py`
Deterministic fake/stub provider for tests, local development, and operation without a real AI credential.

So the separation is:

```text
user/copilot/
    ↓
WHAT the user is doing

shared/ai/
    ↓
HOW the application communicates with AI
```

---

# 19. Teams

## `backend/app/teams/`

```text
teams/
├── create-team/
├── invite-member/
├── accept-member/
└── remove-member/
```

These are team-management use cases.

They may be triggered by recruitment workflows or workspace workflows, but each is an explicit operation.

---

# 20. Collaboration

## `backend/app/collaboration/`

```text
collaboration/
├── board/
├── canvas/
└── chat/
```

This groups use cases around the actual collaborative workspace.

---

## `collaboration/board/`

```text
board/
├── create-board/
├── create-column/
├── move-card/
└── delete-column/
```

Examples:

- `create-board/` - create the board for a workspace.
- `create-column/` - create a Kanban column.
- `move-card/` - update a card's authoritative ordering.
- `delete-column/` - remove a column according to its business constraints.

---

## `collaboration/canvas/`

```text
canvas/
├── join-canvas/
├── send-update/
└── compact-document/
```

These represent collaboration operations on the Yjs-based canvas.

- `join-canvas/` - join/load the collaborative document.
- `send-update/` - submit/relay a document update.
- `compact-document/` - compact persisted update history when required.

---

## `collaboration/chat/`

```text
chat/
├── send-team-message/
├── send-direct-message/
├── mark-message-read/
└── reconnect/
```

These are messaging use cases. Realtime transport is provided by the `realtime/` infrastructure.

---

# 21. Integrations

## `backend/app/integrations/`

```text
integrations/
└── github/
    ├── refresh-activity/
    └── view-activity/
```

Integration-specific workflows live here.

### `refresh-activity/`
Refreshes GitHub-derived activity according to the application's polling rules.

### `view-activity/`
Returns the cached activity to users.

The integration implementation should remain isolated from the user-interface folders so it can be reused by different workflows.

---

# 22. Gamification

## `backend/app/gamification/`

```text
gamification/
├── view-xp/
├── view-badges/
└── view-leaderboard/
```

Contains user-facing gamification queries/workflows.

- `view-xp/` - retrieve XP information.
- `view-badges/` - retrieve earned/available badges.
- `view-leaderboard/` - retrieve leaderboard information.

---

# 23. Realtime infrastructure

## `backend/app/realtime/`

```text
realtime/
├── server.py
├── auth.py
├── presence.py
├── rooms.py
└── validation.py
```

This is infrastructure for WebSocket/Socket.IO communication.

### `server.py`
Creates/configures the Socket.IO server and registers namespaces/events.

### `auth.py`
Authenticates realtime connections and manages socket-level authentication/expiry rules.

### `presence.py`
Tracks online/presence state in the single backend process.

### `rooms.py`
Handles room naming and membership management.

### `validation.py`
Validates realtime event payloads and realtime-specific limits.

This directory is intentionally separate from the use cases because realtime transport is a **mechanism** used by several features.

---

# 24. Background jobs

## `backend/app/jobs/`

```text
jobs/
├── worker.py
├── registry.py
└── scheduler.py
```

This is execution infrastructure for deferred/background work.

### `worker.py`
Runs the background worker loop.

Responsibilities include claiming jobs, handling retries/leases, enforcing concurrency, and graceful shutdown.

### `registry.py`
Maps job kinds to the executor that knows how to perform them.

### `scheduler.py`
Schedules recurring or deferred operations such as integration refreshes.

The job system executes work; the actual business behavior remains in the owning use case/service.

---

# 25. Shared application utilities

## `backend/app/shared/`

```text
shared/
├── models.py
├── pagination.py
└── ai/
```

Contains genuinely reusable application primitives that do not belong to one use case.

### `models.py`
Shared ORM/base model definitions and reusable model mixins.

### `pagination.py`
Shared pagination helpers, such as cursor/keyset pagination utilities.

### `ai/`
Reusable AI infrastructure described above.

A good rule is:

> Put something in `shared/` only when multiple areas genuinely need the same abstraction.

Do not turn `shared/` into a dumping ground for unrelated code.

---

# 26. CLI tools

## `backend/app/cli/`

```text
cli/
├── seed.py
├── ingest_subjects.py
├── export_openapi.py
└── admin.py
```

These are operator/developer commands, not web routes.

### `seed.py`
Creates controlled seed/demo data when enabled.

### `ingest_subjects.py`
Ingests curriculum/subject content and prepares it for retrieval, including chunking and embedding/indexing work.

This is especially relevant to the AI/RAG workflow.

### `export_openapi.py`
Exports the backend OpenAPI document for generation of frontend API types.

### `admin.py`
Provides explicit operator/admin commands for system administration tasks.

---

# 27. Alembic

## `backend/alembic/`

```text
alembic/
├── env.py
├── script.py.mako
└── versions/
```

This directory contains database migration infrastructure.

### `env.py`
Connects Alembic to the application's database configuration and migration metadata.

### `script.py.mako`
Template used when creating migration revisions.

### `versions/`
Contains the actual migration revision files.

A migration revision is code that describes a database schema change over time.

---

# 28. Backend content

## `backend/content/subjects/`

Stores controlled curriculum/subject source content used by ingestion and RAG workflows.

This is application data/content rather than Python application logic.

---

# 29. Backend tests

## `backend/tests/`

```text
tests/
├── unit/
├── integration/
├── realtime/
├── crdt/
└── conftest.py
```

### `unit/`
Tests small pieces of business logic in isolation.

Examples include ranking, security, scope, chunking, and matching behavior.

### `integration/`
Tests workflows through the real application and database boundaries.

### `realtime/`
Tests Socket.IO/WebSocket behavior using real connections.

### `crdt/`
Tests interoperability between the Python CRDT implementation and the JavaScript/Yjs side.

### `conftest.py`
Contains shared pytest fixtures such as database and application test setup.

---

# 30. Backend dependency and container files

## `backend/pyproject.toml`

The primary Python project/dependency configuration.

Contains:

- Python dependency constraints;
- tooling configuration;
- lint/type/test configuration;
- package metadata;
- architecture/import contracts where required.

It is the source declaration for Python dependencies.

---

## `backend/requirements.lock`

The resolved/locked Python dependency set.

It records the exact packages/artifacts that the Docker build and CI should install.

Conceptually:

```text
pyproject.toml
     ↓
resolve dependencies
     ↓
requirements.lock
     ↓
frozen installation
```

---

## `backend/Dockerfile`

Builds the backend runtime container.

It is responsible for things such as:

- selecting the Python base image through a build argument;
- installing locked Python dependencies;
- copying the backend source;
- creating/using a non-root runtime user;
- configuring the runtime environment.

It describes **how the backend image is built**.

---

## `backend/entrypoint.sh`

The backend container startup script.

Conceptual flow:

```text
Container starts
     ↓
wait for PostgreSQL
     ↓
run Alembic migration
     ↓
drop migration-only credentials/context
     ↓
exec Uvicorn
```

It describes **what happens immediately before the backend server runs**.

---

# 31. Frontend

```text
frontend/
├── src/
├── package.json
├── package-lock.json
├── vite.config.ts
├── vitest.setup.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── eslint.config.js
├── .prettierrc
└── components.json
```

The frontend mirrors the user-flow concept on the browser side.

---

# 32. Frontend application shell

## `frontend/src/app/`

```text
app/
├── App.tsx
├── main.tsx
└── routes/
```

### `App.tsx`
Top-level React application component.

### `main.tsx`
Browser entry point. Mounts React and application-wide providers such as routing, query management, theme, and notifications.

### `routes/`
Maps URLs/routes to the corresponding frontend flows/screens.

---

# 33. Frontend flows

## `frontend/src/flows/`

```text
flows/
├── landing/
├── authentication/
├── admin/
└── user/
```

This mirrors the user journey shown in the diagram.

---

## `flows/landing/`

```text
landing/
├── components/
└── pages/
```

- `components/` - reusable UI pieces specifically needed by the landing experience.
- `pages/` - full-page views/screens.

---

## `flows/authentication/`

```text
authentication/
├── login/
├── oauth/
└── callback/
```

Contains UI for authentication actions.

- `login/` - login UI and behavior.
- `oauth/` - provider login initiation.
- `callback/` - OAuth callback handling in the browser.

---

# 34. Frontend admin flows

## `flows/admin/`

```text
admin/
├── dashboard/
├── users/
├── projects/
├── campuses/
├── moderation/
└── configuration/
```

These map directly to the Admin Dashboard sections.

Inside each area, components/pages/hooks can be placed according to the complexity of that feature.

---

# 35. Frontend user flows

## `flows/user/`

```text
user/
├── dashboard/
├── projects/
├── opportunities/
├── messages/
├── copilot/
├── notifications/
├── quick-actions/
└── profile/
```

These correspond directly to the normal user's dashboard and navigation.

---

# 36. Frontend Co-Pilot

## `flows/user/copilot/`

```text
copilot/
├── ask/
├── threads/
└── components/
```

### `ask/`
UI for submitting questions and receiving the streamed answer.

### `threads/`
UI for displaying/managing conversation threads.

### `components/`
Co-Pilot-specific visual components that are shared between the screens.

---

# 37. Frontend shared components

## `frontend/src/components/`

```text
components/
├── ui/
└── layout/
```

### `ui/`
Generic UI building blocks such as buttons, dialogs, inputs, cards, and other shared primitives.

### `layout/`
Application-wide structural components such as the sidebar, top bar, shells, grids, rows, and theme/layout components.

These should be genuinely reusable rather than feature-specific.

---

# 38. Frontend libraries

## `frontend/src/lib/`

```text
lib/
├── api-client.ts
├── socket.ts
├── sse-client.ts
├── query-client.ts
└── utils.ts
```

### `api-client.ts`
Shared HTTP/API communication layer, including cross-cutting concerns such as CSRF handling and authentication refresh behavior.

### `socket.ts`
Socket.IO clients and reconnection behavior.

### `sse-client.ts`
Reads Server-Sent Event streams from the Co-Pilot endpoint.

### `query-client.ts`
Configures TanStack Query and shared query defaults/invalidation behavior.

### `utils.ts`
Small reusable frontend utility functions.

---

# 39. Frontend state and types

## `frontend/src/stores/`

Zustand stores for client-side UI state and other state that is intentionally modeled locally.

Examples include UI state, presence projections, and composer drafts.

---

## `frontend/src/types/api.d.ts`

Generated TypeScript definitions based on the backend OpenAPI contract.

The intended flow is:

```text
FastAPI
   ↓
OpenAPI
   ↓
openapi-typescript
   ↓
api.d.ts
   ↓
Frontend
```

This prevents manually maintaining duplicate API types.

---

# 40. Frontend configuration files

## `package.json`

Declares frontend dependencies and project scripts.

## `package-lock.json`

Locks the dependency resolution used by `npm ci`.

## `vite.config.ts`

Vite configuration, including plugins, aliases, development HTTPS/proxy behavior, and test integration.

## `vitest.setup.ts`

Test setup shared by Vitest tests.

## `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`

TypeScript configuration for the application/build tooling.

## `eslint.config.js`

Frontend linting configuration.

## `.prettierrc`

Formatting configuration.

## `components.json`

Configuration for the shadcn/ui component generation workflow.

---

# 41. Nginx

```text
nginx/
├── Dockerfile
├── entrypoint.sh
├── nginx.conf
└── conf.d/
    └── nexus.conf
```

Nginx is the edge container. It is not application business logic.

---

## `nginx/Dockerfile`

Builds the final Nginx image.

The build is multi-stage:

```text
Node build stage
    ↓
build React application
    ↓
dist/
    ↓
Nginx runtime stage
    ↓
serve static files
```

It also copies the Nginx configuration and entrypoint script into the final image.

---

## `nginx/entrypoint.sh`

Runs when the Nginx container starts.

Its project-specific role includes:

- read TLS certificate/key values from the environment;
- materialize them as files owned by the runtime user;
- apply restrictive permissions;
- validate the Nginx configuration;
- start Nginx in the foreground.

---

## `nginx/nginx.conf`

Global Nginx configuration.

Typical responsibilities:

- worker configuration;
- PID location;
- event settings;
- HTTP defaults;
- access/error logs;
- gzip;
- writable temporary paths;
- loading configuration from `conf.d/`.

---

## `nginx/conf.d/nexus.conf`

Application-specific routing.

This is where requests are directed to the appropriate destination:

```text
/                       → React SPA
/api/                   → FastAPI
/health                 → FastAPI
/health/ready           → FastAPI
/socket.io/             → FastAPI / Socket.IO
/media/                 → media volume
Co-Pilot SSE route      → FastAPI, buffering disabled
```

It also contains HTTPS/server behavior and security headers.

---

# 42. Deployment

## `deploy/`

```text
deploy/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── postgres/
│   └── postgresql.conf
└── scripts/
    ├── bootstrap.sh
    ├── seed.sh
    ├── backup.sh
    └── perf-smoke.sh
```

This directory controls how the application is assembled and operated as containers.

---

## `deploy/docker-compose.yml`

The base container topology.

It defines:

```text
Nginx
Backend
PostgreSQL
```

and their:

- network;
- environment variables;
- health checks;
- volumes;
- memory limits;
- build arguments;
- dependencies;
- host port exposure.

The design keeps Nginx as the externally published edge service while backend/PostgreSQL remain reachable through the Docker network.

---

## `deploy/docker-compose.dev.yml`

Opt-in development additions.

For example, this can add development conveniences such as backend reload behavior or an intentionally exposed database port.

It is kept separate so the base Compose topology remains the secure/default deployment.

---

# 43. Deployment environment

## `deploy/.env.example`

The committed template showing which environment variables the project expects.

It contains safe placeholder values, not real secrets.

Typical categories include:

- PostgreSQL configuration;
- backend database URLs;
- proxy subnet;
- image references;
- TLS variables;
- API/provider settings.

---

## `deploy/.env`

The local real environment file.

Contains actual local values and secrets.

It must not be committed to Git.

The relationship is:

```text
.env.example
    ↓
copy
    ↓
.env
    ↓
fill real local values
```

---

# 44. PostgreSQL deployment configuration

## `deploy/postgres/postgresql.conf`

Contains the PostgreSQL runtime settings chosen for the project's resource budget.

Examples from the current configuration include:

```text
max_connections = 40
shared_buffers = 256MB
work_mem = 8MB
maintenance_work_mem = 128MB
autovacuum_max_workers = 2
```

This file controls PostgreSQL runtime behavior; it does not define application tables.

Tables/schema are created through application migrations.

---

# 45. Operational scripts

## `deploy/scripts/bootstrap.sh`

Canonical first-run setup script.

Its responsibilities include preparing local secrets/TLS and bringing the stack into a usable initial state.

---

## `deploy/scripts/seed.sh`

Convenience wrapper for invoking application seed functionality.

It should call the backend's seed CLI rather than contain business seed logic itself.

---

## `deploy/scripts/backup.sh`

Creates the project's database/media backup according to the documented backup procedure.

It is an operational tool, not application business logic.

---

## `deploy/scripts/perf-smoke.sh`

Runs the project's bounded performance/memory smoke measurement and records its result artifact.

---

# 46. Documentation

## `docs/`

```text
docs/
├── architecture.md
├── api.md
├── operations.md
├── frontend.md
└── design-system.md
```

### `architecture.md`
Explains system structure, containers, application boundaries, major design choices, and flows.

### `api.md`
Documents API behavior that goes beyond the generated OpenAPI document, including realtime/SSE conventions where needed.

### `operations.md`
Operational runbook: boot, shutdown, backup, restore, pruning, ingestion, dependency updates, etc.

### `frontend.md`
Frontend architecture, generated artifacts, component workflow, and frontend-specific conventions.

### `design-system.md`
UI design-system conventions and component/token rules.

---

# 47. GitHub automation

## `.github/`

```text
.github/
├── CODEOWNERS
└── workflows/
    └── ci.yml
```

## `.github/CODEOWNERS`

Defines which team members/teams should review changes to particular areas of the repository.

Example ownership areas:

```text
/nginx/       → DevOps
/deploy/      → DevOps
/backend/     → Backend team
/frontend/    → Frontend team
```

The exact usernames should be replaced with your real GitHub accounts.

---

## `.github/workflows/ci.yml`

Continuous Integration workflow.

It eventually becomes the automated quality gate for pull requests and protected branches.

Typical jobs include:

- backend linting;
- backend type checks;
- backend tests;
- frontend linting/type checks/tests;
- CRDT interoperability checks;
- OpenAPI generation/diff check;
- design-system checks;
- Compose smoke build/start checks.

---

# 48. Repository hygiene files

## `.gitignore`

Tells Git what should remain untracked.

Examples:

- `.env`;
- Python caches;
- `node_modules/`;
- build outputs;
- IDE files;
- logs/temp files.

This protects the repository from accidentally committing generated/local material and secrets.

---

## `.dockerignore`

Tells Docker what not to send as part of the build context.

This can reduce build context size and prevent unnecessary/private local files from entering image builds.

---

## `.editorconfig`

Shared editor rules such as indentation and line-ending conventions.

This keeps five developers from generating inconsistent formatting merely because their editors use different defaults.

---

# 49. Root `Makefile`

The `Makefile` provides memorable project commands instead of making developers remember long Docker/CLI commands.

Typical commands can include:

```text
make up
make down
make logs
make migrate
make seed
make ingest
make test
make lint
make types
make gen-api
make perf
```

The Makefile is a **developer/operations interface** over the underlying commands; it should not contain core application business logic.

---

# 50. Root `README.md`

The main entry point for anyone discovering the repository.

It should explain:

- what 1337 Nexus is;
- architecture at a glance;
- prerequisites;
- how to configure `.env`;
- how to boot the stack;
- common development commands;
- how the team contributes;
- where the major application features live.

This document should answer:

> **"I cloned the repository. What is this project, where is everything, and how do I run it?"**

---

# 51. How the user flow maps to the repository

The easiest way to remember the whole structure is to map your user-flow diagram directly onto the folders.

```text
LANDING
   ↓
backend/app/flows/landing/
frontend/src/flows/landing/

   ↓

AUTHENTICATION
   ↓
backend/app/flows/authentication/
frontend/src/flows/authentication/

   ↓

ROLE / ACCESS DECISION
   ↓
backend/app/flows/role-selection/

   ↓
       ┌───────────────────┐
       │                   │
       ▼                   ▼
     ADMIN                USER
       │                   │
       ▼                   ▼
backend/app/admin/    backend/app/user/
frontend .../admin/   frontend .../user/
       │                   │
       ├─ users             ├─ projects
       ├─ projects          ├─ opportunities
       ├─ campuses          ├─ messages
       ├─ moderation        ├─ copilot
       └─ configuration     ├─ notifications
                            ├─ quick-actions
                            └─ profile
```

Supporting systems sit beside the flows:

```text
             ┌────────────────────────┐
             │ core / shared / jobs    │
             │ realtime / CLI / DB     │
             └────────────┬───────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
      Admin              User          Other workflows
```

This is why the repository can mirror the product flow without putting infrastructure code inside every feature.

---

# 52. Where the AI developer works

The AI developer is not confined to one directory because AI participates in several workflows.

Primary areas:

```text
backend/app/user/copilot/
backend/app/user/projects/refine-project/
backend/app/shared/ai/
backend/app/jobs/
backend/app/cli/ingest_subjects.py
frontend/src/flows/user/copilot/
frontend/src/lib/sse-client.ts
```

The distinction is:

```text
Copilot / refine-project
    ↓
user-facing AI use cases

shared/ai
    ↓
reusable AI provider / embedding / tokenizer infrastructure

jobs
    ↓
background execution

ingest_subjects.py
    ↓
RAG corpus preparation

frontend copilot + sse-client
    ↓
AI user interface and streaming
```

---

# 53. Where the DevOps engineer works

The main DevOps ownership areas are:

```text
nginx/
deploy/
.github/
Makefile
Dockerfiles
.dockerignore
.editorconfig
```

The DevOps role connects application code to a reproducible runtime environment:

```text
Application code
      ↓
Docker images
      ↓
Docker Compose
      ↓
Nginx / networking / volumes
      ↓
CI/CD
      ↓
Runnable system
```

The DevOps engineer generally does not own the business logic inside `backend/app/user/`, `backend/app/admin/`, or the frontend feature implementations, but must be able to build, run, test, observe, and troubleshoot them.

---

# 54. A practical ownership map for a 5-person team

A possible team split is:

```text
Person 1 - DevOps
    nginx/
    deploy/
    .github/
    Makefile
    container/CI work

Person 2 - Backend / authentication
    backend/app/flows/
    backend/app/core/

Person 3 - Backend / product workflows
    backend/app/admin/
    backend/app/user/
    backend/app/teams/
    backend/app/collaboration/

Person 4 - Frontend
    frontend/

Person 5 - AI / RAG / integrations
    backend/app/user/copilot/
    backend/app/user/projects/refine-project/
    backend/app/shared/ai/
    backend/app/jobs/
    backend/app/cli/ingest_subjects.py
    frontend/src/flows/user/copilot/
```

The exact division should be agreed by the team; the architecture does not require every directory to have only one contributor.

---

# 55. The central architectural rule

The most important rule for this structure is:

> **A folder should answer one clear question.**

Examples:

```text
user/copilot/ask/
    "What code handles a user asking the Co-Pilot?"

shared/ai/
    "What code is reusable AI infrastructure?"

realtime/
    "What code provides realtime transport?"

jobs/
    "What code executes deferred work?"

nginx/
    "What code controls the edge container?"

deploy/
    "What code assembles and operates the containers?"
```

This keeps the repository understandable as the application grows.

---

# 56. Important distinction: use-case slicing vs. domain modules

This repository structure is organized primarily around **user workflows/use cases**.

For comparison, a domain-modular design would instead group code like:

```text
modules/
├── identity/
├── pitches/
├── recruitment/
├── teams/
├── boards/
├── canvas/
├── chat/
└── copilot/
```

The use-case design used here instead emphasizes operations such as:

```text
create-project/
apply/
accept-member/
move-card/
ask/
view-leaderboard/
```

This makes the repository resemble the application's user journey more closely.

It does **not** change Docker, Nginx, PostgreSQL, networking, or the three-container runtime architecture by itself. The main difference is the organization of application source code and its imports.

---

# 57. Final mental model

When you forget where something belongs, use this simple decision tree:

```text
Is it about building/running containers?
        ↓ yes
nginx/ or deploy/

Is it a reusable backend infrastructure concern?
        ↓ yes
backend/app/core/
backend/app/shared/
backend/app/realtime/
backend/app/jobs/

Is it a user/operator action?
        ↓ yes
backend/app/.../<use-case>/

Is it browser UI for a user action?
        ↓ yes
frontend/src/flows/<...>/

Is it a database schema change?
        ↓ yes
backend/alembic/versions/

Is it a test?
        ↓ yes
backend/tests/

Is it CI automation?
        ↓ yes
.github/workflows/

Is it project/developer documentation?
        ↓ yes
docs/ or README.md
```

The goal is not to memorize every filename. The goal is to understand the **responsibility of each layer**, so that when a new feature is requested you know where its code should live.

