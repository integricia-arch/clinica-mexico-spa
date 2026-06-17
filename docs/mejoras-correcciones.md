# Revisión Completa del Proyecto — clinica-mexico-spa
**Fecha:** 2026-06-13  
**Sesión:** 8 — Revisión post-Stripe  
**Agentes:** 4 paralelos (POS/Caja, CFDI/Stripe, Auth/Routing, Módulos Clínicos)

---

## Índice de Severidad

| Nivel | Count |
|-------|-------|
| 🔴 CRÍTICO | 17 |
| 🟠 ALTO | 28 |
| 🟡 MEDIO | 23 |
| 🟢 BAJO | 18 |

---

## 1. Auth / Routing / Componentes Compartidos

### 🔴 CRÍTICO (seguridad)

- **useAuth.tsx:28-32** — `fetchRoles` no filtra por `clinic_id`. Retorna roles de TODAS las clínicas del usuario. Un usuario doctor en clínica A tiene `hasRole("doctor") = true` en clínica B. Fix: join con `clinic_memberships` + filtrar por `activeClinicId` al cargar roles, o agregar `clinic_id` a `user_roles`.

- **AdminUsuarios.tsx:208,215** — Mutaciones de `user_roles` (delete/insert) sin `clinic_id`. Admin de clínica A puede asignar roles en clínica B si RLS no lo restringe. Fix: verificar RLS en `user_roles` scope-limita al `clinic_id` del llamante.

- **AdminUsuarios.tsx:329-331** — Acción `set_base_password_all` en edge function `admin-users` no recibe `clinic_id`. Puede resetear contraseñas de usuarios de otras clínicas. Fix: agregar `clinic_id` al body y scope internamente.

- **LockScreen.tsx:25** — Sin rate-limiting de intentos de desbloqueo. Atacante con acceso físico hace fuerza bruta ilimitada. Fix: contar intentos fallidos, bloquear 30s tras 3 intentos.

- **useActiveClinic.tsx:89-95** — `isGlobalAdmin` sin membresías obtiene `activeClinicId = "salud_integral_mx"` hardcodeado sin validación de pertenencia. Fix: eliminar fallback hardcodeado; requerir membresía explícita.

### 🟠 ALTO

- **App.tsx:72** — `/cita/:id` sin `ProtectedRoute` con `allowedRoles`. Cualquier usuario autenticado accede a citas arbitrarias por UUID. Fix: agregar `allowedRoles={["admin","receptionist","doctor","nurse"]}`.

- **useAuth.tsx:55-76** — Race condition en init: `onAuthStateChange` y `getSession()` corren en paralelo, pueden llamar `fetchRoles` dos veces con estados entrelazados. Fix: inicializar solo desde `getSession()` con bandera `initialized`.

- **useAuth.tsx:113-118** — Al hacer `signOut`, `activeClinicId` sigue en localStorage hasta que `useActiveClinic` reacciona. Ventana donde `user === null` pero `activeClinicId` tiene valor previo. Fix: limpiar `localStorage.activeClinicId` sincrónicamente en `signOut`.

- **useActiveClinic.tsx:44** — `activeClinicId` se inicializa desde `localStorage` sin validar. Antes de que `load()` valide membresías, el valor manipulado puede usarse en queries. Fix: inicializar siempre en `null`; solo asignar tras validar.

- **AppLayout.tsx:101-113** — Query de conversaciones escaladas sin `clinic_id`. Badge puede mostrar conversaciones de otras clínicas. Fix: agregar `.eq("clinic_id", activeClinicId)`.

- **AdminUsuarios.tsx:489,491** — Insert/update en `doctors` sin `clinic_id` en el payload visible. Fix: verificar RLS o agregar `clinic_id` explícitamente.

- **restClient.ts:9-12** — Acceso a `supabase.supabaseUrl` y `supabase.supabaseKey` via `(supabase as any)`. Propiedades internas; pueden cambiar sin aviso en updates de la lib. Fix: leer config desde variables de entorno directamente.

### 🟡 MEDIO

- **ProtectedRoute.tsx:33-35** — `roles[0]` undefined durante carga → `ROLE_HOME[undefined]` → redirect a `"/"` → loop. Fix: esperar que roles esté resuelto antes de redirigir.

- **AppLayout.tsx:20** — `AppRole` type local desincronizado del enum de la DB. Fix: importar `Database["public"]["Enums"]["app_role"]`.

- **App.tsx:88** — `/auditoria` permite `receptionist`. Logs contienen datos sensibles de todos los usuarios. Evaluar si receptionist necesita vista filtrada.

- **useActiveClinic.tsx:112** — Error de carga de clínicas `setError(e?.message)` nunca se muestra al usuario. Fix: agregar manejo visible del error en el árbol de componentes.

- **Login.tsx:68-72** — Post-login siempre navega a `"/"` ignorando la ruta original. Fix: usar `location.state.from` o `?redirect=`.

### 🟢 BAJO

- **useAuth.tsx:65** — `setTimeout(..., 0)` para diferir `fetchRoles`. Ordering frágil. Fix: documentar por qué es necesario o usar `queueMicrotask`.
- **useActiveClinic.tsx:79** — `.map((m: any) => m.clinics)` — quitar `any`, usar tipo inferido.
- **AppLayout.tsx:76** — `isDesktop` sin listener de resize. Fix: usar media query hook.
- **ErrorBoundary.tsx:31** — "Reintentar" puede crashear inmediatamente si error es determinístico.
- **AdminUsuarios.tsx:106-108** — Sin `try/catch` en `fetchUsers`; si la promise rechaza, `loading` queda `true` indefinidamente.

### Mejoras UX (Auth)

- Auto-lock por inactividad configurable (ej. 5 min) — crítico en entorno clínico con datos de pacientes.
- Spinner doble en rutas con `ProtectedRoute` anidados.
- `AdminUsuarios`: no re-fetch cuando cambia la clínica activa.
- `ROLE_HOME` sin `receptionist` ni `doctor` → redirect loop si acceden a ruta no permitida.

---

## 2. POS / Caja / Farmacia

### 🔴 CRÍTICO

- **PuntoDeVenta.tsx:411** — `itemsDiscount` suma `c.discount` sin multiplicar por `c.quantity`. Si descuento es por unidad, el total registrado es incorrecto (p.ej. $5 en lugar de $50 para 10 unidades). Fix: aclarar si `c.discount` es total o por unidad y hacerlo consistente en carrito, ticket, RPC y `pharmacy_sale_items`.

- **PuntoDeVenta.tsx:600-603** — Tras `submitSale`, recarga de `lotes_medicamento` sin `await` ni guard de montaje. Si el RPC falla pero el carrito se limpió, inventario local queda desincronizado. Fix: actualizar lotes localmente con el carrito vendido antes del query; agregar `mounted` guard.

- **PuntoDeVenta.tsx:845** — `{blocked && <p>Requiere receta</p>}` — `blocked` no está declarada en ese scope del map; es `undefined`, el mensaje nunca aparece. Fix: usar `blockReasonForDirectSale(m)` como en línea 867.

- **Farmacia.tsx:266** — `update({ existencia: existente.existencia + cantidad })` con valor en estado local. Race condition si dos usuarios registran entrada simultánea al mismo lote. Fix: usar RPC o `existencia = existencia + cantidad` en SQL directo.

- **Farmacia.tsx:283-285** — Salida manual de más unidades que las disponibles: `Math.max(0, 5 - 10) = 0` silenciosamente. Fix: validar `if (cantidad > lote.existencia)` antes del update.

- **CajaTurno.tsx:294** — `turno?.caja_nombre` no existe en la interfaz `Turno` (tiene `caja_id`). Acta de arqueo impresa muestra `undefined`. Fix: `cajas.find(c => c.id === turno.caja_id)?.nombre`.

### 🟠 ALTO

- **PuntoDeVenta.tsx:447-614** — `submitSale` sin `useCallback`; si `payment` cambia mientras está en vuelo, breakdown puede no coincidir. Fix: deshabilitar selector de método mientras `submitting === true`.

- **PuntoDeVenta.tsx:508-514** — Vinculación Stripe→`sale_id` en tabla sin tipado (`as never`). Si falla, transacción Stripe queda huérfana sin `sale_id`. Fix: tipar la tabla y manejar error del update.

- **PaymentCapture.tsx:175-185** — Auto-cálculo mixto no es conmutativo: cambiar efectivo, tarjeta y transferencia en distinto orden produce resultados distintos. Fix: redesñar para que los 3 campos sean independientes y se valide que suman el total.

- **PaymentCapture.tsx:113-119** — En modo mixto, `monto_recibido` nunca se actualiza (solo `bd.efectivo`). La fila de efectivo en `pharmacy_sale_payments` registrará `monto_recibido: 0`. Fix: mapear `bd.efectivo` a `monto_recibido` en modo mixto.

- **CajaTurno.tsx:174-199** — Parseo de error con `error.message.split("|")` frágil. Si el mensaje cambia, `parts[1]` y `parts[2]` son `undefined` → `diff: NaN`. Fix: usar prefijo JSON estructurado en el `RAISE EXCEPTION`.

- **CajaTurno.tsx:671** — Query de `turno_pharmacy_link_audit` con `(supabase as any)`. Error silencioso si tabla no existe. Fix: tipar la tabla.

- **Farmacia.tsx:308** — `<h1>Caja</h1>` en componente `Farmacia`. Fix: cambiar a "Farmacia".

- **Farmacia.tsx:88** — `alertas: any[]`. Accesos sin tipo a `a.quantity_needed`, `a.medicamentos?.nombre`, etc. Fix: definir interfaz `Alerta`.

### 🟡 MEDIO

- **PuntoDeVenta.tsx:266** — `frecuentes = meds.slice(0, 12)` son los primeros 12 por orden alfabético, no los más vendidos. Fix: ordenar por frecuencia de venta o documentar que es temporal.
- **PuntoDeVenta.tsx:137-141** — Clock de 30s causa re-render completo del componente. Fix: extraer a subcomponente.
- **TicketInterno.tsx:138-145** — `<style>` acumula en DOM al montar/desmontar múltiples veces. Fix: `useEffect` con cleanup.
- **Farmacia.tsx:272** — Lote sin fecha de caducidad asume silenciosamente +1 año. Fix: requerir el campo.
- **CorteTurno.tsx:102-107** — `selected` puede quedar obsoleto si el turno está fuera de los primeros 30 resultados.
- **PuntoDeVenta.tsx:251** — `new Date()` recalculado en cada render para `fifoLote`/`stockOf`. Fix: constante fuera del componente.

### 🟢 BAJO

- **PuntoDeVenta.tsx:54** — `"pendiente"` disponible para medicamentos controlados. Fix: bloquear cuando hay recetas controladas.
- **PuntoDeVenta.tsx:579** — Folio `saleId.slice(0, 8)` puede colisionar visualmente. Fix: usar al menos 12 chars o folio secuencial.
- **CajaTurno.tsx:716** — `cortesData as any[]` — campos numéricos sin validar.
- **Farmacia.tsx:92** — `eslint-disable` oculta loop infinito real en `loadAlertas`. Fix: `useCallback`.
- **TicketInterno.tsx:50** — `return null` con `open=true` deja diálogo invisible abierto. Fix: llamar `onClose` si `data` es null.
- **Farmacia.tsx:334** — `forceMount` en tab POS + mount de CajaTurno/CorteTurno = 4-5 queries al cargar la página.

### Mejoras UX (POS)

- Stripe fallido no limpia breakdown → usuario confundido al intentar pago manual después.
- Venta suspendida sin forma de recuperar desde UI.
- Input de scan activo mientras catálogo carga → falsos "Producto no encontrado".
- Input de descuento acepta valores negativos pegados desde portapapeles.
- `window.print()` imprime página completa si estilos de impresión no están aislados correctamente.

---

## 3. CFDI / Stripe / Pagos

### 🔴 CRÍTICO (seguridad o pérdida de dinero)

- **cfdi-timbrar/index.ts:82** — Error de BD en query de roles descartado silenciosamente. `(roles ?? [])` pasa como `[]`, denegando acceso sin log. Fix: capturar `rolesErr` y retornar 500 si hay error.

- **cfdi-timbrar/index.ts:247-284** — CFDI timbrado en SAT + BD insert fallida = UUID perdido. Se retorna `ok: true` con `warning` que el cliente puede ignorar. Fix: insertar en tabla `cfdi_orphans` antes de retornar, o retornar 500.

- **cfdi-cancelar/index.ts:99** — `cfdi_sustitucion` concatenado sin sanitizar en URL hacia Facturama: `&uuidReplacement=${cfdi_sustitucion}`. Fix: `encodeURIComponent(cfdi_sustitucion)`.

- **cfdi-download/index.ts:54-58** — No verifica que el CFDI pertenezca a la clínica del usuario. Un receptionist de clínica A puede descargar XMLs de clínica B. Fix: incluir `clinic_id` del usuario en el filtro.

- **cfdi-download/index.ts:104** — `format` del query string concatenado en URL hacia Facturama sin validar. Fix: `if (!["xml","pdf"].includes(format)) return 400`.

- **stripe-webhook/index.ts:37** — Comparación HMAC con `===` de string (no constant-time). Susceptible a timing attacks. Fix: comparar byte a byte en tiempo constante.

- **stripe-payment-intent/index.ts:118-119** — `client_secret` de Stripe guardado en columna `metadata` de BD. Permite completar el pago desde cualquier cliente con acceso a BD. Fix: eliminar `stripe_client_secret` del `metadata` antes del insert.

### 🟠 ALTO

- **cfdi-rep/index.ts:112-114** — IVA en REP asume siempre `basePago = monto / (1 + ivaTasa)`. Incorrecto para conceptos exentos o tasa cero. SAT rechazará. Fix: recalcular desde `cfdi_conceptos` del CFDI original.

- **cfdi-rep/index.ts:123-124** — CP del emisor como fallback del CP del receptor es fiscalmente incorrecto. SAT rechazará. Fix: hacer la query fallida de receptor un error bloqueante.

- **cfdi-timbrar/index.ts:186-187** — Clave `"Año"` con carácter Unicode `Ñ`. Riesgo si proxy intermedio rompe encoding. Documentar o verificar.

- **stripe-payment-intent/index.ts:62** — Sin límite superior de monto. Receptionist puede crear PaymentIntent de millones de pesos. Fix: agregar cap máximo razonable.

- **stripe-payment-intent/index.ts:73-75** — No verifica que ambiente de config (`sandbox`/`produccion`) coincida con el key en uso. Fix: verificar o loguear el ambiente.

- **cfdi-cancelar/index.ts:69-76** — `clinic_id` viene del body del request, no del usuario autenticado. Fix: obtener `clinic_id` autorizado desde la BD, no del body.

- **ConfiguracionCFDI.tsx:176-177** — `pac_contrasena` y `csd_contrasena` enviadas desde cliente al API de Supabase y almacenadas en texto claro. Fix: cifrar con pgcrypto o usar Supabase Vault.

- **ConfiguracionCFDI.tsx:205-206** — Test de conexión PAC desde el navegador expone credenciales en Network tab. Fix: realizar test vía edge function.

### 🟡 MEDIO

- **stripe-webhook/index.ts:71-76** — No verifica resultado del `update`. Si la transacción no existe en BD, webhook retorna 200 y Stripe no reintenta. Fix: loguear cuando `count === 0`.
- **stripe-webhook/index.ts:84-88** — `payment_failed` sobrescribe `metadata` completo, destruyendo datos previos. Fix: merge de metadata.
- **cfdi-timbrar/index.ts:288-306** — Insert de `cfdi_conceptos` sin manejo de error. CFDI en BD sin líneas de detalle. Fix: capturar error.
- **cfdi-rep/index.ts:67** — Sin validación aritmética `saldo_anterior - monto == saldo_insoluto`. SAT rechazará. Fix: validar antes de llamar a Facturama.
- **cfdi-timbrar/index.ts:13-15** — Non-null assertions `!` en env vars → error no descriptivo si secret falta. Fix: validar explícitamente con mensaje claro.
- **ConfiguracionCFDI.tsx:88-90** — `select("*")` trae `pac_contrasena` y `csd_contrasena` al navegador. Fix: seleccionar solo campos necesarios, excluir contraseñas.

### 🟢 BAJO

- **cfdi-timbrar/index.ts:219** — `console.error` puede loguear mensajes de error de Facturama con datos fiscales sensibles.
- **cfdi-rep/index.ts:239** — `as any` en `cfdi_relacionado_uuid`. Fix: tipo explícito.
- **Facturacion.tsx:131** — URL edge function con posible trailing slash. Fix: `.replace(/\/$/, "")`.
- **cfdi-timbrar, cfdi-cancelar, cfdi-rep** — `(r: any)` en `.some()` de roles. Fix: tipo explícito `{ role: string }`.

### Mejoras Funcionales (CFDI/Stripe)

- **Idempotencia en timbrado**: sin detección de CFDI duplicado (mismo `clinic_id` + `appointment_id` + `total`). Doble clic = dos CFDIs válidos ante el SAT.
- **Timeout en fetch a Facturama**: ninguna llamada tiene `AbortController`. Si Facturama no responde, edge function cuelga hasta timeout de Supabase.
- **Sin retry logic**: XML faltante tras timbrado exitoso no se reintenta. XML es legalmente necesario para archivo fiscal.
- **REP sin link a Stripe**: `cfdi-rep` no acepta `payment_intent_id`. Sin trazabilidad pago Stripe ↔ REP CFDI.
- **Audit log incompleto en cancelación**: si update BD falla, audit log nunca se inserta (está después del update).
- **Paginación en Facturacion.tsx**: `limit(200)` hardcoded. Sin indicador de truncación para clínicas con alto volumen.
- **Sin validación de plazo SAT**: cancelaciones de CFDIs >3 meses sin aviso preventivo al usuario.
- **Webhook Stripe sin `charge.refunded`**: reembolsos en dashboard Stripe no se reflejan en `payment_transactions`.

---

## 4. Módulos Clínicos (Agenda, Citas, Pacientes, Expedientes, Recetas)

### 🔴 CRÍTICO

- **Pacientes.tsx:1-101** — Componente con datos hardcodeados (8 pacientes ficticios), sin conexión a Supabase. Si `/pacientes` apunta aquí, usuarios nunca ven datos reales. Fix: verificar router y eliminar o reemplazar este archivo con `PacientesLista.tsx`.

- **Agenda.tsx:95** — `.limit(3)` hardcodeado en fetch de doctores. Clínicas con 4+ doctores tienen columnas de agenda incompletas; citas de doctores omitidos son invisibles. Fix: eliminar el `.limit(3)`.

- **DetalleCita.tsx:317-324** — Botón "Cancelar cita" sin AlertDialog de confirmación. Click accidental cancela irreversiblemente. Fix: envolver en AlertDialog igual que en Agenda.tsx:312.

- **Agenda.tsx:86-88** y **Citas.tsx:86-87** — Rango de fechas construido en hora local del navegador. Supabase almacena en UTC. En México (UTC-6), citas de 18:00-23:59 del día anterior en UTC quedan incluidas; citas del día actual después de 18:00 son omitidas. Fix: construir rango en UTC explícitamente.

- **Inbox.tsx:107-114** — Preview de último mensaje carga todos los mensajes de todas las conversaciones sin límite por conversación. Con volumen alto: miles de filas. Fix: RPC que retorne solo el último mensaje por conversación.

### 🟠 ALTO

- **NuevaCitaDialog.tsx:54-59** — `defaultDatetime` calculado en cuerpo del componente, no en el `useEffect`. Si el diálogo queda montado entre días, fecha por defecto es incorrecta. Fix: calcular dentro del `useEffect` al abrir.

- **NuevaCitaDialog.tsx:113** — `new Date(fechaInicio)` sin zona horaria → interpretado como hora local. Con usuarios en timezone distinto, cita se crea con hora desplazada. Fix: concatenar zona explícita `":00-06:00"` o usar librería de timezone.

- **DetalleCita.tsx:70** — `appointment: any`. Accesos sin tipo a `a.patients`, `a.doctors`, `a.fecha_inicio`. Fix: `Tables<"appointments">` con joins tipados.

- **Expedientes.tsx:27-42** — `expedientes`, `notas`, `patients`, `doctors` todos `any[]`. Fix: usar tipos generados de Supabase.

- **PrescriptionEditorModal.tsx:65,68** — `items` y `meds` son `any[]`. Fix: definir `PrescriptionItem` y `Medicamento`.

- **Recetas.tsx:69-113** — Carga hasta 500 recetas sin paginación; sin aviso cuando se trunca. Fix: paginación real o aviso cuando `rxs.length === 500`.

- **Agenda.tsx:103-112** — Canal realtime captura `loadAppointments` por closure con la `fecha` al momento de suscripción. Al cambiar `fecha`, el canal llama la versión antigua. Fix: `useCallback` con `fecha` como dependencia.

- **RecepcionDashboard.tsx:128-130** — Mutación directa de objetos en `convsNorm.forEach(c => { c.patients = ... })`. Fix: usar `map` para crear nuevos objetos.

- **DetalleCita.tsx:245-266** — `updateStatus` permite todas las transiciones sin validar. Ej: `cancelada → confirmada`. Fix: definir máquina de estados válida; deshabilitar opciones inválidas en Select.

### 🟡 MEDIO

- **Citas.tsx:18-19** — `STATUSES` cubre solo 4 estados. Citas con `tentativa`, `liberada`, etc. son invisibles. `STATUS_META[c.status]` undefined → crash. Fix: expandir para cubrir todos los estados del enum.
- **PacientesLista.tsx:29-36** — `select("*")` sin paginación en tabla `patients`. No escalable. Fix: paginación o búsqueda server-side.
- **PacientesLista.tsx:38-46** — Filtrado en cliente. No busca por `municipio`. Fix: `.ilike()` con debounce en Supabase.
- **Expedientes.tsx:60-71** — Cache de notas por expediente nunca se invalida entre sesiones. Fix: eliminar guarda o agregar versión/timestamp.
- **NotaConsultaModal.tsx:75** — `onSaved` recibe doctor con nombre vacío hardcodeado. Fix: pasar doctor real.
- **DetalleCita.tsx:119-122** — Recordatorio por defecto se puede programar después de la cita si esta ocurre en menos de 1 hora. Fix: corregir lógica de tiempo mínimo.
- **Agenda.tsx:120-121** — Grid solo muestra citas que empiezan exactamente en slots de 30 min. Citas con horas irregulares (09:05) son invisibles. Fix: buscar cita cuyo `fecha_inicio` caiga dentro del slot.
- **Dashboard.tsx** — Datos 100% hardcodeados incluyendo fecha fija ya pasada (`"Lunes 30 de marzo, 2026"`). No usar en producción como está.

### 🟢 BAJO

- **Citas.tsx:86-87** — Timezone bug menor (variante del crítico de Agenda).
- **Recetas.tsx:228** — Fallback a `STATUS_LABELS.issued` para status desconocido muestra "Emitida" incorrectamente.
- **PrescriptionEditorModal.tsx:147-149** — Diagnóstico vacío no se actualiza en BD. Fix: actualizar siempre con `diag || null`.
- **DetalleCita.tsx:108** — `supabase as any` para `recordatorios_cita`. Fix: agregar tabla a tipos generados.
- **Inbox.tsx:334** — `CANAL_META[canal_id]` sin fallback → crash si canal nuevo. Fix: `?? { label: canal_id }`.
- **NuevaCitaDialog.tsx:86-98** — `setSearching` no se resetea a `false` en early return cuando `q.length < 2`.
- **Expedientes.tsx:51** — Query como string literal frágil (`restSelect`). Fix: usar cliente Supabase tipado.

### Mejoras Funcionales (Módulos Clínicos)

- **Agenda — Vista semana**: Toggle existe en UI pero no implementado. Implementar o remover.
- **Agenda — Validación de solapamiento**: Sin verificación de conflictos antes de crear cita. Fix: query de validación en `NuevaCitaDialog`.
- **Citas — State machine**: `cambiarStatus` sin confirmación para `cancelada`; todas las transiciones permitidas.
- **Expedientes — Expediente duplicado**: Error `23505` mostrado como error genérico después de llenar formulario. Fix: verificar existencia con select previo.
- **Recetas — Filtro por doctor**: Rol `doctor` ve las 500 recetas de todos los doctores sin filtro automático propio.
- **Recetas — "Nueva receta"**: Botón navega a `/expedientes` en lugar de abrir directamente `PrescriptionEditorModal`.
- **Inbox — Cerrar conversación sin confirmación**: `cerrarConversacion` sin AlertDialog.
- **PrescriptionEditorModal — Stock cero**: Badge "🔴 solo 0 disponibles" no impide emitir la receta.

---

## Acciones Prioritarias Sugeridas

### Sprint inmediato (seguridad / pérdida de datos)

1. **useAuth.tsx** — Filtrar `fetchRoles` por `clinic_id` activo
2. **stripe-payment-intent/index.ts:118-119** — Eliminar `client_secret` de columna `metadata` en BD
3. **stripe-webhook/index.ts:37** — Comparación HMAC constant-time
4. **cfdi-timbrar/index.ts:247-284** — Tabla `cfdi_orphans` para CFDIs timbrados sin registro en BD
5. **cfdi-download/index.ts:54-58** — Verificar `clinic_id` del CFDI contra usuario autenticado
6. **cfdi-cancelar/index.ts:99** — `encodeURIComponent(cfdi_sustitucion)`
7. **ConfiguracionCFDI.tsx** — Cifrar `pac_contrasena`/`csd_contrasena` en BD; mover test PAC a edge function
8. **Farmacia.tsx:283-285** — Validar que cantidad de salida no exceda existencia
9. **Agenda.tsx:95** — Eliminar `.limit(3)` en fetch de doctores
10. **DetalleCita.tsx:317-324** — AlertDialog antes de cancelar cita

### Sprint siguiente (bugs de negocio)

11. **PuntoDeVenta.tsx:411** — Aclarar y corregir cálculo de `itemsDiscount`
12. **cfdi-rep/index.ts:112-114** — Recalcular IVA desde `cfdi_conceptos`, no del total
13. **cfdi-rep/index.ts:67** — Validar aritmética SAT antes de llamar Facturama
14. **PaymentCapture.tsx:175-185** — Rediseñar auto-cálculo mixto para ser conmutativo
15. **Agenda.tsx:86-88** y Citas.tsx — Fix timezone UTC en rangos de fecha
16. **Pacientes.tsx** — Eliminar o reemplazar con `PacientesLista.tsx`
