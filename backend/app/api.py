from fastapi import APIRouter, FastAPI
from .oauth import entrypoint
from fastapi.responses import RedirectResponse
from fastapi import Request
from fastapi.responses import FileResponse
from .oauth import manager
import httpx
from pathlib import Path

router = APIRouter()


@router.get("/auth/login", tags=["auth"])
async def auth_login() -> RedirectResponse: 
    return await entrypoint.redirect_to_forttytwo()


HOME_PAGE = Path(__file__).parent  / "index.html"


@router.get("/home", tags=["pages"])
async def home() -> FileResponse:
    return FileResponse(HOME_PAGE, media_type="text/html")


@router.get("/api/v1/auth/oauth/42/callback", tags=["auth"])
async def auth_callback(request: Request, code: str, state: str) -> RedirectResponse:
    state_cookie = request.cookies.get("state")
    code_verifier_cookie = request.cookies.get("code_verifier")
    if state_cookie != state:
        return {"error": "Invalid state parameter"}
    token = await manager.get_access_token(code, code_verifier_cookie)
    print(token)
    await manager.manage_user(await manager.get_user(token["access_token"]))
    response = RedirectResponse(url="/home", status_code=303)
    response.delete_cookie("state", path="/")
    response.delete_cookie("code_verifier", path="/")
    return response

    


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
