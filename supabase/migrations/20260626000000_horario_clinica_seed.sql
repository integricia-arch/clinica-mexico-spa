-- Seed horario de atención por clínica en clinic_settings
-- section = 'horario', data = {dias_laborales, hora_apertura, hora_cierre}
-- dias_laborales: 0=domingo, 1=lunes, ..., 6=sábado

INSERT INTO clinic_settings (clinic_id, section, data)
SELECT
  id,
  'horario',
  '{
    "dias_laborales": [1, 2, 3, 4, 5],
    "hora_apertura": "09:00",
    "hora_cierre": "18:00"
  }'::jsonb
FROM clinics
ON CONFLICT (clinic_id, section) DO NOTHING;
