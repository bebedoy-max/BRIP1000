-- ============================================================
-- Menu "Tiket IT" — alur baru
--   • Manajemen  : membuat tiket (judul, deskripsi, foto opsional)
--   • Petugas IT : mengambil (handover) tiket & mengubah status
-- Jalankan di SQL Editor Supabase (idempoten).
-- ============================================================

-- Kolom tambahan
ALTER TABLE public.it_tickets
  ADD COLUMN IF NOT EXISTS foto_url text,
  ADD COLUMN IF NOT EXISTS reporter_nama text,
  ADD COLUMN IF NOT EXISTS reporter_uker text,
  ADD COLUMN IF NOT EXISTS handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS handled_at timestamptz,
  ADD COLUMN IF NOT EXISTS catatan_tindak_lanjut text;

ALTER TABLE public.it_tickets ALTER COLUMN reported_by SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS it_tickets_status_idx ON public.it_tickets (status, created_at DESC);

-- Normalisasi status lama
UPDATE public.it_tickets SET status = 'done'
 WHERE status IN ('resolved', 'closed');

-- ------------------------------------------------------------
-- Identitas pembuat tiket diisi otomatis dari akun yang login
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.it_tickets_fill_reporter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp record;
BEGIN
  NEW.reported_by := COALESCE(NEW.reported_by, auth.uid());

  SELECT e.nama, e.uker_id, u.nama_uker, p.nama AS profil_nama, p.email
    INTO emp
    FROM public.profiles p
    LEFT JOIN public.employees e ON e.personal_number = p.personal_number
    LEFT JOIN public.ukers u ON u.id = e.uker_id
   WHERE p.id = NEW.reported_by;

  NEW.reporter_nama := COALESCE(NULLIF(btrim(emp.nama), ''), NULLIF(btrim(emp.profil_nama), ''), emp.email);
  NEW.reporter_uker := emp.nama_uker;
  NEW.uker_id := COALESCE(NEW.uker_id, emp.uker_id);
  NEW.status := COALESCE(NULLIF(NEW.status, ''), 'open');
  NEW.created_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS it_tickets_reporter ON public.it_tickets;
CREATE TRIGGER it_tickets_reporter BEFORE INSERT ON public.it_tickets
  FOR EACH ROW EXECUTE FUNCTION public.it_tickets_fill_reporter();

-- Isi identitas untuk data lama yang masih kosong
UPDATE public.it_tickets t
   SET reporter_nama = COALESCE(t.reporter_nama, NULLIF(btrim(e.nama), ''), p.nama, p.email),
       reporter_uker = COALESCE(t.reporter_uker, u.nama_uker)
  FROM public.profiles p
  LEFT JOIN public.employees e ON e.personal_number = p.personal_number
  LEFT JOIN public.ukers u ON u.id = e.uker_id
 WHERE p.id = t.reported_by AND t.reporter_nama IS NULL;

-- ------------------------------------------------------------
-- RLS: buat = manajemen, tindak lanjut = petugas IT
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "tickets read own or it" ON public.it_tickets;
DROP POLICY IF EXISTS "tickets insert" ON public.it_tickets;
DROP POLICY IF EXISTS "tickets it manage" ON public.it_tickets;
DROP POLICY IF EXISTS "tickets it delete" ON public.it_tickets;
DROP POLICY IF EXISTS "tickets read" ON public.it_tickets;
DROP POLICY IF EXISTS "tickets insert manajemen" ON public.it_tickets;
DROP POLICY IF EXISTS "tickets update it" ON public.it_tickets;
DROP POLICY IF EXISTS "tickets delete" ON public.it_tickets;

-- Pembuat tiket, petugas IT, dan manajemen boleh membaca.
CREATE POLICY "tickets read" ON public.it_tickets FOR SELECT TO authenticated
  USING (reported_by = auth.uid() OR public.is_it_admin() OR public.is_manajemen());

-- Hanya manajemen (termasuk Super Admin) yang boleh membuka tiket.
CREATE POLICY "tickets insert manajemen" ON public.it_tickets FOR INSERT TO authenticated
  WITH CHECK (reported_by = auth.uid() AND public.is_manajemen());

-- Hanya petugas IT yang boleh menindaklanjuti / mengubah status.
CREATE POLICY "tickets update it" ON public.it_tickets FOR UPDATE TO authenticated
  USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());

-- Hapus: petugas IT, atau pembuat selama tiket masih berstatus open.
CREATE POLICY "tickets delete" ON public.it_tickets FOR DELETE TO authenticated
  USING (public.is_it_admin() OR (reported_by = auth.uid() AND status = 'open'));

-- ------------------------------------------------------------
-- Storage bucket foto tiket
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-photos', 'ticket-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "ticket photos read" ON storage.objects;
DROP POLICY IF EXISTS "ticket photos write" ON storage.objects;
CREATE POLICY "ticket photos read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'ticket-photos');
CREATE POLICY "ticket photos write" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'ticket-photos')
  WITH CHECK (bucket_id = 'ticket-photos');
