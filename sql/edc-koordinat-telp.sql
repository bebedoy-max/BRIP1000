-- Tambahan kolom Mesin EDC: koordinat (longitude, latitude) & nomor telepon
alter table public.edc_machines
  add column if not exists koordinat text,
  add column if not exists no_telp text;
