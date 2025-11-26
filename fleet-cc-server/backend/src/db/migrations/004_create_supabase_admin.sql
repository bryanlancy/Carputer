-- Create Supabase Admin Role for Studio Compatibility
-- This migration creates the supabase_admin role that Supabase Studio expects

-- Create supabase_admin role if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
        CREATE ROLE supabase_admin WITH LOGIN PASSWORD 'postgres' SUPERUSER;
        RAISE NOTICE 'Created supabase_admin role';
    ELSE
        RAISE NOTICE 'supabase_admin role already exists';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE fleet_cc TO supabase_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO supabase_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO supabase_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO supabase_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO supabase_admin;

