# Estado del Proyecto — clinica-mexico-spa

## Fase actual
Producción activa — desarrollo iterativo de features de caja/farmacia

## Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind + shadcn/ui
- **Backend**: Supabase (proyecto: `kyfkvdyxpvpiacyymldc`)
- **Deploy**: Cloudflare Workers (`https://clinica-mexico-spa.integric-ia.workers.dev`)
- **Dominio**: `https://integrika.mx`

## Completado (Jun 2026)

### Farmacia POS
- [x] Punto de Venta con carrito, catálogo, escáner
- [x] Cobro efectivo / tarjeta / transferencia / mixto / pendiente
- [x] Mixto auto-calc: efectivo ↔ tarjeta se calculan solos
- [x] Ticket interno con desglose IVA correcto (proporcional al descuento global)
- [x] Overflow fix: ticket no se sale de viewport
- [x] `forceMount` en TabsContent "pos" → carrito persiste al cambiar tab

### Corte de Caja
- [x] `cortes` tabla con folio SEQUENCE (`cortes_folio_seq`)
- [x] Corte Z (cierre turno farmacia) con conteo ciego
- [x] Corte X (parcial sin cerrar) con folio X-xxxxxx
- [x] Egresos/Ingresos del fondo (`fondos_movimientos`)
- [x] UI completa en CajaTurno.tsx (historial, diff badges, etc.)
- [x] RPCs: `turno_corte_x`, `turno_close`, `turno_fondo_movimiento`
- [x] **Ciclo pharmacy shift completo**: `pharmacy_open_shift` idempotente + `turno_close` cierra shift (Jun 10)
- [x] **IVA persistido**: `pharmacy_register_sale` guarda `total_iva`, `base_imponible`, `iva_amount` (Jun 10)

### Responsive (Jun 10)
- [x] Sidebar: `useSidebarState` hook, xl breakpoints, desktop collapse
- [x] POS: grid xl:3-col / md:2-col, frecuentes acordeón, sticky cobro, touch targets
- [x] Facturación: columnas lg→xl para tablet

### Modo Foco + Flujo Guiado (Jun 10)
- [x] `AppLayout`: sidebar auto-oculto en `/caja*` y `/farmacia*`; ☰ siempre visible en focus routes
- [x] `ProtectedRoute`: role-home redirect — cajero→/caja, nurse→/farmacia, manager→/caja
- [x] `TurnoGuard`: state machine loading→no-turno→open→closing; provee `useTurno()` context
- [x] `TurnoOpenWizard`: wizard full-screen selecciona caja→fondo→confirmar (abre turno+pharmacy_shift)
- [x] `TurnoCloseWizard`: wizard full-screen conteo ciego→diff→supervisor override→Corte Z
- [x] `Caja.tsx`: badge turno activo + botón "Cerrar turno" vía `initiateClose()`
- [x] `App.tsx`: `/caja` y `/farmacia` envueltos en `TurnoGuard`
- [x] `LockScreen.tsx`: pantalla de bloqueo con verificación de contraseña
- [x] User dropdown: Bloquear / Cambiar usuario / Cerrar sesión
- [x] `Farmacia.tsx` renombrada a "Caja" en UI; tab "Cierre" con CajaTurno + CorteTurno
- [x] Fix carga infinita en cajero: `clinicLoading` guard en TurnoGuard + clinic_membership insertado

### Auditoría
- [x] Tab "Farmacia / Caja" en Auditoría con logs técnicos
- [x] `pos_error_logs` + `audit_logs` filtrados por farmacia/caja

### Auth / UX global
- [x] `TOKEN_REFRESHED` e `INITIAL_SESSION` ya NO hacen `setLoading(true)` → páginas no desmontan al renovar JWT
- [x] Layout 3 paneles POS: sticky + `max-h-[calc(100vh-6rem)]` en los 3 paneles
- [x] `beforeunload` warning cuando hay carrito activo

## Completado (Jun 12, 2026 — sesión 4)

### Feature: crear citas desde admin
- [x] `NuevaCitaDialog`: búsqueda paciente (autocomplete debounce), select médico, fecha/hora, duración (default 30 min), servicio opcional, motivo opcional
- [x] `Agenda.tsx`: botón "Nueva cita" conectado, pre-llena fecha del día
- [x] `Citas.tsx`: botón "Nueva cita" en header
- [x] PR #4 mergeado (`375e937`), deploy `f5b463b1`

## Completado (Jun 12, 2026 — sesión 3)

### Bug fix: pharmacy PIN override
- [x] Nueva RPC `pharmacy_close_shift_with_pin`: verifica PIN bcrypt, valida rol, delega a `pharmacy_close_shift`
- [x] `SupervisorAuthDialog` modo pharmacy PIN path: usa `pharmacy_close_shift_with_pin`
- [x] PR #3 mergeado (`a8b5c69`), deploy `c4615a64`

## Completado (Jun 12, 2026 — sesión 2)

### Bug fix: autorizado_by
- [x] `turno_close`: `p_supervisor_id uuid DEFAULT NULL`; `autorizado_by = COALESCE(p_supervisor_id, v_user)`
- [x] `pharmacy_close_shift`: mismo fix
- [x] `turno_close_with_pin`: pasa `p_supervisor_id` al delegar
- [x] `SupervisorAuthDialog`: password-fallback pasa `p_supervisor_id`; pharmacy mode llama `pharmacy_close_shift`
- [x] PR #2 mergeado a main (`5ef9d6c`), deploy versión `246bfb1f`

## Completado (Jun 12, 2026)

### DB local SQL Server — schema sync
- [x] `medicamentos`: agregadas `clinic_id`, `is_controlled`, `sale_type`, `requires_prescription`, `requires_retained_prescription`, `requires_special_prescription`, `allow_direct_sale`, `regulatory_notes`, `barcode`, `sku`, `codigo_interno`, `laboratorio`, `presentacion`, `registro_sanitario`, `tasa_iva`
- [x] `lotes_medicamento`: agregadas `clinic_id`, `fecha_entrada`, `costo_unitario`
- [x] `movimientos_inventario`: agregadas `clinic_id`, `reference_type`, `reference_id`
- [x] Sync limpio: 51/51 medicamentos, 51/51 lotes, 61/61 movimientos — 0 errores

### Git / Deploy
- [x] PR #1 creado y mergeado a `main` (squash commit `4179e9d`)
- [x] `git pull origin main` — local al día
- [x] Deploy Cloudflare Workers versión `3ca00e63`

## Completado (Jun 11, 2026)

### Arqueo de caja — todos los GAPs (A–F)
- [x] GAP-F: Devoluciones efectivo antes del conteo ciego — `fondos_movimientos` ILIKE 'Reembolso%'
- [x] GAP-E: Fondo siguiente turno vs efectivo depósito — columnas + RPC `corte_set_fondo`
- [x] GAP-D: Acta de arqueo imprimible — `printActaArqueo.ts`, HTML autocontenido, window.print()
- [x] GAP-B: Conciliación tarjeta vs TPV — columnas + RPCs, `PagoReconcile metodo="tarjeta"`
- [x] GAP-C: Conciliación transferencias/SPEI — columnas + RPCs genéricos `get_corte_pago_total`
- [x] GAP-A: Denominaciones billetes/monedas — `DenominacionCounter.tsx`, sin DB
- [x] GAP-G: Verificado NOT a bug (RPCs filtran estado='pagado'/'completed' correctamente)

### Columnas nuevas en `cortes`
`fondo_siguiente_turno`, `efectivo_deposito`, `tarjeta_tpv_declarado`, `tarjeta_tpv_diferencia`, `transferencia_declarado`, `transferencia_diferencia`

### Plan farmacia-caja-trazabilidad (10 tareas — todas completas)
- [x] Nav menu con grupos Clínica / Operaciones / Admin
- [x] Página Caja.tsx unificada (Turno + Corte tabs)
- [x] Farmacia: eliminado tab "Corte de Caja"
- [x] Stock badges en PrescriptionEditorModal (`stockMap`)
- [x] Lista recetas pendientes en SurtirReceta (`pendingRx`)
- [x] `almacen_alertas` tabla + insert al emitir receta + resolve al surtir
- [x] Sub-tab "Faltantes" en Farmacia Inventario
- [x] `SectionCaja` en Ajustes: campo `umbral_diferencia` + `fondo_minimo` persistidos en `clinic_settings/caja`

### Supervisor PIN (plan 2026-06-11-supervisor-pin.md — COMPLETO)
- [x] Migration `_tmp_supervisor_pin.sql`: `profiles.supervisor_pin_hash`, RPCs `set_supervisor_pin`, `get_clinic_supervisors`, `turno_close_with_pin`
- [x] Componente `SupervisorAuthDialog` — PIN numérico o contraseña fallback
- [x] `TurnoCloseWizard.tsx` — reemplazado bloque inline por `SupervisorAuthDialog`
- [x] `CajaTurno.tsx` — reemplazado bloque inline por `SupervisorAuthDialog`
- [x] `ShiftPanel.tsx` — reemplazado bloque inline por `SupervisorAuthDialog`
- [x] `AdminUsuarios.tsx` — rol `manager` agregado, PIN obligatorio en creación admin/manager, diálogo Set PIN
- [x] Build limpio (commits: 59b3b71, bd85856, + 4 más → cfa9fd7)

## Completado (Jun 12, 2026 — sesión 5)

### Módulo CFDI + Pagos — Fase 1 (fundación)
- [x] Investigación formal CFDI 4.0, PACs y pasarelas de pago → `memoria/proyectos/cfdi-facturacion-electronica.md`
- [x] Migration `cfdi_y_pagos_fase1`: 6 tablas nuevas con RLS:
  - `cfdi_config` — emisor, CSD, PAC por clínica (UNIQUE clinic_id)
  - `cfdi_receptores` — datos fiscales de pacientes (RFC, régimen, CP)
  - `cfdi_documentos` — CFDI timbrados (UUID SAT, XML, PDF path, estados)
  - `cfdi_conceptos` — líneas de cada CFDI
  - `payment_gateway_config` — Stripe/Conekta por clínica (UNIQUE clinic_id)
  - `payment_transactions` — cobros procesados (card, oxxo, spei)
- [x] `ConfiguracionCFDI.tsx` (`/configuracion/facturacion`): form emisor, CSD, PAC + test conexión
- [x] `ConfiguracionPagos.tsx` (`/configuracion/pagos`): Stripe + métodos + terminal física
- [x] `Configuracion.tsx`: tarjetas "Facturación y CFDI" y "Cobros y pagos digitales" con ruta activa
- [x] `App.tsx`: rutas `/configuracion/facturacion` y `/configuracion/pagos` registradas
- [x] Deploy exitoso: `f9c0f33f`
- PAC recomendado: **Facturama** (sandbox: apisandbox.facturama.mx, REST/JSON, HTTP Basic)
- Pasarela recomendada: **Stripe** (3.6% + $3 MXN IVA incluido, SDK TS, Terminal física)

## Completado (Jun 12, 2026 — sesión 6)

### Módulo CFDI — Fase 2 (emisión real)
- [x] Edge function `cfdi-timbrar` desplegada (v1, ACTIVE) — timbre CFDI 4.0 vía Facturama API v3
- [x] Edge function `cfdi-download` desplegada (v1, ACTIVE) — descarga XML/PDF desde PAC o caché BD
- [x] `TimbrarCFDIDialog.tsx` — diálogo completo: búsqueda receptor, conceptos dinámicos, cálculo IVA, submit al edge function
- [x] `Facturacion.tsx` reescrito — datos reales desde `cfdi_documentos`, tabla paginada, búsqueda, descarga XML/PDF, copy UUID, botón "Nueva factura CFDI"
- [x] Deploy frontend versión `4a47d623`

## Completado (Jun 12, 2026 — sesión 6 cont.)

### Módulo CFDI — Fase 3
- [x] Migration: bucket `csd-files` (privado, RLS admin), cols `csd_cer_path`/`csd_key_path` en `cfdi_config`
- [x] Edge function `cfdi-cancelar` (v1, ACTIVE) — DELETE Facturama, 4 motivos SAT, UUID sustituto motivo 01, audit log
- [x] `Facturacion.tsx`: dropdown "Cancelar CFDI" + dialog con motivo + campo sustituto condicional
- [x] `ConfiguracionCFDI.tsx`: upload real .cer/.key a `csd-files/{clinic_id}/`, indicador archivo subido
- [x] Deploy `0806a0f5`

## Completado (Jun 13, 2026 — sesión 7)

### CFDI — Fases 4 y 5 (sesión anterior, actualizado aquí)
- [x] Edge function `cfdi-rep` v1 ACTIVE — Complemento de Pagos 2.0 (tipo P)
- [x] `cfdi-timbrar` v2 — soporte `InformacionGlobal` para Factura Global
- [x] `RegistrarPagoREPDialog.tsx` — diálogo REP en Facturacion.tsx
- [x] `FacturaGlobalDialog.tsx` — XAXX010101000 + periodicidad SAT
- [x] `cfdi-cancelar` v1 ACTIVE — cancelación 4 motivos SAT
- [x] Merge `feat/pos-criticos-iva-devoluciones` → `origin/main` (`81f2bec`)

### Stripe completo
- [x] `stripe-payment-intent` v1 ACTIVE + `stripe-webhook` v1 ACTIVE
- [x] `StripePaymentModal.tsx` en DetalleCita
- [x] `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` en Supabase Secrets
- [x] `payment_gateway_config` con `pk_live_` de producción
- [x] Webhook registrado en Stripe Dashboard

### Stripe checkout pitch
- [x] `stripe-checkout` edge function v1 ACTIVE (verify_jwt: false)
- [x] Pitch.tsx: botones "Suscribirme" → Stripe Hosted Checkout
- [x] Precios server-side: Esencial $2,499 / Profesional $5,999 MXN/mes

### Stripe en POS farmacia
- [x] `PuntoDeVenta.tsx`: botón "Cobrar con Stripe" (visible cuando método=tarjeta)
- [x] `handleStripeSuccess` pre-llena breakdown.card con paymentIntentId
- [x] `submitSale(bdOverride)` acepta breakdown override para flujo Stripe
- [x] Deploy `86446746` en integrika.mx

## Completado (Jun 13, 2026 — sesión 8)

### Fixes críticos post-revisión (commit `55abbdd`, deploy `94264420`)
- [x] **stripe-payment-intent**: `client_secret` eliminado de columna `metadata` en BD
- [x] **stripe-webhook**: HMAC constant-time (bitwise XOR en lugar de `===`)
- [x] **cfdi-cancelar**: `encodeURIComponent` en `cfdi_sustitucion` y `pac_id_externo`
- [x] **cfdi-download**: validar `format` (solo xml/pdf); verificar `clinic_id` del usuario vs CFDI
- [x] **cfdi-timbrar**: capturar error de query de roles → 500 en lugar de denegar silenciosamente
- [x] **PuntoDeVenta**: `itemsDiscount` multiplicado por `quantity`; `blocked`→`blockReason` en catálogo
- [x] **Agenda**: `.limit(3)` eliminado en fetch de doctores
- [x] **Farmacia**: validar que cantidad salida no exceda existencia antes de update
- [x] **CajaTurno**: `cajaNombre` via `cajas.find(caja_id)` en lugar de `turno.caja_nombre` (inexistente)
- [x] **DetalleCita**: AlertDialog de confirmación antes de cancelar cita
- [x] **LockScreen**: rate limiting — bloqueo 30s tras 3 intentos fallidos
- [x] Revisión completa → `docs/mejoras-correcciones.md` generado
- [x] **useAuth + useActiveClinic**: roles scoped a clínica activa via `setClinicRoles()` + `clinic_memberships.role`
- [x] **Farmacia inventario**: RPC `increment_lote_existencia` (atómico) + migración aplicada

## Completado (Jun 13, 2026 — sesión 9)

### Fixes ALTOS + MEDIOS post-revisión

#### Fixes 🟠 ALTO — commit `de4bcf9`
- [x] **stripe-payment-intent**: cap 500,000 MXN por transacción
- [x] **cfdi-cancelar**: clinic_id desde clinic_memberships (no del body)
- [x] **cfdi-rep**: IVA desde cfdi_conceptos real; CP receptor requerido
- [x] **useAuth**: signOut limpia localStorage.activeClinicId
- [x] **App.tsx**: /cita/:id con ProtectedRoute y roles
- [x] **AppLayout**: conversaciones filtradas por clinic_id activo
- [x] **Farmacia h1**: "Caja" → "Farmacia"
- [x] **RecepcionDashboard**: actualización inmutable (map en lugar de forEach+mutation)
- [x] **CajaTurno**: DIFF_EXCEEDS_THRESHOLD parse con Number.isFinite
- [x] **PaymentCapture**: monto_recibido en modo mixto sincronizado
- [x] **Agenda**: loadAppointments con useCallback; realtime sin stale closure
- [x] **NuevaCitaDialog**: defaultDatetime en useEffect; timezone -06:00 en submit

#### Fixes 🟡 MEDIO — commits `689193e`, `10e68a6`, `67427e9`
- [x] **stripe-webhook**: log warning cuando count===0; metadata merge en payment_failed
- [x] **cfdi-timbrar**: env var validation explícita; cfdi_conceptos error handling
- [x] **cfdi-rep**: validación aritmética SAT (saldo_anterior - monto ≈ saldo_insoluto)
- [x] **Citas.tsx**: statusMeta() fallback para estados desconocidos (no crash)
- [x] **Citas.tsx**: rangos de fecha con offset -06:00 (CDMX timezone)
- [x] **Login.tsx**: post-login respeta location.state.from (redirect a ruta original)
- [x] **ProtectedRoute**: pasa state={{ from }} al redirect a /login
- [x] **ConfiguracionCFDI**: select excluye pac_contrasena/csd_contrasena del browser
- [x] **PacientesLista**: búsqueda server-side con ilike+debounce; limit 100; count exact
- [x] **Farmacia loadAlertas**: useCallback([filtroAlertas]); elimina eslint-disable con loop oculto
- [x] **TicketInterno**: style de impresión via useEffect+cleanup (no acumula en DOM)
- [x] **Expedientes**: doctors cargados en mount; nota enriquecida con doctor real; cache siempre refresca

### Fixes 🟢 BAJO completados — commits `9aec1f7`, `e0b1ead`
- [x] **NuevaCitaDialog**: setSearching(false) en early return (spinner infinito al borrar)
- [x] **Inbox**: CANAL_META fallback ?? { label: canal_id } (no crash si canal nuevo)
- [x] **Recetas**: STATUS_LABELS fallback muestra status real (no "Emitida" para desconocidos)
- [x] **TicketInterno**: llama onClose() si open=true pero data=null
- [x] **AdminUsuarios**: fetchUsers con try/catch+finally (loading no queda true)
- [x] **PrescriptionEditorModal**: siempre actualiza diagnosis (permite limpiar)
- [x] **ErrorBoundary**: muestra error.message + botones "Recargar" y "Reintentar"
- [x] **Facturacion**: VITE_SUPABASE_URL con .replace(/\/$/, "")
- [x] **cfdi-cancelar/download/rep/stripe-payment-intent**: (r: any) → (r: { role: string })
- [x] **useAuth**: setTimeout(0) → queueMicrotask (más predecible)
- [x] **useActiveClinic**: catch (e: any) → catch (e: unknown)
- [x] **AppLayout**: eliminar isDesktop sin resize listener (variable no usada)
- [x] **PuntoDeVenta**: folio slice(0,8) → slice(0,12) (menos colisiones)
- [x] **CajaTurno**: CorteRow + turno_id; cortesData as CorteRow[] (no any[])
- [x] **DetalleCita**: RecordatorioCita interface; recordatorios state tipado
- [x] **cfdi-timbrar**: console.error sin JSON.stringify(facData) completo

### ALTOS diferidos — TODOS RESUELTOS (Jun 14 sesión 13)
- [x] **ConfiguracionCFDI**: Vault ya implementado — `cfdi-set-credentials` edge function + `pac_secret_id` en `cfdi_config`
- [x] **AdminUsuarios**: doctors insert tiene `clinic_id`; `toggle_role`/`set_base_password_all` scope vía `clinic_memberships`
- [x] **CajaTurno:719**: `(supabase as any).from("cortes")` → `restSelect()` (misma API que audit log)
- [x] **restClient.ts**: archivo limpio, no tiene `(supabase as any)` — falso positivo
- [x] **stripe-payment-intent**: ambiente check `sk_live_`/`rk_live_` vs `config.ambiente` ya implementado

### BAJOs diferidos (trade-off consciente)
- [ ] **Farmacia**: forceMount en TabsContent "pos" — intencional para preservar carrito, causaría regresión UX si se elimina
- [ ] **PuntoDeVenta**: "pendiente" disponible para meds controlados — requiere lógica cart+categoría
- [ ] **Expedientes**: query como string literal en restSelect — inherente al cliente REST

## Pendiente / Próximo

### Revisión completa del proyecto
- [x] Agente revisor → `docs/mejoras-correcciones.md` (sesión 8)
- [x] Fixes 🔴 CRÍTICO — todos resueltos (sesión 8)
- [x] Fixes 🟠 ALTO — 13/28 resueltos (5 diferidos por complejidad)
- [x] Fixes 🟡 MEDIO — todos resueltos
- [x] Fixes 🟢 BAJO — 16/18 resueltos (2 diferidos, 1 trade-off consciente)

### CFDI
- [x] Notas de crédito (tipo E) — commit c3e24fc
- [x] Acuse receptor en cancelación — commit f731c53

### Completado (Jun 14 sesión 11)
- [x] `prescriptions` + `prescription_items` + `patient_checkout_events` en prod
- [x] RPC `generate_prescription_number_for_doctor`
- [x] BetterStack: flush inmediato en errores + startup ping → verificado ✓
- [x] Cloudflare WAF: `not MX → Managed Challenge` + Bot Fight Mode
- [x] GitHub Actions: Node 24 opt-in (deadline Jun 16)
- [x] Documento E-R: `memoria/proyectos/er-sistema.md`

### Completado (Jun 14 sesión 13)
- [x] **ALTOS diferidos**: todos 5 verificados/resueltos (ver sección arriba)
- [x] **CajaTurno**: `(supabase as any).from("cortes")` eliminado → `restSelect()` con PostgREST `in.(...)` syntax
- [x] **Reconciliación turnos generales**: `get_corte_pago_total` extendido para incluir `movimiento_pagos` (tarjeta/transferencia SAT codes) además de pharmacy sales — `PagoReconcile` ahora funciona para cajas no-farmacia

### Completado (Jun 14 sesión 12)
- [x] `monitoring_alerts` tabla en Supabase — almacena incidents de BetterStack
- [x] GET `/health` agregado a `cfdi-timbrar`, `cfdi-email`, `telegram-webhook` → devuelven 200
- [x] 4 monitores DOWN eliminados y recreados apuntando a endpoints que devuelven 200:
  - Supabase REST → `/rest/v1/profiles?limit=1&select=id` + anon key
  - cfdi-timbrar → GET /functions/v1/cfdi-timbrar → 200
  - cfdi-email → GET /functions/v1/cfdi-email → 200
  - telegram-webhook → GET /functions/v1/telegram-webhook → 200
- [x] **Los 6 monitores BetterStack ahora están UP** (commit `6a8f2d8`)

### Bugs conocidos
- (ninguno activo)

## Reglas críticas
- SQL con `$function$` → SIEMPRE escribir `_tmp_*.sql` y usar `--file`
- Secrets: env-only, nunca en código
- `patients.sexo` CHECK: solo `'M'`, `'F'`, `'Otro'`
- `patients` no tiene `domicilio_ciudad` → usar `municipio`
- `verify_jwt = false` en telegram-webhook

## Archivos clave
- `src/features/farmacia/PuntoDeVenta.tsx` — POS principal
- `src/features/farmacia/PaymentCapture.tsx` — captura de pagos
- `src/features/farmacia/TicketInterno.tsx` — ticket con IVA
- `src/pages/CajaTurno.tsx` — turnos generales con cortes X/Z
- `src/pages/Auditoria.tsx` — logs con tab Farmacia/Caja
- `src/hooks/useAuth.tsx` — auth con TOKEN_REFRESHED fix
- `supabase/migrations/_tmp_fix_turno_close_fallback.sql` — turno_close fallback pharmacy shift
- `supabase/migrations/_tmp_fix_pharmacy_iva.sql` — IVA en pharmacy_register_sale
- `supabase/migrations/_tmp_fix_pharmacy_shift_lifecycle.sql` — ciclo completo open/close shifts
