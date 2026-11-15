import os
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import select

from app.collaboration.board.router import router as board_router
from app.user.opportunities.apply.router import router as apply_router
from app.user.opportunities.browse_opportunities.router import (
    router as opportunities_router,
)
from .user.notifications.router import router as notifications_router
from app.user.opportunities.create_opportunity.router import (
    router as create_opportunity_router,
)
from app.user.opportunities.match_scoring.router import (
    router as match_scoring_router,
)
from app.user.opportunities.publish_opportunity.router import (
    router as publish_opportunity_router,
)
from app.user.opportunities.review_applications.router import (
    router as review_applications_router,
)
from app.user.opportunities.update_opportunity.router import (
    router as update_opportunity_router,
)
from app.user.opportunities.view_opportunity.router import (
    router as view_opportunity_router,
)
from app.user.opportunities.withdraw_application.router import (
    router as withdraw_application_router,
)
from app.user.projects.refine_project.router import (
    router as refine_project_router,
)

from .collaboration.chat.send_direct_message.router import (
    router as send_direct_message_router,
)
from .core import db
from .oauth import entrypoint, jwt, manager
from .oauth.user import Users
from .user.copilot.ask.router import router as ask_router
from .user.copilot.retrieve_curriculum.router import (
    router as retrieve_curriculum_router,
)
from .user.pitches.router import router as pitches_router
from .teams.router import router as teams_router

router = APIRouter()
HOME_PAGE = Path(__file__).parent / "index.html"


def _build_auth_redirect(jwt_token: str) -> RedirectResponse:
    """Create a frontend redirect response carrying the signed JWT cookie."""
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173/home")
    response = RedirectResponse(url=frontend_url, status_code=303)
    response.set_cookie(
        key="access_token",
        value=jwt_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=jwt.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    return response


async def _issue_dev_login_redirect() -> RedirectResponse:
    """Resolve or create the local dev user and redirect with a signed JWT cookie."""
    async with db.SessionLocal() as session:
        result = await session.execute(select(Users).where(Users.login == "sel-bou"))
        dev_user = result.scalar_one_or_none()
        if dev_user is None:
            result = await session.execute(select(Users).limit(1))
            dev_user = result.scalar_one_or_none()
        if dev_user is None:
            dev_user = Users(
                login="sel-bou",
                fullname="Soufiane El B.",
                role="user",
                intra_id=4242,
            )
            session.add(dev_user)
            await session.commit()
            await session.refresh(dev_user)
        elif dev_user.intra_id is None:
            dev_user.intra_id = 4242
            await session.commit()
            await session.refresh(dev_user)

    jwt_token = jwt.create_access_token(dev_user.intra_id)
    return _build_auth_redirect(jwt_token)


@router.get("/auth/login", tags=["auth"])
async def auth_login(dev: bool = False) -> RedirectResponse:
    if dev:
        return await _issue_dev_login_redirect()
    return await entrypoint.redirect_to_forttytwo()


@router.get("/auth/dev-login", tags=["auth"])
async def auth_dev_login() -> RedirectResponse:
    return await _issue_dev_login_redirect()


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

    jwt_token = jwt.create_access_token(nexus_user.intra_id)

    response = _build_auth_redirect(jwt_token)
    response.delete_cookie("state", path="/")
    response.delete_cookie("code_verifier", path="/")
    return response


@router.get("/health/live", tags=["health"])
async def health_live() -> dict[str, str]:
    return {"status": "ok", "service": "api"}


@router.get("/health/ready", tags=["health"])
async def health_ready() -> dict[str, object]:
    return {"status": "ready", "dependencies": {"database": "unknown"}}


def register_routes(app: FastAPI) -> None:
    app.include_router(router)
    app.include_router(pitches_router)
    app.include_router(notifications_router)
    app.include_router(teams_router)
    app.include_router(opportunities_router)
    app.include_router(create_opportunity_router)
    app.include_router(update_opportunity_router)
    app.include_router(publish_opportunity_router)
    app.include_router(match_scoring_router)
    app.include_router(review_applications_router)
    app.include_router(view_opportunity_router)
    app.include_router(retrieve_curriculum_router)
    app.include_router(ask_router)
    # app.include_router(apply_router)
    #     app.include_router(withdraw_application_router)
    app.include_router(refine_project_router)
    app.include_router(board_router)
    app.include_router(send_direct_message_router, tags=["Chat"])
