-- Tambah kolom foto profil pekerja (dipakai menu Data Pekerja > Foto Profil)
alter table public.employees
  add column if not exists n text;
