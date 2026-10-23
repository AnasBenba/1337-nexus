# 1337 Nexus

> **High-Performance Collaborative Platform for 1337 School (42 Network)**  
> Empowering students to build projects, discover opportunities, collaborate seamlessly, and navigate the curriculum using an AI-powered Copilot.

---

> [!IMPORTANT]
> **Team Reminder: Keep This README Updated!**  
> Every time you merge a new feature branch or workstream into `main`, please update your progress section below and keep the team status current.

---

## Architecture & Technology Stack

1337 Nexus follows a **use-case-sliced, flow-oriented architecture** where each feature domain is self-contained with its own routes, schemas, and services.

- **Backend**: FastAPI (Python 3.12, `uv`), SQLAlchemy (async), Alembic
- **Database & Search**: PostgreSQL with `pgvector` for semantic embeddings
- **Reverse Proxy & Gateway**: Nginx with TLS termination, security headers, and SSE streaming buffer bypass
- **AI Engine**: Google Gemini API (`text-embedding-004` / `gemini-embedding-exp-03-07` embeddings, Gemini 2.5 Flash / Flash Lite for RAG)
- **Containerization**: Docker Compose with dedicated development and production configurations

---

## Team Workstreams & Current Progress

| Team Member | Workstream Domain | Current Status | Key Deliverables & Merged Milestones |
| :--- | :--- | :---: | :--- |
| **Anas** | **DevOps & Infrastructure** | 🟢 **Done / Active** | • Docker Compose stack (`deploy/docker-compose.yml` & `docker-compose.dev.yml`)<br>• PostgreSQL 16 + `pgvector` container initialization (`01-users.sql`)<br>• Nginx reverse proxy with TLS, rate limits, and SSE buffering controls<br>• Root `Makefile` automation and DevOps operational documentation<br>• Performance smoke test suite (`deploy/scripts/perf-smoke.sh`) |
| **Zoubair** | **AI & Curriculum Copilot** | 🟡 **In Progress / PR Ready** | • **Subject Corpus Ingestion**: CLI (`ingest_subjects.py`) converting 42 subject PDFs to markdown and generating vector embeddings<br>• **Alembic Vector Migration**: Subjects, documents, and curriculum chunks schema with 768-dim vector embeddings (`c4d9e1f8a230`)<br>• **Curriculum Semantic Retrieval (AI-201)**: L2 vector distance search and curriculum matching endpoint (`merged` to `main`)<br>• **Copilot SSE Stream & Grounding (AI-203)**: Real-time server-sent events, strict answer-first prompt persona, and campus-verified Intra URL citations (`feature/AI-203` ready) |
| **Ayoub** | **Opportunities & Recruitment** | 🟢 **Merged to Main** | • **Browse Opportunities**: Listing active opportunities with pagination and filters<br>• **View Opportunity**: Detailed opportunity inspection endpoint<br>• **Apply to Opportunity**: Application submission with applicant validation<br>• **Withdraw Application**: Application lifecycle and status management |
| **Soufiane** | **Authentication & User Management** | 🟢 **Merged to Main** | • **42 Intra OAuth**: PKCE authorization flow (`AuthClient` with state and code verifiers)<br>• **Token & User Management**: Token exchange and automated user profile sync with Intra API<br>• **Auth Routes**: `/auth/login` and `/api/v1/auth/oauth/42/callback` endpoints<br>• **Database User Model**: User persistence on successful OAuth login |
| **Yassin** | **Pitches, Collaboration & Chat** | 🔵 **In Progress** | • **Pitches Management**: Pitch drafting, publishing, upvoting, and team creation models<br>• **Real-Time Communication**: Team and direct messaging infrastructure (WebSockets / Socket.io) |

---

## Project Structure Overview

```text
1337-nexus/
├── backend/
│   ├── alembic/              # Database schema migrations
│   ├── app/
│   │   ├── api.py            # Central route aggregator
│   │   ├── main.py           # FastAPI application factory
│   │   ├── core/             # Database connection, settings, Base model
│   │   ├── models/           # Shared SQLAlchemy domain models
│   │   ├── oauth/            # 42 Intra OAuth implementation
│   │   ├── shared/ai/        # Gemini provider, AI client & embedding configs
│   │   ├── cli/              # Management CLIs (subject ingestion, seeds)
│   │   └── user/
│   │       ├── copilot/      # Curriculum retrieval & AI Copilot flows
│   │       └── opportunities/# Browse, view, apply, and withdraw flows
│   ├── content/subjects/     # 42 curriculum corpus (PDFs & extracted MDs)
│   ├── tests/                # Unit and integration test suite
│   └── pyproject.toml        # Dependencies and build configuration
├── deploy/
│   ├── docker-compose.yml    # Base production compose
│   ├── docker-compose.dev.yml# Development overrides (hot reload, volume mounts)
│   ├── postgres/             # Database configuration and init scripts
│   └── scripts/              # Backup, bootstrap, and performance smoke tests
├── docs/                     # Architecture, DevOps, and workflow guides
├── nginx/                    # Reverse proxy configs, SSL certs, and entrypoints
├── Makefile                  # Project automation commands
└── README.md                 # Project guide and team progress tracker
```

---

## Development Quickstart

### 1. Prerequisites
- Docker & Docker Compose
- Python 3.12+ (or `uv` package manager)
- Make

### 2. Environment Configuration
Copy the template and configure your secrets (including 42 OAuth UID/SECRET and Gemini API keys):
```bash
cp deploy/.env.example deploy/.env
```

### 3. Start the Development Stack
Build and launch PostgreSQL and the backend API container:
```bash
make dev-build
```
To start without rebuilding:
```bash
make dev
```

### 4. Database Migrations & Curriculum Ingestion
Run database migrations:
```bash
make migrate
```
Ingest 42 curriculum subject PDFs and compute embeddings:
```bash
make ingest
```

### 5. Running Tests
Run the test suite inside the backend:
```bash
make test
# Or directly via uv:
cd backend && uv run --extra dev pytest
```

### 6. Resetting the Environment
If you need a clean reset of database volumes:
```bash
make down-volumes
make dev-build
```

---

> [!TIP]
> **Before Opening a PR**:
> 1. Ensure all tests pass (`make test`).
> 2. Run Ruff formatting and linting (`make lint`).
> 3. Verify that your branch is rebased on latest `origin/main`.
> 4. Update the **Team Workstreams & Current Progress** section in this `README.md`.
