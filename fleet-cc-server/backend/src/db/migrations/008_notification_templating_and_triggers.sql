-- Notification Templating and Trigger System Migration
-- Adds templating, triggers, events, wiring, and notification feed support

-- Create notification_rules table if it doesn't exist
-- This table will later be merged into notification_types in migration 013
-- Create table without foreign key first (type_code may not exist if migration 013 already ran)
CREATE TABLE IF NOT EXISTS notification_rules (
  id SERIAL PRIMARY KEY,
  notification_type_code VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  target_users JSONB,
  message_template TEXT,
  priority INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add foreign key constraint only if type_code column exists in notification_types
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_types' AND column_name = 'type_code'
  ) THEN
    -- Drop constraint if it exists
    ALTER TABLE notification_rules DROP CONSTRAINT IF EXISTS notification_rules_notification_type_code_fkey;
    -- Add foreign key constraint
    ALTER TABLE notification_rules
      ADD CONSTRAINT notification_rules_notification_type_code_fkey
      FOREIGN KEY (notification_type_code) REFERENCES notification_types(type_code) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notification_rules_type_code ON notification_rules(notification_type_code);
CREATE INDEX IF NOT EXISTS idx_notification_rules_enabled ON notification_rules(enabled);

-- Trigger to update updated_at timestamp for notification_rules
DROP TRIGGER IF EXISTS update_notification_rules_updated_at ON notification_rules;
CREATE TRIGGER update_notification_rules_updated_at BEFORE UPDATE ON notification_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Remove read and read_at from notifications table (user-specific only)
ALTER TABLE notifications DROP COLUMN IF EXISTS read;
ALTER TABLE notifications DROP COLUMN IF EXISTS read_at;
DROP INDEX IF EXISTS idx_notifications_read;

-- Add show_in_feed field to notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS show_in_feed BOOLEAN DEFAULT true;

-- Create triggers table (defines trigger types with output schemas)
CREATE TABLE IF NOT EXISTS triggers (
  id SERIAL PRIMARY KEY,
  trigger_code VARCHAR(100) UNIQUE NOT NULL,
  trigger_name VARCHAR(255) NOT NULL,
  description TEXT,
  output_schema JSONB NOT NULL, -- JSON Schema defining what data this trigger emits
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create events table (defines event types with input schemas)
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  event_code VARCHAR(100) UNIQUE NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  description TEXT,
  input_schema JSONB NOT NULL, -- JSON Schema defining what data this event requires
  handler_type VARCHAR(50) NOT NULL, -- 'notification', 'email', 'command', etc.
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create trigger_event_connections table (junction for wiring configurations)
CREATE TABLE IF NOT EXISTS trigger_event_connections (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER NOT NULL REFERENCES notification_rules(id) ON DELETE CASCADE,
  trigger_id INTEGER NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  connection_config JSONB, -- Additional configuration for this connection
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_rule_trigger_event UNIQUE(rule_id, trigger_id, event_id)
);

-- Create wiring_configurations table (stores React Flow node positions and layout)
CREATE TABLE IF NOT EXISTS wiring_configurations (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER NOT NULL UNIQUE REFERENCES notification_rules(id) ON DELETE CASCADE,
  nodes JSONB NOT NULL, -- React Flow nodes with positions
  edges JSONB NOT NULL, -- React Flow edges/connections
  viewport JSONB, -- Viewport position/zoom
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_triggers_trigger_code ON triggers(trigger_code);
CREATE INDEX IF NOT EXISTS idx_triggers_enabled ON triggers(enabled);
CREATE INDEX IF NOT EXISTS idx_events_event_code ON events(event_code);
CREATE INDEX IF NOT EXISTS idx_events_enabled ON events(enabled);
CREATE INDEX IF NOT EXISTS idx_events_handler_type ON events(handler_type);
CREATE INDEX IF NOT EXISTS idx_trigger_event_connections_rule_id ON trigger_event_connections(rule_id);
CREATE INDEX IF NOT EXISTS idx_trigger_event_connections_trigger_id ON trigger_event_connections(trigger_id);
CREATE INDEX IF NOT EXISTS idx_trigger_event_connections_event_id ON trigger_event_connections(event_id);
CREATE INDEX IF NOT EXISTS idx_wiring_configurations_rule_id ON wiring_configurations(rule_id);
CREATE INDEX IF NOT EXISTS idx_notifications_show_in_feed ON notifications(show_in_feed);

-- Trigger to update updated_at timestamp for triggers
DROP TRIGGER IF EXISTS update_triggers_updated_at ON triggers;
CREATE TRIGGER update_triggers_updated_at BEFORE UPDATE ON triggers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at timestamp for events
DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at timestamp for trigger_event_connections
DROP TRIGGER IF EXISTS update_trigger_event_connections_updated_at ON trigger_event_connections;
CREATE TRIGGER update_trigger_event_connections_updated_at BEFORE UPDATE ON trigger_event_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at timestamp for wiring_configurations
DROP TRIGGER IF EXISTS update_wiring_configurations_updated_at ON wiring_configurations;
CREATE TRIGGER update_wiring_configurations_updated_at BEFORE UPDATE ON wiring_configurations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert built-in triggers
INSERT INTO triggers (trigger_code, trigger_name, description, output_schema, enabled) VALUES
  ('device.online', 'Device Online', 'Triggered when a device comes online',
   '{"type": "object", "properties": {"device": {"type": "object"}, "timestamp": {"type": "string", "format": "date-time"}}, "required": ["device", "timestamp"]}'::jsonb, true)
ON CONFLICT (trigger_code) DO NOTHING;

INSERT INTO triggers (trigger_code, trigger_name, description, output_schema, enabled) VALUES
  ('device.offline', 'Device Offline', 'Triggered when a device goes offline',
   '{"type": "object", "properties": {"device": {"type": "object"}, "timestamp": {"type": "string", "format": "date-time"}}, "required": ["device", "timestamp"]}'::jsonb, true)
ON CONFLICT (trigger_code) DO NOTHING;

INSERT INTO triggers (trigger_code, trigger_name, description, output_schema, enabled) VALUES
  ('command.completed', 'Command Completed', 'Triggered when a command completes successfully',
   '{"type": "object", "properties": {"command": {"type": "object"}, "device": {"type": "object"}, "timestamp": {"type": "string", "format": "date-time"}}, "required": ["command", "device", "timestamp"]}'::jsonb, true)
ON CONFLICT (trigger_code) DO NOTHING;

INSERT INTO triggers (trigger_code, trigger_name, description, output_schema, enabled) VALUES
  ('command.failed', 'Command Failed', 'Triggered when a command fails',
   '{"type": "object", "properties": {"command": {"type": "object"}, "device": {"type": "object"}, "error": {"type": "string"}, "timestamp": {"type": "string", "format": "date-time"}}, "required": ["command", "device", "error", "timestamp"]}'::jsonb, true)
ON CONFLICT (trigger_code) DO NOTHING;

INSERT INTO triggers (trigger_code, trigger_name, description, output_schema, enabled) VALUES
  ('date_time', 'Date/Time', 'Triggered at a specific date/time',
   '{"type": "object", "properties": {"timestamp": {"type": "string", "format": "date-time"}, "date": {"type": "string"}, "time": {"type": "string"}}, "required": ["timestamp"]}'::jsonb, true)
ON CONFLICT (trigger_code) DO NOTHING;

-- Insert built-in events
INSERT INTO events (event_code, event_name, description, input_schema, handler_type, enabled) VALUES
  ('show_notification', 'Show Notification', 'Display a notification to users',
   '{"type": "object", "properties": {"message": {"type": "string"}, "title": {"type": "string"}, "device": {"type": "object"}}, "required": ["message"]}'::jsonb, 'notification', true)
ON CONFLICT (event_code) DO NOTHING;

INSERT INTO events (event_code, event_name, description, input_schema, handler_type, enabled) VALUES
  ('send_email', 'Send Email', 'Send an email notification',
   '{"type": "object", "properties": {"to": {"type": "string"}, "subject": {"type": "string"}, "body": {"type": "string"}}, "required": ["to", "subject", "body"]}'::jsonb, 'email', true)
ON CONFLICT (event_code) DO NOTHING;

INSERT INTO events (event_code, event_name, description, input_schema, handler_type, enabled) VALUES
  ('execute_command', 'Execute Command', 'Execute a command on a device',
   '{"type": "object", "properties": {"device": {"type": "object"}, "command": {"type": "string"}, "parameters": {"type": "object"}}, "required": ["device", "command"]}'::jsonb, 'command', true)
ON CONFLICT (event_code) DO NOTHING;



