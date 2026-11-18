#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Ensuring SuperAdmin exists..."
python -m app.cli.create_superadmin

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 ${UVICORN_RELOAD:+--reload}