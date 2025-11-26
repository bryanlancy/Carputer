-- Consolidate Images Table Migration
-- Merges versions table into images table and removes redundant unknown column

-- Add changelog and is_latest columns to images table
ALTER TABLE images ADD COLUMN IF NOT EXISTS changelog TEXT;
ALTER TABLE images ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT false;

-- Migrate data from versions table to images table (match on build_id)
UPDATE images i
SET
  changelog = v.changelog,
  is_latest = v.is_latest,
  git_sha = COALESCE(i.git_sha, v.git_sha),
  build_timestamp = COALESCE(i.build_timestamp, v.build_timestamp)
FROM versions v
WHERE i.build_id = v.build_id;

-- Drop the unknown column (redundant with verified = false)
ALTER TABLE images DROP COLUMN IF EXISTS unknown;

-- Drop the index on unknown column if it exists
DROP INDEX IF EXISTS idx_images_unknown;

-- Create index on is_latest for faster queries
CREATE INDEX IF NOT EXISTS idx_images_is_latest ON images(is_latest);

-- Drop the versions table (data has been merged into images)
DROP TABLE IF EXISTS versions;

-- Drop the verified_images table (data was migrated to images in migration 003)
DROP TABLE IF EXISTS verified_images;

