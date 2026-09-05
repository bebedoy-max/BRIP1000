-- Menu "Buku Harian IT": catatan kegiatan harian petugas IT.
-- Setiap petugas hanya bisa menulis catatannya sendiri, manajemen bisa membaca semua.

CREATE TABLE IF NOT EXISTS public.it_diary_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  tanggal date NOT NULL DEFAULT current_date,
  nama_kegiatan text NOT NULL,
  detil_problem text,
  solusi text,
  status text NOT NULL DEFAULT 'In Progress',
  keterangan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS it_diary_logs_tanggal_idx ON public.it_diary_logs (tanggal DESC);
CREATE INDEX IF NOT EXISTS it_diary_logs_user_idx ON public.it_diary_logs (user_id, tanggal DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.it_diary_logs TO authenticated;
GRANT ALL ON public.it_diary_logs TO service_role;

ALTER TABLE public.it_diary_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diary read" ON public.it_diary_logs;
DROP POLICY IF EXISTS "diary insert own" ON public.it_diary_logs;
DROP POLICY IF EXISTS "diary update own" ON public.it_diary_logs;
DROP POLICY IF EXISTS "diary delete own" ON public.it_diary_logs;

-- Semua pengguna login (manajemen) boleh membaca.
CREATE POLICY "diary read" ON public.it_diary_logs FOR SELECT TO authenticated USING (true);
-- Hanya pemilik catatan yang boleh menulis/mengubah/menghapus.
CREATE POLICY "diary insert own" ON public.it_diary_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "diary update own" ON public.it_diary_logs FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "diary delete own" ON public.it_diary_logs FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'superadmin'));

DROP TRIGGER IF EXISTS it_diary_logs_updated ON public.it_diary_logs;
CREATE TRIGGER it_diary_logs_updated BEFORE UPDATE ON public.it_diary_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Konektivitas identitas: user ↔ Data Pekerja ↔ Kategori Jabatan
-- Profil hanya bisa dibaca sendiri (RLS), sehingga menu Buku Harian
-- memerlukan direktori ringkas lewat fungsi SECURITY DEFINER.
-- ============================================================
CREATE OR REPLACE FUNCTION public.app_directory()
RETURNS TABLE (
  user_id uuid,
  nama text,
  email text,
  personal_number text,
  jabatan text,
  uker text,
  akses_level text,
  is_petugas_it boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.id,
    COALESCE(NULLIF(btrim(e.nama), ''), NULLIF(btrim(p.nama), ''), p.email) AS nama,
    p.email,
    p.personal_number,
    j.nama_jabatan,
    u.nama_uker,
    CASE
      WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'superadmin')
        THEN 'Super Admin'
      WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'it_admin')
        THEN 'Admin'
      WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'event_admin')
        THEN 'Manajemen'
      ELSE 'Pekerja'
    END AS akses_level,
    EXISTS (
      SELECT 1 FROM public.user_roles r
       WHERE r.user_id = p.id AND r.role IN ('superadmin', 'it_admin')
    ) AS is_petugas_it
  FROM public.profiles p
  LEFT JOIN public.employees e ON e.personal_number = p.personal_number
  LEFT JOIN public.job_titles j ON j.id = e.jabatan_id
  LEFT JOIN public.ukers u ON u.id = e.uker_id
  WHERE COALESCE(p.is_blocked, false) = false;
$$;
GRANT EXECUTE ON FUNCTION public.app_directory() TO authenticated;

-- Manajemen (dan Super Admin) boleh membaca seluruh catatan;
-- petugas IT hanya catatan miliknya sendiri.
CREATE OR REPLACE FUNCTION public.is_manajemen()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
     WHERE r.user_id = auth.uid() AND r.role IN ('superadmin', 'event_admin')
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_manajemen() TO authenticated;

DROP POLICY IF EXISTS "diary read" ON public.it_diary_logs;
CREATE POLICY "diary read" ON public.it_diary_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_manajemen());
