#!/bin/sh
# Entrypoint script for GoTrue that URL-encodes the password in DATABASE_URL
# This handles special characters in PostgreSQL passwords

set -e

# Export individual DB params first (for reading)
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
export POSTGRES_DB="${POSTGRES_DB}"
export POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"

# URL-encode the password using sed (handle common special characters)
# Handle backslash escape sequences from .env file first
# Order matters: % must be encoded first, backslash removal before other encoding
PASSWORD_CLEAN=$(echo "$POSTGRES_PASSWORD" | sed 's/\\+/+/g; s/\\=/\=/g; s/\\$/\$/g')
ENCODED_PASSWORD=$(echo "$PASSWORD_CLEAN" | sed 's/%/%25/g; s/+/%2B/g; s/ /%20/g; s/#/%23/g; s/\$/%24/g; s/\&/%26/g; s/=/%3D/g; s/?/%3F/g; s/@/%40/g; s/\//%2F/g')

# Construct and export the DATABASE_URL with URL-encoded password
export GOTRUE_DB_DATABASE_URL="postgres://${POSTGRES_USER}:${ENCODED_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?search_path=auth"

# Execute the original GoTrue command
exec /usr/local/bin/gotrue "$@"
