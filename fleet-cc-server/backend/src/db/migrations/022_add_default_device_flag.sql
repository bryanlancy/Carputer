-- Add Default Device Flag Migration
-- Adds is_default column to devices table to mark a device used for template previews

-- Add is_default column to devices table
ALTER TABLE devices ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_devices_is_default ON devices(is_default);

-- Add unique partial index to ensure only one default device exists
-- This constraint ensures that only one row can have is_default = true
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_is_default_unique
ON devices(is_default)
WHERE is_default = true;

