-- SuperIT Apps — Nomination (Best Performance board)
-- Jalankan di SQL Editor Supabase.

CREATE TABLE IF NOT EXISTS public.nominasi_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_acara text NOT NULL DEFAULT 'Best Performance',
  tanggal date NOT NULL DEFAULT current_date,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Semua akses lewat server function (service role); klien tidak langsung.
GRANT ALL ON public.nominasi_events TO service_role;
ALTER TABLE public.nominasi_events ENABLE ROW LEVEL SECURITY;
