# 1337 Nexus — Recruitment, Teams, Kanban & GitHub

## My Part

**Owner:** Ayoub
**Domain:** Recruitment, Teams, Kanban & GitHub Integration

My responsibility is to implement the backend functionality related to:

1. Recruitment
2. Applications
3. Team/workspace creation after recruitment
4. Kanban boards
5. GitHub activity integration

---

# 1. Project Structure

The backend follows a modular architecture.

Each feature should communicate through its `service.py` instead of directly accessing another module's database layer.

````text
backend/
└── app/
    ├── main.py
    ├── api.py
    │
    ├── core/
    │   ├── config.py
    │   ├── db.py
    │   ├── security.py
    │   ├── errors.py
    │   ├── middleware.py
    │   ├── logging.py
    │   └── uow.py
    │
    ├── user/
    │   └── ...
    │
    ├── # 1337 Nexus — Recruitment, Teams, Kanban & GitHub

## My Part

**Owner:** Ayoub
**Domain:** Recruitment, Teams, Kanban & GitHub Integration

My responsibility is to implement the backend functionality related to:

1. Recruitment
2. Applications
3. Team/workspace creation after recruitment
4. Kanban boards
5. GitHub activity integration

---

# 1. Project Structure

The backend follows a modular architecture.

Each feature should communicate through its `service.py` instead of directly accessing another module's database layer.

```text
backend/
└── app/
    ├── main.py
    ├── api.py
    │
    ├── core/
    │   ├── config.py
    │   ├── db.py
    │   ├── security.py
    │   ├── errors.py
    │   ├── middleware.py
    │   ├── logging.py
    │   └── uow.py
    │
    ├── user/
    │   └── ...
    │
    ├── recruitment/
    │   ├── router.py
    │   ├── schemas.py
    │   ├── service.py
    │   ├── models.py
    │   └── ...
    │
    ├── teams/
    │   ├── router.py
    │   ├── schemas.py
    │   ├── service.py
    │   ├── models.py
    │   └── ...
    │
    ├── kanban/
    │   ├── router.py
    │   ├── schemas.py
    │   ├── service.py
    │   ├── models.py
    │   └── ...
    │
    └── github/
        ├── router.py
        ├── schemas.py
        ├── service.py
        ├── models.py
        └── ...
```

> The exact folder names should follow the existing repository structure. Do not create duplicate modules if they already exist.

---

# 2. Files I Should Write Code In

## Recruitment

### `recruitment/models.py`

Database models related to recruitment.

Possible entities:

```text
RecruitmentPost
Application
RecruitmentSkill
ApplicationSkill
```

Responsibilities:

* Define database tables
* Foreign keys
* Constraints
* Indexes
* Relationships

---

### `recruitment/schemas.py`

Pydantic request/response schemas.

Examples:

```text
CreateRecruitmentPost
UpdateRecruitmentPost
RecruitmentPostResponse

ApplyRequest
ApplicationResponse

ApplicationReviewRequest
```

This file should contain validation and API data structures.

---

### `recruitment/service.py`

Main recruitment business logic.

Responsibilities:

* Create recruitment posts
* Update/close recruitment posts
* Apply to a recruitment post
* Withdraw an application
* Accept an applicant
* Reject an applicant
* Calculate match scores
* Manage application status transitions

Example flow:

```text
Router
   ↓
Service
   ↓
Database / Repository
```

The router should **not** contain the business logic.

---

### `recruitment/router.py`

HTTP endpoints.

For example:

```text
POST   /recruitment
GET    /recruitment
GET    /recruitment/{id}

POST   /recruitment/{id}/apply

POST   /applications/{id}/withdraw
POST   /applications/{id}/accept
POST   /applications/{id}/reject
```

The router receives the request and calls `service.py`.

---

# 3. Team Provisioning

When a founder accepts an applicant, the system should create the required team workspace.

### `teams/models.py`

Database models such as:

```text
Team
TeamMember
TeamChannel
TeamWorkspace
```

---

### `teams/schemas.py`

Request/response schemas for teams.

Examples:

```text
TeamResponse
TeamMemberResponse
TeamCreateResponse
```

---

### `teams/service.py`

Main team business logic.

Important operation:

```text
Accept Applicant
       ↓
Create Team
       ↓
Add Founder
       ↓
Add Accepted Member
       ↓
Create Kanban Board
       ↓
Create Canvas Document
       ↓
Create Team Channel
```

This operation should be **atomic**.

If one required operation fails, the whole transaction should roll back.

---

### `teams/router.py`

Team API endpoints.

Examples:

```text
GET    /teams
GET    /teams/{id}
GET    /teams/{id}/members

POST   /teams/{id}/members
DELETE /teams/{id}/members/{user_id}
```

---

# 4. Kanban

The Kanban board belongs to a team.

The backend should handle:

* Boards
* Columns
* Cards
* Card movement
* Card ordering
* Permissions
* Revision conflicts

---

## `kanban/models.py`

Possible entities:

```text
Board
Column
Card
```

Important fields include:

```text
board_id
column_id
title
description
position
board_revision
created_at
updated_at
```

---

## `kanban/schemas.py`

Examples:

```text
CreateColumn
UpdateColumn

CreateCard
UpdateCard

MoveCardRequest
MoveCardResponse
```

---

## `kanban/service.py`

This contains the Kanban business logic.

Responsibilities:

* Create board
* Create columns
* Create cards
* Update cards
* Move cards
* Delete cards
* Reorder cards
* Handle `board_revision`
* Handle LexoRank positions
* Rebalance positions when necessary

### Card movement

The frontend should send something similar to:

```text
card_id
target_column_id
position
board_revision
```

The backend checks:

```text
Client revision == Current board revision?
```

If not:

```text
409 Conflict
```

If valid:

```text
Move card
Update position
Increment board_revision
Commit transaction
```

---

## `kanban/router.py`

Endpoints could include:

```text
GET    /teams/{team_id}/board

POST   /teams/{team_id}/columns
PATCH  /columns/{column_id}

POST   /columns/{column_id}/cards
PATCH  /cards/{card_id}

POST   /cards/{card_id}/move

DELETE /cards/{card_id}
```

---

# 5. GitHub Integration

The GitHub integration provides activity information for a team/project.

The backend should:

* Connect a team/project to a GitHub repository
* Poll GitHub
* Respect `X-Poll-Interval`
* Use conditional requests when possible
* Cache activity
* Expose GitHub activity to the frontend

---

## `github/models.py`

Possible entity:

```text
GitHubRepository
GitHubActivity
```

Store only the information needed by Nexus.

---

## `github/schemas.py`

Examples:

```text
GitHubRepositoryResponse
GitHubActivityResponse
```

---

## `github/service.py`

Main GitHub logic.

Responsibilities:

```text
Fetch repository
      ↓
Check cache
      ↓
Request GitHub
      ↓
Handle ETag / conditional request
      ↓
Process activity
      ↓
Update cache
```

The service should also respect GitHub's polling instructions such as:

```text
X-Poll-Interval
```

---

## `github/router.py`

Possible endpoints:

```text
POST /teams/{team_id}/github

GET  /teams/{team_id}/github

GET  /teams/{team_id}/github/activity
```

---

# 6. Database

Before implementing all features, understand the existing database setup.

Relevant files:

```text
core/db.py
core/uow.py
```

The database layer should provide:

* SQLAlchemy session
* Transactions
* Unit of Work
* Database connection

Do not create a second database system inside my module.

---

# 7. Database Relationships

High-level relationship:

```text
User
 │
 ├── creates
 │
 ▼
RecruitmentPost
 │
 └── receives
       │
       ▼
   Application
       │
       ├── pending
       ├── accepted
       ├── rejected
       └── withdrawn
              │
              │ accepted
              ▼
             Team
              │
       ┌──────┼─────────┐
       ▼      ▼         ▼
    Members  Kanban   GitHub
               │
          ┌────┼────┐
          ▼    ▼    ▼
       Columns Cards ...
```

---

# 8. Application Lifecycle

```text
                ┌──────────┐
                │ PENDING  │
                └────┬─────┘
                     │
          ┌──────────┼──────────┐
          │          │          │
          ▼          ▼          ▼
      ACCEPTED    REJECTED   WITHDRAWN
          │
          ▼
    Create/Update Team
          │
          ▼
    Add Team Member
```

Invalid state transitions must be rejected.

For example:

```text
REJECTED → ACCEPTED
WITHDRAWN → ACCEPTED
ACCEPTED → PENDING
```

should not be allowed unless explicitly defined by the project specification.

---

# 9. Match Scoring

Applications should be evaluated using the project's defined weighted skills.

Conceptually:

```text
Application
     │
     ▼
Candidate Skills
     │
     +
     │
Recruitment Required Skills
     │
     ▼
Weighted Match Score
     │
     ▼
Application Review
```

The exact scoring formula must follow the project specification.

Do not invent a different scoring system.

---

# 10. Transactions

Important operations must be transactional.

Example:

```text
Accept Application
        │
        ├── Update application
        ├── Create team/member
        ├── Create board
        ├── Create default columns
        ├── Create workspace resources
        └── Commit
```

If any step fails:

```text
ROLLBACK
```

Nothing should be partially created.

---

# 11. Permissions

Backend authorization must verify ownership/roles.

Examples:

```text
Founder
   ├── Manage recruitment
   ├── Accept/reject applicants
   ├── Manage team
   └── Manage Kanban

Team Member
   ├── View team
   ├── Work on Kanban
   └── View GitHub activity
```

Exact permissions must follow the project specification and existing authentication system.

Do not duplicate authentication logic from `core/security.py`.

---

# 12. Implementation Order

I should NOT start by implementing everything at once.

Follow this order:

### Step 1 — Understand existing backend

Read:

```text
main.py
api.py
core/db.py
core/uow.py
core/security.py
```

Understand:

```text
FastAPI
SQLAlchemy
Sessions
Transactions
Dependencies
Authentication
```

---

### Step 2 — Database models

Start with:

```text
recruitment/models.py
teams/models.py
kanban/models.py
github/models.py
```

Define:

* Primary keys
* Foreign keys
* Relationships
* Constraints
* Indexes

---

### Step 3 — Migrations

Create database migrations for the models.

Verify that the database can be created from an empty state.

---

### Step 4 — Recruitment service

Implement:

```text
Create recruitment
List recruitment
View recruitment
Apply
Withdraw
Accept
Reject
```

---

### Step 5 — Team provisioning

Implement:

```text
Accept application
      ↓
Create team
      ↓
Create team member
      ↓
Create default workspace resources
```

Make the operation transactional.

---

### Step 6 — Kanban

Implement in this order:

```text
Board
 ↓
Columns
 ↓
Cards
 ↓
Move cards
 ↓
LexoRank
 ↓
board_revision
 ↓
Conflict handling
```

---

### Step 7 — GitHub

Implement:

```text
Repository connection
 ↓
GitHub API client
 ↓
Polling
 ↓
ETag / conditional requests
 ↓
Cache
 ↓
Activity endpoint
```

---

### Step 8 — Integration tests

Test the complete flows.

Example:

```text
Create recruitment
       ↓
Apply
       ↓
Accept
       ↓
Team created
       ↓
Board created
       ↓
Member added
       ↓
Create card
       ↓
Move card
       ↓
GitHub activity available
```

---

# 13. Files I Should Mainly Modify

| File                     | Purpose                  | Priority |
| ------------------------ | ------------------------ | -------- |
| `recruitment/models.py`  | Recruitment DB models    | 🔴       |
| `recruitment/schemas.py` | Request/response schemas | 🔴       |
| `recruitment/service.py` | Recruitment logic        | 🔴       |
| `recruitment/router.py`  | Recruitment API          | 🔴       |
| `teams/models.py`        | Team DB models           | 🔴       |
| `teams/service.py`       | Team provisioning        | 🔴       |
| `teams/router.py`        | Team API                 | 🟠       |
| `kanban/models.py`       | Kanban DB models         | 🔴       |
| `kanban/service.py`      | Kanban logic             | 🔴       |
| `kanban/router.py`       | Kanban API               | 🟠       |
| `github/models.py`       | GitHub cache/models      | 🟠       |
| `github/service.py`      | GitHub integration       | 🟠       |
| `github/router.py`       | GitHub API               | 🟠       |

---

# 14. Files I Should NOT Modify Without Coordination

Avoid modifying these unless the team agrees:

```text
core/db.py
core/security.py
core/config.py
core/middleware.py
main.py
api.py
```

These are shared infrastructure.

If you need a change there, discuss it with the person responsible for the backend infrastructure/authentication.

---

# 15. Git Workflow

Create a branch for the feature:

```bash
git checkout -b feat/recruitment-apply
```

Work in small commits.

Examples:

```text
feat(recruitment): add recruitment models
feat(recruitment): add application service
feat(recruitment): add application endpoints
feat(teams): add team provisioning
feat(kanban): add board models
feat(kanban): implement card movement
feat(github): add repository polling
test(recruitment): add application lifecycle tests
```

Before pushing:

```bash
git status
git diff
git pull --rebase
```

Then:

```bash
git push origin feat/recruitment-apply
```

---

# 16. Golden Rule

The architecture should follow:

```text
Router
   ↓
Schema
   ↓
Service
   ↓
Database / Unit of Work
```

Do **not** put business logic inside routers.

Do **not** make random direct database queries from another module.

Use the module's `service.py` as the main entry point for its business logic.

---

# 17. First Task

Do not start by writing all the models.

First inspect the existing backend:

```bash
cd backend

find app -maxdepth 3 -type f | sort

sed -n '1,240p' app/core/db.py
sed -n '1,240p' app/core/uow.py
sed -n '1,240p' app/main.py
sed -n '1,240p' app/api.py
```

Then understand:

```text
How FastAPI starts
How routes are registered
How SQLAlchemy connects
How sessions are created
How transactions work
How authentication is injected
How existing modules are structured
```

Only after that should the database design begin.

---

# Goal

The final result should allow a user to:

```text
Create recruitment
       ↓
Receive applications
       ↓
Review applicants
       ↓
Accept applicant
       ↓
Create team/workspace
       ↓
Create Kanban board
       ↓
Manage cards
       ↓
Connect GitHub
       ↓
View project activity
```

This is the complete flow that my part of **1337 Nexus** is responsible for.
/
    │   ├── router.py
    │   ├── schemas.py
    │   ├── service.py
    │   ├── models.py
    │   └── ...
    │
    ├── teams/
    │   ├── router.py
    │   ├── schemas.py
    │   ├── service.py
    │   ├── models.py
    │   └── ...
    │
    ├── kanban/
    │   ├── router.py
    │   ├── schemas.py
    │   ├── service.py
    │   ├── models.py
    │   └── ...
    │
    └── github/
        ├── router.py
        ├── schemas.py
        ├── service.py
        ├── models.py
        └── ...
````

> The exact folder names should follow the existing repository structure. Do not create duplicate modules if they already exist.

---

# 2. Files I Should Write Code In

## Recruitment

### `recruitment/models.py`

Database models related to recruitment.

Possible entities:

```text
RecruitmentPost
Application
RecruitmentSkill
ApplicationSkill
```

Responsibilities:

* Define database tables
* Foreign keys
* Constraints
* Indexes
* Relationships

---

### `recruitment/schemas.py`

Pydantic request/response schemas.

Examples:

```text
CreateRecruitmentPost
UpdateRecruitmentPost
RecruitmentPostResponse

ApplyRequest
ApplicationResponse

ApplicationReviewRequest
```

This file should contain validation and API data structures.

---

### `recruitment/service.py`

Main recruitment business logic.

Responsibilities:

* Create recruitment posts
* Update/close recruitment posts
* Apply to a recruitment post
* Withdraw an application
* Accept an applicant
* Reject an applicant
* Calculate match scores
* Manage application status transitions

Example flow:

```text
Router
   ↓
Service
   ↓
Database / Repository
```

The router should **not** contain the business logic.

---

### `recruitment/router.py`

HTTP endpoints.

For example:

```text
POST   /recruitment
GET    /recruitment
GET    /recruitment/{id}

POST   /recruitment/{id}/apply

POST   /applications/{id}/withdraw
POST   /applications/{id}/accept
POST   /applications/{id}/reject
```

The router receives the request and calls `service.py`.

---

# 3. Team Provisioning

When a founder accepts an applicant, the system should create the required team workspace.

### `teams/models.py`

Database models such as:

```text
Team
TeamMember
TeamChannel
TeamWorkspace
```

---

### `teams/schemas.py`

Request/response schemas for teams.

Examples:

```text
TeamResponse
TeamMemberResponse
TeamCreateResponse
```

---

### `teams/service.py`

Main team business logic.

Important operation:

```text
Accept Applicant
       ↓
Create Team
       ↓
Add Founder
       ↓
Add Accepted Member
       ↓
Create Kanban Board
       ↓
Create Canvas Document
       ↓
Create Team Channel
```

This operation should be **atomic**.

If one required operation fails, the whole transaction should roll back.

---

### `teams/router.py`

Team API endpoints.

Examples:

```text
GET    /teams
GET    /teams/{id}
GET    /teams/{id}/members

POST   /teams/{id}/members
DELETE /teams/{id}/members/{user_id}
```

---

# 4. Kanban

The Kanban board belongs to a team.

The backend should handle:

* Boards
* Columns
* Cards
* Card movement
* Card ordering
* Permissions
* Revision conflicts

---

## `kanban/models.py`

Possible entities:

```text
Board
Column
Card
```

Important fields include:

```text
board_id
column_id
title
description
position
board_revision
created_at
updated_at
```

---

## `kanban/schemas.py`

Examples:

```text
CreateColumn
UpdateColumn

CreateCard
UpdateCard

MoveCardRequest
MoveCardResponse
```

---

## `kanban/service.py`

This contains the Kanban business logic.

Responsibilities:

* Create board
* Create columns
* Create cards
* Update cards
* Move cards
* Delete cards
* Reorder cards
* Handle `board_revision`
* Handle LexoRank positions
* Rebalance positions when necessary

### Card movement

The frontend should send something similar to:

```text
card_id
target_column_id
position
board_revision
```

The backend checks:

```text
Client revision == Current board revision?
```

If not:

```text
409 Conflict
```

If valid:

```text
Move card
Update position
Increment board_revision
Commit transaction
```

---

## `kanban/router.py`

Endpoints could include:

```text
GET    /teams/{team_id}/board

POST   /teams/{team_id}/columns
PATCH  /columns/{column_id}

POST   /columns/{column_id}/cards
PATCH  /cards/{card_id}

POST   /cards/{card_id}/move

DELETE /cards/{card_id}
```

---

# 5. GitHub Integration

The GitHub integration provides activity information for a team/project.

The backend should:

* Connect a team/project to a GitHub repository
* Poll GitHub
* Respect `X-Poll-Interval`
* Use conditional requests when possible
* Cache activity
* Expose GitHub activity to the frontend

---

## `github/models.py`

Possible entity:

```text
GitHubRepository
GitHubActivity
```

Store only the information needed by Nexus.

---

## `github/schemas.py`

Examples:

```text
GitHubRepositoryResponse
GitHubActivityResponse
```

---

## `github/service.py`

Main GitHub logic.

Responsibilities:

```text
Fetch repository
      ↓
Check cache
      ↓
Request GitHub
      ↓
Handle ETag / conditional request
      ↓
Process activity
      ↓
Update cache
```

The service should also respect GitHub's polling instructions such as:

```text
X-Poll-Interval
```

---

## `github/router.py`

Possible endpoints:

```text
POST /teams/{team_id}/github

GET  /teams/{team_id}/github

GET  /teams/{team_id}/github/activity
```

---

# 6. Database

Before implementing all features, understand the existing database setup.

Relevant files:

```text
core/db.py
core/uow.py
```

The database layer should provide:

* SQLAlchemy session
* Transactions
* Unit of Work
* Database connection

Do not create a second database system inside my module.

---

# 7. Database Relationships

High-level relationship:

```text
User
 │
 ├── creates
 │
 ▼
RecruitmentPost
 │
 └── receives
       │
       ▼
   Application
       │
       ├── pending
       ├── accepted
       ├── rejected
       └── withdrawn
              │
              │ accepted
              ▼
             Team
              │
       ┌──────┼─────────┐
       ▼      ▼         ▼
    Members  Kanban   GitHub
               │
          ┌────┼────┐
          ▼    ▼    ▼
       Columns Cards ...
```

---

# 8. Application Lifecycle

```text
                ┌──────────┐
                │ PENDING  │
                └────┬─────┘
                     │
          ┌──────────┼──────────┐
          │          │          │
          ▼          ▼          ▼
      ACCEPTED    REJECTED   WITHDRAWN
          │
          ▼
    Create/Update Team
          │
          ▼
    Add Team Member
```

Invalid state transitions must be rejected.

For example:

```text
REJECTED → ACCEPTED
WITHDRAWN → ACCEPTED
ACCEPTED → PENDING
```

should not be allowed unless explicitly defined by the project specification.

---

# 9. Match Scoring

Applications should be evaluated using the project's defined weighted skills.

Conceptually:

```text
Application
     │
     ▼
Candidate Skills
     │
     +
     │
Recruitment Required Skills
     │
     ▼
Weighted Match Score
     │
     ▼
Application Review
```

The exact scoring formula must follow the project specification.

Do not invent a different scoring system.

---

# 10. Transactions

Important operations must be transactional.

Example:

```text
Accept Application
        │
        ├── Update application
        ├── Create team/member
        ├── Create board
        ├── Create default columns
        ├── Create workspace resources
        └── Commit
```

If any step fails:

```text
ROLLBACK
```

Nothing should be partially created.

---

# 11. Permissions

Backend authorization must verify ownership/roles.

Examples:

```text
Founder
   ├── Manage recruitment
   ├── Accept/reject applicants
   ├── Manage team
   └── Manage Kanban

Team Member
   ├── View team
   ├── Work on Kanban
   └── View GitHub activity
```

Exact permissions must follow the project specification and existing authentication system.

Do not duplicate authentication logic from `core/security.py`.

---

# 12. Implementation Order

I should NOT start by implementing everything at once.

Follow this order:

### Step 1 — Understand existing backend

Read:

```text
main.py
api.py
core/db.py
core/uow.py
core/security.py
```

Understand:

```text
FastAPI
SQLAlchemy
Sessions
Transactions
Dependencies
Authentication
```

---

### Step 2 — Database models

Start with:

```text
recruitment/models.py
teams/models.py
kanban/models.py
github/models.py
```

Define:

* Primary keys
* Foreign keys
* Relationships
* Constraints
* Indexes

---

### Step 3 — Migrations

Create database migrations for the models.

Verify that the database can be created from an empty state.

---

### Step 4 — Recruitment service

Implement:

```text
Create recruitment
List recruitment
View recruitment
Apply
Withdraw
Accept
Reject
```

---

### Step 5 — Team provisioning

Implement:

```text
Accept application
      ↓
Create team
      ↓
Create team member
      ↓
Create default workspace resources
```

Make the operation transactional.

---

### Step 6 — Kanban

Implement in this order:

```text
Board
 ↓
Columns
 ↓
Cards
 ↓
Move cards
 ↓
LexoRank
 ↓
board_revision
 ↓
Conflict handling
```

---

### Step 7 — GitHub

Implement:

```text
Repository connection
 ↓
GitHub API client
 ↓
Polling
 ↓
ETag / conditional requests
 ↓
Cache
 ↓
Activity endpoint
```

---

### Step 8 — Integration tests

Test the complete flows.

Example:

```text
Create recruitment
       ↓
Apply
       ↓
Accept
       ↓
Team created
       ↓
Board created
       ↓
Member added
       ↓
Create card
       ↓
Move card
       ↓
GitHub activity available
```

---

# 13. Files I Should Mainly Modify

| File                     | Purpose                  | Priority |
| ------------------------ | ------------------------ | -------- |
| `recruitment/models.py`  | Recruitment DB models    | 🔴       |
| `recruitment/schemas.py` | Request/response schemas | 🔴       |
| `recruitment/service.py` | Recruitment logic        | 🔴       |
| `recruitment/router.py`  | Recruitment API          | 🔴       |
| `teams/models.py`        | Team DB models           | 🔴       |
| `teams/service.py`       | Team provisioning        | 🔴       |
| `teams/router.py`        | Team API                 | 🟠       |
| `kanban/models.py`       | Kanban DB models         | 🔴       |
| `kanban/service.py`      | Kanban logic             | 🔴       |
| `kanban/router.py`       | Kanban API               | 🟠       |
| `github/models.py`       | GitHub cache/models      | 🟠       |
| `github/service.py`      | GitHub integration       | 🟠       |
| `github/router.py`       | GitHub API               | 🟠       |

---

# 14. Files I Should NOT Modify Without Coordination

Avoid modifying these unless the team agrees:

```text
core/db.py
core/security.py
core/config.py
core/middleware.py
main.py
api.py
```

These are shared infrastructure.

If you need a change there, discuss it with the person responsible for the backend infrastructure/authentication.

---

# 15. Git Workflow

Create a branch for the feature:

```bash
git checkout -b feat/recruitment-apply
```

Work in small commits.

Examples:

```text
feat(recruitment): add recruitment models
feat(recruitment): add application service
feat(recruitment): add application endpoints
feat(teams): add team provisioning
feat(kanban): add board models
feat(kanban): implement card movement
feat(github): add repository polling
test(recruitment): add application lifecycle tests
```

Before pushing:

```bash
git status
git diff
git pull --rebase
```

Then:

```bash
git push origin feat/recruitment-apply
```

---

# 16. Golden Rule

The architecture should follow:

```text
Router
   ↓
Schema
   ↓
Service
   ↓
Database / Unit of Work
```

Do **not** put business logic inside routers.

Do **not** make random direct database queries from another module.

Use the module's `service.py` as the main entry point for its business logic.

---

# 17. First Task

Do not start by writing all the models.

First inspect the existing backend:

```bash
cd backend

find app -maxdepth 3 -type f | sort

sed -n '1,240p' app/core/db.py
sed -n '1,240p' app/core/uow.py
sed -n '1,240p' app/main.py
sed -n '1,240p' app/api.py
```

Then understand:

```text
How FastAPI starts
How routes are registered
How SQLAlchemy connects
How sessions are created
How transactions work
How authentication is injected
How existing modules are structured
```

Only after that should the database design begin.

---

# Goal

The final result should allow a user to:

```text
Create recruitment
       ↓
Receive applications
       ↓
Review applicants
       ↓
Accept applicant
       ↓
Create team/workspace
       ↓
Create Kanban board
       ↓
Manage cards
       ↓
Connect GitHub
       ↓
View project activity
```

This is the complete flow that my part of **1337 Nexus** is responsible for.