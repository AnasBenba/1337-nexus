#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${MIGRATION_DATABASE_URL:?MIGRATION_DATABASE_URL must be set}"
: "${TRUSTED_PROXY_SUBNET:?TRUSTED_PROXY_SUBNET must be set}"

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

unset MIGRATION_DATABASE_URL

echo "Starting FastAPI..."

exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 1 \
    --proxy-headers \
    --forwarded-allow-ips "$TRUSTED_PROXY_SUBNET" \
    --no-access-log \
    ${UVICORN_RELOAD:+--reload}