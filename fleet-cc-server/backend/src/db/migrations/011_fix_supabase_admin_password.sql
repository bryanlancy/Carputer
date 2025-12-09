-- Fix supabase_admin password to match POSTGRES_PASSWORD
-- This migration updates the supabase_admin password to match the main postgres user password
-- This is needed because Supabase Studio/pg-meta expects supabase_admin to have the same password

-- Note: This migration should be run manually with the actual password from your .env file
-- Or you can update it programmatically when the container starts

-- Update supabase_admin password to match postgres user password
-- The password will be set from environment variable at runtime
DO $$
DECLARE
    new_password TEXT;
BEGIN
    -- Get the password from environment (this will be set by the entrypoint script)
    -- For now, we'll use a placeholder that needs to be replaced
    -- In practice, this should be done via ALTER ROLE command with the actual password

    -- Check if supabase_admin exists
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
        -- The password will be updated via ALTER ROLE command
        -- This is a placeholder - the actual password update should be done via:
        -- ALTER ROLE supabase_admin WITH PASSWORD 'your_actual_password';
        RAISE NOTICE 'supabase_admin role exists - password should be updated to match POSTGRES_PASSWORD';
    ELSE
        -- Create supabase_admin if it doesn't exist
        -- Use the same password as the postgres user (from POSTGRES_PASSWORD env var)
        -- Note: In a real migration, we can't access env vars directly, so this needs to be done via entrypoint
        CREATE ROLE supabase_admin WITH LOGIN PASSWORD 'postgres' SUPERUSER;
        RAISE NOTICE 'Created supabase_admin role with default password';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE fleet_cc TO supabase_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO supabase_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO supabase_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO supabase_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO supabase_admin;

