-- SuperIT Apps — Undian (Doorprize)
-- Jalankan di SQL Editor Supabase.

-- 1) Event undian (satu baris = satu acara undian).
CREATE TABLE IF NOT EXISTS public.undian_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_acara text NOT NULL DEFAULT 'Undian Doorprize',
  nama_kantor text NOT NULL DEFAULT 'BRI BO Pringsewu',
  tanggal date NOT NULL DEFAULT current_date,
  theme_color text NOT NULL DEFAULT '#1d6eb7',
  logo_url text,
  bg_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Kategori undian per event.
CREATE TABLE IF NOT EXISTS public.undian_kategori (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.undian_events(id) ON DELETE CASCADE,
  nama text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS undian_kategori_event_idx ON public.undian_kategori (event_id);

-- 3) Hadiah per kategori.
CREATE TABLE IF NOT EXISTS public.undian_hadiah (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.undian_events(id) ON DELETE CASCADE,
  kategori_id uuid REFERENCES public.undian_kategori(id) ON DELETE CASCADE,
  nama text NOT NULL,
  jumlah integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS undian_hadiah_event_idx ON public.undian_hadiah (event_id);

-- 4) Peserta undian.
CREATE TABLE IF NOT EXISTS public.undian_peserta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.undian_events(id) ON DELETE CASCADE,
  nip text NOT NULL,
  nama text NOT NULL,
  unit_kerja text NOT NULL DEFAULT '-',
  kategori_akses text NOT NULL DEFAULT 'all',
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS undian_peserta_event_idx ON public.undian_peserta (event_id, nip);

-- 5) Pemenang.
CREATE TABLE IF NOT EXISTS public.undian_pemenang (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.undian_events(id) ON DELETE CASCADE,
  peserta_id uuid,
  nama_peserta text NOT NULL,
  nip text NOT NULL,
  unit_kerja text NOT NULL DEFAULT '-',
  kategori_nama text NOT NULL DEFAULT '-',
  hadiah_nama text NOT NULL DEFAULT '-',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS undian_pemenang_event_idx ON public.undian_pemenang (event_id);

-- 6) Semua akses lewat server function (service role); klien tidak langsung.
GRANT ALL ON public.undian_events TO service_role;
GRANT ALL ON public.undian_kategori TO service_role;
GRANT ALL ON public.undian_hadiah TO service_role;
GRANT ALL ON public.undian_peserta TO service_role;
GRANT ALL ON public.undian_pemenang TO service_role;

ALTER TABLE public.undian_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.undian_kategori ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.undian_hadiah ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.undian_peserta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.undian_pemenang ENABLE ROW LEVEL SECURITY;
