from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import register_routes


def create_app() -> FastAPI:
    app = FastAPI(
        title="1337 Nexus API",
        version="0.1.0",
        description="1337 Nexus backend API",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_routes(app)

    return app


app = create_app()
