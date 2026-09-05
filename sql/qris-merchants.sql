-- Menu Merchant QRIS: tabel master merchant QRIS.
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
