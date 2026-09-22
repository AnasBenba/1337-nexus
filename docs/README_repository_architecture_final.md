# 1337 Nexus — Repository Architecture Guide

> **Architecture style:** Flow-oriented / use-case-sliced monorepo

This README explains the repository structure, the responsibility of each major directory and important file, and how the backend and frontend are organized around user flows and use cases.

The current team ownership is:

- **Anas** — DevOps & Infrastructure
- **Sfy** — Authentication, Security & Campus Administration
- **Zoubair** — AI Co-Pilot & Whiteboard
- **Ayoub** — Recruitment, Teams, Kanban & GitHub
- **Yassin** — Pitches, Chat, Discovery & Gamification

The important team rule is:

> **A feature owner is responsible for both the backend and frontend implementation of that feature. Shared infrastructure and application-composition files are coordinated across the team.**

---

# 1. Repository at a glance

```text
1337-nexus/
│
├── backend/              # FastAPI backend application
├── frontend/             # React + TypeScript + Vite frontend
├── nginx/                # Edge server / reverse proxy / HTTPS
├── deploy/               # Docker Compose, PostgreSQL config, operations
├── docs/                 # Architecture and project documentation
├── .github/              # GitHub automation and CODEOWNERS
├── .gitignore            # Git ignore rules
├── .dockerignore         # Docker build-context exclusions
├── .editorconfig         # Shared editor rules
├── Makefile              # Common developer / operations commands
└── README.md             # Main project documentation
```

The repository has two broad concerns:

```text
Application
├── backend/
└── frontend/

Infrastructure / Delivery
├── nginx/
├── deploy/
└── .github/
```

The application source is organized primarily around **flows and use cases**, while shared mechanisms such as database access, realtime transport, background jobs, and AI infrastructure live in dedicated shared areas.

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

Contains everything required to develop, run, test, migrate, and package the FastAPI backend.

The actual Python application code lives under `backend/app/`.

---

# 3. Backend application package

## `backend/app/`

This is the main Python application package.

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

`app/` contains:

1. application entry/composition code;
2. shared infrastructure used by many workflows;
3. user/admin workflows;
4. realtime and background execution mechanisms;
5. reusable shared application utilities.

---

# 4. Backend application entry points

## `backend/app/main.py`

Top-level ASGI entry point.

Typical responsibilities:

- expose the application callable served by Uvicorn;
- connect the FastAPI application to the runtime;
- attach the Socket.IO ASGI wrapper where required;
- expose the final ASGI application used by the container.

Conceptually:

```text
Uvicorn
   ↓
main.py
   ↓
ASGI application
```

**Owner:** Anas, with coordination from all backend feature owners when their routers or realtime components are integrated.

---

## `backend/app/api.py`

Application composition point.

Typical responsibilities:

- create/configure the FastAPI application;
- register routers from the different feature areas;
- configure application-level middleware order;
- configure lifespan/startup/shutdown;
- define OpenAPI metadata;
- assemble the different backend features into one application.

It answers:

> **How do all backend features become one FastAPI application?**

**Owner:** Anas + all backend feature owners.

---

# 5. Backend core infrastructure

## `backend/app/core/`

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

`core/` contains cross-cutting infrastructure.

Business logic for a specific feature should not be placed here.

---

## `core/config.py`

Central application configuration.

Responsible for loading and validating settings such as:

- database connection values;
- JWT/CSRF/encryption configuration;
- cookie configuration;
- trusted proxy settings;
- AI-provider configuration;
- media paths;
- operational limits.

Relationship:

```text
Environment
   ↓
config.py
   ↓
validated application settings
```

Real secrets belong in the environment, not in Git.

**Owner:** Anas.

---

## `core/db.py`

Database infrastructure.

Responsible for:

- SQLAlchemy async engine;
- session factory;
- database connection/pool configuration;
- shared database lifecycle helpers.

Feature-specific queries belong in the relevant feature/use-case slice, not here.

**Owner:** Anas.

---

## `core/security.py`

Reusable security primitives.

Examples:

- password hashing/verification;
- JWT creation/verification;
- session cookie helpers;
- CSRF helpers;
- cryptographic utilities.

Feature code consumes these primitives rather than reimplementing cryptography.

**Owner:** Sfy.

---

## `core/errors.py`

Common application error model.

Responsible for:

- application/domain exception types;
- mapping failures to HTTP responses;
- standardized JSON error envelopes;
- global exception handling.

The goal is consistent error behavior across all features.

**Owner:** Anas.

---

## `core/middleware.py`

Application-level middleware.

Examples:

- request IDs;
- CORS;
- error handling;
- rate limiting;
- CSRF protection;
- other cross-cutting request behavior.

**Owner:** Sfy, with integration by Anas.

---

## `core/logging.py`

Structured application logging.

Responsible for:

- log formatting;
- request/context fields;
- redaction;
- preventing credentials/secrets from appearing in logs.

**Owner:** Anas.

---

## `core/uow.py`

Unit-of-Work infrastructure.

Coordinates related database changes into one transaction.

Example:

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
COMMIT
```

It provides transaction coordination; the actual business rules remain in the owning feature.

**Owner:** Anas.

---

# 6. Initial application flows

## `backend/app/flows/`

```text
flows/
├── landing/
├── authentication/
│   ├── login/
│   ├── oauth/
│   ├── refresh_session/
│   └── logout/
└── role_selection/
```

These represent the initial application journey:

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

**`router.py`**  
Public HTTP endpoints for the landing experience.

**`schemas.py`**  
Request/response validation models.

**`service.py`**  
Application logic for landing-related operations.

**Owner:** Anas.

---

# 7. Authentication

## `flows/authentication/`

```text
authentication/
├── login/
├── oauth/
├── refresh_session/
└── logout/
```

This area contains authentication use cases.

**Owner:** Sfy.

---

## `authentication/login/`

```text
login/
├── router.py
├── schemas.py
├── service.py
└── repository.py
```

- `router.py` — receives login requests.
- `schemas.py` — validates request/response data.
- `service.py` — login workflow and session issuance.
- `repository.py` — persistence operations specific to login.

**Owner:** Sfy.

---

## `authentication/oauth/`

```text
oauth/
├── router.py
├── schemas.py
├── service.py
└── repository.py
```

Handles OAuth authentication.

This is where Sfy implements the 42 Intra Authorization Code flow, PKCE/state handling, identity retrieval, and the required authentication/session behavior.

**Owner:** Sfy.

---

## `authentication/refresh_session/`

```text
refresh_session/
├── router.py
├── service.py
└── repository.py
```

Responsible for refresh/session renewal and its persistence rules.

**Owner:** Sfy.

---

## `authentication/logout/`

```text
logout/
├── router.py
└── service.py
```

Handles logout and session invalidation.

**Owner:** Sfy.

---

## `flows/role_selection/`

```text
role_selection/
├── service.py
└── schemas.py
```

Resolves the user's access/role after authentication.

Conceptually:

```text
Authenticated user
       ↓
role / scope resolution
       ↓
Admin OR User experience
```

**Owner:** Sfy.

---

# 8. Admin workflows

## `backend/app/admin/`

```text
admin/
├── dashboard/
├── users/
├── projects/
├── campuses/
├── moderation/
└── configuration/
```

Represents the administrator experience.

**Owner:** Sfy.

---

## `admin/dashboard/`

```text
dashboard/
├── router.py
├── schemas.py
└── service.py
```

Provides administrator dashboard data such as summaries, counts, activity, and cross-campus telemetry.

**Owner:** Sfy.

---

## `admin/users/`

```text
users/
├── list_users/
├── view_user/
├── manage_user/
└── suspend_user/
```

Each directory is a separate admin use case:

- `list_users/` — list users within allowed scope.
- `view_user/` — inspect one user.
- `manage_user/` — administrative user-management actions.
- `suspend_user/` — suspend a user.

**Owner:** Sfy.

---

## `admin/projects/`

```text
projects/
├── view_projects/
├── review_project/
├── moderate_project/
└── feature_project/
```

Administrative operations over project/pitch content.

**Owner:** Sfy.

---

## `admin/campuses/`

```text
campuses/
├── view_campus/
├── create_campus/
└── manage_campus/
```

Campus administration and management, including the application's campus hierarchy/scope behavior.

**Owner:** Sfy.

---

## `admin/moderation/`

```text
moderation/
├── flags/
└── reports/
```

Operator-facing moderation workflows, including moderation queue behavior.

**Owner:** Sfy.

---

## `admin/configuration/`

```text
configuration/
├── platform_settings/
└── system_settings/
```

Separates product/platform configuration from system configuration.

**Owner:** Sfy.

---

# 9. Normal user workflows

## `backend/app/user/`

```text
user/
├── dashboard/
├── projects/
├── opportunities/
├── pitches/
├── messages/
├── copilot/
├── quick_actions/
└── profile/
```

Represents the normal user's dashboard and user-facing workflows.

---

## `user/dashboard/`

```text
dashboard/
├── router.py
├── schemas.py
└── service.py
```

Builds the normal user's dashboard.

Possible aggregated content includes:

- recent projects;
- recommendations;
- opportunities;
- messages/notifications;
- quick actions.

**Owner:** Anas.

---

# 10. User projects

## `user/projects/`

```text
projects/
├── my_projects/
├── recommended_projects/
├── create_project/
├── edit_project/
├── publish_project/
├── archive_project/
└── refine_project/
```

Most project lifecycle workflows are owned by Ayoub.

`refine_project/` is owned by Zoubair because it is the AI-assisted project refinement workflow.

---

## `my_projects/`

Retrieves projects associated with the current user.

**Owner:** Ayoub.

## `recommended_projects/`

Retrieves project recommendations.

**Owner:** Ayoub.

## `create_project/`

Creates a new project.

**Owner:** Ayoub.

## `edit_project/`

Updates an existing project.

**Owner:** Ayoub.

## `publish_project/`

Publishes a project.

**Owner:** Ayoub.

## `archive_project/`

Archives a project.

**Owner:** Ayoub.

## `refine_project/`

AI-assisted project refinement.

**Owner:** Zoubair.

---

# 11. User opportunities

## `user/opportunities/`

```text
opportunities/
├── browse_opportunities/
├── view_opportunity/
├── apply/
└── withdraw_application/
```

Recruitment/opportunity user journey.

**Owner:** Ayoub.

---

# 12. User pitches

## `user/pitches/`

```text
pitches/
├── create_pitch/
├── edit_pitch/
├── publish_pitch/
├── archive_pitch/
├── view_pitch/
└── search_pitches/
```

The Pitch feature is separate from the Project lifecycle.

**Owner:** Yassin.

Responsibilities include:

- Pitch CRUD lifecycle;
- Markdown authoring;
- sanitized Markdown rendering;
- PostgreSQL `tsvector` full-text search;
- tag filtering.

The backend pitch workflows provide the application/business logic. The frontend Pitch Explorer is implemented in the corresponding frontend flow.

---

# 13. User messages and notifications

## `user/messages/`

```text
messages/
├── team_chat/
├── direct_message/
└── notifications/
```

User-facing communication workflows.

Realtime transport is implemented separately under `app/realtime/`.

**Owner:** Yassin.

---

## `team_chat/`

Team-channel messaging workflow.

**Owner:** Yassin.

## `direct_message/`

Cross-campus direct messaging workflow.

**Owner:** Yassin.

## `notifications/`

In-app notification persistence and user notification workflow.

**Owner:** Yassin.

---

# 14. User Co-Pilot

## `user/copilot/`

```text
copilot/
├── ask/
├── retrieve_curriculum/
├── threads/
└── cancel_job/
```

Main user-facing AI area.

**Owner:** Zoubair.

---

## `copilot/ask/`

```text
ask/
├── router.py
├── schemas.py
└── service.py
```

Handles the Co-Pilot question workflow.

Conceptually:

```text
User question
    ↓
validate
    ↓
authorize
    ↓
retrieve context
    ↓
AI provider
    ↓
stream response
    ↓
persist result
```

**Owner:** Zoubair.

---

## `copilot/retrieve_curriculum/`

Retrieves relevant curriculum content for the RAG workflow.

**Owner:** Zoubair.

---

## `copilot/threads/`

```text
threads/
├── router.py
└── service.py
```

Conversation thread operations.

**Owner:** Zoubair.

---

## `copilot/cancel_job/`

```text
cancel_job/
├── router.py
└── service.py
```

Cancels supported running AI jobs.

**Owner:** Zoubair.

---

# 15. Teams

## `backend/app/teams/`

```text
teams/
├── create_team/
├── invite_member/
├── accept_member/
└── remove_member/
```

Team-management use cases.

A founder acceptance can trigger atomic workspace provisioning, including the team and its related collaborative resources.

**Owner:** Ayoub.

---

# 16. Collaboration

## `backend/app/collaboration/`

```text
collaboration/
├── board/
├── canvas/
└── chat/
```

Groups use cases around collaborative workspaces.

---

## `collaboration/board/`

```text
board/
├── create_board/
├── create_column/
├── move_card/
└── delete_column/
```

Kanban board operations.

**Owner:** Ayoub.

The board implementation includes server-authoritative LexoRank ordering, synchronous rebalancing, monotonically increasing board revisions, and the required terminal-column constraints.

---

## `collaboration/canvas/`

```text
canvas/
├── join_canvas/
├── send_update/
└── compact_document/
```

Collaborative whiteboard operations.

**Owner:** Zoubair.

The implementation covers the Yjs CRDT document, binary update relay behavior, peer collaboration, and snapshot/compaction handling.

---

## `collaboration/chat/`

```text
chat/
├── send_team_message/
├── send_direct_message/
├── mark_message_read/
└── reconnect/
```

Messaging use cases associated with team and direct communication.

**Owner:** Yassin.

---

# 17. Integrations

## `backend/app/integrations/`

```text
integrations/
└── github/
    ├── refresh_activity/
    └── view_activity/
```

Integration-specific workflows.

**Owner:** Ayoub.

### `github/refresh_activity/`

Refreshes public repository activity according to the required polling and conditional-request behavior.

### `github/view_activity/`

Returns normalized/cached GitHub activity to users.

---

# 18. Gamification

## `backend/app/gamification/`

```text
gamification/
├── view_xp/
├── view_badges/
└── view_leaderboard/
```

User-facing gamification queries.

**Owner:** Yassin.

The broader gamification implementation includes the immutable XP event ledger, occurrence keys to prevent duplicate awards, badge evaluation, and campus leaderboard behavior.

---

# 19. Realtime infrastructure

## `backend/app/realtime/`

```text
realtime/
├── server.py
├── auth.py
├── presence.py
├── rooms.py
└── validation.py
```

This directory contains the **realtime transport mechanism**, not normal feature business logic.

Ownership is split by function:

- `server.py` — Anas
- `auth.py` — Sfy
- `presence.py` — Yassin
- `rooms.py` — Yassin
- `validation.py` — Anas

Feature-specific realtime behavior remains with the feature owner.

```text
Canvas realtime          → Zoubair
Chat realtime            → Yassin
Realtime authentication  → Sfy
Realtime infrastructure  → Anas
```

---

# 20. Background jobs

## `backend/app/jobs/`

```text
jobs/
├── worker.py
├── registry.py
└── scheduler.py
```

Background-job execution infrastructure.

**Owner:** Zoubair for the AI job system and queue responsibilities.

### `worker.py`

Runs the worker loop and handles job execution, retries/leases, concurrency, and shutdown behavior.

### `registry.py`

Maps job kinds to their executors.

### `scheduler.py`

Schedules deferred or recurring work.

The job system executes work; business logic remains in the owning feature.

---

# 21. Shared backend code

## `backend/app/shared/`

```text
shared/
├── models.py
├── pagination.py
└── ai/
    ├── provider.py
    ├── client.py
    ├── embeddings.py
    ├── tokenizer.py
    └── stub.py
```

Only genuinely reusable application code belongs here.

Do not turn `shared/` into a miscellaneous dumping ground.

---

## `shared/models.py`

Reusable ORM base models and shared model utilities.

**Owner:** Anas, with contributions from feature developers when shared primitives are required.

---

## `shared/pagination.py`

Reusable pagination helpers such as cursor/keyset utilities.

**Owner:** Anas.

---

# 22. Shared AI infrastructure

## `backend/app/shared/ai/`

```text
ai/
├── provider.py
├── client.py
├── embeddings.py
├── tokenizer.py
└── stub.py
```

Reusable AI infrastructure.

**Owner:** Zoubair.

The distinction is:

```text
user/copilot/
    ↓
what the user is doing

shared/ai/
    ↓
how AI communication/retrieval is implemented
```

### `provider.py`

Provider abstraction/interface.

### `client.py`

External AI service communication.

### `embeddings.py`

Embedding generation.

### `tokenizer.py`

Token counting and sizing for chunking/prompt budgets.

### `stub.py`

Deterministic fake/stub provider for tests and local development.

---

# 23. CLI tools

## `backend/app/cli/`

```text
cli/
├── seed.py
├── ingest_subjects.py
├── export_openapi.py
└── admin.py
```

Developer/operator commands rather than web routes.

Ownership:

- `seed.py` — Anas
- `ingest_subjects.py` — Zoubair
- `export_openapi.py` — Anas
- `admin.py` — Sfy

---

## `seed.py`

Creates controlled seed/demo data when enabled.

## `ingest_subjects.py`

Ingests curriculum/subject content and prepares it for the RAG workflow.

## `export_openapi.py`

Exports the backend OpenAPI document used to generate frontend API types.

## `admin.py`

Provides explicit admin/operator commands.

---

# 24. Alembic

## `backend/alembic/`

```text
alembic/
├── env.py
├── script.py.mako
└── versions/
```

Database migration infrastructure.

## `alembic/env.py`

Connects Alembic to the application database configuration and migration metadata.

**Owner:** Anas.

## `alembic/script.py.mako`

Template for generated migration revisions.

**Owner:** Anas.

## `alembic/versions/`

Contains actual schema migration revisions.

**Ownership:** All backend developers.

Each developer creates migrations required by their own feature; Anas maintains the migration environment/execution side.

---

# 25. Backend content

## `backend/content/subjects/`

Stores controlled curriculum/subject source content used by ingestion and RAG.

This is application content/data, not Python application logic.

**Owner:** Zoubair.

---

# 26. Backend tests

## `backend/tests/`

```text
tests/
├── unit/
├── integration/
├── realtime/
├── crdt/
└── conftest.py
```

Testing ownership follows feature ownership.

### `tests/unit/`

Feature developers test their own business logic.

Examples:

- authentication/security rules;
- matching/ranking;
- campus scope;
- AI retrieval/chunking;
- pitch search;
- gamification rules.

**Owners:** Relevant feature developers.

### `tests/integration/`

Tests complete application/database boundaries.

**Owners:** Anas + relevant feature owner.

### `tests/realtime/`

Tests realtime behavior.

**Owners:** Anas + Zoubair + Yassin, depending on the feature/namespace.

### `tests/crdt/`

Tests interoperability between the Python CRDT side and JavaScript/Yjs side.

**Owner:** Zoubair.

### `tests/conftest.py`

Shared pytest fixtures and test environment setup.

**Owner:** Anas.

---

# 27. Backend dependency and container files

## `backend/pyproject.toml`

Primary Python project configuration.

Contains:

- dependency constraints;
- package metadata;
- Ruff configuration;
- mypy configuration;
- pytest configuration;
- coverage configuration;
- import-linter configuration.

It is the source declaration for Python dependencies.

**Owner:** Anas, with feature developers contributing dependencies required by their implementations.

---

## `backend/requirements.lock`

Resolved/locked Python dependency set.

Conceptually:

```text
pyproject.toml
      ↓
dependency resolution
      ↓
requirements.lock
      ↓
Docker + CI
```

The lockfile provides the reproducible package set used by Docker and CI.

**Owner:** Anas.

---

## `backend/Dockerfile`

Builds the backend runtime container.

Typical responsibilities:

- select the Python base image;
- install locked dependencies;
- copy backend source;
- create/use the runtime user;
- configure the runtime.

**Owner:** Anas.

---

## `backend/entrypoint.sh`

Backend container startup process.

Conceptually:

```text
Container starts
      ↓
wait for PostgreSQL
      ↓
run migrations
      ↓
start Uvicorn
```

**Owner:** Anas.

---

# 28. Frontend

## `frontend/`

React + TypeScript + Vite application.

```text
frontend/
├── src/
│   ├── app/
│   ├── flows/
│   ├── components/
│   ├── lib/
│   ├── stores/
│   └── types/
│
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

Feature developers own their corresponding feature UI.

---

# 29. Frontend application shell

## `frontend/src/app/`

```text
app/
├── App.tsx
├── main.tsx
└── routes/
```

Application-level shell.

### `App.tsx`

Top-level React application component.

### `main.tsx`

Browser entry point that mounts React and global providers.

### `routes/`

Maps application URLs to frontend flows.

**Ownership:** Anas + all feature developers.

---

# 30. Frontend flows

## `frontend/src/flows/`

```text
flows/
├── landing/
├── authentication/
├── admin/
└── user/
```

Mirrors the user journey.

---

## `flows/landing/`

```text
landing/
├── components/
└── pages/
```

Landing-specific UI.

**Owner:** Anas.

---

## `flows/authentication/`

```text
authentication/
├── login/
├── oauth/
└── callback/
```

42 Intra authentication UI.

**Owner:** Sfy.

---

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

Campus Admin UI.

**Owner:** Sfy.

---

## `flows/user/`

```text
user/
├── dashboard/
├── projects/
├── opportunities/
├── pitches/
├── messages/
├── copilot/
├── notifications/
├── quick_actions/
└── profile/
```

Feature ownership matches the backend:

- dashboard — Anas
- projects — Ayoub, except `refine_project` — Zoubair
- opportunities — Ayoub
- pitches — Yassin
- messages — Yassin
- copilot — Zoubair
- notifications — Yassin
- quick_actions — Ayoub
- profile — Sfy

---

# 31. Frontend projects

## `flows/user/projects/`

```text
projects/
├── my_projects/
├── recommended_projects/
├── create_project/
├── edit_project/
├── publish_project/
├── archive_project/
└── refine_project/
```

- `my_projects/` — Ayoub
- `recommended_projects/` — Ayoub
- `create_project/` — Ayoub
- `edit_project/` — Ayoub
- `publish_project/` — Ayoub
- `archive_project/` — Ayoub
- `refine_project/` — Zoubair

---

# 32. Frontend Pitch Explorer

## `frontend/src/flows/user/pitches/`

```text
pitches/
├── explorer/
├── create/
├── edit/
├── view/
└── components/
```

This is Yassin's frontend Pitch feature.

- `explorer/` — Pitch Explorer feed.
- `create/` — pitch creation UI.
- `edit/` — pitch editing UI.
- `view/` — pitch detail view.
- `components/` — Pitch-specific reusable components.

**Owner:** Yassin.

---

# 33. Frontend Co-Pilot

## `frontend/src/flows/user/copilot/`

```text
copilot/
├── ask/
├── threads/
└── components/
```

AI user interface.

**Owner:** Zoubair.

### `ask/`

Streaming Co-Pilot interaction.

### `threads/`

Conversation-thread UI.

### `components/`

Reusable Co-Pilot-specific React components.

---

# 34. Frontend shared components

## `frontend/src/components/`

```text
components/
├── ui/
└── layout/
```

### `ui/`

Reusable visual primitives.

Examples:

- buttons;
- dialogs;
- inputs;
- cards;
- shared UI components.

**Owner:** Anas + all frontend developers.

### `layout/`

Application-wide structural components such as:

- sidebar;
- top bar;
- page shell;
- shared layout structure.

**Owner:** Anas.

---

# 35. Frontend shared libraries

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

Shared API communication layer.

**Owner:** Anas.

### `socket.ts`

Socket.IO client setup and reconnection utilities.

**Owner:** Anas.

### `sse-client.ts`

Client for Server-Sent Events used by the Co-Pilot.

**Owner:** Zoubair.

### `query-client.ts`

TanStack Query configuration and shared query behavior.

**Owner:** Anas.

### `utils.ts`

Small shared frontend utilities.

**Owner:** Anas.

---

# 36. Frontend state and API types

## `frontend/src/stores/`

Client-side state stores.

**Owner:** Anas + feature developers when feature-specific state is needed.

## `frontend/src/types/api.d.ts`

Generated TypeScript API definitions.

Conceptually:

```text
FastAPI
   ↓
OpenAPI
   ↓
openapi-typescript
   ↓
api.d.ts
   ↓
React application
```

This avoids manually maintaining duplicate API types.

**Owner:** Anas.

---

# 37. Frontend configuration files

## `frontend/package.json`

Declares frontend dependencies and scripts.

**Ownership:** Anas + all frontend developers.

## `frontend/package-lock.json`

Records the resolved npm dependency tree used by `npm ci`.

**Ownership:** Anas + all frontend developers.

## `frontend/vite.config.ts`

Vite configuration.

**Owner:** Anas.

## `frontend/vitest.setup.ts`

Shared Vitest setup.

**Owner:** Anas.

## `frontend/tsconfig.json`

Root TypeScript configuration.

**Owner:** Anas.

## `frontend/tsconfig.app.json`

Application TypeScript configuration.

**Owner:** Anas.

## `frontend/tsconfig.node.json`

Node tooling TypeScript configuration.

**Owner:** Anas.

## `frontend/eslint.config.js`

ESLint configuration.

**Owner:** Anas.

## `frontend/.prettierrc`

Formatting rules.

**Owner:** Anas.

## `frontend/components.json`

Shared component-generation configuration.

**Owner:** Anas.

---

# 38. Nginx

## `nginx/`

```text
nginx/
├── Dockerfile
├── entrypoint.sh
├── nginx.conf
└── conf.d/
    └── nexus.conf
```

Nginx is the external edge container.

**Owner:** Anas.

---

## `nginx/Dockerfile`

Builds the final Nginx image.

The multi-stage build concept is:

```text
Node build stage
     ↓
build React application
     ↓
frontend/dist/
     ↓
Nginx runtime image
     ↓
serve SPA
```

---

## `nginx/entrypoint.sh`

Runs when the Nginx container starts.

Typical responsibilities:

- receive TLS values from environment;
- create certificate/key files;
- apply restrictive permissions;
- validate configuration;
- start Nginx in the foreground.

---

## `nginx/nginx.conf`

Global Nginx settings.

Examples:

- worker configuration;
- events;
- logging;
- PID;
- HTTP defaults;
- temporary paths;
- included configuration.

---

## `nginx/conf.d/nexus.conf`

Application-specific edge routing.

Conceptually:

```text
/                     → React SPA
/api/                 → FastAPI
/health               → FastAPI
/health/ready         → FastAPI
/socket.io/           → Socket.IO
/media/               → media volume
Co-Pilot SSE          → FastAPI
```

This is also where WebSocket/SSE proxying and buffering behavior is configured.

---

# 39. Deployment

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

Controls how the application is assembled and operated as containers.

**Owner:** Anas.

---

## `deploy/docker-compose.yml`

Base production-style topology:

```text
Nginx
  ↓
Backend
  ↓
PostgreSQL
```

Defines:

- services;
- network;
- environment;
- health checks;
- volumes;
- resource limits;
- build arguments;
- dependencies;
- port exposure.

---

## `deploy/docker-compose.dev.yml`

Opt-in development override.

May provide:

- backend reload;
- development mounts;
- intentionally exposed database port;
- development-specific settings.

It does not replace the base topology.

---

## `deploy/.env.example`

Committed environment template.

Contains placeholders, not real credentials.

Typical categories:

- PostgreSQL;
- backend database URLs;
- trusted proxy subnet;
- image references;
- TLS variables;
- application/provider settings.

---

## `deploy/.env`

Local environment.

Contains real local values/secrets.

It must not be committed.

---

# 40. PostgreSQL deployment configuration

## `deploy/postgres/postgresql.conf`

Controls PostgreSQL runtime behavior and resource tuning.

It does **not** define application tables.

Application schema changes are represented by Alembic migrations.

**Owner:** Anas.

---

# 41. Operational scripts

## `deploy/scripts/bootstrap.sh`

Canonical first-run setup.

Responsible for:

- preparing local environment values;
- generating local TLS material when needed;
- validating Compose configuration;
- starting the stack.

**Owner:** Anas.

---

## `deploy/scripts/seed.sh`

Convenience wrapper around backend seed functionality.

**Owner:** Anas.

---

## `deploy/scripts/backup.sh`

Operational backup script for database/media backup.

**Owner:** Anas.

---

## `deploy/scripts/perf-smoke.sh`

Bounded performance/memory smoke test.

**Owner:** Anas.

---

# 42. Documentation

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

System structure, boundaries, containers, and major design decisions.

**Owner:** Anas.

### `api.md`

API conventions beyond generated OpenAPI, including realtime/SSE behavior when needed.

**Owners:** All backend developers.

### `operations.md`

Operational runbook:

- boot;
- shutdown;
- backup;
- restore;
- pruning;
- ingestion;
- dependency updates;
- operating procedures.

**Owner:** Anas.

### `frontend.md`

Frontend architecture and conventions.

**Owners:** All frontend developers.

### `design-system.md`

Shared UI/design-system conventions.

**Owners:** Anas + all frontend developers.

---

# 43. GitHub automation

## `.github/`

```text
.github/
├── CODEOWNERS
└── workflows/
    └── ci.yml
```

---

## `.github/CODEOWNERS`

Defines which developers should review changes to particular areas.

Current ownership is feature-oriented:

```text
Sfy
├── authentication
├── security
├── campus
└── admin

Zoubair
├── copilot
├── canvas
├── AI infrastructure
├── AI jobs
└── curriculum ingestion

Ayoub
├── projects
├── opportunities
├── teams
├── boards
└── GitHub integration

Yassin
├── pitches
├── messages
├── chat
└── gamification / notifications

Anas
├── Docker
├── Nginx
├── deployment
├── PostgreSQL infrastructure
├── CI/CD
└── repository tooling
```

`CODEOWNERS` identifies review responsibility. Branch protection/rulesets can require code-owner approval before merging.

---

## `.github/workflows/ci.yml`

Continuous Integration workflow.

The final CI is expected to cover:

- backend linting;
- backend type checking;
- backend tests;
- frontend linting/type checking/tests;
- CRDT checks;
- OpenAPI generation checks;
- design-system checks;
- Compose smoke build/start checks.

**Owner:** Anas.

---

# 44. Repository hygiene

## `.gitignore`

Prevents Git from tracking local/generated files such as:

- `.env`;
- Python caches;
- `node_modules/`;
- build outputs;
- editor files;
- logs and temporary files.

**Owner:** Anas.

---

## `.dockerignore`

Controls which files are excluded from Docker build context.

Helps reduce build context size and prevents unnecessary local material from entering builds.

**Owner:** Anas.

---

## `.editorconfig`

Shared editor rules:

- indentation;
- line endings;
- final newline behavior.

Keeps formatting consistent across the team.

**Owner:** Anas.

---

# 45. Root Makefile

## `Makefile`

Provides convenient project commands.

Examples:

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

It is a developer/operations interface over the underlying commands.

It should not contain business logic.

**Owner:** Anas.

---

# 46. Root README

## `README.md`

Main entry point for the repository.

It should answer:

> **I cloned this repository. What is this project, where is everything, and how do I run it?**

It should contain:

- project overview;
- architecture at a glance;
- prerequisites;
- environment setup;
- boot instructions;
- common commands;
- team contribution workflow;
- major feature locations.

**Owner:** Anas.

---

# 47. How the product flow maps to the repository

The main user journey is:

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
ROLE / ACCESS
   ↓
backend/app/flows/role_selection/
   ↓
        ┌───────────────────┐
        │                   │
        ▼                   ▼
      ADMIN                USER
        │                   │
        ▼                   ▼
backend/app/admin/   backend/app/user/
frontend/.../admin/  frontend/.../user/
```

The user side expands into:

```text
User
├── Dashboard
├── Projects
├── Opportunities
├── Pitches
├── Messages
├── Co-Pilot
├── Notifications
├── Quick Actions
└── Profile
```

Supporting systems sit beside the flows:

```text
core/
shared/
realtime/
jobs/
CLI/
Alembic
```

---

# 48. How feature ownership maps to the repository

The team rule is:

> **A feature owner owns the backend and frontend implementation of the feature.**

### Sfy

```text
backend/app/flows/authentication/
backend/app/admin/
backend/app/user/profile/

frontend/src/flows/authentication/
frontend/src/flows/admin/
frontend/src/flows/user/profile/
```

### Zoubair

```text
backend/app/user/copilot/
backend/app/user/projects/refine_project/
backend/app/collaboration/canvas/
backend/app/shared/ai/
backend/app/jobs/
backend/content/subjects/

frontend/src/flows/user/copilot/
frontend/src/flows/user/projects/refine_project/
frontend/src/lib/sse-client.ts
```

### Ayoub

```text
backend/app/user/projects/
backend/app/user/opportunities/
backend/app/user/quick_actions/
backend/app/teams/
backend/app/collaboration/board/
backend/app/integrations/github/

frontend/src/flows/user/projects/
frontend/src/flows/user/opportunities/
frontend/src/flows/user/quick_actions/
```

### Yassin

```text
backend/app/user/pitches/
backend/app/user/messages/
backend/app/collaboration/chat/
backend/app/gamification/

frontend/src/flows/user/pitches/
frontend/src/flows/user/messages/
frontend/src/flows/user/notifications/
```

### Anas

```text
nginx/
deploy/
.github/
Makefile
Dockerfiles
backend/pyproject.toml
backend/requirements.lock
```

Shared application shell files such as `main.py`, `api.py`, frontend `app/`, and shared testing/composition areas are collaboration points.

---

# 49. Where the AI developer works

Zoubair's AI responsibilities span several directories:

```text
backend/app/user/copilot/
backend/app/user/projects/refine_project/
backend/app/collaboration/canvas/
backend/app/shared/ai/
backend/app/jobs/
backend/app/cli/ingest_subjects.py
backend/content/subjects/

frontend/src/flows/user/copilot/
frontend/src/flows/user/projects/refine_project/
frontend/src/lib/sse-client.ts
```

The separation is:

```text
user/copilot/
    ↓
AI user-facing use cases

refine_project/
    ↓
AI-assisted project refinement

shared/ai/
    ↓
provider / client / embedding / tokenizer infrastructure

jobs/
    ↓
background execution

ingest_subjects.py + content/subjects/
    ↓
RAG corpus preparation

frontend copilot + sse-client
    ↓
AI interface and SSE streaming

collaboration/canvas/
    ↓
Yjs collaborative whiteboard
```

---

# 50. Where the DevOps engineer works

Anas connects application code to a reproducible runtime environment:

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

Primary ownership areas:

```text
nginx/
deploy/
.github/
Makefile
Dockerfiles
backend/pyproject.toml
backend/requirements.lock
repository hygiene
operational documentation
```

The DevOps role does not implement the business logic of every application feature. It provides the platform on which those features build, run, communicate, persist, and pass automated checks.

---

# 51. Important distinction: use-case slicing vs domain modules

This repository uses a **flow-oriented / use-case-sliced structure**.

A domain-modular structure might look like:

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

This repository instead emphasizes operations such as:

```text
create_project/
create_pitch/
apply/
accept_member/
move_card/
ask/
search_pitches/
view_leaderboard/
```

The purpose is to make the location of a workflow obvious:

> **What operation is this code implementing?**

This organization changes the application source layout. It does not change the Docker, Nginx, PostgreSQL, or three-container runtime architecture.

---

# 52. Central architectural rules

## Rule 1 — One folder should answer one clear question

Examples:

```text
user/copilot/ask/
    "What handles a user asking the Co-Pilot?"

user/pitches/search_pitches/
    "What handles Pitch search?"

shared/ai/
    "What is reusable AI infrastructure?"

realtime/
    "What provides realtime transport?"

jobs/
    "What executes deferred work?"

nginx/
    "What controls the edge container?"

deploy/
    "What assembles and operates the containers?"
```

---

## Rule 2 — Keep infrastructure separate from feature logic

```text
Infrastructure
├── core/
├── realtime/
├── jobs/
├── nginx/
└── deploy/

Feature logic
├── flows/
├── admin/
├── user/
├── teams/
├── collaboration/
├── integrations/
└── gamification/
```

---

## Rule 3 — Feature owner owns both backend and frontend

A feature owner handles the normal backend and frontend implementation of the same feature.

---

## Rule 4 — Do not put secrets in Git

Use:

```text
deploy/.env
```

for local secrets and:

```text
deploy/.env.example
```

for the safe template.

---

## Rule 5 — Migrations belong to the feature that changes the schema

All developers can create revisions under:

```text
backend/alembic/versions/
```

while Anas maintains the migration infrastructure.

---

# 53. Final mental model

When you forget where something belongs, use this decision tree:

```text
Is it about building/running containers?
        ↓ yes
nginx/ or deploy/

Is it shared backend infrastructure?
        ↓ yes
backend/app/core/
backend/app/shared/
backend/app/realtime/
backend/app/jobs/

Is it a user/admin action?
        ↓ yes
backend/app/<area>/<use-case>/

Is it browser UI for that action?
        ↓ yes
frontend/src/flows/<area>/<use-case>/

Is it shared frontend infrastructure?
        ↓ yes
frontend/src/app/
frontend/src/components/
frontend/src/lib/

Is it a database schema change?
        ↓ yes
backend/alembic/versions/

Is it a backend test?
        ↓ yes
backend/tests/

Is it CI automation?
        ↓ yes
.github/workflows/

Is it project/developer documentation?
        ↓ yes
docs/ or README.md
```

The goal is not to memorize every filename.

The goal is to understand the **responsibility of each layer**, so that when a new feature is requested, the team knows where its backend, frontend, tests, migrations, and infrastructure belong.
