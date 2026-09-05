-- Kolom slide profil pekerja pada dashboard (di bawah infografis).
-- Pengaturan pekerja mana yang tampil + warna pulse glow frame fotonya.

CREATE TABLE IF NOT EXISTS public.worker_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
  aktif boolean NOT NULL DEFAULT true,
  urutan integer NOT NULL DEFAULT 1,
  -- Warna pulse glow frame foto (nilai CSS, mis. #22d3ee). NULL = tanpa glow.
  glow_color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.worker_slides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_slides TO authenticated;
GRANT ALL ON public.worker_slides TO service_role;

ALTER TABLE public.worker_slides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "worker_slides read" ON public.worker_slides;
DROP POLICY IF EXISTS "worker_slides admin write" ON public.worker_slides;
CREATE POLICY "worker_slides read" ON public.worker_slides FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "worker_slides admin write" ON public.worker_slides FOR ALL TO authenticated
  USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());

DROP TRIGGER IF EXISTS worker_slides_updated ON public.worker_slides;
CREATE TRIGGER worker_slides_updated BEFORE UPDATE ON public.worker_slides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
