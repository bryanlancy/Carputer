-- Add content column to user_notifications table
-- This stores the rendered message content so notifications can be viewed even if the notification template is deleted
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS content TEXT;

-- Update existing user_notifications to have content (optional - can be null for old records)
-- This migration doesn't backfill existing data as it would require rendering templates
