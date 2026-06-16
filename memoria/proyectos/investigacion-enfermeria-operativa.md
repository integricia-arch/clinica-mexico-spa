---
tags: [proyecto, investigacion, enfermeria]
creado: 2026-06-16
---

# Investigación Operativa: Perfil y Función de Enfermería
**Fecha:** 2026-06-16 | **Fuentes:** NOM-019-SSA3-2013, NOM-004-SSA3-2012, NOM-087-SEMARNAT-SSA1-2010, NOM-045-SSA2-2005, COFEPRIS (insumos para la salud/dispositivos médicos), Manual de Enfermería IMSS/ISSTE (PAE/PLACE), Cédula profesional SEP, CONAMED

**Disparador:** el perfil de enfermera en el sistema no está bien validado en su función ni en su operación — confirmado en código (ver Hallazgo 1).

---

## Hallazgos en el sistema actual (evidencia de código/DB)

### Hallazgo 1 — Perfil de enfermera sin validación profesional
`list_nurses()` (RPC, `public`):
```sql
RETURN QUERY
SELECT u.id, u.email::text
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.role = 'nurse'
```
Solo trae `id, email`. Comparado con `doctors` (tiene `cedula_profesional`, `especialidad`, `activo`), **no existe catálogo `nurses`** — no se valida cédula profesional (SEP), no se distingue tipo (general/especialista/auxiliar), no hay turno fijo, no hay estado activo/inactivo. NuevaCitaDialog.tsx muestra `e.email ?? e.id` en el selector — una enfermera se identifica por correo, no por nombre.

**Riesgo normativo:** NOM-019-SSA3-2013 exige que el personal de enfermería que participa en la atención esté identificado por categoría (licenciada/técnica/auxiliar) y nivel de competencia. El sistema actualmente no puede demostrar esto ante una auditoría.

### Hallazgo 2 — Triage sin nota de enfermería normativa
`TriageForm.tsx` captura signos vitales (peso, talla, TA, FC, temp, SpO₂) + campo libre "notas". **No hay estructura PAE/PLACE** (Proceso de Atención de Enfermería: valoración → diagnóstico de enfermería → planeación → ejecución → evaluación), que es el estándar IMSS/ISSTE y lo exigido por NOM-004 para notas de enfermería en expediente clínico (debe incluir: hora, valoración, intervención, respuesta del paciente, nombre y firma/identificación de quien atiende).

Step `triage` además es `required: false` en `operationalSteps.ts` — en cualquier escenario de urgencia (CRITICAL_STEP_KEYS no lo distingue) esto significa que un paciente puede pasar a `consultation_open` sin signos vitales registrados.

### Hallazgo 3 — Insumos/instrumental sin trazabilidad por paciente
No existe ningún paso ni tabla que vincule **consumo de insumos** (gasas, jeringas, guantes, material de curación, equipo estéril) a un paciente/atención específica. `movimientos_inventario` solo registra entrada/salida/ajuste a nivel almacén — no por `appointment_id` ni `journey_instance_id`. Esto rompe:
- Trazabilidad COFEPRIS de dispositivos médicos usados en procedimiento.
- Costeo real por consulta (insumos no se facturan ni se descuentan del expediente).
- Auditoría de reposición de carro de curaciones / control de material estéril (NOM-087, NOM-045: control de fómites e insumos en prevención IAAS).

### Hallazgo 4 — Step `discharge` (alta) sin rol `nurse`
`closeRoles: ["admin","receptionist","doctor"]` — enfermería no puede cerrar el alta aunque en la práctica operativa (IMSS/ISSTE) es común que enfermería entregue indicaciones de egreso, retiro de catéteres/vías, signos de alarma post-procedimiento. Hoy el sistema fuerza que doctor o recepción cierren ese paso aunque quien lo ejecuta físicamente sea enfermería.

### Hallazgo 5 — La enfermera asignada se "pierde" al avanzar el camino del paciente
`assigned_nurse_id` (migración `20260617000000_enfermera_asignacion.sql`) vive **solo en `appointments`**. `journey_instances` no tiene columna de enfermera asignada, y `journey_instance_steps.assigned_to` (que sí existe, por step) **no se prellena** desde `appointments.assigned_nurse_id` al crear la instancia — cada step queda con `assigned_to = null` hasta que alguien lo abre manualmente.

Consecuencia operativa: la enfermera asignada en la cita queda ligada solo al *aviso de Telegram* inicial; nada en el sistema la mantiene como responsable a lo largo de `triage → record → pharmacy → followup → discharge`. Si el negocio espera que la misma enfermera siga el caso de principio a fin (continuidad de cuidado, requisito implícito de NOM-019), hoy no hay nada que lo garantice ni lo refleje en el expediente.

**Tablas de horario revisadas:** existe `doctor_bloqueos` (bloqueos de agenda por médico) pero **no hay tabla equivalente para enfermería** (turno/horario/disponibilidad). `turnos` es exclusivamente turno de caja/farmacia (apertura-cierre de fondo), no horario laboral. Esto significa que hoy se puede asignar una enfermera a una cita fuera de su horario real de trabajo — el único chequeo que existe (`NuevaCitaDialog.tsx`) es "¿ya tiene otra cita encimada?", no "¿está en su horario?".

---

## Marco normativo aplicable (resumen operativo)

| Norma | Qué exige | Aplica a |
|---|---|---|
| **NOM-019-SSA3-2013** | Identificación de personal por categoría/competencia; intervenciones de enfermería documentadas; supervisión de cuidados | Catálogo de enfermeras, notas |
| **NOM-004-SSA3-2012** | Nota de enfermería en expediente: fecha/hora, hallazgos, procedimientos, respuesta del paciente, identificación de quien atiende | TriageForm / notas de enfermería |
| **NOM-087-SEMARNAT-SSA1-2010** | Manejo de Residuos Peligrosos Biológico-Infecciosos (RPBI) — bitácora de generación, segregación | Reporte de insumos usados |
| **NOM-045-SSA2-2005** | Vigilancia epidemiológica de infecciones nosocomiales (IAAS) — control de material/técnica aséptica | Insumos + checklist de procedimiento |
| **COFEPRIS** | Trazabilidad de dispositivos médicos/insumos para la salud, control de caducidad de material estéril | Insumos/instrumental |
| **Cédula profesional SEP** | Validación de licencia para ejercer (enfermería general/especialista) | Catálogo `nurses` |

---

## Plan de acción (priorizado — solo mejoras necesarias, no "paja")

### Prioridad 1 — Validación de perfil (bloqueante, bajo esfuerzo)
1. Crear tabla `nurses` (espejo de `doctors`): `user_id`, `nombre`, `apellidos`, `cedula_profesional`, `categoria` (`licenciada`/`tecnica`/`auxiliar`), `especialidad` (opcional), `activo`, `clinic_id`.
2. Cambiar `list_nurses()` para devolver `nombre + apellidos + categoria` en vez de email crudo.
3. `NuevaCitaDialog.tsx`: mostrar `${nombre} ${apellidos} — ${categoria}` en el selector.
4. `AdminUsuarios.tsx`: al asignar rol `nurse`, exigir captura de cédula profesional (igual que ya se hace para `doctors`).

**Por qué es necesaria, no "paja":** sin esto el sistema no puede demostrar quién atendió a un paciente con qué competencia — expone a la clínica en auditoría NOM-019 y en caso de incidente médico-legal.

### Prioridad 2 — Nota de enfermería estructurada (alto valor clínico)
1. Extender `TriageForm` (o nuevo step `nursing_note` opcional post-triage) con campos PAE mínimos: **valoración** (ya existe: signos vitales), **diagnóstico de enfermería** (catálogo corto: ej. "riesgo de caída", "dolor agudo", "déficit de autocuidado"), **intervención realizada**, **respuesta del paciente**.
2. Auto-incluir en nota: nombre + cédula de quien registra (ya disponible via `auth.uid()` + nuevo catálogo `nurses`), timestamp.
3. Mantener simple: 1 select de diagnóstico + 1 textarea de intervención — no formularios largos que la enfermera no llenará en consulta real.

**Por qué:** es el único cambio que convierte el triage actual (solo signos vitales) en una nota de enfermería válida para expediente clínico ante NOM-004.

### Prioridad 3 — Trazabilidad de insumos por atención (mejora operativa intuitiva)
**Actualización 2026-06-16: la tabla `solicitudes_insumos` ya existe en prod** (medicamento_id, cantidad, motivo, status pendiente/aprobada/rechazada, solicitado_por, aprobado_por, movimiento_id) pero **no tiene UI**. Antes de diseñar el step nuevo, construir sobre esto:
1. UI simple para enfermería: buscar insumo, cantidad, motivo → insert en `solicitudes_insumos`.
2. UI para manager/admin: lista de pendientes → aprobar/rechazar (al aprobar, generar `movimientos_inventario` y enlazar `movimiento_id`).
3. Evaluar si conviene vincular la solicitud a `appointment_id`/`journey_instance_id` (la tabla actual no lo tiene — agregar columna si se requiere trazabilidad por paciente, no solo por clínica).
4. Reusa UI ya existente del POS de farmacia (carrito simple) como referencia visual — no construir desde cero.

**Por qué:** cierra el hueco de trazabilidad COFEPRIS/RPBI y permite costeo real por consulta sin agregar carga operativa significativa (es un checklist, no un formulario).

### Prioridad 4 — Ajuste de roles en `operationalSteps.ts`
1. Agregar `"nurse"` a `closeRoles` de `discharge` (alta) — refleja la práctica real.
2. Evaluar (no forzar aún) si `triage` debe ser `required: true` para templates tipo `urgencia` — actualmente es global. Decisión pendiente de validar con flujo real antes de implementar (evitar fricción en consultas que no la necesitan, ej. teleconsulta).

### Prioridad 5 — Horario de enfermera + continuidad a lo largo del camino del paciente
**Actualización 2026-06-16: la tabla `entregas_turno` ya existe en prod** (clinic_id, sala, turno matutino/vespertino/nocturno, fecha, enfermera_entrega, enfermera_recibe, resumen, pacientes_json, pendientes_json) pero **no tiene UI**. Esto ya resuelve "continuidad entre turnos" — falta construir la pantalla de entrega/recepción de turno (enfermera saliente llena resumen + pacientes pendientes, entrante confirma recepción).
1. **Horario/turno de enfermera (tabla nueva `nurse_schedules`)**: bloques recurrentes por día de semana (`nurse_id`, `dia_semana`, `hora_inicio`, `hora_fin`, `clinic_id`) — mismo patrón simple que ya usa `doctor_bloqueos` para excepciones puntuales (vacaciones/incapacidad), reutilizando esa tabla o clonándola como `nurse_bloqueos`.
2. En `NuevaCitaDialog.tsx`, el chequeo "Libre/Ocupada" ya implementado se extiende: si la cita cae fuera del horario de la enfermera → mostrar "Fuera de horario" en vez de solo "Libre/Ocupada" (no bloquear duro al inicio, solo advertir — decisión de negocio antes de bloquear).
3. **Propagar `assigned_nurse_id` al journey completo**: al crear `journey_instances` desde una cita con enfermera asignada, prellenar `journey_instance_steps.assigned_to` con esa enfermera en todos los steps donde `closeRoles` incluya `"nurse"` (`attention_open`, `identification`, `record`, `triage`, `pharmacy`, `followup`, y `discharge` tras el ajuste del Hallazgo 4). Así la responsabilidad queda visible y trazable de principio a fin, no solo en el aviso de Telegram inicial.
4. Vista simple en `CaminoPaciente.tsx`/`DetalleCita.tsx`: mostrar "Enfermera responsable: {nombre}" de forma persistente durante todo el flujo, no solo al agendar.

**Por qué es necesaria, no "paja":** sin esto, "asignar enfermera" es solo un aviso puntual desconectado del resto del expediente — no resuelve el problema real de continuidad de cuidado ni deja registro de quién fue responsable en cada etapa, que es justo lo que NOM-019 pide poder demostrar.

---

## Lo que NO se va a hacer (evitar sobre-ingeniería)
- No se crea módulo de "plan de cuidados" multi-página estilo hospital de tercer nivel — la clínica es consulta externa/ambulatoria, no hospitalización.
- No se exige nota de enfermería en cada step — solo en triage/atención donde enfermería interviene directamente.
- No se duplica el catálogo de insumos del almacén — se reutiliza `medicamentos`/`insumos` ya existentes.

---

## Bitácora de implementación (Jun 16, 2026)

### Prioridad 1 — COMPLETADA
- Tabla `nurses` (migración `20260619000000_nurses_catalog.sql`) + `list_nurses()` RPC con nombre/apellidos/categoría
- Tab "Enfermeras del registro" en `AdminUsuarios.tsx` (CRUD completo: crear, editar, eliminar, vincular/desvincular cuenta) — mirror exacto del tab de médicos
- Acciones `link_nurse_user`/`unlink_nurse_user` en edge function `admin-users` (deploy v14 ACTIVE)
- Validado: `tsc --noEmit` 0 errores, `npm run build` exitoso, `list_nurses()` probado en vivo (simulando JWT de admin real vía `set_config`) — confirma fallback a email cuando la enfermera aún no tiene fila en `nurses`
- Selector de `NuevaCitaDialog.tsx` ya muestra "Lic./Téc./Aux. Nombre Apellidos" en vez de email

### Prioridad 2 — COMPLETADA (Jun 16)
- `TriageForm.tsx` extendido: diagnóstico de enfermería (catálogo corto de 8 opciones, no NANDA completo), intervención realizada (textarea), respuesta del paciente (textarea)
- Autocompleta "Registrado por: Nombre · Céd. XXXX" leyendo `nurses` por `user_id` del usuario en sesión (fallback a email si aún no está en el catálogo)
- Validado: `tsc --noEmit` 0 errores, eslint limpio, `npm run build` OK

### Prioridad 3 — COMPLETADA (Jun 16)
- RPCs `aprobar_solicitud_insumo`/`rechazar_solicitud_insumo` (migración `20260620000000_solicitudes_insumos_rpc.sql`) — atómicas, FEFO (descuenta del lote con caducidad más próxima), registran `movimientos_inventario` con `tipo='uso_interno'` y `reference_type='solicitud_insumo'`
- UI `SolicitudesInsumos.tsx` — enfermería solicita (insumo, cantidad, motivo), admin/manager aprueba o rechaza. Tab "Insumos" en `/farmacia` (visible a `nurse`)
- Limitación documentada: si el stock no cabe en un solo lote, la aprobación falla con mensaje explícito (no se hace split multi-lote — evita sobre-ingeniería para un caso raro en consulta externa)
- Validado end-to-end en vivo: insert solicitud → aprobar (simulando JWT admin) → confirmado descuento de `lotes_medicamento.existencia` (50→49), `movimientos_inventario` insertado, solicitud marcada `aprobada` con `movimiento_id`. Datos de prueba limpiados después.

---

## Estudio: ¿quién asigna la enfermera al camino del paciente? (Jun 16)
**Fuentes:** patrones de Epic (nurse assignment / care team), Cerner Millennium (staff assignment by unit), Meditech (nursing assignment board), SAP IS-H (recurso asignado por encuentro), y SaaS de agenda médica (Doctoralia, Tuasaúde — asignación de recurso humano al turno).

### Patrón observado en la industria
No hay un único rol "dueño" de la asignación — depende del modelo operativo:
1. **Modelo recepción-asigna** (más común en clínica ambulatoria pequeña/mediana, que es nuestro caso): recepción agenda la cita y asigna recursos (doctor, consultorio, **y enfermera si el flujo la requiere desde el inicio** — ej. triage antes de pasar a consulta). Es lo que ya implementamos en `NuevaCitaDialog.tsx` (recepción/admin crean la cita y eligen enfermera).
2. **Modelo doctor-reasigna en el momento**: el doctor, ya en consulta o al revisar su agenda del día, puede *reasignar* o *solicitar* enfermera específica para un procedimiento (ej. requiere apoyo para curación, toma de muestra). Esto hoy **no existe** en el sistema — la única edición de `assigned_nurse_id` es al crear la cita.
3. **Modelo auto-asignación por turno/disponibilidad**: el sistema sugiere/asigna automáticamente la enfermera de turno según horario (ya planeado en Prioridad 5 con `nurse_schedules`/`doctor_bloqueos`-like), sin intervención humana salvo excepción.

### Recomendación (evitar sobre-ingeniería)
Para esta clínica (ambulatoria, equipo de enfermería pequeño), el patrón correcto es **híbrido 1+2**:
- **Default:** recepción asigna al crear la cita (ya implementado).
- **Override:** el doctor puede reasignar la enfermera **durante la consulta** desde `DetalleCita.tsx`/`CaminoPaciente.tsx` si el caso lo requiere (ej. cambia de enfermera de triage a una con categoría "licenciada" para un procedimiento). Esto es una mejora pequeña: un selector igual al de `NuevaCitaDialog` pero editable post-creación, con permiso `doctor` o `admin`.
- **No implementar todavía** auto-asignación por turno sin aprobación humana — la Prioridad 5 (horario/turno) sigue siendo prerequisito y debe completarse primero; auto-asignación es una fase posterior, no urgente.

### Plan de acción (nuevo, no implementado aún — pendiente de confirmación)
1. Completar Prioridad 5 (horario de enfermera) — prerequisito de cualquier auto-sugerencia.
2. Agregar selector "Reasignar enfermera" en `DetalleCita.tsx`, visible para `doctor`/`admin`, que actualiza `appointments.assigned_nurse_id` y dispara `notify-nurse-assignment` de nuevo (ya existe el edge function, solo se reutiliza).
3. Bitácora: registrar en `journey_instance_audit` cada reasignación (quién, cuándo, de quién a quién) — ya existe la tabla, solo falta el insert.

---

## Estudio: panel de configuración de contacto por rol y tipo de mensaje (Jun 16)
**Disparador:** se necesita un panel donde el admin configure, por rol (enfermera, doctor, recepción, cajero) y tipo de mensaje (asignación de cita, recordatorio, alerta de stock, vencimiento CxP, etc.), qué canal y destinatario usar.

### Lo que ya existe (no reinventar)
- `staff_identidades_canal` — vínculo Telegram por usuario (Prioridad 1 de asignación de enfermera). Cubre **un canal, un destinatario por usuario**.
- Edge functions ya mandan mensajes puntuales: `notify-nurse-assignment` (Telegram a enfermera), `notify-cxp-vencimiento` (email+Telegram a admins), `notify-new-user` (email a admins).
- Patrón repetido en cada función: el destinatario y canal están **hardcodeados en código**, no configurables desde UI.

### Qué falta (la necesidad real detrás del pedido)
Un panel `/configuracion/notificaciones` donde:
1. Por **rol** (no por persona — más simple y escalable): tabla `notification_rules` (`clinic_id`, `role`, `event_type`, `channel` [telegram/email/sms futuro], `enabled`).
2. `event_type` inicial: `cita_asignada_enfermera`, `cxp_vencimiento`, `usuario_nuevo`, `stock_bajo` (ya existen alertas de stock, hoy sin notificación push).
3. Las edge functions existentes leen esta tabla en vez de tener el canal hardcodeado — cambio incremental, no romper lo que ya funciona.
4. **Teléfono para SMS/WhatsApp**: hoy no hay canal SMS/WhatsApp implementado, solo Telegram y email. Si el negocio realmente necesita SMS/WhatsApp (no solo Telegram), es un proveedor nuevo (Twilio/WhatsApp Business API) — **confirmar con negocio antes de construir**, es costo recurrente y la clínica ya tiene Telegram funcionando gratis.

### Plan de acción (nuevo, no implementado aún — pendiente de confirmación)
1. Confirmar con negocio: ¿se necesita canal SMS/WhatsApp real, o Telegram + email ya cubre la necesidad? (afecta costo y alcance)
2. Si solo Telegram/email: construir tabla `notification_rules` + panel simple (lista de reglas por rol/evento con toggle canal) — esfuerzo bajo, reutiliza infraestructura existente.
3. Si se requiere SMS/WhatsApp: agregar campo `telefono` ya existe en `doctors`/`nurses` — falta tabla de canal + proveedor, esfuerzo medio-alto, requiere decisión de negocio sobre proveedor y costo.
4. Migrar edge functions una por una a leer `notification_rules` en vez de hardcode (empezar por `notify-nurse-assignment`, ya construida hoy).

### Prioridad 5 — parcial COMPLETADA (Jun 16)
- `list_nurses()` ahora devuelve `horario_inicio`/`horario_fin` (migración `20260621000000_list_nurses_horario.sql`) — reutiliza columnas ya creadas en Prioridad 1, no se creó tabla nueva de horario
- `NuevaCitaDialog.tsx`: advertencia (no bloqueante) "Fuera del horario laboral de la enfermera" si la hora de la cita cae fuera de `horario_inicio`/`horario_fin`
- `journeyEngine.ts` (`createJourneyFromAppointment`): si la cita tiene `assigned_nurse_id`, se prellena `journey_instance_steps.assigned_to` en todos los steps cuyo `closeRoles` incluye `"nurse"` — cierra el Hallazgo 5 (la enfermera ya no se "pierde" tras el aviso inicial de Telegram)
- Validado: `tsc --noEmit` 0 errores, eslint limpio, `npm run build` OK, `list_nurses()` probado en vivo con horario. **No probado end-to-end con datos reales** — todavía no hay ninguna cita con `assigned_nurse_id` en prod (feature nueva sin uso real), así que la propagación a `journey_instance_steps` quedó verificada a nivel de código/build, no con un caso real completo
- **Pendiente (fuera de alcance hoy):** vista persistente "Enfermera responsable: {nombre}" en `CaminoPaciente.tsx`/`DetalleCita.tsx` (punto 4 del plan original) — siguiente sesión

### Tarea 9/11 — Reasignar enfermera + vista persistente — COMPLETADA (Jun 16)
- `DetalleCita.tsx`: bloque "Enfermera responsable" siempre visible (vista persistente, cierra Tarea 11). Si `doctor`/`admin`, es un selector editable; para otros roles, solo lectura.
- Reasignar dispara de nuevo `notify-nurse-assignment`, actualiza `appointments.assigned_nurse_id`, y registra `nurse_reasignada` en `journey_instance_audit` (vía `audit()` exportado de `journeyEngine.ts`) si hay journey activo.
- Validado: `tsc --noEmit` 0 errores, eslint limpio, `npm run build` OK. RLS confirmado en vivo: `is_appointment_participant()` permite que el doctor asignado actualice su propia cita; `journey_instance_audit` permisivo para insert. **No probado con click-through en browser ni con journey real** (sin citas con enfermera asignada en prod todavía).

### Panel de notificaciones por rol/evento — COMPLETADO (Jun 16)
- Alcance confirmado por usuario: solo Telegram + email (gratis). SMS/WhatsApp queda fuera por ahora (costo recurrente), pero `channel` es texto libre en BD — no bloquea agregarlo después.
- Tabla `notification_rules` (migración `20260622000000_notification_rules.sql`) — `clinic_id`, `role`, `event_type`, `channel`, `enabled`. Semilla refleja el comportamiento hardcodeado actual (no cambia nada al activarse).
- Página `/configuracion/notificaciones` — lista reglas con toggle, permite crear nuevas combinaciones rol/evento/canal. Card "Notificaciones por rol" en `/configuracion` ahora enlaza aquí (antes era placeholder sin link).
- `notify-nurse-assignment` migrado como prueba de concepto: lee `notification_rules` antes de enviar, filtrado por `clinic_id` de la cita (soporta multi-clínica). Default seguro: si no hay regla, se envía igual (no rompe comportamiento previo a esta feature).
- Validado: `tsc --noEmit` 0 errores, eslint limpio, `npm run build` OK, deploy v2 ACTIVE. Probado en vivo: regla deshabilitada → query confirma `enabled=false` con el filtro exacto que usa el edge function → restaurada a `true`.
- Pendiente (próxima sesión, no urgente): migrar `notify-cxp-vencimiento` y `notify-new-user` a leer la misma tabla.

## Pendiente de esta investigación
- [ ] Validar con el negocio: ¿qué categorías de enfermera maneja la clínica realmente? (general/auxiliar/especialista) — define el enum `categoria`.
- [ ] Confirmar si se requiere captura de cédula profesional como obligatoria o solo recomendada al alta de una enfermera.
- [ ] Diseñar migración `nurses` + endpoint admin (Prioridad 1) — siguiente paso de desarrollo.
