ALTER TABLE clinics ADD COLUMN IF NOT EXISTS subscription_cancel_at timestamptz;

-- Drop and recreate the subscription_status CHECK constraint to include 'canceling'
ALTER TABLE clinics DROP CONSTRAINT IF EXISTS clinics_subscription_status_check;
ALTER TABLE clinics ADD CONSTRAINT clinics_subscription_status_check
  CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceling', 'canceled'));

COMMENT ON COLUMN clinics.subscription_cancel_at IS
  'Fecha en que Stripe cortará el acceso real tras cancelación self-service (cancel_at_period_end). NULL si no hay cancelación programada.';
