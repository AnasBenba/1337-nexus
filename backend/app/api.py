import os
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session

# from app.user.opportunities.apply.router import router as apply_router
# from app.user.opportunities.browse_opportunities.router import (
#     router as opportunities_router,
# )
# from app.user.opportunities.create_opportunity.router import (
#     router as create_opportunity_router,
# )
# from app.user.opportunities.match_scoring.router import (
#     router as match_scoring_router,
# )
# from app.user.opportunities.publish_opportunity.router import (
#     router as publish_opportunity_router,
# )
# from app.user.opportunities.review_applications.router import (
#     router as review_applications_router,
# )
# from app.user.opportunities.update_opportunity.router import (
#     router as update_opportunity_router,
# )
# from app.user.opportunities.view_opportunity.router import (
#     router as view_opportunity_router,
# )
# from app.user.opportunities.withdraw_application.router import (
#     router as withdraw_application_router,
# )
from app.user.pitches.router import router as pitches_router
from app.user.projects.refine_project.router import (
    router as refine_project_router,
)

from .oauth import entrypoint, jwt, manager, refresh_tokens
from .admin.users.router import router as admin_users_router
from .user.friends.router import router as friends_router
from .user.profile.router import router as profile_router
from .user.copilot.ask.router import router as ask_router
from .user.copilot.retrieve_curriculum.router import (
    router as retrieve_curriculum_router,
)

router = APIRouter()
HOME_PAGE = Path(__file__).parent / "index.html"
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://localhost:8443/")
DbSession = Annotated[AsyncSession, Depends(get_db_session)]


@router.post("/api/v1/auth/refresh", tags=["auth"], status_code=204)
async def auth_refresh(request: Request, session: DbSession) -> Response:
    """Swap the refresh cookie for a new access token (and a new refresh token)."""
    token = request.cookies.get(refresh_tokens.REFRESH_COOKIE)
    response = Response(status_code=204)
    try:
        if not token:
            raise refresh_tokens.RefreshError("Missing refresh token")
        user, new_refresh = await refresh_tokens.rotate(session, token)
    except refresh_tokens.RefreshError as exc:
        response = JSONResponse({"detail": str(exc)}, status_code=401)
        refresh_tokens.clear_auth_cookies(response)
        return response
    refresh_tokens.set_auth_cookies(response, user, new_refresh)
    return response


@router.post("/api/v1/auth/logout", tags=["auth"], status_code=204)
async def auth_logout(request: Request, session: DbSession) -> Response:
    # The cookies are HttpOnly, so only the server can remove them.
    token = request.cookies.get(refresh_tokens.REFRESH_COOKIE)
    if token:
        await refresh_tokens.revoke(session, token)  # can't be used to get new access tokens anymore
    response = Response(status_code=204)
    refresh_tokens.clear_auth_cookies(response)
    return response


@router.get("/auth/login", tags=["auth"])
async def auth_login() -> RedirectResponse:
    return await entrypoint.redirect_to_forttytwo()


@router.get("/home", tags=["pages"])
async def home(request: Request) -> FileResponse:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
        )

    jwt.verify_access_token(token)
    return FileResponse(HOME_PAGE, media_type="text/html")


@router.get("/api/v1/auth/oauth/42/callback", tags=["auth"])
async def auth_callback(request: Request, code: str, state: str, session: DbSession) -> RedirectResponse:
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

    refresh_token = await refresh_tokens.issue(session, nexus_user.id)
    await session.commit()

    response = RedirectResponse(url=FRONTEND_URL, status_code=303)
    refresh_tokens.set_auth_cookies(response, nexus_user, refresh_token)
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
    # app.include_router(opportunities_router)
    # app.include_router(create_opportunity_router)
    # app.include_router(update_opportunity_router)
    # app.include_router(publish_opportunity_router)
    # app.include_router(match_scoring_router)
    # app.include_router(review_applications_router)
    # app.include_router(view_opportunity_router)
    app.include_router(retrieve_curriculum_router)
    app.include_router(ask_router)
    # app.include_router(apply_router)
    # app.include_router(withdraw_application_router)
    app.include_router(refine_project_router)
    app.include_router(pitches_router)
    app.include_router(profile_router)
    app.include_router(friends_router)
    app.include_router(admin_users_router)
