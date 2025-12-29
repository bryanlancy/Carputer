-- Enable Row Level Security (RLS) on tables that need it
-- This ensures that even if someone gains direct database access, they can only see/modify data they're authorized for

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own data
DROP POLICY IF EXISTS "Users can read own data" ON users;
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  USING (auth.uid()::text = supabase_user_id::text);

-- Policy: Users can update their own data
DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  USING (auth.uid()::text = supabase_user_id::text);

-- Note: User creation is handled by the backend service role, not through RLS
-- The backend service role has full access (bypasses RLS)

-- Enable RLS on user_roles table
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own roles
DROP POLICY IF EXISTS "Users can read own roles" ON user_roles;
CREATE POLICY "Users can read own roles"
  ON user_roles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = user_roles.user_id
      AND users.supabase_user_id::text = auth.uid()::text
    )
  );

-- Note: Role assignment is handled by admins via backend service role

-- Enable RLS on user_notifications table
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON user_notifications;
CREATE POLICY "Users can read own notifications"
  ON user_notifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = user_notifications.user_id
      AND users.supabase_user_id::text = auth.uid()::text
    )
  );

-- Policy: Users can update their own notifications (e.g., mark as read)
DROP POLICY IF EXISTS "Users can update own notifications" ON user_notifications;
CREATE POLICY "Users can update own notifications"
  ON user_notifications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = user_notifications.user_id
      AND users.supabase_user_id::text = auth.uid()::text
    )
  );

-- Note: Device, command, image, and notification tables are managed by the backend
-- The backend service role has full access to these tables
-- RLS is not enabled on these tables as they are accessed via the API with proper authentication

-- Create a function to check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin(user_supabase_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    WHERE u.supabase_user_id = user_supabase_id
    AND ur.role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (if using Supabase)
-- Skip if authenticated role doesn't exist (standard PostgreSQL)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION is_admin(TEXT) TO authenticated;
  END IF;
END $$;

