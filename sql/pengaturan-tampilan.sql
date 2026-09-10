-- Pengaturan Halaman > Tampilan (tema warna & font global)
-- Satu baris saja (id = 1) yang menyimpan tema aktif untuk seluruh web app.

CREATE TABLE IF NOT EXISTS public.app_appearance (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  theme_key text NOT NULL DEFAULT 'biru',
  font_key text NOT NULL DEFAULT 'nasalization',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Pengunjung umum juga perlu membaca tema agar dashboard publik ikut berubah.
GRANT SELECT ON public.app_appearance TO anon;
GRANT SELECT, INSERT, UPDATE ON public.app_appearance TO authenticated;
GRANT ALL ON public.app_appearance TO service_role;

ALTER TABLE public.app_appearance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appearance read" ON public.app_appearance;
DROP POLICY IF EXISTS "appearance superadmin write" ON public.app_appearance;

CREATE POLICY "appearance read" ON public.app_appearance FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "appearance superadmin write" ON public.app_appearance FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP TRIGGER IF EXISTS app_appearance_updated ON public.app_appearance;
CREATE TRIGGER app_appearance_updated BEFORE UPDATE ON public.app_appearance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.app_appearance (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
