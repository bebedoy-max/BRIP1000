-- SuperIT Apps — Vote (Apresiasi Pekerja)
-- Jalankan di SQL Editor Supabase.

-- 1) Master vote event (satu baris = satu link voting).
CREATE TABLE IF NOT EXISTS public.vote_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'Apresiasi Pekerja',
  subtitle text NOT NULL DEFAULT '',
  eyebrow text NOT NULL DEFAULT 'Program Apresiasi',
  event_date date NOT NULL DEFAULT current_date,
  accent text NOT NULL DEFAULT '#a855f7',
  logo text,
  categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_hold boolean NOT NULL DEFAULT false,
  is_closed boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Nominasi per kategori.
CREATE TABLE IF NOT EXISTS public.vote_nominees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.vote_events(id) ON DELETE CASCADE,
  category text NOT NULL,
  nama text NOT NULL,
  jabatan text,
  uker text,
  personal_number text,
  foto text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vote_nominees_event_idx ON public.vote_nominees (event_id, category, sort_order);

-- 3) Admin per vote event.
CREATE TABLE IF NOT EXISTS public.vote_event_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.vote_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- 4) Suara masuk. Satu Personal Number satu suara per kategori.
CREATE TABLE IF NOT EXISTS public.vote_ballots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.vote_events(id) ON DELETE CASCADE,
  personal_number text NOT NULL,
  category text NOT NULL,
  nominee text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, personal_number, category)
);
CREATE INDEX IF NOT EXISTS vote_ballots_event_idx ON public.vote_ballots (event_id, category);

-- 5) Semua akses lewat server function (service role); klien tidak langsung.
GRANT ALL ON public.vote_events TO service_role;
GRANT ALL ON public.vote_nominees TO service_role;
GRANT ALL ON public.vote_event_admins TO service_role;
GRANT ALL ON public.vote_ballots TO service_role;

ALTER TABLE public.vote_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_nominees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_event_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_ballots ENABLE ROW LEVEL SECURITY;
