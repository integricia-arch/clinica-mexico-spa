# Supervisor PIN Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unsecured "Autorizar y cerrar turno" button with a proper PIN-verified supervisor authorization dialog, ensuring every admin/manager has a PIN from the moment of creation.

**Architecture:** New SQL migration adds `supervisor_pin_hash` to `profiles`, plus 3 RPCs (`set_supervisor_pin`, `turno_close_with_pin`, `get_clinic_supervisors`). A single reusable `SupervisorAuthDialog` component replaces the inline `overridePrompt` blocks in all 3 files. `AdminUsuarios.tsx` gains PIN fields and enforces PIN on admin/manager creation.

**Tech Stack:** React 18 + TypeScript, shadcn/ui, Supabase (pgcrypto bcrypt), Supabase RPC

---

## File Map

| File | Action |
|------|--------|
| `supabase/migrations/_tmp_supervisor_pin.sql` | New — migration file |
| `src/components/turno/SupervisorAuthDialog.tsx` | New — shared auth dialog |
| `src/features/farmacia/ShiftPanel.tsx` | Modify — replace overridePrompt block |
| `src/pages/CajaTurno.tsx` | Modify — replace overridePrompt block |
| `src/components/turno/TurnoCloseWizard.tsx` | Modify — replace overridePrompt block |
| `src/pages/AdminUsuarios.tsx` | Modify — add manager role + PIN fields |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/_tmp_supervisor_pin.sql`

- [ ] **Step 1: Write migration file**

```sql
-- 1. Columna en profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS supervisor_pin_hash text;

-- 2. RPC set_supervisor_pin
CREATE OR REPLACE FUNCTION public.set_supervisor_pin(
  p_user_id uuid,
  p_pin     text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $func$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
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

-- 3. RPC get_clinic_supervisors
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

-- 4. RPC turno_close_with_pin (verifica PIN y delega)
CREATE OR REPLACE FUNCTION public.turno_close_with_pin(
  p_turno_id      uuid,
  p_supervisor_id uuid,
  p_pin           text,
  p_cash_count    numeric,
  p_notes         text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $func$
DECLARE
  v_hash text;
BEGIN
  SELECT supervisor_pin_hash INTO v_hash
    FROM public.profiles WHERE id = p_supervisor_id;

  IF v_hash IS NULL THEN
    RAISE EXCEPTION 'PIN_NOT_CONFIGURED';
  END IF;

  IF crypt(p_pin, v_hash) <> v_hash THEN
    RAISE EXCEPTION 'PIN_INCORRECT';
  END IF;

  IF NOT (has_role(p_supervisor_id, 'admin'::app_role)
          OR has_role(p_supervisor_id, 'manager'::app_role)) THEN
    RAISE EXCEPTION 'Supervisor sin rol admin/manager';
  END IF;

  RETURN public.turno_close(p_turno_id, p_cash_count, p_notes, true);
END;
$func$;

-- 5. Grant execute
GRANT EXECUTE ON FUNCTION public.set_supervisor_pin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_clinic_supervisors(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.turno_close_with_pin(uuid, uuid, text, numeric, text) TO authenticated;
```

- [ ] **Step 2: Check profiles table has rows (verify extension available)**

```powershell
supabase db query --linked "SELECT id FROM public.profiles LIMIT 1"
```

Expected: returns 0 or more rows without error.

- [ ] **Step 3: Apply migration**

```powershell
supabase db query --linked --file supabase/migrations/_tmp_supervisor_pin.sql
```

Expected: no error output.

- [ ] **Step 4: Verify RPCs exist**

```powershell
supabase db query --linked "SELECT proname FROM pg_proc WHERE proname IN ('set_supervisor_pin','get_clinic_supervisors','turno_close_with_pin')"
```

Expected: 3 rows returned.

- [ ] **Step 5: Commit**

```
git add supabase/migrations/_tmp_supervisor_pin.sql
git commit -m "feat: add supervisor_pin_hash + RPCs set_supervisor_pin, get_clinic_supervisors, turno_close_with_pin"
```

---

## Task 2: SupervisorAuthDialog Component

**Files:**
- Create: `src/components/turno/SupervisorAuthDialog.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface Supervisor {
  user_id: string;
  email: string;
  full_name: string;
  has_pin: boolean;
}

interface Props {
  open: boolean;
  turnoId: string;
  cashCount: number;
  notes: string;
  diff: number;
  umbral: number;
  clinicId: string;
  /** "turno" = calls turno_close_with_pin; "pharmacy" = same (turno_close_with_pin handles both) */
  mode?: "turno" | "pharmacy";
  onSuccess: (result: unknown) => void;
  onCancel: () => void;
}

const fmt = (n: number) =>
  Number(n).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function SupervisorAuthDialog({
  open, turnoId, cashCount, notes, diff, umbral, clinicId,
  onSuccess, onCancel,
}: Props) {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !clinicId) return;
    setSupervisors([]);
    setSelectedId("");
    setPin("");
    setPassword("");
    setError(null);

    supabase
      .rpc("get_clinic_supervisors", { p_clinic_id: clinicId })
      .then(({ data, error: e }) => {
        if (e) { setError("No se pudieron cargar los supervisores"); return; }
        setSupervisors((data ?? []) as Supervisor[]);
      });
  }, [open, clinicId]);

  const selected = supervisors.find((s) => s.user_id === selectedId) ?? null;

  async function handleSubmit() {
    if (!selected) { setError("Selecciona un supervisor"); return; }
    setError(null);
    setSubmitting(true);

    if (selected.has_pin) {
      if (!pin || !/^\d{4,6}$/.test(pin)) {
        setError("PIN debe ser 4-6 dígitos numéricos");
        setSubmitting(false);
        return;
      }
      const { data, error: e } = await supabase.rpc("turno_close_with_pin", {
        p_turno_id: turnoId,
        p_supervisor_id: selected.user_id,
        p_pin: pin,
        p_cash_count: cashCount,
        p_notes: notes || null,
      } as never);
      setSubmitting(false);
      if (e) {
        if (e.message?.includes("PIN_INCORRECT")) setError("PIN incorrecto");
        else if (e.message?.includes("PIN_NOT_CONFIGURED")) setError("PIN no configurado. Usa contraseña.");
        else setError(e.message);
        return;
      }
      toast.success("Turno cerrado con autorización de supervisor");
      onSuccess(data);
    } else {
      // Fallback: verificar contraseña del supervisor en el cliente
      if (!password) { setError("Ingresa la contraseña del supervisor"); setSubmitting(false); return; }
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: selected.email,
        password,
      });
      if (authErr) {
        setError("Contraseña incorrecta");
        setSubmitting(false);
        return;
      }
      // Contraseña correcta — cerrar con override
      const { data, error: closeErr } = await supabase.rpc("turno_close", {
        p_turno_id: turnoId,
        p_cash_count: cashCount,
        p_notes: notes || null,
        p_supervisor_override: true,
      } as never);
      setSubmitting(false);
      if (closeErr) { setError(closeErr.message); return; }
      toast.success("Turno cerrado con autorización de supervisor");
      onSuccess(data);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            Autorización de supervisor requerida
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/8 p-3 text-sm space-y-1">
            <p className="font-medium text-amber-700">
              Diferencia {fmt(diff)} excede umbral {fmt(umbral)}
            </p>
            <p className="text-xs text-muted-foreground">
              Se requiere autorización de un supervisor para cerrar el turno.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Supervisor</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un supervisor…" />
              </SelectTrigger>
              <SelectContent>
                {supervisors.map((s) => (
                  <SelectItem key={s.user_id} value={s.user_id}>
                    <span className="flex items-center gap-2">
                      {s.full_name}
                      {!s.has_pin && (
                        <span className="text-xs text-amber-600">(sin PIN)</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
                {supervisors.length === 0 && (
                  <SelectItem value="__none__" disabled>
                    No hay supervisores configurados
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {selected?.has_pin && (
            <div className="space-y-1.5">
              <Label htmlFor="sup-pin">PIN de autorización</Label>
              <Input
                id="sup-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="4-6 dígitos"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
            </div>
          )}

          {selected && !selected.has_pin && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertCircle className="h-3.5 w-3.5" />
                Este supervisor no tiene PIN configurado. Ingresa su contraseña de sesión.
              </div>
              <Label htmlFor="sup-pw">Contraseña del supervisor</Label>
              <Input
                id="sup-pw"
                type="password"
                placeholder="Contraseña de acceso"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !selectedId}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {submitting ? "Verificando…" : "Autorizar y cerrar turno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```
git add src/components/turno/SupervisorAuthDialog.tsx
git commit -m "feat: add SupervisorAuthDialog component for PIN-verified supervisor authorization"
```

---

## Task 3: Wire SupervisorAuthDialog into TurnoCloseWizard

**Files:**
- Modify: `src/components/turno/TurnoCloseWizard.tsx`

Context: The wizard has step `"diff-alert"` where `overrideData` holds `{ diff, umbral }`. Currently it shows an inline banner and calls `submit(true)` directly if `isManager`. Replace with `SupervisorAuthDialog`.

- [ ] **Step 1: Add import at top of file (after existing imports)**

Add after the last import line:
```tsx
import SupervisorAuthDialog from "@/components/turno/SupervisorAuthDialog";
```

Also add `useActiveClinic` import if not present:
```tsx
import { useActiveClinic } from "@/hooks/useActiveClinic";
```

- [ ] **Step 2: Add `activeClinicId` to component body**

In `TurnoCloseWizard`, add after the `const { roles } = useAuth();` line:
```tsx
const { activeClinicId } = useActiveClinic();
```

- [ ] **Step 3: Replace the `{step === "diff-alert" && overrideData && (...)}` block**

Locate the block (lines ~154–200) that renders when `step === "diff-alert"`. Replace:
```tsx
{step === "diff-alert" && overrideData && (
  <>
    <div>
      <h2 className="flex items-center gap-2 text-lg font-semibold text-amber-700">
        <AlertTriangle className="h-5 w-5" /> Diferencia fuera de rango
      </h2>
    </div>
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/8 p-4 space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Diferencia</span>
        <span className={`font-semibold ${overrideData.diff > 0 ? "text-amber-700" : "text-red-700"}`}>
          {fmt(overrideData.diff)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Umbral permitido</span>
        <span className="font-medium">{fmt(overrideData.umbral)}</span>
      </div>
    </div>
    {isManager ? (
      <>
        <p className="text-sm text-muted-foreground">
          Como supervisor puedes autorizar el cierre con esta diferencia.
        </p>
        <Button
          onClick={() => submit(true)}
          variant="destructive"
          className="w-full"
          size="lg"
          disabled={saving}
        >
          {saving ? "Autorizando…" : "Autorizar y cerrar turno"}
        </Button>
      </>
    ) : (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        Se requiere autorización de un supervisor. Solicita a un admin o gerente que autorice el cierre.
      </div>
    )}
    <button
      onClick={() => setStep("count")}
      className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
    >
      ← Volver a recontar
    </button>
  </>
)}
```

With:
```tsx
{step === "diff-alert" && overrideData && (
  <>
    <div>
      <h2 className="flex items-center gap-2 text-lg font-semibold text-amber-700">
        <AlertTriangle className="h-5 w-5" /> Diferencia fuera de rango
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        Se requiere autorización de un supervisor para continuar.
      </p>
    </div>
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/8 p-4 space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Diferencia</span>
        <span className={`font-semibold ${overrideData.diff > 0 ? "text-amber-700" : "text-red-700"}`}>
          {fmt(overrideData.diff)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Umbral permitido</span>
        <span className="font-medium">{fmt(overrideData.umbral)}</span>
      </div>
    </div>
    <SupervisorAuthDialog
      open={step === "diff-alert" && !!overrideData}
      turnoId={turno.id}
      cashCount={Number(count)}
      notes={notes}
      diff={overrideData.diff}
      umbral={overrideData.umbral}
      clinicId={activeClinicId ?? ""}
      onSuccess={(data) => {
        setResult(data as CloseResult);
        setStep("done");
      }}
      onCancel={() => setStep("count")}
    />
    <button
      onClick={() => setStep("count")}
      className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
    >
      ← Volver a recontar
    </button>
  </>
)}
```

- [ ] **Step 4: Remove unused imports** (`isManager` const may be unused now — check and remove if TypeScript complains)

- [ ] **Step 5: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```
git add src/components/turno/TurnoCloseWizard.tsx
git commit -m "feat: replace inline override button with SupervisorAuthDialog in TurnoCloseWizard"
```

---

## Task 4: Wire SupervisorAuthDialog into CajaTurno

**Files:**
- Modify: `src/pages/CajaTurno.tsx`

Context: `CloseDialog` component (defined inside CajaTurno.tsx around line 120) has `overridePrompt` state and renders an inline amber block. Replace that block with `SupervisorAuthDialog`. The `clinicId` can come from the `turno.clinic_id` prop or from `useActiveClinic`.

- [ ] **Step 1: Add imports at top of CajaTurno.tsx**

```tsx
import SupervisorAuthDialog from "@/components/turno/SupervisorAuthDialog";
```

`useActiveClinic` is already imported in the file — confirm and skip if already present.

- [ ] **Step 2: Locate and replace the overridePrompt rendering block in `CloseDialog`**

Find the block starting at `{overridePrompt && (` (around line 237). Replace:
```tsx
{overridePrompt && (
  <div className="rounded-lg border border-amber-500/40 bg-amber-500/8 p-3 space-y-2">
    <p className="text-sm font-medium text-amber-700">
      Diferencia de {fmt(overridePrompt.diff)} excede el umbral de {fmt(overridePrompt.umbral)}.
    </p>
    <p className="text-xs text-muted-foreground">
      {isManager
        ? "Como admin/gerente puedes autorizar el cierre con esta diferencia."
        : "Se requiere autorización de un admin o gerente para continuar."}
    </p>
    {isManager && (
      <Button
        variant="outline"
        size="sm"
        className="w-full border-amber-500 text-amber-700 hover:bg-amber-500/10"
        onClick={() => submit(true)}
        disabled={submitting}
      >
        Autorizar y cerrar turno
      </Button>
    )}
  </div>
)}
```

With:
```tsx
<SupervisorAuthDialog
  open={!!overridePrompt}
  turnoId={turno?.id ?? ""}
  cashCount={Number(count)}
  notes={notes}
  diff={overridePrompt?.diff ?? 0}
  umbral={overridePrompt?.umbral ?? 0}
  clinicId={turno?.clinic_id ?? activeClinicId ?? ""}
  onSuccess={(data) => {
    setResult(data as CloseResult);
    setOverridePrompt(null);
  }}
  onCancel={() => setOverridePrompt(null)}
/>
```

Note: `turno` and `activeClinicId` must be in scope. If `turno.clinic_id` doesn't exist on the `Turno` interface, add `clinic_id: string` to it.

- [ ] **Step 3: Add `clinic_id` to the `Turno` interface if needed**

```tsx
interface Turno {
  id: string;
  caja_id: string;
  clinic_id: string;   // add this
  estado: string;
  monto_apertura: number;
  abierto_at: string;
  pharmacy_shift_id: string | null;
}
```

And update the `fetchTurno` query to include `clinic_id` in the select:
```tsx
.select("id, caja_id, clinic_id, estado, monto_apertura, abierto_at, pharmacy_shift_id")
```

- [ ] **Step 4: Add `activeClinicId` if not already destructured**

After finding where `useActiveClinic` is called in `CloseDialog` or its parent, ensure `activeClinicId` is available as a fallback.

- [ ] **Step 5: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```
git add src/pages/CajaTurno.tsx
git commit -m "feat: replace inline override block with SupervisorAuthDialog in CajaTurno"
```

---

## Task 5: Wire SupervisorAuthDialog into ShiftPanel

**Files:**
- Modify: `src/features/farmacia/ShiftPanel.tsx`

Context: `ShiftPanel` has `overridePrompt` state (line ~151) and renders an inline block around line 283. The `clinicId` can come from the `Shift.clinic_id` prop.

- [ ] **Step 1: Add import**

```tsx
import SupervisorAuthDialog from "@/components/turno/SupervisorAuthDialog";
```

- [ ] **Step 2: Locate and replace the `{overridePrompt && (...)}` block**

Find (around line 283):
```tsx
{overridePrompt && (
  <div className="rounded-lg border border-amber-500/40 bg-amber-500/8 p-3 space-y-2">
    <p className="text-sm font-medium text-amber-700">
      Diferencia de {formatMXN(overridePrompt.diff)} excede el umbral de {formatMXN(overridePrompt.umbral)}.
    </p>
    <p className="text-xs text-muted-foreground">
      {isManager
        ? "Como admin/gerente puedes autorizar el cierre con esta diferencia."
        : "Se requiere autorización de un admin o gerente para continuar."}
    </p>
    {isManager && (
      <Button
        variant="outline"
        size="sm"
        className="w-full border-amber-500 text-amber-700 hover:bg-amber-500/10"
        onClick={() => submit(true)}
        disabled={submitting}
      >
        Autorizar y cerrar turno
      </Button>
    )}
  </div>
)}
```

Replace with:
```tsx
<SupervisorAuthDialog
  open={!!overridePrompt}
  turnoId={shift?.id ?? ""}
  cashCount={Number(count)}
  notes={notes}
  diff={overridePrompt?.diff ?? 0}
  umbral={overridePrompt?.umbral ?? 0}
  clinicId={shift?.clinic_id ?? ""}
  mode="pharmacy"
  onSuccess={(data) => {
    setResult(data as CloseResult);
    setOverridePrompt(null);
  }}
  onCancel={() => setOverridePrompt(null)}
/>
```

Note: Check what `shift` prop name is in ShiftPanel — the main shift object must have `clinic_id`. The `Shift` interface at the top of the file has `clinic_id: string` already (it's in the type definition read earlier).

- [ ] **Step 3: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```
git add src/features/farmacia/ShiftPanel.tsx
git commit -m "feat: replace inline override block with SupervisorAuthDialog in ShiftPanel"
```

---

## Task 6: Add Manager Role + PIN Fields to AdminUsuarios

**Files:**
- Modify: `src/pages/AdminUsuarios.tsx`

Context: `AppRole` type and `ROLE_OPTIONS` don't include `"manager"`. The create dialog needs PIN fields for admin/manager. The user list needs a "Set PIN" button for those roles.

- [ ] **Step 1: Add `manager` to AppRole and related maps (lines ~22-40)**

```tsx
type AppRole = "admin" | "manager" | "receptionist" | "doctor" | "nurse" | "patient";

const ROLE_OPTIONS: AppRole[] = ["admin", "manager", "receptionist", "doctor", "nurse", "patient"];

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  manager: "Gerente",
  receptionist: "Recepción",
  doctor: "Médico",
  nurse: "Enfermería",
  patient: "Paciente",
};

const ROLE_BADGE: Record<AppRole, string> = {
  admin: "bg-primary text-primary-foreground",
  manager: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  receptionist: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  doctor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  nurse: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  patient: "bg-muted text-muted-foreground",
};
```

- [ ] **Step 2: Add PIN state variables after existing create-dialog state (around line 80)**

```tsx
const [createPin, setCreatePin] = useState("");
const [createPinConfirm, setCreatePinConfirm] = useState("");

// State for "Set PIN" dialog on existing users
const [pinUser, setPinUser] = useState<UsuarioRow | null>(null);
const [pinValue, setPinValue] = useState("");
const [pinConfirm, setPinConfirm] = useState("");
const [savingPin, setSavingPin] = useState(false);
```

- [ ] **Step 3: Update `handleCreate` to call `set_supervisor_pin` after creation**

In `handleCreate` (around line 220), after the user creation succeeds and before `fetchUsers()`:

```tsx
const handleCreate = async () => {
  if (!createEmail || !createPassword) {
    toast.error("Correo y contraseña requeridos"); return;
  }
  if (createPassword.length < 12) {
    toast.error("La contraseña debe tener al menos 12 caracteres"); return;
  }
  if (["admin", "manager"].includes(createRole)) {
    if (!createPin || !/^\d{4,6}$/.test(createPin)) {
      toast.error("PIN de autorización requerido (4-6 dígitos) para este rol");
      return;
    }
    if (createPin !== createPinConfirm) {
      toast.error("Los PINs no coinciden");
      return;
    }
  }
  setCreating(true);
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action: "create", email: createEmail, password: createPassword, roles: [createRole] },
  });
  if (error || (data as any)?.error) {
    setCreating(false);
    toast.error((data as any)?.error || "No se pudo crear el usuario");
    return;
  }
  // Set PIN if admin/manager
  if (["admin", "manager"].includes(createRole) && createPin) {
    const newUserId = (data as any)?.user?.id;
    if (newUserId) {
      const { error: pinErr } = await supabase.rpc("set_supervisor_pin", {
        p_user_id: newUserId,
        p_pin: createPin,
      } as never);
      if (pinErr) toast.warning(`Usuario creado pero PIN no se pudo guardar: ${pinErr.message}`);
    }
  }
  setCreating(false);
  toast.success("Usuario creado");
  setCreateOpen(false);
  setCreateEmail(""); setCreatePassword(""); setCreateRole("patient");
  setCreatePin(""); setCreatePinConfirm("");
  fetchUsers();
};
```

- [ ] **Step 4: Add PIN fields to the create dialog JSX**

Inside the create dialog (around line 933), after the password field and before the footer, add:
```tsx
{["admin", "manager"].includes(createRole) && (
  <>
    <div className="space-y-1.5">
      <Label htmlFor="create-pin">
        PIN de autorización <span className="text-destructive">*</span>
      </Label>
      <p className="text-xs text-muted-foreground">
        Requerido para admin/gerente. Se usará para autorizar cierres con diferencia.
      </p>
      <Input
        id="create-pin"
        type="password"
        inputMode="numeric"
        maxLength={6}
        placeholder="4-6 dígitos"
        value={createPin}
        onChange={(e) => setCreatePin(e.target.value.replace(/\D/g, ""))}
      />
    </div>
    <div className="space-y-1.5">
      <Label htmlFor="create-pin-confirm">Confirmar PIN</Label>
      <Input
        id="create-pin-confirm"
        type="password"
        inputMode="numeric"
        maxLength={6}
        placeholder="Repite el PIN"
        value={createPinConfirm}
        onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
      />
    </div>
  </>
)}
```

- [ ] **Step 5: Add "Sin PIN" badge and "Set PIN" button in user list**

In the user row rendering (around line 647 where roles are shown), after the roles badges, add:

```tsx
{(u.roles.includes("admin") || u.roles.includes("manager")) && (
  <button
    onClick={() => { setPinUser(u); setPinValue(""); setPinConfirm(""); }}
    className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 underline"
  >
    <KeyRound className="h-3 w-3" /> PIN
  </button>
)}
```

- [ ] **Step 6: Add the "Set PIN" dialog (before the closing `</div>` of the component)**

```tsx
{/* Set PIN dialog */}
<Dialog open={!!pinUser} onOpenChange={(v) => !v && setPinUser(null)}>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <KeyRound className="h-4 w-4" /> PIN de autorización
      </DialogTitle>
      <DialogDescription>
        Configura el PIN para <strong>{pinUser?.email}</strong>.
        Déjalo vacío para conservar el PIN actual.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-3 py-1">
      <div className="space-y-1.5">
        <Label htmlFor="set-pin">Nuevo PIN (4-6 dígitos)</Label>
        <Input
          id="set-pin"
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="4-6 dígitos numéricos"
          value={pinValue}
          onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="set-pin-confirm">Confirmar PIN</Label>
        <Input
          id="set-pin-confirm"
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="Repite el PIN"
          value={pinConfirm}
          onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
        />
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setPinUser(null)}>Cancelar</Button>
      <Button
        disabled={savingPin}
        onClick={async () => {
          if (!pinUser) return;
          if (!pinValue) { toast.error("Ingresa un PIN"); return; }
          if (!/^\d{4,6}$/.test(pinValue)) { toast.error("PIN debe ser 4-6 dígitos"); return; }
          if (pinValue !== pinConfirm) { toast.error("Los PINs no coinciden"); return; }
          setSavingPin(true);
          const { error } = await supabase.rpc("set_supervisor_pin", {
            p_user_id: pinUser.id,
            p_pin: pinValue,
          } as never);
          setSavingPin(false);
          if (error) { toast.error(error.message || "No se pudo guardar el PIN"); return; }
          toast.success("PIN actualizado");
          setPinUser(null);
        }}
      >
        {savingPin ? "Guardando…" : "Guardar PIN"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 7: Add `DialogDescription` to imports if not present**

Check the Dialog imports at line ~9:
```tsx
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
```

- [ ] **Step 8: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```
git add src/pages/AdminUsuarios.tsx
git commit -m "feat: add manager role, PIN enforcement on create, and Set PIN dialog in AdminUsuarios"
```

---

## Task 7: Build & Smoke Test

- [ ] **Step 1: Full build**

```powershell
npm run build
```

Expected: builds without TypeScript or Vite errors.

- [ ] **Step 2: Manual test — happy path (PIN flow)**
  1. Log in as admin
  2. Open Ajustes → Usuarios → create a new `manager` user → verify PIN fields appear → fill valid PIN → create
  3. Log in as cajero with an open turno
  4. Close the turno with a cash amount that triggers `DIFF_EXCEEDS_THRESHOLD`
  5. Verify `SupervisorAuthDialog` opens (not the old inline block)
  6. Select the manager → enter PIN → click Autorizar
  7. Verify turno closes and Corte Z appears

- [ ] **Step 3: Manual test — wrong PIN**
  1. Repeat steps 3–6 but enter wrong PIN
  2. Verify error message "PIN incorrecto" appears
  3. Verify turno does NOT close

- [ ] **Step 4: Manual test — admin without PIN (fallback)**
  1. Find an existing admin user without PIN (badge visible in list)
  2. Trigger DIFF_EXCEEDS_THRESHOLD
  3. Select the no-PIN admin → password input appears
  4. Enter correct password → turno closes
  5. Enter wrong password → error "Contraseña incorrecta"

- [ ] **Step 5: Manual test — create admin without PIN (enforced)**
  1. Ajustes → Usuarios → new user → select role "admin"
  2. Leave PIN empty → click Create
  3. Verify toast error "PIN de autorización requerido"

- [ ] **Step 6: Final commit (if any fixups)**

```
git add -p
git commit -m "fix: address smoke test issues in supervisor PIN flow"
```

---

## Checklist (spec coverage)

- [x] Cajero ve banner ámbar al exceder umbral — existing, unchanged
- [x] Dropdown muestra solo admins/managers de la clínica → `get_clinic_supervisors`
- [x] Supervisor con PIN: input numérico 4-6 dígitos → Task 2
- [x] Supervisor sin PIN: input de contraseña con aviso → Task 2
- [x] PIN incorrecto: mensaje de error, turno no se cierra → Task 2 `PIN_INCORRECT` handler
- [x] Contraseña incorrecta: mensaje de error → Task 2 fallback
- [x] Al autorizar: turno cierra, resultado muestra folio Z → Task 2 `onSuccess`
- [x] Crear admin/manager sin PIN: formulario no permite guardar → Task 6 Step 3
- [x] Ajustes → Usuarios: botón Set PIN para admin/manager → Task 6 Step 5
- [x] Build TypeScript sin errores → Task 7
- [ ] `autorizado_by` correcto (supervisor, no cajero) — future: requires `turno_close` RPC change, out of scope for this plan
