-- Cosmético: 'agenda' ya viene incluido en todos los tiers (no es add-on de venta),
-- marcar en descripcion para que AdminTenants/AdminTenantDetail no lo muestren
-- como módulo contratable por separado. Sin cambio de lógica de gating.
UPDATE catalogo_modulos
SET descripcion = 'Core incluido — Bot de agenda/recepción vía Telegram: confirmaciones y recordatorios de citas'
WHERE slug = 'agenda';
