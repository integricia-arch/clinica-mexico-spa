
-- Enable RLS on realtime.messages and allow only clinic staff to subscribe to any realtime topic.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can receive realtime broadcasts" ON realtime.messages;
CREATE POLICY "Staff can receive realtime broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.is_clinic_staff((SELECT auth.uid())));
