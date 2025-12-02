-- Create auth schema for Supabase GoTrue
-- This schema is required for Supabase Auth to function

CREATE SCHEMA IF NOT EXISTS auth;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO postgres;
GRANT ALL ON SCHEMA auth TO postgres;

-- The actual tables will be created by GoTrue on first startup
-- This migration just ensures the schema exists

