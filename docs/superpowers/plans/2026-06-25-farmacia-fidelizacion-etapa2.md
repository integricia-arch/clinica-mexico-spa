# Farmacia Fidelización Etapa 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar el módulo de fidelización a producción: descuento real en POS, idempotencia en RPC, páginas ARCO en PWA e ícono definitivo.

**Architecture:** Campo `loyalty_discount` nuevo en `pharmacy_sales` trazabiliza el descuento por puntos separado del descuento manual. `PuntoDeVenta.tsx` deriva `totalConLealtad = max(0, total - loyaltyDescuento)` y lo usa en validación de pago, payload RPC y UI. Las páginas ARCO son rutas React dentro del PWA `LoyaltyApp`.

**Tech Stack:** React 18 + TypeScript + Vite + Supabase (PostgreSQL + Edge Functions Deno) + Cloudflare Workers + Resend (email) + sharp (icon PNG generation)

## Global Constraints

- Migraciones con timestamp `20260625000007`–`20260625000009`, prefijo `20260625`
- `supabase db push --linked --include-all` (learnings: `--include-all` requerido para timestamps fuera de orden)
- Todas las RPCs SECURITY DEFINER con `SET search_path = public`
- `bun run build` para build, `wrangler deploy` para deploy Cloudflare Workers
- `supabase functions deploy <nombre>` para edge functions
- Test runner: `bun run test` (Vitest)
- No `console.log` en código de producción
- Immutability: spread operator, no mutación directa de state

---

## File Map

| Archivo | Acción | Tarea |
|---------|--------|-------|
| `supabase/migrations/20260625000007_loyalty_discount_column.sql` | crear | 1 |
| `supabase/migrations/20260625000008_loyalty_register_sale_idempotent.sql` | crear | 2 |
| `supabase/migrations/20260625000009_pharmacy_register_sale_loyalty_discount.sql` | crear | 3 |
| `src/features/farmacia/PuntoDeVenta.tsx` | modificar | 4 |
| `src/features/farmacia/TicketInterno.tsx` | modificar | 4 |
| `src/pwa/pages/PrivacidadPage.tsx` | crear | 5 |
| `src/pwa/pages/ArcoPage.tsx` | crear | 5 |
| `src/pwa/LoyaltyApp.tsx` | modificar | 5 |
| `supabase/functions/loyalty-arco-request/index.ts` | crear | 6 |
| `supabase/config.toml` | modificar | 6 |
| `scripts/generate-loyalty-icon.mjs` | crear | 7 |
| `public/icons/loyalty-192.png` | regenerar | 7 |
| `public/icons/loyalty-512.png` | crear | 7 |
| `src/test/lealtad/loyalty-discount-pos.test.ts` | crear | 8 |

---

### Task 1: Migración — `pharmacy_sales.loyalty_discount` column

**Files:**
- Create: `supabase/migrations/20260625000007_loyalty_discount_column.sql`

**Interfaces:**
- Produces: columna `pharmacy_sales.loyalty_discount numeric(12,2) NOT NULL DEFAULT 0` disponible para Task 3

- [ ] **Step 1: Crear archivo de migración**

```sql
-- supabase/migrations/20260625000007_loyalty_discount_column.sql
-- Agrega columna loyalty_discount a pharmacy_sales para trazabilidad
-- del descuento por puntos canjeados, separado del descuento manual (discount).
ALTER TABLE public.pharmacy_sales
  ADD COLUMN IF NOT EXISTS loyalty_discount numeric(12,2) NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Verificar que la migración es válida localmente**

```bash
supabase db diff --linked
```

Expected: muestra `ALTER TABLE pharmacy_sales ADD COLUMN loyalty_discount`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260625000007_loyalty_discount_column.sql
git commit -m "feat: add loyalty_discount column to pharmacy_sales"
```

---

### Task 2: Migración — `loyalty_register_sale` idempotency guard

**Files:**
- Create: `supabase/migrations/20260625000008_loyalty_register_sale_idempotent.sql`

**Interfaces:**
- Consumes: función `loyalty_register_sale(p_sale_id uuid, p_member_id uuid, p_clinic_id uuid)` existente (definida en `20260624000002_loyalty_rpcs.sql`)
- Produces: misma firma, nueva respuesta `{ ok: true, puntos_ganados: 0, idempotent: true }` en segunda llamada con mismo `p_sale_id`

- [ ] **Step 1: Crear migración con la función completa + guard**

```sql
-- supabase/migrations/20260625000008_loyalty_register_sale_idempotent.sql
-- Agrega idempotency guard: si ya existe movimiento de acumulación para
-- esta pharmacy_sale_id, retorna ok:true sin duplicar puntos.
CREATE OR REPLACE FUNCTION loyalty_register_sale(
  p_sale_id   uuid,
  p_member_id uuid,
  p_clinic_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg              loyalty_config%ROWTYPE;
  v_member           loyalty_members%ROWTYPE;
  v_sale_total       numeric;
  v_sale_clinic_id   uuid;
  v_multiplicador    numeric := 1.0;
  v_puntos_ganados   integer;
  v_saldo_nuevo      integer;
  v_nivel_nuevo      text;
BEGIN
  -- Idempotency guard: si ya existe un movimiento de acumulación para
  -- esta venta, retornar éxito sin duplicar puntos.
  IF EXISTS (
    SELECT 1 FROM loyalty_movimientos
     WHERE pharmacy_sale_id = p_sale_id
       AND tipo = 'acumulacion'
  ) THEN
    SELECT puntos_disponibles, nivel
      INTO v_saldo_nuevo, v_nivel_nuevo
      FROM loyalty_members WHERE id = p_member_id;
    RETURN json_build_object(
      'ok', true,
      'puntos_ganados', 0,
      'saldo_nuevo', v_saldo_nuevo,
      'nivel', v_nivel_nuevo,
      'idempotent', true
    );
  END IF;

  -- Config del programa
  SELECT * INTO v_cfg FROM loyalty_config
   WHERE clinic_id = p_clinic_id AND programa_activo = true;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'programa_inactivo');
  END IF;

  -- Miembro activo
  SELECT * INTO v_member FROM loyalty_members
   WHERE id = p_member_id AND clinic_id = p_clinic_id AND activo = true;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'miembro_no_encontrado');
  END IF;

  -- Gate R1-4: leer total Y clinic_id juntos para verificar propiedad de la venta
  SELECT ps.total, ps.clinic_id INTO v_sale_total, v_sale_clinic_id
    FROM pharmacy_sales ps WHERE ps.id = p_sale_id;
  IF NOT FOUND OR v_sale_total IS NULL OR v_sale_total <= 0 THEN
    RETURN json_build_object('ok', false, 'error', 'venta_invalida');
  END IF;
  -- Cross-clinic security: la venta debe pertenecer a la misma clínica
  IF v_sale_clinic_id != p_clinic_id THEN
    RETURN json_build_object('ok', false, 'error', 'sale_clinic_mismatch');
  END IF;

  -- Multiplicador por nivel
  v_multiplicador := CASE v_member.nivel
    WHEN 'diamante' THEN v_cfg.multiplicador_diamante
    WHEN 'oro'      THEN v_cfg.multiplicador_oro
    WHEN 'plata'    THEN v_cfg.multiplicador_plata
    ELSE 1.0
  END;

  -- Calcular puntos (truncar hacia abajo)
  v_puntos_ganados := FLOOR((v_sale_total / v_cfg.pesos_por_punto) * v_multiplicador);

  IF v_puntos_ganados <= 0 THEN
    RETURN json_build_object('ok', true, 'puntos_ganados', 0,
      'saldo_nuevo', v_member.puntos_disponibles, 'nivel', v_member.nivel);
  END IF;

  -- Actualizar saldo (atómico)
  UPDATE loyalty_members
     SET puntos_disponibles          = puntos_disponibles + v_puntos_ganados,
         puntos_acumulados_historico = puntos_acumulados_historico + v_puntos_ganados
   WHERE id = p_member_id
   RETURNING puntos_disponibles INTO v_saldo_nuevo;

  -- Insertar movimiento
  INSERT INTO loyalty_movimientos
    (clinic_id, member_id, tipo, puntos, saldo_post, pharmacy_sale_id, descripcion)
  VALUES
    (p_clinic_id, p_member_id, 'acumulacion', v_puntos_ganados, v_saldo_nuevo,
     p_sale_id, 'Compra registrada');

  -- Recalcular nivel
  v_nivel_nuevo := loyalty_recalculate_level(p_member_id);

  RETURN json_build_object(
    'ok', true,
    'puntos_ganados', v_puntos_ganados,
    'saldo_nuevo', v_saldo_nuevo,
    'nivel', v_nivel_nuevo
  );
END;
$$;

-- Permisos sin cambio — solo authenticated puede llamar esta función
GRANT EXECUTE ON FUNCTION loyalty_register_sale(uuid,uuid,uuid) TO authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260625000008_loyalty_register_sale_idempotent.sql
git commit -m "feat: add idempotency guard to loyalty_register_sale RPC"
```

---

### Task 3: Migración — `pharmacy_register_sale` lee y persiste `loyalty_discount`

**Files:**
- Create: `supabase/migrations/20260625000009_pharmacy_register_sale_loyalty_discount.sql`

**Interfaces:**
- Consumes: `pharmacy_sales.loyalty_discount` (Task 1)
- Produces: `pharmacy_register_sale(p_payload jsonb)` acepta `p_payload->>'loyalty_discount'` y lo persiste; `pharmacy_sales.total` refleja `subtotal - discount - loyalty_discount`

- [ ] **Step 1: Crear migración con CREATE OR REPLACE completo**

```sql
-- supabase/migrations/20260625000009_pharmacy_register_sale_loyalty_discount.sql
-- Actualiza pharmacy_register_sale para leer y persistir loyalty_discount del payload.
-- total = subtotal - discount - loyalty_discount

BEGIN;

CREATE OR REPLACE FUNCTION public.pharmacy_register_sale(p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_clinic uuid;
  v_sale_id uuid;
  v_sale_type text := p_payload->>'sale_type';
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := COALESCE((p_payload->>'discount')::numeric, 0);
  v_loyalty_discount numeric(12,2) := COALESCE((p_payload->>'loyalty_discount')::numeric, 0);
  v_total numeric(12,2);
  v_item jsonb;
  v_med record;
  v_lote record;
  v_pick_lote uuid;
  v_oldest_lote uuid;
  v_qty int;
  v_unit numeric(10,2);
  v_idisc numeric(10,2);
  v_isubtotal numeric(12,2);
  v_mov_type public.movimiento_tipo;
  v_override_reason text;
  v_shift_id uuid;
  v_override_no_shift boolean := COALESCE((p_payload->>'override_no_shift')::boolean, false);
  v_override_no_shift_reason text := p_payload->>'override_no_shift_reason';
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT (public.has_role(v_user,'admin') OR public.has_role(v_user,'nurse') OR public.has_role(v_user,'receptionist') OR public.has_role(v_user,'manager')) THEN
    RAISE EXCEPTION 'Permisos insuficientes para registrar venta';
  END IF;

  IF v_sale_type NOT IN ('direct_sale','prescription_dispense') THEN
    RAISE EXCEPTION 'sale_type inválido';
  END IF;

  IF jsonb_array_length(COALESCE(p_payload->'items','[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'La venta debe tener al menos un artículo';
  END IF;

  v_clinic := COALESCE(
    (SELECT clinic_id FROM public.patients WHERE id = NULLIF(p_payload->>'patient_id','')::uuid),
    (SELECT clinic_id FROM public.medicamentos WHERE id = (((p_payload->'items')->0)->>'medicamento_id')::uuid),
    '106cc686-a333-4ec1-83ea-84eaafbf2e90'::uuid
  );

  v_mov_type := CASE WHEN v_sale_type = 'direct_sale'
                     THEN 'salida_venta'::public.movimiento_tipo
                     ELSE 'salida_surtido_receta'::public.movimiento_tipo END;

  -- Resolver turno actual del cajero
  SELECT id INTO v_shift_id
    FROM public.pharmacy_cash_shifts
   WHERE cashier_user_id = v_user
     AND clinic_id = v_clinic
     AND status = 'open'
   ORDER BY opened_at DESC LIMIT 1;

  IF v_shift_id IS NULL THEN
    IF v_override_no_shift AND (public.has_role(v_user,'admin') OR public.has_role(v_user,'manager')) THEN
      IF v_override_no_shift_reason IS NULL OR length(trim(v_override_no_shift_reason)) = 0 THEN
        RAISE EXCEPTION 'Venta sin turno requiere motivo de override';
      END IF;
      INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
      VALUES (v_user, 'crear', 'pharmacy_sales', NULL,
              jsonb_build_object('event','venta_sin_turno_override','reason',v_override_no_shift_reason), v_clinic);
    ELSE
      RAISE EXCEPTION 'Debe abrir turno antes de vender.';
    END IF;
  END IF;

  -- Pre-lock todos los lotes en orden determinístico (ORDER BY id) para evitar deadlock.
  PERFORM id FROM public.lotes_medicamento
    WHERE id IN (
      SELECT COALESCE(
        NULLIF(v_item->>'lote_id', '')::uuid,
        (SELECT id FROM public.lotes_medicamento lm2
         WHERE lm2.medicamento_id = (v_item->>'medicamento_id')::uuid
           AND lm2.existencia >= COALESCE((v_item->>'quantity')::int, 1)
           AND lm2.fecha_caducidad >= CURRENT_DATE
         ORDER BY lm2.fecha_entrada ASC, lm2.fecha_caducidad ASC, lm2.id ASC LIMIT 1)
      )
      FROM jsonb_array_elements(p_payload->'items') v_item
    )
  ORDER BY id
  FOR UPDATE;

  -- Validación de items y stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items') LOOP
    SELECT * INTO v_med FROM public.medicamentos WHERE id = (v_item->>'medicamento_id')::uuid;
    IF v_med IS NULL THEN RAISE EXCEPTION 'Medicamento no encontrado'; END IF;
    IF v_med.activo = false THEN RAISE EXCEPTION 'Medicamento % está inactivo', v_med.nombre; END IF;

    v_qty := (v_item->>'quantity')::int;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Cantidad inválida para %', v_med.nombre; END IF;

    IF v_sale_type = 'direct_sale' THEN
      IF v_med.is_controlled = true THEN
        INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
        VALUES (v_user, 'crear', 'pharmacy_sales', NULL,
                jsonb_build_object('event','blocked_controlled','medicamento_id',v_med.id), v_clinic);
        RAISE EXCEPTION 'Medicamento sujeto a control sanitario. Requiere validación regulatoria y receta correspondiente.';
      END IF;
      IF v_med.requires_prescription = true OR v_med.allow_direct_sale = false THEN
        INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
        VALUES (v_user, 'crear', 'pharmacy_sales', NULL,
                jsonb_build_object('event','blocked_prescription_required','medicamento_id',v_med.id), v_clinic);
        RAISE EXCEPTION 'Este medicamento requiere receta médica para su venta.';
      END IF;
    END IF;

    v_pick_lote := NULLIF(v_item->>'lote_id','')::uuid;
    SELECT id INTO v_oldest_lote
      FROM public.lotes_medicamento
     WHERE medicamento_id = v_med.id AND existencia >= v_qty AND fecha_caducidad >= CURRENT_DATE
     ORDER BY fecha_entrada ASC, fecha_caducidad ASC, id ASC LIMIT 1;

    IF v_pick_lote IS NULL THEN
      v_pick_lote := v_oldest_lote;
    ELSE
      IF v_oldest_lote IS NOT NULL AND v_pick_lote <> v_oldest_lote THEN
        v_override_reason := v_item->>'override_reason';
        IF v_override_reason IS NULL OR length(trim(v_override_reason)) = 0 THEN
          RAISE EXCEPTION 'Cambio manual de lote requiere motivo (override_reason)';
        END IF;
      END IF;
    END IF;

    IF v_pick_lote IS NULL THEN
      RAISE EXCEPTION 'Sin existencia disponible para %', v_med.nombre;
    END IF;

    SELECT * INTO v_lote FROM public.lotes_medicamento WHERE id = v_pick_lote FOR UPDATE;
    IF v_lote.fecha_caducidad < CURRENT_DATE THEN
      RAISE EXCEPTION 'No se puede vender lote vencido (% / %)', v_med.nombre, v_lote.numero_lote;
    END IF;
    IF v_lote.existencia < v_qty THEN
      RAISE EXCEPTION 'Existencia insuficiente en lote % de %', v_lote.numero_lote, v_med.nombre;
    END IF;
  END LOOP;

  INSERT INTO public.pharmacy_sales
    (clinic_id, patient_id, customer_name, prescription_id, sale_type,
     status, payment_method, payment_status, requires_invoice, notes,
     discount, loyalty_discount, created_by, shift_id)
  VALUES
    (v_clinic,
     NULLIF(p_payload->>'patient_id','')::uuid,
     COALESCE(NULLIF(p_payload->>'customer_name',''), 'Público general'),
     NULLIF(p_payload->>'prescription_id','')::uuid,
     v_sale_type,
     'completed',
     p_payload->>'payment_method',
     COALESCE(p_payload->>'payment_status','paid'),
     COALESCE((p_payload->>'requires_invoice')::boolean, false),
     p_payload->>'notes',
     v_discount,
     v_loyalty_discount,
     v_user,
     v_shift_id)
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items') LOOP
    SELECT * INTO v_med FROM public.medicamentos WHERE id = (v_item->>'medicamento_id')::uuid;
    v_qty := (v_item->>'quantity')::int;
    v_unit := COALESCE(NULLIF(v_item->>'unit_price','')::numeric, v_med.precio_unitario);
    v_idisc := COALESCE(NULLIF(v_item->>'discount','')::numeric, 0);
    v_isubtotal := (v_qty * v_unit) - v_idisc;

    v_pick_lote := NULLIF(v_item->>'lote_id','')::uuid;
    IF v_pick_lote IS NULL THEN
      SELECT id INTO v_pick_lote
        FROM public.lotes_medicamento
       WHERE medicamento_id = v_med.id AND existencia >= v_qty AND fecha_caducidad >= CURRENT_DATE
       ORDER BY fecha_entrada ASC, fecha_caducidad ASC, id ASC LIMIT 1;
    END IF;

    UPDATE public.lotes_medicamento SET existencia = existencia - v_qty WHERE id = v_pick_lote;

    INSERT INTO public.pharmacy_sale_items
      (sale_id, clinic_id, medicamento_id, lote_id, prescription_item_id,
       quantity, unit_price, discount, subtotal)
    VALUES
      (v_sale_id, v_clinic, v_med.id, v_pick_lote,
       NULLIF(v_item->>'prescription_item_id','')::uuid,
       v_qty, v_unit, v_idisc, v_isubtotal);

    INSERT INTO public.movimientos_inventario
      (medicamento_id, lote_id, tipo, cantidad, motivo,
       user_id, clinic_id, reference_type, reference_id)
    VALUES
      (v_med.id, v_pick_lote, v_mov_type, v_qty,
       CASE WHEN v_sale_type='direct_sale' THEN 'Venta directa' ELSE 'Surtido de receta' END,
       v_user, v_clinic, 'pharmacy_sale', v_sale_id);

    v_subtotal := v_subtotal + (v_qty * v_unit);
  END LOOP;

  -- total incluye descuento manual y descuento por lealtad
  v_total := v_subtotal - v_discount - v_loyalty_discount;

  UPDATE public.pharmacy_sales SET subtotal = v_subtotal, total = v_total WHERE id = v_sale_id;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'crear', 'pharmacy_sales', v_sale_id,
          jsonb_build_object('event','pharmacy_sale_created','sale_type',v_sale_type,
                             'total',v_total,'items',jsonb_array_length(p_payload->'items'),
                             'shift_id', v_shift_id, 'loyalty_discount', v_loyalty_discount),
          v_clinic);

  RETURN v_sale_id;
END;
$function$;

COMMIT;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260625000009_pharmacy_register_sale_loyalty_discount.sql
git commit -m "feat: pharmacy_register_sale persists loyalty_discount — total = subtotal - discount - loyalty_discount"
```

---

### Task 4: `PuntoDeVenta.tsx` + `TicketInterno.tsx` — `totalConLealtad`

**Files:**
- Modify: `src/features/farmacia/PuntoDeVenta.tsx`
- Modify: `src/features/farmacia/TicketInterno.tsx`

**Interfaces:**
- Consumes: `loyaltyDescuento: number` (estado existente, line 194), `total: number` (line 432)
- Produces: `totalConLealtad` usado en validación, payload, UI, y ticket

- [ ] **Step 1: Agregar campo `descuentoLealtad` a `TicketData` en `TicketInterno.tsx`**

En `src/features/farmacia/TicketInterno.tsx`, en el tipo `TicketData` (línea 29–46), agregar el campo opcional:

```typescript
export type TicketData = {
  folio: string;
  fecha: Date;
  cajero: string;
  clinica: string;
  cliente: string;
  paciente?: string | null;
  recetaFolio?: string | null;
  metodoPago: string;
  payments?: TicketPaymentLine[];
  items: { nombre: string; cantidad: number; precio: number }[];
  subtotal: number;
  descuento: number;
  descuentoLealtad?: number;   // ← NUEVO
  total: number;
  totalIva?: number;
  baseGravable?: number;
  exento?: number;
};
```

- [ ] **Step 2: Renderizar descuento lealtad en el ticket**

En `TicketInterno.tsx`, en el bloque donde se muestran subtotal, descuento y total (línea 96–104):

```tsx
{data.descuento > 0 && (
  <>
    <div className="flex justify-between text-muted-foreground">
      <span>Subtotal</span><span>{formatMXN(data.subtotal)}</span>
    </div>
    <div className="flex justify-between">
      <span>Descuento</span><span>-{formatMXN(data.descuento)}</span>
    </div>
  </>
)}
{data.descuentoLealtad != null && data.descuentoLealtad > 0 && (
  <div className="flex justify-between text-teal-700 dark:text-teal-400">
    <span>Descuento lealtad</span><span>-{formatMXN(data.descuentoLealtad)}</span>
  </div>
)}
<div className="flex justify-between font-bold border-t border-dashed pt-1">
  <span>Total</span><span>{formatMXN(data.total)}</span>
</div>
```

- [ ] **Step 3: Derivar `totalConLealtad` en `PuntoDeVenta.tsx`**

Después de la línea 432 (`const total = Math.max(0, subtotal - itemsDiscount - globalDiscount);`), agregar:

```typescript
const totalConLealtad = Math.max(0, total - loyaltyDescuento)
```

- [ ] **Step 4: Actualizar `useEffect` de breakdown (líneas 454–463)**

Cambiar todas las referencias a `total` por `totalConLealtad` dentro del `useEffect` que sincroniza los montos de pago:

```typescript
useEffect(() => {
  setBreakdown((bd) => {
    if (payment === "efectivo") return { ...bd, efectivo: totalConLealtad, monto_recibido: totalConLealtad, tarjeta: 0, transferencia: 0, card: { ...bd.card, amount: 0 }, transfer: { ...bd.transfer, amount: 0 } };
    if (payment === "tarjeta") return { ...bd, efectivo: 0, tarjeta: totalConLealtad, transferencia: 0, card: { ...bd.card, amount: totalConLealtad }, transfer: { ...bd.transfer, amount: 0 } };
    if (payment === "transferencia") return { ...bd, efectivo: 0, tarjeta: 0, transferencia: totalConLealtad, card: { ...bd.card, amount: 0 }, transfer: { ...bd.transfer, amount: totalConLealtad } };
    if (payment === "pendiente") return { ...bd, efectivo: 0, tarjeta: 0, transferencia: 0, card: { ...bd.card, amount: 0 }, transfer: { ...bd.transfer, amount: 0 } };
    return { ...bd, efectivo: 0, monto_recibido: 0, tarjeta: 0, transferencia: 0, card: { ...bd.card, amount: 0 }, transfer: { ...bd.transfer, amount: 0 } };
  });
}, [payment, totalConLealtad]);
```

- [ ] **Step 5: Actualizar `submitSale` — `validatePayment` y payload**

En `submitSale` (línea 466+):

Línea 485 — cambiar `total` por `totalConLealtad`:
```typescript
const v = validatePayment(payment, totalConLealtad, bd);
```

En el payload (línea 493–511), agregar `loyalty_discount` después de `discount`:
```typescript
const payload = {
  clinic_id: activeClinicId,
  sale_type: rxMeds.length > 0 ? "prescription_dispense" : "direct_sale",
  receta_capturada: false,
  patient_id: clienteTipo === "paciente" ? patientId || null : null,
  customer_name: clienteTipo === "publico" ? (customerName || "Público general") : null,
  payment_method: payment,
  payment_status: payment === "pendiente" ? "pending" : "paid",
  requires_invoice: requiresInvoice,
  notes: notes || null,
  discount: globalDiscount,
  loyalty_discount: loyaltyDescuento,   // ← NUEVO
  items: cart.map((c) => ({
    medicamento_id: c.med.id,
    lote_id: c.lote.id,
    quantity: c.quantity,
    unit_price: c.unit_price,
    discount: c.discount,
  })),
};
```

- [ ] **Step 6: Actualizar `setTicketData` (línea 615–626)**

```typescript
setTicketData({
  folio: String(saleId).slice(0, 12).toUpperCase(),
  fecha: new Date(),
  cajero: cajeroNombre,
  clinica: activeClinic?.name ?? "Clínica",
  cliente: clienteTipo === "publico" ? (customerName || "Público general") : (patientSearch || "Paciente"),
  paciente: clienteTipo === "paciente" ? patientSearch : null,
  metodoPago: PAYMENT_LABEL[payment],
  payments: ticketPayments,
  items: cart.map((c) => ({ nombre: c.med.nombre, cantidad: c.quantity, precio: c.unit_price })),
  subtotal,
  descuento: itemsDiscount + globalDiscount,
  descuentoLealtad: loyaltyDescuento > 0 ? loyaltyDescuento : undefined,  // ← NUEVO
  total: totalConLealtad,   // ← era `total`
  totalIva, baseGravable, exento,
});
```

- [ ] **Step 7: Actualizar UI — Total visible y botón Cobrar**

Línea 1025 — `<span>Total</span><span>{formatMXN(total)}</span>`:
```tsx
<div className="flex justify-between font-semibold text-base">
  <span>Total</span><span>{formatMXN(totalConLealtad)}</span>
</div>
```

Si `loyaltyDescuento > 0`, mostrar línea de descuento lealtad encima. Reemplazar el bloque lines 1024–1025:
```tsx
{loyaltyDescuento > 0 && (
  <div className="flex justify-between text-sm text-teal-700 dark:text-teal-400">
    <span>Desc. lealtad</span><span>-{formatMXN(loyaltyDescuento)}</span>
  </div>
)}
<div className="flex justify-between font-semibold text-base">
  <span>Total</span><span>{formatMXN(totalConLealtad)}</span>
</div>
```

Línea 1076 — botón Cobrar:
```tsx
{submitting ? "Registrando…" : `Cobrar ${formatMXN(totalConLealtad)}`}
```

- [ ] **Step 8: Resetear `loyaltyDescuento` al limpiar miembro y al limpiar carrito**

Línea 1036 — callback `onMemberSelected`:
```tsx
onMemberSelected={m => {
  setLoyaltyMemberId(m?.id ?? null)
  if (!m) setLoyaltyDescuento(0)
}}
```

En el reset después de venta exitosa (línea ~629–636), agregar junto a los otros resets:
```typescript
setLoyaltyDescuento(0);
setLoyaltyMemberId(null);
```

Línea 1035 — pasar `totalConLealtad` como `totalVenta` al LoyaltyPanel:
```tsx
totalVenta={totalConLealtad}
```

- [ ] **Step 9: Verificar que TypeScript compila sin errores**

```bash
npx tsc --noEmit
```

Expected: 0 errores.

- [ ] **Step 10: Commit**

```bash
git add src/features/farmacia/PuntoDeVenta.tsx src/features/farmacia/TicketInterno.tsx
git commit -m "feat: apply loyalty discount to POS total — totalConLealtad, ticket descuentoLealtad"
```

---

### Task 5: PWA — Páginas ARCO + rutas en `LoyaltyApp.tsx`

**Files:**
- Create: `src/pwa/pages/PrivacidadPage.tsx`
- Create: `src/pwa/pages/ArcoPage.tsx`
- Modify: `src/pwa/LoyaltyApp.tsx`

**Interfaces:**
- Consumes: `supabase.functions.invoke('loyalty-arco-request', { body })` (Task 6)
- Produces: rutas `/aviso-privacidad` y `/solicitud-arco` disponibles en `LoyaltyApp`

- [ ] **Step 1: Crear `PrivacidadPage.tsx`**

```typescript
// src/pwa/pages/PrivacidadPage.tsx
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { motion } from 'motion/react'

export function PrivacidadPage() {
  const navigate = useNavigate()

  return (
    <div className="pb-24 px-4 pt-4 space-y-6 max-w-md mx-auto">
      <motion.button
        className="flex items-center gap-2 text-sm text-muted-foreground"
        onClick={() => navigate(-1)}
        whileTap={{ scale: 0.95 }}
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </motion.button>

      <h1 className="text-xl font-bold">Aviso de Privacidad</h1>
      <p className="text-xs text-muted-foreground">Última actualización: junio 2026</p>

      <section className="space-y-3 text-sm">
        <h2 className="font-semibold">Responsable del tratamiento</h2>
        <p>
          Integrika S.A. de C.V. (en adelante "Integrika"), con domicilio en México,
          es responsable del tratamiento de sus datos personales conforme a la Ley
          Federal de Protección de Datos Personales en Posesión de los Particulares
          (LFPDPPP).
        </p>
        <p>Contacto: <a href="mailto:integric.ia@gmail.com" className="text-primary underline">integric.ia@gmail.com</a></p>
      </section>

      <section className="space-y-3 text-sm">
        <h2 className="font-semibold">Datos personales que recabamos</h2>
        <p>Nombre completo, número de teléfono, correo electrónico y, de forma opcional,
           historial de compras en la farmacia participante.</p>
      </section>

      <section className="space-y-3 text-sm">
        <h2 className="font-semibold">Finalidades del tratamiento</h2>
        <p><strong>Finalidades necesarias:</strong></p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Registro y administración de su membresía en el programa de lealtad.</li>
          <li>Acumulación y canje de puntos.</li>
          <li>Comunicación sobre el estado de su cuenta.</li>
        </ul>
        <p className="mt-2"><strong>Finalidades secundarias (requieren consentimiento):</strong></p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Envío de promociones, ofertas y boletines informativos por correo electrónico o SMS.</li>
        </ul>
        <p className="text-muted-foreground text-xs mt-1">
          Puede retirar su consentimiento para las finalidades secundarias en cualquier momento
          desde la sección "Mi cuenta" de esta aplicación.
        </p>
      </section>

      <section className="space-y-3 text-sm">
        <h2 className="font-semibold">Transferencias de datos</h2>
        <p>
          Integrika no transfiere sus datos personales a terceros sin su consentimiento,
          salvo los casos exceptuados por el artículo 37 de la LFPDPPP.
        </p>
      </section>

      <section className="space-y-3 text-sm">
        <h2 className="font-semibold">Derechos ARCO</h2>
        <p>
          Tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento de sus
          datos personales (derechos ARCO). También puede limitar el uso o divulgación de
          sus datos y revocar su consentimiento.
        </p>
        <p>
          Para ejercer sus derechos, envíe una solicitud a{' '}
          <a href="mailto:integric.ia@gmail.com" className="text-primary underline">integric.ia@gmail.com</a>
          {' '}o use el formulario disponible en{' '}
          <button
            className="text-primary underline"
            onClick={() => navigate('../solicitud-arco', { relative: 'path' })}
          >
            Solicitar derechos ARCO
          </button>.
        </p>
        <p className="text-muted-foreground text-xs">
          Responderemos a su solicitud en un plazo máximo de 20 días hábiles conforme al
          artículo 24 de la LFPDPPP.
        </p>
      </section>

      <section className="space-y-3 text-sm">
        <h2 className="font-semibold">Cambios a este aviso</h2>
        <p>
          Cualquier modificación a este aviso de privacidad se publicará en esta misma
          sección de la aplicación.
        </p>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Crear `ArcoPage.tsx`**

```typescript
// src/pwa/pages/ArcoPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/integrations/supabase/client'

type TipoDerecho = 'acceso' | 'rectificacion' | 'cancelacion' | 'oposicion'

const TIPOS: { value: TipoDerecho; label: string }[] = [
  { value: 'acceso', label: 'Acceso — conocer qué datos tenemos' },
  { value: 'rectificacion', label: 'Rectificación — corregir datos incorrectos' },
  { value: 'cancelacion', label: 'Cancelación — eliminar mis datos' },
  { value: 'oposicion', label: 'Oposición — dejar de usar mis datos' },
]

export function ArcoPage() {
  const navigate = useNavigate()
  const [nombre, setNombre] = useState('')
  const [identificador, setIdentificador] = useState('')
  const [tipo, setTipo] = useState<TipoDerecho>('acceso')
  const [descripcion, setDescripcion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || !identificador.trim() || !descripcion.trim()) {
      setError('Todos los campos son obligatorios.')
      return
    }
    setLoading(true)
    setError(null)
    const { error: fnError } = await supabase.functions.invoke('loyalty-arco-request', {
      body: { nombre: nombre.trim(), identificador: identificador.trim(), tipo, descripcion: descripcion.trim() },
    })
    setLoading(false)
    if (fnError) {
      setError('Error al enviar la solicitud. Intenta de nuevo o escribe a integric.ia@gmail.com.')
      return
    }
    setEnviado(true)
  }

  if (enviado) {
    return (
      <motion.div
        className="min-h-[60vh] flex flex-col items-center justify-center px-4 gap-4 text-center"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        <CheckCircle className="h-12 w-12 text-teal-600" />
        <h2 className="text-lg font-bold">Solicitud recibida</h2>
        <p className="text-sm text-muted-foreground">
          Responderemos en un plazo máximo de 20 días hábiles (LFPDPPP Art. 24).
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>Volver</Button>
      </motion.div>
    )
  }

  return (
    <div className="pb-24 px-4 pt-4 space-y-5 max-w-md mx-auto">
      <button
        className="flex items-center gap-2 text-sm text-muted-foreground"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

      <div>
        <h1 className="text-xl font-bold">Solicitud de derechos ARCO</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Responderemos en 20 días hábiles (LFPDPPP Art. 24).
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Nombre completo</label>
          <Input
            placeholder="Tu nombre"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Email o teléfono</label>
          <Input
            placeholder="Con el que te registraste"
            value={identificador}
            onChange={e => setIdentificador(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Tipo de derecho</label>
          <select
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
            value={tipo}
            onChange={e => setTipo(e.target.value as TipoDerecho)}
          >
            {TIPOS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Descripción de tu solicitud</label>
          <textarea
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background min-h-[100px] resize-none"
            placeholder="Describe qué datos quieres acceder, corregir o eliminar..."
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            required
          />
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              className="text-sm text-destructive"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar solicitud'}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Agregar rutas en `LoyaltyApp.tsx`**

Agregar imports al tope (junto a los otros imports de pages):
```typescript
import { PrivacidadPage } from './pages/PrivacidadPage'
import { ArcoPage } from './pages/ArcoPage'
```

Dentro de `<Routes>` (línea 209–224), agregar antes del catch-all `path="*"`:
```tsx
<Route path="/aviso-privacidad" element={<PrivacidadPage />} />
<Route path="/solicitud-arco" element={<ArcoPage />} />
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errores.

- [ ] **Step 5: Commit**

```bash
git add src/pwa/pages/PrivacidadPage.tsx src/pwa/pages/ArcoPage.tsx src/pwa/LoyaltyApp.tsx
git commit -m "feat: add ARCO pages to loyalty PWA — PrivacidadPage and ArcoPage routes"
```

---

### Task 6: Edge Function `loyalty-arco-request`

**Files:**
- Create: `supabase/functions/loyalty-arco-request/index.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: body `{ nombre: string, identificador: string, tipo: string, descripcion: string }`
- Produces: `{ ok: true }` en éxito, status 500 en error de Resend

- [ ] **Step 1: Crear la Edge Function**

```typescript
// supabase/functions/loyalty-arco-request/index.ts
// Recibe solicitudes ARCO desde la PWA y las reenvía por email via Resend.
// verify_jwt = true — el usuario está autenticado (login OTP en PWA).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const ARCO_RECIPIENT = 'integric.ia@gmail.com'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body: { nombre?: string; identificador?: string; tipo?: string; descripcion?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { nombre, identificador, tipo, descripcion } = body

  if (!nombre || !identificador || !tipo || !descripcion) {
    return new Response(JSON.stringify({ error: 'campos_requeridos' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const tipoLabel: Record<string, string> = {
    acceso: 'Acceso',
    rectificacion: 'Rectificación',
    cancelacion: 'Cancelación',
    oposicion: 'Oposición',
  }

  const html = `
    <h2>Solicitud de Derechos ARCO — Programa de Lealtad</h2>
    <table>
      <tr><th align="left">Nombre</th><td>${escapeHtml(nombre)}</td></tr>
      <tr><th align="left">Identificador</th><td>${escapeHtml(identificador)}</td></tr>
      <tr><th align="left">Tipo de derecho</th><td>${escapeHtml(tipoLabel[tipo] ?? tipo)}</td></tr>
      <tr><th align="left">Descripción</th><td>${escapeHtml(descripcion)}</td></tr>
    </table>
    <p><em>Responder en máximo 20 días hábiles (LFPDPPP Art. 24).</em></p>
  `

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Lealtad Integrika <no-reply@integrika.mx>',
      to: [ARCO_RECIPIENT],
      subject: `Solicitud ARCO: ${tipoLabel[tipo] ?? tipo} — ${nombre}`,
      html,
    }),
  })

  if (!resendRes.ok) {
    console.error('[loyalty-arco-request] Resend error', resendRes.status)
    return new Response(JSON.stringify({ error: 'email_failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 2: Registrar la función en `supabase/config.toml`**

Al final del archivo, agregar:
```toml
[functions.loyalty-arco-request]
verify_jwt = true
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/loyalty-arco-request/index.ts supabase/config.toml
git commit -m "feat: loyalty-arco-request edge function — ARCO form submission via Resend"
```

---

### Task 7: PWA Icon generation

**Files:**
- Create: `scripts/generate-loyalty-icon.mjs`
- Regenerate: `public/icons/loyalty-192.png`
- Create: `public/icons/loyalty-512.png`

**Interfaces:**
- Consumes: `sharp` (ya en `package.json`)
- Produces: PNGs 192×192 y 512×512 en `public/icons/`

- [ ] **Step 1: Crear script de generación**

```javascript
// scripts/generate-loyalty-icon.mjs
import { writeFileSync } from 'node:fs'
import sharp from 'sharp'

const sizes = [192, 512]

for (const size of sizes) {
  const rx = Math.round(size * 0.208)   // radio de esquinas ~40/192
  const sw = Math.round(size * 0.052)   // stroke width
  const pad = Math.round(size * 0.167)  // padding lateral
  const top = Math.round(size * 0.333)  // top del wallet
  const h = Math.round(size * 0.5)      // alto del wallet
  const lineY = Math.round(size * 0.458) // línea horizontal
  const coinX = Math.round(size * 0.625) // monedero derecho X
  const coinW = Math.round(size * 0.208) // ancho monedero
  const coinH = Math.round(size * 0.167) // alto monedero
  const coinRx = Math.round(size * 0.042)
  const walletRx = Math.round(size * 0.063)

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="#0f766e"/>
  <rect x="${pad}" y="${top}" width="${size - pad * 2}" height="${h}" rx="${walletRx}" fill="none" stroke="white" stroke-width="${sw}"/>
  <line x1="${pad}" y1="${lineY}" x2="${size - pad}" y2="${lineY}" stroke="white" stroke-width="${sw}"/>
  <rect x="${coinX}" y="${lineY}" width="${coinW}" height="${coinH}" rx="${coinRx}" fill="white"/>
</svg>`

  const buf = Buffer.from(svg)
  await sharp(buf).png().toFile(`public/icons/loyalty-${size}.png`)
  console.log(`✓ public/icons/loyalty-${size}.png`)
}
```

- [ ] **Step 2: Ejecutar el script**

```bash
node scripts/generate-loyalty-icon.mjs
```

Expected output:
```
✓ public/icons/loyalty-192.png
✓ public/icons/loyalty-512.png
```

- [ ] **Step 3: Verificar que los archivos existen**

```bash
ls -la public/icons/loyalty-*.png
```

Expected: dos archivos, `loyalty-192.png` ~3-8KB, `loyalty-512.png` ~10-25KB.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-loyalty-icon.mjs public/icons/loyalty-192.png public/icons/loyalty-512.png
git commit -m "feat: generate loyalty PWA icons 192x512 with sharp — teal wallet design"
```

---

### Task 8: Unit tests — `loyalty-discount-pos.test.ts`

**Files:**
- Create: `src/test/lealtad/loyalty-discount-pos.test.ts`

**Interfaces:**
- No consumes archivos externos — lógica de `totalConLealtad` es pura matemática

- [ ] **Step 1: Escribir tests**

```typescript
// src/test/lealtad/loyalty-discount-pos.test.ts
import { describe, it, expect } from 'vitest'

// Lógica extraída de PuntoDeVenta.tsx para testear en aislamiento
function calcTotalConLealtad(total: number, loyaltyDescuento: number): number {
  return Math.max(0, total - loyaltyDescuento)
}

describe('calcTotalConLealtad', () => {
  it('sin descuento lealtad — total sin cambio', () => {
    expect(calcTotalConLealtad(200, 0)).toBe(200)
  })

  it('descuento parcial — resta del total', () => {
    expect(calcTotalConLealtad(200, 50)).toBe(150)
  })

  it('descuento igual al total — resultado 0', () => {
    expect(calcTotalConLealtad(100, 100)).toBe(0)
  })

  it('descuento mayor al total — resultado clampado a 0', () => {
    expect(calcTotalConLealtad(80, 100)).toBe(0)
  })

  it('total con centavos — resultado preciso', () => {
    expect(calcTotalConLealtad(199.99, 45.30)).toBeCloseTo(154.69, 2)
  })

  it('total 0 con cualquier descuento — sigue siendo 0', () => {
    expect(calcTotalConLealtad(0, 50)).toBe(0)
  })
})
```

- [ ] **Step 2: Correr los tests**

```bash
bun run test src/test/lealtad/loyalty-discount-pos.test.ts
```

Expected: `6 tests | 6 passed`.

- [ ] **Step 3: Correr suite completa para verificar no hay regresiones**

```bash
bun run test
```

Expected: todos los tests anteriores siguen pasando (57 de Etapa 1 + 6 nuevos = 63 total).

- [ ] **Step 4: Commit**

```bash
git add src/test/lealtad/loyalty-discount-pos.test.ts
git commit -m "test: loyalty discount POS calculation — 6 unit tests"
```

---

### Task 9: Deploy — supabase db push + build + deploy

**Files:** ninguno nuevo — pasos de despliegue.

- [ ] **Step 1: Aplicar las 3 migraciones nuevas a producción**

```bash
supabase db push --linked --include-all
```

Expected: output mostrando `20260625000007`, `20260625000008`, `20260625000009` aplicadas.
Si alguna falla: ver sección de learnings en CLAUDE.md sobre migrations parcialmente aplicadas.

- [ ] **Step 2: Deploy Edge Function ARCO**

```bash
supabase functions deploy loyalty-arco-request
```

Expected: `Deployed loyalty-arco-request`.

- [ ] **Step 3: Build**

```bash
bun run build
```

Expected: build completa sin errores, ≤ 8s.

- [ ] **Step 4: Verificar TypeScript y tests antes de deploy**

```bash
npx tsc --noEmit && bun run test
```

Expected: 0 errores TypeScript, todos los tests pasan.

- [ ] **Step 5: Deploy Cloudflare Workers**

```bash
wrangler deploy
```

Expected: `Published clinica-mexico-spa`.

- [ ] **Step 6: Smoke test en producción**

Verificar manualmente:
- `integrika.mx` — POS farmacia: buscar miembro con puntos, canjear, verificar que el botón "Cobrar" muestra el total reducido y el ticket muestra "Desc. lealtad".
- `loyalty.integrika.mx/<slug>` → tab Cuenta → "Aviso de Privacidad" abre `PrivacidadPage`.
- `loyalty.integrika.mx/<slug>` → tab Cuenta → "Solicitar derechos ARCO" abre `ArcoPage` con formulario funcional.
- PWA icon: en Chrome móvil, "Agregar a pantalla de inicio" muestra el ícono teal con monedero.

- [ ] **Step 7: Actualizar STATE.md y commit final**

En `memoria/STATE.md`: mover "Deuda Etapa 2" a "Completado", agregar entrada para Etapa 2.

```bash
git add memoria/STATE.md
git commit -m "docs: STATE.md — Fidelización Etapa 2 completa"
```

---

## Self-Review

**Spec coverage:**
- ✅ Ítem 1 (loyaltyDescuento en POS): Task 1 + Task 3 + Task 4
- ✅ Ítem 2 (idempotency guard): Task 2
- ✅ Ítem 3 (SMS Twilio): documentado como config manual — excluido del plan intencionalmente
- ✅ Ítem 4 (ARCO PWA): Task 5 + Task 6
- ✅ Ítem 5 (PWA icon): Task 7
- ✅ Tests: Task 8
- ✅ Deploy: Task 9

**Tipo consistency:**
- `totalConLealtad: number` — derivado en PuntoDeVenta.tsx, no es un tipo exportado
- `TicketData.descuentoLealtad?: number` — definido en Task 4 Step 1, usado en Task 4 Step 6
- `loyalty_discount: loyaltyDescuento` — en payload Task 4 Step 5, leído por RPC Task 3
- `ArcoPage` forma → `loyalty-arco-request` body: `{ nombre, identificador, tipo, descripcion }` — consistente entre Task 5 Step 2 y Task 6 Step 1

**Placeholder scan:** ninguno encontrado — todo el código está completo.
