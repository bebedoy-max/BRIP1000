-- AI Brain: penyimpanan koneksi AI (Gemini/OpenAI/Anthropic/kompatibel OpenAI).
-- Hanya super admin yang boleh mengakses tabel ini.

CREATE TABLE IF NOT EXISTS public.ai_brains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  provider text NOT NULL DEFAULT 'gemini',   -- gemini | openai | anthropic | custom
  model text NOT NULL DEFAULT 'gemini-2.5-flash',
  base_url text,                              -- opsional, untuk provider custom
  api_key text NOT NULL,
  aktif boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_brains TO authenticated;
GRANT ALL ON public.ai_brains TO service_role;

ALTER TABLE public.ai_brains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_brains superadmin" ON public.ai_brains;
CREATE POLICY "ai_brains superadmin" ON public.ai_brains FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP TRIGGER IF EXISTS ai_brains_updated ON public.ai_brains;
CREATE TRIGGER ai_brains_updated BEFORE UPDATE ON public.ai_brains
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
