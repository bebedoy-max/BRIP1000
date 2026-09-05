-- Menghapus modul Inventaris Aset beserta datanya.
-- Jalankan di SQL Editor database aplikasi.

delete from public.page_access where page_key = 'aset';
drop table if exists public.assets cascade;
