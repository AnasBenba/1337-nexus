*This project has been created as part of the 42 curriculum by souel-bo, yaaitmou, zoentifi, aylaaouf, abenba.*

# 1337 Nexus

> An integrated collaborative workspace, peer-to-peer project incubator, and AI-powered curriculum copilot built for the 1337 / 42 Network student community.

---

## 📖 Description

**1337 Nexus** is a unified web platform designed to solve the real-world collaboration and curriculum navigation challenges faced by students in the 42 Network. At 1337, peer-to-peer learning is at the heart of the pedagogy, yet students frequently struggle with three core bottlenecks: finding teammates with complementary skill sets, breaking down complex project subject PDFs, and coordinating real-time brainstorming sessions.

1337 Nexus solves this by integrating:
1. **Curriculum AI Copilot (RAG):** An intelligent, grounded subject assistant powered by semantic vector embeddings (`pgvector`) that answers curriculum questions with verified citations from official 42 project documentation.
2. **Project Pitch & Peer Recruitment Incubator:** A marketplace where students publish project ideas, apply for open roles, and form balanced teams with automated match scoring.
3. **Real-Time Collaborative Canvas:** A shared, multi-user whiteboard utilizing binary state relays and automated snapshot compaction for live brainstorming.
4. **Real-Time Team Communication:** Instant messaging with dedicated namespaces for team chat, direct messages, and online presence tracking.
5. **Production Infrastructure & Observability:** Hardened Docker orchestration with an Nginx reverse proxy, SSL/TLS encryption, and a full Prometheus & Grafana monitoring stack.

---

## 👥 Team Information & Assigned Roles

As required by Chapter II.1 of the subject, our team established clear organizational responsibilities from day one:

| Member | 42 Login | Primary Role | Secondary Role | Key Responsibilities |
| :--- | :--- | :--- | :--- | :--- |
| **Anas Benba** | `abenba` | **Technical Lead / Architect** | **DevOps Engineer** | Docker orchestration, Nginx reverse proxy, SSL/TLS, PostgreSQL tuning & RBAC, Prometheus & Grafana monitoring, ASGI Socket.IO server, database pooling. |
| **Soufiane El Bourakkadi** | `souel-bo` | **Product Owner (PO)** | **Security & Auth Lead** | 42 Intra OAuth 2.0 PKCE integration, dual-token JWT rotation (HttpOnly cookies), role-based permissions (Admin CRUD), superadmin bootstrap CLI. |
| **Ayoub Laaoufi** | `aylaaouf` | **Project Manager (PM)** | **Fullstack Developer** | Sprint planning, team coordination, Opportunities recruitment workflows, applicant match scoring, team formation, Kanban board architecture. |
| **Zoubair Entifi** | `zoentifi` | **AI Engineer** | **Fullstack Developer** | Curriculum document ingestion pipeline, Google Gemini embeddings, pgvector cosine search, SSE streaming Copilot UI, Collaborative Canvas engine. |
| **Yassine Ait Mouloud** | `yaaitmou` | **Fullstack Developer** | **UI/UX Lead** | Project pitch CRUD, Markdown rendering & sanitization, real-time WebSocket chat system, in-app notifications, and responsive navigation layouts. |

---

## 🛠️ Technical Stack & Architectural Justifications

```
                                  Internet Traffic (HTTPS)
                                             │
                                             ▼ Port 8443 (TLS Termination)
                                   ┌───────────────────┐
                                   │       Nginx       │
                                   └─────────┬─────────┘
                                             │ Internal Docker Bridge Network (nexus)
               ┌─────────────────────────────┼─────────────────────────────┐
               ▼                             ▼                             ▼
      ┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
      │     Backend     │           │    PostgreSQL   │           │     Grafana     │
      │  FastAPI (8000) │           │ pgvector (5432) │           │ Dashboard (3000)│
      └────────┬────────┘           └────────┬────────┘           └────────▲────────┘
               │                             │                             │
               │ (Scrapes /metrics)          │ (postgres-exporter:9187)    │
               └──────────────┬──────────────┴─────────────────────────────┤
                              ▼                                            │
                      ┌────────────────┐                                   │
                      │   Prometheus   │───────────────────────────────────┘
                      │ Metrics (9090) │
                      └────────────────┘
```

### 1. Frontend: React 18, TypeScript & Vite
- **Choice:** React with TypeScript and Vite.
- **Justification:** React provides a declarative component model essential for handling complex reactive states (live chat streams, collaborative canvas cursors, real-time notifications). TypeScript eliminates runtime null/undefined errors across team modules. Vite ensures instantaneous Hot Module Replacement (HMR) and optimized production tree-shaking.

### 2. Backend: FastAPI (Python 3.12) & Uvicorn
- **Choice:** FastAPI running on the ASGI standard via Uvicorn.
- **Justification:** Python was chosen to seamlessly leverage modern AI and vector manipulation libraries (`langchain`, `pymupdf4llm`, `tiktoken`). FastAPI delivers automatic OpenAPI/Swagger documentation, strict type validation via Pydantic v2, and high-performance asynchronous concurrency via `asyncio`.

### 3. Database: PostgreSQL 17 with `pgvector`
- **Choice:** Relational PostgreSQL extended with the `vector` extension.
- **Justification:** Eliminates the operational complexity of managing a separate vector database. PostgreSQL provides ACID guarantees for relational business entities (users, teams, chat messages) while `pgvector` executes high-speed cosine distance similarity queries ($< 15\text{ms}$) on 1536-dimensional embeddings.

### 4. Database Access & Migrations: SQLAlchemy 2.0 (Async) & Alembic
- **Choice:** SQLAlchemy Async Engine with Alembic migration versioning.
- **Justification:** Allows fully non-blocking database queries with connection pooling (`pool_pre_ping=True`, `expire_on_commit=False`). Alembic guarantees deterministic schema version control and zero-downtime database upgrades during container boot.

### 5. Real-Time Layer: Python-SocketIO (ASGI)
- **Choice:** Socket.IO mounted as an ASGI middleware wrapper over FastAPI.
- **Justification:** Enables both standard REST requests and persistent, bi-directional WebSockets to share a single backend port (8000), cleanly isolated into distinct namespaces (`/chat`, `/canvas`, `/presence`).

### 6. Reverse Proxy & Security: Nginx
- **Choice:** Nginx 1.27 Alpine.
- **Justification:** Acts as the single exposed gateway to the host (port 8443). Terminates SSL/TLS, proxies API requests to Uvicorn, upgrades WebSocket connections, serves compiled React SPA assets, and enforces HTTP security headers.

### 7. Observability: Prometheus & Grafana
- **Choice:** Prometheus TSDB paired with Grafana dashboards.
- **Justification:** Enterprise-grade metrics collection via pull-scraping. Monitors container health, request latencies, HTTP error rates, database connection pools, and host hardware metrics.

---

## 🎯 Chosen Modules & Point Breakdown

The ft_transcendence subject requires a minimum of **14 points**. Our project implements **18 points** across 11 modules:

| Category | Module | Type | Points | Implemented By |
| :--- | :--- | :--- | :---: | :--- |
| **Web** | Use a framework for both frontend and backend (React + FastAPI) | Major | **2 pts** | All Team Members |
| **Web** | Implement real-time features using WebSockets (Socket.IO) | Major | **2 pts** | Anas & Yassine |
| **Web** | Allow users to interact with other users (Chat, Profiles, Friends) | Major | **2 pts** | Yassine & Soufiane |
| **Web** | Use an ORM for the database (SQLAlchemy 2.0 Async) | Minor | **1 pt** | Anas Benba |
| **Web** | Real-time collaborative features (Shared Canvas) | Minor | **1 pt** | Zoubair Entifi |
| **Web** | Complete notification system (In-app notifications) | Minor | **1 pt** | Yassine Ait Mouloud |
| **User Mgmt** | Remote authentication with OAuth 2.0 (42 Intra API with PKCE) | Minor | **1 pt** | Soufiane El Bourakkadi |
| **User Mgmt** | Advanced permissions system (Roles, Admin User Management) | Major | **2 pts** | Soufiane El Bourakkadi |
| **AI** | Implement a complete RAG system (Curriculum Vector Search) | Major | **2 pts** | Zoubair Entifi |
| **AI** | Implement a complete LLM system interface (Streaming Copilot) | Major | **2 pts** | Zoubair Entifi |
| **DevOps** | Monitoring system with Prometheus and Grafana | Major | **2 pts** | Anas Benba |
| **TOTAL** | | | **18 pts** | *(Exceeds 14-pt requirement)* |

### Module Implementation Details & Justifications:

1. **Framework for Frontend & Backend (Major - 2 pts):**
   - *Implementation:* React 18 SPA with modular component hierarchy; FastAPI backend with APIRouter composition and dependency injection.
   - *Justification:* Establishes a clean separation of concerns, rapid development iteration, and strong typing end-to-end.

2. **Real-Time Features via WebSockets (Major - 2 pts):**
   - *Implementation:* `python-socketio` ASGI integration listening on `/socket.io/`. Nginx upgrades HTTP requests to persistent WebSockets with a 3600-second read timeout.
   - *Justification:* Allows instant message delivery, live typing states, and online/offline user presence detection without polling.

3. **User Interaction: Chat, Profiles, Friends (Major - 2 pts):**
   - *Implementation:* Multi-channel chat rooms, user profile inspection, avatar upload pipeline, and bidirectional friend requests.
   - *Justification:* Fosters active peer-to-peer engagement, allowing students to network and find project partners.

4. **Monitoring with Prometheus & Grafana (Major - 2 pts):**
   - *Implementation:* Prometheus scrapes metrics from the FastAPI backend (`/metrics`), `postgres-exporter`, `nginx-exporter`, and `node-exporter`. Grafana is auto-provisioned via configuration files with pre-built dashboards.
   - *Justification:* Provides complete visibility into request throughput, latency spikes, database connection usage, and CPU/memory quotas.

5. **Complete RAG System (Major - 2 pts):**
   - *Implementation:* CLI ingestion pipeline converts 42 curriculum PDFs to markdown, performs recursive token chunking (800-token chunks with 100-token overlap), generates 1536-dimensional embeddings, and retrieves relevant context using `pgvector` cosine similarity.
   - *Justification:* Delivers accurate answers directly grounded in official 42 project documentation, preventing hallucination.

6. **Complete LLM System Interface (Major - 2 pts):**
   - *Implementation:* Server-Sent Events (SSE) streaming endpoint (`/api/v1/copilot/ask`), token-by-token response rendering, query rate limiting, and Intra URL source grounding.
   - *Justification:* Provides students with an interactive, responsive AI tutor that helps explain complex C/C++ concepts.

7. **Advanced Permissions System (Major - 2 pts):**
   - *Implementation:* Role hierarchy (`student`, `admin`, `partner`), protected administrative user management dashboard, account status toggling, and role modification guards.
   - *Justification:* Enforces security boundaries and administrative governance across the campus platform.

8. **Database ORM (Minor - 1 pt):**
   - *Implementation:* SQLAlchemy 2.0 with unified `DeclarativeBase`, asynchronous session lifecycles (`get_db_session`), and foreign key relationship mapping.
   - *Justification:* Eliminates raw SQL injection vulnerabilities, provides static type checking for models, and manages connection pooling.

9. **OAuth 2.0 Remote Authentication (Minor - 1 pt):**
   - *Implementation:* 42 Intra authorization code grant with PKCE (Proof Key for Code Exchange) and cryptographic state validation to prevent CSRF.
   - *Justification:* Delivers frictionless single sign-on (SSO) for 1337 students using their campus credentials.

10. **Real-Time Collaborative Features (Minor - 1 pt):**
    - *Implementation:* Collaborative Canvas whiteboard (`/canvas` namespace) broadcasting delta updates to connected participants with periodic snapshot compaction.
    - *Justification:* Allows teammates to sketch software architectures and database schemas collaboratively.

11. **Complete Notification System (Minor - 1 pt):**
    - *Implementation:* Database-backed notification persistence paired with real-time WebSocket alerts on pitch suggestions, recruitment applications, and team updates.
    - *Justification:* Keeps students updated on recruitment responses and project collaboration without page refreshes.

---

## 🗄️ Database Schema & Architecture

The database runs on PostgreSQL 17 with the `vector` extension enabled.

```
       ┌────────────────────────┐
       │         users          │
       ├────────────────────────┤
       │ id (UUID, PK)          │◄─────────────┐
       │ email (VARCHAR)        │              │
       │ role (user_role ENUM)  │              │
       │ login (VARCHAR)        │              │
       └───────────┬────────────┘              │
                   │ 1                         │ 1
                   │                           │
                   │ N                         │ N
       ┌───────────▼────────────┐  ┌───────────┴────────────┐
       │        pitches         │  │     notifications      │
       ├────────────────────────┤  ├────────────────────────┤
       │ id (UUID, PK)          │  │ id (UUID, PK)          │
       │ author_id (UUID, FK)   │  │ recipient_id (UUID, FK)│
       │ title (VARCHAR)        │  │ type (VARCHAR)         │
       │ elevator_pitch (TEXT)  │  │ payload (JSONB)        │
       │ embedding (vector)     │  │ read_at (TIMESTAMP)    │
       └───────────┬────────────┘  └────────────────────────┘
                   │ 1
                   │
                   │ N
       ┌───────────▼────────────┐
       │     opportunities      │
       ├────────────────────────┤
       │ id (UUID, PK)          │
       │ pitch_id (UUID, FK)    │
       │ role_title (VARCHAR)   │
       │ status (VARCHAR)       │
       └───────────┬────────────┘
                   │ 1
                   │
                   │ N
       ┌───────────▼────────────┐
       │      applications      │
       ├────────────────────────┤
       │ id (UUID, PK)          │
       │ opportunity_id (FK)    │
       │ applicant_id (UUID, FK)│
       │ status (VARCHAR)       │
       └────────────────────────┘
```

### Key Data Entities:
- **`users`**: Central identity table storing 42 profile data, avatar URLs, and assigned roles (`student`, `admin`, `partner`).
- **`refresh_tokens`**: Stores hashed refresh tokens with creation and revocation timestamps for secure session rotation.
- **`pitches` & `pitch_votes`**: Incubator project submissions with rich Markdown descriptions and 1536-d semantic embeddings.
- **`opportunities` & `applications`**: Role listings for student teams with match scores and recruitment states (`pending`, `accepted`, `rejected`).
- **`teams` & `team_members`**: Collaborative project workspaces created upon successful recruitment.
- **`chat_messages`**: Persistent chat records scoped by team channels or direct peer messaging.
- **`subjects`, `subject_documents`, `curriculum_chunks`**: The RAG corpus storing tokenized chunks with `vector(1536)` embeddings and HNSW indexes.
- **`canvas_documents` & `canvas_snapshots`**: Real-time whiteboard state storage with compacted document snapshots.

---

## 📋 Comprehensive Features List

### Authentication & User Management
- **42 Intra SSO (OAuth 2.0 PKCE):** Secure sign-in with 42 credentials, state validation, and code verifier verification. *(Soufiane)*
- **Dual-Token Session Security:** Short-lived JWT access tokens and database-backed refresh tokens stored in `HttpOnly`, `SameSite=Lax` cookies. *(Soufiane)*
- **Silent Session Renewal:** Seamless background token rotation on route transitions without console auth errors. *(Soufiane & Anas)*
- **User Profiles & Avatars:** Profile editing, avatar upload with file validation, and automatic media volume storage. *(Soufiane & Anas)*
- **Admin Governance Panel:** Management interface for viewing all campus users, modifying roles, and reviewing activity. *(Soufiane)*

### Curriculum AI Copilot (RAG)
- **Subject Ingestion Engine:** Automated parsing of 42 curriculum PDFs and Markdown files into structured subject modules. *(Zoubair)*
- **Semantic Vector Retrieval:** High-speed cosine distance nearest-neighbor queries on 1536-d subject vectors using `pgvector`. *(Zoubair)*
- **Streaming Copilot Chat:** Token-by-token Server-Sent Events (SSE) AI assistant that answers technical questions with verified citations. *(Zoubair)*

### Project Incubator & Recruitment
- **Pitch Studio:** Creation, editing, and discovery of project ideas with Markdown preview, validation, and upvoting. *(Yassine)*
- **Recruitment Opportunities:** Creation of skill-specific team vacancies with automated applicant profile match scoring. *(Ayoub)*
- **Application Review Lifecycle:** Review workflow allowing project founders to accept or decline applicants. *(Ayoub)*
- **Team Workspace Provisioning:** Automated creation of team spaces upon recruitment acceptance. *(Ayoub)*

### Real-Time Collaboration & Communication
- **Team & Direct Messaging:** Multi-user live chat channels powered by Socket.IO with typing indicators. *(Yassine)*
- **User Presence:** Real-time online/offline status broadcast across the campus network. *(Yassine)*
- **Collaborative Canvas:** Live whiteboard sharing real-time drawing updates across peers. *(Zoubair)*
- **In-App Notifications:** Real-time push alerts and persistent notification history. *(Yassine)*

### DevOps & Infrastructure
- **Single-Command Orchestration:** Fully containerized multi-service topology managed via `make up`. *(Anas)*
- **Nginx Gateway & SSL/TLS:** Reverse proxy handling TLS termination on port 8443, WebSocket upgrades, and client caching. *(Anas)*
- **Database Hardening:** Dual-role PostgreSQL security separating `nexus_app` (DML) from `nexus_migrator` (DDL). *(Anas)*
- **Full Observability Stack:** Prometheus metrics engine pulling data from FastAPI, Postgres, Nginx, and host exporters, visualized via Grafana. *(Anas)*

---

## 🚀 Instructions: How to Run the Project

### 1. Prerequisites
Ensure your host machine has the following installed:
- **Operating System:** Linux (Ubuntu 22.04+ recommended) or macOS / Windows WSL2.
- **Docker Engine:** Version 24.0+
- **Docker Compose:** Version 2.20+
- **Make:** GNU Make

---

### 2. Configuration (`.env`)
The application requires an environment file. Copy the provided template:

```bash
cp deploy/.env.example deploy/.env
```

The default values in `deploy/.env.example` are pre-configured with valid development database credentials, local SSL certificates, and offline AI stubs. If you wish to test with live 42 Intra authentication, add your 42 Application `UID` and `SECRET`.

---

### 3. Launch the Stack (Single Command)
In accordance with the mandatory requirement of Chapter III.2, the entire application boots with a single command from the project root:

```bash
make up
```

*(Alternatively: `docker compose -p 1337-nexus --env-file deploy/.env -f deploy/docker-compose.yml up -d --build`)*

#### What happens during boot:
1. Docker builds the unprivileged Python backend and Nginx images.
2. The isolated bridge network (`nexus`) and persistent volumes are created.
3. PostgreSQL starts and passes its readiness healthcheck (`pg_isready`).
4. The backend container runs `alembic upgrade head` to apply all database migrations.
5. The SuperAdmin account is verified/created.
6. Uvicorn starts the FastAPI application wrapped inside the Socket.IO ASGI server.
7. Curriculum subjects are ingested into `pgvector`.
8. Prometheus, Grafana, and metric exporters start monitoring the stack.

---

### 4. Accessing the Application
Once the stack is running, open your browser:

- **Web Application (React Frontend):** [https://localhost:8443/](https://localhost:8443/)
- **Interactive API Documentation (Swagger):** [https://localhost:8443/docs](https://localhost:8443/docs)
- **Grafana Monitoring Dashboard:** [https://localhost:8443/grafana/](https://localhost:8443/grafana/)
  - *Default Login:* `admin` / `Anasbenba123`
- **Prometheus Metrics:** [https://localhost:8443/metrics](https://localhost:8443/metrics)

---

### 5. Helpful Management Commands

```bash
make down          # Stop all containers cleanly
make down-volumes  # Stop containers and delete database volumes (Fresh start)
make logs          # Tail logs for all running services
make logs-backend  # View FastAPI backend logs
make logs-nginx    # View Nginx reverse proxy logs
make ps            # List running container status and health
```

---

## 👥 Individual Contributions & Challenges Faced

### Anas Benba (`abenba` — DevOps & Technical Lead)
- **Contributions:** Designed the entire container architecture (`deploy/docker-compose.yml`, `backend/Dockerfile`, `nginx/Dockerfile`). Configured Nginx with TLS termination, WebSocket upgrades, and SPA fallback routing. Implemented least-privilege PostgreSQL role separation (`nexus_app` vs `nexus_migrator`) and tuned database memory buffers (`shared_buffers`, `work_mem`). Configured the Prometheus scraping architecture, metric exporters, and Grafana dashboard provisioning. Built the ASGI Socket.IO wrapper in `server.py` and the centralized route aggregator in `api.py`.
- **Challenges & Solutions:** 
  - *Challenge:* When curriculum ingestion ran with large PDFs, the backend container was killed by the Linux kernel with exit code 137.
  - *Solution:* Diagnosed the root cause as the container hitting its strict 800MB `mem_limit`. Tuned the memory allocation to 1500MB, providing adequate headroom for `tiktoken` encoding and PyMuPDF parsing while keeping the host protected.
  - *Challenge:* Preventing database connection leaks during async WebSocket events and REST calls.
  - *Solution:* Implemented FastAPI dependency injection using `try ... yield ... finally: await session.close()` with `expire_on_commit=False` and `pool_pre_ping=True`.

### Soufiane El Bourakkadi (`souel-bo` — Product Owner & Security Lead)
- **Contributions:** Implemented the 42 Intra OAuth 2.0 PKCE authentication flow. Built the cryptographic state validation and code verifier verification. Designed the dual-token JWT architecture with automatic refresh token rotation stored in `HttpOnly` cookies. Created the superadmin initialization CLI and the administrative user governance endpoints.
- **Challenges & Solutions:**
  - *Challenge:* Preventing Cross-Site Scripting (XSS) attacks from stealing authentication tokens.
  - *Solution:* Stored both access and refresh tokens in `HttpOnly`, `SameSite=Lax` cookies, preventing client-side JavaScript access. Designed a dedicated `/api/v1/auth/session` endpoint that silently renews expired access tokens without throwing 401 errors on initial page visits.

### Ayoub Laaoufi (`aylaaouf` — Project Manager & Fullstack Developer)
- **Contributions:** Coordinated team sprints and feature integration. Built the recruitment opportunities schema and REST endpoints (`/opportunities`). Implemented applicant match scoring algorithms to pair students with open project vacancies based on skills and curriculum experience. Designed the applicant review lifecycle and automatic team creation logic.
- **Challenges & Solutions:**
  - *Challenge:* Managing concurrent applications to the same project role without race conditions.
  - *Solution:* Utilized PostgreSQL transactional status updates with strict enum state machines (`pending` $\rightarrow$ `accepted`/`rejected`) to prevent duplicate role assignments.

### Zoubair Entifi (`zoentifi` — AI Engineer & Fullstack Developer)
- **Contributions:** Built the curriculum ingestion pipeline converting 42 subject PDFs into semantic chunks. Integrated Google Gemini embeddings with `pgvector` HNSW indexes. Developed the Server-Sent Events (SSE) streaming Copilot chat endpoint (`/copilot/ask`) with verified Intra URL citations. Developed the Collaborative Canvas binary delta sync engine.
- **Challenges & Solutions:**
  - *Challenge:* AI responses taking too long to generate, leading to poor user experience.
  - *Solution:* Implemented token-by-token Server-Sent Events (SSE) streaming so the student sees answers begin rendering within 400ms rather than waiting for the entire completion.

### Yassine Ait Mouloud (`yaaitmou` — Fullstack Developer & UI/UX Lead)
- **Contributions:** Developed the Project Pitch Studio with live Markdown preview and DOMPurify sanitization. Built the real-time Socket.IO chat messaging system with dedicated room namespaces (`/chat`). Implemented the persistent in-app notifications system and real-time push alerts. Designed responsive UI layouts and navigation headers.
- **Challenges & Solutions:**
  - *Challenge:* Preventing Cross-Site Scripting (XSS) when rendering user-submitted Markdown pitches.
  - *Solution:* Configured multi-layer sanitization: client-side DOMPurify scrubbing combined with backend input validation before persisting pitch content.

---

## 🤝 Project Management & Teamwork

- **Methodology:** Agile-inspired sprints with weekly synchronization meetings to review blocker items and dependencies.
- **Task Organization:** Work breakdown was managed via **GitHub Projects** with domain-specific ticket prefixes (`INFRA`, `IDNT`, `AI`, `RTK`, `SDG`).
- **Communication Channels:** Daily asynchronous updates and technical discussions were conducted via a private **Discord** server. Critical code changes were reviewed via GitHub Pull Requests before merging into `main`.

---

## 📚 Resources & AI Usage Disclosure

### Technical References
- **FastAPI Documentation:** [https://fastapi.tiangolo.com/](https://fastapi.tiangolo.com/)
- **SQLAlchemy 2.0 Asyncio Guide:** [https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- **pgvector Extension Manual:** [https://github.com/pgvector/pgvector](https://github.com/pgvector/pgvector)
- **Python Socket.IO Documentation:** [https://python-socketio.readthedocs.io/](https://python-socketio.readthedocs.io/)
- **React & Vite Documentation:** [https://vitejs.dev/](https://vitejs.dev/)
- **Nginx Reverse Proxy & WebSocket Guide:** [https://nginx.org/en/docs/http/websocket.html](https://nginx.org/en/docs/http/websocket.html)
- **Prometheus & Grafana Setup Guides:** [https://prometheus.io/docs/introduction/overview/](https://prometheus.io/docs/introduction/overview/)

### AI Usage Disclosure (Chapter I & Chapter VI Compliance)
In strict accordance with the 42 AI Instructions (Chapter I):
- **What AI was used for:** AI assistance was utilized to accelerate boilerplate generation (e.g., standard SQLAlchemy model schemas, Docker healthcheck syntax, and regex patterns for subject document parsing), debug complex async traceback errors, and draft documentation.
- **What AI was NOT used for:** The project architecture, business logic, security boundaries, database relational design, and container orchestration were designed, debated, and implemented by the team members. Every generated snippet was reviewed, understood, and defended by the assigned owner.

---

*This project complies with all mandatory requirements and module standards specified in the ft_transcendence subject (Version 21.2).*
