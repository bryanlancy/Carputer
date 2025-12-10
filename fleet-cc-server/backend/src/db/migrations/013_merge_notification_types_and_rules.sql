-- Migration: Merge notification_types and notification_rules into a single notification_types table
-- This consolidates notification configuration into one table
--
-- FINAL STRUCTURE of notification_types table after merge:
--   id (from notification_types, used for references instead of type_code)
--   name (renamed from type_name, equivalent to notification_rules.name)
--   description (from both tables, same column)
--   enabled (from both tables, same column)
--   target_users (from notification_rules)
--   message_template (from notification_rules)
--   priority (from notification_rules, replaces severity)
--   variable_schema (new field for JSON Schema)
--   created_at (from both tables, same column)
--   updated_at (from both tables, same column)
--
-- Removed columns:
--   type_code (removed, use id for references)
--   severity (removed, priority serves the same function)
--   trigger_type (removed, handled by wiring system)
--   trigger_config (removed, handled by wiring system)

-- Step 1: Rename type_name to name
ALTER TABLE notification_types
RENAME COLUMN type_name TO name;

-- Step 2: Add columns from notification_rules that don't exist in notification_types
ALTER TABLE notification_types
ADD COLUMN IF NOT EXISTS target_users JSONB,
ADD COLUMN IF NOT EXISTS message_template TEXT,
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS variable_schema JSONB;

-- Step 3: Migrate data from notification_rules to notification_types
-- For each notification_rule, update the corresponding notification_type
-- This merges the rule configuration into the type
-- NOTE: This must happen BEFORE we drop type_code
UPDATE notification_types nt
SET
  target_users = COALESCE(nt.target_users, nr.target_users),
  message_template = COALESCE(nt.message_template, nr.message_template),
  priority = COALESCE(nt.priority, nr.priority)
FROM notification_rules nr
WHERE nt.type_code = nr.notification_type_code
  AND (nr.target_users IS NOT NULL OR nr.message_template IS NOT NULL OR nr.priority IS NOT NULL);

-- Step 4: Drop the notification_rules table (data has been merged into notification_types)
-- First, drop any foreign key constraints that reference notification_rules
ALTER TABLE IF EXISTS trigger_event_connections DROP CONSTRAINT IF EXISTS trigger_event_connections_rule_id_fkey;
ALTER TABLE IF EXISTS wiring_configurations DROP CONSTRAINT IF EXISTS wiring_configurations_rule_id_fkey;
ALTER TABLE IF EXISTS notification_triggers DROP CONSTRAINT IF EXISTS notification_triggers_rule_id_fkey;

-- Drop foreign key from notification_rules that references notification_types.type_code
ALTER TABLE IF EXISTS notification_rules DROP CONSTRAINT IF EXISTS notification_rules_notification_type_code_fkey;

-- Now drop the notification_rules table
DROP TABLE IF EXISTS notification_rules CASCADE;

-- Step 5: Remove columns that are no longer needed from notification_types
ALTER TABLE notification_types
DROP COLUMN IF EXISTS type_code,
DROP COLUMN IF EXISTS severity,
DROP COLUMN IF EXISTS trigger_type,
DROP COLUMN IF EXISTS trigger_config;

-- Step 6: Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_notification_types_priority ON notification_types(priority);


