# Auditoría de uso de la service role key en Edge Functions

**Fecha**: 2026-07-11
**Contexto**: Task 7 (última) del plan de endurecimiento de seguridad (blast radius).
**Patrón de referencia usado como vara de medir**: `assertClinicAccess()` en
`supabase/functions/manage-subscription/index.ts:186` — valida clinic_id
contra la sesión del caller (vía `clinic_memberships`) antes de cualquier
operación con privilegios elevados.

**Convención observada en el codebase**: el rol `admin` en `user_roles` es
**global** (staff de la plataforma) y bypassa el check de clínica por diseño
en varias funciones ya existentes (`cfdi-acuse`, `cfdi-cancelar`, `cfdi-email`,
`cfdi-rep`, `cfdi-timbrar`, `admin-users`). Esto se trató como patrón
aceptado, no como hallazgo. El problema real detectado es que varios roles
**clínica-scoped** (`receptionist`, `manager`, o cualquier staff autenticado)
solo se verificaban de forma global (¿tiene el rol X en ALGUNA clínica?) sin
cruzarlo contra la clínica dueña del recurso que se estaba leyendo/escribiendo.

| # | Función | Filtra por clinic_id | Fuente del clinic_id | Veredicto |
|---|---|---|---|---|
| 1 | admin-users | N/A — consola de admin global | Rol `admin` global (user_roles) | Fuera de alcance — no es multi-tenant por diseño |
| 2 | arco-request | N/A — insert público sin lectura | `clinic_name` es texto libre, no se usa para filtrar | Fuera de alcance |
| 3 | auto-reorder | Sí, itera `clinics` (o clinic_id opcional del body) | Cron secret / service role — no hay JWT de usuario final | OK — caller de confianza (cron), procesa multi-clínica por diseño |
| 4 | cfdi-acuse | Sí, `.eq("clinic_id", clinic_id)` cruzado con `cfdi_id` | Body + rol admin global | OK |
| 5 | cfdi-cancelar | Sí | **Membresía del usuario**, no el body (línea 64-77) | OK — ya sigue el patrón assertClinicAccess |
| 6 | cfdi-download | Sí, pero con bug | `clinic_memberships` del usuario | **Corregido** (commit `2683e11`) |
| 7 | cfdi-email | Sí, `.eq("clinic_id", clinic_id)` cruzado con `cfdi_id` | Body + rol admin global | OK |
| 8 | cfdi-parse | No (antes del fix) | Body/formData sin validar | **Corregido** (commit `6a4a428`) |
| 9 | cfdi-rep | Sí, `.eq("clinic_id", clinic_id)` cruzado con `cfdi_id` | Body + rol admin global | OK |
| 10 | cfdi-set-credentials | Sí | `clinic_memberships` (rol admin/manager) | OK — ya sigue el patrón assertClinicAccess |
| 11 | cfdi-timbrar | Sí, config y receptor filtrados por clinic_id | Body + rol admin global | OK |
| 12 | confirmar-cita | No (antes del fix) | Rol global sin cruzar con clínica de la cita | **Corregido** (commit `a5e0a9b`) |
| 13 | create-appointment | No (antes del fix) | doctor_id sin validar clínica; clinic_id no se seteaba | **Corregido** (commit `25cc84c`) |
| 14 | enviar-mensaje-humano | No (antes del fix) | Rol global sin cruzar con clínica de la conversación | **Corregido** (commit `8cae248`) |
| 15 | enviar-recordatorios | Sí | Membresía del usuario (cron/service key exento) | **Corregido** (2026-07-11, seguimiento) |
| 16 | google-oauth-callback | N/A — enrutamiento OAuth | `state` param generado server-side en un flujo ya autenticado | Fuera de alcance (ya documentado en CLAUDE.md) |
| 17 | help-chat-ai | Sí, vía ownership de la sesión | `.eq("user_id", user.id)` en `ayuda_chat_sesiones` | OK — el filtro relevante es dueño de sesión, no clínica |
| 18 | loyalty-welcome | Sí | Membresía del usuario (auth.getUser + clinic_memberships) | **Corregido** (2026-07-11, seguimiento) |
| 19 | notify-appointment-assigned | Sí | Membresía del usuario | **Corregido** (2026-07-11, seguimiento) |
| 20 | notify-cxp-vencimiento | Sí, agrupa y notifica por clínica | Cron secret / service role / JWT admin-manager | OK — itera todas las clínicas por diseño (digest) |
| 21 | notify-doctor-confirmation | Sí | Ownership: `appt.doctors.user_id === caller.id` (o admin) | OK — ya sigue el patrón correcto |
| 22 | notify-new-user | N/A — notificación a admins globales | Shared secret (trigger de BD) | Fuera de alcance |
| 23 | notify-nurse-assignment | Sí | Membresía del usuario | **Corregido** (2026-07-11, seguimiento) |
| 24 | seed-demo-data | N/A — seed global gateado por env var + admin | `ALLOW_SEED_DEMO` + rol admin | Fuera de alcance |
| 25 | stripe-payment-intent | No (antes del fix) | Rol global (admin/receptionist) sin cruzar con clínica del cobro | **Corregido** (commit `9d49d13`) |
| 26 | stripe-webhook | N/A — no usa clinic_id de un caller | Firma HMAC de Stripe (`stripe-signature`) | OK |
| 27 | telegram-webhook (+google-calendar.ts) | Sí | Variable de entorno fija por deployment (una clínica por bot) | Fuera de alcance (ya documentado en CLAUDE.md) |

## Funciones corregidas en esta sesión

Todas siguen el mismo patrón: agregar una validación explícita de
`clinic_memberships` (o de la clínica dueña del recurso) al inicio del
handler, antes de cualquier lectura/escritura privilegiada — el mismo patrón
de `assertClinicAccess`. Un commit por función, con su propio test.

1. **cfdi-download** — commit `2683e11`. El check de pertenencia se saltaba
   por completo cuando el usuario no tenía ninguna fila en `clinic_memberships`
   (`userClinicIds.length > 0 && ...`), permitiendo descargar el CFDI de
   cualquier clínica. Fix: `admin` (rol global) bypassa, cualquier otro rol
   permitido siempre se valida contra la clínica del documento.
   Test: `access-gate.test.ts` (4 casos).

2. **cfdi-parse** — commit `6a4a428`. No validaba ningún rol ni membresía —
   solo requería un JWT válido de cualquier usuario autenticado. Aceptaba
   `clinic_id` y `factura_proveedor_id` del body/formData sin cruzarlos
   contra `clinic_memberships`, permitiendo leer el catálogo de medicamentos
   y escribir `fp_cfdi`/`fp_cfdi_lineas`/`facturas_proveedor` de cualquier
   clínica. Fix: exige membresía activa en la clínica solicitada y que la
   factura de proveedor pertenezca a esa misma clínica.
   Test: `clinic-membership.test.ts` (3 casos).

3. **confirmar-cita** — commit `a5e0a9b`. El check de rol solo verificaba
   que el usuario tuviera `admin`/`manager`/`receptionist` en **alguna**
   clínica, sin cruzarlo contra la clínica dueña de la cita — permitía
   confirmar/cancelar/liberar citas de cualquier clínica conociendo el
   `appointment_id`. Fix: se carga el `clinic_id` de la cita antes de
   actualizar y se exige rol permitido específicamente en esa clínica.
   Test: `clinic-access.test.ts` (4 casos).

4. **create-appointment** — commit `25cc84c`. El insert no seteaba
   `clinic_id` en la cita (quedaba `NULL`) y el staff no se validaba contra
   la clínica real del `doctor_id` enviado — un receptionist de una clínica
   podía crear una cita para un doctor de otra. Fix: exige membresía del
   staff en la clínica del doctor y persiste `clinic_id: doctor.clinic_id`.
   Test: `clinic-access.test.ts` (3 casos).

5. **enviar-mensaje-humano** — commit `8cae248`. El check de rol
   (`admin`/`receptionist`/`doctor`/`nurse`) era global — no se cruzaba
   contra la clínica dueña de la conversación. Fix: exige membresía del
   caller en la clínica de la conversación antes de reenviar el mensaje por
   Telegram. Test: `clinic-access.test.ts` (3 casos).

6. **stripe-payment-intent** — commit `9d49d13`. El check de rol
   (`admin`/`receptionist`) era global — no se cruzaba contra la clínica del
   cobro enviada en el body. Fix: exige membresía activa del caller en esa
   clínica antes de crear el PaymentIntent. Test: `clinic-access.test.ts`
   (3 casos).

## Hallazgos menores — corregidos en sesión de seguimiento (2026-07-11)

Los 4 hallazgos menores que quedaron pendientes de Task 7 se corrigieron en
la misma sesión: mismo patrón `clinic_memberships` que las funciones ya
corregidas arriba — módulo `clinic-access.ts` testeable + `isClinicAccessForbidden`
cruzado contra la clínica del recurso, un test por función.

- **enviar-recordatorios**: un `recordatorio_id` de otra clínica podía ser
  disparado manualmente por un admin/receptionist de una clínica distinta.
  Fix: si el bearer no es la service-role key (modo cron, confiable por
  diseño), se exige membresía del caller en la clínica dueña de la cita del
  recordatorio antes de procesarlo.
- **notify-appointment-assigned** / **notify-nurse-assignment**: mismo
  patrón — `appointment_id` de otra clínica podía disparar una notificación
  (Telegram/email) al paciente/doctor/enfermera correctos de esa otra
  clínica. Fix: se exige membresía del caller en la clínica dueña de la
  cita antes de notificar. `notify-nurse-assignment` no validaba ningún rol
  (solo JWT válido) — ahora también exige la membresía.
- **loyalty-welcome**: no validaba ningún JWT propio (dependía solo del
  gateway `verify_jwt=true`) ni cruzaba `member_id`/`clinic_id` contra la
  clínica del caller. La recomendación original de este documento (shared
  secret como `notify-new-user`) no aplica aquí: la función se invoca desde
  el browser con el JWT del usuario (`LoyaltyAfiliacionModal.tsx`), no como
  webhook servidor-servidor — un shared secret quedaría expuesto en el
  bundle del cliente. Fix real: `supabase.auth.getUser()` + exigir
  membresía del caller en la clínica del miembro, mismo patrón que las
  otras 3.

## Funciones fuera de alcance de clinic_id (justificar por qué)

- **admin-users**, **cfdi-set-credentials** (ownership ya validado),
  **seed-demo-data**: consolas de administración global gateadas por el rol
  `admin` (global) — mismo patrón ya aceptado en el resto del codebase.
- **arco-request**: endpoint público de solo inserción (LFPDPPP), no lee
  datos existentes de ninguna clínica.
- **auto-reorder**, **notify-cxp-vencimiento**: jobs de cron/servicio que
  iteran deliberadamente **todas** las clínicas activas — el "filtro" es la
  autenticación por secreto de cron o service role, no un `clinic_id` de
  caller.
- **google-oauth-callback**: solo enrutamiento del intercambio OAuth; el
  `state` (`doctorId:clinicId`) se genera server-side en un flujo ya
  autenticado antes de redirigir a Google — ya documentado en el `CLAUDE.md`
  del proyecto.
- **help-chat-ai**: el filtro relevante es la propiedad de la sesión de
  chat (`user_id`), no la clínica — el `clinic_id` del body solo se usa
  para sugerir FAQs (lectura no sensible).
- **notify-doctor-confirmation**: ya valida ownership directo
  (`appt.doctors.user_id === caller.id`) antes de admin bypass — sigue el
  patrón correcto.
- **notify-new-user**: notificación a administradores globales sobre un
  registro nuevo, gateada por un secreto compartido con el trigger de base
  de datos — no hay concepto de clínica aplicable.
- **stripe-webhook**: verifica la firma HMAC de Stripe (`stripe-signature`)
  en vez de un JWT de usuario — no hay `clinic_id` de caller que validar.
- **telegram-webhook**: el `clinic_id` se resuelve de una variable de
  entorno fija por deployment (un bot de Telegram = una clínica), nunca de
  un parámetro del caller — ya documentado en el `CLAUDE.md` del proyecto.
