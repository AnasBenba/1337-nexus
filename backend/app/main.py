from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

from app.jobs import job_worker_lifespan
from app.realtime.server import get_socket_app

from .api import register_routes


def create_app() -> FastAPI:
    app = FastAPI(
        title="1337 Nexus API",
        version="0.1.0",
        description="1337 Nexus backend API",
        lifespan=job_worker_lifespan,
    )

    register_routes(app)
    Instrumentator().instrument(app).expose(app)
    return app


fastapi_app = create_app()
app = get_socket_app(fastapi_app)
