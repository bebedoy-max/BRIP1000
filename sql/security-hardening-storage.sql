-- Hardening storage (OPSIONAL, jalankan terpisah dan uji dulu).
-- Bucket yang bersifat "public" tetap melayani URL langsung (/object/public/...) tanpa
-- policy SELECT. Policy SELECT untuk anon hanya membuka kemampuan MENDAFTAR (list) isi
-- bucket lewat API storage. Menghapusnya mencegah orang menelusuri seluruh foto wajah
-- pekerja / foto tiket, tanpa merusak tampilan gambar yang sudah memakai URL publik.

-- Foto master wajah pekerja (data biometrik): tutup listing untuk anon & pengguna biasa.
DROP POLICY IF EXISTS "worker faces public read" ON storage.objects;

-- Foto tiket: listing hanya untuk pengguna login.
DROP POLICY IF EXISTS "ticket photos read" ON storage.objects;
CREATE POLICY "ticket photos read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'ticket-photos');

-- Cek bucket yang masih publik:
-- SELECT id, public FROM storage.buckets;
