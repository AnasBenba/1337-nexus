# 42 Intra OAuth 2.0 with PKCE Implementation Guide

This guide outlines the complete architecture, requirements, and step-by-step execution plan for implementing the **42 Intra OAuth 2.0 Authorization Code Flow with PKCE** inside the backend directory:
`backend/app/flows/authentication/oauth/`

---

## 1. Concept Explanations

### Key Terminology

* **Authorization Code Flow:** A secure 2-step process. First, the user approves access on 42 Intra and gets a short-lived **Authorization Code**. Second, your server trades that code for an **Access Token**.
* **CSRF (Cross-Site Request Forgery):** An attack where a malicious website tricks a user into submitting actions on your site.
* **State Parameter:** A unique, random string generated before redirecting to 42 Intra. When 42 Intra redirects back, it returns this exact string. Verifying it prevents CSRF attacks.
* **PKCE (Proof Key for Code Exchange):** A security extension preventing authorization code interception attacks.
  * **Code Verifier:** A cryptographically random secret string created on your server.
  * **Code Challenge:** A SHA-256 hashed and Base64-URL-encoded version of the Code Verifier.

---

## 2. Requirements & Dependencies

### Python Built-in Libraries (No Installation Needed)
* **`secrets`**: Generates high-entropy random strings for `state` and `code_verifier`.
* **`hashlib`**: Computes the SHA-256 hash of the `code_verifier` to produce the `code_challenge`.
* **`base64`**: Performs URL-safe Base64 encoding without padding (`=`) on the hashed verifier.
* **`urllib.parse`**: Constructs clean query strings for redirect URLs.

### External Dependencies
* **FastAPI**: Backend web framework.
* **`httpx`** (or `requests`): Async HTTP client used for server-to-server calls to exchange codes and fetch user profiles.

---

## 3. Mandatory FastAPI Features Used

* **`APIRouter`**: Groups your OAuth login and callback endpoints cleanly inside `backend/app/flows/authentication/oauth/`.
* **`RedirectResponse`**: Redirects the user's browser directly to 42 Intra's authorization page.
* **`Response` & `Request`**: Sets and reads secure **HTTP-only cookies** used to persist `state` and `code_verifier` across redirects.
* **`HTTPException`**: Handles OAuth validation errors (e.g., state mismatch, expired codes, or failed token exchanges).

---

## 4. Step-by-Step Implementation Plan

### Step 1: Register Application & Set Environment Variables
Register your app on 42 Intra and store the credentials safely in your `.env` file:
* `FORTYTWO_CLIENT_ID`
* `FORTYTWO_CLIENT_SECRET`
* `FORTYTWO_REDIRECT_URI` (e.g., `http://localhost:8000/api/v1/auth/oauth/42/callback`)

---

### Step 2: Implement PKCE & State Helper Functions
Create utility functions inside your OAuth module to handle security tokens:
1. `generate_state()`: Returns a secure random token (`secrets.token_urlsafe(32)`).
2. `generate_code_verifier()`: Generates a high-entropy string (43 to 128 characters).
3. `generate_code_challenge(verifier)`: Computes `base64url(sha256(verifier))` without trailing `=` characters.

---

### Step 3: Implement Login Endpoint (`GET /auth/oauth/42/login`)
1. Generate a new `state` and `code_verifier`.
2. Compute `code_challenge` from the `code_verifier`.
3. Save `state` and `code_verifier` in temporary, encrypted, or **HTTP-only cookies**.
4. Construct the 42 Intra Authorization URL:
   * `client_id`
   * `redirect_uri`
   * `response_type=code`
   * `state`
   * `code_challenge`
   * `code_challenge_method=S256`
5. Return a `RedirectResponse` to the constructed 42 Intra URL.

---

### Step 4: Implement Callback Endpoint (`GET /auth/oauth/42/callback`)
1. Read `code` and `state` parameters from query parameters.
2. Retrieve stored `state` and `code_verifier` from incoming request cookies.
3. **State Validation:** Verify that incoming `state` matches stored `state`. If invalid or missing, raise `HTTPException(status_code=400, detail="Invalid state parameter")`.

---

### Step 5: Code Exchange Request
After state validation succeeds:
1. Make an asynchronous HTTP `POST` request using `httpx` to `https://api.intra.42.fr/oauth/token`.
2. Send form data containing:
   * `grant_type=authorization_code`
   * `client_id=FORTYTWO_CLIENT_ID`
   * `client_secret=FORTYTWO_CLIENT_SECRET`
   * `code=RECEIVED_AUTHORIZATION_CODE`
   * `redirect_uri=FORTYTWO_REDIRECT_URI`
   * `code_verifier=STORED_CODE_VERIFIER`
3. Receive JSON response containing `access_token`.

---

### Step 6: Fetch Profile & Establish Session
1. Send an HTTP `GET` request to `https://api.intra.42.fr/v2/me` passing header `Authorization: Bearer <access_token>`.
2. Parse user profile JSON (extract ID, email, login name, avatar).
3. Search or create the user record in your platform database.
4. Issue your internal session cookie or JWT to keep the user authenticated on **1337.nexus**.
5. Clear temporary `state` and `code_verifier` cookies.

---

## 5. Verification & Done Criteria Checklist

- [ ] Successful authorization redirect to 42 Intra with `code_challenge` and `state`.
- [ ] Mismatched `state` values trigger an HTTP 400 error.
- [ ] Code exchange with 42 Intra succeeds using `code_verifier`.
- [ ] User profile is successfully fetched from `/v2/me`.
- [ ] Application establishes an internal logged-in session.