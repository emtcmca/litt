#!/bin/sh
# Replace BACKEND_URL_PLACEHOLDER and BACKEND_HOST_PLACEHOLDER with values
# derived from the BACKEND_URL environment variable.
# BACKEND_URL must be set as a Cloud Run environment variable.
set -e

: "${BACKEND_URL:?BACKEND_URL environment variable is required}"

# Extract hostname from URL (strip https:// and any trailing path)
BACKEND_HOST=$(echo "${BACKEND_URL}" | sed 's|https://||' | sed 's|/.*||')

sed -e "s|BACKEND_URL_PLACEHOLDER|${BACKEND_URL}|g" \
    -e "s|BACKEND_HOST_PLACEHOLDER|${BACKEND_HOST}|g" \
    /etc/nginx/templates/default.conf.template \
    > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
