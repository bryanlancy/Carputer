-- Migration: Make rule_id nullable in wiring_configurations
-- This allows wiring configurations to exist without a rule_id (workspace-based configs)

-- First, drop the foreign key constraint if it exists (it was already dropped in migration 013)
-- But we'll check to be safe
ALTER TABLE IF EXISTS wiring_configurations DROP CONSTRAINT IF EXISTS wiring_configurations_rule_id_fkey;

-- Drop the unique constraint on rule_id if it exists (we'll recreate it as partial unique)
ALTER TABLE IF EXISTS wiring_configurations DROP CONSTRAINT IF EXISTS wiring_configurations_rule_id_key;

-- Make rule_id nullable
ALTER TABLE wiring_configurations ALTER COLUMN rule_id DROP NOT NULL;

-- Recreate unique constraint on rule_id, but only for non-null values
-- This allows multiple NULL values (one per workspace) but ensures uniqueness for non-null values
CREATE UNIQUE INDEX IF NOT EXISTS wiring_configurations_rule_id_unique
  ON wiring_configurations(rule_id)
  WHERE rule_id IS NOT NULL;

