#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/deploy/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/deploy/.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/1337-nexus}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
MEDIA_BACKUP_IMAGE="${MEDIA_BACKUP_IMAGE:-busybox:1.36.1}"

TIMESTAMP="$(date -u '+%Y%m%dT%H%M%SZ')"
WORK_DIR="$BACKUP_DIR/.tmp-$TIMESTAMP"

cleanup() {
    rm -rf -- "$WORK_DIR"
}
trap cleanup EXIT

fail() {
    echo "ERROR: $*" >&2
    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

echo "=== 1337 Nexus backup ==="

require_command docker
docker compose version >/dev/null 2>&1 || fail "Docker Compose is not available."

[[ -f "$COMPOSE_FILE" ]] || fail "Compose file not found: $COMPOSE_FILE"
[[ -f "$ENV_FILE" ]] || fail "Environment file not found: $ENV_FILE"

mkdir -p -- "$BACKUP_DIR"
chmod 700 -- "$BACKUP_DIR"
mkdir -p -- "$WORK_DIR"
chmod 700 -- "$WORK_DIR"

PG_CONTAINER="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q postgres)"
[[ -n "$PG_CONTAINER" ]] || fail "PostgreSQL container is not running. Start the stack first."

CONTAINER_ENV="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$PG_CONTAINER")"

POSTGRES_DB_VALUE="$(printf '%s\n' "$CONTAINER_ENV" | awk -F= '$1=="POSTGRES_DB"{sub(/^[^=]*=/,""); print; exit}')"
POSTGRES_USER_VALUE="$(printf '%s\n' "$CONTAINER_ENV" | awk -F= '$1=="POSTGRES_USER"{sub(/^[^=]*=/,""); print; exit}')"

[[ -n "$POSTGRES_DB_VALUE" ]] || fail "POSTGRES_DB is missing from the PostgreSQL container."
[[ -n "$POSTGRES_USER_VALUE" ]] || fail "POSTGRES_USER is missing from the PostgreSQL container."

docker compose \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    exec -T postgres \
    pg_isready -U "$POSTGRES_USER_VALUE" -d "$POSTGRES_DB_VALUE" >/dev/null 2>&1 \
    || fail "PostgreSQL is not ready."


BACKEND_CONTAINER="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q backend)"
MEDIA_VOLUME=""

if [[ -n "$BACKEND_CONTAINER" ]]; then
    MEDIA_VOLUME="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/media"}}{{.Name}}{{end}}{{end}}' "$BACKEND_CONTAINER")"
fi

if [[ -z "$MEDIA_VOLUME" ]]; then
    MEDIA_VOLUME="$(docker volume ls \
        --filter 'label=com.docker.compose.project=deploy' \
        --filter 'label=com.docker.compose.volume=media_data' \
        --format '{{.Name}}' | head -n 1)"
fi

[[ -n "$MEDIA_VOLUME" ]] || fail "The media_data volume does not exist yet. Start the backend/nginx service first if media backup is required."

DB_BACKUP="$WORK_DIR/nexus-$TIMESTAMP.dump"
MEDIA_BACKUP="$WORK_DIR/nexus-media-$TIMESTAMP.tar.gz"

if [[ ! "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
    fail "RETENTION_DAYS must be a non-negative integer."
fi

echo "Database: $POSTGRES_DB_VALUE"
echo "Media volume: $MEDIA_VOLUME"
echo "Backup directory: $BACKUP_DIR"
echo

echo "1/4 Creating PostgreSQL logical backup..."

docker compose \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    exec -T postgres \
    sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
    > "$DB_BACKUP"

[[ -s "$DB_BACKUP" ]] || fail "PostgreSQL dump was empty."

docker cp \
  "$DB_BACKUP" \
  "$PG_CONTAINER:/tmp/nexus-$TIMESTAMP.dump"

docker compose \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    exec -T postgres \
    pg_restore --list /tmp/nexus-$TIMESTAMP.dump \
    >/dev/null \
    || fail "PostgreSQL dump validation failed."

docker compose \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    exec -T postgres \
    rm -f /tmp/nexus-$TIMESTAMP.dump

echo "   PostgreSQL backup created and validated."

echo "2/4 Backing up media volume..."

docker run --rm \
    -v "${MEDIA_VOLUME}:/media:ro" \
    -v "${WORK_DIR}:/backup" \
    "$MEDIA_BACKUP_IMAGE" \
    tar -czf "/backup/$(basename "$MEDIA_BACKUP")" -C /media .

[[ -f "$MEDIA_BACKUP" ]] || fail "Media backup was not created."

echo "   Media backup created."

echo "3/4 Writing checksums..."

(
    cd "$WORK_DIR"
    sha256sum "$(basename "$DB_BACKUP")" > SHA256SUMS
)

chmod 600 -- "$DB_BACKUP" "$WORK_DIR/SHA256SUMS"
echo "   Checksums written."

echo "4/4 Publishing backup set..."

FINAL_DIR="$BACKUP_DIR/$TIMESTAMP"
mkdir -- "$FINAL_DIR"
chmod 700 -- "$FINAL_DIR"

mv -- "$DB_BACKUP" "$WORK_DIR/SHA256SUMS" "$FINAL_DIR/"

find "$BACKUP_DIR" \
    -mindepth 1 \
    -maxdepth 1 \
    -type d \
    -name '20????????T????????Z' \
    -mtime "+$RETENTION_DAYS" \
    -exec rm -rf -- {} +

echo
echo "Backup completed successfully."
echo "Location: $FINAL_DIR"
echo
ls -lh -- "$FINAL_DIR"