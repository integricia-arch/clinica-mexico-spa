# Notificaciones por rol

> Aquí decides quién se entera de qué, y por dónde (Telegram o correo). Solo el administrador entra a esta pantalla.

## Operación — cómo se usa

### Cómo ver las reglas que ya existen

1. Entra a "Configuración" → "Notificaciones por rol".
2. Verás una tabla con cuatro columnas: **Rol** (quién recibe el aviso), **Evento** (qué pasó), **Canal** (por dónde le llega) y **Activa** (si está prendida o apagada).
3. Si no hay ninguna regla creada todavía, la tabla dice "Sin reglas configuradas" — es normal en una clínica nueva.

### Cómo prender o apagar una notificación

1. Busca la fila con el rol, evento y canal que te interesa.
2. Da clic en el interruptor de la columna "Activa".
3. Listo — el cambio se guarda solo, no hay botón de "Guardar".

### Cómo crear una regla nueva

1. Da clic en "Nueva regla" (arriba a la derecha).
2. Elige el **rol** que va a recibir el aviso (administrador, gerente, recepción, médico, enfermería, cajero o paciente).
3. Elige el **evento** que dispara el aviso: asignación de cita a enfermera, vencimiento de una cuenta por pagar, o nuevo usuario registrado.
4. Elige el **canal**: Telegram o correo (son los únicos disponibles por ahora, sin costo).
5. Da clic en "Crear regla" — aparece de inmediato en la tabla, ya activada.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** no puedes crear dos veces la misma combinación de rol + evento + canal (el sistema te avisa "Esa regla ya existe").
  **Por qué:** no tiene sentido tener la misma regla repetida — si quieres cambiarla, usa el interruptor de "Activa" en la que ya existe en vez de crear otra.
- **Lo que pasa:** solo puedes elegir Telegram o correo como canal.
  **Por qué:** son los únicos canales que la clínica usa hoy y no tienen costo. SMS o WhatsApp necesitarían contratar un proveedor externo con costo recurrente, y todavía no está activado.
- **Lo que pasa:** apagar una regla no borra el historial de avisos ya enviados, solo detiene los nuevos.
  **Por qué:** así puedes reactivarla después sin perder nada, y nadie pierde el registro de lo que ya se notificó.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| Quiero que enfermería reciba avisos por correo, pero solo veo Telegram | Esa combinación de rol + evento + correo no se ha creado todavía | Da clic en "Nueva regla" y créala con el canal "email" |
| Al crear una regla me dice "Esa regla ya existe" | Ya hay una regla idéntica (mismo rol, evento y canal) | Busca esa fila en la tabla y solo prende el interruptor si estaba apagada |
| Apagué una regla por error y ya no llegan los avisos a ese rol | El interruptor "Activa" quedó apagado | Vuelve a la fila y da clic en el interruptor para prenderla otra vez |
| No encuentro la opción de mandar avisos por WhatsApp o SMS | Esos canales no están disponibles todavía | Por ahora solo existen Telegram y correo; si tu clínica necesita SMS/WhatsApp, consúltalo con el equipo que administra el sistema |
| Cambié el interruptor pero no estoy seguro si se guardó | El cambio se guarda al instante, sin botón de confirmar | Recarga la página (F5) y verifica que el interruptor quedó en la posición que esperabas |


## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/configuracion/ConfiguracionNotificaciones.tsx`
- **Tablas Supabase involucradas:** `notification_rules` (`id`, `clinic_id`, `role`, `event_type`, `channel`, `enabled`)
- **RPCs/edge functions:** ninguna — el componente lee/escribe directo contra `notification_rules` vía `supabase.from(...)`. La lógica de quién envía el aviso real (Telegram/email) consulta esta tabla desde otra parte del sistema (no en este archivo).
- **Catálogos hardcoded en el componente:** `ROLE_LABELS`, `EVENT_LABELS`, `CHANNELS` (línea ~22-38). Agregar un rol o evento nuevo requiere agregar la entrada aquí — no hay tabla de catálogo en BD.
- **Cómo agregar un evento nuevo:** 1) agregar entrada a `EVENT_LABELS` en este archivo, 2) asegurar que el código que dispara la notificación real use el mismo `event_type` como string al consultar `notification_rules`.
- **Cómo agregar un canal nuevo (ej. WhatsApp):** agregar el string a `CHANNELS` — la columna `channel` en BD es texto libre, no tiene CHECK constraint, así que no requiere migración. Sí requiere implementar el envío real en el backend/edge function correspondiente.
- **Cómo agregar una regla de negocio nueva:** la validación de duplicados depende de un constraint único en BD sobre (`clinic_id`, `role`, `event_type`, `channel`) — el frontend solo interpreta el error `duplicate` del insert (línea 85). Reglas adicionales (ej. límite de reglas por rol) deberían validarse en un trigger o antes del insert en este componente.

