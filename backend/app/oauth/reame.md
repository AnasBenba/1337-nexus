# IDENT-002: Dual-token JWT plan (Nexus)

Goal: after the 42 login, Nexus issues **its own** access JWT and refresh JWT as HttpOnly cookies, rotates the refresh token, and redirects the user to `/home`.

No code in this file on purpose. Each step lists what to build, the **method** to use, and the **module** it comes from.

Reminder: 42's tokens are only used once, to fetch the profile. The JWTs below are created by your backend.

---

## Step 0: Decisions (write them down before coding)

| Decision | Suggested value |
|---|---|
| Library | PyJWT (`pip install pyjwt`) |
| Algorithm | HS256 |
| Access lifetime | 15 minutes |
| Refresh lifetime | 7 days |
| Access claims | `sub` (user id), `role`, `exp`, `iat`, `jti`, `type="access"` |
| Refresh claims | `sub`, `exp`, `iat`, `jti`, `type="refresh"`, `family` |
| Cookie names | `access_token`, `refresh_token` |
| Refresh cookie path | the refresh route only, e.g. `/api/v1/auth/refresh` |

Ask your team if lifetimes or claim names are already fixed.

---

## Step 1: Settings

Add to your existing `Settings` class: JWT secret, access lifetime, refresh lifetime, secure-cookie flag, frontend home URL.

| What | Method / class | Module |
|---|---|---|
| Settings class (already exists) | `BaseSettings`, `SettingsConfigDict` | `pydantic_settings` |
| Hide the secret | `SecretStr`, read with `.get_secret_value()` | `pydantic` |
| Cached settings (already exists) | `lru_cache` | `functools` |

Also add the new values to `.env`.

Check: the app fails at startup if the secret is missing.

---

## Step 2: Token helper functions

Three small functions, with **no FastAPI inside**: create access token, create refresh token, decode and verify a token.

| What | Method / class | Module |
|---|---|---|
| Create a signed token | `jwt.encode(payload, key, algorithm=...)` | `jwt` (PyJWT) |
| Verify and read a token | `jwt.decode(token, key, algorithms=[...])` | `jwt` (PyJWT) |
| Expired token error | `jwt.ExpiredSignatureError` | `jwt` (PyJWT) |
| Any invalid token error | `jwt.InvalidTokenError` | `jwt` (PyJWT) |
| Current time in UTC | `datetime.now(timezone.utc)` | `datetime` |
| Lifetime arithmetic | `timedelta(minutes=..., days=...)` | `datetime` |
| Unique token id (`jti`) | `uuid.uuid4()`, convert with `str()` | `uuid` |

Rules: always pass `algorithms=[...]` to `decode`. Check the `type` claim after decoding.

---

## Step 3: Practice in a Python shell (no FastAPI)

Do these four exercises with the functions from step 2:

1. Create a token and print it (three parts separated by dots).
2. Decode it and print the result.
3. Change one character and decode again (read the error).
4. Create one with a 5-second lifetime, wait, decode again (read the error).

Modules: `jwt`, `datetime`.

---

## Step 4: Make `manage_user` return the user

You need the user's `id` and `role` for the token claims.

| What | Method / class | Module |
|---|---|---|
| Build the query | `select(Users).where(...)` | `sqlalchemy` |
| Run it | `await session.execute(...)` | `sqlalchemy.ext.asyncio.AsyncSession` |
| One row or `None` | `.scalar_one_or_none()` | result object |
| Add a new user | `session.add(...)` | `AsyncSession` |
| Get the generated id before commit | `await session.flush()` | `AsyncSession` |
| Save | `await session.commit()` | `AsyncSession` |

Done when: both branches (new user and existing user) end with a `Users` object returned.

---

## Step 5: Cookie helpers (one place for all cookie rules)

Two functions: set a token cookie, clear a token cookie. Same flags every time.

| What | Method / class | Module |
|---|---|---|
| Set a cookie | `response.set_cookie(key, value, httponly, secure, samesite, path, max_age)` | `fastapi.responses` (`Response` / `RedirectResponse`) |
| Clear a cookie | `response.delete_cookie(key, path=...)` | `fastapi.responses` |

Rules:
- `httponly=True` always.
- `secure` comes from settings (off on local HTTP, on in production).
- `samesite="lax"` (or `"strict"`).
- `max_age` matches the token lifetime.
- `delete_cookie` only works if `path` matches the one used to set it.

---

## Step 6: Callback issues the access token and redirects

Extend the callback you already wrote.

| What | Method / class | Module |
|---|---|---|
| Route and request | `APIRouter`, `Request` | `fastapi` |
| Reject bad state | `HTTPException(status_code=400, ...)` | `fastapi` |
| Safer state comparison | `hmac.compare_digest(a, b)` | `hmac` |
| Create the token | your step 2 function | your module |
| Redirect | `RedirectResponse(url="/home", status_code=303)` | `fastapi.responses` |
| Attach cookies | your step 5 helper | your module |
| Remove one-time cookies | `response.delete_cookie("state", path=...)`, same for `code_verifier` | `fastapi.responses` |

Rule: set the cookies on the **same response object** you return.

Check: devtools, Application tab, Cookies shows `access_token` with HttpOnly ticked.

---

## Step 7: Protect `/home` with a dependency

A function used with `Depends` that reads the access cookie and returns the current user info.

| What | Method / class | Module |
|---|---|---|
| Read the cookie | `request.cookies.get("access_token")` | `fastapi.Request` |
| Verify | step 2 decode function | your module |
| Reject | `HTTPException(status_code=401)` | `fastapi` |
| Plug into a route | `Depends(get_current_user)` | `fastapi` |

Checks:
- Private window with no cookie: 401.
- Edited token: 401.
- Expired token: 401.
- Valid token: 200.

---

## Step 8: Refresh token table and migration

New model with: id, user id (foreign key), `jti`, `family` id, expiry, revoked flag (or timestamp), created time.

| What | Method / class | Module |
|---|---|---|
| Model | `Mapped`, `mapped_column`, inherit your `Base` | `sqlalchemy.orm` |
| Foreign key | `ForeignKey("users.id")` | `sqlalchemy` |
| Column types | `String`, `DateTime(timezone=True)`, `Boolean` | `sqlalchemy` |
| Generate migration | `alembic revision --autogenerate -m "..."` | Alembic CLI |
| Apply migration | `alembic upgrade head` | Alembic CLI |

Do not forget:
- Import the new model in `alembic/env.py` so autogenerate sees it.
- `nexus_app` needs read/write on the new table and its sequence. Your `ALTER DEFAULT PRIVILEGES` should cover this, but verify with `\dt` and a test query as `nexus_app`.
- Do not also create this table with `create_all`.

---

## Step 9: Store the refresh token at login

| What | Method / class | Module |
|---|---|---|
| Hash before storing (optional but recommended) | `hashlib.sha256(token.encode()).hexdigest()` | `hashlib` |
| Open a session | `Depends(get_db_session)` or `SessionLocal()` | `app.core.db` |
| Insert row | `session.add(...)`, `await session.commit()` | `AsyncSession` |

Then add the refresh cookie in the callback with `path` limited to the refresh route.

---

## Step 10: Refresh route with rotation

Flow: read refresh cookie, decode, check `type`, look up `jti`, revoke it, issue a new pair, store the new `jti`, set new cookies.

| What | Method / class | Module |
|---|---|---|
| Read cookie | `request.cookies.get("refresh_token")` | `fastapi.Request` |
| Verify | step 2 decode function | your module |
| Look up the row | `select(...).where(...)`, `.scalar_one_or_none()` | `sqlalchemy` |
| Revoke | `update(...).where(...).values(...)` | `sqlalchemy` |
| Run and save | `await session.execute(...)`, `await session.commit()` | `AsyncSession` |
| Errors | `HTTPException(status_code=401)` | `fastapi` |
| New cookies | step 5 helper | your module |

Reuse detection: if the row is missing or already revoked, revoke **every** token with the same `family` (or same user) and return 401.

Check: call refresh twice with the same old cookie. The second call must fail and revoke the family.

---

## Step 11: Logout route

| What | Method / class | Module |
|---|---|---|
| Read cookie, decode | `request.cookies.get`, step 2 function | `fastapi`, your module |
| Mark the row revoked | `update(...)`, `await session.commit()` | `sqlalchemy` |
| Clear both cookies | step 5 clear helper (same `path` as set) | your module |

---

## Step 12: Test checklist

- [ ] Login sets both cookies with HttpOnly.
- [ ] `/home` returns 401 in a private window.
- [ ] A tampered access token is rejected.
- [ ] An expired access token is rejected (temporarily set the lifetime to about 20 seconds).
- [ ] Refresh returns a new pair and the old refresh row is revoked.
- [ ] Reusing the old refresh cookie fails and revokes the family.
- [ ] Logout revokes the row and clears both cookies.
- [ ] Cookie flags are identical everywhere (check the Application tab).
- [ ] No token appears in the logs (remove every `print` of tokens).

Useful commands:

- `docker compose exec postgres psql -U nexus -d nexus -c "SELECT * FROM refresh_tokens;"`
- `docker compose logs -f backend`

---

## Step 13: Hardening later (not blocking)

- Handle 42 timeouts and error responses (`httpx.ReadTimeout`, missing `access_token`).
- Make user creation safe against two simultaneous logins (`INSERT ... ON CONFLICT`).
- Move table creation out of the login path.
- Redirect to a login page on failure instead of returning raw errors.
- Add `unique` constraints on `login` and `intra_id`, and an Enum or check constraint for `role`.

---

## Suggested build order

1. Steps 1 to 3 (settings, token functions, shell practice)
2. Step 4 (return the user)
3. Steps 5 to 7 (cookie helper, access token on the redirect, protect `/home`)
4. Steps 8 to 11 (refresh table, rotation, logout)
5. Step 12 (full test pass)