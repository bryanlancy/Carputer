-- User Notifications System Migration
-- Adds user-based notification system with rules, triggers, and preferences

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (synced from Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  avatar_url TEXT,
  supabase_user_id UUID UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')),
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT user_role_unique UNIQUE(user_id, role)
);

-- User notifications junction table (links notifications to users with viewed status)
CREATE TABLE IF NOT EXISTS user_notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  viewed BOOLEAN DEFAULT false,
  viewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT user_notification_unique UNIQUE(user_id, notification_id)
);

-- Notification rules table (admin-configurable rules for triggering notifications)
CREATE TABLE IF NOT EXISTS notification_rules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('date_time', 'backend_event', 'user_driven')),
  trigger_config JSONB NOT NULL,
  notification_type_code VARCHAR(100) NOT NULL REFERENCES notification_types(type_code) ON DELETE RESTRICT,
  target_users JSONB, -- Array of user IDs or role names, null means all users
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Notification triggers table (scheduled and event-based triggers)
CREATE TABLE IF NOT EXISTS notification_triggers (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER REFERENCES notification_rules(id) ON DELETE CASCADE,
  trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('date_time', 'backend_event', 'user_driven')),
  trigger_config JSONB NOT NULL,
  scheduled_at TIMESTAMP,
  executed_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed', 'cancelled')),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User notification preferences table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  auto_read BOOLEAN DEFAULT false,
  enabled_notification_types JSONB, -- Array of notification type codes user wants to receive
  urgency_filters JSONB, -- Array of urgency levels user wants to see
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_supabase_user_id ON users(supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_notification_id ON user_notifications(notification_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_viewed ON user_notifications(viewed);
CREATE INDEX IF NOT EXISTS idx_notification_rules_enabled ON notification_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_notification_rules_trigger_type ON notification_rules(trigger_type);
CREATE INDEX IF NOT EXISTS idx_notification_rules_priority ON notification_rules(priority);
CREATE INDEX IF NOT EXISTS idx_notification_triggers_rule_id ON notification_triggers(rule_id);
CREATE INDEX IF NOT EXISTS idx_notification_triggers_status ON notification_triggers(status);
CREATE INDEX IF NOT EXISTS idx_notification_triggers_scheduled_at ON notification_triggers(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_user_id ON user_notification_preferences(user_id);

-- Trigger to update updated_at timestamp for users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at timestamp for notification_rules
DROP TRIGGER IF EXISTS update_notification_rules_updated_at ON notification_rules;
CREATE TRIGGER update_notification_rules_updated_at BEFORE UPDATE ON notification_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at timestamp for notification_triggers
DROP TRIGGER IF EXISTS update_notification_triggers_updated_at ON notification_triggers;
CREATE TRIGGER update_notification_triggers_updated_at BEFORE UPDATE ON notification_triggers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at timestamp for user_notification_preferences
DROP TRIGGER IF EXISTS update_user_notification_preferences_updated_at ON user_notification_preferences;
CREATE TRIGGER update_user_notification_preferences_updated_at BEFORE UPDATE ON user_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

