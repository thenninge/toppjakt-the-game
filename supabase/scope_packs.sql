-- Run in the shared CBAware Supabase SQL editor.
-- Cloud scope packs (admin optics export) — reticle PNG in Storage + pack JSON.
--
-- After running this SQL, create the Storage bucket in the dashboard:
--   Name: scope-packs
--   Public: YES (admins may preview reticle URLs)
--   File size limit: 8 MB
--   Allowed MIME: image/png
--
-- Bucket policies (optional if using service-role only for writes):
--   Public SELECT on storage.objects for bucket_id = 'scope-packs'
--   No anon/authenticated INSERT — uploads go through Next.js + service role.

CREATE TABLE IF NOT EXISTS scope_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  scope_id TEXT NOT NULL,
  -- Full ScopePack JSON (image.base64 cleared after upload; use image_path).
  pack JSONB NOT NULL,
  image_path TEXT,
  image_url TEXT,
  created_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scope_packs_status_idx
  ON scope_packs (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS scope_packs_scope_id_idx
  ON scope_packs (scope_id);

CREATE INDEX IF NOT EXISTS scope_packs_created_by_idx
  ON scope_packs (created_by);

COMMENT ON TABLE scope_packs IS
  'Toppjakt scope+reticle packs uploaded by allowlisted Google admins. Sync to repo via Admin Office.';
