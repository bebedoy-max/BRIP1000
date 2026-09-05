-- ROLES
CREATE TYPE public.app_role AS ENUM ('superadmin','it_admin','event_admin','employee');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  nama text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_it_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('it_admin','superadmin'));
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superadmin');
$$;

CREATE OR REPLACE FUNCTION public.is_event_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('event_admin','superadmin'));
$$;

CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_superadmin());
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_superadmin());
CREATE POLICY "profiles insert self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "roles read own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_superadmin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nama, username)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nama', NEW.email), split_part(NEW.email,'@',1))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- UKERS
CREATE TABLE public.ukers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode_uker text NOT NULL UNIQUE,
  nama_uker text NOT NULL,
  tipe text,
  alamat text,
  latitude numeric,
  longitude numeric,
  ip_address text,
  pic_it text,
  status_aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT (id,kode_uker,nama_uker,tipe,alamat,latitude,longitude,pic_it,status_aktif,created_at,updated_at) ON public.ukers TO anon;
GRANT SELECT (id,kode_uker,nama_uker,tipe,alamat,latitude,longitude,pic_it,status_aktif,created_at,updated_at) ON public.ukers TO authenticated;
GRANT ALL ON public.ukers TO service_role;
ALTER TABLE public.ukers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ukers public read" ON public.ukers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "ukers admin write" ON public.ukers FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
CREATE TRIGGER ukers_updated BEFORE UPDATE ON public.ukers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- IT admin needs full column access incl. ip_address
GRANT INSERT, UPDATE, DELETE ON public.ukers TO authenticated;

CREATE OR REPLACE FUNCTION public.get_uker_ips()
RETURNS TABLE (id uuid, kode_uker text, nama_uker text, ip_address text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_it_admin() THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  RETURN QUERY SELECT u.id, u.kode_uker, u.nama_uker, u.ip_address FROM public.ukers u ORDER BY u.kode_uker;
END; $$;
REVOKE ALL ON FUNCTION public.get_uker_ips() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_uker_ips() TO authenticated;

-- EMPLOYEES
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nip text NOT NULL UNIQUE,
  nama text NOT NULL,
  jabatan text,
  uker_id uuid REFERENCES public.ukers(id) ON DELETE SET NULL,
  email text,
  no_hp text,
  foto_url text,
  status_aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT (id,nip,nama,jabatan,uker_id,status_aktif,foto_url,created_at,updated_at) ON public.employees TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees read" ON public.employees FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "employees admin write" ON public.employees FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
CREATE TRIGGER employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ATM
CREATE TABLE public.atm_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode_atm text NOT NULL UNIQUE,
  uker_id uuid REFERENCES public.ukers(id) ON DELETE SET NULL,
  lokasi text,
  status text NOT NULL DEFAULT 'aktif',
  tanggal_pasang date,
  tanggal_maintenance_terakhir date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.atm_machines TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atm_machines TO authenticated;
GRANT ALL ON public.atm_machines TO service_role;
ALTER TABLE public.atm_machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "atm read" ON public.atm_machines FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "atm admin write" ON public.atm_machines FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
CREATE TRIGGER atm_updated BEFORE UPDATE ON public.atm_machines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- EDC
CREATE TABLE public.edc_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode_edc text NOT NULL UNIQUE,
  uker_id uuid REFERENCES public.ukers(id) ON DELETE SET NULL,
  merchant text,
  lokasi text,
  status text NOT NULL DEFAULT 'aktif',
  tanggal_pasang date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.edc_machines TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edc_machines TO authenticated;
GRANT ALL ON public.edc_machines TO service_role;
ALTER TABLE public.edc_machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "edc read" ON public.edc_machines FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "edc admin write" ON public.edc_machines FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
CREATE TRIGGER edc_updated BEFORE UPDATE ON public.edc_machines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- EVENTS
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_event text NOT NULL,
  deskripsi text,
  tanggal_mulai timestamptz,
  tanggal_selesai timestamptz,
  qr_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events public read active" ON public.events FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "events auth read" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "events admin write" ON public.events FOR ALL TO authenticated USING (public.is_event_admin()) WITH CHECK (public.is_event_admin());
CREATE TRIGGER events_updated BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ATTENDANCES
CREATE TABLE public.attendances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  nama_manual text,
  uker_manual text,
  waktu_hadir timestamptz NOT NULL DEFAULT now(),
  catatan text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.attendances TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendances TO authenticated;
GRANT ALL ON public.attendances TO service_role;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance public insert" ON public.attendances FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.is_active = true));
CREATE POLICY "attendance auth read" ON public.attendances FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance admin write" ON public.attendances FOR ALL TO authenticated USING (public.is_event_admin()) WITH CHECK (public.is_event_admin());

-- IT AREA
CREATE TABLE public.it_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_tool text NOT NULL,
  kategori text,
  link_download text,
  versi text,
  catatan text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.it_tools TO authenticated;
GRANT ALL ON public.it_tools TO service_role;
ALTER TABLE public.it_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "it_tools restricted" ON public.it_tools FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
CREATE TRIGGER it_tools_updated BEFORE UPDATE ON public.it_tools FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  judul text NOT NULL,
  kategori text,
  konten text,
  file_url text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorials TO authenticated;
GRANT ALL ON public.tutorials TO service_role;
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tutorials restricted" ON public.tutorials FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
CREATE TRIGGER tutorials_updated BEFORE UPDATE ON public.tutorials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  judul text NOT NULL,
  file_url text,
  kategori text,
  uker_id uuid REFERENCES public.ukers(id) ON DELETE SET NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photos TO authenticated;
GRANT ALL ON public.photos TO service_role;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photos restricted" ON public.photos FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
CREATE TRIGGER photos_updated BEFORE UPDATE ON public.photos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TICKETS
CREATE TABLE public.it_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  judul text NOT NULL,
  deskripsi text,
  uker_id uuid REFERENCES public.ukers(id) ON DELETE SET NULL,
  reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.it_tickets TO authenticated;
GRANT ALL ON public.it_tickets TO service_role;
ALTER TABLE public.it_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets read own or it" ON public.it_tickets FOR SELECT TO authenticated USING (reported_by = auth.uid() OR public.is_it_admin());
CREATE POLICY "tickets insert" ON public.it_tickets FOR INSERT TO authenticated WITH CHECK (reported_by = auth.uid());
CREATE POLICY "tickets it manage" ON public.it_tickets FOR UPDATE TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
CREATE POLICY "tickets it delete" ON public.it_tickets FOR DELETE TO authenticated USING (public.is_it_admin());
CREATE TRIGGER tickets_updated BEFORE UPDATE ON public.it_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ASSETS
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_aset text NOT NULL,
  kategori text,
  uker_id uuid REFERENCES public.ukers(id) ON DELETE SET NULL,
  serial_number text,
  tanggal_beli date,
  status text NOT NULL DEFAULT 'baik',
  catatan_perbaikan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets restricted" ON public.assets FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
CREATE TRIGGER assets_updated BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit superadmin read" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_superadmin());

CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN rid := OLD.id; ELSE rid := NEW.id; END IF;
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_value, new_value)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, rid,
          CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
          CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER audit_ukers AFTER INSERT OR UPDATE OR DELETE ON public.ukers FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();
CREATE TRIGGER audit_employees AFTER INSERT OR UPDATE OR DELETE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();
CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

-- (Tanpa data contoh: hanya struktur & fungsi)
