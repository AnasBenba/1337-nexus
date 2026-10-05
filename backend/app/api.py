from fastapi import APIRouter, FastAPI
from .oauth import entrypoint
from fastapi.responses import RedirectResponse
from fastapi import Request
from .oauth import manager
import httpx

router = APIRouter()


@router.get("/auth/login", tags=["auth"])
async def auth_login() -> RedirectResponse: 
    return await entrypoint.redirect_to_forttytwo()

@router.get("/api/v1/auth/oauth/42/callback", tags=["auth"])
async def auth_callback(request: Request, code: str, state: str):
    state_cookie = request.cookies.get("state")
    code_verifier_cookie = request.cookies.get("code_verifier")
    if state_cookie != state:
        return {"error": "Invalid state parameter"}
    token = await manager.get_access_token(code, code_verifier_cookie)
    print(token)
    # POST https://api.intra.42.fr/oauth/token

#Headers:
 #   Content-Type: application/x-www-form-urlencoded

#Body:
  #  grant_type=authorization_code
   # client_id=...
    #client_secret=...
    #code=...
    #redirect_uri=...
    #code_verifier=...


@router.get("/health/live", tags=["health"])
async def health_live() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "api",
    }


@router.get("/health/ready", tags=["health"])
async def health_ready() -> dict[str, object]:
    return {
        "status": "ready",
        "dependencies": {
            "database": "unknown",
        },
    }


def register_routes(app: FastAPI) -> None:
    app.include_router(router)
