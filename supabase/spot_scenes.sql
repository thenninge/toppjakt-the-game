-- Run in the shared CBAware Supabase SQL editor.
-- Cloud spotting scenes (community / remote admins) — image in Storage + perches JSON.
--
-- After running this SQL, create the Storage bucket in the dashboard:
--   Name: spot-scenes
--   Public: YES (players need to load images)
--   File size limit: 3 MB (API also enforces this after compression)
--   Allowed MIME: image/jpeg, image/webp
--
-- Bucket policies (optional if using service-role only for writes):
--   Public SELECT on storage.objects for bucket_id = 'spot-scenes'
--   No anon/authenticated INSERT — uploads go through Next.js + service role.

CREATE TABLE IF NOT EXISTS spot_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  -- Path inside bucket spot-scenes, e.g. "published/{uuid}.jpg"
  image_path TEXT NOT NULL,
  -- Public URL (or path resolved by API). Stored for stable client imageSrc.
  image_url TEXT NOT NULL,
  perches JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS spot_scenes_status_idx
  ON spot_scenes (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS spot_scenes_created_by_idx
  ON spot_scenes (created_by);

COMMENT ON TABLE spot_scenes IS
  'Toppjakt spotting scenes uploaded by allowlisted Google admins. Merged into spot pool at runtime.';
