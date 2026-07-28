-- Run in the shared CBAware Supabase SQL editor.
-- Cloud hunt terrains (community / remote admins) — map image in Storage + seats JSON.
--
-- After running this SQL, create the Storage bucket in the dashboard:
--   Name: hunt-terrains
--   Public: YES (players / admin preview need to load maps)
--   File size limit: 6 MB (API also enforces this after client compress)
--   Allowed MIME: image/png, image/jpeg, image/webp
--
-- Bucket policies (optional if using service-role only for writes):
--   Public SELECT on storage.objects for bucket_id = 'hunt-terrains'
--   No anon/authenticated INSERT — uploads go through Next.js + service role.

CREATE TABLE IF NOT EXISTS hunt_terrains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  region_hint TEXT NOT NULL DEFAULT '',
  -- Path inside bucket hunt-terrains, e.g. "published/{uuid}.png"
  image_path TEXT NOT NULL,
  -- Public URL (or path resolved by API). Stored for stable client imageSrc.
  image_url TEXT NOT NULL,
  cols INT NOT NULL DEFAULT 7 CHECK (cols >= 2 AND cols <= 24),
  rows INT NOT NULL DEFAULT 6 CHECK (rows >= 2 AND rows <= 24),
  -- { "row": 0, "col": 0 } — row 0 = A (bottom), col 0 = 1 (left)
  start_cell JSONB NOT NULL DEFAULT '{"row":0,"col":0}'::jsonb,
  aware_map_max_m DOUBLE PRECISION,
  -- MapBirdSeat[] — species, xPct, yPct, row, col
  seats JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hunt_terrains_status_idx
  ON hunt_terrains (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS hunt_terrains_created_by_idx
  ON hunt_terrains (created_by);

COMMENT ON TABLE hunt_terrains IS
  'Toppjakt hunt terrains uploaded by allowlisted Google admins. Synced into maps + mapPlacements by main admin.';
