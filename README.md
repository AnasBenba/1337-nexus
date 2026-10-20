# 1337 Nexus

> An integrated collaborative workspace, peer-to-peer project incubator, and AI-powered curriculum copilot built for the 1337 / 42 Network student community.

---

> [!NOTE]
> **Active Development Notice**: This repository is currently in active development. This document serves as the interim technical guide and development manual. A polished, user-facing production README will be published upon full release and end-to-end frontend integration.

---

## 📌 Project Overview

1337 Nexus bridges curriculum learning, team formation, and real-time project collaboration in a single unified platform. The architecture follows a **flow-oriented, use-case-sliced monorepo** structure designed for modular scalability and clean team ownership.

### Core Pillars
1. **AI Copilot & Curriculum RAG**: Context-aware AI assistant grounded in 42 curriculum project guides and documentation using pgvector semantic retrieval and real-time token streaming.
2. **Pitches & Peer Incubator**: A platform for students to pitch software ideas, recruit teammates, and launch projects.
3. **Collaborative Workspaces**: Real-time collaborative canvas (Yjs CRDT) and Kanban project management boards.
4. **Campus & Network Identity**: 42 Intra OAuth integration with campus-specific contexts.

---

## 👥 Team Ownership

The monorepo is developed by a dedicated team with full-stack vertical slice ownership:

| Member | Focus Area | Responsibilities |
| :--- | :--- | :--- |
| **Zoubair** | **AI Co-Pilot & RAG** | Curriculum RAG pipeline, pgvector vector search, LLM integrations, streaming copilot |
| **Anas** | **DevOps & Infrastructure** | Docker orchestration, CI/CD pipelines, reverse proxy, deployment reliability |
| **Sfy** | **Auth & Campus Admin** | 42 OAuth login flow, JWT security, campus management & user administration |
| **Yassin** | **Pitches, Chat & Gamification** | Pitch explorer, upvoting, direct & team messaging, user XP/badges |
| **Ayoub** | **Teams, Kanban & Opportunities** | Recruitment, application workflows, Kanban board columns and cards |

---

## 🚀 Current Milestone & Status

We are currently completing the foundational backend services, vector retrieval pipeline, and real-time streaming infrastructure.

### ✅ What is Working Right Now
- **Containerized Infrastructure**: Docker Compose setup orchestrating PostgreSQL 17 (with `pgvector`), FastAPI, and Nginx.
- **Curriculum Ingestion Pipeline**: CLI tool (`app.cli.ingest_subjects`) parsing markdown and PDF subject briefs, chunking text using recursive token splitting with header metadata preservation, and generating 1536-dimensional embeddings.
- **Semantic Curriculum Retrieval**: Fully tested semantic search service (`POST /api/v1/copilot/retrieve-curriculum`) querying nearest chunks via cosine distance.
- **Copilot Ask Phase 1 (AI-202)**: High-speed pre-stream retrieval and database transaction (`copilot_threads`, `copilot_messages`) committing state in $< 50\text{ms}$ to eliminate DB connection pool starvation during inference.
- **Provider Abstraction**: Dual-mode AI provider supporting Google Gemini (`gemini-2.5-flash`, `gemini-embedding-001`) and deterministic in-memory stubs for offline testing.
- **Test Suite**: 100% passing test suite across chunking, AI providers, retrieval, and copilot services.

### 🔄 In Progress
- **Phase 2 & 3 of Copilot Ask**: Real-time SSE token streaming (`POST /api/v1/copilot/ask`) with grounded citation chips.
- **Frontend Flow Integration**: React + TypeScript client applications for Pitches, Copilot chat, and Kanban.
- **Collaboration Tools**: Real-time canvas documents and Kanban board integration.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0 (AsyncIO), Alembic, Pydantic v2
- **Vector Database**: PostgreSQL 17 with `pgvector`
- **AI & Embeddings**: Google Gemini API (`google-genai`), LangChain text splitters, tiktoken
- **Frontend**: React, TypeScript, Vite, Tailwind CSS (in development)
- **DevOps & Tooling**: Docker, Docker Compose, `uv`, Ruff, Mypy, Pytest

---

## 💻 How to Run the Project Right Now

### 1. Prerequisites
- **Linux or WSL2 (Ubuntu recommended)**
- **Docker & Docker Compose**
- **Python 3.12+** (managed via `uv` or system virtualenv)
- **Node.js 20+** (for frontend)

---

### 2. Docker Compose (Quickest Full-Stack Setup)

To spin up the PostgreSQL vector database and backend container:

```bash
# Clone the repository
git clone https://github.com/your-org/1337-nexus.git
cd 1337-nexus

# Launch backend and postgres containers
docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.dev.yml \
  up --build -d
```

- API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/health/live](http://localhost:8000/health/live)

---

### 3. Local Backend Development (Recommended for Testing & CLI)

#### A. Set up Python Virtual Environment
We recommend using [uv](https://github.com/astral-sh/uv) for fast package management:

```bash
cd backend

# Install all dependencies (production + development)
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

All code in this repository adheres to strict type safety and linting standards:

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
│   │       ├── copilot/        # AI Copilot: ask, retrieve_curriculum
│   │       ├── opportunities/  # Recruitment & application flows
│   │       └── pitches/        # Student project pitches
│   └── tests/                  # Pytest test suite
├── content/                    # Markdown & PDF subject files for ingestion
├── deploy/                     # Docker Compose configurations & env templates
├── docs/                       # Architecture guides, workstream definitions
└── frontend/                   # React frontend application
```

---

## 📝 Roadmap & Final Release Checklist

- [x] Vector database schema with pgvector & HNSW indexes
- [x] Automated subject document ingestion & embedding pipeline
- [x] Semantic vector similarity search service (`retrieve-curriculum`)
- [x] Fast pre-stream retrieval and short DB transaction (`copilot/ask` Phase 1)
- [ ] SSE token streaming generator and completed response finalizer (`copilot/ask` Phase 2 & 3)
- [ ] React UI Copilot chat component with streaming markdown & source citations
- [ ] Pitches, Teams, and Kanban flow completion
- [ ] Real-time canvas documents with CRDT synchronization
- [ ] Comprehensive End-to-End User Documentation & Deployment Guide
