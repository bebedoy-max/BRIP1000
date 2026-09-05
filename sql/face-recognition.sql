-- ============================================================
-- Face Recognition Foto Event Pekerja (v2)
-- Jalankan seluruh file ini di Supabase SQL Editor project Anda.
-- Aman dijalankan berulang (idempotent).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ------------------------------------------------------------
-- 1. Foto master wajah pekerja
--    Embedding dihitung oleh companion app, BUKAN oleh web app.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.worker_faces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  personal_number text NOT NULL UNIQUE,
  reference_photo_url text,
  embedding vector(512),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'indexed', 'failed')),
  note text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS worker_faces_worker_idx ON public.worker_faces (worker_id);

-- Kolom embedding TIDAK PERNAH boleh dibaca frontend: grant per-kolom saja.
REVOKE ALL ON public.worker_faces FROM anon, authenticated;
GRANT SELECT (id, worker_id, personal_number, reference_photo_url, status, note, updated_by, updated_at, created_at)
  ON public.worker_faces TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.worker_faces TO authenticated;
GRANT ALL ON public.worker_faces TO service_role;

ALTER TABLE public.worker_faces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "worker_faces read" ON public.worker_faces;
DROP POLICY IF EXISTS "worker_faces admin write" ON public.worker_faces;
CREATE POLICY "worker_faces read" ON public.worker_faces
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "worker_faces admin write" ON public.worker_faces
  FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());

DROP TRIGGER IF EXISTS worker_faces_updated ON public.worker_faces;
CREATE TRIGGER worker_faces_updated BEFORE UPDATE ON public.worker_faces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 2. Event: pakai tabel events yang sudah ada, tambah folder Drive
-- ------------------------------------------------------------
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS drive_folder_id text;

-- ------------------------------------------------------------
-- 3. Foto event hasil proses companion app
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  drive_file_id text NOT NULL,
  drive_view_link text NOT NULL,
  file_name text,
  matched_worker_ids uuid[] NOT NULL DEFAULT '{}',
  processed_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS event_photos_matched_idx ON public.event_photos USING gin (matched_worker_ids);
CREATE INDEX IF NOT EXISTS event_photos_event_idx ON public.event_photos (event_id, processed_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS event_photos_file_idx ON public.event_photos (drive_file_id);

GRANT SELECT ON public.event_photos TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.event_photos TO authenticated;
GRANT ALL ON public.event_photos TO service_role;

ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_photos read" ON public.event_photos;
DROP POLICY IF EXISTS "event_photos admin write" ON public.event_photos;
CREATE POLICY "event_photos read" ON public.event_photos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "event_photos admin write" ON public.event_photos
  FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());

-- ------------------------------------------------------------
-- 4. Daftar companion app / plugin (menu "SuperIT Plug In")
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companion_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  version text,
  changelog text,
  download_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.companion_apps TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.companion_apps TO authenticated;
GRANT ALL ON public.companion_apps TO service_role;

ALTER TABLE public.companion_apps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "companion_apps read" ON public.companion_apps;
DROP POLICY IF EXISTS "companion_apps admin write" ON public.companion_apps;
CREATE POLICY "companion_apps read" ON public.companion_apps
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "companion_apps admin write" ON public.companion_apps
  FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());

DROP TRIGGER IF EXISTS companion_apps_updated ON public.companion_apps;
CREATE TRIGGER companion_apps_updated BEFORE UPDATE ON public.companion_apps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 5. Storage bucket foto master wajah
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('worker-faces', 'worker-faces', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "worker faces public read" ON storage.objects;
DROP POLICY IF EXISTS "worker faces admin write" ON storage.objects;
CREATE POLICY "worker faces public read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'worker-faces');
CREATE POLICY "worker faces admin write" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'worker-faces' AND public.is_it_admin())
  WITH CHECK (bucket_id = 'worker-faces' AND public.is_it_admin());

-- ------------------------------------------------------------
-- 6. Pencocokan wajah (dipakai companion app, service/admin saja)
--    Mengembalikan kandidat terdekat untuk satu embedding foto event.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_worker_faces(
  query_embedding vector(512),
  match_threshold double precision DEFAULT 0.6,
  match_count integer DEFAULT 5
)
RETURNS TABLE (worker_id uuid, personal_number text, similarity double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wf.worker_id,
         wf.personal_number,
         1 - (wf.embedding <=> query_embedding) AS similarity
  FROM public.worker_faces wf
  WHERE wf.status = 'indexed'
    AND wf.embedding IS NOT NULL
    AND 1 - (wf.embedding <=> query_embedding) >= match_threshold
  ORDER BY wf.embedding <=> query_embedding
  LIMIT match_count;
$$;
REVOKE ALL ON FUNCTION public.match_worker_faces(vector, double precision, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.match_worker_faces(vector, double precision, integer) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 7. Hak akses menu baru "SuperIT Plug In" (admin saja)
-- ------------------------------------------------------------
INSERT INTO public.page_access (page_key, akses_level, allowed, can_edit)
VALUES ('plugin', 'admin', true, true), ('plugin', 'manajemen', false, false), ('plugin', 'pekerja', false, false)
ON CONFLICT DO NOTHING;
