-- Kualitas hasil index wajah (0..1) — ditulis companion app, dibaca web app.
ALTER TABLE public.worker_faces ADD COLUMN IF NOT EXISTS quality double precision;

GRANT SELECT (quality) ON public.worker_faces TO authenticated;
