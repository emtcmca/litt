#!/bin/sh
# Replace BACKEND_URL_PLACEHOLDER with the actual backend URL from env var.
# BACKEND_URL must be set as a Cloud Run environment variable.
set -e

: "${BACKEND_URL:?BACKEND_URL environment variable is required}"

sed "s|BACKEND_URL_PLACEHOLDER|${BACKEND_URL}|g" \
    /etc/nginx/templates/default.conf.template \
    > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
