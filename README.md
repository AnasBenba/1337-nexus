*This project has been created as part of the 42 curriculum by souel-bo, zoentifi, yaaitmou, aylaaouf, abenba.*

# 1337 Nexus

## Description

**1337 Nexus** is a full-stack collaborative campus platform built for the 1337 / 42 student network. It brings project ideation, team recruitment, real-time visual collaboration, and an AI curriculum assistant into a single web application.

### Key Features
- **Peer Project Incubator & Team Workspaces:** Publish project pitches, recruit teammates for open roles, and coordinate tasks on a shared Kanban board.
- **Curriculum AI Co-Pilot (RAG):** Ask questions about 42 curriculum subjects and receive streamed answers grounded in official subject documents via vector similarity search.
- **AI Pitch Refiner:** Request structured AI critiques and field-by-field improvement suggestions for project pitches.
- **Real-Time Collaborative Whiteboard:** Brainstorm architectures on an infinite multi-user canvas with live peer cursors and persistent snapshots.
- **Direct Messaging, Friends & Presence:** Connect with peers, track online status, and chat in real time over WebSockets.
- **Observability & Administration:** Role-based user management and live infrastructure monitoring with Prometheus and Grafana.

---

## Instructions

### Prerequisites
- **Docker Engine** (v24+) & **Docker Compose** (v2.20+)
- **GNU Make**

### Step-by-Step Setup

1. **Create the environment configuration:**
   ```bash
   cp deploy/.env.example deploy/.env
   ```
   Fill in your 42 OAuth credentials (`OAUTH42_CLIENT_ID`, `OAUTH42_CLIENT_SECRET`) and Gemini API key (`GEMINI_API_KEY`) in `deploy/.env`.

2. **Build and launch the stack (single command):**
   ```bash
   make up
   ```
   This builds all containers, starts PostgreSQL (`pgvector`), applies Alembic migrations, starts the FastAPI/Socket.IO backend and Nginx TLS gateway, ingests the curriculum subjects, and launches Prometheus and Grafana.

3. **Access the application:**
   - **Web Application:** `https://localhost:8443`
   - **API Documentation (Swagger):** `https://localhost:8443/docs`
   - **Grafana Dashboards:** `https://localhost:8443/grafana/`

4. **Useful commands:**
   ```bash
   make ps            # Check container status and health
   make logs          # Follow container logs
   make ingest        # Re-run curriculum subject ingestion
   make down          # Stop all containers
   make down-volumes  # Stop containers and wipe volumes
   ```

---

## Team Information

| Member | 42 Login | Assigned Role(s) | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Soufiane El Bourakkadi** | `souel-bo` | **Project Manager (PM) & Developer** | Sprint coordination, 42 Intra OAuth 2.0 + email/password authentication, JWT cookie session rotation, user profiles, friends, and admin user management. |
| **Zoubair Entifi** | `zoentifi` | **Product Owner (PO) & Developer** | Product vision and feature backlog, RAG curriculum ingestion & vector retrieval, streaming AI Co-Pilot, AI Pitch Refiner, and real-time collaborative whiteboard. |
| **Anas Benba** | `abenba` | **Technical Lead / Architect & Developer** | System architecture, Docker Compose orchestration, Nginx TLS gateway, PostgreSQL role separation, Socket.IO ASGI server integration, and Prometheus/Grafana monitoring. |
| **Ayoub Laaoufi** | `aylaaouf` | **Developer** | Opportunities recruitment marketplace, applicant match scoring, join-request review workflow, team formation, and shared Kanban workspace board. |
| **Yassine Ait Mouloud** | `yaaitmou` | **Developer** | Project pitch feed, pitch creation and voting, comment threads, real-time WebSocket chat, and responsive navigation layout. |

---

## Project Management

- **Work Organization:** We organized development into iterative milestones (foundation & infrastructure, core domain flows, real-time/AI integration, and stabilization). Each feature was owned end-to-end across database, backend, and frontend.
- **Tools Used:** Git & GitHub (feature branches, pull request reviews, and issue tracking).
- **Communication Channels:** Discord for daily coordination and debugging sessions, combined with in-person campus syncs at 1337.

---

## Technical Stack

- **Frontend:** **React 18**, **TypeScript**, **Vite**, **Tailwind CSS**, and **Socket.IO Client**. Chosen for type safety, fast reactive UI updates, and smooth handling of real-time streams and canvas state.
- **Backend:** **Python 3.12**, **FastAPI**, **Uvicorn (ASGI)**, **Pydantic v2**, and **Python-SocketIO**. Chosen for native async concurrency, strict request validation, and seamless integration with Python AI/document processing libraries.
- **Database & ORM:** **PostgreSQL 17** with **`pgvector`**, **SQLAlchemy 2.0 (Async)**, and **Alembic**. Allows relational application data and 1536-dimensional vector embeddings to live in a single transactional database.
- **Infrastructure & Monitoring:** **Docker Compose**, **Nginx** (HTTPS reverse proxy on port `8443`), **Prometheus**, and **Grafana**.

---

## Database Schema

- **Identity & Social:** `users`, `refresh_tokens`, `friendships` — Stores user accounts, roles (`user`, `admin`, `superadmin`), session tokens, and friend connections.
- **Pitch Incubator & AI Jobs:** `pitches`, `pitch_votes`, `comments`, `jobs` — Stores project pitches, community votes, discussions, and background AI refinement jobs.
- **Opportunities & Workspaces:** `opportunities`, `opportunity_members`, `join_requests`, `kanban_columns`, `kanban_cards` — Manages team recruitment, memberships, and project task boards.
- **Messaging & Notifications:** `conversations`, `conversation_participants`, `direct_messages`, `notifications` — Persists chat threads, direct messages, and alerts.
- **RAG Curriculum Knowledge Base:** `subjects`, `subject_documents`, `curriculum_chunks` (with `vector(1536)` HNSW index), `copilot_threads`, `copilot_messages` — Stores chunked 42 subjects, embeddings, and AI chat history.
- **Collaborative Canvas:** `canvas_rooms`, `canvas_snapshots`, `canvas_deltas` — Stores whiteboard rooms, drawing strokes, and compacted state snapshots.

---

## Features List

| Feature | Description | Team Member(s) |
| :--- | :--- | :--- |
| **Authentication & Sessions** | 42 OAuth 2.0 PKCE login, email/password auth, and `HttpOnly` JWT rotation. | `souel-bo` |
| **Profiles, Friends & Admin** | Profile editing, avatar uploads, friend requests, and admin user/role management. | `souel-bo` |
| **Curriculum RAG Co-Pilot** | Subject ingestion, `pgvector` similarity search, and SSE streaming AI chat with citations. | `zoentifi` |
| **AI Pitch Refiner** | Asynchronous AI pitch critique with one-click field-level suggestion application. | `zoentifi` |
| **Collaborative Whiteboard** | Multi-user infinite canvas with live peer cursors, shape tools, and state compaction. | `zoentifi`, `abenba` |
| **Opportunities & Kanban** | Team recruitment marketplace, applicant match scoring, and LexoRank Kanban board. | `aylaaouf` |
| **Pitch Feed & Live Chat** | Project pitch feed, voting, comments, and real-time WebSocket direct messaging. | `yaaitmou` |
| **Docker, TLS & Monitoring** | Single-command Docker stack, Nginx HTTPS gateway, and Prometheus/Grafana dashboards. | `abenba` |

---

## Modules

The subject requires a minimum of **14 points** (maximum **19 points** with bonus). Our project implements **19 points** across 11 modules:

| Category | Module | Type | Points | Implementation Summary |
| :--- | :--- | :---: | :---: | :--- |
| **Web** | Use a framework for both the frontend and backend | Major | **2 pts** | React 18 TypeScript SPA frontend paired with an async FastAPI REST/SSE backend. |
| **Web** | Implement real-time features using WebSockets | Major | **2 pts** | ASGI Socket.IO server managing live namespaces for chat, online presence, and canvas sync. |
| **Web** | Allow users to interact with other users | Major | **2 pts** | Real-time direct messaging, user profile pages, and a bidirectional friends system. |
| **Web** | Use an ORM for the database | Minor | **1 pt** | SQLAlchemy 2.0 Async ORM models and sessions paired with Alembic schema migrations. |
| **Web** | Real-time collaborative features | Minor | **1 pt** | Shared multi-user whiteboard broadcasting drawing deltas and live cursor positions. |
| **User Mgmt** | Standard user management and authentication | Major | **2 pts** | Profile updates, avatar upload with default fallback, friend list with online status, and profile views. |
| **User Mgmt** | Advanced permissions system | Major | **2 pts** | Role-based access control (`user`, `admin`, `superadmin`) and admin dashboard for user CRUD and moderation. |
| **User Mgmt** | Remote authentication with OAuth 2.0 | Minor | **1 pt** | 42 Intra OAuth 2.0 authorization code flow with PKCE verification. |
| **AI** | A complete RAG system | Major | **2 pts** | Curriculum PDF/Markdown chunking, Gemini embeddings, `pgvector` cosine retrieval, and grounded Co-Pilot chat. |
| **AI** | A complete LLM system interface | Major | **2 pts** | SSE token streaming for Co-Pilot, structured JSON critiques in Pitch Refiner, rate limiting, and error recovery. |
| **DevOps** | Monitoring system with Prometheus and Grafana | Major | **2 pts** | Prometheus scraping FastAPI, PostgreSQL, Nginx, and host exporters with pre-provisioned Grafana dashboards and alerts. |
| **Total** | **8 Major (16 pts) + 3 Minor (3 pts)** | — | **19 pts** | **Exceeds the 14-point requirement (full 19-point score with bonus).** |

---

## Individual Contributions

- **`souel-bo` (Soufiane El Bourakkadi — PM & Developer):** Coordinated team sprints and task progress. Built the authentication system (42 Intra OAuth 2.0 PKCE and local email/password login) with dual-token `HttpOnly` cookie rotation, user profile and avatar management, the friends system, and the admin user management panel. Overcame silent session renewal challenges so expired access tokens refresh smoothly without interrupting navigation.
- **`zoentifi` (Zoubair Entifi — PO & Developer):** Defined product requirements and user flows. Built the RAG curriculum ingestion CLI (with SHA-256 hash and chunk vector caching), `pgvector` similarity search, the SSE streaming AI Co-Pilot, the asynchronous AI Pitch Refiner, and the interactive Collaborative Whiteboard frontend. Solved database connection starvation during long LLM streams by separating short pre-stream and post-stream database transactions from the live stream.
- **`abenba` (Anas Benba — Technical Lead / Architect & Developer):** Designed the multi-container Docker architecture, Nginx TLS reverse proxy, least-privilege PostgreSQL roles (`nexus_app` vs `nexus_migrator`), ASGI Socket.IO integration, and the Prometheus/Grafana monitoring stack. Resolved container memory pressure during heavy PDF ingestion and configured WebSocket proxy timeouts for stable real-time connections.
- **`aylaaouf` (Ayoub Laaoufi — Developer):** Built the Opportunities recruitment workflow, skill-based match scoring, join-request moderation, team management, and the workspace Kanban board with LexoRank fractional ordering for `O(1)` card drag-and-drop updates.
- **`yaaitmou` (Yassine Ait Mouloud — Developer):** Built the project pitch discovery feed, pitch creation and voting, nested comments, real-time Socket.IO direct messaging with unread counters, and the responsive application shell.

---

## Resources

### References
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [SQLAlchemy 2.0 Async Documentation](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Python-SocketIO Documentation](https://python-socketio.readthedocs.io/)
- [Prometheus](https://prometheus.io/docs/) & [Grafana Documentation](https://grafana.com/docs/)

### AI Usage Disclosure
In accordance with the subject guidelines, AI tools were used during development to assist with:
- Generating initial boilerplate and test scaffolding.
- Debugging asynchronous SQLAlchemy, WebSocket, and TypeScript issues.
- Reviewing documentation formatting.

All architecture decisions, business logic, and final implementations were written, reviewed, and verified by the team.
