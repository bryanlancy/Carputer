-- Migration: Add messages table for email and other message templates
-- Messages can be used in wiring actions like Send Email and support variable templating

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  message_code VARCHAR(100) UNIQUE NOT NULL,
  message_name VARCHAR(255) NOT NULL,
  description TEXT,
  message_type VARCHAR(50) NOT NULL DEFAULT 'email', -- 'email', 'sms', 'webhook', etc.
  subject_template TEXT, -- For emails
  body_template TEXT NOT NULL, -- Message body with variable templating
  variable_schema JSONB, -- JSON Schema defining what variables this message uses and their data requirements
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on message_code
CREATE INDEX IF NOT EXISTS idx_messages_message_code ON messages(message_code);
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_messages_enabled ON messages(enabled);

-- Create updated_at trigger for messages
CREATE OR REPLACE FUNCTION update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_messages_updated_at ON messages;
CREATE TRIGGER trigger_update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_messages_updated_at();

