from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: SecretStr
    migration_database_url: SecretStr
    trusted_proxy_subnet: str

    model_config = SettingsConfigDict(
        case_sensitive=False,
        extra="ignore",
    )

    @staticmethod
    def _to_async_postgresql_url(url: str) -> str:
        if url.startswith("postgresql+asyncpg://"):
            return url

        if url.startswith("postgresql://"):
            return "postgresql+asyncpg://" + url[len("postgresql://") :]

        raise ValueError(
            "PostgreSQL URL must use either "
            "'postgresql://' or 'postgresql+asyncpg://'."
        )

    @property
    def async_database_url(self) -> str:
        return self._to_async_postgresql_url(
            self.database_url.get_secret_value()
        )

    @property
    def async_migration_database_url(self) -> str:
        return self._to_async_postgresql_url(
            self.migration_database_url.get_secret_value()
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
