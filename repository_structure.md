```text
1337-nexus/
│
├── backend/                                      # SHARED — ALL BACKEND DEVELOPERS
│   │
│   ├── app/                                      # SHARED — ALL BACKEND DEVELOPERS
│   │
│   ├── main.py                                   # ANAS
│   ├── api.py                                    # ANAS
│   │
│   ├── core/                                     # SHARED BACKEND INFRASTRUCTURE
│   │   ├── config.py                             # ANAS
│   │   ├── db.py                                 # ANAS
│   │   ├── security.py                           # SFY
│   │   ├── errors.py                             # ANAS
│   │   ├── middleware.py                         # SFY
│   │   ├── logging.py                            # ANAS
│   │   └── uow.py                                # ANAS
│   │
│   ├── flows/                                    # APPLICATION ENTRY FLOWS
│   │   │
│   │   ├── landing/                              # ANAS
│   │   │   ├── router.py                         # ANAS
│   │   │   ├── schemas.py                        # ANAS
│   │   │   └── service.py                        # ANAS
│   │   │
│   │   ├── authentication/                       # SFY
│   │   │   │
│   │   │   ├── login/                            # SFY
│   │   │   │   ├── router.py                     # SFY
│   │   │   │   ├── schemas.py                    # SFY
│   │   │   │   ├── service.py                    # SFY
│   │   │   │   └── repository.py                 # SFY
│   │   │   │
│   │   │   ├── oauth/                            # SFY
│   │   │   │   ├── router.py                     # SFY
│   │   │   │   ├── schemas.py                    # SFY
│   │   │   │   ├── service.py                    # SFY
│   │   │   │   └── repository.py                 # SFY
│   │   │   │
│   │   │   ├── refresh_session/                  # SFY
│   │   │   │   ├── router.py                     # SFY
│   │   │   │   ├── service.py                    # SFY
│   │   │   │   └── repository.py                 # SFY
│   │   │   │
│   │   │   └── logout/                           # SFY
│   │   │       ├── router.py                     # SFY
│   │   │       └── service.py                    # SFY
│   │   │
│   │   └── role_selection/                       # SFY
│   │       ├── service.py                        # SFY
│   │       └── schemas.py                        # SFY
│   │
│   ├── admin/                                    # SFY
│   │   ├── dashboard/                            # SFY
│   │   │   ├── router.py                         # SFY
│   │   │   ├── schemas.py                        # SFY
│   │   │   └── service.py                        # SFY
│   │   │
│   │   ├── users/                                # SFY
│   │   │   ├── list_users/                       # SFY
│   │   │   ├── view_user/                        # SFY
│   │   │   ├── manage_user/                      # SFY
│   │   │   └── suspend_user/                     # SFY
│   │   │
│   │   ├── projects/                             # SFY
│   │   │   ├── view_projects/                    # SFY
│   │   │   ├── review_project/                   # SFY
│   │   │   ├── moderate_project/                # SFY
│   │   │   └── feature_project/                  # SFY
│   │   │
│   │   ├── campuses/                             # SFY
│   │   │   ├── view_campus/                      # SFY
│   │   │   ├── create_campus/                    # SFY
│   │   │   └── manage_campus/                    # SFY
│   │   │
│   │   ├── moderation/                           # SFY
│   │   │   ├── flags/                            # SFY
│   │   │   └── reports/                          # SFY
│   │   │
│   │   └── configuration/                       # SFY
│   │       ├── platform_settings/               # SFY
│   │       └── system_settings/                 # SFY
│   │
│   ├── user/                                     # SHARED — FEATURE OWNERS BELOW
│   │   │
│   │   ├── dashboard/                            # ANAS
│   │   │   ├── router.py                         # ANAS
│   │   │   ├── schemas.py                        # ANAS
│   │   │   └── service.py                        # ANAS
│   │   │
│   │   ├── projects/                             # AYOUB + ZOUBAIR
│   │   │   ├── my_projects/                      # AYOUB
│   │   │   ├── recommended_projects/             # AYOUB
│   │   │   ├── create_project/                   # AYOUB
│   │   │   ├── edit_project/                     # AYOUB
│   │   │   ├── publish_project/                 # AYOUB
│   │   │   ├── archive_project/                # AYOUB
│   │   │   └── refine_project/                  # ZOUBAIR
│   │   │
│   │   ├── opportunities/                        # AYOUB
│   │   │   ├── browse_opportunities/             # AYOUB
│   │   │   ├── view_opportunity/                 # AYOUB
│   │   │   ├── apply/                            # AYOUB
│   │   │   └── withdraw_application/             # AYOUB
│   │   │
│   │   ├── messages/                             # YASSIN
│   │   │   ├── team_chat/                        # YASSIN
│   │   │   ├── direct_message/                   # YASSIN
│   │   │   └── notifications/                   # YASSIN
│   │   │
│   │   ├── copilot/                              # ZOUBAIR
│   │   │   ├── ask/                              # ZOUBAIR
│   │   │   │   ├── router.py                     # ZOUBAIR
│   │   │   │   ├── schemas.py                    # ZOUBAIR
│   │   │   │   └── service.py                    # ZOUBAIR
│   │   │   │
│   │   │   ├── retrieve_curriculum/              # ZOUBAIR
│   │   │   │   ├── router.py                     # ZOUBAIR
│   │   │   │   ├── schemas.py                    # ZOUBAIR
│   │   │   │   └── service.py                    # ZOUBAIR
│   │   │   │
│   │   │   ├── threads/                          # ZOUBAIR
│   │   │   │   ├── router.py                     # ZOUBAIR
│   │   │   │   └── service.py                    # ZOUBAIR
│   │   │   │
│   │   │   └── cancel_job/                       # ZOUBAIR
│   │   │       ├── router.py                     # ZOUBAIR
│   │   │       └── service.py                    # ZOUBAIR
│   │   │
│   │   ├── quick_actions/                        # AYOUB
│   │   │   ├── create_project/                   # AYOUB
│   │   │   ├── find_team/                       # AYOUB
│   │   │   └── continue_project/                # AYOUB
│   │   │
│   │   └── profile/                              # SFY
│   │       ├── view_profile/                     # SFY
│   │       ├── edit_profile/                     # SFY
│   │       └── settings/                        # SFY
│   │
│   ├── teams/                                    # AYOUB
│   │   ├── create_team/                          # AYOUB
│   │   ├── invite_member/                        # AYOUB
│   │   ├── accept_member/                        # AYOUB
│   │   └── remove_member/                        # AYOUB
│   │
│   ├── collaboration/                            # FEATURE OWNERS BELOW
│   │   │
│   │   ├── board/                                # AYOUB
│   │   │   ├── create_board/                     # AYOUB
│   │   │   ├── create_column/                    # AYOUB
│   │   │   ├── move_card/                        # AYOUB
│   │   │   └── delete_column/                    # AYOUB
│   │   │
│   │   ├── canvas/                               # ZOUBAIR
│   │   │   ├── join_canvas/                     # ZOUBAIR
│   │   │   ├── send_update/                     # ZOUBAIR
│   │   │   └── compact_document/                # ZOUBAIR
│   │   │
│   │   └── chat/                                 # YASSIN
│   │       ├── send_team_message/                # YASSIN
│   │       ├── send_direct_message/             # YASSIN
│   │       ├── mark_message_read/               # YASSIN
│   │       └── reconnect/                       # YASSIN
│   │
│   ├── integrations/                             # AYOUB
│   │   └── github/                               # AYOUB
│   │       ├── refresh_activity/                 # AYOUB
│   │       └── view_activity/                    # AYOUB
│   │
│   ├── gamification/                             # YASSIN
│   │   ├── view_xp/                              # YASSIN
│   │   ├── view_badges/                          # YASSIN
│   │   └── view_leaderboard/                    # YASSIN
│   │
│   ├── realtime/                                 # SHARED — OWNERS BY FUNCTION
│   │   ├── server.py                             # ANAS
│   │   ├── auth.py                               # SFY
│   │   ├── presence.py                           # YASSIN
│   │   ├── rooms.py                              # YASSIN
│   │   └── validation.py                         # ANAS
│   │
│   ├── jobs/                                     # ZOUBAIR
│   │   ├── worker.py                             # ZOUBAIR
│   │   ├── registry.py                           # ZOUBAIR
│   │   └── scheduler.py                          # ZOUBAIR
│   │
│   ├── shared/                                   # SHARED BACKEND
│   │   ├── models.py                             # ANAS
│   │   ├── pagination.py                         # ANAS
│   │   └── ai/                                   # ZOUBAIR
│   │       ├── provider.py                       # ZOUBAIR
│   │       ├── client.py                         # ZOUBAIR
│   │       ├── embeddings.py                     # ZOUBAIR
│   │       ├── tokenizer.py                      # ZOUBAIR
│   │       └── stub.py                           # ZOUBAIR
│   │
│   └── cli/                                     # SHARED / FEATURE OWNERS
│       ├── seed.py                               # ANAS
│       ├── ingest_subjects.py                   # ZOUBAIR
│       ├── export_openapi.py                    # ANAS
│       └── admin.py                              # SFY
│
│   ├── alembic/                                  # SHARED BACKEND
│   │   ├── env.py                                # ANAS
│   │   ├── script.py.mako                        # ANAS
│   │   └── versions/                             # ALL BACKEND DEVELOPERS
│   │
│   ├── content/                                  # ZOUBAIR
│   │   └── subjects/                             # ZOUBAIR
│   │
│   ├── tests/                                    # EACH DEVELOPER TESTS THEIR FEATURES
│   │   ├── unit/                                 # FEATURE OWNER
│   │   ├── integration/                          # ANAS + FEATURE OWNERS
│   │   ├── realtime/                             # ANAS + ZOUBAIR
│   │   ├── crdt/                                 # ZOUBAIR
│   │   └── conftest.py                           # ANAS
│   │
│   ├── pyproject.toml                             # ANAS
│   ├── requirements.lock                          # ANAS
│   ├── Dockerfile                                 # ANAS
│   └── entrypoint.sh                              # ANAS
│
├── frontend/                                     # ALL FEATURE DEVELOPERS
│   │
│   ├── src/
│   │   │
│   │   ├── app/                                  # ANAS + ALL
│   │   │   ├── App.tsx                           # ANAS
│   │   │   ├── main.tsx                          # ANAS
│   │   │   └── routes/                           # ANAS
│   │   │
│   │   ├── flows/
│   │   │   │
│   │   │   ├── landing/                          # ANAS
│   │   │   │   ├── components/                   # ANAS
│   │   │   │   └── pages/                        # ANAS
│   │   │   │
│   │   │   ├── authentication/                   # SFY
│   │   │   │   ├── login/                        # SFY
│   │   │   │   ├── oauth/                        # SFY
│   │   │   │   └── callback/                     # SFY
│   │   │   │
│   │   │   ├── admin/                            # SFY
│   │   │   │   ├── dashboard/                    # SFY
│   │   │   │   ├── users/                        # SFY
│   │   │   │   ├── projects/                     # SFY
│   │   │   │   ├── campuses/                     # SFY
│   │   │   │   ├── moderation/                   # SFY
│   │   │   │   └── configuration/               # SFY
│   │   │   │
│   │   │   └── user/                             # FEATURE OWNERS
│   │   │       ├── dashboard/                    # ANAS
│   │   │       ├── projects/                     # AYOUB + ZOUBAIR
│   │   │       │   ├── my_projects/              # AYOUB
│   │   │       │   ├── recommended_projects/     # AYOUB
│   │   │       │   ├── create_project/           # AYOUB
│   │   │       │   ├── edit_project/             # AYOUB
│   │   │       │   ├── publish_project/          # AYOUB
│   │   │       │   ├── archive_project/          # AYOUB
│   │   │       │   └── refine_project/           # ZOUBAIR
│   │   │       │
│   │   │       ├── opportunities/                # AYOUB
│   │   │       ├── messages/                     # YASSIN
│   │   │       ├── copilot/                      # ZOUBAIR
│   │   │       │   ├── ask/                      # ZOUBAIR
│   │   │       │   ├── threads/                  # ZOUBAIR
│   │   │       │   └── components/               # ZOUBAIR
│   │   │       ├── notifications/                # YASSIN
│   │   │       ├── quick_actions/                # AYOUB
│   │   │       └── profile/                      # SFY
│   │   │
│   │   ├── components/                           # SHARED FRONTEND
│   │   │   ├── ui/                               # ANAS + ALL FRONTEND
│   │   │   └── layout/                           # ANAS
│   │   │
│   │   ├── lib/                                  # SHARED FRONTEND
│   │   │   ├── api-client.ts                     # ANAS
│   │   │   ├── socket.ts                         # ANAS
│   │   │   ├── sse-client.ts                     # ZOUBAIR
│   │   │   ├── query-client.ts                   # ANAS
│   │   │   └── utils.ts                          # ANAS
│   │   │
│   │   ├── stores/                               # ANAS
│   │   └── types/                                # ANAS
│   │       └── api.d.ts                           # ANAS
│   │
│   ├── package.json                              # ANAS + ALL FRONTEND
│   ├── package-lock.json                         # ANAS + ALL FRONTEND
│   ├── vite.config.ts                            # ANAS
│   ├── vitest.setup.ts                           # ANAS
│   ├── tsconfig.json                             # ANAS
│   ├── tsconfig.app.json                         # ANAS
│   ├── tsconfig.node.json                        # ANAS
│   ├── eslint.config.js                          # ANAS
│   ├── .prettierrc                               # ANAS
│   └── components.json                            # ANAS
│
├── nginx/                                        # ANAS
│   ├── Dockerfile                                # ANAS
│   ├── entrypoint.sh                             # ANAS
│   ├── nginx.conf                                # ANAS
│   └── conf.d/
│       └── nexus.conf                             # ANAS
│
├── deploy/                                       # ANAS
│   ├── docker-compose.yml                        # ANAS
│   ├── docker-compose.dev.yml                    # ANAS
│   ├── .env.example                              # ANAS
│   ├── postgres/
│   │   └── postgresql.conf                      # ANAS
│   │
│   └── scripts/
│       ├── bootstrap.sh                          # ANAS
│       ├── seed.sh                               # ANAS
│       ├── backup.sh                             # ANAS
│       └── perf-smoke.sh                         # ANAS
│
├── docs/
│   ├── architecture.md                           # ANAS
│   ├── api.md                                    # ALL BACKEND DEVELOPERS
│   ├── operations.md                             # ANAS
│   ├── frontend.md                               # ALL FRONTEND DEVELOPERS
│   └── design-system.md                          # ANAS + ALL FRONTEND
│
├── .github/
│   ├── CODEOWNERS                                # ANAS
│   └── workflows/
│       └── ci.yml                                # ANAS
│
├── .gitignore                                    # ANAS
├── .dockerignore                                 # ANAS
├── .editorconfig                                 # ANAS
├── Makefile                                      # ANAS
└── README.md                                     # ANAS
```
