from http.client import HTTPException
from urllib import response
from .user.copilot.retrieve_curriculum.router import router as retrieve_curriculum_router
from .user.copilot.ask.router import router as ask_router
from .user.copilot.retrieve_curriculum.router import (
    router as retrieve_curriculum_router,
)

from app.user.opportunities.apply.router import router as apply_router
from app.user.opportunities.withdraw_application.router import router as withdraw_application_router
from fastapi import APIRouter, FastAPI
from .oauth import entrypoint
from fastapi.responses import RedirectResponse
from fastapi import Request
from fastapi.responses import FileResponse
from .oauth import manager
from pathlib import Path
from .oauth import jwt

router = APIRouter()


@router.get("/auth/login", tags=["auth"])
async def auth_login() -> RedirectResponse:
    return await entrypoint.redirect_to_forttytwo()


HOME_PAGE = Path(__file__).parent / "index.html"


@router.get("/home", tags=["pages"])
async def home(request: Request) -> FileResponse:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
        )
    payload = jwt.verify_access_token(token)
    return FileResponse(HOME_PAGE, media_type="text/html")


@router.get("/api/v1/auth/oauth/42/callback", tags=["auth"])
async def auth_callback(
    request: Request, code: str, state: str
) -> RedirectResponse:
    state_cookie = request.cookies.get("state")
    code_verifier_cookie = request.cookies.get("code_verifier")

    if state_cookie != state:
        return {"error": "Invalid state parameter"}

    token = await manager.get_access_token(code, code_verifier_cookie)
    nexus_user = await manager.manage_user(
    await manager.get_user(token["access_token"])
    )
    jwt_token = jwt.create_access_token(nexus_user.intra_id)
    response = RedirectResponse(url="/home", status_code=303)
    response.set_cookie(
        key="access_token",
        value=jwt_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=15 * 60,
        path="/",
    )
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
    app.include_router(opportunities_router)
    app.include_router(create_opportunity_router)
    app.include_router(update_opportunity_router)
    app.include_router(publish_opportunity_router)
    app.include_router(match_scoring_router)
    app.include_router(review_applications_router)
    app.include_router(view_opportunity_router)
    app.include_router(retrieve_curriculum_router)
    app.include_router(ask_router)
    app.include_router(apply_router)
    app.include_router(withdraw_application_router)
    app.include_router(refine_project_router)
