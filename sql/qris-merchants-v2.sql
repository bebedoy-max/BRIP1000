-- Menu Merchant QRIS v2: skema mengikuti file Excel BO Pringsewu.
-- Kolom: STOREID, NAMA_MERCHANT, ALAMAT, BRDESC, MERCHANT_TYPE, STATUS QRIS.
-- Jalankan di SQL Editor Supabase. PERHATIAN: data lama dihapus.

TRUNCATE TABLE public.qris_merchants;

ALTER TABLE public.qris_merchants DROP COLUMN IF EXISTS tipe;
ALTER TABLE public.qris_merchants DROP COLUMN IF EXISTS bri_merchant;

ALTER TABLE public.qris_merchants ADD COLUMN IF NOT EXISTS brdesc text;
ALTER TABLE public.qris_merchants ADD COLUMN IF NOT EXISTS merchant_type text;
ALTER TABLE public.qris_merchants ADD COLUMN IF NOT EXISTS status_qris text;

ALTER TABLE public.qris_merchants ALTER COLUMN alamat DROP NOT NULL;

CREATE INDEX IF NOT EXISTS qris_merchants_nama_idx ON public.qris_merchants (nama_merchant);
CREATE INDEX IF NOT EXISTS qris_merchants_brdesc_idx ON public.qris_merchants (brdesc);
