# S4 — Pen-test onboarding tenants (2026-07-21)

Alcance: create-tenant, verify-tenant-code, provision-users-from-queue, platform_staff_pending. Read-only, sin fixes aplicados (esperan aprobación).

## Hallazgos

### H1 — HIGH · Fuga multi-tenant en tabla `clinics` (`USING(true)`)
- Policy SELECT de `clinics`: `"Authenticated users can read clinics"` → `qual = true`, rol `authenticated`.
- `clinics` contiene `verification_code` (6 díg. texto plano), `verification_code_expires_at`, `pending_admin_email`, `pending_modulo_ids`, `rfc`, `contacto_facturacion_email`, y columnas Stripe (customer/subscription/plan/status).
- Efecto: **cualquier** usuario autenticado (doctor, enfermera, recepción, paciente PWA lealtad) puede leer esos datos de TODAS las clínicas. Fuga de PII/billing cross-tenant.
- `verification_code` en sí es menor (verify-tenant-code exige `is_global_admin`; externo no completa alta), pero el dato se filtra.
- Es el antipatrón que CLAUDE.md ya prohíbe (lección PWA lealtad 2026-06-24), aquí sobre la tabla raíz.

**Fix propuesto (2 capas, app-risky la RLS — requiere aprobación + verificación en browser):**
1. **Limpiar el código tras uso**: `verify-tenant-code` debe `UPDATE clinics SET verification_code=NULL, verification_code_expires_at=NULL` al validar OK. Barato, sin riesgo de romper app.
2. **Scoping RLS**: reemplazar `USING(true)` por membership + platform_staff:
   `USING (is_global_admin(auth.uid()) OR EXISTS(SELECT 1 FROM clinic_memberships m WHERE m.clinic_id = clinics.id AND m.user_id = auth.uid()))`.
   RIESGO: la app probablemente lee `clinics` antes de resolver membership (login, entrada de código de tenant, useActiveClinic). Verificar qué se rompe antes de aplicar. Alternativa menos invasiva si scoping rompe demasiado: revocar SELECT a nivel columna de las columnas sensibles (`REVOKE SELECT (verification_code, verification_code_expires_at, pending_admin_email, pending_modulo_ids) ON clinics FROM authenticated`) manteniendo `USING(true)` para las columnas operativas (name, code, logo). Cubre la fuga de PII sin tocar visibilidad de fila.

### H2 — MEDIUM · provision-users-from-queue procesa la cola GLOBAL con rol admin de cualquier clínica
- Auth: service_role OR `has_role(admin)`. Un admin de la clínica A dispara el procesamiento de los primeros 50 pendientes de user_provisioning_queue de TODAS las clínicas, no solo la suya.
- No filtra por clinic del caller. No es fuga de datos, pero es acción cross-tenant (crea/vincula usuarios de otros tenants).
- Fix: scopear la query de la cola al clinic del caller cuando no es service_role, o exigir platform_staff para procesar global.

### H3 — LOW · Sin límite de intentos en verify-tenant-code (código 6 díg.)
- 10^6 espacio, ventana 30 min, sin contador de intentos. Mitigado por `is_global_admin` (solo staff), por eso LOW. Si algún día se abre a self-service, sube a HIGH. Anotar.

### H4 — LOW · CORS `*` en las 3 functions
- Aceptable con auth por token (no cookies), pero endurecer a origen `integrika.mx` es barato. Opcional.

## Sin hallazgo (verificado OK)
- `platform_staff_pending`: RLS on, sin policies de cliente, solo GRANT service_role. Spoofing por cliente para auto-promoverse a platform_staff = imposible. Trigger `provision_on_auth_user_created` promueve solo si el email ya está en la tabla (poblada solo por SQL/service_role) y Google verifica ownership del email. Correcto.
- create-tenant / verify-tenant-code: auth getUser + is_global_admin correcta; inputs validados (RFC/email regex, módulos activos con stripe_price_id). Reversa de clinic si falla el email. Bien.
- verification_code plaintext en BD: aceptable SI se aplica H1 (scoping/columna) + limpieza tras uso; hashing es defensa extra, no crítico una vez cerrada la fuga.

## Recomendación de orden
1. H1 capa 1 (nullear código tras uso) — barato, ya.
2. H1 capa 2 (RLS) — Opus 4.8, con verificación en browser de login/entrada de tenant antes de deploy.
3. H2 — Sonnet.
4. H3/H4 — anotados, atacar si se abre self-service.
