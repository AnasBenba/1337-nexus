from fastapi import APIRouter, FastAPI

from app.user.opportunities.apply.router import router as apply_router
from app.user.opportunities.browse_opportunities.router import (
    router as opportunities_router,
)
from app.user.opportunities.view_opportunity.router import (
    router as view_opportunity_router,
)
from .oauth import entrypoint
from fastapi.responses import RedirectResponse


router = APIRouter()


@router.get("/auth/login", tags=["auth"])
async def auth_login() -> RedirectResponse: 
    return await entrypoint.redirect_to_forttytwo()

    
    


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
    app.include_router(view_opportunity_router)
    app.include_router(apply_router)
