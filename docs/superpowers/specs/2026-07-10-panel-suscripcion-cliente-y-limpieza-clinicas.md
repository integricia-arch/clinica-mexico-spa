# Panel de suscripción self-service + archivado de clínicas de prueba + vista de canceladas — diseño

**Fecha**: 2026-07-10 (sesión 36, continuación tras pausa por costo)
**Estado**: aprobado por el usuario, pendiente de plan de implementación
**Depende de**: `docs/superpowers/specs/2026-07-09-panel-suscripciones-design.md` (edge function
`manage-subscription` ya existe: `update_modules`, `reactivate`, `suspend`, `cancel`, GET summary
con invoices — hoy todo staff-only salvo `cancel` que ya tiene self-service gate). Este spec NO
reimplementa esa función, la extiende.

## Pedido original del usuario (verbatim)

> "has esa ventana para el cliente como esta el spotyfi amazon etc y ten las opciones que dan
> estas plataformas y aplicala por cliente y tambien has un boton para limpiar y eliminar
> clientes ahorita que es prueba o quien cancele pasarlo a otra ventana estatus de cancelado
> revisa como es el mejor control de todos los casos posibles he implementalo"

Se descompuso en 3 piezas, un solo spec, tasks de implementación separadas.

## Estado actual verificado (2026-07-10)

- `clinics`: 4 filas. "Clínica Salud Integral MX" (real, 4 módulos, trialing). 2× clínica nombre
  "p" (0 módulos, creadas 2026-07-09, basura de prueba). "Santo Copo" (4 módulos,
  `subscription_status='canceled'` — caso real de cancelación, no basura).
- `clinics.status` (`active|inactive|suspended`, vía RPC `set_clinic_status`) y
  `clinics.subscription_status` (`trialing|active|past_due|canceling|canceled`, ciclo Stripe) son
  dos máquinas de estado independientes ya en producción. No existe columna `archived`.
- `manage-subscription` GET es staff-only (`isStaff === true`). Self-service (POST) hoy solo
  permite `action === 'cancel'` sobre la propia clínica (`canManageOwnSubscription`,
  `isSelfServiceActionForbidden`).
- `src/pages/configuracion/ConfiguracionPagos.tsx`, sección "Tu suscripción": lee `clinics`
  directo (no llama al GET de `manage-subscription`), no muestra módulos, precio desglosado,
  facturas ni método de pago. Solo cancelar/reactivar.
- `src/pages/AdminTenants.tsx`: listado sin filtros. `src/pages/AdminTenantDetail.tsx`: ya
  consume el GET summary completo (invoices, módulos, suscripción) — staff-only.

## Pieza A — Panel de suscripción self-service (`/configuracion/pagos`)

Objetivo: que el cliente vea y controle su suscripción como en Spotify/Amazon — plan, módulos
contratados con precio, método de pago, facturas — sin construir UI de tarjeta propia.

### Backend — extender `manage-subscription`

1. **GET**: cambiar el gate de `isStaff` a `isStaff || isSelf` (mismo helper
   `canManageOwnSubscription` que ya usa el POST de `cancel`). Un cliente autenticado puede pedir
   el summary de **su propia** `clinic_id`; sigue prohibido pedir el de otra.
2. **Self-service de `update_modules`**: extender `isSelfServiceActionForbidden` para permitir
   `update_modules` (además de `cancel`) cuando `isSelf`. Gate adicional: el payload de
   `modulo_ids` resultante no puede quedar vacío — si `modulo_ids.length === 0`, rechazar con
   `400` y mensaje claro ("la clínica debe tener al menos un módulo activo"). Sin cooldown ni
   review manual — cambio inmediato con `proration_behavior: "create_prorations"`, igual que el
   flujo staff ya implementado.
3. **Acción nueva `create_portal_session`**: `POST {action: "create_portal_session", clinic_id}`.
   Self-service permitido (mismo gate `isSelf`). Llama Stripe
   `billing_portal/sessions.create({customer: stripe_customer_id_saas, return_url: <url de
   vuelta a /configuracion/pagos>})`, devuelve `{url}`. No se construye formulario de tarjeta
   propio — el Customer Portal de Stripe ya maneja PCI compliance, cambio de tarjeta y ver
   facturas.

### Frontend — `ConfiguracionPagos.tsx`, sección "Tu suscripción"

- Pasa de leer `clinics` directo a llamar `GET manage-subscription?clinic_id=<propia>` al montar.
- Muestra: plan, lista de módulos contratados con precio individual y total mensual (mismo
  formato que `AdminTenantDetail.tsx`), próximo cobro, método de pago (marca + últimos 4, desde
  el summary — solo lectura, sin edición inline).
- Botón "Actualizar método de pago": llama `create_portal_session`, redirige a la `url` devuelta.
- Bloque módulos: checkboxes igual patrón que `AdminTenantDetail.tsx`, botón "Guardar cambios"
  habilitado solo si hay diff y el resultado deja ≥1 módulo marcado (deshabilitar submit si
  quedaría en 0, con mensaje inline). Modal de confirmación simple antes de enviar
  (`update_modules`) mostrando el nuevo total mensual.
- Historial de facturas: misma tabla que ya existe en `AdminTenantDetail.tsx` (fecha/monto/
  estado/link), alimentada por `invoices` del summary — componente compartido, no duplicar
  markup.
- Cancelar/reactivar: se mantienen igual (ya funcionan, no se tocan).

## Pieza B — Archivar (no borrar) clínicas de prueba

Objetivo: sacar del flujo operativo clínicas de basura/prueba sin destruir datos, reversible.

### Schema

- Migración nueva: `ALTER TABLE clinics ADD COLUMN archived_at timestamptz NULL;`. Columna
  ortogonal — no toca `status` ni `subscription_status`, no requiere cambiar sus CHECK
  constraints existentes.
- RPC nuevo `set_clinic_archived(_clinic_id uuid, _archived boolean)`, `SECURITY DEFINER`, mismo
  patrón de seguridad que `set_clinic_status` (checklist del `CLAUDE.md` del proyecto:
  `SET search_path = public`, `REVOKE EXECUTE FROM PUBLIC` + `GRANT` solo a rol staff/
  `authenticated` con check `is_global_admin` en el body, nunca `USING(true)`). Setea
  `archived_at = now()` si `_archived = true`, `NULL` si `false`.

### Frontend — `AdminTenants.tsx`

- Botón "Archivar" por fila (solo tab Activas/Canceladas — ver Pieza C), staff-only
  (`isGlobalAdmin`, guardia ya existente). Confirmación simple: "¿Archivar {name}? Se puede
  desarchivar después, no se borran datos."
- Clínicas archivadas quedan fuera del listado default (`archived_at IS NULL`), visibles solo en
  tab "Archivadas" (Pieza C) con botón "Desarchivar" (mismo RPC, `_archived = false`).
- Acceso bloqueado: clínica archivada bloquea login/acceso normal del cliente — reusar el mismo
  chequeo que ya existe para `status = 'suspended'` en el punto donde se valida acceso (evita que
  una clínica archivada "de prueba" siga operando).
- Candidatas iniciales a archivar (acción manual del admin post-implementación, no script de
  migración de datos): las 2 clínicas nombradas "p" (0 módulos, creadas 2026-07-09). Santo Copo
  **no** se archiva — es una cancelación real, pertenece a la Pieza C.

## Pieza C — Vista de clínicas canceladas (tab en `/admin/tenants`)

Objetivo: dar al admin un lugar donde ver, junto con archivadas, las clínicas que cancelaron de
verdad — sin fragmentar en una ruta nueva innecesaria (solo 4 clínicas hoy).

### Frontend — `AdminTenants.tsx`

- Tabs sobre el listado existente: **Activas** (default) / **Canceladas** / **Archivadas**.
  Filtro client-side sobre el mismo fetch ya existente (no se justifica paginación/filtro
  server-side con el volumen actual; revisar si crece).
  - Activas: `archived_at IS NULL AND subscription_status NOT IN ('canceling','canceled')`.
  - Canceladas: `archived_at IS NULL AND subscription_status IN ('canceling','canceled')`.
  - Archivadas: `archived_at IS NOT NULL`.
- Mismas columnas de tabla actuales. Acciones por tab:
  - Activas: Suspender / Reactivar (ya existentes) + Archivar (nuevo, Pieza B).
  - Canceladas: Reactivar (dispara flujo Stripe Checkout ya implementado en `manage-subscription`
    action `reactivate`) + Archivar.
  - Archivadas: Desarchivar (nuevo, Pieza B).

## Manejo de errores (las 3 piezas)

Mismo principio ya establecido en el spec del 2026-07-09 y en `CLAUDE.md`: Stripe se toca
primero, la DB solo se actualiza si Stripe confirma. `create_portal_session` no toca DB (solo
lee `stripe_customer_id_saas` y llama Stripe). `set_clinic_archived` es DB-only, sin Stripe
involucrado — el archivado es un flag interno, no cancela nada en Stripe (si se quiere cancelar
también la suscripción de una clínica archivada, es una acción separada del admin vía `cancel`,
no automática).

## Fuera de alcance (deliberado)

- Borrado real (`DELETE`) de clínicas — el pedido explícito es "limpiar" de forma reversible, no
  destruir.
- Cambiar tarjeta con formulario propio — delegado al Customer Portal (ya decidido).
- Filtro/paginación server-side en `/admin/tenants` — YAGNI con 4 clínicas; si el volumen crece,
  revisar.
- Auto-archivar clínicas por inactividad — el archivado es siempre una acción manual del admin.

## Testing

- Unit: gate `isSelfServiceActionForbidden` extendido (self-service permite `cancel` +
  `update_modules`, sigue rechazando `suspend`/`reactivate` de terceros); gate de "no dejar 0
  módulos" en `update_modules` self-service.
- Integración: `create_portal_session` contra Stripe test-mode (URL válida devuelta);
  `set_clinic_archived` RPC (archivar → desaparece de listado default → aparece en tab
  Archivadas → desarchivar → vuelve).
- Manual/E2E (correr en la misma sesión de implementación, no diferir — learning ya documentado
  en `STATE.md` tras costo de sesiones previas): cliente de prueba entra a
  `/configuracion/pagos`, ve sus módulos y facturas, agrega un módulo, confirma prorrateo en
  Stripe test-mode; admin archiva una de las clínicas "p", confirma que desaparece del listado
  activo y aparece en Archivadas; admin ve Santo Copo en tab Canceladas.
