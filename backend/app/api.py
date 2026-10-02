from fastapi import APIRouter, FastAPI
from .oauth import entrypoint
from fastapi.responses import RedirectResponse
from fastapi import Request

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
