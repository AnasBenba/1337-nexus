# AI Workstream

This branch owns the AI features for 1337 Nexus. The repository uses a
flow-oriented, use-case-sliced architecture, so AI behavior should live in the
user-facing copilot flows instead of a large shared AI module.

## Planned ownership

```text
backend/app/user/copilot/
├── ask/                 # Ask the copilot and return a grounded response
├── retrieve-curriculum/ # Retrieve relevant curriculum and project context
├── threads/             # Persist and load copilot conversations
└── cancel-job/          # Cancel long-running AI work
```

Supporting infrastructure belongs in the existing shared areas:

- `backend/app/jobs/` for asynchronous or long-running work
- `backend/app/core/` for configuration, database access, and shared errors
- PostgreSQL with pgvector for embeddings and retrieval metadata

## First implementation slice

The first vertical slice should be `copilot/ask`:

1. Define request and response schemas with explicit conversation and user
   ownership.
2. Retrieve relevant project or curriculum context before generation.
3. Keep the model provider behind a service boundary so provider credentials
   and SDK details do not leak into routers.
4. Return a useful, typed error when the provider or retrieval service is
   unavailable.
5. Add focused service and router tests before connecting the frontend.

The initial implementation should not answer from untrusted retrieved content
without preserving its source metadata. This keeps the later UI and evaluation
work compatible with grounded responses.

## Branch workflow

This branch starts from `main` and is intended for small vertical slices:

```bash
git switch feature/ai-copilot-foundation
git pull --rebase origin main
git add docs/AI_WORKSTREAM.md
git commit -m "docs: define AI workstream"
git push -u origin feature/ai-copilot-foundation
```

Open a pull request from this branch into `main` after the focused tests pass.
Keep infrastructure changes and unrelated application work in separate
branches so reviews remain scoped.