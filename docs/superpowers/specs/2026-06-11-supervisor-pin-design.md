# Firma Supervisor con PIN — Diseño

**Fecha:** 2026-06-11
**Proyecto:** clinica-mexico-spa
**Módulo:** Caja / Corte de turno

---

## Contexto

Cuando el cajero cierra un turno con diferencia (`|contado - esperado| > umbral_diferencia`), la RPC `turno_close` lanza `DIFF_EXCEEDS_THRESHOLD|{diff}|{umbral}`. El frontend ya muestra un banner ámbar y permite que el usuario activo (si es admin/manager) haga click en "Autorizar y cerrar" sin ninguna verificación de identidad. Este diseño agrega un PIN numérico de autorización por supervisor, con fallback a contraseña Supabase Auth si el supervisor no tiene PIN configurado.

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|---|---|---|
| Granularidad del PIN | Por usuario (admin/manager) | Trazabilidad individual; si el PIN se compromete solo afecta un supervisor |
| Quién configura el PIN | Admin en Ajustes → Usuarios | El supervisor no auto-gestiona; el admin controla accesos |
| Almacenamiento | `profiles.supervisor_pin_hash` (pgcrypto bcrypt) | PIN nunca sale del backend como texto plano |
| Verificación | RPC `turno_close_with_pin` — atómica | Un roundtrip; si PIN falla, turno no se cierra |
| Fallback sin PIN | `supabase.auth.signInWithPassword` en cliente | Viable desde frontend; Supabase Auth maneja el rate-limiting |
| Enforcement en creación | PIN obligatorio para rol admin/manager | Elimina el edge case desde la raíz |
| Usuarios legacy sin PIN | Badge de advertencia, no bloqueo inmediato | Migración suave; se bloquea al intentar autorizar cierre |
| Reutilización | `SupervisorAuthDialog` componente único | Mismo patrón en `ShiftPanel.tsx`, `CajaTurno.tsx`, `TurnoCloseWizard.tsx` |

---

## Sección 1: Base de datos

### 1.1 Columna `supervisor_pin_hash`

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS supervisor_pin_hash text;
```

`NULL` = supervisor sin PIN configurado (fallback a contraseña).

### 1.2 RPC `set_supervisor_pin`

```sql
CREATE OR REPLACE FUNCTION public.set_supervisor_pin(
  p_user_id uuid,
  p_pin text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $func$
BEGIN
  -- Solo admin puede setear PIN de otro usuario
  IF NOT (has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Solo administradores pueden configurar PINs';
  END IF;

  IF p_pin !~ '^\d{4,6}$' THEN
    RAISE EXCEPTION 'PIN_INVALID: debe ser 4-6 dígitos numéricos';
  END IF;

  UPDATE public.profiles
     SET supervisor_pin_hash = crypt(p_pin, gen_salt('bf'))
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;
END;
$func$;
```

### 1.3 RPC `turno_close_with_pin`

```sql
CREATE OR REPLACE FUNCTION public.turno_close_with_pin(
  p_turno_id         uuid,
  p_supervisor_id    uuid,
  p_pin              text,
  p_cash_count       numeric,
  p_notes            text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $func$
DECLARE
  v_hash text;
BEGIN
  -- Verificar PIN
  SELECT supervisor_pin_hash INTO v_hash
    FROM public.profiles
   WHERE id = p_supervisor_id;

  IF v_hash IS NULL THEN
    RAISE EXCEPTION 'PIN_NOT_CONFIGURED: supervisor no tiene PIN; usar autenticación de contraseña';
  END IF;

  IF crypt(p_pin, v_hash) <> v_hash THEN
    RAISE EXCEPTION 'PIN_INCORRECT';
  END IF;

  -- Verificar que supervisor sea admin o manager
  IF NOT (has_role(p_supervisor_id, 'admin') OR has_role(p_supervisor_id, 'manager')) THEN
    RAISE EXCEPTION 'El supervisor seleccionado no tiene rol admin o manager';
  END IF;

  -- Delegar al cierre real con override
  RETURN public.turno_close(p_turno_id, p_cash_count, p_notes, true);
END;
$func$;
```

> Mismo flujo aplica para `pharmacy_turno_close_with_pin` que delega a la RPC de pharmacy shifts.

### 1.4 RPC `get_clinic_supervisors`

```sql
CREATE OR REPLACE FUNCTION public.get_clinic_supervisors(
  p_clinic_id uuid
) RETURNS TABLE(user_id uuid, email text, full_name text, has_pin boolean)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cm.user_id,
    u.email,
    COALESCE(p.full_name, u.email) AS full_name,
    (p.supervisor_pin_hash IS NOT NULL) AS has_pin
  FROM public.clinic_members cm
  JOIN auth.users u ON u.id = cm.user_id
  LEFT JOIN public.profiles p ON p.id = cm.user_id
  WHERE cm.clinic_id = p_clinic_id
    AND cm.role IN ('admin', 'manager');
$$;
```

---

## Sección 2: Componente `SupervisorAuthDialog`

**Archivo:** `src/components/turno/SupervisorAuthDialog.tsx`

### Props

```typescript
interface SupervisorAuthDialogProps {
  open: boolean;
  turnoId: string;
  cashCount: number;
  notes: string;
  diff: number;
  umbral: number;
  clinicId: string;
  onSuccess: (result: CloseResult) => void;
  onCancel: () => void;
  // Determina si llamar turno_close o pharmacy_turno_close
  mode: "turno" | "pharmacy";
  shiftId?: string; // requerido cuando mode = "pharmacy"
}
```

### Estado interno

```typescript
const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
const [selectedId, setSelectedId] = useState<string>("");
const [pin, setPin] = useState("");
const [password, setPassword] = useState("");
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState<string | null>(null);
```

### Flujo de UI

1. Al abrir: carga `get_clinic_supervisors(clinicId)` → llena dropdown
2. Al seleccionar supervisor:
   - Si `has_pin = true` → muestra input "PIN de autorización" (numérico, max 6 dígitos)
   - Si `has_pin = false` → muestra input "Contraseña del supervisor" + aviso "Este supervisor no tiene PIN configurado"
3. Al confirmar:
   - Si `has_pin = true` → llama `turno_close_with_pin(turnoId, supervisorId, pin, cashCount, notes)`
   - Si `has_pin = false` → llama `supabase.auth.signInWithPassword({email: supervisor.email, password})`, si OK llama `turno_close(turnoId, cashCount, notes, true)`
4. Errores mapeados:
   - `PIN_INCORRECT` → "PIN incorrecto"
   - `PIN_INVALID` → "PIN debe ser 4-6 dígitos"
   - `Invalid login credentials` → "Contraseña incorrecta"

### Integración en los 3 archivos existentes

Reemplazar el bloque `{overridePrompt && (...)}` en cada archivo por:

```tsx
<SupervisorAuthDialog
  open={!!overridePrompt}
  turnoId={turno.id}
  cashCount={amount}
  notes={notes}
  diff={overridePrompt?.diff ?? 0}
  umbral={overridePrompt?.umbral ?? 0}
  clinicId={activeClinicId}
  mode="turno"           // o "pharmacy" en ShiftPanel
  onSuccess={(result) => { setResult(result); setOverridePrompt(null); }}
  onCancel={() => setOverridePrompt(null)}
/>
```

---

## Sección 3: Ajustes → Usuarios — configurar PIN

### En el formulario de crear/editar usuario

Cuando `role === "admin" || role === "manager"`:

```
[Campo] PIN de autorización  ●●●● (type="password", inputmode="numeric", maxLength=6)
[Campo] Confirmar PIN        ●●●●
```

Validaciones:
- Requerido al crear usuario admin/manager
- Solo dígitos `[0-9]`, longitud 4-6
- Los dos campos deben coincidir
- Al guardar: llama `set_supervisor_pin(userId, pin)` antes de salir

Al editar usuario existente:
- Campos vacíos = no cambia el PIN
- Ingresar nuevo valor = actualiza
- Si usuario no tiene PIN: badge `⚠ Sin PIN` en la lista de usuarios

### Badge en lista de usuarios

```tsx
{!user.has_pin && (user.role === "admin" || user.role === "manager") && (
  <Badge variant="outline" className="border-amber-400 text-amber-600 text-xs gap-1">
    <AlertCircle className="h-3 w-3" /> Sin PIN
  </Badge>
)}
```

---

## Sección 4: Enforcement en creación

El formulario de nuevo usuario en `SectionUsuarios` valida:

```typescript
if (["admin", "manager"].includes(role) && !pin) {
  setError("PIN de autorización requerido para este rol");
  return;
}
```

Esto garantiza que ningún admin/manager nuevo quede sin PIN desde el momento de su creación.

---

## Archivos afectados

| Archivo | Acción |
|---|---|
| `supabase/migrations/YYYYMMDD_supervisor_pin.sql` | Nuevo — columna + 3 RPCs |
| `src/components/turno/SupervisorAuthDialog.tsx` | Nuevo |
| `src/features/farmacia/ShiftPanel.tsx` | Modificar — reemplazar `overridePrompt` block |
| `src/pages/CajaTurno.tsx` | Modificar — reemplazar `overridePrompt` block |
| `src/components/turno/TurnoCloseWizard.tsx` | Modificar — reemplazar `overridePrompt` block |
| `src/pages/ajustes/sections/admin.tsx` | Modificar — PIN field en crear/editar usuario |
| `src/integrations/supabase/types.ts` | Actualizar tipos generados |

---

## Nota: auditoría de autorización

`turno_close` registra `autorizado_by = auth.uid()` (el cajero activo), no el supervisor que autorizó. Para trazabilidad correcta, la migración también debe extender `turno_close` para aceptar `p_authorized_by uuid DEFAULT NULL` y usar ese valor en el INSERT a `cortes`. `turno_close_with_pin` pasa `p_supervisor_id` como `p_authorized_by`. Incluir en el plan de implementación como sub-paso de la migración.

---

## Criterios de éxito

- [ ] Cajero ve banner ámbar al exceder umbral
- [ ] Dropdown muestra solo admins/managers de la clínica
- [ ] Supervisor con PIN: input numérico de 4-6 dígitos
- [ ] Supervisor sin PIN: input de contraseña con aviso
- [ ] PIN incorrecto: mensaje de error, turno no se cierra
- [ ] Contraseña incorrecta: mensaje de error, turno no se cierra
- [ ] Al autorizar: turno cierra, resultado muestra "Autorizado por supervisor"
- [ ] Crear admin/manager sin PIN: formulario no permite guardar
- [ ] Admin existente sin PIN: badge ámbar en lista de usuarios
- [ ] Build TypeScript sin errores
