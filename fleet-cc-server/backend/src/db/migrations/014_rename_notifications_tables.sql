-- Migration: Rename notification_types to notifications and rename notifications to notification_instances
-- This consolidates notification configuration into the notifications table

-- Step 1: Rename the current notifications table (instances) to notification_instances
ALTER TABLE notifications RENAME TO notification_instances;

-- Step 2: Rename notification_types to notifications
ALTER TABLE notification_types RENAME TO notifications;

-- Step 3: Update foreign key constraint in notification_instances to reference the renamed table
ALTER TABLE notification_instances
  DROP CONSTRAINT IF EXISTS notifications_notification_type_id_fkey;

ALTER TABLE notification_instances
  ADD CONSTRAINT notification_instances_notification_type_id_fkey
  FOREIGN KEY (notification_type_id) REFERENCES notifications(id) ON DELETE RESTRICT;

-- Step 4: Update indexes
DROP INDEX IF EXISTS idx_notifications_device_id;
DROP INDEX IF EXISTS idx_notifications_notification_type_id;
DROP INDEX IF EXISTS idx_notifications_device_log_id;
DROP INDEX IF EXISTS idx_notifications_show_in_feed;
DROP INDEX IF EXISTS idx_notifications_created_at;

CREATE INDEX IF NOT EXISTS idx_notification_instances_device_id ON notification_instances(device_id);
CREATE INDEX IF NOT EXISTS idx_notification_instances_notification_type_id ON notification_instances(notification_type_id);
CREATE INDEX IF NOT EXISTS idx_notification_instances_device_log_id ON notification_instances(device_log_id);
CREATE INDEX IF NOT EXISTS idx_notification_instances_show_in_feed ON notification_instances(show_in_feed);
CREATE INDEX IF NOT EXISTS idx_notification_instances_created_at ON notification_instances(created_at);

-- Step 5: Update user_notifications foreign key
ALTER TABLE user_notifications
  DROP CONSTRAINT IF EXISTS user_notifications_notification_id_fkey;

-- Clean up orphaned user_notifications that reference non-existent notification_instances
DELETE FROM user_notifications
WHERE notification_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM notification_instances WHERE id = user_notifications.notification_id
  );

-- Now add the foreign key constraint
ALTER TABLE user_notifications
  ADD CONSTRAINT user_notifications_notification_id_fkey
  FOREIGN KEY (notification_id) REFERENCES notification_instances(id) ON DELETE CASCADE;

