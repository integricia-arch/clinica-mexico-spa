-- Bucket público para logo de clínica (white-label #16). Público porque el logo se
-- muestra en header/sidebar/login vía <img src> directo, sin signed URL — mismo
-- patrón que cualquier asset de marca. Escritura restringida a admin de esa clínica.
-- Convención de path: {clinic_id}/logo.{ext}

INSERT INTO storage.buckets (id, name, public)
VALUES ('clinic-logos', 'clinic-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read clinic logos" ON storage.objects;
CREATE POLICY "Public read clinic logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'clinic-logos');

DROP POLICY IF EXISTS "Clinic admin upload logo" ON storage.objects;
CREATE POLICY "Clinic admin upload logo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'clinic-logos'
  AND EXISTS (
    SELECT 1 FROM public.clinic_memberships m
    WHERE m.user_id = auth.uid()
      AND m.role = 'admin'
      AND m.clinic_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "Clinic admin update logo" ON storage.objects;
CREATE POLICY "Clinic admin update logo"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'clinic-logos'
  AND EXISTS (
    SELECT 1 FROM public.clinic_memberships m
    WHERE m.user_id = auth.uid()
      AND m.role = 'admin'
      AND m.clinic_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "Clinic admin delete logo" ON storage.objects;
CREATE POLICY "Clinic admin delete logo"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'clinic-logos'
  AND EXISTS (
    SELECT 1 FROM public.clinic_memberships m
    WHERE m.user_id = auth.uid()
      AND m.role = 'admin'
      AND m.clinic_id::text = (storage.foldername(name))[1]
  )
);
