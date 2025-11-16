-- Devices table
CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  hostname VARCHAR(255),
  vin VARCHAR(255),
  hardware_rev VARCHAR(255),
  build_id VARCHAR(255),
  current_version VARCHAR(255),
  current_build_id VARCHAR(255),
  current_ip INET,
  uptime BIGINT,
  services_status JSONB,
  status VARCHAR(50) DEFAULT 'offline',
  last_seen TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Commands table
CREATE TABLE IF NOT EXISTS commands (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  command VARCHAR(100) NOT NULL,
  parameters JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  result JSONB,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Device logs table
CREATE TABLE IF NOT EXISTS device_logs (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  log_type VARCHAR(100),
  log_path VARCHAR(500),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  file_size BIGINT,
  metadata JSONB
);

-- Version tracking table
CREATE TABLE IF NOT EXISTS versions (
  id SERIAL PRIMARY KEY,
  build_id VARCHAR(255) UNIQUE NOT NULL,
  git_sha VARCHAR(255),
  build_timestamp TIMESTAMP,
  changelog TEXT,
  is_latest BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen);
CREATE INDEX IF NOT EXISTS idx_commands_device_id ON commands(device_id);
CREATE INDEX IF NOT EXISTS idx_commands_status ON commands(status);
CREATE INDEX IF NOT EXISTS idx_commands_created_at ON commands(created_at);
CREATE INDEX IF NOT EXISTS idx_device_logs_device_id ON device_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_versions_build_id ON versions(build_id);
CREATE INDEX IF NOT EXISTS idx_versions_is_latest ON versions(is_latest);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commands_updated_at BEFORE UPDATE ON commands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

