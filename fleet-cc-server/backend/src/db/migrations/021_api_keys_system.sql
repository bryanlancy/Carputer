-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  key_prefix VARCHAR(8) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description TEXT,
  revoked_at TIMESTAMP,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- API Key Permissions table
CREATE TABLE IF NOT EXISTS api_key_permissions (
  id SERIAL PRIMARY KEY,
  api_key_id INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,
  allowed_endpoints JSONB,
  allowed_fields JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked_at ON api_keys(revoked_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_last_used_at ON api_keys(last_used_at);
CREATE INDEX IF NOT EXISTS idx_api_key_permissions_api_key_id ON api_key_permissions(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_permissions_resource_type ON api_key_permissions(resource_type);

-- Trigger to update updated_at timestamp for api_keys
DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at timestamp for api_key_permissions
DROP TRIGGER IF EXISTS update_api_key_permissions_updated_at ON api_key_permissions;
CREATE TRIGGER update_api_key_permissions_updated_at BEFORE UPDATE ON api_key_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

