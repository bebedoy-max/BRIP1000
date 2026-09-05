-- Tutorial / Panduan Penggunaan Web App
-- Struktur lama tabel tutorials dihapus total dan diganti dengan struktur
-- panduan per-topik (topic_key mengikuti key menu aplikasi), sehingga saat ada
-- menu/fitur baru cukup menambah barisnya tanpa mengubah skema.

DROP TABLE IF EXISTS public.tutorials CASCADE;

CREATE TABLE public.tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Kunci topik: sama dengan key menu (mis. 'tools', 'plugin', 'buku-harian')
  -- atau key topik tambahan (mis. 'tools-absensi', 'umum').
  topic_key text NOT NULL UNIQUE,
  judul text NOT NULL,
  ringkasan text,
  -- Isi panduan (teks bebas, mendukung baris '- ' untuk poin dan '1. ' untuk langkah).
  konten text,
  urutan integer NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorials TO authenticated;
GRANT ALL ON public.tutorials TO service_role;

ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tutorials restricted" ON public.tutorials;
DROP POLICY IF EXISTS "tutorials read" ON public.tutorials;
DROP POLICY IF EXISTS "tutorials admin write" ON public.tutorials;
-- Semua pengguna login boleh membaca panduan; hanya IT admin yang boleh menulis.
CREATE POLICY "tutorials read" ON public.tutorials FOR SELECT TO authenticated USING (true);
CREATE POLICY "tutorials admin write" ON public.tutorials FOR ALL TO authenticated
  USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());

DROP TRIGGER IF EXISTS tutorials_updated ON public.tutorials;
CREATE TRIGGER tutorials_updated BEFORE UPDATE ON public.tutorials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
