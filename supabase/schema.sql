-- =====================================================================
-- BRI Branch Office Pringsewu — Skema database lengkap (PostgreSQL/Supabase)
-- IDEMPOTEN: aman dijalankan ulang berulang kali di SQL Editor Supabase.
-- Sudah termasuk: enum role, tabel, GRANT, RLS policy, fungsi keamanan,
-- trigger audit log, dan data awal (seed).
-- =====================================================================

-- ROLES (enum)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('superadmin','it_admin','event_admin','employee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
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

CREATE TABLE IF NOT EXISTS public.user_roles (
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
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('it_admin','event_admin','superadmin'));
$$;

DROP POLICY IF EXISTS "profiles self read" ON public.profiles;
DROP POLICY IF EXISTS "profiles self update" ON public.profiles;
DROP POLICY IF EXISTS "profiles insert self" ON public.profiles;
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_superadmin());
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_superadmin());
CREATE POLICY "profiles insert self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "roles read own" ON public.user_roles;
CREATE POLICY "roles read own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_superadmin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nama, username)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nama', NEW.email), split_part(NEW.email,'@',1))
  ON CONFLICT (id) DO NOTHING;
  -- User pertama yang registrasi otomatis menjadi superadmin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'superadmin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'superadmin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- UKERS
CREATE TABLE IF NOT EXISTS public.ukers (
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
DROP POLICY IF EXISTS "ukers public read" ON public.ukers;
DROP POLICY IF EXISTS "ukers admin write" ON public.ukers;
CREATE POLICY "ukers public read" ON public.ukers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "ukers admin write" ON public.ukers FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
DROP TRIGGER IF EXISTS ukers_updated ON public.ukers;
CREATE TRIGGER ukers_updated BEFORE UPDATE ON public.ukers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
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
-- Catatan: kolom lama (nip, jabatan, email, no_hp, foto_url, status_aktif) sudah
-- tidak dipakai lagi. Definisi di bawah hanya kolom dasar; kolom aktif lainnya
-- ditambahkan pada bagian "EMPLOYEES: kolom baru" di bawah. Data lama tetap utuh.
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  uker_id uuid REFERENCES public.ukers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "employees read" ON public.employees;
DROP POLICY IF EXISTS "employees admin write" ON public.employees;
CREATE POLICY "employees read" ON public.employees FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "employees admin write" ON public.employees FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
DROP TRIGGER IF EXISTS employees_updated ON public.employees;
CREATE TRIGGER employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ATM
CREATE TABLE IF NOT EXISTS public.atm_machines (
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
DROP POLICY IF EXISTS "atm read" ON public.atm_machines;
DROP POLICY IF EXISTS "atm admin write" ON public.atm_machines;
CREATE POLICY "atm read" ON public.atm_machines FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "atm admin write" ON public.atm_machines FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
DROP TRIGGER IF EXISTS atm_updated ON public.atm_machines;
CREATE TRIGGER atm_updated BEFORE UPDATE ON public.atm_machines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- EDC
CREATE TABLE IF NOT EXISTS public.edc_machines (
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
DROP POLICY IF EXISTS "edc read" ON public.edc_machines;
DROP POLICY IF EXISTS "edc admin write" ON public.edc_machines;
CREATE POLICY "edc read" ON public.edc_machines FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "edc admin write" ON public.edc_machines FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
DROP TRIGGER IF EXISTS edc_updated ON public.edc_machines;
CREATE TRIGGER edc_updated BEFORE UPDATE ON public.edc_machines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- QRIS MERCHANTS
CREATE TABLE IF NOT EXISTS public.qris_merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id text NOT NULL UNIQUE,
  nama_merchant text NOT NULL,
  alamat text,
  tipe text,
  bri_merchant text NOT NULL DEFAULT 'Ya',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.qris_merchants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qris_merchants TO authenticated;
GRANT ALL ON public.qris_merchants TO service_role;

ALTER TABLE public.qris_merchants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "qris read" ON public.qris_merchants;
DROP POLICY IF EXISTS "qris admin write" ON public.qris_merchants;
CREATE POLICY "qris read" ON public.qris_merchants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "qris admin write" ON public.qris_merchants FOR ALL TO authenticated
  USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());

DROP TRIGGER IF EXISTS qris_updated ON public.qris_merchants;
CREATE TRIGGER qris_updated BEFORE UPDATE ON public.qris_merchants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- EVENTS
CREATE TABLE IF NOT EXISTS public.events (
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
DROP POLICY IF EXISTS "events public read active" ON public.events;
DROP POLICY IF EXISTS "events auth read" ON public.events;
DROP POLICY IF EXISTS "events admin write" ON public.events;
CREATE POLICY "events public read active" ON public.events FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "events auth read" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "events admin write" ON public.events FOR ALL TO authenticated USING (public.is_event_admin()) WITH CHECK (public.is_event_admin());
DROP TRIGGER IF EXISTS events_updated ON public.events;
CREATE TRIGGER events_updated BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ATTENDANCES
CREATE TABLE IF NOT EXISTS public.attendances (
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
DROP POLICY IF EXISTS "attendance public insert" ON public.attendances;
DROP POLICY IF EXISTS "attendance auth read" ON public.attendances;
DROP POLICY IF EXISTS "attendance admin write" ON public.attendances;
CREATE POLICY "attendance public insert" ON public.attendances FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.is_active = true));
CREATE POLICY "attendance auth read" ON public.attendances FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance admin write" ON public.attendances FOR ALL TO authenticated USING (public.is_event_admin()) WITH CHECK (public.is_event_admin());

-- IT AREA
CREATE TABLE IF NOT EXISTS public.it_tools (
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
DROP POLICY IF EXISTS "it_tools restricted" ON public.it_tools;
CREATE POLICY "it_tools restricted" ON public.it_tools FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
DROP TRIGGER IF EXISTS it_tools_updated ON public.it_tools;
CREATE TRIGGER it_tools_updated BEFORE UPDATE ON public.it_tools FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.tutorials (
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
DROP POLICY IF EXISTS "tutorials restricted" ON public.tutorials;
CREATE POLICY "tutorials restricted" ON public.tutorials FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
DROP TRIGGER IF EXISTS tutorials_updated ON public.tutorials;
CREATE TRIGGER tutorials_updated BEFORE UPDATE ON public.tutorials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.photos (
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
DROP POLICY IF EXISTS "photos restricted" ON public.photos;
CREATE POLICY "photos restricted" ON public.photos FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
DROP TRIGGER IF EXISTS photos_updated ON public.photos;
CREATE TRIGGER photos_updated BEFORE UPDATE ON public.photos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TICKETS
CREATE TABLE IF NOT EXISTS public.it_tickets (
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
DROP POLICY IF EXISTS "tickets read own or it" ON public.it_tickets;
DROP POLICY IF EXISTS "tickets insert" ON public.it_tickets;
DROP POLICY IF EXISTS "tickets it manage" ON public.it_tickets;
DROP POLICY IF EXISTS "tickets it delete" ON public.it_tickets;
CREATE POLICY "tickets read own or it" ON public.it_tickets FOR SELECT TO authenticated USING (reported_by = auth.uid() OR public.is_it_admin());
CREATE POLICY "tickets insert" ON public.it_tickets FOR INSERT TO authenticated WITH CHECK (reported_by = auth.uid());
CREATE POLICY "tickets it manage" ON public.it_tickets FOR UPDATE TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
CREATE POLICY "tickets it delete" ON public.it_tickets FOR DELETE TO authenticated USING (public.is_it_admin());
DROP TRIGGER IF EXISTS tickets_updated ON public.it_tickets;
CREATE TRIGGER tickets_updated BEFORE UPDATE ON public.it_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ASSETS
CREATE TABLE IF NOT EXISTS public.assets (
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
DROP POLICY IF EXISTS "assets restricted" ON public.assets;
CREATE POLICY "assets restricted" ON public.assets FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
DROP TRIGGER IF EXISTS assets_updated ON public.assets;
CREATE TRIGGER assets_updated BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
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
DROP POLICY IF EXISTS "audit superadmin read" ON public.audit_logs;
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

DROP TRIGGER IF EXISTS audit_ukers ON public.ukers;
DROP TRIGGER IF EXISTS audit_employees ON public.employees;
DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_ukers AFTER INSERT OR UPDATE OR DELETE ON public.ukers FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();
CREATE TRIGGER audit_employees AFTER INSERT OR UPDATE OR DELETE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();
CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

-- (Data contoh dihapus: file ini hanya berisi perintah SQL/struktur)

-- ============================================================
-- Mesin ATM: penyesuaian kolom + Mesin CRM (jalankan di SQL Editor)
-- ============================================================
ALTER TABLE public.atm_machines
  ADD COLUMN IF NOT EXISTS tid text,
  ADD COLUMN IF NOT EXISTS titik_maps text,
  ADD COLUMN IF NOT EXISTS merk text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS tgl_live date;
ALTER TABLE public.atm_machines ALTER COLUMN kode_atm DROP NOT NULL;
UPDATE public.atm_machines SET tid = COALESCE(tid, regexp_replace(kode_atm, '\D', '', 'g'));

CREATE TABLE IF NOT EXISTS public.crm_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tid text,
  lokasi text,
  titik_maps text,
  merk text,
  ip_address text,
  tgl_live date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.crm_machines TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_machines TO authenticated;
GRANT ALL ON public.crm_machines TO service_role;
ALTER TABLE public.crm_machines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm read" ON public.crm_machines;
DROP POLICY IF EXISTS "crm admin write" ON public.crm_machines;
CREATE POLICY "crm read" ON public.crm_machines FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "crm admin write" ON public.crm_machines FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
DROP TRIGGER IF EXISTS crm_updated ON public.crm_machines;
CREATE TRIGGER crm_updated BEFORE UPDATE ON public.crm_machines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Penyesuaian: EDC, Unit Kerja, Data Pekerja, Kategori Jabatan
-- (jalankan di SQL Editor Supabase — idempoten)
-- ============================================================

-- EDC: kolom baru
ALTER TABLE public.edc_machines
  ADD COLUMN IF NOT EXISTS tid text,
  ADD COLUMN IF NOT EXISTS nama_merchant text,
  ADD COLUMN IF NOT EXISTS kategori_edc text,
  ADD COLUMN IF NOT EXISTS alamat text,
  ADD COLUMN IF NOT EXISTS keterangan text;
ALTER TABLE public.edc_machines ALTER COLUMN kode_edc DROP NOT NULL;
UPDATE public.edc_machines SET
  tid = COALESCE(tid, NULLIF(regexp_replace(COALESCE(kode_edc,''), '\D', '', 'g'), '')),
  nama_merchant = COALESCE(nama_merchant, merchant),
  alamat = COALESCE(alamat, lokasi);

-- UKERS: titik maps + akses kolom sensitif untuk pengguna terautentikasi
ALTER TABLE public.ukers ADD COLUMN IF NOT EXISTS titik_maps text;
UPDATE public.ukers SET titik_maps = COALESCE(titik_maps,
  CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL
       THEN latitude::text || ', ' || longitude::text END);
GRANT SELECT ON public.ukers TO authenticated;
GRANT SELECT (id,kode_uker,nama_uker,tipe,alamat,titik_maps,latitude,longitude,pic_it,status_aktif,created_at,updated_at) ON public.ukers TO anon;

-- KATEGORI JABATAN
CREATE TABLE IF NOT EXISTS public.job_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_jabatan text NOT NULL,
  tipe_unit_kerja text,
  akses_level text,
  keterangan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.job_titles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_titles TO authenticated;
GRANT ALL ON public.job_titles TO service_role;
ALTER TABLE public.job_titles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "job_titles read" ON public.job_titles;
DROP POLICY IF EXISTS "job_titles admin write" ON public.job_titles;
CREATE POLICY "job_titles read" ON public.job_titles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "job_titles admin write" ON public.job_titles FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
DROP TRIGGER IF EXISTS job_titles_updated ON public.job_titles;
CREATE TRIGGER job_titles_updated BEFORE UPDATE ON public.job_titles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- EMPLOYEES: kolom baru
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS personal_number text,
  ADD COLUMN IF NOT EXISTS jabatan_id uuid REFERENCES public.job_titles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status_karyawan text,
  ADD COLUMN IF NOT EXISTS no_telepon text;
-- Migrasi kolom lama -> kolom baru (hanya dijalankan bila kolom lama masih ada).
-- Tidak menimpa data yang sudah terisi.
DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'nip') THEN
    EXECUTE 'ALTER TABLE public.employees ALTER COLUMN nip DROP NOT NULL';
    EXECUTE $q$UPDATE public.employees
                 SET personal_number = lpad(regexp_replace(COALESCE(nip,''), '\D', '', 'g'), 8, '0')
               WHERE personal_number IS NULL AND COALESCE(nip,'') <> ''$q$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'no_hp') THEN
    EXECUTE $q$UPDATE public.employees
                 SET no_telepon = regexp_replace(COALESCE(no_hp,''), '\D', '', 'g')
               WHERE no_telepon IS NULL AND COALESCE(no_hp,'') <> ''$q$;
  END IF;
END $mig$;

-- Hak baca publik hanya untuk kolom yang benar-benar ada saat ini.
DO $grant$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ',') INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'employees'
    AND column_name = ANY (ARRAY['id','personal_number','nama','jabatan_id','uker_id',
                                 'status_karyawan','created_at','updated_at']);
  IF cols IS NOT NULL THEN
    EXECUTE format('GRANT SELECT (%s) ON public.employees TO anon', cols);
  END IF;
END $grant$;


-- ============================================================
-- Perangkat IT, Project IT, Update Progress Project
-- (jalankan di SQL Editor Supabase — idempoten)
-- ============================================================

-- Master data Jenis Perangkat
CREATE TABLE IF NOT EXISTS public.device_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jenis_perangkat text NOT NULL,
  deskripsi text,
  level_fungsi text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.device_types TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_types TO authenticated;
GRANT ALL ON public.device_types TO service_role;
ALTER TABLE public.device_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "device_types read" ON public.device_types;
DROP POLICY IF EXISTS "device_types admin write" ON public.device_types;
CREATE POLICY "device_types read" ON public.device_types FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "device_types admin write" ON public.device_types FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
DROP TRIGGER IF EXISTS device_types_updated ON public.device_types;
CREATE TRIGGER device_types_updated BEFORE UPDATE ON public.device_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE IF NOT EXISTS public.it_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_perangkat text NOT NULL,
  jenis_perangkat text,
  nama_pengguna text,
  ip_address text,
  kondisi_perangkat text,
  keterangan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.it_devices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.it_devices TO authenticated;
GRANT ALL ON public.it_devices TO service_role;
ALTER TABLE public.it_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "it_devices read" ON public.it_devices;
DROP POLICY IF EXISTS "it_devices admin write" ON public.it_devices;
CREATE POLICY "it_devices read" ON public.it_devices FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "it_devices admin write" ON public.it_devices FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
DROP TRIGGER IF EXISTS it_devices_updated ON public.it_devices;
CREATE TRIGGER it_devices_updated BEFORE UPDATE ON public.it_devices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Kolom baru Data Perangkat IT (aman, tidak menghapus data lama)
ALTER TABLE public.it_devices ADD COLUMN IF NOT EXISTS jenis_id uuid REFERENCES public.device_types(id) ON DELETE SET NULL;
ALTER TABLE public.it_devices ADD COLUMN IF NOT EXISTS pengguna_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.it_devices ADD COLUMN IF NOT EXISTS uker_id uuid REFERENCES public.ukers(id) ON DELETE SET NULL;
ALTER TABLE public.it_devices ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE public.it_devices ADD COLUMN IF NOT EXISTS merk text;
ALTER TABLE public.it_devices ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE public.it_devices ADD COLUMN IF NOT EXISTS processor text;
ALTER TABLE public.it_devices ADD COLUMN IF NOT EXISTS ram text;
ALTER TABLE public.it_devices ADD COLUMN IF NOT EXISTS storage_type text;

-- Migrasi data lama: jenis_perangkat (teks) -> master device_types
INSERT INTO public.device_types (jenis_perangkat)
SELECT DISTINCT btrim(d.jenis_perangkat)
FROM public.it_devices d
WHERE coalesce(btrim(d.jenis_perangkat), '') <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.device_types t
    WHERE lower(t.jenis_perangkat) = lower(btrim(d.jenis_perangkat))
  );

UPDATE public.it_devices d
SET jenis_id = t.id
FROM public.device_types t
WHERE d.jenis_id IS NULL
  AND lower(btrim(d.jenis_perangkat)) = lower(t.jenis_perangkat);

-- Migrasi data lama: nama_pengguna (teks) -> relasi ke data pekerja
UPDATE public.it_devices d
SET pengguna_id = e.id
FROM public.employees e
WHERE d.pengguna_id IS NULL
  AND lower(btrim(coalesce(d.nama_pengguna, ''))) = lower(btrim(e.nama));

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_project text NOT NULL,
  deskripsi text,
  parameter text,
  tanggal_mulai date,
  deadline date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Multi parameter pencapaian (ceklis) + target custom per item.
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS parameters text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS custom_items jsonb NOT NULL DEFAULT '[]'::jsonb;
-- Backfill dari kolom lama `parameter` tanpa mengubah data yang sudah terisi.
UPDATE public.projects
   SET parameters = CASE WHEN parameter = 'atm_crm' THEN ARRAY['atm','crm'] ELSE ARRAY[parameter] END
 WHERE parameter IS NOT NULL AND parameter <> '' AND coalesce(array_length(parameters, 1), 0) = 0;
GRANT SELECT ON public.projects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "projects read" ON public.projects;
DROP POLICY IF EXISTS "projects admin write" ON public.projects;
CREATE POLICY "projects read" ON public.projects FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "projects admin write" ON public.projects FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
DROP TRIGGER IF EXISTS projects_updated ON public.projects;
CREATE TRIGGER projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.project_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  item_label text,
  keterangan text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, item_id)
);
GRANT SELECT ON public.project_progress TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_progress TO authenticated;
GRANT ALL ON public.project_progress TO service_role;
ALTER TABLE public.project_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_progress read" ON public.project_progress;
DROP POLICY IF EXISTS "project_progress admin write" ON public.project_progress;
CREATE POLICY "project_progress read" ON public.project_progress FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "project_progress admin write" ON public.project_progress FOR ALL TO authenticated USING (public.is_it_admin()) WITH CHECK (public.is_it_admin());
DROP TRIGGER IF EXISTS project_progress_updated ON public.project_progress;
CREATE TRIGGER project_progress_updated BEFORE UPDATE ON public.project_progress FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Approval user baru + Akses Halaman per level akses
-- (jalankan di SQL Editor Supabase — idempoten)
-- ============================================================

-- Level akses: Super Admin (superadmin), Admin (it_admin),
-- Manajemen (event_admin), Pekerja (employee) — memakai enum yang sudah ada.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('it_admin','superadmin'));
$$;

-- Status approval pada profil pengguna
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
UPDATE public.profiles SET status = 'approved' WHERE status IS NULL OR status = '';
-- pengguna lama tetap aktif
UPDATE public.profiles p SET status = 'approved'
WHERE p.status = 'pending' AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role <> 'employee');

DROP POLICY IF EXISTS "profiles self read" ON public.profiles;
DROP POLICY IF EXISTS "profiles self update" ON public.profiles;
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin()) WITH CHECK (id = auth.uid() OR public.is_admin());

-- Admin boleh mengatur role pengguna (hasil approval)
DROP POLICY IF EXISTS "roles read own" ON public.user_roles;
DROP POLICY IF EXISTS "roles admin write" ON public.user_roles;
CREATE POLICY "roles read own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "roles admin write" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Tabel approval generik (registrasi user & kebutuhan approval lainnya)
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jenis text NOT NULL DEFAULT 'registrasi_user',
  judul text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  subject_user_id uuid,
  requested_by uuid,
  status text NOT NULL DEFAULT 'pending',
  akses_level text,
  catatan text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_requests TO authenticated;
GRANT ALL ON public.approval_requests TO service_role;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "approval read" ON public.approval_requests;
DROP POLICY IF EXISTS "approval insert" ON public.approval_requests;
DROP POLICY IF EXISTS "approval admin write" ON public.approval_requests;
CREATE POLICY "approval read" ON public.approval_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR subject_user_id = auth.uid() OR public.is_admin());
CREATE POLICY "approval insert" ON public.approval_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() OR public.is_admin());
CREATE POLICY "approval admin write" ON public.approval_requests FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP TRIGGER IF EXISTS approval_requests_updated ON public.approval_requests;
CREATE TRIGGER approval_requests_updated BEFORE UPDATE ON public.approval_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Registrasi user baru otomatis membuat permintaan approval
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE first_user boolean;
BEGIN
  first_user := NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'superadmin');

  INSERT INTO public.profiles (id, email, nama, username, status)
  VALUES (NEW.id, NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'nama', NEW.email),
          split_part(COALESCE(NEW.email,''), '@', 1),
          CASE WHEN first_user THEN 'approved' ELSE 'pending' END)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  IF first_user THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'superadmin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.approval_requests (jenis, judul, detail, subject_user_id, requested_by, status)
    VALUES ('registrasi_user',
            'Registrasi user baru: ' || COALESCE(NEW.email, ''),
            jsonb_build_object('email', NEW.email, 'nama', COALESCE(NEW.raw_user_meta_data->>'nama','')),
            NEW.id, NEW.id, 'pending');
  END IF;
  RETURN NEW;
END;
$$;

-- Pengaturan akses halaman per level akses
CREATE TABLE IF NOT EXISTS public.page_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL,
  akses_level text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_key, akses_level)
);
GRANT SELECT ON public.page_access TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_access TO authenticated;
GRANT ALL ON public.page_access TO service_role;
ALTER TABLE public.page_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "page_access read" ON public.page_access;
DROP POLICY IF EXISTS "page_access admin write" ON public.page_access;
CREATE POLICY "page_access read" ON public.page_access FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "page_access admin write" ON public.page_access FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP TRIGGER IF EXISTS page_access_updated ON public.page_access;
CREATE TRIGGER page_access_updated BEFORE UPDATE ON public.page_access
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- Akses Halaman: pemisahan hak View dan Edit per level akses
-- =====================================================================
ALTER TABLE public.page_access ADD COLUMN IF NOT EXISTS can_edit boolean NOT NULL DEFAULT false;

-- ============================================================
-- Registrasi berbasis Data Pekerja (approval dihapus)
-- (jalankan di SQL Editor Supabase — idempoten)
-- ============================================================

-- Semua profil aktif; tidak ada lagi status pending
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS personal_number text;
UPDATE public.profiles SET status = 'approved' WHERE status <> 'approved';
ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'approved';
CREATE UNIQUE INDEX IF NOT EXISTS profiles_personal_number_key
  ON public.profiles (personal_number) WHERE personal_number IS NOT NULL;

DROP TABLE IF EXISTS public.approval_requests CASCADE;

-- Cek Personal Number terhadap Data Pekerja (boleh dipanggil sebelum login)
CREATE OR REPLACE FUNCTION public.check_personal_number(p_pn text)
RETURNS TABLE (pn_exists boolean, pn_claimed boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.employees e WHERE e.personal_number = p_pn),
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.personal_number = p_pn);
$$;
GRANT EXECUTE ON FUNCTION public.check_personal_number(text) TO anon, authenticated;

-- Hubungkan akun yang sudah login dengan Personal Number pekerja
CREATE OR REPLACE FUNCTION public.claim_personal_number(p_pn text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp_nama text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT e.nama INTO emp_nama FROM public.employees e WHERE e.personal_number = p_pn;
  IF emp_nama IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.personal_number = p_pn AND p.id <> auth.uid()) THEN
    RETURN false;
  END IF;
  UPDATE public.profiles
     SET personal_number = p_pn,
         nama = COALESCE(NULLIF(nama, ''), emp_nama),
         status = 'approved'
   WHERE id = auth.uid();
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_personal_number(text) TO authenticated;

-- Trigger user baru: tanpa approval, langsung aktif + simpan personal number
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE first_user boolean; pn text;
BEGIN
  first_user := NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'superadmin');
  pn := NULLIF(NEW.raw_user_meta_data->>'personal_number', '');

  INSERT INTO public.profiles (id, email, nama, username, status, personal_number)
  VALUES (NEW.id, NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'nama',
                   (SELECT e.nama FROM public.employees e WHERE e.personal_number = pn),
                   NEW.email),
          split_part(COALESCE(NEW.email,''), '@', 1),
          'approved',
          pn)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  IF first_user THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'superadmin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- Penjagaan: akun hanya sah bila terhubung ke Data Pekerja
-- (mencegah login Google akun asing bisa masuk aplikasi)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_account_registered()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.employees e ON e.personal_number = p.personal_number
    WHERE p.id = auth.uid() AND COALESCE(p.personal_number, '') <> ''
  )
  -- Akun dengan peran administratif (mis. superadmin awal) tetap sah
  OR EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid()
      AND r.role IN ('superadmin', 'it_admin', 'event_admin')
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_account_registered() TO authenticated;

-- Hapus akun yang tidak terhubung ke Data Pekerja (dipanggil saat gagal verifikasi)
CREATE OR REPLACE FUNCTION public.discard_unregistered_account()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR public.is_account_registered() THEN RETURN false; END IF;
  DELETE FROM public.user_roles WHERE user_id = uid;
  DELETE FROM public.profiles WHERE id = uid;
  DELETE FROM auth.users WHERE id = uid;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.discard_unregistered_account() TO authenticated;

-- ============================================================
-- Level akses otomatis dari Data Pekerja + Kategori Jabatan
-- Kuota: superadmin maksimal 1, admin (it_admin) maksimal 10
-- (idempoten — aman dijalankan ulang di SQL Editor Supabase)
-- ============================================================

CREATE OR REPLACE FUNCTION public.access_label_to_role(p_label text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(btrim(coalesce(p_label, '')))
    WHEN 'super admin' THEN 'it_admin'   -- Super Admin tidak boleh diberikan lewat jabatan
    WHEN 'superadmin'  THEN 'it_admin'
    WHEN 'admin'       THEN 'it_admin'
    WHEN 'manajemen'   THEN 'event_admin'
    ELSE 'employee'
  END;
$$;

-- Kuota level akses
CREATE OR REPLACE FUNCTION public.role_quota(p_role text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_role WHEN 'superadmin' THEN 1 WHEN 'it_admin' THEN 10 ELSE NULL END;
$$;

-- Terapkan level akses seorang user sesuai jabatan di Data Pekerja
CREATE OR REPLACE FUNCTION public.sync_access_level(p_user uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target text;
  used int;
  quota int;
BEGIN
  IF p_user IS NULL THEN RETURN NULL; END IF;

  -- Superadmin yang sudah ada tidak pernah diturunkan
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role = 'superadmin') THEN
    RETURN 'superadmin';
  END IF;

  SELECT public.access_label_to_role(j.akses_level)
    INTO target
    FROM public.profiles p
    JOIN public.employees e ON e.personal_number = p.personal_number
    LEFT JOIN public.job_titles j ON j.id = e.jabatan_id
   WHERE p.id = p_user
   LIMIT 1;

  IF target IS NULL THEN RETURN NULL; END IF;

  -- Kuota admin: bila penuh, otomatis turun ke Manajemen
  quota := public.role_quota(target);
  IF quota IS NOT NULL THEN
    SELECT count(*) INTO used FROM public.user_roles
     WHERE role = target::app_role AND user_id <> p_user;
    IF used >= quota THEN
      target := CASE WHEN target = 'it_admin' THEN 'event_admin' ELSE 'employee' END;
    END IF;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = p_user AND role <> 'superadmin';
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user, target::app_role)
  ON CONFLICT DO NOTHING;

  RETURN target;
END;
$$;
GRANT EXECUTE ON FUNCTION public.sync_access_level(uuid) TO authenticated, service_role;

-- Versi untuk akun yang sedang login
CREATE OR REPLACE FUNCTION public.sync_my_access_level()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.sync_access_level(auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.sync_my_access_level() TO authenticated;

-- Saat Personal Number di-claim, langsung terapkan level akses
CREATE OR REPLACE FUNCTION public.claim_personal_number(p_pn text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp_nama text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT e.nama INTO emp_nama FROM public.employees e WHERE e.personal_number = p_pn;
  IF emp_nama IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.personal_number = p_pn AND p.id <> auth.uid()) THEN
    RETURN false;
  END IF;
  UPDATE public.profiles
     SET personal_number = p_pn,
         nama = COALESCE(NULLIF(nama, ''), emp_nama),
         status = 'approved'
   WHERE id = auth.uid();
  PERFORM public.sync_access_level(auth.uid());
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_personal_number(text) TO authenticated;

-- Super Admin tidak boleh dipakai di Kategori Jabatan
UPDATE public.job_titles SET akses_level = 'Admin'
 WHERE lower(btrim(coalesce(akses_level, ''))) IN ('super admin', 'superadmin');

CREATE OR REPLACE FUNCTION public.job_titles_block_superadmin()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF lower(btrim(coalesce(NEW.akses_level, ''))) IN ('super admin', 'superadmin') THEN
    NEW.akses_level := 'Admin';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS job_titles_no_superadmin ON public.job_titles;
CREATE TRIGGER job_titles_no_superadmin BEFORE INSERT OR UPDATE ON public.job_titles
FOR EACH ROW EXECUTE FUNCTION public.job_titles_block_superadmin();

-- Penjaga kuota di level database
CREATE OR REPLACE FUNCTION public.enforce_role_quota()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE used int; quota int;
BEGIN
  quota := public.role_quota(NEW.role::text);
  IF quota IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO used FROM public.user_roles
   WHERE role = NEW.role AND user_id <> NEW.user_id;
  IF used >= quota THEN
    IF NEW.role::text = 'it_admin' THEN
      NEW.role := 'event_admin'::app_role;   -- kuota admin penuh -> Manajemen
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Kuota % sudah penuh (maksimal %)', NEW.role, quota;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS user_roles_quota ON public.user_roles;
CREATE TRIGGER user_roles_quota BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_role_quota();

-- ============================================================
-- Google Drive sebagai cloud storage aplikasi
-- ============================================================
CREATE TABLE IF NOT EXISTS public.drive_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  root_folder_name text NOT NULL DEFAULT 'SUPER IT DATA',
  root_folder_id text,
  refresh_token text,
  account_email text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.drive_accounts TO service_role;
ALTER TABLE public.drive_accounts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.entity_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  drive_file_id text NOT NULL,
  file_name text,
  mime_type text,
  view_url text,
  thumbnail_url text,
  account_id uuid REFERENCES public.drive_accounts(id) ON DELETE SET NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS entity_photos_entity_idx ON public.entity_photos (entity_type, entity_id);
GRANT SELECT ON public.entity_photos TO anon, authenticated;
GRANT ALL ON public.entity_photos TO service_role;
ALTER TABLE public.entity_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS entity_photos_read ON public.entity_photos;
CREATE POLICY entity_photos_read ON public.entity_photos FOR SELECT TO anon, authenticated USING (true);

-- UKERS: deskripsi profil unit kerja (ditampilkan pada pop up profil uker)
ALTER TABLE public.ukers ADD COLUMN IF NOT EXISTS deskripsi text;
GRANT SELECT (deskripsi) ON public.ukers TO anon;

-- Deskripsi profil pekerja (ditampilkan pada pop up detail pekerja)
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS profil text;

-- ============================================================
-- FIX: "Database error saving new user" saat registrasi
-- Trigger auth.users dibuat anti-gagal: kolom dipastikan ada dan
-- setiap error di-log sebagai warning tanpa membatalkan signup.
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS personal_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS akses_level text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE first_user boolean; pn text; emp_nama text;
BEGIN
  BEGIN
    pn := NULLIF(NEW.raw_user_meta_data->>'personal_number', '');
    SELECT e.nama INTO emp_nama FROM public.employees e WHERE e.personal_number = pn LIMIT 1;

    -- Personal Number tidak boleh dipakai dua akun
    IF pn IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.personal_number = pn AND p.id <> NEW.id
    ) THEN
      pn := NULL;
    END IF;

    first_user := NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'superadmin');

    INSERT INTO public.profiles (id, email, nama, username, status, personal_number)
    VALUES (NEW.id, NEW.email,
            COALESCE(NULLIF(NEW.raw_user_meta_data->>'nama',''), emp_nama, NEW.email),
            split_part(COALESCE(NEW.email,''), '@', 1),
            'approved',
            pn)
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          personal_number = COALESCE(public.profiles.personal_number, EXCLUDED.personal_number);

    IF first_user THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'superadmin') ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee') ON CONFLICT DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Jangan pernah menggagalkan pembuatan akun karena error di sisi aplikasi
    RAISE WARNING 'handle_new_user gagal untuk %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FIX (registrasi): level akses otomatis + anti data duplikat
-- ============================================================

-- 1) Data unik: Personal Number, TID mesin, Kode Uker
DELETE FROM public.employees a USING public.employees b
 WHERE a.ctid > b.ctid AND a.personal_number = b.personal_number;
CREATE UNIQUE INDEX IF NOT EXISTS employees_personal_number_key
  ON public.employees (personal_number) WHERE personal_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS atm_machines_tid_key
  ON public.atm_machines (tid) WHERE tid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS crm_machines_tid_key
  ON public.crm_machines (tid) WHERE tid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS edc_machines_tid_key
  ON public.edc_machines (tid) WHERE tid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ukers_kode_uker_key
  ON public.ukers (kode_uker);

-- 2) Level akses langsung menyesuaikan jabatan Data Pekerja saat akun dibuat
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE first_user boolean; pn text; emp_nama text;
BEGIN
  BEGIN
    pn := NULLIF(NEW.raw_user_meta_data->>'personal_number', '');
    SELECT e.nama INTO emp_nama FROM public.employees e WHERE e.personal_number = pn LIMIT 1;

    IF pn IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.personal_number = pn AND p.id <> NEW.id
    ) THEN
      pn := NULL;
    END IF;

    first_user := NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'superadmin');

    INSERT INTO public.profiles (id, email, nama, username, status, personal_number)
    VALUES (NEW.id, NEW.email,
            COALESCE(NULLIF(NEW.raw_user_meta_data->>'nama',''), emp_nama, NEW.email),
            split_part(COALESCE(NEW.email,''), '@', 1),
            'approved',
            pn)
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          personal_number = COALESCE(public.profiles.personal_number, EXCLUDED.personal_number);

    IF first_user THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'superadmin') ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee') ON CONFLICT DO NOTHING;
      -- Sesuaikan dengan level akses jabatan pada Data Pekerja
      IF pn IS NOT NULL THEN
        PERFORM public.sync_access_level(NEW.id);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user gagal untuk %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3) Saat jabatan pekerja berubah, level akses akunnya ikut menyesuaikan
CREATE OR REPLACE FUNCTION public.employees_sync_access()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  SELECT p.id INTO uid FROM public.profiles p WHERE p.personal_number = NEW.personal_number LIMIT 1;
  IF uid IS NOT NULL THEN PERFORM public.sync_access_level(uid); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS employees_sync_access_trg ON public.employees;
CREATE TRIGGER employees_sync_access_trg AFTER INSERT OR UPDATE OF jabatan_id, personal_number
ON public.employees FOR EACH ROW EXECUTE FUNCTION public.employees_sync_access();
