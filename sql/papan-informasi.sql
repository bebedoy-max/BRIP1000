-- Papan Informasi Digital: slide informasi (teks / gambar / video) yang
-- diinput admin dan tampil di atas kolom berita pada dashboard.

CREATE TABLE IF NOT EXISTS public.info_board_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  judul text NOT NULL,
  -- 'text' | 'image' | 'video'
  jenis text NOT NULL DEFAULT 'text',
  -- Isi teks (untuk jenis text, atau keterangan pada gambar/video).
  isi text,
  -- URL gambar/video atau ID file Google Drive (untuk jenis image/video).
  media_url text,
  -- Lama tampil (detik) untuk teks & gambar. Video mengikuti durasi videonya.
  durasi integer NOT NULL DEFAULT 8,
  -- Efek transisi: fade | slide | zoom | flip | none
  transisi text NOT NULL DEFAULT 'fade',
  aktif boolean NOT NULL DEFAULT true,
  urutan integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.info_board_slides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.info_board_slides TO authenticated;
GRANT ALL ON public.info_board_slides TO service_role;

ALTER TABLE public.info_board_slides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "info_board_slides read" ON public.info_board_slides;
DROP POLICY IF EXISTS "info_board_slides admin write" ON public.info_board_slides;
CREATE POLICY "info_board_slides read" ON public.info_board_slides FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "info_board_slides admin write" ON public.info_board_slides FOR ALL TO authenticated
  USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());

DROP TRIGGER IF EXISTS info_board_slides_updated ON public.info_board_slides;
CREATE TRIGGER info_board_slides_updated BEFORE UPDATE ON public.info_board_slides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
