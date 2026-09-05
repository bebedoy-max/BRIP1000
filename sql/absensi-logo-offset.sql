-- Posisi vertikal logo pojok kiri/kanan pada form absensi.
ALTER TABLE public.absensi_events
  ADD COLUMN IF NOT EXISTS logo_left_top integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS logo_right_top integer NOT NULL DEFAULT 14;
