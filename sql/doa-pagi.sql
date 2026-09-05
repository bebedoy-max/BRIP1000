-- SuperIT Apps — Absensi, Doa & Briefing Pagi
-- Jalankan di SQL Editor Supabase.

-- 1) Master bagian (per unit kerja) beserta daftar pekerjanya.
CREATE TABLE IF NOT EXISTS public.doa_pagi_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uker_id uuid REFERENCES public.ukers(id) ON DELETE CASCADE,
  uker_nama text NOT NULL DEFAULT '',
  urutan integer NOT NULL DEFAULT 1,
  nama text NOT NULL,
  deskripsi text,
  keterangan text,
  pekerja text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS doa_pagi_sections_uker_idx
  ON public.doa_pagi_sections (uker_id, urutan);

-- 2) Data absensi harian per pekerja pada satu bagian.
CREATE TABLE IF NOT EXISTS public.doa_pagi_absensi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.doa_pagi_sections(id) ON DELETE CASCADE,
  pekerja text NOT NULL,
  tanggal date NOT NULL DEFAULT current_date,
  qris text,
  kehadiran text NOT NULL DEFAULT 'Hadir',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_id, pekerja, tanggal)
);

CREATE INDEX IF NOT EXISTS doa_pagi_absensi_tanggal_idx
  ON public.doa_pagi_absensi (tanggal, section_id);

-- 3) Semua akses lewat server function (service role).
GRANT ALL ON public.doa_pagi_sections TO service_role;
GRANT ALL ON public.doa_pagi_absensi TO service_role;

ALTER TABLE public.doa_pagi_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doa_pagi_absensi ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS doa_pagi_sections_updated ON public.doa_pagi_sections;
CREATE TRIGGER doa_pagi_sections_updated BEFORE UPDATE ON public.doa_pagi_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
