# User Management & Auth: Change Log

Everything changed on the `soufiane` branch for two subject modules (IV.3):

- *Major: Standard user management and authentication* (changes 3–6)
- *Major: Advanced permissions system* (changes 8–10, 12)

plus the **mandatory** email/password sign-up and login (11, subject III.3), the fixes
needed to get login working (1–2), and refresh tokens (7).

> **Current rules in one place:** [Roles today](#roles-today). Sections 8–10 describe how
> the roles were first built. Change 12 replaced parts of them, and those parts are marked.

All paths are relative to the repository root.

---

## Summary

| # | Change | Commit |
|---|---|---|
| 1 | Fix 42 login (HTTP 500) and land users in the React app | `e86bd0a` |
| 2 | UI fixes: icon fonts, rounded corners, sidebar | `1a44387` |
| 3 | Profile page with editable name and bio | `82d9619` |
| 4 | Avatar upload with default fallback | `7f458dd` |
| 5 | Friends system, user search, logout | `6bf1bbc` |
| 6 | Live online status for friends | `75548f3` |
| 7 | Refresh tokens (stay logged in for 7 days) | `0944d1a` |
| 8 | Roles (`admin`, `user`) and permission checks | `6d82683` |
| 9 | Admin user-management API (list, edit, roles, delete) | `8062439` |
| 10 | Role-based UI and the Users management page | `df58645` |
| 11 | Email + password sign-up and login (Argon2 hashing) | `ea74f3e` |
| 12 | Protected superadmin created at startup | `000adf6` |

### Subject checklist (IV.3 Major)

| Requirement | Where |
|---|---|
| Users can update their profile information | [Change 3](#3-profile-page-with-editable-name-and-bio) |
| Users can upload an avatar (default if none) | [Change 4](#4-avatar-upload-with-default-fallback) |
| Users can add other users as friends | [Change 5](#5-friends-system-user-search-logout) |
| ...and see their online status | [Change 6](#6-live-online-status-for-friends) |
| Users have a profile page displaying their information | [Change 3](#3-profile-page-with-editable-name-and-bio) |

### Subject checklist (IV.3 Major: Advanced permissions)

| Requirement | Where |
|---|---|
| View, edit, and delete users (CRUD) | [Change 9](#9-admin-user-management-api) (API), [Change 10](#10-role-based-ui-and-the-users-management-page) (UI) |
| Roles management (`user`, `admin`, `superadmin`) | [Roles today](#roles-today), [Change 12](#12-protected-superadmin-created-at-startup) |
| Different views and actions based on user role | [Change 10](#10-role-based-ui-and-the-users-management-page), [Change 12](#12-protected-superadmin-created-at-startup) |

Users are **created** by signing up (email/password or 42). The superadmin is created by the startup script.

### Subject checklist (III.3 mandatory: user management)

| Requirement | Where |
|---|---|
| Users can sign up and log in securely with email and password | [Change 11](#11-email--password-sign-up-and-login) |
| Passwords hashed and salted | [Change 11](#11-email--password-sign-up-and-login): Argon2id, random salt per user |
| Forms validated in both the frontend and backend | [Change 11](#11-email--password-sign-up-and-login), [Change 3](#3-profile-page-with-editable-name-and-bio) |
| `.env` ignored by Git, with an `.env.example` | [deploy/.env.example](../deploy/.env.example) lists every setting |

### Roles today

| | `user` | `admin` | `superadmin` |
|---|---|---|---|
| Own profile, friends | ✅ | ✅ | ✅ |
| Users page (`/admin/users`) | — | ✅ | ✅ |
| Edit / delete / remove photo of **users** | — | ✅ | ✅ |
| Edit / delete / remove photo of **admins** | — | — | ✅ |
| Make someone admin, or remove admin | — | — | ✅ |
| Change the **superadmin** in any way | — | — | — (nobody, not even itself) |

- New accounts (email sign-up or 42) are always `user`.
- Only the startup script creates a superadmin (`SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`); the API never assigns that role.
- Nobody manages their own account from the Users page (you edit yourself from your profile), so the superadmin can't remove itself.

---

## 1. Fix 42 login and land users in the React app

**Commit:** `e86bd0a`

**Problems fixed**
- Logging in with 42 returned **HTTP 500**. Commit `ddc2897` changed `Users.id` in the
  model to a UUID, but the `users` table (and `pitches.author_id`) still use an integer,
  so inserting a new user failed with `column "id" is of type integer but expression is of type uuid`.
- After login, users landed on `http://localhost:8000/home`, a placeholder page saying "HEY USER".
- The React app showed every page even when you weren't logged in.

| File | Change |
|---|---|
| [backend/app/oauth/user.py](../backend/app/oauth/user.py) | `id` back to an integer primary key (matches the DB and pitches). |
| [backend/app/api.py](../backend/app/api.py) | After the OAuth callback, redirect to `FRONTEND_URL` (default `https://localhost:8443/`) instead of `/home`. Added a "who am I" endpoint (later replaced by `GET /api/v1/users/me` in change 3). |
| [frontend/src/app/authentication/login/Auth.api.ts](../frontend/src/app/authentication/login/Auth.api.ts) | `getMe()`: asks the backend who is logged in. |
| [frontend/src/components/Layout.tsx](../frontend/src/components/Layout.tsx) | Loads the current user, redirects to `/login` when not signed in, and shows the real name in the sidebar. |

**Config:** `FRONTEND_URL=https://localhost:8443/` was added to `deploy/.env`
(gitignored, not in `deploy/.env.example` yet).

---

## 2. UI fixes: icon fonts, rounded corners, sidebar

**Commit:** `1a44387`

**Problems fixed**
- Icons showed up as words ("dashboard", "search"). The nginx Content-Security-Policy
  only allowed fonts and styles from the site itself, so Google Fonts was blocked.
- Every card, badge and button had square corners. The code used `rounded-DEFAULT`, which
  is not a real Tailwind class (the DEFAULT radius is used as plain `rounded`).

| File | Change |
|---|---|
| [nginx/conf.d/nexus.conf](../nginx/conf.d/nexus.conf) | CSP allows `https://fonts.googleapis.com` (styles) and `https://fonts.gstatic.com` (fonts). |
| [frontend/index.html](../frontend/index.html) | Loads only the one icon style the app uses (about 290 KB instead of several MB), with `display=block` so icon names don't flash as text. |
| [frontend/src/components/Layout.tsx](../frontend/src/components/Layout.tsx) | `rounded-DEFAULT` → `rounded`. Gradient banner on the profile card, initials in the header avatar, more readable Messages badge. |
| [frontend/src/flows/user/copilot/ask/CitationCard.tsx](../frontend/src/flows/user/copilot/ask/CitationCard.tsx) | `rounded-DEFAULT` → `rounded` |
| [frontend/src/flows/user/copilot/ask/EmptyState.tsx](../frontend/src/flows/user/copilot/ask/EmptyState.tsx) | `rounded-DEFAULT` → `rounded` |
| [frontend/src/flows/user/copilot/ask/ErrorBlock.tsx](../frontend/src/flows/user/copilot/ask/ErrorBlock.tsx) | `rounded-DEFAULT` → `rounded` |
| [frontend/src/flows/user/copilot/ask/MarkdownBody.tsx](../frontend/src/flows/user/copilot/ask/MarkdownBody.tsx) | `rounded-DEFAULT` → `rounded` |
| [frontend/src/flows/user/copilot/ask/SourcesRow.tsx](../frontend/src/flows/user/copilot/ask/SourcesRow.tsx) | `rounded-DEFAULT` → `rounded` |
| [frontend/src/flows/user/copilot/ask/StreamingIndicator.tsx](../frontend/src/flows/user/copilot/ask/StreamingIndicator.tsx) | `rounded-DEFAULT` → `rounded` |

---

## 3. Profile page with editable name and bio

**Commit:** `82d9619`

View any user's profile at `/users/<login>`, and edit your own display name and bio.

**Backend**
| File | Change |
|---|---|
| [backend/app/oauth/dependencies.py](../backend/app/oauth/dependencies.py) | **New.** `get_current_user` / `CurrentUser`: reads the `access_token` cookie, checks the JWT and loads the user, or returns 401. Every user endpoint uses it. |
| [backend/app/oauth/user.py](../backend/app/oauth/user.py) | New column `bio` (up to 500 characters). |
| [backend/alembic/versions/d1e2f3a4b5c6_add_bio_to_users.py](../backend/alembic/versions/d1e2f3a4b5c6_add_bio_to_users.py) | **New migration**: adds `users.bio`. |
| [backend/app/user/profile/schemas.py](../backend/app/user/profile/schemas.py) | **New.** `UserProfile` (what the API returns) and `ProfileUpdate` (validation: name 1-100 characters, bio up to 500, whitespace trimmed, any other field rejected, so `role` can't be changed this way). |
| [backend/app/user/profile/router.py](../backend/app/user/profile/router.py) | **New.** `GET /api/v1/users/me`, `PUT /api/v1/users/me`, `GET /api/v1/users/{login}`. |
| [backend/app/user/profile/\_\_init\_\_.py](../backend/app/user/profile/__init__.py) | **New** (package). |
| [backend/app/api.py](../backend/app/api.py) | Registers the profile router and removes the temporary "who am I" endpoint from change 1. |
| [backend/tests/test_profile.py](../backend/tests/test_profile.py) | **New.** 6 validation tests. |

**Frontend**
| File | Change |
|---|---|
| [frontend/src/components/Avatar.tsx](../frontend/src/components/Avatar.tsx) | **New** reusable avatar. Shows initials, which act as the default avatar. |
| [frontend/src/flows/user/profile/ProfilePage.tsx](../frontend/src/flows/user/profile/ProfilePage.tsx) | **New** profile page: banner, avatar, name, `@login`, role and bio, plus "Edit profile" on your own page. Handles the loading and not-found states. |
| [frontend/src/flows/user/profile/ProfileEditForm.tsx](../frontend/src/flows/user/profile/ProfileEditForm.tsx) | **New** edit form. Checks the same rules as the backend, shows a character counter and server errors, and has accessible labels. |
| [frontend/src/flows/user/profile/api.ts](../frontend/src/flows/user/profile/api.ts) | **New.** `getProfile(login)` and `updateMyProfile()`. |
| [frontend/src/flows/user/profile/index.ts](../frontend/src/flows/user/profile/index.ts) | **New** (exports). |
| [frontend/src/components/Layout.tsx](../frontend/src/components/Layout.tsx) | Avatars and your name link to your profile. Passes `{ me, setMe }` to pages via `useOutletContext`, so an edit updates the sidebar straight away. |
| [frontend/src/app/App.tsx](../frontend/src/app/App.tsx) | Route `/users/:login`. |
| [frontend/src/app/authentication/login/Auth.api.ts](../frontend/src/app/authentication/login/Auth.api.ts) | `getMe()` calls `/api/v1/users/me`; the `Me` type gains `bio`. |

---

## 4. Avatar upload with default fallback

**Commit:** `7f458dd`

Click the camera on your own avatar to upload a PNG, JPEG or WebP up to 2 MB.
"Remove photo" goes back to the default (initials).

**Backend**
| File | Change |
|---|---|
| [backend/app/user/profile/avatar.py](../backend/app/user/profile/avatar.py) | **New.** `process_avatar()` checks the real file type from its contents with Pillow (the browser's Content-Type is never trusted), rejects images with huge dimensions, then re-encodes to a 256×256 WebP. Re-encoding strips EXIF/GPS data and anything hidden inside the file. |
| [backend/app/user/profile/router.py](../backend/app/user/profile/router.py) | `POST /api/v1/users/me/avatar` (upload, 413 if over 2 MB, 422 if not an image) and `DELETE /api/v1/users/me/avatar`. Each upload gets a random filename so browsers never show an old cached avatar, and old files are deleted. |
| [backend/app/user/profile/schemas.py](../backend/app/user/profile/schemas.py) | `avatar_url` added to `UserProfile`. |
| [backend/app/oauth/user.py](../backend/app/oauth/user.py) | New column `avatar_url`. |
| [backend/alembic/versions/e2f3a4b5c6d7_add_avatar_url_to_users.py](../backend/alembic/versions/e2f3a4b5c6d7_add_avatar_url_to_users.py) | **New migration**: adds `users.avatar_url`. |
| [backend/Dockerfile](../backend/Dockerfile) | Creates `/media/avatars`, owned by the `app` user. The backend previously couldn't write to `/media`. |
| [backend/tests/test_avatar.py](../backend/tests/test_avatar.py) | **New.** 7 tests: PNG, JPEG and WebP accepted; text, fake PHP, GIF and truncated files rejected. |

Files are stored in the `media_data` Docker volume and served by nginx at `/media/avatars/...`.

**Frontend**
| File | Change |
|---|---|
| [frontend/src/flows/user/profile/AvatarUploader.tsx](../frontend/src/flows/user/profile/AvatarUploader.tsx) | **New.** Camera button, file checks (type and 2 MB), uploading state, "Remove photo", error messages. |
| [frontend/src/components/Avatar.tsx](../frontend/src/components/Avatar.tsx) | Shows the uploaded image; falls back to initials if there's none or it fails to load. |
| [frontend/src/flows/user/profile/api.ts](../frontend/src/flows/user/profile/api.ts) | `uploadAvatar()` and `deleteAvatar()`. |
| [frontend/src/flows/user/profile/ProfilePage.tsx](../frontend/src/flows/user/profile/ProfilePage.tsx) | Uses the uploader on your own profile. |
| [frontend/src/components/Layout.tsx](../frontend/src/components/Layout.tsx) | Header and sidebar show the uploaded avatar. |
| [frontend/src/app/authentication/login/Auth.api.ts](../frontend/src/app/authentication/login/Auth.api.ts) | `Me` type gains `avatar_url`. |

---

## 5. Friends system, user search, logout

**Commit:** `6bf1bbc`

Find people on `/friends`, send a request, and the other person accepts or declines.
You can cancel a request you sent, or remove a friend. If both people click
"Add friend", the second click accepts the first.

**Backend**
| File | Change |
|---|---|
| [backend/app/user/friends/models.py](../backend/app/user/friends/models.py) | **New** `Friendship` table: `requester_id`, `addressee_id`, `status` (`pending` or `accepted`). |
| [backend/alembic/versions/f3a4b5c6d7e8_create_friendships.py](../backend/alembic/versions/f3a4b5c6d7e8_create_friendships.py) | **New migration**: `friendships` table. The database itself blocks friending yourself, and a unique index on `(LEAST(a,b), GREATEST(a,b))` allows only **one row per pair**, even when two requests arrive at once. Deleting a user deletes their friendships. |
| [backend/app/user/friends/service.py](../backend/app/user/friends/service.py) | **New.** The rules: `add_friend` (send, or accept if they already asked you; handles simultaneous requests), `remove_friend` (unfriend, cancel or decline), `get_status`, `overview`. |
| [backend/app/user/friends/schemas.py](../backend/app/user/friends/schemas.py) | **New.** `FriendStatus` (`none`, `outgoing`, `incoming`, `friends`), `FriendshipStatus`, `FriendsOverview`. |
| [backend/app/user/friends/router.py](../backend/app/user/friends/router.py) | **New.** `GET /api/v1/friends`; `GET`, `POST` and `DELETE` on `/api/v1/friends/{login}`. |
| [backend/app/user/friends/\_\_init\_\_.py](../backend/app/user/friends/__init__.py) | **New** (package). |
| [backend/app/user/profile/router.py](../backend/app/user/profile/router.py) | User search `GET /api/v1/users?q=` (login or name, up to 20 results; `%` and `_` are treated as plain characters). |
| [backend/app/user/profile/schemas.py](../backend/app/user/profile/schemas.py) | `UserSummary` (small user card for lists). |
| [backend/app/api.py](../backend/app/api.py) | Registers the friends router. Adds `POST /api/v1/auth/logout`, which clears the HttpOnly login cookie. |
| [backend/tests/test_friends.py](../backend/tests/test_friends.py) | **New.** 5 tests against the real DB: request then accept, idempotent add, remove/decline/cancel, can't add yourself, **two simultaneous requests end up as one row**. |

**Frontend**
| File | Change |
|---|---|
| [frontend/src/flows/user/friends/FriendsPage.tsx](../frontend/src/flows/user/friends/FriendsPage.tsx) | **New** `/friends` page: search (waits until you stop typing), friend requests, sent requests, your friends. |
| [frontend/src/flows/user/friends/FriendButton.tsx](../frontend/src/flows/user/friends/FriendButton.tsx) | **New.** One button for every state: Add friend, Requested · Cancel, Accept/Decline, Friends · Remove (asks for confirmation). |
| [frontend/src/flows/user/friends/api.ts](../frontend/src/flows/user/friends/api.ts) | **New.** API calls and types. |
| [frontend/src/flows/user/friends/index.ts](../frontend/src/flows/user/friends/index.ts) | **New** (exports). |
| [frontend/src/lib/http.ts](../frontend/src/lib/http.ts) | **New** shared helper: logged-in `fetch`, plus turning FastAPI errors into readable messages. |
| [frontend/src/flows/user/profile/ProfilePage.tsx](../frontend/src/flows/user/profile/ProfilePage.tsx) | Friend button on other people's profiles. |
| [frontend/src/flows/user/profile/api.ts](../frontend/src/flows/user/profile/api.ts) | Uses the shared error helper. |
| [frontend/src/components/Layout.tsx](../frontend/src/components/Layout.tsx) | "Friends" link in the sidebar, and a **logout** button in the header. |
| [frontend/src/app/App.tsx](../frontend/src/app/App.tsx) | Route `/friends`. |
| [frontend/src/app/authentication/login/Auth.api.ts](../frontend/src/app/authentication/login/Auth.api.ts) | `logout()`. |

---

## 6. Live online status for friends

**Commit:** `75548f3`

Friends get a green (online) or grey (offline) dot that updates **live**, with no page reload.
You count as online while at least one tab of the app is open. Only friends can
see each other's status.

**How it works:** the app keeps one Socket.IO connection open to `/presence`. When
your first tab connects or your last tab closes, the server sends
`presence {user_id, online}` to your friends.

**Backend**
| File | Change |
|---|---|
| [backend/app/user/friends/presence.py](../backend/app/user/friends/presence.py) | **New.** In memory, tracks which users are online and their open connections (one per tab). |
| [backend/app/realtime/namespaces/presence.py](../backend/app/realtime/namespaces/presence.py) | **New** Socket.IO namespace `/presence`. Checks the same login cookie as the API (refuses connections without one) and notifies friends. |
| [backend/app/realtime/server.py](../backend/app/realtime/server.py) | Registers the `/presence` namespace. |
| [backend/app/user/friends/service.py](../backend/app/user/friends/service.py) | `friend_ids()`; the friends list includes `online`. |
| [backend/app/user/friends/schemas.py](../backend/app/user/friends/schemas.py) | `FriendSummary` with `online`; `FriendshipStatus.online`. |
| [backend/app/user/friends/router.py](../backend/app/user/friends/router.py) | `GET /api/v1/friends/{login}` returns `online` (only true for friends). |
| [backend/tests/test_presence.py](../backend/tests/test_presence.py) | **New.** Online until the last tab closes. |

**Frontend**
| File | Change |
|---|---|
| [frontend/src/lib/presence.ts](../frontend/src/lib/presence.ts) | **New.** One shared presence connection for the app, plus `onPresence()` for pages to listen to changes. |
| [frontend/src/components/Layout.tsx](../frontend/src/components/Layout.tsx) | Opens the connection when you're signed in; closes it on logout. |
| [frontend/src/components/Avatar.tsx](../frontend/src/components/Avatar.tsx) | `online` prop draws the dot, with an "Online"/"Offline" label for screen readers. |
| [frontend/src/flows/user/friends/FriendsPage.tsx](../frontend/src/flows/user/friends/FriendsPage.tsx) | Live dots, "Online"/"Offline" label, online friends sorted first. |
| [frontend/src/flows/user/friends/api.ts](../frontend/src/flows/user/friends/api.ts) | `FriendSummary` type; `getFriendStatus()` returns `online`. |
| [frontend/src/flows/user/profile/ProfilePage.tsx](../frontend/src/flows/user/profile/ProfilePage.tsx) | Dot and label on a friend's profile, updating live. |
| [frontend/package.json](../frontend/package.json) / [package-lock.json](../frontend/package-lock.json) | New dependency: `socket.io-client`. |
| [frontend/vite.config.ts](../frontend/vite.config.ts) | Dev server forwards `/socket.io` (websockets) to the backend. |

---

## 7. Refresh tokens (stay logged in for 7 days)

**Commit:** `0944d1a`

Before this, the 15-minute access token expired and you were logged out.

**How it works**
1. Login sets two HttpOnly cookies: `access_token` (JWT, 15 min, `path=/`) and
   `refresh_token` (random, 7 days, `path=/api/v1/auth`, so it's only sent to refresh and logout).
2. While the app is open it refreshes every 10 minutes.
3. If a request still gets a 401, the frontend calls `POST /api/v1/auth/refresh` once and
   retries. Several requests that fail at the same moment share that one refresh.
4. **Rotation:** every refresh replaces the refresh token. If an old one is used again
   (outside a 30-second grace window for two tabs), that suggests it was stolen,
   and **all sessions of that user are revoked**.
5. Logout revokes the refresh token in the database.
6. Only a sha256 hash of each refresh token is stored, never the token itself.

**Backend**
| File | Change |
|---|---|
| [backend/app/oauth/refresh_tokens.py](../backend/app/oauth/refresh_tokens.py) | **New.** `RefreshToken` model, `issue`, `rotate` (reuse detection, grace window, `FOR UPDATE` row lock), `revoke`, `set_auth_cookies`, `clear_auth_cookies`. |
| [backend/alembic/versions/a4b5c6d7e8f9_create_refresh_tokens.py](../backend/alembic/versions/a4b5c6d7e8f9_create_refresh_tokens.py) | **New migration**: `refresh_tokens` table. |
| [backend/app/api.py](../backend/app/api.py) | New `POST /api/v1/auth/refresh`. The OAuth callback issues both cookies; logout revokes the refresh token and clears both cookies. |
| [backend/tests/test_refresh_tokens.py](../backend/tests/test_refresh_tokens.py) | **New.** 7 tests: rotation, raw token never stored, grace window, reuse revokes everything, revoked/expired fail, two refreshes at once. |

**Frontend**
| File | Change |
|---|---|
| [frontend/src/lib/http.ts](../frontend/src/lib/http.ts) | `refreshSession()` (several callers share one request) and `authFetch()` (on a 401, refresh and retry). `api()` uses it. |
| [frontend/src/app/authentication/login/Auth.api.ts](../frontend/src/app/authentication/login/Auth.api.ts) | `getMe()` uses `authFetch`. |
| [frontend/src/flows/user/profile/api.ts](../frontend/src/flows/user/profile/api.ts) | All calls use `authFetch`. |
| [frontend/src/components/Layout.tsx](../frontend/src/components/Layout.tsx) | Background refresh every 10 minutes while signed in. |
| [frontend/src/lib/presence.ts](../frontend/src/lib/presence.ts) | If the socket handshake is refused (expired token), refresh and reconnect once. |

---

## 8. Roles and permission checks

**Commit:** `6d82683`

> **Replaced in part by [change 12](#12-protected-superadmin-created-at-startup):** there are now three roles, `users:manage_roles` belongs only to the superadmin, and `ADMIN_LOGINS` was removed.

Two roles: `user` (default for every 42 login) and `admin`. Endpoints check
**permissions**, never role names, so adding a role later is a one-line change.

| Role | Permissions |
|---|---|
| `user` | `profile:edit_own`, `friends:manage` |
| `admin` | everything a user has, plus `users:view`, `users:edit`, `users:manage_roles`, `users:delete` |

**The first admin:** logins listed in `ADMIN_LOGINS` (in `deploy/.env`) become admin when they sign in.

| File | Change |
|---|---|
| [backend/app/oauth/permissions.py](../backend/app/oauth/permissions.py) | **New.** `Role`, `Permission`, the `ROLE_PERMISSIONS` table, `has_permission()`, `require(permission)` (a FastAPI dependency that returns 403 if the permission is missing), `admin_logins()`. |
| [backend/app/oauth/manager.py](../backend/app/oauth/manager.py) | Logins in `ADMIN_LOGINS` become admin on sign-in; everyone else starts as `user`. |
| [backend/app/oauth/user.py](../backend/app/oauth/user.py) | `role` defaults to `user`; the database only accepts `user` or `admin`. |
| [backend/alembic/versions/b5c6d7e8f9a0_constrain_user_roles.py](../backend/alembic/versions/b5c6d7e8f9a0_constrain_user_roles.py) | **New migration**: unknown roles become `user`, then the constraint is added. |
| [backend/app/user/profile/router.py](../backend/app/user/profile/router.py) | Editing your profile and avatar requires `profile:edit_own`. The `/me` endpoints return `MyProfile`. |
| [backend/app/user/profile/schemas.py](../backend/app/user/profile/schemas.py) | `MyProfile`: your profile plus the list of `permissions` your role has. |
| [backend/app/user/friends/router.py](../backend/app/user/friends/router.py) | Adding and removing friends requires `friends:manage`. |
| [backend/tests/test_permissions.py](../backend/tests/test_permissions.py) | **New.** Permission table, `require()` returning 403, `ADMIN_LOGINS` parsing. |
| [deploy/.env.example](../deploy/.env.example) | Added the missing auth settings: `UID`, `SECRET`, `AUTH_URL`, `REDIRECT_URL`, `JWT_SECRET`, `FRONTEND_URL`, `ADMIN_LOGINS`. |

---

## 9. Admin user-management API

**Commit:** `8062439`

> **Replaced in part by [change 12](#12-protected-superadmin-created-at-startup):** admins now manage only `user` accounts, and only the superadmin manages admins and changes roles. The "own role / delete yourself" checks now return 403 instead of 400.

The CRUD endpoints for admins (see the [API reference](#api-reference-new-and-changed-endpoints)).

**Safety rules:**
- An admin can't change their own role or delete themselves, so there's always at least one admin.
- Role changes apply on the user's very next request, because the role is read from the database on every request.
- Deleting a user also deletes their friendships and refresh tokens (database cascade). Their pitches stay, with no author.

| File | Change |
|---|---|
| [backend/app/admin/users/router.py](../backend/app/admin/users/router.py) | **New.** List (search, role filter, pages), view, edit (name, bio, role), remove avatar, delete, plus the safety rules. |
| [backend/app/admin/users/schemas.py](../backend/app/admin/users/schemas.py) | **New.** `AdminUserPage` (one page of results) and `AdminUserUpdate` (all fields optional, unknown fields rejected). |
| [backend/app/admin/\_\_init\_\_.py](../backend/app/admin/__init__.py), [backend/app/admin/users/\_\_init\_\_.py](../backend/app/admin/users/__init__.py) | **New** (packages). |
| [backend/app/api.py](../backend/app/api.py) | Registers the admin router. |
| [backend/app/oauth/user.py](../backend/app/oauth/user.py) | `login_or_name_contains(q)`: search filter shared by user search and the admin list. |
| [backend/app/user/profile/avatar.py](../backend/app/user/profile/avatar.py) | `AVATAR_DIR`, `AVATAR_URL_PREFIX`, `delete_avatar_file()` moved here (shared by profile and admin). |
| [backend/app/user/profile/router.py](../backend/app/user/profile/router.py) | Uses the shared helpers. |
| [backend/tests/test_admin_users.py](../backend/tests/test_admin_users.py) | **New.** End-to-end tests: 403 for regular users, search/filter/pages, editing (422 for bad input, 404 for a missing user), role change working on the next request, 400 when an admin edits their own role, remove avatar, delete (cascades; 400 when deleting yourself). |

---

## 10. Role-based UI and the Users management page

**Commit:** `df58645`

> **Updated in [change 12](#12-protected-superadmin-created-at-startup):** rows you can't manage show a lock and the reason instead of buttons, the role switch appears only for the superadmin, and the badge also shows `superadmin`.

| | `user` | `admin` |
|---|---|---|
| "Users" menu item and page `/admin/users` | hidden; the URL shows "Only admins can manage users" | search, role filter, pages, and on each user: role switch, Edit, Remove photo, Delete |
| Someone else's profile | profile and the friend button | the same, plus an **Admin** panel: role switch, remove photo, delete |
| Admin badge | — | next to your login in the sidebar, and on admins in the user list |

Every action asks for confirmation. The UI checks permissions from `/users/me`; the backend still enforces every rule.

| File | Change |
|---|---|
| [frontend/src/lib/permissions.ts](../frontend/src/lib/permissions.ts) | **New.** Permission names that mirror the backend, `ROLES`, `can(me, permission)`. |
| [frontend/src/flows/admin/users/AdminUsersPage.tsx](../frontend/src/flows/admin/users/AdminUsersPage.tsx) | **New** `/admin/users` page: search (waits until you stop typing), role filter, pages, inline edit, locked view for non-admins, plus `RoleBadge`. |
| [frontend/src/flows/admin/users/AdminUserActions.tsx](../frontend/src/flows/admin/users/AdminUserActions.tsx) | **New.** Role switch, Edit, Remove photo, Delete, each shown only with the right permission. Shared by the list and profile pages. |
| [frontend/src/flows/admin/users/api.ts](../frontend/src/flows/admin/users/api.ts) | **New.** `listUsers`, `updateUser`, `removeUserAvatar`, `deleteUser`. |
| [frontend/src/flows/admin/users/index.ts](../frontend/src/flows/admin/users/index.ts) | **New** (exports). |
| [frontend/src/flows/user/profile/ProfileEditForm.tsx](../frontend/src/flows/user/profile/ProfileEditForm.tsx) | Now reusable: it takes the user and a `save` function, so admins use it to edit other users. |
| [frontend/src/flows/user/profile/ProfilePage.tsx](../frontend/src/flows/user/profile/ProfilePage.tsx) | Edit, avatar upload and the friend button depend on permissions, plus the Admin panel. |
| [frontend/src/components/Layout.tsx](../frontend/src/components/Layout.tsx) | Admin-only "Users" menu item, and the admin badge. |
| [frontend/src/app/authentication/login/Auth.api.ts](../frontend/src/app/authentication/login/Auth.api.ts) | `UserProfile` type (any user) and `Me` type (you, plus `permissions`). |
| [frontend/src/flows/user/profile/api.ts](../frontend/src/flows/user/profile/api.ts) | `getProfile()` returns `UserProfile`. |
| [frontend/src/app/App.tsx](../frontend/src/app/App.tsx) | Route `/admin/users`. |

---

## 11. Email + password sign-up and login

**Commit:** `ea74f3e`

Mandatory in the subject (III.3). Sign up with email, username, display name and password, then
log in with email and password. You get the same cookies as with 42 login, so the rest of the
app works the same either way.

**Security**
- Passwords are hashed with **Argon2id** (`pwdlib`), with a random salt per user. Only the hash is stored (`$argon2id$v=19$m=65536,t=3,p=4$…`).
- Unknown email and wrong password get the same message and take the same time, so the login doesn't reveal which emails have accounts.
- Sign-up can never choose a role (any field other than the four listed is rejected), and some usernames are reserved (`me`, `admin`, …).
- Passwords must be 8–128 characters. The upper limit stops huge inputs from tying up the hasher.
- **42 accounts are matched by their 42 id, not their username.** Otherwise someone could sign up by email as `ofrikel` before the real ofrikel used 42 and take over her 42 login. If a new 42 user's username is already taken, their account gets `<login>-42`.
- Login tokens now identify the app's own user id (`sub = "user:<id>"`) instead of the 42 id, because email users have none. Old tokens get a 401, which the frontend answers with a silent refresh.

**Backend**
| File | Change |
|---|---|
| [backend/app/oauth/email_auth.py](../backend/app/oauth/email_auth.py) | **New.** `POST /api/v1/auth/signup` and `POST /api/v1/auth/login`, with validation. |
| [backend/app/oauth/passwords.py](../backend/app/oauth/passwords.py) | **New.** `hash_password()` and `verify_password()`, including the equal-time check for unknown emails. |
| [backend/alembic/versions/c6d7e8f9a0b1_add_email_password_to_users.py](../backend/alembic/versions/c6d7e8f9a0b1_add_email_password_to_users.py) | **New migration**: `users.email` (unique) and `users.password_hash`. |
| [backend/app/oauth/user.py](../backend/app/oauth/user.py) | `email` and `password_hash` columns. |
| [backend/app/oauth/jwt.py](../backend/app/oauth/jwt.py) | `create_access_token(user_id)` and `user_id_from(payload)`. |
| [backend/app/oauth/dependencies.py](../backend/app/oauth/dependencies.py), [backend/app/realtime/namespaces/presence.py](../backend/app/realtime/namespaces/presence.py), [backend/app/oauth/refresh_tokens.py](../backend/app/oauth/refresh_tokens.py) | Look the user up by id from the token. |
| [backend/app/oauth/manager.py](../backend/app/oauth/manager.py) | 42 users matched by 42 id, the `-42` suffix when a username is taken, and the 42 email saved for new accounts. |
| [backend/app/api.py](../backend/app/api.py) | Registers the email auth router. |
| [backend/tests/test_email_auth.py](../backend/tests/test_email_auth.py) | **New.** Sign-up and cookies, salted hashes, duplicates (409), 9 kinds of invalid input (422), login (correct, wrong, unknown email with the same response), a 42-only account can't use password login, and the username-squatting attack. |

**Frontend**
| File | Change |
|---|---|
| [frontend/src/app/authentication/login/Login.tsx](../frontend/src/app/authentication/login/Login.tsx) | Real "Sign in with email", a new **Create account** screen (checks the same rules, errors linked to their fields for screen readers), and the separate "Login as Admin" screen removed (the server decides the role). |
| [frontend/src/app/authentication/login/Auth.api.ts](../frontend/src/app/authentication/login/Auth.api.ts) | `signupWithEmail()`, `loginWithEmail()`, and the shared validation rules. |
| [frontend/src/app/authentication/login/Login.css](../frontend/src/app/authentication/login/Login.css) | Styles for field errors, hints and the form error. |

---

## 12. Protected superadmin created at startup

**Commit:** `000adf6`

A third role, `superadmin`, which can't be edited by anyone and is the only role that can make
or remove admins. It's created by a script that runs on every container start, so
`docker compose up` is all you need. This replaced `ADMIN_LOGINS`.

**The startup script** (`python -m app.cli.create_superadmin`, also `make seed`) is safe to run on every start:
| Situation | Result |
|---|---|
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` empty | Skipped; the backend starts normally |
| No account with that email | Creates it as superadmin (Argon2-hashed password) |
| An account with that email exists | Makes sure it's superadmin; **never overwrites its password** |
| Bad config (invalid email, short password, only one of the two set, username taken) | Clear error in the logs and the backend doesn't start, so a broken setup is noticed immediately |

| File | Change |
|---|---|
| [backend/app/oauth/permissions.py](../backend/app/oauth/permissions.py) | Three roles, `ASSIGNABLE_ROLES` (`user` / `admin` only), and `can_manage(actor, target)`, which allows acting only on a lower role and never yourself. `users:manage_roles` is superadmin-only. `admin_logins()` removed. |
| [backend/app/admin/users/router.py](../backend/app/admin/users/router.py) | Edit, remove photo and delete check `can_manage` and return a clear 403 reason. Role changes need `users:manage_roles`. |
| [backend/app/admin/users/schemas.py](../backend/app/admin/users/schemas.py) | `role` can only be `"user"` or `"admin"`, so `"superadmin"` returns 422. |
| [backend/app/oauth/manager.py](../backend/app/oauth/manager.py) | `ADMIN_LOGINS` promotion removed; new 42 accounts are `user`. |
| [backend/app/oauth/user.py](../backend/app/oauth/user.py), [backend/alembic/versions/d7e8f9a0b1c2_add_superadmin_role.py](../backend/alembic/versions/d7e8f9a0b1c2_add_superadmin_role.py) | The DB constraint now allows `superadmin` (**new migration**). |
| [backend/app/cli/create_superadmin.py](../backend/app/cli/create_superadmin.py) | **New.** The startup script. It uses the same validation as public sign-up and never prints the password. |
| [backend/entrypoint.sh](../backend/entrypoint.sh) | Runs the script right after the migrations. |
| [Makefile](../Makefile) | `make seed` runs the script (it used to point at a missing `app.cli.seed`). |
| [deploy/.env.example](../deploy/.env.example) | `ADMIN_LOGINS` replaced by `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `SUPERADMIN_LOGIN`, `SUPERADMIN_NAME`. |
| [backend/tests/test_permissions.py](../backend/tests/test_permissions.py) | The "who can manage whom" table, and the superadmin role never being assignable. |
| [backend/tests/test_admin_users.py](../backend/tests/test_admin_users.py) | Admins get 403 on other admins and the superadmin, only the superadmin changes roles, and the superadmin can't change or delete itself. |
| [backend/tests/test_create_superadmin.py](../backend/tests/test_create_superadmin.py) | **New.** Skips when unset, bad config, creates then reports unchanged (password kept), promotes an existing account, username conflict. |
| [frontend/src/lib/permissions.ts](../frontend/src/lib/permissions.ts) | `ROLES` (3), `ASSIGNABLE_ROLES`, and `canManage()`, matching the backend. |
| [frontend/src/flows/admin/users/AdminUserActions.tsx](../frontend/src/flows/admin/users/AdminUserActions.tsx) | Actions only when you can manage the account, otherwise a lock and the reason. The role switch offers only `user` and `admin`. |
| [frontend/src/flows/admin/users/AdminUsersPage.tsx](../frontend/src/flows/admin/users/AdminUsersPage.tsx), [frontend/src/components/Layout.tsx](../frontend/src/components/Layout.tsx), [frontend/src/flows/admin/users/api.ts](../frontend/src/flows/admin/users/api.ts) | `RoleBadge` shows `admin` or `superadmin`; the sidebar badge is no longer cut off. |

---

## API reference (new and changed endpoints)

All endpoints need the login cookie, except `/auth/signup` and `/auth/login` (open), and `/auth/refresh` and `/auth/logout` (refresh cookie).

| Method | Path | What |
|---|---|---|
| `POST` | `/api/v1/auth/signup` | Create an account `{email, login, fullname, password}` and log in (201) |
| `POST` | `/api/v1/auth/login` | Log in `{email, password}`; 401 "Invalid email or password." |
| `GET` | `/api/v1/users/me` | My profile, plus my `permissions` |
| `PUT` | `/api/v1/users/me` | Update my `fullname` and `bio` |
| `POST` | `/api/v1/users/me/avatar` | Upload avatar (multipart field `file`) |
| `DELETE` | `/api/v1/users/me/avatar` | Remove avatar (back to default) |
| `GET` | `/api/v1/users?q=...` | Search users by login or name |
| `GET` | `/api/v1/users/{login}` | A user's profile |
| `GET` | `/api/v1/friends` | My friends, incoming and outgoing requests |
| `GET` | `/api/v1/friends/{login}` | My status with a user (+ `online` if friends) |
| `POST` | `/api/v1/friends/{login}` | Send request, or accept theirs |
| `DELETE` | `/api/v1/friends/{login}` | Unfriend, cancel or decline |
| `POST` | `/api/v1/auth/refresh` | New access token (rotates the refresh token) |
| `POST` | `/api/v1/auth/logout` | Revoke refresh token, clear cookies |
| Socket.IO | namespace `/presence` | Event `presence {user_id, online}` sent to friends |
| `GET` | `/api/v1/admin/users?q=&role=&page=&page_size=` | **Admin.** List users: search, filter by role, pages (20 per page by default, up to 100) |
| `GET` | `/api/v1/admin/users/{id}` | **Admin.** View one user |
| `PATCH` | `/api/v1/admin/users/{id}` | **Admin.** Edit `fullname`, `bio` (only the fields sent). `role` (`user`/`admin`) is **superadmin only** |
| `DELETE` | `/api/v1/admin/users/{id}/avatar` | **Admin.** Remove a user's avatar |
| `DELETE` | `/api/v1/admin/users/{id}` | **Admin.** Delete a user |

Admin endpoints only work on accounts with a lower role than yours (see [Roles today](#roles-today)).

- Missing permission → `403 {"detail": "Your role (user) is not allowed to do this."}`
- Account you can't manage → `403` with the reason: `"Only the superadmin can manage admins."`, `"The superadmin account is protected."` or `"You can't manage your own account here; use your profile page."`

Interactive docs: http://localhost:8000/docs

## Database migrations (in order)

| Revision | What |
|---|---|
| `d1e2f3a4b5c6` | `users.bio` |
| `e2f3a4b5c6d7` | `users.avatar_url` |
| `f3a4b5c6d7e8` | `friendships` table |
| `a4b5c6d7e8f9` | `refresh_tokens` table |
| `b5c6d7e8f9a0` | `users.role` limited to `user` / `admin`, default `user` |
| `c6d7e8f9a0b1` | `users.email` (unique) and `users.password_hash` |
| `d7e8f9a0b1c2` | `users.role` also allows `superadmin` |

The backend runs migrations automatically on start, then the superadmin script (`backend/entrypoint.sh`).

---

## Setup notes for teammates

- **Existing `media_data` volume:** if avatar upload fails with a permission error, run this once:
  ```bash
  docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.dev.yml exec -u 0 backend chown app:app /media
  ```
  New volumes get the right owner from the Dockerfile automatically.
- **Log in again** after pulling change 7 to get a refresh cookie.
- **`FRONTEND_URL`** must be in your `deploy/.env` if your frontend is not at `https://localhost:8443/`.
- **Superadmin:** set `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` (at least 8 characters) in `deploy/.env`,
  then `docker compose … up -d --force-recreate backend` (`.env` is only read when the container is created).
  Sign in with "Sign in with email". The email must be a real-looking domain: `.local` is rejected as reserved.
  Then make teammates admins from the **Users** page. `ADMIN_LOGINS` no longer exists; remove it from your `.env`.
- `deploy/.env.example` lists every setting.

## Running the tests

Run only these files. They create and delete their own throwaway users:

```bash
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.dev.yml exec backend \
  python -m pytest -o asyncio_mode=auto \
  tests/test_profile.py tests/test_avatar.py tests/test_friends.py \
  tests/test_presence.py tests/test_refresh_tokens.py tests/test_oauth_auth.py \
  tests/test_permissions.py tests/test_admin_users.py \
  tests/test_email_auth.py tests/test_create_superadmin.py
```

> **Warning:** do **not** run the whole suite against your dev database.
> [backend/tests/test_pitch_refiner.py](../backend/tests/test_pitch_refiner.py) deletes **every user**,
> including real accounts.

---

## Known limitations / follow-ups

| Item | Why it matters |
|---|---|
| No rate limiting on failed logins | Someone could keep guessing passwords. Add a per-IP or per-email limit. |
| Email addresses aren't verified | Anyone can sign up with any address. |
| No "change password" | The superadmin's first password comes from `.env` and can't be changed in the app yet. |
| A wrong password logs one red 401 line in the console | That's the browser logging the server's correct rejection, not a JavaScript error, but evaluators look at the console. |
| Cookies are not marked `Secure`; the 42 callback lands on `http://localhost:8000` | The subject requires HTTPS for every connection to the backend. Route the callback through `https://localhost:8443` and set `secure=True` (marked `ponytail:` in `refresh_tokens.py`). |
| Online presence is stored in memory | Works because the backend runs one process (`--workers 1`). Several workers would need Redis (marked `ponytail:` in `presence.py`). |
| After more than 15 minutes away, the first request logs one 401 in the console | Silently recovered by the refresh, but evaluators look at the console. |
| `pitches` decides who you are from an `X-User-Id` header, or takes the first user in the DB | Should use `get_current_user` from `backend/app/oauth/dependencies.py`. |
| The header search bar is decorative | Its placeholder suggests it searches, but it doesn't. Hide it or wire it up. |
| Sidebar "Lvl 9.42", "Circle 05", "Benguerir" and the badge counts are hard-coded | Not stored from 42 yet. |
| A bad `SUPERADMIN_*` config stops the backend from starting | On purpose, so a broken setup is noticed. Change `main()` in `create_superadmin.py` to only warn if you'd rather keep running. |
| Adding a fourth role | Add it to `Role`, `ROLE_PERMISSIONS` and `_RANK` (backend), the DB constraint (new migration), and `ROLES` / `RANK` in `frontend/src/lib/permissions.ts`. |
