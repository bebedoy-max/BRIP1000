-- Lokasi acara vote (dipakai sebagai nama lokasi pada QR code link voting).
ALTER TABLE public.vote_events
  ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT '';
