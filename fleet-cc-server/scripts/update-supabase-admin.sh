#!/bin/sh
# Script to update supabase_admin password to match POSTGRES_PASSWORD
# This can be run manually or via a cron job to keep passwords in sync

set -e

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-fleet_cc}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "Error: POSTGRES_PASSWORD environment variable is not set"
    exit 1
fi

# Update supabase_admin password
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<-EOSQL
    DO \$\$
    BEGIN
        IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
            ALTER ROLE supabase_admin WITH PASSWORD '$POSTGRES_PASSWORD';
            RAISE NOTICE 'Updated supabase_admin password';
        ELSE
            CREATE ROLE supabase_admin WITH LOGIN PASSWORD '$POSTGRES_PASSWORD' SUPERUSER;
            GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO supabase_admin;
            RAISE NOTICE 'Created supabase_admin role';
        END IF;
    END
    \$\$;
EOSQL

echo "Supabase admin password updated successfully"

