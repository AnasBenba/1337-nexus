#!/bin/sh

set -eu

TLS_DIR="/tmp/nginx/tls"
TLS_CERT_PATH="${TLS_DIR}/tls.crt"
TLS_KEY_PATH="${TLS_DIR}/tls.key"

: "${TLS_CERT_PEM:?TLS_CERT_PEM must be set}"
: "${TLS_KEY_PEM:?TLS_KEY_PEM must be set}"

mkdir -p "$TLS_DIR"

umask 077

printf '%b\n' "$TLS_CERT_PEM" > "$TLS_CERT_PATH"
printf '%b\n' "$TLS_KEY_PEM" > "$TLS_KEY_PATH"

chmod 600 "$TLS_CERT_PATH" "$TLS_KEY_PATH"

nginx -t

exec nginx -g 'daemon off;'