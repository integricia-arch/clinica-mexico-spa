-- Add 'eliminar' action
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'eliminar';
