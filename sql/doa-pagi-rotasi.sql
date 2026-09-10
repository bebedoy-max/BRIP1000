-- Rotasi urutan bagian pada Absensi, Doa & Briefing Pagi.
-- Format data: { "<uker_id>": [3, 6, 1, 1, 2] }  -- Senin..Jumat = nomor urut bagian pertama
CREATE TABLE IF NOT EXISTS public.doa_pagi_rotasi (
  id text PRIMARY KEY DEFAULT 'default',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.doa_pagi_rotasi TO service_role;
ALTER TABLE public.doa_pagi_rotasi ENABLE ROW LEVEL SECURITY;
