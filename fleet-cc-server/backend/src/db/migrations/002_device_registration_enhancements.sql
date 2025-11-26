-- Device Registration Enhancements Migration
-- Adds MAC address tracking, image verification, and authorization status

-- Add MAC address column (unique identifier for hardware)
ALTER TABLE devices ADD COLUMN IF NOT EXISTS mac_address VARCHAR(17) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_devices_mac_address ON devices(mac_address);

-- Add image verification fields
ALTER TABLE devices ADD COLUMN IF NOT EXISTS image_signature VARCHAR(512);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS image_build_hash VARCHAR(255);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS image_verified BOOLEAN DEFAULT false;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS image_verified_at TIMESTAMP;

-- Add authorization status (separate from device status)
ALTER TABLE devices ADD COLUMN IF NOT EXISTS authorized BOOLEAN DEFAULT false;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS authorized_at TIMESTAMP;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS authorized_by VARCHAR(255); -- Can be 'auto' for automatic, or admin user

-- Add registration metadata
ALTER TABLE devices ADD COLUMN IF NOT EXISTS registration_method VARCHAR(50) DEFAULT 'manual'; -- 'auto' or 'manual'
ALTER TABLE devices ADD COLUMN IF NOT EXISTS registration_ip INET;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS first_seen TIMESTAMP;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_registration_attempt TIMESTAMP;

-- Create verified images table to track authorized carputer images
CREATE TABLE IF NOT EXISTS verified_images (
  id SERIAL PRIMARY KEY,
  image_build_hash VARCHAR(255) UNIQUE NOT NULL,
  image_signature TEXT,
  build_id VARCHAR(255),
  git_sha VARCHAR(255),
  build_timestamp TIMESTAMP,
  verified_at TIMESTAMP DEFAULT NOW(),
  verified_by VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verified_images_build_hash ON verified_images(image_build_hash);
CREATE INDEX IF NOT EXISTS idx_verified_images_is_active ON verified_images(is_active);

-- Create device registration attempts log for security/auditing
CREATE TABLE IF NOT EXISTS device_registration_attempts (
  id SERIAL PRIMARY KEY,
  mac_address VARCHAR(17),
  device_id VARCHAR(255),
  ip_address INET,
  image_build_hash VARCHAR(255),
  image_signature VARCHAR(512),
  registration_method VARCHAR(50),
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registration_attempts_mac ON device_registration_attempts(mac_address);
CREATE INDEX IF NOT EXISTS idx_registration_attempts_created_at ON device_registration_attempts(created_at);

-- Update existing devices to set first_seen if not set
UPDATE devices SET first_seen = created_at WHERE first_seen IS NULL;


