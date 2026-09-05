ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_online timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity text,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Catat kehadiran / aktivitas pengguna yang sedang login
CREATE OR REPLACE FUNCTION public.touch_presence(p_activity text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.profiles
     SET last_online = now(),
         last_activity = COALESCE(p_activity, last_activity),
         last_activity_at = CASE WHEN p_activity IS NULL THEN last_activity_at ELSE now() END
   WHERE id = auth.uid();
END; $$;

GRANT EXECUTE ON FUNCTION public.touch_presence(text) TO authenticated;

-- Daftar pengguna untuk admin
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  id uuid,
  email text,
  nama text,
  username text,
  is_active boolean,
  is_blocked boolean,
  roles text[],
  last_online timestamptz,
  last_activity text,
  last_activity_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_it_admin() THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  RETURN QUERY
  SELECT p.id, p.email, p.nama, p.username, p.is_active, p.is_blocked,
         COALESCE(ARRAY(SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = p.id), '{}'::text[]),
         p.last_online, p.last_activity, p.last_activity_at, p.created_at
    FROM public.profiles p
   ORDER BY p.last_online DESC NULLS LAST, p.created_at DESC;
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- Blokir / buka blokir
CREATE OR REPLACE FUNCTION public.admin_set_blocked(p_user_id uuid, p_blocked boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_it_admin() THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'Tidak dapat memblokir akun sendiri'; END IF;
  IF public.has_role(p_user_id, 'superadmin') AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;
  UPDATE public.profiles
     SET is_blocked = p_blocked, is_active = NOT p_blocked
   WHERE id = p_user_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_set_blocked(uuid, boolean) TO authenticated;

-- Hapus pengguna (super admin)
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'Tidak dapat menghapus akun sendiri'; END IF;
  DELETE FROM auth.users WHERE id = p_user_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- Ubah kata sandi pengguna (super admin)
CREATE OR REPLACE FUNCTION public.admin_set_password(p_user_id uuid, p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  IF length(COALESCE(p_password, '')) < 8 THEN RAISE EXCEPTION 'Kata sandi minimal 8 karakter'; END IF;
  UPDATE auth.users
     SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   WHERE id = p_user_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_set_password(uuid, text) TO authenticated;