-- Pilihan kolom kehadiran pada Absensi, Doa & Briefing Pagi
-- Format data: [{ "shortcut": "bh", "label": "Belum Hadir" }, ...]
CREATE TABLE IF NOT EXISTS public.doa_pagi_kehadiran_options (
  id text PRIMARY KEY DEFAULT 'default',
  data jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.doa_pagi_kehadiran_options TO service_role;
ALTER TABLE public.doa_pagi_kehadiran_options ENABLE ROW LEVEL SECURITY;
