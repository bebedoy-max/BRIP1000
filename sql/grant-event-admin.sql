-- Memberi role khusus pengelola event ke akun companion app bila akun tersebut
-- belum memiliki role it_admin, event_admin, atau superadmin.
--
-- Cara pakai: buka Supabase Dashboard > SQL Editor, ganti email di bawah dengan
-- email akun yang dipakai login di companion app, lalu Run.

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'event_admin'::public.app_role
FROM auth.users u
WHERE u.email = 'ganti-dengan-email-anda@contoh.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Cek hasilnya:
SELECT u.email, r.role
FROM public.user_roles r
JOIN auth.users u ON u.id = r.user_id
ORDER BY u.email;

-- Catatan: policy terbaru juga menerima it_admin. Jalankan event-admin-access.sql
-- terlebih dahulu agar fungsi RLS database ikut diperbarui.
