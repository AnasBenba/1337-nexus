```text
1337-nexus/
│
├── backend/
│   │
│   ├── app/
│   │   │
│   │   ├── main.py
│   │   ├── api.py
│   │   │
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── db.py
│   │   │   ├── security.py
│   │   │   ├── errors.py
│   │   │   ├── middleware.py
│   │   │   ├── logging.py
│   │   │   └── uow.py
│   │   │
│   │   ├── flows/
│   │   │   │
│   │   │   ├── landing/
│   │   │   │   ├── router.py
│   │   │   │   ├── schemas.py
│   │   │   │   └── service.py
│   │   │   │
│   │   │   ├── authentication/
│   │   │   │   │
│   │   │   │   ├── login/
│   │   │   │   │   ├── router.py
│   │   │   │   │   ├── schemas.py
│   │   │   │   │   ├── service.py
│   │   │   │   │   └── repository.py
│   │   │   │   │
│   │   │   │   ├── oauth/
│   │   │   │   │   ├── router.py
│   │   │   │   │   ├── schemas.py
│   │   │   │   │   ├── service.py
│   │   │   │   │   └── repository.py
│   │   │   │   │
│   │   │   │   ├── refresh-session/
│   │   │   │   │   ├── router.py
│   │   │   │   │   ├── service.py
│   │   │   │   │   └── repository.py
│   │   │   │   │
│   │   │   │   └── logout/
│   │   │   │       ├── router.py
│   │   │   │       └── service.py
│   │   │   │
│   │   │   └── role-selection/
│   │   │       ├── service.py
│   │   │       └── schemas.py
│   │   │
│   │   ├── admin/
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── router.py
│   │   │   │   ├── schemas.py
│   │   │   │   └── service.py
│   │   │   │
│   │   │   ├── users/
│   │   │   │   │
│   │   │   │   ├── list-users/
│   │   │   │   │   ├── router.py
│   │   │   │   │   ├── schemas.py
│   │   │   │   │   ├── service.py
│   │   │   │   │   └── repository.py
│   │   │   │   │
│   │   │   │   ├── view-user/
│   │   │   │   │   ├── router.py
│   │   │   │   │   ├── schemas.py
│   │   │   │   │   └── service.py
│   │   │   │   │
│   │   │   │   ├── manage-user/
│   │   │   │   │   ├── router.py
│   │   │   │   │   ├── schemas.py
│   │   │   │   │   └── service.py
│   │   │   │   │
│   │   │   │   └── suspend-user/
│   │   │   │       ├── router.py
│   │   │   │       ├── schemas.py
│   │   │   │       └── service.py
│   │   │   │
│   │   │   ├── projects/
│   │   │   │   │
│   │   │   │   ├── view-projects/
│   │   │   │   ├── review-project/
│   │   │   │   ├── moderate-project/
│   │   │   │   └── feature-project/
│   │   │   │
│   │   │   ├── campuses/
│   │   │   │   ├── view-campus/
│   │   │   │   ├── create-campus/
│   │   │   │   └── manage-campus/
│   │   │   │
│   │   │   ├── moderation/
│   │   │   │   ├── flags/
│   │   │   │   └── reports/
│   │   │   │
│   │   │   └── configuration/
│   │   │       ├── platform-settings/
│   │   │       └── system-settings/
│   │   │
│   │   ├── user/
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── router.py
│   │   │   │   ├── schemas.py
│   │   │   │   └── service.py
│   │   │   │
│   │   │   ├── projects/
│   │   │   │   │
│   │   │   │   ├── my-projects/
│   │   │   │   │   ├── router.py
│   │   │   │   │   └── service.py
│   │   │   │   │
│   │   │   │   ├── recommended-projects/
│   │   │   │   │   ├── router.py
│   │   │   │   │   └── service.py
│   │   │   │   │
│   │   │   │   ├── create-project/
│   │   │   │   │   ├── router.py
│   │   │   │   │   ├── schemas.py
│   │   │   │   │   ├── service.py
│   │   │   │   │   └── repository.py
│   │   │   │   │
│   │   │   │   ├── edit-project/
│   │   │   │   ├── publish-project/
│   │   │   │   ├── archive-project/
│   │   │   │   └── refine-project/
│   │   │   │       ├── router.py
│   │   │   │       ├── schemas.py
│   │   │   │       └── service.py
│   │   │   │
│   │   │   ├── opportunities/
│   │   │   │   │
│   │   │   │   ├── browse-opportunities/
│   │   │   │   ├── view-opportunity/
│   │   │   │   ├── apply/
│   │   │   │   └── withdraw-application/
│   │   │   │
│   │   │   ├── messages/
│   │   │   │   ├── team-chat/
│   │   │   │   ├── direct-message/
│   │   │   │   └── notifications/
│   │   │   │
│   │   │   ├── copilot/
│   │   │   │   │
│   │   │   │   ├── ask/
│   │   │   │   │   ├── router.py
│   │   │   │   │   ├── schemas.py
│   │   │   │   │   └── service.py
│   │   │   │   │
│   │   │   │   ├── retrieve-curriculum/
│   │   │   │   │   ├── router.py
│   │   │   │   │   ├── schemas.py
│   │   │   │   │   └── service.py
│   │   │   │   │
│   │   │   │   ├── threads/
│   │   │   │   │   ├── router.py
│   │   │   │   │   └── service.py
│   │   │   │   │
│   │   │   │   └── cancel-job/
│   │   │   │       ├── router.py
│   │   │   │       └── service.py
│   │   │   │
│   │   │   ├── quick-actions/
│   │   │   │   ├── create-project/
│   │   │   │   ├── find-team/
│   │   │   │   └── continue-project/
│   │   │   │
│   │   │   └── profile/
│   │   │       ├── view-profile/
│   │   │       ├── edit-profile/
│   │   │       └── settings/
│   │   │
│   │   ├── teams/
│   │   │   ├── create-team/
│   │   │   ├── invite-member/
│   │   │   ├── accept-member/
│   │   │   └── remove-member/
│   │   │
│   │   ├── collaboration/
│   │   │   │
│   │   │   ├── board/
│   │   │   │   ├── create-board/
│   │   │   │   ├── create-column/
│   │   │   │   ├── move-card/
│   │   │   │   └── delete-column/
│   │   │   │
│   │   │   ├── canvas/
│   │   │   │   ├── join-canvas/
│   │   │   │   ├── send-update/
│   │   │   │   └── compact-document/
│   │   │   │
│   │   │   └── chat/
│   │   │       ├── send-team-message/
│   │   │       ├── send-direct-message/
│   │   │       ├── mark-message-read/
│   │   │       └── reconnect/
│   │   │
│   │   ├── integrations/
│   │   │   ├── github/
│   │   │   │   ├── refresh-activity/
│   │   │   │   └── view-activity/
│   │   │   └── ...
│   │   │
│   │   ├── gamification/
│   │   │   ├── view-xp/
│   │   │   ├── view-badges/
│   │   │   └── view-leaderboard/
│   │   │
│   │   ├── realtime/
│   │   │   ├── server.py
│   │   │   ├── auth.py
│   │   │   ├── presence.py
│   │   │   ├── rooms.py
│   │   │   └── validation.py
│   │   │
│   │   ├── jobs/
│   │   │   ├── worker.py
│   │   │   ├── registry.py
│   │   │   └── scheduler.py
│   │   │
│   │   ├── shared/
│   │   │   ├── models.py
│   │   │   ├── pagination.py
│   │   │   └── ai/
│   │   │       ├── provider.py
│   │   │       ├── client.py
│   │   │       ├── embeddings.py
│   │   │       ├── tokenizer.py
│   │   │       └── stub.py
│   │   │
│   │   └── cli/
│   │       ├── seed.py
│   │       ├── ingest_subjects.py
│   │       ├── export_openapi.py
│   │       └── admin.py
│   │
│   ├── alembic/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │
│   ├── content/
│   │   └── subjects/
│   │
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   ├── realtime/
│   │   ├── crdt/
│   │   └── conftest.py
│   │
│   ├── pyproject.toml
│   ├── requirements.lock
│   ├── Dockerfile
│   └── entrypoint.sh
│
├── frontend/
│   │
│   ├── src/
│   │   │
│   │   ├── app/
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── routes/
│   │   │
│   │   ├── flows/
│   │   │   │
│   │   │   ├── landing/
│   │   │   │   ├── components/
│   │   │   │   └── pages/
│   │   │   │
│   │   │   ├── authentication/
│   │   │   │   ├── login/
│   │   │   │   ├── oauth/
│   │   │   │   └── callback/
│   │   │   │
│   │   │   ├── admin/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── users/
│   │   │   │   ├── projects/
│   │   │   │   ├── campuses/
│   │   │   │   ├── moderation/
│   │   │   │   └── configuration/
│   │   │   │
│   │   │   └── user/
│   │   │       ├── dashboard/
│   │   │       ├── projects/
│   │   │       ├── opportunities/
│   │   │       ├── messages/
│   │   │       ├── copilot/
│   │   │       │   ├── ask/
│   │   │       │   ├── threads/
│   │   │       │   └── components/
│   │   │       ├── notifications/
│   │   │       ├── quick-actions/
│   │   │       └── profile/
│   │   │
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   └── layout/
│   │   │
│   │   ├── lib/
│   │   │   ├── api-client.ts
│   │   │   ├── socket.ts
│   │   │   ├── sse-client.ts
│   │   │   ├── query-client.ts
│   │   │   └── utils.ts
│   │   │
│   │   ├── stores/
│   │   └── types/
│   │       └── api.d.ts
│   │
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.ts
│   ├── vitest.setup.ts
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   ├── eslint.config.js
│   ├── .prettierrc
│   └── components.json
│
├── nginx/
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── nginx.conf
│   └── conf.d/
│       └── nexus.conf
│
├── deploy/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   ├── .env.example
│   ├── postgres/
│   │   └── postgresql.conf
│   │
│   └── scripts/
│       ├── bootstrap.sh
│       ├── seed.sh
│       ├── backup.sh
│       └── perf-smoke.sh
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── operations.md
│   ├── frontend.md
│   └── design-system.md
│
├── .github/
│   ├── CODEOWNERS
│   └── workflows/
│       └── ci.yml
│
├── .gitignore
├── .dockerignore
├── .editorconfig
├── Makefile
└── README.md
```
