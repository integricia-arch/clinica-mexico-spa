# 05 — Esquema de Backend: Modelo de Datos y Auth

---

## Enums

```sql
app_role: admin | receptionist | doctor | nurse | patient

appointment_status:
  solicitada | tentativa | pendiente_formulario | confirmada |
  recordatorio_enviado | confirmada_paciente | confirmada_medico |
  cancelada | liberada

reminder_channel: whatsapp | sms | email  (histórico, ahora solo Telegram)
reminder_status: pendiente | enviado | fallido
audit_action: crear | actualizar | cancelar
```

---

## Tablas Principales

### `auth.users` (Supabase Auth, no tocar)
- `id` uuid PK
- `email` text
- Sistema Supabase gestiona passwords/tokens

### `user_roles`
- `id` uuid PK
- `user_id` uuid FK → auth.users (CASCADE)
- `role` app_role
- UNIQUE(user_id, role)

### `profiles`
- `id` uuid PK FK → auth.users (CASCADE)  
- `nombre` text
- `apellidos` text
- `avatar_url` text
- Trigger: auto-crea al hacer signup

### `clinics`
- `id` uuid PK
- `nombre` text
- `direccion` text
- `telefono` text
- `email` text
- `rfc` text
- `logo_url` text
- `activo` boolean DEFAULT true
- `created_at` timestamptz

### `clinic_memberships`
- `id` uuid PK
- `clinic_id` uuid FK → clinics
- `user_id` uuid FK → auth.users
- `role` app_role
- UNIQUE(clinic_id, user_id)

### `doctors`
- `id` uuid PK
- `user_id` uuid FK → auth.users UNIQUE
- `nombre` text NOT NULL
- `apellidos` text NOT NULL
- `especialidad` text NOT NULL
- `cedula_profesional` text
- `telefono` text
- `horario_inicio` time DEFAULT '08:00'
- `horario_fin` time DEFAULT '18:00'
- `duracion_cita_min` integer DEFAULT 30
- `activo` boolean DEFAULT true
- `created_at`, `updated_at` timestamptz

### `doctor_calendars` (excepciones de horario)
- `id` uuid PK
- `doctor_id` uuid FK → doctors
- `fecha` date NOT NULL
- `disponible` boolean — false = día bloqueado
- `horario_inicio` time — override
- `horario_fin` time — override
- `motivo` text
- `created_at` timestamptz

### `rooms`
- `id` uuid PK
- `nombre` text NOT NULL
- `piso` text
- `capacidad` integer DEFAULT 1
- `equipamiento` text
- `activo` boolean DEFAULT true

### `patients`
- `id` uuid PK
- `user_id` uuid FK → auth.users (nullable, pacientes sin cuenta)
- `nombre` text NOT NULL
- `apellidos` text NOT NULL
- `fecha_nacimiento` date
- `sexo` text CHECK IN ('M', 'F', 'Otro')
- `curp` text
- `rfc` text
- `telefono` text
- `email` text
- `direccion`, `colonia`, `municipio`, `estado`, `codigo_postal` text
- `contacto_emergencia_nombre` text
- `contacto_emergencia_telefono` text
- `tipo_sangre` text
- `alergias` text
- `notas` text
- `activo` boolean DEFAULT true
- `created_at`, `updated_at` timestamptz

### `appointments`
- `id` uuid PK
- `patient_id` uuid FK → patients (CASCADE)
- `doctor_id` uuid FK → doctors (CASCADE)
- `room_id` uuid FK → rooms (SET NULL)
- `fecha_inicio` timestamptz NOT NULL
- `fecha_fin` timestamptz NOT NULL
- `status` appointment_status DEFAULT 'solicitada'
- `motivo_consulta` text
- `notas` text
- `created_by` uuid FK → auth.users
- `created_at`, `updated_at` timestamptz
- CONSTRAINT: fecha_fin > fecha_inicio

---

## Tablas de Comunicación (Bot/Telegram)

### `identidades_canal` (una por chat_id de Telegram)
- `id` uuid PK
- `patient_id` uuid FK → patients
- `canal` text — 'telegram'
- `canal_id` text — chat_id de Telegram
- `activo` boolean DEFAULT true
- `created_at` timestamptz
- UNIQUE(canal, canal_id)

### `conversaciones`
- `id` uuid PK
- `identidad_canal_id` uuid FK → identidades_canal
- `status` text — 'activa' | 'escalada' | 'cerrada'
- `created_at`, `updated_at` timestamptz

### `mensajes`
- `id` uuid PK
- `conversacion_id` uuid FK → conversaciones
- `origen` text — 'paciente' | 'bot' | 'humano'
- `contenido` text NOT NULL
- `metadata` jsonb — raw Telegram message
- `created_at` timestamptz

### `recordatorios_cita` (ADR-001: tabla unificada)
- `id` uuid PK
- `appointment_id` uuid FK → appointments
- `identidad_canal_id` uuid FK → identidades_canal
- `tipo` text — 'T-24h' | 'T-2h' | 'manual'
- `hora_envio` timestamptz NOT NULL
- `status` reminder_status DEFAULT 'pendiente'
- `mensaje` text
- `enviado_at` timestamptz
- `error_mensaje` text
- `created_at` timestamptz

---

## Tablas de Expedientes

### `expedientes`
- `id` uuid PK
- `patient_id` uuid FK → patients (CASCADE)
- `doctor_id` uuid FK → doctors
- `appointment_id` uuid FK → appointments (nullable)
- `tipo` text — 'consulta' | 'laboratorio' | 'imagen' | 'receta'
- `titulo` text NOT NULL
- `contenido` text
- `archivo_url` text
- `created_at`, `updated_at` timestamptz

---

## Tablas de Farmacia

### `medicamentos_catalogo`
- `id` uuid PK
- `nombre` text NOT NULL
- `presentacion` text
- `principio_activo` text
- `precio_venta` numeric(10,2)
- `stock` integer DEFAULT 0
- `requiere_receta` boolean DEFAULT false
- `activo` boolean DEFAULT true
- `created_at`, `updated_at` timestamptz

### `ventas_farmacia`
- `id` uuid PK
- `patient_id` uuid FK → patients (nullable)
- `doctor_id` uuid FK → doctors (nullable)
- `folio` text UNIQUE
- `total` numeric(10,2)
- `metodo_pago` text
- `receta_capturada` boolean DEFAULT false
- `notas` text
- `created_by` uuid FK → auth.users
- `created_at` timestamptz

### `ventas_farmacia_detalle`
- `id` uuid PK
- `venta_id` uuid FK → ventas_farmacia (CASCADE)
- `medicamento_id` uuid FK → medicamentos_catalogo
- `cantidad` integer NOT NULL
- `precio_unitario` numeric(10,2)
- `subtotal` numeric(10,2)

### `cortes_caja`
- `id` uuid PK
- `fecha_corte` date NOT NULL
- `total_efectivo` numeric(10,2)
- `total_tarjeta` numeric(10,2)
- `total_transferencia` numeric(10,2)
- `total_general` numeric(10,2)
- `notas` text
- `created_by` uuid FK → auth.users
- `created_at` timestamptz

---

## Tablas de Auditoría / Notificaciones

### `audit_log`
- `id` uuid PK
- `tabla` text
- `accion` audit_action
- `registro_id` uuid
- `usuario_id` uuid FK → auth.users
- `datos_antes` jsonb
- `datos_despues` jsonb
- `created_at` timestamptz

### `notification_rules`
- `id` uuid PK
- `tipo` text
- `canal` text
- `activo` boolean
- `configuracion` jsonb
- `created_at` timestamptz

---

## Auth y RLS

**Proveedor:** Supabase Auth (JWT)

**Reglas RLS generales:**
- `user_roles` — solo admin puede modificar
- `appointments` — receptionist/admin ven todas; doctor ve las suyas; paciente ve las propias
- `patients` — receptionist/admin CRUD; doctor read; paciente solo la suya
- `expedientes` — doctor/admin CRUD; paciente read solo los suyos
- `ventas_farmacia` — farmacia/admin CRUD
- `conversaciones/mensajes` — receptionist/admin
- `recordatorios_cita` — receptionist/admin CRUD; sistema (service_role) ejecuta envíos

**Telegram webhook:** SIN JWT — auth vía header `x-telegram-bot-api-secret-token = WEBHOOK_SECRET`  
**enviar-mensaje-humano:** CON JWT (usuario autenticado desde frontend)

---

## Edge Functions

| Función | Auth | Propósito |
|---|---|---|
| `telegram-webhook` | WEBHOOK_SECRET | Recibe updates Telegram, orquesta bot IA |
| `enviar-recordatorios` | service_role interno | Procesa y despacha recordatorios pendientes |
| `enviar-mensaje-humano` | JWT usuario | Recepción responde al paciente vía Telegram |
| `get-doctor-calendars` | JWT usuario | RPC para disponibilidad de doctores |

## pg_cron Jobs

| Job | Schedule | Función |
|---|---|---|
| `enviar-recordatorios-5min` | `*/5 * * * *` | Llama enviar-recordatorios procesador |

---

## Decisiones Técnicas (ADRs)

| # | Decisión | Razón |
|---|---|---|
| ADR-001 | Tabla única `recordatorios_cita` con FK a `identidades_canal` | Mejor modelo multi-canal vs tabla legacy `reminders` |
| ADR-002 | Timezone México fijo `-06:00` | México sin DST desde 2022, offset fijo simplifica |
| ADR-003 | Webhook Telegram sin JWT | Telegram no envía Bearer JWT |
| ADR-004 | `enviar-mensaje-humano` con JWT | Llamado desde frontend autenticado |

---

## Índices Clave

- `appointments(doctor_id, fecha_inicio)` — consultas de disponibilidad
- `appointments(patient_id)` — historial de citas
- `recordatorios_cita(status, hora_envio)` — procesador pg_cron
- `identidades_canal(canal, canal_id)` — lookup por chat_id Telegram
- `conversaciones(status)` — filtro inbox escaladas
