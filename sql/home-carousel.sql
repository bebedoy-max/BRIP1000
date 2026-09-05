-- Pengaturan konten kolom carousel dashboard umum + gambar untuk Project IT.

-- 1) Kolom gambar pada Project IT (URL gambar atau ID file Google Drive).
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS foto_url text;

-- 2) Tabel sumber konten carousel.
CREATE TABLE IF NOT EXISTS public.carousel_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sumber text NOT NULL UNIQUE,
  aktif boolean NOT NULL DEFAULT true,
  jumlah integer NOT NULL DEFAULT 5,
  urutan integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.carousel_sources TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carousel_sources TO authenticated;
GRANT ALL ON public.carousel_sources TO service_role;

ALTER TABLE public.carousel_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "carousel_sources read" ON public.carousel_sources;
DROP POLICY IF EXISTS "carousel_sources admin write" ON public.carousel_sources;
CREATE POLICY "carousel_sources read" ON public.carousel_sources FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "carousel_sources admin write" ON public.carousel_sources FOR ALL TO authenticated
  USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());

DROP TRIGGER IF EXISTS carousel_sources_updated ON public.carousel_sources;
CREATE TRIGGER carousel_sources_updated BEFORE UPDATE ON public.carousel_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Default: 5 konten terakhir dari tiap bagian.
INSERT INTO public.carousel_sources (sumber, aktif, jumlah, urutan) VALUES
  ('event', true, 5, 1),
  ('project', true, 5, 2),
  ('diary', true, 5, 3)
ON CONFLICT (sumber) DO NOTHING;
