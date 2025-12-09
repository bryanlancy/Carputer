#!/bin/sh
# Entrypoint script for postgres-meta that URL-encodes the password
# This handles special characters in PostgreSQL passwords

set -e

# Export individual DB params first (for reading)
export PG_META_DB_HOST="${PG_META_DB_HOST:-postgres}"
export PG_META_DB_PORT="${PG_META_DB_PORT:-5432}"
export PG_META_DB_NAME="${PG_META_DB_NAME}"
export PG_META_DB_USER="${PG_META_DB_USER}"
PASSWORD_RAW="${PG_META_DB_PASSWORD}"

# URL-encode the password - handle common special characters
# Handle backslash escape sequences from .env file first
# Order matters: % must be encoded first, backslash removal before other encoding
PASSWORD_CLEAN=$(echo "$PASSWORD_RAW" | sed 's/\\+/+/g; s/\\=/\=/g; s/\\$/\$/g')
ENCODED_PASSWORD=$(echo "$PASSWORD_CLEAN" | sed 's/%/%25/g; s/+/%2B/g; s/ /%20/g; s/#/%23/g; s/\$/%24/g; s/\&/%26/g; s/=/%3D/g; s/?/%3F/g; s/@/%40/g; s/\//%2F/g')

# Export the encoded password
export PG_META_DB_PASSWORD="${ENCODED_PASSWORD}"

# Set PG_META_DB_URL to use the configured user
# Note: postgres-meta may still try to use supabase_admin, but we set this for compatibility
export PG_META_DB_URL="postgresql://${PG_META_DB_USER}:${ENCODED_PASSWORD}@${PG_META_DB_HOST}:${PG_META_DB_PORT}/${PG_META_DB_NAME}"

# Call the original postgres-meta entrypoint with default command
# The postgres-meta image uses docker-entrypoint.sh which expects "node dist/server/server.js"
exec /usr/local/bin/docker-entrypoint.sh node dist/server/server.js "$@"

