#!/bin/sh
set -e

echo "Running database migrations..."
migration_attempt=1
max_migration_attempts=30
until alembic upgrade head; do
    if [ "$migration_attempt" -ge "$max_migration_attempts" ]; then
        echo "Database migrations failed after ${max_migration_attempts} attempts." >&2
        exit 1
    fi

    echo "Database is not reachable yet; retrying migration in 2 seconds (attempt ${migration_attempt}/${max_migration_attempts})..."
    migration_attempt=$((migration_attempt + 1))
    sleep 2
done

echo "Starting FastAPI..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload