-- Perbaikan akses create/update/delete event dari SuperIT Event Uploader.
-- Aman dijalankan berulang kali di SQL Editor.
-- Role it_admin, event_admin, dan superadmin semuanya boleh mengelola event.

CREATE OR REPLACE FUNCTION public.is_event_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('it_admin', 'event_admin', 'superadmin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_event_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_event_admin() TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;

DROP POLICY IF EXISTS "events admin write" ON public.events;
CREATE POLICY "events admin write"
ON public.events
FOR ALL
TO authenticated
USING (public.is_event_admin())
WITH CHECK (public.is_event_admin());

-- Verifikasi akun dan role yang sekarang terdaftar.
SELECT u.email, r.role
FROM public.user_roles r
JOIN auth.users u ON u.id = r.user_id
WHERE r.role IN ('it_admin', 'event_admin', 'superadmin')
ORDER BY u.email, r.role;