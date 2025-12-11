-- Add Tagging System Migration
-- Adds tags table, tag_associations table, show_popup to notifications, and hidden to user_notifications

-- Create tags table for managing selectable tags
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  color VARCHAR(7), -- Hex color for UI
  category VARCHAR(50), -- Optional grouping
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create tag_associations table for polymorphic many-to-many relationships
CREATE TABLE IF NOT EXISTS tag_associations (
  id SERIAL PRIMARY KEY,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL, -- 'notification', 'user_notification', 'device', etc.
  entity_id INTEGER NOT NULL, -- ID of the associated entity
  inherited BOOLEAN DEFAULT false, -- true if inherited from parent entity
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tag_id, entity_type, entity_id)
);

-- Add show_popup column to notifications table
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS show_popup BOOLEAN DEFAULT false;

-- Add hidden column to user_notifications table
ALTER TABLE user_notifications
ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);
CREATE INDEX IF NOT EXISTS idx_tag_associations_entity ON tag_associations(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_tag_associations_tag ON tag_associations(tag_id);
CREATE INDEX IF NOT EXISTS idx_tag_associations_inherited ON tag_associations(inherited);
CREATE INDEX IF NOT EXISTS idx_notifications_show_popup ON notifications(show_popup);
CREATE INDEX IF NOT EXISTS idx_user_notifications_hidden ON user_notifications(hidden);

-- Insert default tags
INSERT INTO tags (name, description, color, category) VALUES
  ('test', 'Test notification tag', '#9e9e9e', 'system'),
  ('success', 'Success notification tag', '#4caf50', 'status'),
  ('warning', 'Warning notification tag', '#ff9800', 'status'),
  ('error', 'Error notification tag', '#f44336', 'status'),
  ('info', 'Info notification tag', '#2196f3', 'status')
ON CONFLICT (name) DO NOTHING;

-- Trigger to update updated_at timestamp for tags
DROP TRIGGER IF EXISTS update_tags_updated_at ON tags;
CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
