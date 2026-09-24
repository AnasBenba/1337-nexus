from fastapi import FastAPI

from .api import register_routes


def create_app() -> FastAPI:
    app = FastAPI(
        title="1337 Nexus API",
        version="0.1.0",
        description="1337 Nexus backend API",
    )

    register_routes(app)

    return app


app = create_app()