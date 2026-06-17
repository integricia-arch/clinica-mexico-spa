# Conversaciones (Inbox)

> Aquí ves y respondes los mensajes que llegan de Telegram, WhatsApp, Instagram y Facebook. Un bot contesta automáticamente la mayoría; cuando el bot no puede resolver algo, te avisa para que tú tomes el control. La usan recepción y, para temas médicos urgentes, también el doctor o enfermería.

## Operación — cómo se usa

### Cómo ver las conversaciones que necesitan tu atención

1. Al entrar, la pantalla te muestra primero las conversaciones **Escaladas** — son las que el bot ya no puede atender solo.
2. Usa las pestañas de arriba para cambiar entre "Todas", "Activas" (las atiende el bot), "Escaladas" (te necesitan a ti) y "Cerradas".
3. El número naranja junto a "Escaladas" te dice cuántas están esperando respuesta tuya en este momento.
4. Las conversaciones urgentes o de alta prioridad aparecen primero en la lista, sin importar cuándo llegó el último mensaje.
5. Escribe en el buscador el nombre del paciente para encontrar su conversación más rápido.

### Cómo leer una conversación

1. Da clic sobre la conversación en la lista de la izquierda.
2. A la derecha verás el historial completo: en gris los mensajes del paciente, en color los del bot o de recepción.
3. Si alguien de recepción ya respondió, verás la etiqueta "Recepción" sobre su mensaje.
4. Si necesitas ver el detalle técnico (lo que el bot consultó por dentro), da clic en "Ver detalles técnicos" — normalmente no lo necesitas.

### Cómo tomar control de una conversación

1. Abre la conversación.
2. Da clic en **"Tomar control"**.
3. La conversación pasa a estado "Escalada" y queda asignada a tu nombre — verás el aviso "Tú estás atendiendo esta conversación".
4. Ahora puedes escribir y enviar mensajes directamente al paciente, por el mismo canal donde te escribió (Telegram, WhatsApp, etc.).

### Cómo responder a un paciente

1. Con la conversación escalada y abierta, escribe tu respuesta en el cuadro de texto de abajo.
2. Presiona **Enter** para enviar (o el botón de enviar). Usa **Shift+Enter** si quieres escribir varias líneas antes de enviar.
3. Tu mensaje se envía al paciente por el canal original y aparece marcado como "Recepción" en el historial.

Mientras una conversación está "Activa" (no escalada), no puedes escribir — el bot es quien responde. Si necesitas intervenir, primero da clic en "Tomar control".

### Cómo asociar o crear un paciente desde una conversación

Si ves la etiqueta **"Sin paciente"**, esa persona escribió pero todavía no tiene expediente en el sistema.

1. Da clic en **"Crear/asociar paciente"**.
2. Completa los datos del paciente (o búscalo si ya existe) en la ventana que se abre.
3. Al guardar, la conversación queda ligada a ese paciente y se abre automáticamente la ventana para asignarle una cita.

### Cómo asignar una cita desde una conversación

1. Con la conversación ya ligada a un paciente, da clic en **"Asignar cita"** (o "Reasignar cita" si el doctor rechazó una anterior).
2. Elige fecha, hora y doctor en la ventana que se abre.
3. El motivo y el nivel de dolor que reportó el paciente (si los dio) se copian automáticamente a las notas de la cita.

### Cómo registrar una llamada al doctor

Cuando una cita está "Pendiente confirmación doctor" y ya intentaste contactarlo, deja constancia:

1. Da clic en **"Registrar llamada al doctor"**.
2. Indica qué pasó (no contestó, ocupado, pidió que le devuelvan la llamada, etc.).
3. Guarda — así queda registro de los intentos de contacto.

### Cómo cerrar una conversación

1. Abre la conversación.
2. Da clic en **"Cerrar conversación"**.
3. La conversación pasa a "Cerradas" y deja de aparecer en pendientes. Ya no podrás escribir en ella desde aquí.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** no puedes escribir en una conversación "Activa".
  **Por qué:** mientras nadie ha tomado el control, el bot es quien está respondiendo; si dos "personas" contestan a la vez se duplican o contradicen mensajes al paciente.
- **Lo que pasa:** las conversaciones "Escaladas" siempre aparecen primero en la lista, y las urgentes antes que las de prioridad normal.
  **Por qué:** son las que tienen a un paciente esperando una respuesta humana — no se deben perder entre las que el bot ya está atendiendo bien.
- **Lo que pasa:** ves la etiqueta "Sin paciente" y el botón de "Asignar cita" no aparece hasta que asocias o creas el paciente.
  **Por qué:** una cita siempre necesita un expediente de paciente al que pertenecer; el sistema te obliga a resolver eso primero.
- **Lo que pasa:** cuando el doctor rechaza una cita, ves "Rechazada por doctor" y el motivo que dio.
  **Por qué:** para que sepas por qué no se puede confirmar y reasignes con otro horario o doctor en vez de dejar al paciente sin respuesta.
- **Lo que pasa:** si una cita lleva más de 15 minutos esperando que el doctor la confirme, aparece en rojo "Sin confirmar".
  **Por qué:** para que no se quede esperando indefinidamente y alguien le dé seguimiento al doctor.
- **Lo que pasa:** en conversaciones marcadas como urgentes, el sistema te recuerda valorar atención inmediata o recomendar acudir a urgencias / llamar al 911.
  **Por qué:** son casos donde el paciente reportó síntomas que podrían ser graves — es un recordatorio de seguridad, no un diagnóstico automático.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No puedo escribirle al paciente | La conversación sigue "Activa" (la atiende el bot) | Da clic en "Tomar control" primero |
| No encuentro el botón de "Asignar cita" | La conversación no tiene paciente asociado todavía | Da clic en "Crear/asociar paciente" primero |
| Llegó un mensaje nuevo y no veo la conversación en mi lista | Puede estar en otra pestaña de estado, o filtrada por tu búsqueda | Revisa la pestaña "Todas" y borra el texto del buscador |
| El paciente dice que no le llegó mi respuesta | Puede ser un problema de conexión con el canal (Telegram/WhatsApp/etc.) | Revisa que el mensaje se haya enviado sin error (mensaje de aviso rojo); si persiste, avisa a soporte técnico |
| Quiero ver qué le preguntó el bot por dentro al paciente | Por defecto solo se muestran los mensajes normales | Da clic en "Ver detalles técnicos" dentro de la conversación |
| Aparece "Pendiente confirmación doctor" y no sé qué hacer | El doctor todavía no confirmó ni rechazó la cita asignada | Espera su respuesta o usa "Registrar llamada al doctor" si ya intentaste contactarlo |
| Cerré una conversación por error | Se cerró antes de tiempo | Por ahora no hay botón de "reabrir" — vuelve a contactar al paciente o pide ayuda técnica para reabrirla |


## Implementación — para el siguiente dev/agente

- **Archivo(s) principal(es):** `src/pages/Inbox.tsx` (lista + hilo de mensajes), `src/features/inbox/ConversationActionPanel.tsx` (panel de acciones cuando está escalada), `src/features/inbox/QuickPatientDialog.tsx`, `src/features/inbox/AssignAppointmentDialog.tsx`, `src/features/inbox/DoctorCallDialog.tsx`
- **Tablas Supabase involucradas:** `conversaciones`, `mensajes`, `identidades_canal`, `patients`, `appointments`, `doctor_contact_attempts`, `audit_logs`
- **Edge function:** `enviar-mensaje-humano` (envía la respuesta de recepción al canal externo correspondiente)
- **Realtime:** suscripción a `postgres_changes` sobre `mensajes` (INSERT) y `conversaciones` (INSERT/UPDATE) en el canal `inbox-realtime`; el panel de acciones se suscribe aparte a `appointments` filtrado por `conversacion_id`
- **Estados de conversación:** `activa` (bot responde), `escalada` (humano responde, requiere `asignada_humano_id`), `cerrada` (solo lectura)
- **Orden de la lista:** escaladas primero, luego por prioridad (`urgente` > `alta` > resto), luego por `last_message_at` descendente — lógica en el `useMemo` de `filteredOrdered` en `Inbox.tsx`
- **Cómo agregar un canal nuevo:** agregar la entrada en `CANAL_META` (icono, color, label) en `Inbox.tsx`; el tipo `CanalTipo` y la columna `canal_id` en `identidades_canal` deben incluir el nuevo valor
- **Cómo agregar una regla de negocio nueva (ej. nuevo umbral de tiempo sin confirmar):** la lógica de badges/alertas vive en `ConversationActionPanel.tsx` (cálculos como `minutesPending`, `callPending`); si la regla debe ser inviolable (no solo visual), agregarla también como validación en el RPC/edge function correspondiente, no solo en el frontend

