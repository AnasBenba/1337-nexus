import os
from urllib.parse import urlparse

from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse

from .collaboration.board.router import router as board_router
from .collaboration.chat.send_direct_message.router import (
    router as send_direct_message_router,
)
from .oauth import entrypoint, jwt, manager
from .oauth.auth_router import router as auth_router
from .user.copilot.ask.router import router as ask_router
from .user.copilot.retrieve_curriculum.router import (
    router as retrieve_curriculum_router,
)
from .user.opportunities.apply.router import router as apply_router
from .user.opportunities.browse_opportunities.router import (
    router as opportunities_router,
)
from .user.opportunities.create_opportunity.router import (
    router as create_opportunity_router,
)
from .user.opportunities.match_scoring.router import (
    router as match_scoring_router,
)
from .user.opportunities.publish_opportunity.router import (
    router as publish_opportunity_router,
)
from .user.opportunities.review_applications.router import (
    router as review_applications_router,
)
from .user.opportunities.update_opportunity.router import (
    router as update_opportunity_router,
)
from .user.opportunities.view_opportunity.router import (
    router as view_opportunity_router,
)
from .user.opportunities.withdraw_application.router import (
    router as withdraw_application_router,
)
from .user.pitches.router import router as pitches_router
from .user.profile.router import router as profile_router
from .user.projects.refine_project.router import (
    router as refine_project_router,
)

router = APIRouter()


DEFAULT_LOCAL_FRONTEND = "https://localhost:8443"


def _safe_local_origin(raw_url: str | None) -> str | None:
    if not raw_url:
        return None
    cleaned = raw_url.strip().strip('"').strip("'")
    parsed = urlparse(cleaned)
    if parsed.scheme in {"http", "https"} and parsed.hostname in {"localhost", "127.0.0.1"}:
        return f"{parsed.scheme}://{parsed.netloc}"
    return None


def _resolve_frontend_origin(request: Request) -> str | None:
    referer_or_origin = _safe_local_origin(request.headers.get("referer")) or _safe_local_origin(
        request.headers.get("origin")
    )
    if referer_or_origin:
        return referer_or_origin
    fwd_proto = request.headers.get("x-forwarded-proto")
    fwd_host = request.headers.get("x-forwarded-host")
    if fwd_proto and fwd_host:
        return _safe_local_origin(f"{fwd_proto}://{fwd_host}")
    return None


@router.get("/", include_in_schema=False)
async def root_redirect(request: Request) -> RedirectResponse:
    configured_frontend = os.getenv("FRONTEND_URL")
    if configured_frontend:
        return RedirectResponse(url=configured_frontend, status_code=307)
    origin = _resolve_frontend_origin(request) or DEFAULT_LOCAL_FRONTEND
    return RedirectResponse(url=f"{origin}/discover", status_code=307)


@router.get("/auth/login", tags=["auth"])
async def auth_login(request: Request) -> RedirectResponse:
    response = await entrypoint.redirect_to_forttytwo()
    frontend_origin = _resolve_frontend_origin(request)
    if frontend_origin:
        response.set_cookie(
            key="oauth_frontend_origin",
            value=frontend_origin,
            httponly=True,
            samesite="lax",
            max_age=300,
            path="/",
        )
    return response


@router.get("/api/v1/auth/oauth/42/callback", tags=["auth"])
async def auth_callback(request: Request, code: str, state: str) -> RedirectResponse:
    state_cookie = request.cookies.get("state")
    code_verifier_cookie = request.cookies.get("code_verifier")

    if state_cookie != state:
        raise HTTPException(
            status_code=400,
            detail="Invalid state parameter",
        )

    if not code_verifier_cookie:
        raise HTTPException(
            status_code=400,
            detail="Missing code verifier",
        )

    token = await manager.get_access_token(code, code_verifier_cookie)
    intra_user = await manager.get_user(token["access_token"])
    nexus_user = await manager.manage_user(intra_user)

    jwt_token = jwt.create_access_token(nexus_user.id, role=nexus_user.role)

    configured_frontend = os.getenv("FRONTEND_URL")
    if configured_frontend:
        redirect_target = configured_frontend
    else:
        origin_cookie = _safe_local_origin(request.cookies.get("oauth_frontend_origin"))
        base_origin = origin_cookie or DEFAULT_LOCAL_FRONTEND
        redirect_target = f"{base_origin}/discover"

    response = RedirectResponse(url=redirect_target, status_code=303)
    response.set_cookie(
        key="access_token",
        value=jwt_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=jwt.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.delete_cookie("state", path="/")
    response.delete_cookie("code_verifier", path="/")
    response.delete_cookie("oauth_frontend_origin", path="/")
    return response


@router.get("/health/live", tags=["health"])
async def health_live() -> dict[str, str]:
    return {"status": "ok", "service": "api"}


@router.get("/health/ready", tags=["health"])
async def health_ready() -> dict[str, object]:
    return {"status": "ready", "dependencies": {"database": "unknown"}}


def register_routes(app: FastAPI) -> None:
    app.include_router(router)
    app.include_router(auth_router)
    app.include_router(profile_router)
    app.include_router(pitches_router)
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
    app.include_router(board_router)
    app.include_router(send_direct_message_router, tags=["Chat"])
