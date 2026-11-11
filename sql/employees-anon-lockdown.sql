-- Kunci data sensitif pekerja dari pengunjung umum (anon) di level DATABASE.
-- Aman dijalankan ulang. Tidak menebak nama kolom: daftar kolom diambil dari tabel
-- yang sebenarnya, lalu anon hanya diberi SELECT pada kolom NON-sensitif.
--
-- Kolom yang ditutup untuk anon: personal_number, no_telepon, profil.
-- Kolom lain (nama, foto, jabatan_id, uker_id, dst.) tetap terbaca sehingga halaman
-- publik (slide pekerja, Pemimpin Cabang, daftar pekerja uker) tidak terganggu.
-- Pengguna yang login (role authenticated) tidak berubah.

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'employees'
     AND column_name NOT IN ('personal_number', 'no_telepon', 'profil');

  IF cols IS NULL THEN
    RAISE EXCEPTION 'Tabel public.employees tidak ditemukan';
  END IF;

  EXECUTE 'REVOKE ALL ON public.employees FROM anon';
  EXECUTE format('GRANT SELECT (%s) ON public.employees TO anon', cols);
END
$$;

-- Cek hasil: kolom yang boleh dibaca anon (personal_number, no_telepon, profil TIDAK boleh muncul)
SELECT column_name
  FROM information_schema.column_privileges
 WHERE table_schema = 'public'
   AND table_name = 'employees'
   AND grantee = 'anon'
   AND privilege_type = 'SELECT'
 ORDER BY column_name;

-- Untuk membatalkan:
-- GRANT SELECT ON public.employees TO anon;
