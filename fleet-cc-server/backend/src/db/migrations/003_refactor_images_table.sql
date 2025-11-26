-- Refactor Images Table Migration
-- Moves image data to a separate images table with foreign key from devices

-- Create new images table with comprehensive image tracking
CREATE TABLE IF NOT EXISTS images (
  id SERIAL PRIMARY KEY,
  image_build_hash VARCHAR(255) UNIQUE NOT NULL,
  image_signature TEXT,
  build_id VARCHAR(255),
  git_sha VARCHAR(255),
  build_timestamp TIMESTAMP,
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP,
  verified_by VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  unknown BOOLEAN DEFAULT false, -- Flag for images that need manual review
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_images_build_hash ON images(image_build_hash);
CREATE INDEX IF NOT EXISTS idx_images_verified ON images(verified);
CREATE INDEX IF NOT EXISTS idx_images_is_active ON images(is_active);
-- Create index on unknown column only if it exists (will be dropped in migration 005)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'images' AND column_name = 'unknown'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_images_unknown ON images(unknown);
  END IF;
END $$;

-- Migrate data from verified_images table to images table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'verified_images') THEN
    INSERT INTO images (
      image_build_hash,
      image_signature,
      build_id,
      git_sha,
      build_timestamp,
      verified,
      verified_at,
      verified_by,
      is_active,
      notes,
      created_at
    )
    SELECT
      image_build_hash,
      image_signature,
      build_id,
      git_sha,
      build_timestamp,
      true as verified, -- All existing verified_images are verified
      verified_at,
      verified_by,
      is_active,
      notes,
      created_at
    FROM verified_images
    ON CONFLICT (image_build_hash) DO NOTHING;
  END IF;
END $$;

-- Add image_id foreign key column to devices table
ALTER TABLE devices ADD COLUMN IF NOT EXISTS image_id INTEGER REFERENCES images(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_devices_image_id ON devices(image_id);

-- Migrate existing device image data to images table and link via foreign key
-- First, create images for any unique image_build_hash values in devices
-- Check if unknown column exists before using it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'images' AND column_name = 'unknown'
  ) THEN
    -- unknown column exists, use it
    INSERT INTO images (
      image_build_hash,
      image_signature,
      build_id,
      git_sha,
      verified,
      unknown,
      created_at
    )
    SELECT DISTINCT
      image_build_hash,
      image_signature,
      build_id,
      NULL as git_sha, -- Not available in devices table
      COALESCE(image_verified, false) as verified,
      NOT COALESCE(image_verified, false) as unknown, -- Mark as unknown if not verified
      NOW() as created_at
    FROM devices
    WHERE image_build_hash IS NOT NULL
      AND image_build_hash NOT IN (SELECT image_build_hash FROM images)
    ON CONFLICT (image_build_hash) DO NOTHING;
  ELSE
    -- unknown column doesn't exist (already removed), just use verified
    INSERT INTO images (
      image_build_hash,
      image_signature,
      build_id,
      git_sha,
      verified,
      created_at
    )
    SELECT DISTINCT
      image_build_hash,
      image_signature,
      build_id,
      NULL as git_sha, -- Not available in devices table
      COALESCE(image_verified, false) as verified,
      NOW() as created_at
    FROM devices
    WHERE image_build_hash IS NOT NULL
      AND image_build_hash NOT IN (SELECT image_build_hash FROM images)
    ON CONFLICT (image_build_hash) DO NOTHING;
  END IF;
END $$;

-- Update devices to link to images via foreign key
UPDATE devices d
SET image_id = i.id
FROM images i
WHERE d.image_build_hash = i.image_build_hash
  AND d.image_id IS NULL;

-- Add trigger to update updated_at timestamp on images
CREATE OR REPLACE FUNCTION update_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS update_images_updated_at ON images;
CREATE TRIGGER update_images_updated_at BEFORE UPDATE ON images
  FOR EACH ROW EXECUTE FUNCTION update_images_updated_at();

-- Note: We keep the old columns in devices table for backward compatibility
-- They can be removed in a future migration after verifying everything works
-- Old columns that remain (for now):
--   image_build_hash, image_signature, image_verified, image_verified_at

