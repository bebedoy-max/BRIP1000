-- Upcoming Event (dashboard umum): agenda yang diatur manual dari menu admin.
CREATE TABLE IF NOT EXISTS public.agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  judul text NOT NULL,
  tanggal date NOT NULL,
  waktu text,
  lokasi text,
  keterangan text,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.agenda TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda TO authenticated;
GRANT ALL ON public.agenda TO service_role;

ALTER TABLE public.agenda ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agenda read" ON public.agenda;
DROP POLICY IF EXISTS "agenda admin write" ON public.agenda;
CREATE POLICY "agenda read" ON public.agenda FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "agenda admin write" ON public.agenda FOR ALL TO authenticated
  USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());

DROP TRIGGER IF EXISTS agenda_updated ON public.agenda;
CREATE TRIGGER agenda_updated BEFORE UPDATE ON public.agenda
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
