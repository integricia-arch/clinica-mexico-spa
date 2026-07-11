# Endurecimiento de seguridad — reducir blast radius de un breach

**Fecha**: 2026-07-11
**Origen**: pedido de sesión 24 ("separar DB usuarios/pacientes por seguridad"),
nunca se preguntó el motivo exacto en su momento. Retomado en sesión 37 vía
`superpowers:brainstorming` para entender el motivo real antes de diseñar.

## Motivo real (confirmado con el usuario)

**NO es un requisito de cumplimiento (LFPDPPP) ni de auditoría externa.** El
motivo real es reducir el **blast radius** de un breach: que comprometer las
credenciales de un miembro del staff, o que se filtre la `service_role` key,
no dé acceso directo/silencioso a datos clínicos (PHI) de pacientes.

Dos escenarios de amenaza, ambos igual de prioritarios:

1. **Cuenta de staff/admin comprometida** (password robado, phishing, sesión
   secuestrada) — qué tanto PHI puede ver/exportar un atacante con esa sesión.
2. **`service_role` key filtrada** (log, repo, Edge Function mal configurada)
   — la clave maestra que bypassa RLS por completo.

## Alcance: NO separación física de bases de datos

Se evaluaron 3 niveles de esfuerzo con el usuario:
- Separación física total (2 proyectos Supabase) — semanas, reescribe Fase A/B.
- Separación lógica (schemas distintos, mismo proyecto) — días.
- **Endurecer lo que ya existe (RLS + auditoría + cifrado) — elegido.**

Hoy toda la data vive en un solo proyecto Supabase (`kyfkvdyxpvpiacyymldc`),
separada por RLS + `clinic_id` (diseño de Fase A, ya auditado en sesión 18).
Ese diseño se mantiene. Este spec NO reabre esa decisión — agrega controles
de detección y reducción de superficie de ataque encima de lo que ya existe.

## Medida 1 — mitigar cuenta de staff comprometida

### 1a. Auditoría de roles vs. necesidad real de acceso a PHI
Revisar cada rol (`admin`, `manager`, `nurse`, `receptionist`, `cajero`,
`doctor`) contra qué tablas de PHI puede leer hoy vía RLS
(`patients`, `prescriptions`, `patient_studies`, `notas_consulta`,
`expediente_permissions`). Confirmar que el principio de mínimo privilegio
se cumple — ej. ¿`cajero` necesita leer notas médicas completas, o solo
datos de facturación del paciente? Producir un documento de mapeo
rol→tablas→justificación, y una lista de sobre-permisos a corregir si
aparecen.

### 1b. MFA obligatorio para roles de alto privilegio
Supabase Auth soporta TOTP nativo. Forzar MFA (no solo ofrecerlo) para
`platform_staff` y rol `admin` de cada clínica — son los roles con mayor
superficie de acceso a PHI cross-paciente. Roles operativos (`nurse`,
`receptionist`, `cajero`, `doctor`) quedan fuera de este spec salvo que
la auditoría 1a revele que también necesitan el mismo nivel de acceso.

### 1c. Cerrar pendiente ya identificado: leaked password protection
Toggle manual en Supabase dashboard (Authentication → Settings → Password
Security) — ya documentado como pendiente en `memoria/STATE.md`, sin
scriptable vía MCP/API. Se incluye acá porque es parte del mismo objetivo
(cuenta de staff comprometida por password reutilizado/filtrado).

### 1d. Log de auditoría append-only de acceso a PHI
Hoy no existe ningún registro de qué usuario leyó/exportó el expediente de
qué paciente y cuándo. Sin esto, un abuso de sesión legítima (staff con
acceso correcto que decide mirar/exportar de más) es indetectable. Agregar:
- Tabla `phi_access_log` (append-only, sin UPDATE/DELETE permitido ni para
  `service_role` vía policy — solo INSERT).
- Trigger o wrapper de RPC en las tablas sensibles (`patients`,
  `prescriptions`, `patient_studies`, `notas_consulta`) que registre
  `user_id`, `clinic_id`, `patient_id`, `accion` (select/export),
  `timestamp`.
- Este log es para **detección posterior**, no bloquea ninguna operación
  en tiempo real — no debe agregar latencia perceptible a las pantallas
  clínicas.

## Medida 2 — mitigar filtración de `service_role` key

### 2a. Secret-scanning en CI
Agregar un step de secret-scanning (ej. `gitleaks`) al workflow de GitHub
Actions existente (`.github/workflows/`), corriendo en cada push/PR, para
detectar si una key (`service_role`, Stripe secret, etc.) se commitea por
error antes de que llegue a `main`.

### 2b. Auditoría de uso de `service_role` en Edge Functions
Listar todas las Edge Functions que usan `service_role` (bypassa RLS por
diseño) y confirmar que cada una filtra explícitamente por `clinic_id` en
código — defensa en profundidad, no depender solo de que el bypass es
intencional y estaba bien cuando se escribió. Documentar cuáles lo hacen
bien y corregir las que no.

### 2c. Runbook de rotación de `service_role`
Hoy no existe un procedimiento documentado para rotar la key rápido si se
sospecha filtración. Escribir un runbook corto en `docs/` (o
`memoria/conceptos/`): pasos exactos para rotar `service_role` en Supabase
dashboard + qué Edge Functions/secrets de GitHub Actions hay que actualizar
después, para minimizar downtime.

## Fuera de alcance (explícito)

- Separación física o lógica de bases de datos — descartada en el
  brainstorming, ver sección "Alcance" arriba.
- MFA para roles operativos (`nurse`, `receptionist`, `cajero`, `doctor`) —
  salvo que 1a revele necesidad real.
- Cifrado a nivel de columna de PHI — no se discutió, no pedido por el
  usuario; si se quiere, es un spec aparte (impacto en queries/índices más
  grande).
- Re-auditoría completa de RLS ya hecha en sesión 18 (`get_advisors`
  security) — este spec asume esa base como correcta y agrega controles
  encima, no la repite.

## Testing / verificación

- 1a: documento de mapeo revisado y aprobado por el usuario antes de tocar
  cualquier policy.
- 1b: confirmar en Supabase Auth que un login de `platform_staff`/`admin`
  sin MFA configurado es rechazado o forzado a enrolarse.
- 1d: insertar/leer un registro de paciente de prueba y confirmar que
  aparece en `phi_access_log` con los campos correctos; confirmar que un
  intento de `UPDATE`/`DELETE` sobre esa tabla falla por policy incluso
  con `service_role`.
- 2a: commitear una key falsa de prueba en una rama de test y confirmar que
  el CI la bloquea.
- 2b: lista completa de Edge Functions con `service_role` + veredicto
  (filtra bien / corregido / no aplica) como entregable revisable.
