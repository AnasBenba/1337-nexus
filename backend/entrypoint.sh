#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."

python - "$MIGRATION_DATABASE_URL" <<'PY'
import socket
import sys
import time
from urllib.parse import urlparse

url = urlparse(sys.argv[1])
host = url.hostname or "postgres"
port = url.port or 5432

deadline = time.monotonic() + 60

while time.monotonic() < deadline:
    try:
        with socket.create_connection((host, port), timeout=2):
            break
    except OSError:
        time.sleep(1)
else:
    raise SystemExit("PostgreSQL did not become reachable within 60 seconds")
PY

echo "PostgreSQL is reachable. Running migrations..."

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

echo "Database migrations completed. Initializing SuperAdmin..."

if [ -z "${SUPERADMIN_EMAIL:-}" ] || [ -z "${SUPERADMIN_PASSWORD:-}" ]; then
    echo "SuperAdmin initialization failed: SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set." >&2
    exit 1
fi

if ! python -m app.cli.create_superadmin; then
    echo "SuperAdmin initialization failed; refusing to start FastAPI." >&2
    exit 1
fi

echo "Starting FastAPI..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload
