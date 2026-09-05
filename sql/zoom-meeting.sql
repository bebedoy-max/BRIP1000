-- SuperIT Apps — Zoom Meeting
-- Jalankan di SQL Editor Supabase Anda.

-- 1) Akun / aplikasi Zoom (OAuth). Kredensial hanya dibaca oleh server (service role).
CREATE TABLE IF NOT EXISTS public.zoom_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT 'Zoom BRI BO Pringsewu',
  client_id text NOT NULL,
  client_secret text NOT NULL,
  redirect_uri text NOT NULL DEFAULT 'https://bripringsewu.web.id/api/zoom/callback',
  refresh_token text,
  account_email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabel kredensial: tidak diberikan akses ke anon/authenticated.
ALTER TABLE public.zoom_accounts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.zoom_accounts TO service_role;

-- 2) Jadwal meeting yang dibuat lewat panel.
CREATE TABLE IF NOT EXISTS public.zoom_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zoom_meeting_id text,
  topic text NOT NULL,
  agenda text,
  start_time timestamptz NOT NULL,
  duration integer NOT NULL DEFAULT 60,
  timezone text NOT NULL DEFAULT 'Asia/Jakarta',
  join_url text,
  start_url text,
  password text,
  host_email text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zoom_meetings_start_idx ON public.zoom_meetings (start_time DESC);

ALTER TABLE public.zoom_meetings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.zoom_meetings TO authenticated;
GRANT ALL ON public.zoom_meetings TO service_role;

DROP POLICY IF EXISTS "zoom_meetings_read" ON public.zoom_meetings;
CREATE POLICY "zoom_meetings_read" ON public.zoom_meetings
  FOR SELECT TO authenticated USING (true);

-- 3) Isi kredensial aplikasi Zoom (ganti CLIENT_SECRET dengan milik Anda).
-- INSERT INTO public.zoom_accounts (client_id, client_secret)
-- VALUES ('Pitq8flYR7GhBo_O3clokg', 'CLIENT_SECRET_ANDA');
