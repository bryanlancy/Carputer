#!/bin/sh
# PostgreSQL initialization script to create/update supabase_admin user
# This ensures supabase_admin password matches POSTGRES_PASSWORD
# NOTE: This script only runs on FIRST initialization (when database is empty)
# For existing databases, run the password update manually or via migration

set -e

# Wait for PostgreSQL to be ready
until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" 2>/dev/null; do
  sleep 1
done

# Create or update supabase_admin role with password matching POSTGRES_PASSWORD
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create supabase_admin role if it doesn't exist, or update password
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
            CREATE ROLE supabase_admin WITH LOGIN PASSWORD '$POSTGRES_PASSWORD' SUPERUSER;
            RAISE NOTICE 'Created supabase_admin role with password matching POSTGRES_PASSWORD';
        ELSE
            -- Update password to match POSTGRES_PASSWORD
            ALTER ROLE supabase_admin WITH PASSWORD '$POSTGRES_PASSWORD';
            RAISE NOTICE 'Updated supabase_admin password to match POSTGRES_PASSWORD';
        END IF;
    END
    \$\$;

    -- Grant necessary permissions
    GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO supabase_admin;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO supabase_admin;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO supabase_admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO supabase_admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO supabase_admin;
EOSQL

echo "Supabase admin user initialized/updated with password matching POSTGRES_PASSWORD"

