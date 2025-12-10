-- Migration: Add show_in_feed to notifications table and drop notification_instances table

-- Step 1: Add show_in_feed column to notifications table
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS show_in_feed BOOLEAN DEFAULT true;

-- Step 2: Drop foreign key constraints that reference notification_instances
ALTER TABLE IF EXISTS user_notifications
  DROP CONSTRAINT IF EXISTS user_notifications_notification_id_fkey;

-- Step 3: Drop the notification_instances table
DROP TABLE IF EXISTS notification_instances CASCADE;

