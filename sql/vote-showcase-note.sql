-- Label dashboard pengumuman pemenang (bisa diedit admin).
ALTER TABLE public.vote_events
  ADD COLUMN IF NOT EXISTS showcase_note text NOT NULL DEFAULT 'Dashboard pengumuman pemenang';
