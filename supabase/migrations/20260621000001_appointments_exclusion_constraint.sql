-- Prevent double-booking: same doctor cannot have two overlapping active appointments.
-- Uses PostgreSQL EXCLUSION constraint with btree_gist for btree-compatible types.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_double_booking
  EXCLUDE USING gist (
    doctor_id WITH =,
    tstzrange(fecha_inicio, fecha_fin, '[)') WITH &&
  )
  WHERE (status NOT IN ('cancelada', 'liberada'));
