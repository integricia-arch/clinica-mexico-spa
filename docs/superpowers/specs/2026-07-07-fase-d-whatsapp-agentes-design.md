# Diseño — Fase D: WhatsApp multi-número + agentes supervisores

**Fecha:** 2026-07-07
**Estado:** Spec detallado de Fase D. Depende de Fase A (mergeada a `main`, commit `2cb5fc7`).
**Spec maestro:** `docs/superpowers/specs/2026-07-06-saas-multitenant-whatsapp-design.md`

## Contexto

Fase A dejó las columnas `clinics.whatsapp_phone_number_id` y
`clinics.whatsapp_business_account_id` (nulas) y el modelo de tenant
(`clinics` + `clinic_memberships` + `platform_staff`) listo. Fase D conecta
WhatsApp Business (Meta Cloud API) a ese modelo: cada hospital cliente tiene
su propio número de WhatsApp, todos bajo una sola WhatsApp Business Account
(WABA) propiedad de integrika. Meta Business Manager de integrika ya está
verificado — no hay bloqueo externo para empezar.

El bot conversacional ya existe y funciona en producción vía Telegram
(`supabase/functions/telegram-webhook`, `help-chat-ai`): agenda citas,
maneja recordatorios, recetas, saludo, wizard multi-paso con estado en
`bot_sesiones`. Fase D no reescribe ese cerebro — lo expone también por
WhatsApp.

**Nota de terminología:** el spec maestro mencionaba un rol `super_admin`
nuevo en `user_roles`. Fase A implementó esto de otra forma: tabla dedicada
`platform_staff` + función `is_global_admin(uuid)`. Este spec usa
`platform_staff`/`is_global_admin` — no se agrega ningún rol nuevo a
`user_roles`.

## Decisiones de esta fase (confirmadas en brainstorming)

1. **Agentes supervisores = auditoría pasiva únicamente.** Un cron que
   verifica que los mensajes salientes esperados (recordatorio, resultado,
   cobro) se hayan enviado, y alerta si no. No conversa con el paciente, no
   decide, no reintenta por su cuenta más allá de un retry simple en el
   momento del envío original.
2. **Revisado tras inspeccionar el código real:** `telegram-webhook/index.ts`
   no es un bot simple — es un agente LLM (Claude) con tool-calling, triage
   de salud mental, integración de Google Calendar y botones inline de
   Telegram, ~2000 líneas entrelazadas. Separarlo en "núcleo agnóstico +
   adaptador de canal" de una sola vez es una refactorización grande y
   riesgosa sobre código de producción. **Fase D entrega un bot de WhatsApp
   standalone y determinístico** (sin LLM, sin tool-calling): saludo +
   flujo de agendar cita en 3 pasos fijos (servicio → fecha/hora libre →
   confirmar), usando las mismas tablas que ya usa Telegram
   (`appointments`, `servicios`, `doctors`, `bot_sesiones`). La extracción
   de un núcleo compartido con el agente LLM de Telegram queda como
   **Fase D.2**, posterior, fuera de alcance de este plan.
3. **Alta de número: proceso manual staff-driven**, con paso de verificación
   activa antes de que el número reciba tráfico real de pacientes.

## 1. Modelo de datos y ruteo

Migración nueva agrega:

- `clinics.whatsapp_status text NOT NULL DEFAULT 'pending'` — `'pending'` |
  `'verified'`. Un número recién pegado en el panel arranca `pending`; el
  webhook ignora mensajes entrantes de un `phone_number_id` cuyo
  `whatsapp_status` no sea `'verified'`.
- Sin columna nueva de canal: `identidades_canal.canal_id` (text, ya
  existente, hoy solo tiene el valor `'telegram'`) ya cumple esa función —
  las identidades de WhatsApp se crean con `canal_id='whatsapp'`.
  `conversaciones` no tiene columna de canal propia; se resuelve vía join a
  `identidades_canal.canal_id` cuando haga falta filtrar por canal.
- Índice `idx_clinics_whatsapp_phone_number_id` sobre
  `clinics(whatsapp_phone_number_id)` para el lookup de ruteo del webhook
  (debe ser rápido, es la primera query de cada mensaje entrante).

Tablas reusadas sin cambio de esquema (ya tienen `clinic_id`, ya cubiertas
por el RLS `RESTRICTIVE` de Fase A): `conversaciones`, `identidades_canal`,
`bot_sesiones`, `recordatorios_cita`, `mensajes`.

`whatsapp_business_account_id` normalmente tiene el mismo valor para todos
los hospitales (una sola WABA compartida). La columna se deja por-clínica de
todas formas por si algún cliente enterprise pide WABA dedicada a futuro —
eso no se resuelve en esta fase, solo se deja la puerta abierta en el
esquema.

## 2. Bot de WhatsApp v1 — flujo determinístico standalone

`supabase/functions/whatsapp-webhook/index.ts` es código nuevo,
independiente de `telegram-webhook/index.ts` (no se toca ese archivo en
esta fase). Sin LLM, sin tool-calling — un state machine simple guardado en
`bot_sesiones` (misma tabla y patrón que ya usa Telegram para su wizard):
columna `flow_step` (text) para el paso actual, `flow_data` (jsonb) para
datos libres capturados durante el flujo, más las columnas ya tipadas
`servicio_id`, `doctor_id`, `slot_propuesto` que la tabla ya tiene.

Estados del flujo (`bot_sesiones.flow_step`):

1. `saludo` (implícito, sin estado previo): cualquier mensaje entrante de
   una `identidad_canal` sin sesión activa → responde saludo + menú de
   texto ("Escribe *CITA* para agendar, o *HUMANO* para hablar con
   alguien.").
2. `CITA` → `esperando_servicio`: lista los `servicios` activos de la
   clínica (`SELECT id, nombre FROM servicios WHERE clinic_id = $1 AND
   activo = true`), pide que el paciente responda con el número.
3. `esperando_servicio` + respuesta válida → `esperando_horario`: calcula
   slots libres para los próximos 7 días hábiles usando la misma lógica de
   disponibilidad que ya expone `getFreeBusy`/horario de clínica
   (`clinic_settings` sección `horario`, ya usado por Telegram — se reusa
   tal cual, sin Google Calendar por ahora: v1 solo agenda sin
   sincronizar con calendario externo del doctor. Ver "Fuera de alcance").
   Presenta hasta 5 opciones de fecha/hora como lista numerada.
4. `esperando_horario` + respuesta válida → `esperando_confirmacion`: repite
   los datos (servicio + fecha/hora) y pide "responde *SI* para confirmar".
5. `esperando_confirmacion` + `SI` → inserta fila en `appointments`
   (`clinic_id`, `patient_id` si ya está vinculado o `null` si es
   identidad nueva sin `patient_id` — igual que hoy maneja Telegram),
   `servicio_id`, `fecha_inicio`, `status='solicitada'` (valor real del enum
   `appointment_status`, confirmado contra producción — no existe
   `'pendiente'`), `origen='whatsapp'`
   (columna `appointments.origen text` ya existe, confirmado contra
   producción). Responde confirmación, limpia `bot_sesiones.flow_step` y
   `flow_data` (vuelve a `NULL`).
6. Respuesta no reconocida en cualquier estado → repite la pregunta actual
   una vez; si vuelve a fallar, resetea a `saludo` y sugiere escribir
   *HUMANO*.
7. `HUMANO` en cualquier momento → limpia el flujo, responde "Un miembro
   del equipo te va a contactar" y deja un registro para que el staff lo
   vea (reusa el patrón de escalamiento a humano que ya existe para
   Telegram si aplica; si no existe uno reusable, se define en el plan de
   implementación con el mecanismo más simple: nota en `conversaciones`
   visible al staff, sin canal de notificación push nuevo en esta fase).

`telegram-webhook/index.ts` no cambia. La extracción de un núcleo
compartido con el agente LLM completo (recordatorios, recetas, memoria de
paciente) es **Fase D.2**, no parte de este plan.

## 3. Webhook `whatsapp-webhook` — ruteo por `phone_number_id`

Flujo de un mensaje entrante:

1. Meta hace `POST` al webhook con el payload estándar de Cloud API, que
   incluye `entry[].changes[].value.metadata.phone_number_id`.
2. Verificar firma `X-Hub-Signature-256` (HMAC-SHA256 con
   `WHATSAPP_APP_SECRET`) contra el body crudo. Sin firma válida → 403,
   no se procesa nada (mismo patrón que `stripe-webhook` con
   `X-Stripe-Signature`).
3. `SELECT id AS clinic_id, whatsapp_status FROM clinics WHERE
   whatsapp_phone_number_id = $1`.
4. Si no hay match, o `whatsapp_status <> 'verified'` → responder `200`
   vacío igual (Meta exige 200 siempre para no reintentar/deshabilitar el
   webhook), pero no se ejecuta ninguna lógica de negocio. Se loguea el
   intento (para poder diagnosticar un número mal configurado).
5. Si hay match y está verificado → resolver/crear `identidades_canal`
   (`canal='whatsapp'`, scoped al `clinic_id` resuelto) +
   `conversaciones`, invocar el núcleo compartido, mandar la respuesta vía
   Meta Cloud API.

`verify_jwt = false` en `supabase/config.toml` para este endpoint (Meta no
manda JWT de Supabase) — la validación real de autenticidad es la firma
HMAC del paso 2, mismo modelo que ya usa `telegram-webhook` (secret header
propio) y `stripe-webhook` (firma HMAC).

## 4. Alta y verificación de número por hospital

Meta Business Manager de integrika ya verificado — el flujo operativo por
hospital nuevo:

1. **Lado Meta (manual, staff de integrika, fuera del código):** en Meta
   Business Suite, dar de alta el número de teléfono del hospital bajo la
   WABA de integrika. Meta genera un `phone_number_id`.
2. **Lado panel — editar hospital en `/admin/tenants`:** sección nueva
   "WhatsApp" en la vista de detalle/edición de cada clínica (extiende
   `AdminTenants.tsx`, no es parte del wizard de alta inicial — el número
   normalmente se conecta después de crear el hospital, no en el mismo
   paso). Campos: `phone_number_id`, `whatsapp_business_account_id`
   (prellenado con el valor ya usado por otros hospitales, editable).
   Guardar deja `whatsapp_status='pending'`.
3. **Verificación:** botón "Enviar mensaje de prueba" — pide un número de
   celular destino, invoca edge function nueva `whatsapp-test-send`
   (`POST /{phone_number_id}/messages` de Meta Cloud API con un mensaje de
   texto simple). Si Meta responde éxito → `whatsapp_status='verified'`. Si
   falla → error visible en el panel (mensaje de Meta tal cual), el
   `phone_number_id` queda guardado pero sigue `pending` y el webhook lo
   sigue ignorando (paso 4 de la sección 3).
4. `whatsapp-test-send` requiere JWT + `is_global_admin(auth.uid())` O
   `user_has_clinic_role(auth.uid(), clinic_id, 'admin')` — solo staff de
   integrika o el admin de ese hospital puede probar/activar un número.

Fuera de alcance: automatizar el alta del número en Meta vía API (paso 1
sigue siendo manual — a esta escala, 2-10 números, no justifica la
integración programática adicional).

## 5. Agentes supervisores — auditoría pasiva

Edge function nueva `whatsapp-audit-mensajes`, invocada por `pg_cron` (mismo
patrón que `enviar-recordatorios`), corre cada 15 minutos:

- Por cada `clinic_id` con `whatsapp_status='verified'`, revisa eventos que
  debieron generar un mensaje saliente y no tienen registro correspondiente
  en `mensajes`/log de envío:
  - Recordatorio de cita (`recordatorios_cita` con `status='pendiente'` y
    `programado_para` ya pasado por más de 10 minutos).
  - Resultado de laboratorio marcado `revisado` en `patient_studies` sin
    notificación asociada.
  - Cobro pendiente vencido sin aviso enviado. **Nota:** al momento de este
    spec no existe una tabla `cuentas_por_cobrar` dedicada para saldos de
    paciente (sí existe `cxp_*` para cuentas por pagar a proveedores, que es
    otro flujo). Este tercer tipo de alerta (cobro vencido) se implementa
    solo si para cuando se ejecute el plan ya existe esa tabla en el
    módulo de caja/facturación; si no existe, esta fase entrega solo los
    2 tipos de alerta (recordatorio de cita, resultado de laboratorio) y el
    tercero queda pendiente para cuando el módulo de cobros a paciente
    exista.
- Cada gap detectado inserta una fila en tabla nueva `whatsapp_audit_alertas`
  (`id`, `clinic_id`, `tipo` texto, `referencia_id` uuid, `detectado_at`
  timestamptz, `resuelto` boolean default false, `resuelto_at`,
  `resuelto_por`). No se reinserta un duplicado si ya existe una alerta
  abierta (`resuelto=false`) para el mismo `tipo`+`referencia_id`.
- Nada se auto-corrige — el cron solo detecta y registra.

**Panel de alertas:** sección nueva dentro de `/admin/tenants` (vista de
detalle de hospital) y, para el admin del hospital mismo, un panel scoped a
su propia clínica. Lista alertas `resuelto=false`, ordenadas por
`detectado_at`, con botón "marcar resuelta" (registra `resuelto_por`).

RLS de `whatsapp_audit_alertas`: `user_has_clinic_access(auth.uid(),
clinic_id)` para lectura/escritura scoped a la clínica del usuario, más
policy adicional para `platform_staff` (`is_global_admin(auth.uid())`) que
ve todas.

## 6. Seguridad

- Firma HMAC obligatoria en `whatsapp-webhook` (sección 3, paso 2).
- `whatsapp-test-send` gateado por rol (sección 4, paso 4).
- `whatsapp_audit_alertas` con RLS scoped por clínica + acceso global para
  `platform_staff` (sección 5).
- Todo secret de Meta (`WHATSAPP_APP_SECRET`, token de acceso permanente de
  la API) vive en variables de entorno de la edge function — nunca en
  código ni en el repo, mismo patrón que la clave secreta de Stripe hoy.
- Toda función `SECURITY DEFINER` nueva sigue el checklist ya establecido
  en `CLAUDE.md` (search_path, revoke/grant explícito, check de acceso
  como primera operación).

## 7. Manejo de errores

- Envío saliente que falla (rate limit de Meta, número inválido, ventana de
  24h expirada): un reintento con backoff corto (ej. 5 segundos) dentro del
  mismo request; si sigue fallando, se loguea el error y no se reintenta más
  desde el propio envío — el cron auditor (sección 5) lo detecta en su
  siguiente corrida si corresponde a uno de los tipos de evento que audita.
- `whatsapp-webhook` responde `200` a Meta siempre, incluso si el
  procesamiento interno falla después de recibir el payload — evita que
  Meta reintente indefinidamente o deshabilite el webhook por errores
  repetidos. El error real se loguea con `console.error` con contexto
  (nunca `catch {}` vacío).

## 8. Fuera de alcance de Fase D

- Migrar o deprecar el bot de Telegram — ambos canales quedan activos en
  paralelo indefinidamente, salvo decisión futura explícita.
- Fase D.2: extraer un núcleo compartido entre el agente LLM de Telegram
  (tool-calling, triage de salud mental, memoria de paciente, recordatorios
  automáticos, recetas) y WhatsApp. Este plan entrega WhatsApp con un flujo
  determinístico propio y más chico (saludo + agendar cita), no el bot
  completo.
- Sincronización con Google Calendar del doctor en el flujo de WhatsApp
  (Telegram sí la tiene vía `google-calendar.ts`) — v1 de WhatsApp agenda
  directo en `appointments` sin ese paso.
- Recordatorios, recetas, memoria de paciente, triage de salud mental por
  WhatsApp — quedan para Fase D.2 junto con el núcleo compartido.
- WABA dedicada por hospital (columna preparada, pero se usa una sola WABA
  compartida en esta fase).
- Cola de reintentos avanzada para envíos fallidos (un solo retry inmediato
  basta para v1).
- Agente activo que interviene en la conversación, escala a humano
  automáticamente, o reintenta por su cuenta — el agente de esta fase es
  estrictamente de auditoría pasiva (decisión confirmada en brainstorming).
- Automatizar el alta del número en Meta vía API — el paso en Meta Business
  Suite sigue siendo manual.
- Diseño/aprobación de plantillas de WhatsApp para mensajes fuera de la
  ventana de 24h — tarea operativa/de contenido separada, no bloquea el
  código de esta fase (el bot usa mensajes de texto libre dentro de la
  ventana de 24h para todo lo cubierto aquí).

## 9. Testing

- Unit del state machine determinístico de la sección 2 (transiciones de
  `bot_sesiones.flow_data.step`): cada transición válida e inválida cubierta
  con un test, sin necesidad de mockear Meta ni LLM (la lógica de estado es
  pura, separable de la I/O de red).
- `whatsapp-webhook`: test de firma inválida (403), `phone_number_id` sin
  match (200 vacío, no procesa), `phone_number_id` con `status='pending'`
  (200 vacío, no procesa), flujo feliz con clínica verificada (procesa y
  responde).
- `whatsapp-audit-mensajes`: test de detección de gap (recordatorio vencido
  sin mensaje) y de no-duplicación de alerta ya abierta.
- Smoke test end-to-end real con Meta: solo posible una vez que exista al
  menos un número de prueba dado de alta (paso manual, sección 4) — se deja
  como paso operativo posterior a la implementación, igual que se hizo con
  `platform_staff` en Fase A.
