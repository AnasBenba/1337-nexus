# 1337 Nexus

> An integrated collaborative workspace, peer-to-peer project incubator, and AI-powered curriculum copilot built for the 1337 / 42 Network student community.

---

> [!NOTE]
> **Active Development Notice**: This repository is currently in an active 30-day development cycle. This document serves as the interim engineering guide and milestone tracker. A polished, user-facing production manual will be published upon full release and end-to-end frontend integration.

---

## 📌 Project Overview

1337 Nexus bridges curriculum learning, team formation, and real-time project collaboration in a single unified platform. The architecture follows a **flow-oriented, use-case-sliced monorepo** structure designed for modular scalability and clean team ownership across 6 core technical domains.

---

## 👥 Team Ownership & Technical Domains

Work is organized around 6 domain prefixes managed on the GitHub Project Board:

| Domain | Focus Area | Owner | GitHub Handle | Key Responsibilities |
| :--- | :--- | :--- | :--- | :--- |
| **`AI`** | **AI Copilot & Knowledge Engine** | **Zoubair** | `@zombie00Y` | Subject corpus ingestion, Gemini embeddings, pgvector retrieval, streaming copilot |
| **`CV`** | **Collaborative Canvas** | **Zoubair** | `@zombie00Y` | Socket.IO binary CRDT relay, canvas compaction engine, collaborative whiteboard UI |
| **`INFRA`**| **DevOps & Infrastructure** | **Anas** | `@AnasBenba` | Multi-container Docker topology, Nginx proxy, memory tuning, CI/CD pipelines |
| **`IDNT`** | **Identity, Auth & Admin** | **Soufiane** | `@souf-bo` | 42 Intra OAuth2 PKCE, dual-token JWT rotation, campus hierarchy, admin moderation |
| **`RTK`** | **Recruitment, Teams & Kanban** | **Ayoub** | `@aykaouf` | Recruitment postings, matching, Lexorank Kanban drag-and-drop, GitHub polling |
| **`SDG`** | **Social, Discovery & Gamification**| **Yassine** | `@Yassine-Atmouioud` | Pitch CRUD, markdown sanitization, team/DM chat, XP ledger, leaderboards |

---

## 🚀 Current Milestone & Sprint Status

The project is tracking 30 core tickets on the unified board:
- **Completed**: 9 tickets (~30%)
- **In Progress**: 5 tickets (~17%)
- **Backlog**: 16 tickets (~53%)

### ✅ What is Working Right Now
- **Infrastructure (`INFRA-001..003, 005`)**: PostgreSQL 17 + `pgvector` container with tuned 512MB memory limit, Nginx reverse proxy, and operational bootstrap/backup scripts.
- **Authentication (`IDNT-001`)**: 42 Intra OAuth2 authorization code flow with PKCE/state verification.
- **RAG & Embeddings (`AI-101, 102, 201`)**: Subject corpus parsing, recursive token splitting with markdown header preservation, Google Gemini 1536-d embeddings, and pgvector cosine distance retrieval (`POST /api/v1/copilot/retrieve-curriculum`).
- **Copilot Pre-Stream Engine (`AI-202` Phase 1)**: Short-transaction ($< 50\text{ms}$) pre-stream engine recording `copilot_threads` and `copilot_messages` without connection pool holding.
- **Recruitment Core (`RTK-001`)**: Opportunity listings, applicant match scoring, and review lifecycle merged into main.

### 🔄 Active In-Flight Work
- **`[AI-202]` / `[AI-203]`**: Token-by-token Server-Sent Events (SSE) streaming endpoint and frontend reader.
- **`[INFRA-004]`**: GitHub Actions CI/CD pipeline with automated Ruff, Mypy, and Vitest gates.
- **`[IDNT-002]`**: Dual-token JWT HttpOnly cookie lifecycle with automated refresh token rotation.
- **`[SDG-001]`**: Pitch CRUD workflows with markdown sanitization and search indexing.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0 (AsyncIO), Alembic, Pydantic v2
- **Vector Database**: PostgreSQL 17 with `pgvector` (HNSW indexing)
- **AI & Embeddings**: Google Gemini (`gemini-2.5-flash`, `gemini-embedding-001`), LangChain splitters, tiktoken
- **Realtime & CRDT**: Socket.IO, `pycrdt` (Yjs Rust binding)
- **Frontend**: React, TypeScript, Vite, Tailwind CSS (in development)
- **DevOps**: Docker, Docker Compose, Nginx, `uv`, Ruff, Mypy, Pytest

---

## 💻 How to Run the Project Right Now

### 1. Prerequisites
- **Linux or WSL2 (Ubuntu 22.04 / 24.04)**
- **Docker & Docker Compose**
- **Python 3.12+** (managed via `uv`)
- **Node.js 20+**

---

### 2. Docker Compose (Quickest Full-Stack Setup)

To spin up the PostgreSQL vector database and backend container:

```bash
# Clone the repository
git clone https://github.com/AnasBenba/1337-nexus.git
cd 1337-nexus

# Launch backend and postgres containers
docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.dev.yml \
  up --build -d
```

- Interactive OpenAPI Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Probe: [http://localhost:8000/health/live](http://localhost:8000/health/live)

---

### 3. Local Backend Development (Recommended for Development & Pytest)

#### A. Set up Python Virtual Environment
```bash
cd backend

# Sync all production and development dependencies via uv
~/.local/bin/uv sync --extra dev

# Activate virtual environment
source .venv/bin/activate
```

#### B. Configure Environment Variables
Ensure `backend/.env` contains your database and AI keys:
```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/nexus
AI_PROVIDER=stub         # or 'remote' / 'gemini'
GEMINI_API_KEY=your_key  # required if AI_PROVIDER=remote
```

#### C. Run Database Migrations
```bash
alembic upgrade head
```

#### D. Ingest Curriculum Subjects
To index 42 subjects into pgvector for the copilot:
```bash
python -m app.cli.ingest_subjects --content-dir content/subjects/
```

#### E. Start the FastAPI Dev Server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## 🧪 Testing & Code Quality

All pull requests must pass tests, linting, and strict type-checking before merging:

```bash
cd backend
source .venv/bin/activate

# 1. Run all unit & integration tests
pytest -v

# 2. Run Ruff linter and formatter checks
ruff check .
ruff format --check .

# 3. Run strict Mypy type-checking
mypy -p app.user.copilot.ask -m app.models.copilot
```

---

## 📁 Repository Structure

```text
1337-nexus/
├── backend/
│   ├── alembic/                # Database migrations (PostgreSQL + pgvector)
│   ├── app/
│   │   ├── cli/                # Management commands (e.g. subject ingestion)
│   │   ├── core/               # App configuration, DB session management
│   │   ├── models/             # SQLAlchemy ORM models (curriculum, copilot)
│   │   ├── shared/             # Shared AI client, providers (Gemini & Stub)
│   │   └── user/               # Use-case sliced user features:
│   │       ├── copilot/        # AI Copilot: ask (SSE), retrieve_curriculum
│   │       ├── opportunities/  # Recruitment & application flows
│   │       └── pitches/        # Student project pitches
│   └── tests/                  # Pytest test suite
├── content/                    # Markdown & PDF subject files for ingestion
├── deploy/                     # Docker Compose configurations & env templates
├── docs/                       # Architecture guides, workstream definitions
└── frontend/                   # React frontend application
```

---

## 📋 Ticket Tracking & Sprint Roadmap

### Infrastructure (`INFRA`)
- [x] `[INFRA-001]` 3-container topology over dedicated Docker bridge network
- [x] `[INFRA-002]` Nginx HTTPS termination, SPA serving, and proxy routing
- [x] `[INFRA-003]` Tune PostgreSQL config for 0.5 GB memory limit
- [ ] `[INFRA-004]` GitHub Actions CI/CD pipeline with Ruff, mypy, and Vitest
- [x] `[INFRA-005]` Bootstrap and backup operational scripts

### Identity & Security (`IDNT`)
- [x] `[IDNT-001]` 42 Intra OAuth2 Authorization Code flow with PKCE/state
- [ ] `[IDNT-002]` Dual-token JWT HttpOnly lifecycle with refresh rotation
- [ ] `[IDNT-003]` PostgreSQL tree campus hierarchy for subtree scope resolution
- [ ] `[IDNT-004]` Campus Admin moderation dashboard with queue and immutability
- [ ] `[IDNT-005]` Frontend 42 Intra SSO sign-in and profile onboarding

### AI Copilot & Knowledge Engine (`AI`)
- [x] `[AI-101]` Provider Abstraction & Deterministic Stub
- [x] `[AI-102]` Subject Corpus & CLI Ingestion Pipeline
- [x] `[AI-201]` Vector Distance Retrieval Query (pgvector cosine search)
- [ ] `[AI-202]` Server-Sent Events (SSE) Streaming Endpoint
- [ ] `[AI-203]` Frontend SSE Stream Reader & Co-Pilot UI
- [ ] `[AI-101]` Transactional Database Task Queue (`ai_jobs`)
- [ ] `[AI-102]` Pitch Refiner Workflow

### Collaborative Canvas (`CV`)
- [ ] `[CV-401]` Socket.IO Binary CRDT Relay
- [ ] `[CV-402]` Canvas Snapshot Compaction Engine
- [ ] `[CV-403]` Collaborative Whiteboard UI

### Recruitment, Teams & Kanban (`RTK`)
- [x] `[RTK-001]` Recruitment postings, match scoring, and review lifecycle
- [ ] `[RTK-002]` Atomic workspace provisioning on founder acceptance
- [ ] `[RTK-003]` Frontend Kanban drag-and-drop UI and recruitment review queue
- [ ] `[RTK-004]` GitHub polling engine with X-Poll-Interval compliance
- [ ] `[RTK-005]` Kanban backend with Lexorank ordering and board revision guards

### Social, Discovery & Gamification (`SDG`)
- [ ] `[SDG-001]` Pitch CRUD with Markdown, sanitization, and pgvector search
- [ ] `[SDG-002]` Realtime chat backend for team and DM namespaces
- [ ] `[SDG-003]` Immutable `xp_events` ledger and automated badge evaluation
- [ ] `[SDG-004]` In-app notifications persistence and notify push namespace
- [ ] `[SDG-005]` Pitch Explorer feed, live Chat UI, and Campus Leaderboards
