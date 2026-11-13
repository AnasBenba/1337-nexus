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

(
    alembic upgrade head
)

# Create/promote the superadmin from SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD (.env). Skips if unset.
python -m app.cli.create_superadmin

# unset MIGRATION_DATABASE_URL
    echo "Database is not reachable yet; retrying migration in 2 seconds (attempt ${migration_attempt}/${max_migration_attempts})..."
    migration_attempt=$((migration_attempt + 1))
    sleep 2
done

echo "Starting FastAPI..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload