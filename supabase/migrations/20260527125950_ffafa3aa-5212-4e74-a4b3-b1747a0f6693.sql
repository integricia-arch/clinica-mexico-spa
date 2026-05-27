
-- 1) Fix prescriptions UPDATE policy: restrict to admin or owner doctor only, with matching WITH CHECK
DROP POLICY IF EXISTS "Doctor or admin update prescriptions" ON public.prescriptions;

CREATE POLICY "Doctor or admin update prescriptions"
ON public.prescriptions
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'doctor'::app_role)
    AND doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'doctor'::app_role)
    AND doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
  )
);

-- 2) Revoke EXECUTE from anon/authenticated on SECURITY DEFINER functions that should not be
-- callable directly via the Data API. RLS policies that reference these functions still work
-- because policy expressions execute under the policy owner's privileges, not the caller's.
REVOKE EXECUTE ON FUNCTION public.generate_prescription_number() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_journey_progress(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_audit(public.audit_action, text, uuid, jsonb, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_clinic_staff(uuid) FROM anon, public;
