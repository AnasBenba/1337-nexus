from fastapi import APIRouter, FastAPI

router = APIRouter()


@router.get("/auth/login", tags=["auth"])
async def auth_login() -> dict[str, str]:
    return {
        "message": "Authentication endpoint reached",
    }


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