-- SuperIT Apps — default tampilan absensi event
CREATE TABLE IF NOT EXISTS public.absensi_display_defaults (
  id text PRIMARY KEY DEFAULT 'default',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.absensi_display_defaults TO service_role;
ALTER TABLE public.absensi_display_defaults ENABLE ROW LEVEL SECURITY;
