# Runbook: recovery de MFA para admin/platform_staff con dispositivo TOTP perdido

**Fecha**: 2026-07-11
**Contexto**: bloqueante encontrado en el review final del plan de endurecimiento
de seguridad "blast radius" (Task 5, ya commiteada). Task 5 agregó MFA (TOTP)
obligatorio para los roles `admin` y `platform_staff` — ver
`src/hooks/useMfaEnforcement.ts` y `src/components/MfaEnrollmentGate.tsx`.

## El problema

`useMfaEnforcement` calcula el estado del gate así (`src/hooks/useMfaEnforcement.ts:7-16`):

```ts
export function mfaGateStatus(currentLevel, nextLevel, requiresMfa) {
  if (!requiresMfa) return "ok";
  if (currentLevel === "aal2") return "ok";
  if (nextLevel === "aal2") return "needs-challenge";
  return "needs-enroll";
}
```

Si el usuario ya tiene un factor TOTP enrolado, `nextLevel` es `aal2` y el
estado queda en `needs-challenge` para siempre — `MfaEnrollmentGate.tsx` solo
ofrece "Verificar con mi app de autenticación" (líneas 67-75), sin ninguna
salida alternativa (no hay backup codes, no hay flujo "perdí mi dispositivo").

`supabase.auth.mfa.unenroll()` requiere que la sesión ya esté en `aal2` para
poder desenrolar un factor — círculo vicioso: para desenrolar el factor
perdido hace falta pasar el challenge de ese mismo factor perdido.

**Peor caso**: si el único usuario `admin`/`platform_staff` del sistema
pierde su dispositivo TOTP, queda bloqueado sin salida vía la app — no hay
forma de recuperar acceso sin intervención fuera de la aplicación.

## 1. Síntoma

Desde la perspectiva del usuario:

- Login con email/password (o Google) funciona normalmente.
- Inmediatamente después aparece la pantalla "Verificación en dos pasos
  requerida" con el botón "Verificar con mi app de autenticación".
- Al tocar el botón, se le pide un código de 6 dígitos.
- El usuario no tiene el dispositivo/app donde tenía el TOTP configurado
  (celular perdido, roto, reinstalado, cambiado sin migrar el secreto).
- No hay ningún link, botón, o texto alternativo en la pantalla — el usuario
  queda atascado ahí indefinidamente, sin poder llegar al resto de la app.

## 2. Quién puede resolverlo

**No otro admin de la app.** Ningún flujo dentro de la aplicación permite que
un admin resetee el MFA de otro usuario (no existe esa función hoy). Si el
usuario bloqueado es el único `admin`/`platform_staff` del sistema, nadie
dentro de la app puede ayudarlo.

Quien resuelve esto es **alguien con acceso al Supabase Dashboard del
proyecto** — típicamente el dueño/dev del proyecto (mismo actor que ya
necesita el dashboard para el setup inicial de cualquier clínica, ver
sección 5). Project ref de producción: `kyfkvdyxpvpiacyymldc`.

## 3. Pasos en el Supabase Dashboard

1. Entrar a `https://supabase.com/dashboard/project/kyfkvdyxpvpiacyymldc`.
2. Ir a **Authentication → Users**.
3. Buscar al usuario bloqueado por email y abrir su detalle.
4. Ubicar la sección de factores MFA del usuario y eliminar/reiniciar el
   factor TOTP registrado.

   > **Verificar en el dashboard real antes de necesitarlo en un incidente
   > real**: no confirmamos en esta sesión el nombre exacto de la sección
   > (puede aparecer como "MFA factors", "Multi-Factor Authentication", o
   > dentro de un panel de detalle del usuario). La funcionalidad de ver y
   > eliminar factores MFA por usuario existe en el dashboard de Supabase
   > Auth — el nombre exacto del menú puede variar entre versiones del
   > dashboard.

5. Confirmar con el usuario que, al volver a intentar login, el gate lo
   manda por el flujo `needs-enroll` (pantalla "Configurar autenticación de
   dos factores" con QR nuevo) en vez de `needs-challenge`. Esto confirma
   que el factor viejo ya no existe.
6. El usuario enrola un TOTP nuevo con un dispositivo/app que sí controla.

## 4. Alternativa vía API/SQL (si el dashboard no lo permite directamente)

Supabase Auth guarda los factores MFA en el schema `auth`, en una tabla
relacionada con factores TOTP por usuario (referenciada habitualmente como
`auth.mfa_factors` en la documentación de Supabase). En teoría sería posible
borrar la fila del factor perdido directamente por SQL, o llamar al
[Admin API de Supabase Auth](https://supabase.com/docs/reference/javascript/auth-admin-mfa-listfactors)
con la `service_role` key para listar y borrar factores de un usuario
específico (`supabase.auth.admin.mfa.deleteFactor(...)` o equivalente).

> **No se verificó la sintaxis SQL exacta ni el nombre exacto del método del
> Admin API en esta sesión** — no inventar un `DELETE FROM auth.mfa_factors
> WHERE ...` ni un nombre de método sin confirmarlo contra la documentación
> oficial de Supabase Auth Admin API en el momento del incidente. Usar esta
> vía solo si la opción del dashboard (sección 3) no está disponible, y
> confirmar el nombre de tabla/método contra `mcp__supabase__search_docs` o
> la documentación oficial antes de ejecutar nada contra producción.
>
> Si se opta por SQL directo sobre `auth.*`, recordar la regla de este
> proyecto (`CLAUDE.md`): nunca exponer secretos/tokens en output de
> sesión, y correr `mcp__supabase__get_advisors(type="security")` después
> de cualquier cambio manual sobre el schema `auth`.

## 5. Recomendación preventiva

**Cada clínica debe tener al menos 2 usuarios con rol `admin` activo**, no
solo 1. Aunque hoy ningún admin puede resetear el MFA de otro admin dentro
de la app (ver sección 2), tener un segundo admin reduce el impacto de
otros escenarios de bloqueo (cuenta suspendida, olvido de password con
problemas de recuperación de email, etc.) y dejaría la puerta abierta a un
futuro flujo de "admin ayuda a admin" si se decide construirlo.

**Nota importante**: aunque se implemente esa recomendación, **hoy** —
sin ningún cambio adicional a este runbook — el primer setup de MFA de
cualquier clínica (o la recuperación de un lockout como el descrito acá)
de todas formas requiere al dueño del proyecto con acceso al Supabase
Dashboard. Tener 2 admins no elimina la dependencia del dashboard para
este escenario específico de "perdí mi TOTP y no hay backup codes" — solo
la reduce para otros tipos de bloqueo que si podrían resolverse app-a-app
en el futuro.

## Follow-up sugerido (fuera de alcance de este runbook)

- Agregar backup codes al enrolamiento de MFA (Supabase Auth los soporta
  para TOTP) para que el usuario pueda auto-recuperarse sin depender del
  dashboard.
- Agregar un flujo "perdí mi dispositivo" en `MfaEnrollmentGate.tsx` que
  dirija al usuario a contactar al dueño del proyecto, en vez de dejarlo
  atascado en un botón sin salida.
- Evaluar si un admin puede tener permiso limitado para resetear MFA de
  otro usuario (requeriría una función `SECURITY DEFINER` nueva — de ser
  así, seguir el checklist obligatorio de `CLAUDE.md` para funciones
  `SECURITY DEFINER`: `search_path`, `REVOKE`/`GRANT` explícito, check de
  membership antes de cualquier operación).
