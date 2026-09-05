-- ============================================================
-- Tiket IT — penyelesaian + approval pembuat tiket
--   open → in_progress → finish (menunggu approval) → done
-- Jalankan di SQL Editor Supabase (idempoten).
-- ============================================================

ALTER TABLE public.it_tickets
  ADD COLUMN IF NOT EXISTS solusi text,
  ADD COLUMN IF NOT EXISTS foto_solusi_url text,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- ------------------------------------------------------------
-- Approval oleh pembuat tiket → status Done + catat kegiatan harian petugas IT
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_ticket(_ticket_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record;
BEGIN
  SELECT * INTO t FROM public.it_tickets WHERE id = _ticket_id FOR UPDATE;
  IF t IS NULL THEN RAISE EXCEPTION 'Tiket tidak ditemukan.'; END IF;
  IF t.reported_by <> auth.uid() AND NOT public.is_manajemen() THEN
    RAISE EXCEPTION 'Hanya pembuat tiket yang dapat menyetujui penyelesaian.';
  END IF;
  IF t.status <> 'finish' THEN
    RAISE EXCEPTION 'Tiket belum ditandai selesai oleh petugas IT.';
  END IF;

  UPDATE public.it_tickets
     SET status = 'done',
         approved_by = auth.uid(),
         approved_at = now(),
         resolved_at = COALESCE(resolved_at, now())
   WHERE id = _ticket_id;

  IF t.handled_by IS NOT NULL THEN
    INSERT INTO public.it_diary_logs (user_id, tanggal, nama_kegiatan, detil_problem, solusi, status, keterangan)
    VALUES (
      t.handled_by,
      COALESCE(t.finished_at::date, current_date),
      t.judul,
      t.deskripsi,
      t.solusi,
      'Done',
      'Dari Tiket IT — disetujui ' || COALESCE(t.reporter_nama, 'pembuat tiket')
    );
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.approve_ticket(uuid) TO authenticated;

-- Tolak hasil (kembalikan ke In Progress)
CREATE OR REPLACE FUNCTION public.reject_ticket(_ticket_id uuid, _alasan text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record;
BEGIN
  SELECT * INTO t FROM public.it_tickets WHERE id = _ticket_id FOR UPDATE;
  IF t IS NULL THEN RAISE EXCEPTION 'Tiket tidak ditemukan.'; END IF;
  IF t.reported_by <> auth.uid() AND NOT public.is_manajemen() THEN
    RAISE EXCEPTION 'Hanya pembuat tiket yang dapat menolak penyelesaian.';
  END IF;
  UPDATE public.it_tickets
     SET status = 'in_progress',
         finished_at = NULL,
         resolved_at = NULL,
         catatan_tindak_lanjut = COALESCE(_alasan, catatan_tindak_lanjut)
   WHERE id = _ticket_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.reject_ticket(uuid, text) TO authenticated;
