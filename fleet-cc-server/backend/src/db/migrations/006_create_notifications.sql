-- Create Notifications System Migration
-- Adds notification types and notifications tables with foreign key relationships to device_logs

-- Notification types table (extensible for future event types)
CREATE TABLE IF NOT EXISTS notification_types (
  id SERIAL PRIMARY KEY,
  type_code VARCHAR(100) UNIQUE NOT NULL,
  type_name VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(50) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  notification_type_id INTEGER NOT NULL REFERENCES notification_types(id) ON DELETE RESTRICT,
  device_log_id INTEGER REFERENCES device_logs(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  metadata JSONB,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default notification types
INSERT INTO notification_types (type_code, type_name, description, severity, enabled) VALUES
  ('device.online', 'Device Online', 'Device has come online and established connection', 'info', true),
  ('device.offline', 'Device Offline', 'Device has gone offline or lost connection', 'warning', true)
ON CONFLICT (type_code) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_device_id ON notifications(device_id);
CREATE INDEX IF NOT EXISTS idx_notifications_notification_type_id ON notifications(notification_type_id);
CREATE INDEX IF NOT EXISTS idx_notifications_device_log_id ON notifications(device_log_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_types_type_code ON notification_types(type_code);
CREATE INDEX IF NOT EXISTS idx_notification_types_enabled ON notification_types(enabled);

-- Trigger to update updated_at timestamp for notification_types
DROP TRIGGER IF EXISTS update_notification_types_updated_at ON notification_types;
CREATE TRIGGER update_notification_types_updated_at BEFORE UPDATE ON notification_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

