from datetime import timedelta
from pathlib import Path
import uuid

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth.user import Users

from app.collaboration.board.router import router as board_router
from app.user.opportunities.apply.router import router as apply_router
from app.user.opportunities.browse_opportunities.router import (
    router as opportunities_router,
)
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
from app.teams.router import router as teams_router
from app.user.friends import friends_router
from app.user.profile import profile_router
from app.oauth.auth_router import router as auth_api_router
from app.user.projects.archive_project.router import router as archive_project_router
from app.user.projects.create_project.router import router as create_project_router
from app.user.projects.edit_project.router import router as edit_project_router
from app.user.projects.my_projects.router import router as my_projects_router
from app.user.projects.publish_project.router import router as publish_project_router
from app.user.projects.recommended_projects.router import (
    router as recommended_projects_router,
)
from app.user.quick_actions.router import router as quick_actions_router

from .collaboration.chat.send_direct_message.router import (
    router as send_direct_message_router,
)
from .oauth import entrypoint, jwt, manager
from .user.copilot.ask.router import router as ask_router
from .user.copilot.retrieve_curriculum.router import (
    router as retrieve_curriculum_router,
)
from .user.pitches.router import router as pitches_router

router = APIRouter()
HOME_PAGE = Path(__file__).parent / "index.html"


@router.get("/auth/login", tags=["auth"])
async def auth_login() -> RedirectResponse:
    return await entrypoint.redirect_to_forttytwo()


async def _get_or_create_dev_user(
    login: str,
    fullname: str | None,
    campus: str | None,
    db: AsyncSession,
) -> Users:
    default_names = {
        "anas": ("Anas Ben", "1337 Khouribga", "42 / 1337 Fullstack developer & transcendence explorer"),
        "yassine": ("Yassine Daoudi", "1337 Benguerir", "Real-time communication & Socket.IO architect"),
        "ayoub": ("Ayoub Amine", "1337 Tetouan", "DevOps & Cloud architecture enthusiast"),
        "soufiane": ("Soufiane B.", "1337 Benguerir", "Cybersecurity & microservices ninja"),
    }

    resolved_fullname = fullname or default_names.get(login, (login.capitalize(), "1337 Coding School", "Student"))[0]
    resolved_campus = campus or default_names.get(login, (login.capitalize(), "1337 Coding School", "Student"))[1]
    resolved_bio = default_names.get(login, (login.capitalize(), "1337 Coding School", "Student at 1337"))[2]

    stmt = select(Users).where(Users.login == login)
    user = await db.scalar(stmt)
    if not user:
        user = Users(
            id=uuid.uuid4(),
            email=f"{login}@student.1337.ma",
            login=login,
            fullname=resolved_fullname,
            campus=resolved_campus,
            bio=resolved_bio,
            role="student",
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user


@router.get("/api/v1/auth/dev-login", tags=["auth"])
@router.get("/auth/dev-login", tags=["auth"])
async def dev_login(
    login: str = "anas",
    fullname: str | None = None,
    campus: str | None = None,
    redirect: str = "/messages",
    db: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    """Convenience development login to quickly test multi-user features in browser."""
    user = await _get_or_create_dev_user(login, fullname, campus, db)

    token = jwt.create_access_token(user_id=str(user.id), expires_delta=timedelta(days=7))
    separator = "&" if "?" in redirect else "?"
    redirect_with_token = f"{redirect}{separator}dev_token={token}&login={user.login}"
    response = RedirectResponse(url=redirect_with_token, status_code=303)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=False,
        secure=False,
        samesite="lax",
        max_age=7 * 24 * 3600,
        path="/",
    )
    return response


@router.get("/api/v1/auth/dev-token", tags=["auth"])
@router.get("/auth/dev-token", tags=["auth"])
async def dev_token(
    login: str = "anas",
    fullname: str | None = None,
    campus: str | None = None,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    """Return access token JSON for tab-specific authentication."""
    user = await _get_or_create_dev_user(login, fullname, campus, db)
    token = jwt.create_access_token(user_id=str(user.id), expires_delta=timedelta(days=7))
    return {
        "status": "ok",
        "token": token,
        "user": {
            "id": str(user.id),
            "login": user.login,
            "fullname": user.fullname,
            "campus": user.campus,
        },
    }


@router.get("/api/v1/auth/logout", tags=["auth"])
@router.get("/auth/logout", tags=["auth"])
async def logout(redirect: str = "/messages") -> RedirectResponse:
    response = RedirectResponse(url=redirect, status_code=303)
    response.delete_cookie("access_token", path="/")
    return response


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
    return {"status": "ok", "service": "api"}


@router.get("/health/ready", tags=["health"])
async def health_ready() -> dict[str, object]:
    return {"status": "ready", "dependencies": {"database": "unknown"}}


def register_routes(app: FastAPI) -> None:
    app.include_router(router)
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
    app.include_router(create_project_router)
    app.include_router(my_projects_router)
    app.include_router(recommended_projects_router)
    app.include_router(edit_project_router)
    app.include_router(publish_project_router)

    for api_router in (
        opportunities_router,
        create_opportunity_router,
        update_opportunity_router,
        publish_opportunity_router,
        match_scoring_router,
        review_applications_router,
        view_opportunity_router,
        apply_router,
        withdraw_application_router,
        create_project_router,
        my_projects_router,
        recommended_projects_router,
        edit_project_router,
        publish_project_router,
    ):
        app.include_router(api_router, prefix="/api")
    app.include_router(archive_project_router)
    app.include_router(quick_actions_router)
    app.include_router(teams_router)
    app.include_router(board_router)
    app.include_router(friends_router)
    app.include_router(profile_router)
    app.include_router(auth_api_router)
    app.include_router(send_direct_message_router, tags=["Chat"])
