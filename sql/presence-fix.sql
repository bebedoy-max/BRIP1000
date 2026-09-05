-- Jalankan di SQL Editor Supabase bila kolom Status / Last Online / Last Activity kosong.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_online timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity text,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

CREATE OR REPLACE FUNCTION public.touch_presence(p_activity text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.profiles
     SET last_online = now(),
         last_activity = COALESCE(p_activity, last_activity),
         last_activity_at = CASE WHEN p_activity IS NULL THEN last_activity_at ELSE now() END
   WHERE id = auth.uid();
END; $$;

DROP FUNCTION IF EXISTS public.admin_list_users();
CREATE FUNCTION public.admin_list_users()
RETURNS TABLE(
  id uuid, email text, nama text, username text, is_active boolean, is_blocked boolean,
  roles text[], last_online timestamptz, last_activity text, last_activity_at timestamptz, created_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_it_admin() THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  RETURN QUERY
  SELECT p.id, p.email::text, p.nama::text, p.username::text,
         COALESCE(p.is_active, true), COALESCE(p.is_blocked, false),
         COALESCE(ARRAY(SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = p.id), '{}'::text[]),
         p.last_online, p.last_activity::text, p.last_activity_at, p.created_at
    FROM public.profiles p
   ORDER BY p.last_online DESC NULLS LAST, p.created_at DESC;
END; $$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.touch_presence(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_presence(text) TO authenticated;
