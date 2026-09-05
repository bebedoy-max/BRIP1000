-- Pengaturan logo tampilan Absensi, Doa & Briefing Pagi (BRI, Danantara, BO).
CREATE TABLE IF NOT EXISTS public.doa_pagi_logos (
  id text PRIMARY KEY DEFAULT 'default',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.doa_pagi_logos TO service_role;
ALTER TABLE public.doa_pagi_logos ENABLE ROW LEVEL SECURITY;
