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
2. **Bot de WhatsApp reusa el flujo completo de Telegram** (agendar cita,
   recordatorios, recetas, saludo) — no una versión reducida. Esto requiere
   separar la lógica de negocio del bot (agnóstica de canal) del adaptador
   de canal (Telegram vs WhatsApp Cloud API).
3. **Alta de número: proceso manual staff-driven**, con paso de verificación
   activa antes de que el número reciba tráfico real de pacientes.

## 1. Modelo de datos y ruteo

Migración nueva agrega:

- `clinics.whatsapp_status text NOT NULL DEFAULT 'pending'` — `'pending'` |
  `'verified'`. Un número recién pegado en el panel arranca `pending`; el
  webhook ignora mensajes entrantes de un `phone_number_id` cuyo
  `whatsapp_status` no sea `'verified'`.
- `identidades_canal.canal text NOT NULL DEFAULT 'telegram'` y
  `conversaciones.canal text NOT NULL DEFAULT 'telegram'` — distingue de qué
  canal vino cada identidad/conversación. Valores: `'telegram'` |
  `'whatsapp'`. Backfill de filas existentes a `'telegram'` (todo el tráfico
  histórico es de ese canal).
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

## 2. Refactor: separar lógica de negocio del adaptador de canal

`supabase/functions/telegram-webhook/index.ts` hoy mezcla tres cosas: (a) la
lógica de negocio del bot (wizard de citas, recordatorios, recetas), (b) el
estado de la conversación (`bot_sesiones`, `conversaciones`), y (c) las
llamadas a la API de Telegram para mandar/recibir mensajes, todo bajo un
`CLINIC_ID` fijo de módulo.

Fase D extrae (a)+(b) a un módulo compartido
`supabase/functions/_shared/bot-core.ts` (o carpeta `_shared/bot/` si crece
mucho — se decide en el plan de implementación según tamaño real). Esa
lógica deja de asumir `CLINIC_ID` fijo: recibe `clinic_id` como parámetro en
cada punto de entrada.

Cada canal queda como un adaptador delgado:

- `supabase/functions/telegram-webhook/index.ts` — parsea el payload de
  Telegram, resuelve `clinic_id` (sigue siendo fijo por ahora — Telegram no
  es multi-número en esta fase, solo WhatsApp lo es), llama al núcleo
  compartido, traduce la respuesta del núcleo a llamadas de la API de
  Telegram.
- `supabase/functions/whatsapp-webhook/index.ts` (nuevo) — parsea el payload
  de Meta Cloud API, resuelve `clinic_id` vía `phone_number_id` (ver sección
  3), llama al mismo núcleo compartido, traduce la respuesta a llamadas de
  Meta Cloud API (`POST /{phone_number_id}/messages`).

El núcleo compartido devuelve una estructura de "acción a tomar" agnóstica
de canal (ej. `{ type: "send_text", text: "..." }` /
`{ type: "send_buttons", text, options }`), y cada adaptador la traduce al
formato específico de su API. Esto evita que el núcleo tenga que conocer
los detalles de Telegram ni de WhatsApp.

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

- Unit/integración del núcleo compartido (`bot-core.ts`): casos ya
  cubiertos hoy por tests de `telegram-webhook` deben seguir pasando tras el
  refactor de la sección 2 — es la señal de que la extracción no rompió
  comportamiento existente.
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
