# Integriclinica — Entidades, Relaciones y Funcionalidades

> Generado: 2026-06-14 · Proyecto: `clinica-mexico-spa` · DB: `kyfkvdyxpvpiacyymldc`

---

## 1. Resumen de módulos

| Módulo | Ruta principal | Tablas clave |
|--------|---------------|--------------|
| Auth / Usuarios | `/admin-usuarios` | `profiles`, `user_roles`, `clinics`, `clinic_memberships` |
| Pacientes | `/pacientes` | `patients`, `expedientes`, `consentimientos` |
| Agenda | `/agenda`, `/citas` | `appointments`, `rooms`, `servicios`, `doctors`, `recordatorios_cita` |
| Centro de Control | `/` | `appointments`, `journey_instances`, `conversaciones` |
| Camino del Paciente | `/camino-paciente` | `journey_*` (12 tablas) |
| Recetas | `/recetas`, `/mis-recetas` | `prescriptions`, `prescription_items` |
| Machote de Receta | `/configuracion/recetas` | `doctor_prescription_templates`, `doctor_prescription_template_versions` |
| Farmacia / POS | `/punto-de-venta` | `pharmacy_*`, `medicamentos`, `lotes_medicamento` |
| Caja / Turnos | `/caja-turno` | `cajas`, `turnos`, `cortes`, `fondos_movimientos` |
| Facturación CFDI | `/facturacion` | `cfdi_*` |
| Inbox / Bot | `/inbox` | `conversaciones`, `mensajes`, `canales`, `identidades_canal`, `bot_*` |
| Almacén | `/almacen` | `medicamentos`, `insumos`, `lotes_medicamento`, `movimientos_inventario`, `almacen_alertas` |
| Panel Médico | `/panel-doctor` | `notas_consulta`, `doctor_contact_attempts` |
| Auditoría | `/auditoria` | `audit_logs`, `pos_error_logs` |
| Pagos en línea | `/detalle-cita/:id` | `payment_gateway_config`, `payment_transactions`, `appointment_economics` |
| Configuración | `/configuracion` | `clinic_settings`, `cajas`, `impresoras`, `rooms`, `servicios`, `checklists` |

---

## 2. Diagrama Entidad-Relación (texto)

```
clinics ─────────────────────────────────────────────────────┐
  │                                                           │
  ├── clinic_memberships ← profiles (auth.users)             │
  │                                                           │
  ├── doctors ──────────────────────────────────────────────┐ │
  │     └── doctor_servicios ← servicios                    │ │
  │     └── doctor_prescription_templates                   │ │
  │           └── doctor_prescription_template_versions     │ │
  │                                                         │ │
  ├── patients ─────────────────────────────────────────────┤ │
  │     ├── expedientes                                     │ │
  │     ├── consentimientos                                 │ │
  │     └── identidades_canal ← canales                    │ │
  │                                                         │ │
  ├── appointments ─────────────────────────────────────────┤ │
  │     ├── (patient_id → patients)                         │ │
  │     ├── (doctor_id → doctors)                           │ │
  │     ├── (room_id → rooms)                               │ │
  │     ├── (servicio_id → servicios)                       │ │
  │     ├── appointment_resources                           │ │
  │     ├── appointment_economics                           │ │
  │     ├── recordatorios_cita                              │ │
  │     ├── payment_transactions                            │ │
  │     └── journey_instances ──────────────────────────────┤ │
  │           ├── journey_instance_steps                    │ │
  │           │     └── journey_instance_step_data          │ │
  │           ├── journey_instance_overrides                │ │
  │           ├── journey_instance_audit                    │ │
  │           ├── prescriptions ───────────────────────────┐│ │
  │           │     └── prescription_items                 ││ │
  │           └── patient_checkout_events                  ││ │
  │                                                        ││ │
  ├── journey_templates ────────────────────────────────────┘│ │
  │     └── journey_template_versions                        │ │
  │           ├── journey_step_definitions                   │ │
  │           │     └── journey_step_fields                  │ │
  │           ├── journey_validation_rules                   │ │
  │           └── journey_option_catalogs                    │ │
  │                 └── journey_option_items                 │ │
  │                                                          │ │
  ├── conversaciones ────────────────────────────────────────┘ │
  │     ├── (identidad_canal_id → identidades_canal)           │
  │     ├── mensajes                                           │
  │     └── bot_sesiones                                       │
  │           └── bot_conversations                            │
  │                                                            │
  ├── cajas ───────────────────────────────────────────────────┤
  │     ├── turnos                                             │
  │     │     ├── cortes                                       │
  │     │     ├── fondos_movimientos                           │
  │     │     └── pharmacy_cash_shifts                         │
  │     └── movimientos                                        │
  │           ├── movimiento_lineas                            │
  │           └── movimiento_pagos ← metodos_pago              │
  │                                                            │
  ├── pharmacy_sales ──────────────────────────────────────────┤
  │     ├── pharmacy_sale_items ← medicamentos/lotes           │
  │     ├── pharmacy_sale_payments                             │
  │     └── pharmacy_returns                                   │
  │           └── pharmacy_return_items                        │
  │                                                            │
  ├── medicamentos ─────────────────────────────────────────── │
  │     └── lotes_medicamento                                  │
  │           └── movimientos_inventario                       │
  │                                                            │
  ├── cfdi_config                                              │
  │     └── cfdi_documentos                                    │
  │           ├── cfdi_conceptos                               │
  │           └── cfdi_receptores                              │
  │                                                            │
  └── clinic_settings                                          │
```

---

## 3. Catálogo de tablas

### 3.1 Identidad y acceso

| Tabla | Propósito | Columnas clave |
|-------|----------|----------------|
| `profiles` | Perfil de usuario (espejo de `auth.users`) | `id` (= auth uid), `nombre`, `apellidos`, `avatar_url` |
| `user_roles` | Roles por usuario y clínica | `user_id`, `clinic_id`, `role` (admin/doctor/nurse/receptionist/patient) |
| `clinics` | Clínicas registradas | `id`, `nombre`, `rfc`, `activo` |
| `clinic_memberships` | Membresía usuario-clínica | `user_id`, `clinic_id`, `role` |
| `clinic_settings` | Config global de la clínica | `clinic_id`, `nombre_comercial`, `logo_url`, `colores`, config. de módulos |

### 3.2 Catálogos clínicos

| Tabla | Propósito | Columnas clave |
|-------|----------|----------------|
| `doctors` | Médicos activos | `nombre`, `apellidos`, `cedula_profesional`, `especialidad`, `activo`, `clinic_id` |
| `rooms` | Consultorios / áreas | `nombre`, `piso`, `activo`, `clinic_id` |
| `servicios` | Tipos de servicio ofrecidos | `nombre`, `duracion_minutos`, `precio`, `activo` |
| `doctor_servicios` | Servicios que ofrece cada médico | `doctor_id`, `servicio_id` |
| `patients` | Pacientes registrados | `nombre`, `apellidos`, `fecha_nacimiento`, `sexo` (M/F/Otro), `telefono`, `email`, `activo`, `clinic_id` |
| `expedientes` | Expediente clínico del paciente | `patient_id`, `doctor_id`, `tipo`, `activo` |
| `consentimientos` | Consentimientos informados | `patient_id`, `tipo`, `otorgado`, `otorgado_at` |
| `notas_consulta` | Notas SOAP de consulta | `patient_id`, `doctor_id`, `appointment_id`, `subjetivo`, `objetivo`, `diagnostico`, `plan` |
| `checklists` | Checklists configurables | `clinic_id`, `nombre`, `items` (jsonb) |
| `conceptos` | Conceptos de cobro | `nombre`, `precio`, `activo` |
| `metodos_pago` | Métodos de pago aceptados | `nombre`, `tipo`, `activo` |
| `proveedores` | Proveedores de insumos/medicamentos | `nombre`, `contacto`, `activo` |

### 3.3 Agenda y citas

| Tabla | Propósito | Columnas clave |
|-------|----------|----------------|
| `appointments` | Citas agendadas | `patient_id`, `doctor_id`, `room_id`, `servicio_id`, `status`, `fecha_hora`, `source` (web/telegram/etc) |
| `appointment_resources` | Recursos asignados a cita | `appointment_id`, `tipo`, `nombre` |
| `appointment_economics` | Datos económicos de la cita | `appointment_id`, `monto`, `descuento`, `total` |
| `recordatorios_cita` | Recordatorios enviados al paciente | `appointment_id`, `canal`, `programado_para`, `enviado_at`, `status` |
| `payment_gateway_config` | Config de Stripe por clínica | `clinic_id`, `pk_key`, `ambiente` (sandbox/produccion) |
| `payment_transactions` | Transacciones de pago Stripe | `appointment_id`, `stripe_payment_intent_id`, `monto`, `status` |

### 3.4 Camino del Paciente (Journey)

**Plantillas (configuración):**

| Tabla | Propósito |
|-------|----------|
| `journey_templates` | Plantilla de flujo (una por clínica activa) |
| `journey_template_versions` | Versiones de plantilla (draft/active/archived) |
| `journey_step_definitions` | Pasos definidos en la versión (step_key, step_type, roles, reglas) |
| `journey_step_fields` | Campos personalizados por paso |
| `journey_validation_rules` | Reglas de validación por versión |
| `journey_option_catalogs` | Catálogos de opciones (ej. motivos de consulta) |
| `journey_option_items` | Ítems de catálogos |

**Instancias (operativo):**

| Tabla | Propósito |
|-------|----------|
| `journey_instances` | Instancia del flujo para una cita (1 a 1 con appointment) |
| `journey_instance_steps` | Estado de cada paso en la instancia |
| `journey_instance_step_data` | Datos capturados en cada paso (jsonb flexible) |
| `journey_instance_overrides` | Overrides autorizados (saltar pasos, cambiar roles) |
| `journey_instance_audit` | Log de cada acción sobre la instancia |
| `patient_checkout_events` | Evento de alta/egreso del paciente |

**Step keys críticos (10):**  
`identification` → `consent` → `record` → `consultation` → `diagnosis` → `prescription` → `billing` → `followup` → `discharge` → `audit`

### 3.5 Recetas

| Tabla | Propósito | Columnas clave |
|-------|----------|----------------|
| `prescriptions` | Receta médica | `patient_id`, `doctor_id`, `journey_instance_id`, `appointment_id`, `status` (draft/issued/partially_dispensed/dispensed/cancelled), `prescription_number`, `qr_code_value`, `diagnosis`, `template_snapshot_json` |
| `prescription_items` | Medicamentos de la receta | `prescription_id`, `medication_id`, `generic_name`, `dose`, `route`, `frequency`, `duration`, `is_controlled` |
| `doctor_prescription_templates` | Machote visual del doctor (logo, firma, etc.) | `doctor_id`, `current_version_id` |
| `doctor_prescription_template_versions` | Versiones publicadas del machote | `template_id`, `snapshot_json`, `published_at` |

**RPC:** `generate_prescription_number_for_doctor(_doctor_id)` → genera folio único `RX-YYYYMMDD-XXXX-NNNNN`

### 3.6 Farmacia / POS

| Tabla | Propósito |
|-------|----------|
| `medicamentos` | Catálogo de medicamentos | `nombre`, `precio_unitario`, `unidad`, `is_controlled`, `activo` |
| `lotes_medicamento` | Lotes en inventario | `medicamento_id`, `numero_lote`, `fecha_caducidad`, `existencia`, `precio_compra` |
| `insumos` | Insumos no-medicamento | `nombre`, `unidad`, `existencia`, `activo` |
| `kits` | Kits de venta combinados | `nombre`, `precio` |
| `kit_items` | Ítems de cada kit | `kit_id`, `medicamento_id`, `cantidad` |
| `pharmacy_sales` | Ventas de farmacia | `turno_id`, `patient_id`, `total`, `status` |
| `pharmacy_sale_items` | Líneas de venta | `sale_id`, `medicamento_id`, `lote_id`, `quantity`, `unit_price`, `prescription_item_id` |
| `pharmacy_sale_payments` | Pagos de venta | `sale_id`, `metodo_pago_id`, `monto` |
| `pharmacy_returns` | Devoluciones | `sale_id`, `motivo`, `total_devuelto` |
| `pharmacy_return_items` | Ítems devueltos | `return_id`, `sale_item_id`, `quantity` |
| `pharmacy_cash_shifts` | Turno de caja farmacia (Supabase link) | `turno_id`, `opened_at`, `closed_at` |
| `movimientos_inventario` | Entradas/salidas de stock | `medicamento_id`, `lote_id`, `cantidad`, `tipo` (entrada/salida/ajuste), `motivo` |
| `almacen_alertas` | Alertas de desabasto | `medicamento_id`, `tipo`, `quantity_needed`, `quantity_available`, `prescription_id` |
| `pos_error_logs` | Errores del POS registrados | `turno_id`, `tipo`, `detalle`, `created_at` |

### 3.7 Caja y Movimientos

| Tabla | Propósito |
|-------|----------|
| `cajas` | Cajas registradoras | `nombre`, `fondo_default`, `es_farmacia`, `clinic_id` |
| `turnos` | Turnos de operación de caja | `caja_id`, `abierto_por`, `estado` (abierto/cerrado), `fondo_apertura` |
| `cortes` | Cortes de turno (cierre de caja) | `turno_id`, `folio`, `efectivo_esperado`, `efectivo_contado`, `diferencia` |
| `fondos_movimientos` | Entradas/salidas durante turno | `turno_id`, `tipo`, `monto`, `concepto` |
| `movimientos` | Movimientos generales de cobro | `turno_id`, `patient_id`, `monto_total`, `status` |
| `movimiento_lineas` | Líneas de concepto de movimiento | `movimiento_id`, `concepto_id`, `cantidad`, `precio_unitario` |
| `movimiento_pagos` | Pagos del movimiento | `movimiento_id`, `metodo_pago_id`, `monto` |

### 3.8 Facturación CFDI

| Tabla | Propósito |
|-------|----------|
| `cfdi_config` | Configuración del emisor CFDI | `clinic_id`, `rfc`, `razon_social`, `serie`, `regimen_fiscal` |
| `cfdi_documentos` | Facturas generadas | `clinic_id`, `receptor_id`, `uuid_sat`, `total`, `status`, `xml_url` |
| `cfdi_conceptos` | Conceptos de la factura | `documento_id`, `descripcion`, `valor_unitario`, `importe`, `clave_prod_serv` |
| `cfdi_receptores` | Receptores (clientes) CFDI | `rfc`, `razon_social`, `uso_cfdi`, `email` |

### 3.9 Canal / Inbox / Bot

| Tabla | Propósito |
|-------|----------|
| `canales` | Canales de comunicación (Telegram, WhatsApp, etc.) | `nombre`, `tipo`, `activo` |
| `identidades_canal` | Identidad del paciente en cada canal | `patient_id`, `canal_id`, `identificador` (chat_id Telegram, etc.) |
| `patient_channel_identities` | Alias alternativo de `identidades_canal` |
| `conversaciones` | Conversaciones abiertas | `identidad_canal_id`, `status` (abierta/cerrada/escalada), `last_message_at` |
| `mensajes` | Mensajes individuales | `conversacion_id`, `autor` (paciente/bot/humano), `contenido`, `leido` |
| `bot_sesiones` | Estado de sesión del bot Telegram | `chat_id`, `flow_data` (jsonb), `estado`, `clinic_id` |
| `bot_conversations` | Historial de conversaciones bot | `sesion_id`, `role`, `content` |
| `bot_usage_costs` | Costos de uso del bot (IA) | `clinic_id`, `modelo`, `tokens_in`, `tokens_out`, `costo_usd` |
| `doctor_contact_attempts` | Intentos de contacto al médico | `appointment_id`, `doctor_id`, `canal`, `resultado`, `notas` |

### 3.10 Auditoría y Monitoreo

| Tabla | Propósito |
|-------|----------|
| `audit_logs` | Log de auditoría de acciones | `user_id`, `clinic_id`, `accion`, `tabla`, `registro_id`, `detalle` (jsonb) |
| `pos_error_logs` | Errores operativos del POS | `turno_id`, `tipo`, `detalle`, `created_at` |

---

## 4. Flujos de proceso principales

### 4.1 Alta de cita → Atención → Alta médica

```
1. [Telegram/Web] Paciente agenda cita
   → appointments (INSERT, status='agendada')
   → recordatorios_cita (INSERT, programado_para)

2. [Centro de Control] Enfermera confirma llegada
   → journey_instances (INSERT, appointment_id)
   → journey_instance_steps (INSERT, one per step_definition)
   → paso 'identification' → status='completed'

3. [Camino Paciente] Flujo paso a paso
   identification → consent → record → consultation
   → diagnosis → prescription → billing → followup → discharge → audit

   Cada paso:
   - journey_instance_steps (UPDATE status)
   - journey_instance_step_data (INSERT/UPDATE con datos del paso)
   - journey_instance_audit (INSERT evento)
   - update_journey_progress() RPC recalcula progreso

4. [Paso prescription] Médico emite receta
   → prescriptions (INSERT status='draft')
   → prescription_items (INSERT x N medicamentos)
   → issuePrescription() → UPDATE status='issued', genera folio RX-*
   → almacen_alertas si stock insuficiente

5. [Farmacia] Surtir receta
   → SurtirReceta escanea prescription_number / QR
   → pharmacy_sales (INSERT)
   → pharmacy_sale_items (INSERT, descuenta lotes_medicamento)
   → prescriptions (UPDATE status='dispensed')

6. [Alta] Egreso del paciente
   → patient_checkout_events (INSERT checkout_type, discharge_summary)
   → journey_instance_steps 'discharge' → status='completed'
   → update_journey_progress()
```

### 4.2 Facturación CFDI

```
1. Recepcionista selecciona movimiento cobrado
2. Busca/crea cfdi_receptores (RFC del paciente/empresa)
3. Genera cfdi_documentos con cfdi_conceptos
4. Timbra con PAC externo → recibe UUID SAT
5. UPDATE cfdi_documentos.uuid_sat, xml_url
6. Envía XML + PDF por email
```

### 4.3 Turno de caja

```
1. Apertura de turno
   → turnos (INSERT, fondo_apertura, abierto_por)
   → pharmacy_cash_shifts (INSERT si es caja farmacia)

2. Operaciones durante turno
   → movimientos + movimiento_lineas + movimiento_pagos
   → pharmacy_sales (si es farmacia)
   → fondos_movimientos (retiros/depósitos al fondo)

3. Cierre de turno
   → cortes (INSERT con conteo esperado vs contado)
   → turnos (UPDATE estado='cerrado')
```

### 4.4 Agendamiento Telegram

```
1. Paciente escribe al bot
2. bot_sesiones (UPSERT) guarda estado del wizard en flow_data
3. Wizard: selección de servicio → doctor → fecha → confirmación
4. appointments (INSERT) + identidades_canal link
5. recordatorios_cita programados
6. Telegram message enviado vía Edge Function telegram-webhook
```

---

## 5. Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| Auth | Supabase Auth (JWT) |
| DB | Supabase Postgres (RLS habilitado en todas las tablas) |
| Storage | Supabase Storage (bucket: `doctor-assets`) |
| Edge Functions | Supabase Edge Functions (Deno) — `telegram-webhook`, `stripe-payment-intent` |
| Deploy | Cloudflare Workers (SPA assets) |
| CI/CD | GitHub Actions → Cloudflare Workers via `wrangler-action@v3` |
| Pagos | Stripe (modo sandbox/producción via `payment_gateway_config`) |
| Error monitoring | Sentry (`@sentry/react`) + BetterStack Logtail (`@logtail/browser`) |
| Analytics | Umami (`cloud.umami.is`) |
| Bot | Telegram Bot API (webhook) |

---

## 6. Políticas de seguridad (RLS)

Todas las tablas tienen RLS habilitado. Política general:
- `FOR ALL TO authenticated USING (true)` — usuarios autenticados ven todo
- Algunas tablas tienen `clinic_id` para isolación multi-clínica (no enforced en RLS todavía — logic en frontend)
- `profiles` auto-creado por trigger en `auth.users`

---

## 7. Índice de RPCs (funciones SQL)

| Función | Propósito |
|---------|----------|
| `update_journey_progress(_journey_instance_id)` | Recalcula progreso % de instancia del camino del paciente |
| `generate_prescription_number_for_doctor(_doctor_id)` | Genera folio único de receta RX-YYYYMMDD-XXXX-NNNNN |

---

## 8. Monitoreo y observabilidad

| Herramienta | Qué monitorea | Config |
|-------------|--------------|--------|
| Sentry | Excepciones JS, render errors, promesas rechazadas | `VITE_SENTRY_DSN` env var |
| BetterStack | Logs estructurados (info/warn/error) | `VITE_BETTERSTACK_TOKEN` env var |
| Umami | Analytics de visitas (sin cookies) | Script en `index.html`, website `4d0bd8ed-93f6-405f-b834-8ae6033f1780` |

---

*Actualizar este documento cuando se agreguen nuevas tablas o flujos significativos.*
