-- Migration: Add workspaces table and update wiring_configurations
-- This migration creates workspaces for organizing wiring configurations
-- and updates wiring_configurations to use workspace_id instead of rule_id

-- Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on workspaces name
CREATE INDEX IF NOT EXISTS idx_workspaces_name ON workspaces(name);

-- Add workspace_id column to wiring_configurations (nullable initially for migration)
ALTER TABLE wiring_configurations ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add node_config column to wiring_configurations for storing per-node configuration
ALTER TABLE wiring_configurations ADD COLUMN IF NOT EXISTS node_config JSONB;

-- Migrate existing wiring configurations to a default workspace
-- First, create a default workspace
INSERT INTO workspaces (name, description)
VALUES ('Default Workspace', 'Migrated from notification rules')
ON CONFLICT DO NOTHING;

-- Get the default workspace ID (assuming it was just created or already exists)
DO $$
DECLARE
  default_workspace_id INTEGER;
BEGIN
  -- Get or create default workspace
  SELECT id INTO default_workspace_id FROM workspaces WHERE name = 'Default Workspace' LIMIT 1;

  IF default_workspace_id IS NULL THEN
    INSERT INTO workspaces (name, description)
    VALUES ('Default Workspace', 'Migrated from notification rules')
    RETURNING id INTO default_workspace_id;
  END IF;

  -- Update existing wiring configurations to use the default workspace
  UPDATE wiring_configurations
  SET workspace_id = default_workspace_id
  WHERE workspace_id IS NULL AND rule_id IS NOT NULL;
END $$;

-- Now make workspace_id NOT NULL (after migration)
-- Note: We'll keep rule_id for now to avoid breaking existing code, but it will be deprecated
-- The application should use workspace_id going forward

-- Create index on workspace_id
CREATE INDEX IF NOT EXISTS idx_wiring_configurations_workspace_id ON wiring_configurations(workspace_id);

-- Add unique constraint on workspace_id (one wiring config per workspace)
-- Note: This will fail if there are multiple configs per workspace, so we handle that first
DO $$
BEGIN
  -- Remove duplicates if any exist (keep the most recent one)
  DELETE FROM wiring_configurations w1
  USING wiring_configurations w2
  WHERE w1.id < w2.id
    AND w1.workspace_id = w2.workspace_id
    AND w1.workspace_id IS NOT NULL;

  -- Now add unique constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_wiring_configurations_workspace_id'
  ) THEN
    ALTER TABLE wiring_configurations
    ADD CONSTRAINT unique_wiring_configurations_workspace_id UNIQUE(workspace_id);
  END IF;
END $$;

-- Create updated_at trigger for workspaces
CREATE OR REPLACE FUNCTION update_workspaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_workspaces_updated_at ON workspaces;
CREATE TRIGGER trigger_update_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_workspaces_updated_at();

