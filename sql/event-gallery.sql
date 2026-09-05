-- Menu "Event" (sebelumnya Galeri Foto).
-- Jalankan di SQL Editor database aplikasi.

ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS deskripsi text;
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS tanggal date;
ALTER TABLE public.photos ALTER COLUMN judul SET NOT NULL;

-- Foto event disimpan di entity_photos dengan entity_type = 'event'
-- dan entity_id = photos.id (folder Drive: <root>/Foto Event/<nama event>).
CREATE INDEX IF NOT EXISTS entity_photos_event_idx
  ON public.entity_photos (entity_type, entity_id)
  WHERE entity_type = 'event';
