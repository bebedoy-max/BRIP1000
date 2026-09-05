-- Pilihan konten spesifik per bagian untuk carousel dashboard umum.
ALTER TABLE public.carousel_sources ADD COLUMN IF NOT EXISTS item_ids text[] NOT NULL DEFAULT '{}';
