-- Migration: Add notification_type column to notifications table

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS notification_type VARCHAR(50) DEFAULT 'default';

-- Add index for notification_type
CREATE INDEX IF NOT EXISTS idx_notifications_notification_type ON notifications(notification_type);

