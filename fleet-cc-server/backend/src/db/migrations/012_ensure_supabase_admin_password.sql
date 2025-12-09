-- Ensure supabase_admin password matches the postgres user password
-- This migration creates a function that can be called to sync passwords
-- The actual password update should be done via environment variable at runtime

-- Create a function to update supabase_admin password
-- Note: This function will be called with the actual password from environment
CREATE OR REPLACE FUNCTION ensure_supabase_admin_password()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if supabase_admin exists
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
        -- Password will be updated via ALTER ROLE command at runtime
        -- This function is a placeholder - actual password comes from POSTGRES_PASSWORD env var
        RAISE NOTICE 'supabase_admin role exists';
    ELSE
        -- Create supabase_admin if it doesn't exist
        -- Password will be set via ALTER ROLE command at runtime
        CREATE ROLE supabase_admin WITH LOGIN SUPERUSER;
        RAISE NOTICE 'Created supabase_admin role';
    END IF;

    -- Grant permissions
    GRANT ALL PRIVILEGES ON DATABASE fleet_cc TO supabase_admin;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO supabase_admin;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO supabase_admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO supabase_admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO supabase_admin;
END;
$$;

-- Call the function to ensure supabase_admin exists
SELECT ensure_supabase_admin_password();

