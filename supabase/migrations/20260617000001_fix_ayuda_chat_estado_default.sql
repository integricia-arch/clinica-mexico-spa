-- Corrección: estado por defecto era 'escalada' (antes de implementar IA).
-- Ahora que hay IA, las sesiones nacen 'abierta'.
ALTER TABLE ayuda_chat_sesiones ALTER COLUMN estado SET DEFAULT 'abierta';

-- Resetear sesiones que quedaron escaladas por el default viejo (sin mensaje IA real)
UPDATE ayuda_chat_sesiones
SET estado = 'abierta'
WHERE estado = 'escalada'
  AND id NOT IN (
    SELECT DISTINCT sesion_id
    FROM ayuda_chat_mensajes
    WHERE rol = 'asistente_ia'
  );
