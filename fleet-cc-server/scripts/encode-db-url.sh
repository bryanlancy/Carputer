#!/bin/bash
# Helper script to URL-encode password for database URL construction
# Usage: encode-db-url.sh <user> <password> <host> <port> <database> [schema]

USER=$1
PASSWORD=$2
HOST=$3
PORT=${4:-5432}
DATABASE=$5
SCHEMA=${6:-auth}

# URL-encode the password using Python (most reliable cross-platform method)
ENCODED_PASSWORD=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$PASSWORD', safe=''))")

# Construct the database URL
if [ -n "$SCHEMA" ]; then
    echo "postgres://${USER}:${ENCODED_PASSWORD}@${HOST}:${PORT}/${DATABASE}?search_path=${SCHEMA}"
else
    echo "postgres://${USER}:${ENCODED_PASSWORD}@${HOST}:${PORT}/${DATABASE}"
fi

