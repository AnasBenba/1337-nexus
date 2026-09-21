#!/bin/sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"

ENV_FILE="${ROOT_DIR}/deploy/.env"
ENV_EXAMPLE="${ROOT_DIR}/deploy/.env.example"
COMPOSE_FILE="${ROOT_DIR}/deploy/docker-compose.yml"


get_env_value() {
    key="$1"

    awk -v key="$key" '
        $0 ~ "^" key "=" {
            sub("^" key "=", "")
            print
            exit
        }
    ' "$ENV_FILE"
}

set_env_value() {
    key="$1"
    value="$2"
    tmp_file="${ENV_FILE}.tmp"

    KEY="$key" VALUE="$value" awk '
        BEGIN {
            key = ENVIRON["KEY"]
            value = ENVIRON["VALUE"]
            replaced = 0
        }

        $0 ~ "^" key "=" {
            print key "=" value
            replaced = 1
            next
        }

        {
            print
        }

        END {
            if (!replaced) {
                print key "=" value
            }
        }
    ' "$ENV_FILE" > "$tmp_file"

    mv "$tmp_file" "$ENV_FILE"
}


if [ ! -f "$ENV_FILE" ]; then
    if [ ! -f "$ENV_EXAMPLE" ]; then
        echo "Missing $ENV_EXAMPLE" >&2
        exit 1
    fi

    cp "$ENV_EXAMPLE" "$ENV_FILE"
    echo "Created $ENV_FILE from $ENV_EXAMPLE"
fi


if ! command -v openssl >/dev/null 2>&1; then
    echo "openssl is required but was not found." >&2
    exit 1
fi


TLS_CERT_VALUE="$(get_env_value "TLS_CERT_PEM")"
TLS_KEY_VALUE="$(get_env_value "TLS_KEY_PEM")"


if [ -z "$TLS_CERT_VALUE" ] || [ "$TLS_CERT_VALUE" = "CHANGE_ME" ] ||
   [ -z "$TLS_KEY_VALUE" ] || [ "$TLS_KEY_VALUE" = "CHANGE_ME" ]; then

    echo "Generating local self-signed TLS certificate..."

    TMP_DIR="$(mktemp -d)"
    trap 'rm -rf "$TMP_DIR"' EXIT

    TLS_CERT_FILE="$TMP_DIR/tls.crt"
    TLS_KEY_FILE="$TMP_DIR/tls.key"

    openssl req \
        -x509 \
        -nodes \
        -newkey rsa:2048 \
        -days 365 \
        -keyout "$TLS_KEY_FILE" \
        -out "$TLS_CERT_FILE" \
        -subj "/CN=localhost" \
        -addext "subjectAltName=DNS:localhost" \
        >/dev/null 2>&1

    TLS_CERT_VALUE="$(awk '{printf "%s\\n", $0}' "$TLS_CERT_FILE")"
    TLS_KEY_VALUE="$(awk '{printf "%s\\n", $0}' "$TLS_KEY_FILE")"

    set_env_value "TLS_CERT_PEM" "$TLS_CERT_VALUE"
    set_env_value "TLS_KEY_PEM" "$TLS_KEY_VALUE"

    echo "TLS values written to $ENV_FILE"

else
    echo "TLS values already exist; keeping them."
fi


echo "Validating Docker Compose configuration..."

sudo docker compose \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    config >/dev/null

echo "Compose configuration is valid."


echo "Starting the stack..."

sudo docker compose \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    up -d