-- SuperIT Apps — Absensi Event
-- Jalankan di SQL Editor Supabase.

-- 1) Tabel lama menu Tools IT tidak dipakai lagi.
DROP TABLE IF EXISTS public.it_tools CASCADE;

-- 2) Master absensi event (satu baris = satu link absensi).
CREATE TABLE IF NOT EXISTS public.absensi_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  event_name text NOT NULL DEFAULT 'Absensi Event',
  office_name text NOT NULL DEFAULT 'BRI BO Pringsewu',
  event_date date NOT NULL DEFAULT current_date,
  logo text,
  logo_left text,
  logo_right text,
  logo_left_size integer NOT NULL DEFAULT 136,
  logo_right_size integer NOT NULL DEFAULT 136,
  background text,
  card_background text,
  theme_color text NOT NULL DEFAULT 'gold',
  fields jsonb NOT NULL DEFAULT '{"nama":true,"personalNumber":true,"unitKerja":true,"noTelp":true,"fotoSelfie":true}'::jsonb,
  unit_kerja_list text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_open boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Admin per absensi event.
CREATE TABLE IF NOT EXISTS public.absensi_event_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.absensi_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- 4) Data absensi peserta.
CREATE TABLE IF NOT EXISTS public.absensi_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.absensi_events(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  nama text,
  personal_number text,
  unit_kerja text,
  no_telp text,
  photo_file_id text,
  photo_url text,
  photo_thumbnail_url text
);

CREATE INDEX IF NOT EXISTS absensi_entries_event_idx
  ON public.absensi_entries (event_id, submitted_at DESC);

-- 5) Semua akses lewat server function (service role); klien tidak boleh langsung.
GRANT ALL ON public.absensi_events TO service_role;
GRANT ALL ON public.absensi_event_admins TO service_role;
GRANT ALL ON public.absensi_entries TO service_role;

ALTER TABLE public.absensi_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absensi_event_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absensi_entries ENABLE ROW LEVEL SECURITY;
