-- Remove unique constraint on (user_id, notification_id) to allow multiple test notifications
-- This allows creating multiple user_notifications for the same notification_id and user_id
-- (e.g., multiple test notifications)
ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notification_unique;

-- Note: We still have the primary key (id) which ensures uniqueness
-- Multiple user_notifications can now exist for the same user_id + notification_id combination
