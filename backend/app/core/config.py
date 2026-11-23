from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: SecretStr
    migration_database_url: SecretStr

    # Background task worker (ai_jobs)
    job_worker_concurrency: int = 5
    job_worker_poll_interval: float = 1.0
    job_worker_lease_seconds: float = 30.0
    job_worker_heartbeat_seconds: float = 10.0
    job_worker_shutdown_timeout: float = 15.0

    model_config = SettingsConfigDict(
        case_sensitive=False,
        extra="ignore",
        env_file=".env",
        env_file_encoding="utf-8",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
