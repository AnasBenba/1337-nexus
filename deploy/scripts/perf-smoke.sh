#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/deploy/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/deploy/.env}"

BASE_URL="${BASE_URL:-https://127.0.0.1:443}"
LIVE_PATH="${LIVE_PATH:-/health/live}"
READY_PATH="${READY_PATH:-/health/ready}"

REQUESTS="${REQUESTS:-20}"
REQUEST_TIMEOUT_SECONDS="${REQUEST_TIMEOUT_SECONDS:-10}"
MAX_AVG_LATENCY_SECONDS="${MAX_AVG_LATENCY_SECONDS:-1.000}"
MAX_REQUEST_LATENCY_SECONDS="${MAX_REQUEST_LATENCY_SECONDS:-3.000}"

NGINX_MAX_MEMORY_MB="${NGINX_MAX_MEMORY_MB:-32}"
BACKEND_MAX_MEMORY_MB="${BACKEND_MAX_MEMORY_MB:-400}"
POSTGRES_MAX_MEMORY_MB="${POSTGRES_MAX_MEMORY_MB:-512}"

CURL_TLS_OPTIONS=(--insecure)

fail() {
    echo "ERROR: $*" >&2
    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 \
        || fail "Required command not found: $1"
}

is_positive_integer() {
    [[ "$1" =~ ^[1-9][0-9]*$ ]]
}

is_non_negative_decimal() {
    [[ "$1" =~ ^[0-9]+([.][0-9]+)?$ ]]
}

echo "=== 1337 Nexus performance smoke test ==="
echo "Base URL: $BASE_URL"
echo "Requests: $REQUESTS"
echo

require_command curl
require_command docker

docker compose version >/dev/null 2>&1 \
    || fail "Docker Compose is not available."

[[ -f "$COMPOSE_FILE" ]] \
    || fail "Compose file not found: $COMPOSE_FILE"

[[ -f "$ENV_FILE" ]] \
    || fail "Environment file not found: $ENV_FILE"

is_positive_integer "$REQUESTS" \
    || fail "REQUESTS must be a positive integer."

is_positive_integer "$REQUEST_TIMEOUT_SECONDS" \
    || fail "REQUEST_TIMEOUT_SECONDS must be a positive integer."

is_non_negative_decimal "$MAX_AVG_LATENCY_SECONDS" \
    || fail "MAX_AVG_LATENCY_SECONDS must be a non-negative decimal."

is_non_negative_decimal "$MAX_REQUEST_LATENCY_SECONDS" \
    || fail "MAX_REQUEST_LATENCY_SECONDS must be a non-negative decimal."

for value in \
    "$NGINX_MAX_MEMORY_MB" \
    "$BACKEND_MAX_MEMORY_MB" \
    "$POSTGRES_MAX_MEMORY_MB"
do
    is_positive_integer "$value" \
        || fail "Memory limits must be positive integers in MB."
done

compose() {
    docker compose \
        --env-file "$ENV_FILE" \
        -f "$COMPOSE_FILE" \
        "$@"
}

echo "1/4 Checking required services..."

for service in nginx backend postgres; do
    container_id="$(compose ps -q "$service")"

    [[ -n "$container_id" ]] \
        || fail "$service container is not running."

    running="$(docker inspect --format '{{.State.Running}}' "$container_id")"

    [[ "$running" == "true" ]] \
        || fail "$service container is not running."
done

echo "   nginx:    running"
echo "   backend:  running"
echo "   postgres: running"

echo
echo "2/4 Checking health endpoints..."

check_endpoint() {
    local name="$1"
    local path="$2"
    local output
    local http_code
    local time_total

    output="$(
        curl \
            "${CURL_TLS_OPTIONS[@]}" \
            --silent \
            --show-error \
            --output /dev/null \
            --write-out '%{http_code} %{time_total}' \
            --max-time "$REQUEST_TIMEOUT_SECONDS" \
            "${BASE_URL}${path}"
    )"

    read -r http_code time_total <<< "$output"

    [[ "$http_code" =~ ^2[0-9][0-9]$ ]] \
        || fail "$name endpoint returned HTTP $http_code."

    echo "   $name: HTTP $http_code (${time_total}s)"
}

check_endpoint "liveness" "$LIVE_PATH"
check_endpoint "readiness" "$READY_PATH"

echo
echo "3/4 Sending bounded smoke requests..."

total_seconds="0"
max_seconds="0"
failures=0

for ((request=1; request<=REQUESTS; request++)); do
    output="$(
        curl \
            "${CURL_TLS_OPTIONS[@]}" \
            --silent \
            --show-error \
            --output /dev/null \
            --write-out '%{http_code} %{time_total}' \
            --max-time "$REQUEST_TIMEOUT_SECONDS" \
            "${BASE_URL}${LIVE_PATH}" \
            2>/dev/null
    )" || {
        failures=$((failures + 1))
        echo "   request $request/$REQUESTS: curl failed"
        continue
    }

    read -r http_code time_total <<< "$output"

    if [[ ! "$http_code" =~ ^2[0-9][0-9]$ ]]; then
        failures=$((failures + 1))
        echo "   request $request/$REQUESTS: HTTP $http_code"
        continue
    fi

    total_seconds="$(
        awk -v a="$total_seconds" -v b="$time_total" \
            'BEGIN { printf "%.6f", a + b }'
    )"

    if awk -v a="$time_total" -v b="$max_seconds" \
        'BEGIN { exit !(a > b) }'
    then
        max_seconds="$time_total"
    fi

    echo "   request $request/$REQUESTS: HTTP $http_code (${time_total}s)"
done

[[ "$failures" -eq 0 ]] \
    || fail "$failures of $REQUESTS smoke requests failed."

average_seconds="$(
    awk -v total="$total_seconds" -v count="$REQUESTS" \
        'BEGIN { printf "%.6f", total / count }'
)"

if awk -v actual="$average_seconds" -v limit="$MAX_AVG_LATENCY_SECONDS" \
    'BEGIN { exit !(actual > limit) }'
then
    fail "Average latency ${average_seconds}s exceeds limit ${MAX_AVG_LATENCY_SECONDS}s."
fi

if awk -v actual="$max_seconds" -v limit="$MAX_REQUEST_LATENCY_SECONDS" \
    'BEGIN { exit !(actual > limit) }'
then
    fail "Maximum request latency ${max_seconds}s exceeds limit ${MAX_REQUEST_LATENCY_SECONDS}s."
fi

echo "   all requests succeeded"
echo "   average latency: ${average_seconds}s"
echo "   maximum latency: ${max_seconds}s"

echo
echo "4/4 Checking current container memory usage..."

memory_usage_mb() {
    local container_id="$1"

    docker stats \
        --no-stream \
        --format '{{.MemUsage}}' \
        "$container_id" |
        awk -F' / ' '
            {
                value=$1
                if (value ~ /GiB$/) {
                    sub(/GiB$/, "", value)
                    printf "%.2f\n", value * 1024
                } else if (value ~ /GB$/) {
                    sub(/GB$/, "", value)
                    printf "%.2f\n", value * 1000
                } else if (value ~ /MiB$/) {
                    sub(/MiB$/, "", value)
                    printf "%.2f\n", value
                } else if (value ~ /MB$/) {
                    sub(/MB$/, "", value)
                    printf "%.2f\n", value
                } else if (value ~ /KiB$/) {
                    sub(/KiB$/, "", value)
                    printf "%.2f\n", value / 1024
                } else if (value ~ /KB$/) {
                    sub(/KB$/, "", value)
                    printf "%.2f\n", value / 1000
                } else if (value ~ /B$/) {
                    sub(/B$/, "", value)
                    printf "%.2f\n", value / 1024 / 1024
                } else {
                    exit 1
                }
            }
        '
}

check_memory() {
    local service="$1"
    local limit_mb="$2"
    local container_id
    local used_mb

    container_id="$(compose ps -q "$service")"
    used_mb="$(memory_usage_mb "$container_id")" \
        || fail "Could not read memory usage for $service."

    echo "   $service: ${used_mb} MB / ${limit_mb} MB"

    if awk -v used="$used_mb" -v limit="$limit_mb" \
        'BEGIN { exit !(used > limit) }'
    then
        fail "$service memory usage (${used_mb} MB) exceeds configured limit (${limit_mb} MB)."
    fi
}

check_memory "nginx" "$NGINX_MAX_MEMORY_MB"
check_memory "backend" "$BACKEND_MAX_MEMORY_MB"
check_memory "postgres" "$POSTGRES_MAX_MEMORY_MB"

echo
echo "Performance smoke test passed."
echo "Requests: $REQUESTS"
echo "Average latency: ${average_seconds}s"
echo "Maximum latency: ${max_seconds}s"
