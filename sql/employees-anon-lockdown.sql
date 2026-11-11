-- Kunci data sensitif pekerja dari pengunjung umum (anon) di level DATABASE.
-- UI sudah menyembunyikan detail pekerja bagi yang belum login, tetapi siapa pun
-- tetap bisa memanggil API Supabase langsung selama role `anon` punya akses SELECT.
-- Jalankan di Supabase SQL Editor SETELAH memastikan tidak ada fitur publik lain yang
-- membaca kolom berikut sebagai anon.
--
-- Kolom yang masih dibutuhkan halaman publik (slide pekerja, Pemimpin Cabang,
-- daftar pekerja uker): id, nama, n (foto), jabatan, jabatan_id, uker_id, foto_url.
-- Kolom sensitif yang ditutup: personal_number, no_telepon, profil.

REVOKE SELECT ON public.employees FROM anon;

GRANT SELECT (id, nama, n, jabatan, jabatan_id, uker_id, foto_url, status_aktif, created_at, updated_at)
  ON public.employees TO anon;

-- Cek hasilnya (kolom yang boleh dibaca anon):
-- SELECT column_name FROM information_schema.column_privileges
--  WHERE table_name = 'employees' AND grantee = 'anon' AND privilege_type = 'SELECT';
