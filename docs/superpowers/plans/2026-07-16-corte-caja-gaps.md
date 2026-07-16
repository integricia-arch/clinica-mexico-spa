# Corte de Caja — Gaps Reales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los 6 gaps reales de corte de caja confirmados en `docs/superpowers/specs/2026-07-16-corte-caja-gaps-design.md`: autorización PIN en devoluciones, cash drop distinto de egreso, explicación obligatoria en diferencias, folio correlativo de apertura, límite de efectivo configurable, y conteo ciego para cajas generales (no-farmacia).

**Architecture:** Todo el negocio vive en RPCs Postgres `SECURITY DEFINER` (`SET search_path = public`) invocadas vía `supabase.rpc(...)` desde componentes React — patrón ya establecido en el repo (`turno_close`, `turno_fondo_movimiento`, `pharmacy_register_return`). Se extrae una RPC de verificación de PIN compartida (`verify_supervisor_pin`) para no duplicar la lógica que hoy vive inline en `turno_close_with_pin`. El wizard de apertura ciega (`TurnoOpenWizard.tsx`) se generaliza para cubrir también cajas no-farmacia, reemplazando el formulario no-ciego que hoy tiene `CajaTurno.tsx`.

**Tech Stack:** React + TypeScript + Vite, Supabase (Postgres RPCs + RLS), Vitest + Testing Library, shadcn/ui.

## Global Constraints

- Toda función `SECURITY DEFINER` nueva DEBE incluir `SET search_path = public`, `REVOKE EXECUTE ... FROM PUBLIC` + `GRANT EXECUTE ... TO authenticated` explícito (regla del proyecto, CLAUDE.md).
- Ninguna query de escritura contra Supabase sin haber confirmado `mcp__supabase__get_project_url` = `kyfkvdyxpvpiacyymldc` en la sesión.
- Migraciones nuevas van a `supabase/migrations/<timestamp>_<slug>.sql`, aplicadas con `supabase db push --linked` (nunca inline vía MCP `apply_migration` sin revisar antes — este repo tiene historial de drift Lovable/CLI, ver CLAUDE.md).
- `tsc --noEmit` limpio y `npm run test` (Vitest) en verde antes de cada commit de código.
- Nunca usar `CREATE POLICY IF NOT EXISTS` (no existe en Postgres) — usar `DROP POLICY IF EXISTS` + `CREATE POLICY`.
- Motivo/notas siempre `trim()` antes de validar vacío — patrón ya usado en `turno_fondo_movimiento`.

---

### Task 1: RPC compartida `verify_supervisor_pin` + componente `SupervisorPinDialog`

**Files:**
- Create: `supabase/migrations/20260716150000_verify_supervisor_pin.sql`
- Create: `src/components/turno/SupervisorPinDialog.tsx`
- Modify: (ninguno todavía — se conecta en Task 2)

**Interfaces:**
- Produces: RPC `public.verify_supervisor_pin(p_clinic_id uuid, p_supervisor_id uuid, p_pin text) RETURNS void` — `RAISE EXCEPTION 'PIN_NOT_CONFIGURED'` o `'PIN_INCORRECT'` en fallo, retorna sin error si el PIN es correcto y el usuario es supervisor (`admin`/`manager`) de esa clínica.
- Produces: componente `SupervisorPinDialog` con props `{ open: boolean; clinicId: string; title?: string; description?: string; onAuthorized: (supervisorId: string, pin: string) => void; onCancel: () => void }`. Entrega también el PIN (no solo el id) porque las RPCs de negocio (Task 2, 3, 4) vuelven a validar el PIN server-side dentro de su propia transacción — no basta con un round-trip de verificación separado.

- [ ] **Step 1: Escribir la migración de la RPC**

```sql
-- supabase/migrations/20260716150000_verify_supervisor_pin.sql
-- RPC compartida: valida PIN de supervisor sin ejecutar ninguna acción de negocio.
-- Extrae la lógica que hoy vive duplicada dentro de turno_close_with_pin /
-- pharmacy_close_shift_with_pin, para que devoluciones y cash drop la reusen.
CREATE OR REPLACE FUNCTION public.verify_supervisor_pin(
  p_clinic_id     uuid,
  p_supervisor_id uuid,
  p_pin           text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $func$
DECLARE
  v_hash text;
  v_is_supervisor boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.clinic_memberships
     WHERE clinic_id = p_clinic_id
       AND user_id = p_supervisor_id
       AND role IN ('admin', 'manager')
  ) INTO v_is_supervisor;

  IF NOT v_is_supervisor THEN
    RAISE EXCEPTION 'Supervisor sin rol admin/manager en esta clínica';
  END IF;

  SELECT supervisor_pin_hash INTO v_hash
    FROM public.profiles WHERE id = p_supervisor_id;

  IF v_hash IS NULL THEN
    RAISE EXCEPTION 'PIN_NOT_CONFIGURED';
  END IF;

  IF crypt(p_pin, v_hash) <> v_hash THEN
    RAISE EXCEPTION 'PIN_INCORRECT';
  END IF;
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.verify_supervisor_pin(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_supervisor_pin(uuid, uuid, text) TO authenticated;
```

- [ ] **Step 2: Aplicar la migración**

Run: `supabase db push --linked`
Expected: `Applying migration 20260716150000_verify_supervisor_pin.sql... done` sin errores.

- [ ] **Step 3: Verificación manual en SQL Editor (Supabase dashboard, proyecto `kyfkvdyxpvpiacyymldc`)**

```sql
-- Con un supervisor real (admin/manager) que ya tenga PIN configurado (set_supervisor_pin):
SELECT public.verify_supervisor_pin(
  '<clinic_id real>'::uuid,
  '<user_id del supervisor>'::uuid,
  '<PIN correcto>'
);
-- Expected: sin error, retorna void.

SELECT public.verify_supervisor_pin(
  '<clinic_id real>'::uuid,
  '<user_id del supervisor>'::uuid,
  '000000'
);
-- Expected: ERROR: PIN_INCORRECT (salvo que 000000 sea el PIN real)
```

- [ ] **Step 4: Crear `SupervisorPinDialog.tsx`**

```tsx
// src/components/turno/SupervisorPinDialog.tsx
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

interface Supervisor {
  user_id: string;
  email: string;
  full_name: string;
  has_pin: boolean;
}

interface Props {
  open: boolean;
  clinicId: string;
  title?: string;
  description?: string;
  onAuthorized: (supervisorId: string, pin: string) => void;
  onCancel: () => void;
}

export default function SupervisorPinDialog({
  open, clinicId, title = "Autorización de supervisor requerida",
  description = "Se requiere autorización de un supervisor para continuar.",
  onAuthorized, onCancel,
}: Props) {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !clinicId) return;
    setSupervisors([]);
    setSelectedId("");
    setPin("");
    setError(null);

    (supabase as any)
      .rpc("get_clinic_supervisors", { p_clinic_id: clinicId })
      .then(({ data, error: e }: { data: unknown; error: { message: string } | null }) => {
        if (e) { setError("No se pudieron cargar los supervisores"); return; }
        setSupervisors((data ?? []) as Supervisor[]);
      });
  }, [open, clinicId]);

  const selected = supervisors.find((s) => s.user_id === selectedId) ?? null;

  async function handleSubmit() {
    if (!selected) { setError("Selecciona un supervisor"); return; }
    if (!pin || !/^\d{4,6}$/.test(pin)) {
      setError("PIN debe ser 4-6 dígitos numéricos");
      return;
    }
    if (!selected.has_pin) {
      setError("Este supervisor no tiene PIN configurado. Pide al administrador que le configure uno en Ajustes → Usuarios.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const { error: e } = await (supabase as any).rpc("verify_supervisor_pin", {
      p_clinic_id: clinicId,
      p_supervisor_id: selected.user_id,
      p_pin: pin,
    });

    setSubmitting(false);
    if (e) {
      if (e.message?.includes("PIN_INCORRECT")) setError("PIN incorrecto");
      else if (e.message?.includes("PIN_NOT_CONFIGURED")) setError("PIN no configurado.");
      else setError(e.message);
      return;
    }
    onAuthorized(selected.user_id, pin);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-xs text-muted-foreground">{description}</p>

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

          {selected && (
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
            {submitting ? "Verificando…" : "Autorizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: `tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260716150000_verify_supervisor_pin.sql src/components/turno/SupervisorPinDialog.tsx
git commit -m "feat: RPC verify_supervisor_pin + SupervisorPinDialog genérico"
```

---

### Task 2: Devoluciones exigen PIN de supervisor (gap 1)

**Files:**
- Create: `supabase/migrations/20260716150100_pharmacy_register_return_pin.sql`
- Modify: `src/features/farmacia/ReturnDialog.tsx`

**Interfaces:**
- Consumes: `SupervisorPinDialog` de Task 1, RPC `verify_supervisor_pin`.
- Produces: RPC `public.pharmacy_register_return(p_payload jsonb)` con `p_payload.supervisor_id` y `p_payload.supervisor_pin` obligatorios; `authorized_by` pasa a ser siempre `supervisor_id` (no el cajero que envía el payload).

- [ ] **Step 1: Migración — `pharmacy_register_return` valida PIN server-side**

Reemplaza la validación actual de rol por defecto (que permite auto-autorización si el
cajero tiene rol admin/manager) por verificación de PIN explícita — la RPC ya rechazaba
`authorized_by` sin rol, pero no exigía PIN ni impedía que el propio cajero se
auto-autorizara si tenía ese rol.

```sql
-- supabase/migrations/20260716150100_pharmacy_register_return_pin.sql
CREATE OR REPLACE FUNCTION public.pharmacy_register_return(p_payload jsonb)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_user         uuid := auth.uid();
  v_clinic       uuid;
  v_sale         record;
  v_return_id    uuid;
  v_shift_id     uuid;
  v_total        numeric(12,2) := 0;
  v_authorized   uuid;
  v_pin          text;
  v_item         jsonb;
  v_si           record;
  v_qty          int;
  v_item_sub     numeric(12,2);
  v_already_ret  int;
  v_refund_meth  text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  IF NOT (public.has_role(v_user,'admin') OR public.has_role(v_user,'nurse') OR
          public.has_role(v_user,'receptionist') OR public.has_role(v_user,'manager')) THEN
    RAISE EXCEPTION 'Permisos insuficientes para registrar devolución';
  END IF;

  v_clinic := NULLIF(p_payload->>'clinic_id','')::uuid;
  IF v_clinic IS NULL THEN RAISE EXCEPTION 'clinic_id requerido'; END IF;

  -- Autorización de supervisor por PIN (nunca confiar en que el cliente ya validó)
  v_authorized := NULLIF(p_payload->>'supervisor_id','')::uuid;
  v_pin        := p_payload->>'supervisor_pin';
  IF v_authorized IS NULL OR v_pin IS NULL OR length(trim(v_pin)) = 0 THEN
    RAISE EXCEPTION 'Devolución requiere supervisor_id y supervisor_pin';
  END IF;
  PERFORM public.verify_supervisor_pin(v_clinic, v_authorized, v_pin);

  -- Validar venta original
  SELECT * INTO v_sale FROM public.pharmacy_sales
   WHERE id = NULLIF(p_payload->>'sale_id','')::uuid AND clinic_id = v_clinic;
  IF v_sale IS NULL THEN RAISE EXCEPTION 'Venta no encontrada'; END IF;
  IF v_sale.status <> 'completed' THEN
    RAISE EXCEPTION 'Solo se pueden devolver ventas completadas';
  END IF;

  v_refund_meth := COALESCE(NULLIF(p_payload->>'refund_method',''),'sin_reembolso');

  IF jsonb_array_length(COALESCE(p_payload->'items','[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Debe incluir al menos un artículo a devolver';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items') LOOP
    SELECT psi.* INTO v_si
      FROM public.pharmacy_sale_items psi
     WHERE psi.id = (v_item->>'sale_item_id')::uuid
       AND psi.sale_id = v_sale.id;
    IF v_si IS NULL THEN
      RAISE EXCEPTION 'Ítem % no pertenece a la venta', v_item->>'sale_item_id';
    END IF;

    v_qty := (v_item->>'quantity')::int;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida en ítem %', v_si.id;
    END IF;

    SELECT COALESCE(SUM(pri.quantity),0) INTO v_already_ret
      FROM public.pharmacy_return_items pri
      JOIN public.pharmacy_returns pr ON pr.id = pri.return_id
     WHERE pri.sale_item_id = v_si.id;

    IF v_already_ret + v_qty > v_si.quantity THEN
      RAISE EXCEPTION 'Devolución excede cantidad vendida para ítem % (vendido: %, ya devuelto: %, solicitado: %)',
        v_si.medicamento_id, v_si.quantity, v_already_ret, v_qty;
    END IF;
  END LOOP;

  SELECT id INTO v_shift_id
    FROM public.pharmacy_cash_shifts
   WHERE cashier_user_id = v_user AND clinic_id = v_clinic AND status = 'open'
   ORDER BY opened_at DESC LIMIT 1;

  INSERT INTO public.pharmacy_returns
    (clinic_id, original_sale_id, shift_id, motivo, refund_method, total_refund, authorized_by, created_by)
  VALUES
    (v_clinic, v_sale.id, v_shift_id,
     COALESCE(NULLIF(p_payload->>'motivo',''),'Sin motivo especificado'),
     v_refund_meth, 0, v_authorized, v_user)
  RETURNING id INTO v_return_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items') LOOP
    SELECT psi.* INTO v_si
      FROM public.pharmacy_sale_items psi
     WHERE psi.id = (v_item->>'sale_item_id')::uuid;

    v_qty := (v_item->>'quantity')::int;
    v_item_sub := ROUND(v_qty * v_si.unit_price, 2);
    v_total    := v_total + v_item_sub;

    INSERT INTO public.pharmacy_return_items
      (return_id, sale_item_id, medicamento_id, lote_id, quantity, unit_price, subtotal)
    VALUES
      (v_return_id, v_si.id, v_si.medicamento_id, v_si.lote_id, v_qty, v_si.unit_price, v_item_sub);

    IF v_si.lote_id IS NOT NULL THEN
      UPDATE public.lotes_medicamento
         SET existencia = existencia + v_qty
       WHERE id = v_si.lote_id;

      INSERT INTO public.movimientos_inventario
        (medicamento_id, lote_id, tipo, cantidad, motivo, created_by)
      VALUES
        (v_si.medicamento_id, v_si.lote_id, 'entrada_devolucion',
         v_qty, 'Devolución ref ' || v_return_id::text, v_user);
    END IF;
  END LOOP;

  UPDATE public.pharmacy_returns SET total_refund = v_total WHERE id = v_return_id;

  IF v_refund_meth = 'efectivo' AND v_shift_id IS NOT NULL AND v_total > 0 THEN
    INSERT INTO public.fondos_movimientos
      (clinic_id, pharmacy_shift_id, tipo, monto, motivo, registrado_by)
    VALUES
      (v_clinic, v_shift_id, 'egreso', v_total,
       'Reembolso devolución ' || v_return_id::text, v_user);
  END IF;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'crear', 'pharmacy_returns', v_return_id,
          jsonb_build_object('event','pharmacy_return_created',
                             'original_sale_id', v_sale.id,
                             'total_refund', v_total,
                             'refund_method', v_refund_meth,
                             'authorized_by', v_authorized),
          v_clinic);

  RETURN v_return_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.pharmacy_register_return(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_register_return(jsonb) TO authenticated;
```

- [ ] **Step 2: Aplicar migración**

Run: `supabase db push --linked`
Expected: aplica sin error.

- [ ] **Step 3: Modificar `ReturnDialog.tsx` para pedir PIN antes de enviar**

```tsx
// src/features/farmacia/ReturnDialog.tsx
// Reemplazar el import de useAuth y agregar SupervisorPinDialog
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import SupervisorPinDialog from "@/components/turno/SupervisorPinDialog";

// ... (tipos SaleItem, ReturnLine sin cambios)

export function ReturnDialog({ open, onClose, clinicId }: Props) {
  const { toast } = useToast();

  const [folio, setFolio] = useState("");
  const [saleId, setSaleId] = useState<string | null>(null);
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [motivo, setMotivo] = useState("");
  const [refundMethod, setRefundMethod] = useState<string>("sin_reembolso");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);

  // ... buscarVenta, setLineQty, totalRefund, selectedLines sin cambios

  function requestSubmit() {
    if (!saleId || selectedLines.length === 0) return;
    if (!motivo.trim()) {
      toast({ title: "Motivo requerido", variant: "destructive" });
      return;
    }
    setPinDialogOpen(true);
  }

  async function handleSubmit(supervisorId: string, pin: string) {
    if (!saleId) return;
    setPinDialogOpen(false);
    setSubmitting(true);
    try {
      const payload = {
        clinic_id: clinicId,
        sale_id: saleId,
        motivo: motivo.trim(),
        refund_method: refundMethod,
        supervisor_id: supervisorId,
        supervisor_pin: pin,
        items: selectedLines.map((l) => ({ sale_item_id: l.sale_item_id, quantity: l.qty })),
      };

      const { error } = await (supabase as any).rpc("pharmacy_register_return", { p_payload: payload } as never);
      if (error) throw error;

      toast({ title: "Devolución registrada", description: `Reembolso: ${formatMXN(totalRefund)}` });
      handleClose();
    } catch (e: unknown) {
      toast({ title: "Error al registrar devolución", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setFolio("");
    setSaleId(null);
    setLines([]);
    setMotivo("");
    setRefundMethod("sin_reembolso");
    onClose();
  }

  // ... JSX igual, salvo el botón final y el diálogo de PIN:

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        {/* ... contenido existente sin cambios hasta el DialogFooter ... */}
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            onClick={requestSubmit}
            disabled={submitting || selectedLines.length === 0 || !motivo.trim()}
          >
            {submitting ? "Procesando…" : "Confirmar devolución"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <SupervisorPinDialogWithPin
        open={pinDialogOpen}
        clinicId={clinicId}
        onAuthorized={handleSubmit}
        onCancel={() => setPinDialogOpen(false)}
      />
    </Dialog>
  );
}
```

`SupervisorPinDialog.onAuthorized` (Task 1) ya entrega `(supervisorId, pin)`, así que
`handleSubmit(supervisorId, pin)` del Step 3 encaja directo como `onAuthorized`. En el
JSX del Step 3 arriba, usar el componente real (quitar el nombre ilustrativo
`SupervisorPinDialogWithPin` — es `SupervisorPinDialog`):

```tsx
      <SupervisorPinDialog
        open={pinDialogOpen}
        clinicId={clinicId}
        onAuthorized={handleSubmit}
        onCancel={() => setPinDialogOpen(false)}
      />
```

Agregar el import correspondiente al inicio de `ReturnDialog.tsx`:

```tsx
import SupervisorPinDialog from "@/components/turno/SupervisorPinDialog";
```

- [ ] **Step 4: `tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Verificación manual en navegador**

Farmacia → Devoluciones → buscar folio de venta real → seleccionar ítems → motivo →
"Confirmar devolución" → debe abrir `SupervisorPinDialog` → seleccionar supervisor sin
PIN correcto → error `PIN incorrecto` → con PIN correcto → devolución registrada y
`pharmacy_returns.authorized_by` = id del supervisor (no del cajero), verificable con:

```sql
SELECT authorized_by, created_by FROM public.pharmacy_returns ORDER BY created_at DESC LIMIT 1;
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260716150100_pharmacy_register_return_pin.sql src/features/farmacia/ReturnDialog.tsx src/components/turno/SupervisorPinDialog.tsx
git commit -m "feat: devoluciones exigen PIN de supervisor (segregación de funciones)"
```

---

### Task 3: Cash drop distinto de egreso genérico (gap 2) — caja general

**Files:**
- Create: `supabase/migrations/20260716150200_cash_drop.sql`
- Modify: `src/pages/CajaTurno.tsx` (componente `FondoMovimientoDialog`, líneas ~390-462)

**Interfaces:**
- Consumes: `SupervisorPinDialog`, `verify_supervisor_pin`.
- Produces: RPC `public.turno_fondo_movimiento(p_turno_id uuid, p_tipo text, p_monto numeric, p_motivo text, p_destino text DEFAULT NULL, p_supervisor_id uuid DEFAULT NULL, p_supervisor_pin text DEFAULT NULL) RETURNS uuid` — `p_tipo` acepta ahora `'cash_drop'`, que exige `p_destino`, `p_supervisor_id` y `p_supervisor_pin`.

- [ ] **Step 1: Migración — columna `destino`, CHECK ampliado, RPC actualizada**

```sql
-- supabase/migrations/20260716150200_cash_drop.sql
ALTER TABLE public.fondos_movimientos
  ADD COLUMN IF NOT EXISTS destino text;

ALTER TABLE public.fondos_movimientos
  DROP CONSTRAINT IF EXISTS fondos_movimientos_tipo_check;
ALTER TABLE public.fondos_movimientos
  ADD CONSTRAINT fondos_movimientos_tipo_check
  CHECK (tipo IN ('egreso','ingreso','cash_drop'));

CREATE OR REPLACE FUNCTION public.turno_fondo_movimiento(
  p_turno_id uuid,
  p_tipo text,
  p_monto numeric,
  p_motivo text,
  p_destino text DEFAULT NULL,
  p_supervisor_id uuid DEFAULT NULL,
  p_supervisor_pin text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $func$
DECLARE
  v_user uuid := auth.uid();
  v_turno record;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_tipo NOT IN ('egreso','ingreso','cash_drop') THEN
    RAISE EXCEPTION 'tipo debe ser egreso, ingreso o cash_drop';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN RAISE EXCEPTION 'Monto debe ser mayor a cero'; END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN RAISE EXCEPTION 'Motivo requerido'; END IF;

  SELECT * INTO v_turno FROM public.turnos WHERE id = p_turno_id;
  IF v_turno IS NULL THEN RAISE EXCEPTION 'Turno no encontrado'; END IF;
  IF v_turno.estado <> 'abierto' THEN RAISE EXCEPTION 'El turno no está abierto'; END IF;

  IF NOT (
    v_turno.cajero_user_id = v_user
    OR has_role(v_user,'admin') OR has_role(v_user,'manager')
  ) THEN
    RAISE EXCEPTION 'Sin permiso para registrar movimiento de fondo';
  END IF;

  IF p_tipo = 'cash_drop' THEN
    IF p_destino IS NULL OR length(trim(p_destino)) = 0 THEN
      RAISE EXCEPTION 'Cash drop requiere destino (ej. caja fuerte, banco)';
    END IF;
    IF p_supervisor_id IS NULL OR p_supervisor_pin IS NULL THEN
      RAISE EXCEPTION 'Cash drop requiere doble firma: supervisor_id y supervisor_pin';
    END IF;
    PERFORM public.verify_supervisor_pin(v_turno.clinic_id, p_supervisor_id, p_supervisor_pin);
  END IF;

  INSERT INTO public.fondos_movimientos
    (clinic_id, turno_id, pharmacy_shift_id, tipo, monto, motivo, destino, registrado_by)
  VALUES
    (v_turno.clinic_id, p_turno_id, NULL, p_tipo, p_monto, p_motivo, p_destino, v_user)
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'crear', 'fondos_movimientos', v_id,
          jsonb_build_object(
            'event','turno_fondo_movimiento','tipo',p_tipo,'monto',p_monto,
            'motivo',p_motivo,'destino',p_destino,
            'supervisor_id', p_supervisor_id
          ), v_turno.clinic_id);

  RETURN v_id;
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.turno_fondo_movimiento(uuid, text, numeric, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.turno_fondo_movimiento(uuid, text, numeric, text, text, uuid, text) TO authenticated;
```

- [ ] **Step 2: Aplicar migración**

Run: `supabase db push --linked`
Expected: sin error. Nota: la firma vieja de 4 argumentos deja de existir (Postgres no
hace overload automático al agregar defaults al final vía `CREATE OR REPLACE` — si el
cliente sigue llamando con 4 args posicionales sigue funcionando porque los nuevos
tienen `DEFAULT NULL`).

- [ ] **Step 3: Verificación manual**

```sql
-- Sin destino: debe fallar
SELECT public.turno_fondo_movimiento('<turno_id abierto>'::uuid, 'cash_drop', 500, 'Retiro fin de turno');
-- Expected: ERROR: Cash drop requiere destino
```

- [ ] **Step 4: Modificar `FondoMovimientoDialog` en `CajaTurno.tsx`**

```tsx
// src/pages/CajaTurno.tsx — reemplazar la función FondoMovimientoDialog completa
function FondoMovimientoDialog({
  open, turnoId, clinicId, onClose, onDone,
}: {
  open: boolean; turnoId: string | null; clinicId: string; onClose: () => void; onDone: () => void;
}) {
  const [tipo, setTipo] = useState<"egreso" | "ingreso" | "cash_drop">("egreso");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [destino, setDestino] = useState("");
  const [saving, setSaving] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);

  function reset() { setTipo("egreso"); setMonto(""); setMotivo(""); setDestino(""); setSaving(false); }

  function requestSubmit() {
    if (!turnoId) return;
    const amount = Number(monto);
    if (Number.isNaN(amount) || amount <= 0) { toast.error("Monto debe ser mayor a cero"); return; }
    if (!motivo.trim()) { toast.error("Motivo requerido"); return; }
    if (tipo === "cash_drop") {
      if (!destino.trim()) { toast.error("Destino requerido para cash drop"); return; }
      setPinDialogOpen(true);
      return;
    }
    doSubmit();
  }

  async function doSubmit(supervisorId?: string, pin?: string) {
    if (!turnoId) return;
    setPinDialogOpen(false);
    setSaving(true);

    const { error } = await (supabase as any).rpc("turno_fondo_movimiento", {
      p_turno_id: turnoId,
      p_tipo: tipo,
      p_monto: Number(monto),
      p_motivo: motivo.trim(),
      p_destino: tipo === "cash_drop" ? destino.trim() : null,
      p_supervisor_id: supervisorId ?? null,
      p_supervisor_pin: pin ?? null,
    } as never);

    setSaving(false);
    if (error) { toast.error(`Error: ${error.message}`); return; }
    toast.success(tipo === "egreso" ? "Retiro registrado" : tipo === "ingreso" ? "Depósito registrado" : "Cash drop registrado");
    reset();
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" /> Movimiento de fondo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as "egreso" | "ingreso" | "cash_drop")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="egreso">Retiro / Egreso</SelectItem>
                <SelectItem value="ingreso">Depósito / Ingreso</SelectItem>
                <SelectItem value="cash_drop">Cash drop (retiro a caja fuerte/banco)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Monto (MXN)</Label>
            <MoneyInput value={monto}
              onValueChange={setMonto} placeholder="0.00" autoFocus />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Motivo</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. Pago a proveedor, cambio de billetes…" />
          </div>
          {tipo === "cash_drop" && (
            <div className="space-y-1">
              <Label className="text-xs">Destino</Label>
              <Input value={destino} onChange={(e) => setDestino(e.target.value)}
                placeholder="Ej. Caja fuerte, banco…" />
              <p className="text-xs text-muted-foreground">Requiere doble firma: tu registro + PIN de un supervisor.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button onClick={requestSubmit} disabled={saving}>
            {saving ? "Guardando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
      <SupervisorPinDialog
        open={pinDialogOpen}
        clinicId={clinicId}
        title="Autorización de cash drop"
        description="El cash drop requiere PIN de un supervisor distinto al cajero."
        onAuthorized={(supervisorId, pin) => doSubmit(supervisorId, pin)}
        onCancel={() => setPinDialogOpen(false)}
      />
    </Dialog>
  );
}
```

- [ ] **Step 5: Propagar `clinicId` al llamar `FondoMovimientoDialog` en `CajaTurno` (componente principal, ~línea 973)**

```tsx
      <FondoMovimientoDialog
        open={fondoDialogOpen}
        turnoId={turnoActivo?.id ?? null}
        clinicId={activeClinic?.id ?? ""}
        onClose={() => setFondoDialogOpen(false)}
        onDone={() => { setFondoDialogOpen(false); load(); }}
      />
```

Y agregar el import:

```tsx
import SupervisorPinDialog from "@/components/turno/SupervisorPinDialog";
```

Y en la tabla de movimientos de fondo (líneas ~874-888), agregar columna de destino
para cash drops:

```tsx
                    {fondos.map((f) => (
                      <tr key={f.id}>
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(f.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`font-medium ${f.tipo === "egreso" ? "text-red-600" : f.tipo === "cash_drop" ? "text-amber-600" : "text-green-600"}`}>
                            {f.tipo === "egreso" ? "Retiro" : f.tipo === "cash_drop" ? "Cash drop" : "Depósito"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-foreground">{f.motivo}</td>
                        <td className={`px-3 py-2 text-right font-medium ${f.tipo === "ingreso" ? "text-green-600" : "text-red-600"}`}>
                          {f.tipo === "ingreso" ? "+" : "−"}{fmt(f.monto)}
                        </td>
                      </tr>
                    ))}
```

Actualizar `FondoMovimiento` interface (~línea 46-52) para incluir `"cash_drop"` en el
union de `tipo`.

- [ ] **Step 6: `tsc --noEmit` + verificación manual**

Run: `npx tsc --noEmit` → sin errores.
En navegador: Turno de Caja → Egreso/Ingreso → Cash drop → destino vacío → error. Con
destino y PIN de supervisor correcto → registrado, aparece en la tabla como "Cash drop".

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260716150200_cash_drop.sql src/pages/CajaTurno.tsx
git commit -m "feat: cash drop con doble firma, distinto de egreso genérico"
```

---

### Task 4: Cash drop — réplica en farmacia (`ShiftPanel.tsx`)

**Files:**
- Create: `supabase/migrations/20260716150300_pharmacy_cash_drop.sql`
- Modify: `src/features/farmacia/ShiftPanel.tsx` (`FondoMovimientoDialog`, líneas 506-614)

**Interfaces:**
- Consumes: `SupervisorPinDialog`, `verify_supervisor_pin`.
- Produces: RPC `public.pharmacy_fondo_movimiento(p_shift_id uuid, p_tipo text, p_monto numeric, p_motivo text, p_destino text DEFAULT NULL, p_supervisor_id uuid DEFAULT NULL, p_supervisor_pin text DEFAULT NULL) RETURNS uuid`.

- [ ] **Step 1: Migración — mismo patrón que Task 3, para el shift de farmacia**

```sql
-- supabase/migrations/20260716150300_pharmacy_cash_drop.sql
CREATE OR REPLACE FUNCTION public.pharmacy_fondo_movimiento(
  p_shift_id uuid,
  p_tipo text,
  p_monto numeric,
  p_motivo text,
  p_destino text DEFAULT NULL,
  p_supervisor_id uuid DEFAULT NULL,
  p_supervisor_pin text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $func$
DECLARE
  v_user uuid := auth.uid();
  v_shift public.pharmacy_cash_shifts;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_tipo NOT IN ('egreso','ingreso','cash_drop') THEN
    RAISE EXCEPTION 'tipo debe ser egreso, ingreso o cash_drop';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN RAISE EXCEPTION 'Monto debe ser mayor a cero'; END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN RAISE EXCEPTION 'Motivo requerido'; END IF;

  SELECT * INTO v_shift FROM public.pharmacy_cash_shifts WHERE id = p_shift_id;
  IF v_shift IS NULL THEN RAISE EXCEPTION 'Turno no encontrado'; END IF;
  IF v_shift.status <> 'open' THEN RAISE EXCEPTION 'El turno no está abierto'; END IF;

  IF NOT (
    v_shift.cashier_user_id = v_user
    OR has_role(v_user,'admin') OR has_role(v_user,'manager')
  ) THEN
    RAISE EXCEPTION 'Sin permiso para registrar movimiento de fondo';
  END IF;

  IF p_tipo = 'cash_drop' THEN
    IF p_destino IS NULL OR length(trim(p_destino)) = 0 THEN
      RAISE EXCEPTION 'Cash drop requiere destino (ej. caja fuerte, banco)';
    END IF;
    IF p_supervisor_id IS NULL OR p_supervisor_pin IS NULL THEN
      RAISE EXCEPTION 'Cash drop requiere doble firma: supervisor_id y supervisor_pin';
    END IF;
    PERFORM public.verify_supervisor_pin(v_shift.clinic_id, p_supervisor_id, p_supervisor_pin);
  END IF;

  INSERT INTO public.fondos_movimientos
    (clinic_id, pharmacy_shift_id, tipo, monto, motivo, destino, registrado_by)
  VALUES
    (v_shift.clinic_id, p_shift_id, p_tipo, p_monto, p_motivo, p_destino, v_user)
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'crear', 'fondos_movimientos', v_id,
          jsonb_build_object(
            'event', 'fondo_movimiento', 'tipo', p_tipo, 'monto', p_monto,
            'motivo', p_motivo, 'destino', p_destino, 'supervisor_id', p_supervisor_id
          ), v_shift.clinic_id);

  RETURN v_id;
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.pharmacy_fondo_movimiento(uuid, text, numeric, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_fondo_movimiento(uuid, text, numeric, text, text, uuid, text) TO authenticated;
```

- [ ] **Step 2: Aplicar migración**

Run: `supabase db push --linked`

- [ ] **Step 3: Modificar `FondoMovimientoDialog` en `ShiftPanel.tsx`**

Mismo cambio estructural que Task 3 Step 4, adaptado a `p_shift_id` en vez de
`p_turno_id` y usando `shift.clinic_id` como `clinicId`:

```tsx
// src/features/farmacia/ShiftPanel.tsx — reemplazar FondoMovimientoDialog completo
export function FondoMovimientoDialog({
  open, shift, onClose,
}: {
  open: boolean;
  shift: Shift | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [tipo, setTipo] = useState<"egreso" | "ingreso" | "cash_drop">("egreso");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [destino, setDestino] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);

  function handleClose() {
    setTipo("egreso"); setMonto(""); setMotivo(""); setDestino("");
    onClose();
  }

  function requestSubmit() {
    if (!shift) return;
    const amount = Number(monto);
    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: "Monto inválido", variant: "destructive" });
      return;
    }
    if (!motivo.trim()) {
      toast({ title: "El motivo es requerido", variant: "destructive" });
      return;
    }
    if (tipo === "cash_drop") {
      if (!destino.trim()) {
        toast({ title: "Destino requerido para cash drop", variant: "destructive" });
        return;
      }
      setPinDialogOpen(true);
      return;
    }
    doSubmit();
  }

  async function doSubmit(supervisorId?: string, pin?: string) {
    if (!shift) return;
    setPinDialogOpen(false);
    setSubmitting(true);
    const { error } = await (supabase as any).rpc("pharmacy_fondo_movimiento", {
      p_shift_id: shift.id,
      p_tipo: tipo,
      p_monto: Number(monto),
      p_motivo: motivo.trim(),
      p_destino: tipo === "cash_drop" ? destino.trim() : null,
      p_supervisor_id: supervisorId ?? null,
      p_supervisor_pin: pin ?? null,
    } as never);
    setSubmitting(false);
    if (error) {
      toast({ title: "Error al registrar", description: friendlyError(error), variant: "destructive" });
      return;
    }
    toast({
      title: tipo === "egreso" ? "Egreso registrado" : tipo === "ingreso" ? "Ingreso registrado" : "Cash drop registrado",
      description: `${formatMXN(Number(monto))} — ${motivo.trim()}`,
    });
    handleClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" />Movimiento de fondo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Registra retiros (egresos), depósitos (ingresos) o cash drops de efectivo durante el turno.
            Quedan en auditoría y se descuentan del efectivo esperado al cierre.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant={tipo === "egreso" ? "default" : "outline"} onClick={() => setTipo("egreso")} className="flex-1">
              Egreso
            </Button>
            <Button size="sm" variant={tipo === "ingreso" ? "default" : "outline"} onClick={() => setTipo("ingreso")} className="flex-1">
              Ingreso
            </Button>
            <Button size="sm" variant={tipo === "cash_drop" ? "default" : "outline"} onClick={() => setTipo("cash_drop")} className="flex-1">
              Cash drop
            </Button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Monto (MXN)</Label>
            <MoneyInput value={monto} onValueChange={setMonto} className="h-11 text-base" placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Motivo</Label>
            <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder={tipo === "egreso" ? "Ej: Pago a proveedor" : tipo === "ingreso" ? "Ej: Aportación de cambio" : "Ej: Retiro de excedente de caja"} />
          </div>
          {tipo === "cash_drop" && (
            <div className="space-y-1">
              <Label className="text-xs">Destino</Label>
              <Input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Ej. Caja fuerte, banco…" />
              <p className="text-xs text-muted-foreground">Requiere PIN de un supervisor.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={requestSubmit} disabled={submitting}>
            {submitting ? "Registrando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
      <SupervisorPinDialog
        open={pinDialogOpen}
        clinicId={shift?.clinic_id ?? ""}
        title="Autorización de cash drop"
        description="El cash drop requiere PIN de un supervisor distinto al cajero."
        onAuthorized={(supervisorId, pin) => doSubmit(supervisorId, pin)}
        onCancel={() => setPinDialogOpen(false)}
      />
    </Dialog>
  );
}
```

Agregar import `SupervisorPinDialog` al inicio de `ShiftPanel.tsx`. Confirmar que el
tipo `Shift` (definido arriba en el archivo) tiene campo `clinic_id`; si no lo tiene,
agregarlo al `select` que carga el shift y a la interfaz `Shift`.

- [ ] **Step 4: `tsc --noEmit` + verificación manual en Farmacia → Movimiento de fondo → Cash drop**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260716150300_pharmacy_cash_drop.sql src/features/farmacia/ShiftPanel.tsx
git commit -m "feat: cash drop con doble firma en turno de farmacia"
```

---

### Task 5: Explicación obligatoria cuando hay diferencia al cierre (gap 3)

**Files:**
- Create: `supabase/migrations/20260716150400_notes_required_on_diff.sql`
- Modify: `src/pages/CajaTurno.tsx` (`CloseTurnoDialog`)
- Modify: `src/components/turno/TurnoCloseWizard.tsx`

**Interfaces:**
- Produces: `turno_close` ahora exige `p_notes` no vacío cuando `v_diff <> 0`,
  `RAISE EXCEPTION 'NOTES_REQUIRED_ON_DIFF'`.

- [ ] **Step 1: Migración — agregar el check a `turno_close`**

```sql
-- supabase/migrations/20260716150400_notes_required_on_diff.sql
CREATE OR REPLACE FUNCTION public.turno_close(
  p_turno_id uuid,
  p_cash_count numeric,
  p_notes text DEFAULT NULL,
  p_supervisor_override boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user uuid := auth.uid();
  v_turno record;
  v_cash_cobros numeric(12,2) := 0;
  v_cash_ingresos numeric(12,2) := 0;
  v_cash_egresos numeric(12,2) := 0;
  v_expected numeric(12,2);
  v_diff numeric(12,2);
  v_umbral numeric(10,2);
  v_settings jsonb;
  v_corte_id uuid;
  v_folio bigint;
  v_ticket_count integer := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT t.* INTO v_turno FROM public.turnos t WHERE t.id = p_turno_id FOR UPDATE;

  IF v_turno IS NULL THEN RAISE EXCEPTION 'Turno no encontrado'; END IF;
  IF v_turno.estado <> 'abierto' THEN RAISE EXCEPTION 'El turno no está abierto'; END IF;

  IF NOT (
    v_turno.cajero_user_id = v_user
    OR has_role(v_user, 'admin') OR has_role(v_user, 'manager')
  ) THEN
    RAISE EXCEPTION 'Sin permiso para cerrar este turno';
  END IF;

  IF p_cash_count IS NULL OR p_cash_count < 0 THEN
    RAISE EXCEPTION 'Efectivo contado inválido';
  END IF;

  SELECT COALESCE(SUM(mp.monto), 0) INTO v_cash_cobros
  FROM public.movimiento_pagos mp
  JOIN public.movimientos m ON m.id = mp.movimiento_id
  JOIN public.metodos_pago met ON met.id = mp.metodo_pago_id
  WHERE m.turno_id = p_turno_id AND m.estado = 'pagado' AND m.tipo = 'cobro' AND met.codigo_sat = '01';

  SELECT COALESCE(SUM(total), 0) INTO v_cash_ingresos
  FROM public.movimientos WHERE turno_id = p_turno_id AND tipo = 'ingreso' AND estado = 'pagado';

  SELECT COALESCE(SUM(total), 0) INTO v_cash_egresos
  FROM public.movimientos WHERE turno_id = p_turno_id AND tipo = 'egreso' AND estado = 'pagado';

  SELECT COUNT(*)::integer INTO v_ticket_count
  FROM public.movimientos WHERE turno_id = p_turno_id AND tipo = 'cobro' AND estado = 'pagado';

  v_expected := v_turno.monto_apertura + v_cash_cobros + v_cash_ingresos - v_cash_egresos;
  v_diff := p_cash_count - v_expected;

  -- Explicación obligatoria cuando hay diferencia (gap 3)
  IF v_diff <> 0 AND (p_notes IS NULL OR length(trim(p_notes)) = 0) THEN
    RAISE EXCEPTION 'NOTES_REQUIRED_ON_DIFF|%', v_diff;
  END IF;

  SELECT data INTO v_settings FROM public.clinic_settings
   WHERE clinic_id = v_turno.clinic_id AND section = 'caja';
  v_umbral := (v_settings->>'umbral_diferencia')::numeric;

  IF v_umbral IS NOT NULL AND abs(v_diff) > v_umbral THEN
    IF NOT p_supervisor_override THEN
      RAISE EXCEPTION 'DIFF_EXCEEDS_THRESHOLD|%|%', v_diff, v_umbral;
    END IF;
    IF NOT (has_role(v_user, 'admin') OR has_role(v_user, 'manager')) THEN
      RAISE EXCEPTION 'Solo admin o gerente puede autorizar diferencias que excedan el umbral configurado';
    END IF;
  END IF;

  v_folio := nextval('public.cortes_folio_seq');

  UPDATE public.turnos
     SET estado = 'cerrado', cerrado_at = now(), monto_cierre = p_cash_count, notas_cierre = p_notes
   WHERE id = p_turno_id;

  INSERT INTO public.cortes (
    clinic_id, turno_id, tipo, folio_secuencial, efectivo_esperado, conteo_ciego, diferencia,
    requiere_autorizacion, autorizado_by, autorizado_at, total_efectivo, total_general,
    conteo_movimientos, generado_by, datos_json
  ) VALUES (
    v_turno.clinic_id, p_turno_id, 'Z', v_folio, v_expected, p_cash_count, v_diff,
    (v_umbral IS NOT NULL AND abs(v_diff) > v_umbral AND p_supervisor_override),
    CASE WHEN (v_umbral IS NOT NULL AND abs(v_diff) > v_umbral AND p_supervisor_override) THEN v_user ELSE NULL END,
    CASE WHEN (v_umbral IS NOT NULL AND abs(v_diff) > v_umbral AND p_supervisor_override) THEN now() ELSE NULL END,
    v_cash_cobros, v_expected, v_ticket_count, v_user,
    jsonb_build_object(
      'opening_amount', v_turno.monto_apertura, 'cash_cobros', v_cash_cobros,
      'cash_ingresos', v_cash_ingresos, 'cash_egresos', v_cash_egresos,
      'expected', v_expected, 'counted', p_cash_count, 'difference', v_diff,
      'supervisor_override', p_supervisor_override
    )
  ) RETURNING id INTO v_corte_id;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'actualizar', 'turnos', p_turno_id,
          jsonb_build_object('event', 'turno_cerrado', 'folio_corte', v_folio,
            'opening_amount', v_turno.monto_apertura, 'expected_cash', v_expected,
            'counted_cash', p_cash_count, 'difference', v_diff), v_turno.clinic_id);

  RETURN jsonb_build_object(
    'turno_id', p_turno_id, 'corte_id', v_corte_id, 'folio', v_folio,
    'opening_amount', v_turno.monto_apertura, 'cash_total', v_cash_cobros,
    'expected_cash', v_expected, 'counted_cash', p_cash_count, 'difference', v_diff,
    'supervisor_override', p_supervisor_override
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.turno_close(uuid, numeric, text, boolean) TO authenticated;
```

- [ ] **Step 2: Aplicar migración**

Run: `supabase db push --linked`

- [ ] **Step 3: `CajaTurno.tsx` — bloquear el botón de cierre si hay diferencia sin notas**

En `CloseTurnoDialog` (dentro de `CajaTurno.tsx`), agregar un cálculo de diferencia
estimada (no oficial, solo para UX — la RPC sigue siendo la autoridad) y deshabilitar
el submit:

```tsx
  // Dentro de CloseTurnoDialog, después de los useState existentes:
  const estimatedDiff = turno ? Number(count) - null : null; // placeholder eliminado abajo
```

Nota: `CajaTurno.tsx` no tiene el efectivo esperado disponible client-side antes de
llamar `turno_close` (a diferencia de `TurnoOpenWizard`, que sí consulta el corte Z
anterior). No calcular una diferencia estimada en el cliente sería inventar un número
no confiable — en vez de eso, mostrar el requisito como texto informativo y dejar que
la RPC sea la única fuente de verdad, capturando su error igual que ya hace con
`DIFF_EXCEEDS_THRESHOLD`:

```tsx
  async function submit(supervisorOverride = false) {
    if (!turno) return;
    const amount = Number(count);
    if (Number.isNaN(amount) || amount < 0) { toast.error("Monto inválido"); return; }
    setSubmitting(true); setOverridePrompt(null);

    const { data, error } = await (supabase as any).rpc("turno_close", {
      p_turno_id: turno.id,
      p_cash_count: amount,
      p_notes: notes || null,
      p_supervisor_override: supervisorOverride,
    } as never);

    setSubmitting(false);
    if (error) {
      if (error.message?.startsWith("DIFF_EXCEEDS_THRESHOLD")) {
        const parts = error.message.split("|");
        const diff   = Number.isFinite(Number(parts[1])) ? Number(parts[1]) : 0;
        const umbral = Number.isFinite(Number(parts[2])) ? Number(parts[2]) : 0;
        setOverridePrompt({ diff, umbral });
        return;
      }
      if (error.message?.startsWith("NOTES_REQUIRED_ON_DIFF")) {
        toast.error("Hay una diferencia entre lo contado y lo esperado — escribe una explicación en Notas antes de cerrar.");
        return;
      }
      toast.error(`No se pudo cerrar el turno: ${error.message}`);
      return;
    }
    const r = data as unknown as CloseResult;
    setResult(r);
    setFondoInput(String(r.opening_amount ?? 0));
  }
```

Y en el JSX del formulario de cierre (antes del `SupervisorAuthDialog`), agregar un
aviso junto al campo de notas:

```tsx
          <div className="space-y-1">
            <Label className="text-xs">Notas del cierre</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Obligatorio si el efectivo contado no coincide exactamente con lo esperado.
            </p>
          </div>
```

- [ ] **Step 4: Mismo tratamiento en `TurnoCloseWizard.tsx`**

Aplicar el mismo patrón: capturar `NOTES_REQUIRED_ON_DIFF` en el catch de la llamada a
`turno_close`/`pharmacy_close_shift` y mostrar el mismo toast, agregar el mismo aviso
bajo el campo de notas. Revisar la función `submit`/`close` de ese archivo (equivalente
a `CloseTurnoDialog.submit` de `CajaTurno.tsx`) y replicar el bloque `if
(error.message?.startsWith("NOTES_REQUIRED_ON_DIFF"))`.

- [ ] **Step 5: `tsc --noEmit` + verificación manual**

Run: `npx tsc --noEmit`
En navegador: cerrar un turno con conteo distinto al esperado y notas vacías → debe
mostrar el toast de explicación requerida y no cerrar. Con notas → cierra normal.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260716150400_notes_required_on_diff.sql src/pages/CajaTurno.tsx src/components/turno/TurnoCloseWizard.tsx
git commit -m "feat: exige explicación cuando hay diferencia de caja al cierre"
```

---

### Task 6: Folio correlativo de apertura + explicación obligatoria en apertura (gap 3 + gap 4)

**Files:**
- Create: `supabase/migrations/20260716150500_turno_open_rpc.sql`
- Modify: `src/components/turno/TurnoOpenWizard.tsx`

**Interfaces:**
- Produces: `SEQUENCE public.turnos_apertura_folio_seq`, columna
  `turnos.folio_apertura bigint`. RPC `public.turno_open(p_clinic_id uuid, p_caja_id
  uuid, p_monto_apertura numeric, p_conteo_apertura numeric, p_fondo_esperado numeric
  DEFAULT NULL, p_denominaciones jsonb DEFAULT NULL, p_notas text DEFAULT NULL) RETURNS
  jsonb` — retorna `{id, folio_apertura, caja_id, estado, monto_apertura, abierto_at,
  pharmacy_shift_id}`. Exige `p_notas` no vacío cuando `p_fondo_esperado IS NOT NULL AND
  p_conteo_apertura <> p_fondo_esperado`.

- [ ] **Step 1: Migración — secuencia, columna, RPC**

```sql
-- supabase/migrations/20260716150500_turno_open_rpc.sql
CREATE SEQUENCE IF NOT EXISTS public.turnos_apertura_folio_seq
  START WITH 1 INCREMENT BY 1 NO CYCLE;
GRANT USAGE, SELECT ON SEQUENCE public.turnos_apertura_folio_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.turnos_apertura_folio_seq TO service_role;

ALTER TABLE public.turnos
  ADD COLUMN IF NOT EXISTS folio_apertura bigint,
  ADD COLUMN IF NOT EXISTS conteo_apertura numeric(12,2),
  ADD COLUMN IF NOT EXISTS fondo_esperado numeric(12,2),
  ADD COLUMN IF NOT EXISTS denominaciones_apertura jsonb;

CREATE OR REPLACE FUNCTION public.turno_open(
  p_clinic_id uuid,
  p_caja_id uuid,
  p_monto_apertura numeric,
  p_conteo_apertura numeric,
  p_fondo_esperado numeric DEFAULT NULL,
  p_denominaciones jsonb DEFAULT NULL,
  p_notas text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user uuid := auth.uid();
  v_folio bigint;
  v_turno record;
  v_diff numeric(12,2);
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_monto_apertura IS NULL OR p_monto_apertura < 0 THEN
    RAISE EXCEPTION 'Monto de apertura inválido';
  END IF;

  IF p_fondo_esperado IS NOT NULL THEN
    v_diff := p_conteo_apertura - p_fondo_esperado;
    IF v_diff <> 0 AND (p_notas IS NULL OR length(trim(p_notas)) = 0) THEN
      RAISE EXCEPTION 'NOTES_REQUIRED_ON_DIFF|%', v_diff;
    END IF;
  END IF;

  v_folio := nextval('public.turnos_apertura_folio_seq');

  INSERT INTO public.turnos (
    clinic_id, caja_id, cajero_user_id, monto_apertura, conteo_apertura,
    fondo_esperado, denominaciones_apertura, folio_apertura, notas_apertura, estado
  ) VALUES (
    p_clinic_id, p_caja_id, v_user, p_monto_apertura, p_conteo_apertura,
    p_fondo_esperado, p_denominaciones, v_folio, p_notas, 'abierto'
  )
  RETURNING id, caja_id, estado, monto_apertura, abierto_at, pharmacy_shift_id
  INTO v_turno;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'crear', 'turnos', v_turno.id,
          jsonb_build_object('event', 'turno_abierto', 'folio_apertura', v_folio,
            'monto_apertura', p_monto_apertura, 'fondo_esperado', p_fondo_esperado), p_clinic_id);

  RETURN jsonb_build_object(
    'id', v_turno.id, 'folio_apertura', v_folio, 'caja_id', v_turno.caja_id,
    'estado', v_turno.estado, 'monto_apertura', v_turno.monto_apertura,
    'abierto_at', v_turno.abierto_at, 'pharmacy_shift_id', v_turno.pharmacy_shift_id
  );
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.turno_open(uuid, uuid, numeric, numeric, numeric, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.turno_open(uuid, uuid, numeric, numeric, numeric, jsonb, text) TO authenticated;
```

- [ ] **Step 2: Aplicar migración**

Run: `supabase db push --linked`

- [ ] **Step 3: `TurnoOpenWizard.tsx` — usar la RPC en vez de INSERT directo, agregar notas obligatorias**

Reemplazar `openTurno()` completo:

```tsx
  const [notasApertura, setNotasApertura] = useState("");

  async function openTurno() {
    if (!cajaId || !activeClinic?.id || !user?.id) return;
    const montoContado = Number(conteo);
    if (isNaN(montoContado) || montoContado < 0) { toast.error("Monto inválido"); return; }
    if (fondoEsperado !== null && montoContado !== fondoEsperado && !notasApertura.trim()) {
      toast.error("Hay una diferencia contra el fondo esperado — escribe una explicación antes de continuar.");
      return;
    }
    setSaving(true);

    const { data: newTurno, error } = await (supabase as any).rpc("turno_open", {
      p_clinic_id: activeClinic.id,
      p_caja_id: cajaId,
      p_monto_apertura: montoContado,
      p_conteo_apertura: montoContado,
      p_fondo_esperado: fondoEsperado,
      p_denominaciones: Object.keys(denomBreakdown).length > 0 ? denomBreakdown : null,
      p_notas: notasApertura.trim() || null,
    });

    if (error) { setSaving(false); toast.error(`Error: ${error.message}`); return; }

    const caja = cajas.find((c) => c.id === cajaId)!;
    let pharmacyShiftId: string | null = null;

    if (caja.es_farmacia) {
      const { data: shiftId, error: shiftErr } = await (supabase as any).rpc("pharmacy_open_shift", {
        p_clinic_id: activeClinic.id,
        p_opening_amount: montoContado,
        p_notes: null,
      } as never);
      if (!shiftErr && shiftId) {
        await (supabase as any).from("turnos").update({ pharmacy_shift_id: shiftId }).eq("id", newTurno.id);
        pharmacyShiftId = shiftId as string;
      } else if (shiftErr) {
        toast.warning(`Turno abierto, pero error en turno POS Farmacia: ${shiftErr.message}`);
      }
    }

    setSaving(false);
    onOpened({
      id: newTurno.id,
      caja_id: cajaId,
      caja_nombre: caja.nombre,
      estado: "abierto",
      monto_apertura: montoContado,
      abierto_at: newTurno.abierto_at,
      pharmacy_shift_id: pharmacyShiftId,
      es_farmacia: caja.es_farmacia,
    });
  }
```

Y en el paso `"confirm"` del JSX, agregar el campo de notas antes del botón "Abrir
turno y comenzar" (solo visible/relevante cuando hay diferencia):

```tsx
            {fondoEsperado !== null && diferencia !== 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="notas-apertura">Explicación de la diferencia *</Label>
                <Input
                  id="notas-apertura"
                  value={notasApertura}
                  onChange={(e) => setNotasApertura(e.target.value)}
                  placeholder="Ej. Faltante heredado del turno anterior, pendiente de revisión…"
                />
              </div>
            )}
            <Button onClick={openTurno} className="w-full" size="lg" disabled={saving}>
```

- [ ] **Step 4: `tsc --noEmit` + verificación manual**

Run: `npx tsc --noEmit`
En navegador: abrir turno con conteo distinto al fondo esperado del Z anterior, dejar
notas vacías → botón debe rechazar con toast. Con notas → abre, y
`turnos.folio_apertura` incrementa correlativo, verificable con:

```sql
SELECT id, folio_apertura, conteo_apertura, fondo_esperado, notas_apertura
  FROM public.turnos ORDER BY abierto_at DESC LIMIT 1;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260716150500_turno_open_rpc.sql src/components/turno/TurnoOpenWizard.tsx
git commit -m "feat: folio correlativo de apertura + explicación obligatoria en diferencia de apertura"
```

---

### Task 7: Conteo ciego para cajas generales — `CajaTurno.tsx` reusa `TurnoOpenWizard` (gap 6)

**Files:**
- Modify: `src/pages/CajaTurno.tsx`

**Interfaces:**
- Consumes: `TurnoOpenWizard` (props `cajaFilter`, `onOpened`) de
  `src/components/turno/TurnoOpenWizard.tsx`, ya actualizado en Task 6.

- [ ] **Step 1: Eliminar el formulario de apertura no-ciego y el estado asociado**

En `CajaTurno.tsx`, quitar del componente principal (`export default function
CajaTurno`) los siguientes elementos que ya no se necesitan porque el wizard los
maneja internamente:

- Estados: `cajaId`, `montoApertura`, `notas` (los del formulario de apertura — NO
  confundir con `notas` usado dentro de `CloseTurnoDialog`, que es un componente
  distinto y no se toca).
- Función `abrirTurno`.
- Función `onCajaChange`.
- El bloque JSX completo `{cajas.length === 0 ? (...) : turnoActivo ? (...) : ( <div className="rounded-xl border ..."> <h2>Abrir turno</h2> ... </div> )}` en su rama `else` (turno no activo, cajas.length > 0).

Reemplazar ese bloque `else` por:

```tsx
      ) : (
        <TurnoOpenWizard
          cajaFilter="general"
          onOpened={() => load()}
        />
      )}
```

Import a agregar:

```tsx
import TurnoOpenWizard from "@/components/turno/TurnoOpenWizard";
```

El caso `cajas.length === 0` (banner "Sin cajas configuradas") se mantiene igual — el
wizard ya tiene su propio `CajaQuickSetup` para cuando no hay cajas, pero el banner
existente en `CajaTurno.tsx` sigue siendo válido como primera pantalla informativa
antes de intentar montar el wizard.

- [ ] **Step 2: Confirmar que `load()` sigue funcionando como callback de refresco**

`onOpened={() => load()}` ignora el turno recién abierto que devuelve el wizard y
simplemente recarga todo desde `CajaTurno`'s `load()` (que ya hace el `SELECT` de
`turnos` con `estado = 'abierto'`). Esto es intencional — `CajaTurno.tsx` no usa el
`TurnoContext` de `TurnoGuard`, maneja su propio estado vía `load()`.

- [ ] **Step 3: `tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sin errores (confirma que no quedaron referencias colgantes a `cajaId`,
`montoApertura`, `notas`, `abrirTurno`, `onCajaChange` eliminados).

- [ ] **Step 4: Verificación manual**

Turno de Caja (caja general, no farmacia) → sin turno abierto → debe mostrar el wizard
de conteo ciego (mismo flujo que ya se usa en farmacia): paso conteo → paso diff vs Z
anterior → confirmar → abre turno. Ya no debe mostrar el fondo por defecto
pre-cargado antes de contar.

- [ ] **Step 5: Commit**

```bash
git add src/pages/CajaTurno.tsx
git commit -m "feat: caja general usa conteo ciego de apertura (TurnoOpenWizard) en vez de formulario directo"
```

---

### Task 8: Límite de efectivo configurable (gap 5)

**Files:**
- Modify: `src/pages/ajustes/sections/finance.tsx` (`SectionCaja`, `CajaForm`)
- Modify: `src/pages/CajaTurno.tsx` (banner de alerta)
- Modify: `src/features/farmacia/ShiftPanel.tsx` (banner de alerta)

No requiere migración — reusa `clinic_settings` (`section='caja'`), mismo patrón que
`umbral_diferencia`.

**Interfaces:**
- Produces: nueva key `limite_efectivo` (string numérico, igual formato que
  `umbral_diferencia`) dentro de `clinic_settings.data` para `section = 'caja'`.

- [ ] **Step 1: Agregar el campo a `CajaForm` en `finance.tsx`**

```tsx
// src/pages/ajustes/sections/finance.tsx
interface CajaForm {
  umbral_diferencia: string;
  fondo_minimo: string;
  limite_efectivo: string;
  requiere_conteo_ciego: boolean;
  permite_venta_sin_turno: boolean;
}

const CAJA_DEFAULTS: CajaForm = {
  umbral_diferencia: "",
  fondo_minimo: "",
  limite_efectivo: "",
  requiere_conteo_ciego: true,
  permite_venta_sin_turno: false,
};
```

Y agregar el `Field` dentro de la card "Controles de diferencia de caja" (junto a
`umbral_diferencia` y `fondo_minimo`, cambiando el grid a 3 columnas):

```tsx
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Umbral de diferencia (MXN)" hint="Diferencia |faltante/sobrante| que activa autorización. Vacío = sin límite.">
            <MoneyInput
              placeholder="Sin límite"
              value={form.umbral_diferencia}
              onValueChange={(raw) => { setField("umbral_diferencia", raw); onChange(); }}
              disabled={readOnly}
            />
          </Field>
          <Field label="Fondo mínimo de caja (MXN)" hint="Aviso al abrir turno si el fondo es menor a este valor.">
            <MoneyInput
              placeholder="Sin mínimo"
              value={form.fondo_minimo}
              onValueChange={(raw) => { setField("fondo_minimo", raw); onChange(); }}
              disabled={readOnly}
            />
          </Field>
          <Field label="Límite de efectivo en caja (MXN)" hint="Alerta (no bloquea) cuando el efectivo esperado supera este valor.">
            <MoneyInput
              placeholder="Sin límite"
              value={form.limite_efectivo}
              onValueChange={(raw) => { setField("limite_efectivo", raw); onChange(); }}
              disabled={readOnly}
            />
          </Field>
        </CardContent>
```

- [ ] **Step 2: Extraer helper puro `exceedsLimiteEfectivo` (testeable)**

```ts
// src/lib/cajaLimits.ts
export function exceedsLimiteEfectivo(
  efectivoEsperado: number,
  limiteEfectivo: string | null | undefined,
): boolean {
  if (!limiteEfectivo || limiteEfectivo.trim() === "") return false;
  const limite = Number(limiteEfectivo);
  if (!Number.isFinite(limite) || limite <= 0) return false;
  return efectivoEsperado > limite;
}
```

- [ ] **Step 3: Test del helper**

```ts
// src/lib/cajaLimits.test.ts
import { describe, it, expect } from "vitest";
import { exceedsLimiteEfectivo } from "./cajaLimits";

describe("exceedsLimiteEfectivo", () => {
  it("returns false when limite is empty", () => {
    expect(exceedsLimiteEfectivo(5000, "")).toBe(false);
    expect(exceedsLimiteEfectivo(5000, null)).toBe(false);
    expect(exceedsLimiteEfectivo(5000, undefined)).toBe(false);
  });

  it("returns false when efectivo is below limite", () => {
    expect(exceedsLimiteEfectivo(3000, "5000")).toBe(false);
  });

  it("returns true when efectivo exceeds limite", () => {
    expect(exceedsLimiteEfectivo(6000, "5000")).toBe(true);
  });

  it("returns false when efectivo equals limite exactly", () => {
    expect(exceedsLimiteEfectivo(5000, "5000")).toBe(false);
  });

  it("returns false for non-numeric limite", () => {
    expect(exceedsLimiteEfectivo(6000, "abc")).toBe(false);
  });
});
```

- [ ] **Step 4: Correr el test**

Run: `npx vitest run src/lib/cajaLimits.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Banner de alerta en `CajaTurno.tsx`**

Cargar `clinic_settings` (`section='caja'`) al inicio de `load()` y calcular el
efectivo esperado disponible (`turnoActivo.monto_apertura` + suma de
`fondos_movimientos` netos del turno, ya presente en el estado `fondos`). Agregar
dentro del bloque `turnoActivo ? (...)`, antes de los botones de acción:

```tsx
          {(() => {
            const netoFondos = fondos.reduce((s, f) => s + (f.tipo === "ingreso" ? f.monto : -f.monto), 0);
            const efectivoAprox = turnoActivo.monto_apertura + netoFondos;
            return exceedsLimiteEfectivo(efectivoAprox, limiteEfectivo) ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Efectivo en caja (~{fmt(efectivoAprox)}) supera el límite configurado — considera un cash drop.</span>
              </div>
            ) : null;
          })()}
```

Agregar el estado `limiteEfectivo` y cargarlo en `load()`:

```tsx
  const [limiteEfectivo, setLimiteEfectivo] = useState<string>("");
```

Dentro de `load()`, junto a las otras queries en `Promise.all`:

```tsx
    const { data: settingsData } = await (supabase as any)
      .from("clinic_settings")
      .select("data")
      .eq("clinic_id", activeClinic.id)
      .eq("section", "caja")
      .maybeSingle();
    setLimiteEfectivo(settingsData?.data?.limite_efectivo ?? "");
```

Import a agregar: `import { exceedsLimiteEfectivo } from "@/lib/cajaLimits";`

- [ ] **Step 6: Mismo banner en `ShiftPanel.tsx`**

Replicar el mismo patrón: cargar `clinic_settings` (`section='caja'`) al montar,
calcular efectivo aproximado del shift activo (`shift.opening_amount` + netos de
`fondos_movimientos` del shift), mostrar el mismo banner con `exceedsLimiteEfectivo`.
Ubicar el punto de carga junto a donde `ShiftPanel.tsx` ya carga el shift activo (buscar
la función que hace `fetchCurrentShift` o equivalente al inicio del archivo).

- [ ] **Step 7: `tsc --noEmit`**

Run: `npx tsc --noEmit`

- [ ] **Step 8: Verificación manual**

Ajustes → Caja y Corte → configurar "Límite de efectivo en caja" a un valor bajo (ej.
$100) → guardar → ir a Turno de Caja con turno abierto y fondo mayor a $100 → debe
mostrar el banner de alerta.

- [ ] **Step 9: Commit**

```bash
git add src/pages/ajustes/sections/finance.tsx src/lib/cajaLimits.ts src/lib/cajaLimits.test.ts src/pages/CajaTurno.tsx src/features/farmacia/ShiftPanel.tsx
git commit -m "feat: límite de efectivo configurable con alerta no bloqueante"
```

---

### Task 9: Verificación final integrada

**Files:** ninguno (solo verificación, sin código nuevo).

- [ ] **Step 1: Suite completa**

Run: `npm run test`
Expected: todos los tests en verde, incluyendo `src/lib/cajaLimits.test.ts` nuevo.

- [ ] **Step 2: Type check completo**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Build de producción**

Run: `npm run build:all`
Expected: build completo sin errores (incluye Docusaurus del manual — no solo `vite build`).

- [ ] **Step 4: `get_advisors` de seguridad (regla del proyecto para funciones `SECURITY DEFINER` nuevas)**

Con el MCP de supabase autenticado y confirmado apuntando a `kyfkvdyxpvpiacyymldc`:

```
mcp__supabase__get_advisors(type="security")
```

Expected: sin hallazgos nuevos de severidad alta relacionados a
`verify_supervisor_pin`, `turno_open`, `pharmacy_register_return`,
`turno_fondo_movimiento`, `pharmacy_fondo_movimiento`, `turno_close` — todas deben
tener `search_path` fijo y `REVOKE ... FROM PUBLIC` + `GRANT ... TO authenticated`
explícito (ya incluido en cada migración de este plan).

- [ ] **Step 5: Recorrido manual end-to-end (checklist)**

1. Abrir turno general con diferencia vs Z anterior sin notas → rechazado. Con notas → abre, folio de apertura visible.
2. Registrar cash drop sin PIN correcto → rechazado. Con PIN → registrado con destino.
3. Devolución en farmacia sin PIN de supervisor → no se puede enviar (el diálogo lo exige). Con PIN → `authorized_by` = supervisor, no el cajero.
4. Cerrar turno con diferencia y notas vacías → rechazado con mensaje claro. Con notas → cierra, folio Z correlativo.
5. Configurar límite de efectivo bajo → banner de alerta aparece en Turno de Caja y en Farmacia.

- [ ] **Step 6: Actualizar `memoria/STATE.md`**

Mover el punto 3 ("los 4 puntos") a completado, documentar los 6 gaps cerrados con
referencia a este plan y al spec. Seguir el checklist de la skill `session-sync` antes
de cerrar la sesión.

- [ ] **Step 7: Commit final de documentación**

```bash
git add memoria/STATE.md
git commit -m "docs: cierra sesion - corte de caja gaps reales (6/6) implementados"
```
