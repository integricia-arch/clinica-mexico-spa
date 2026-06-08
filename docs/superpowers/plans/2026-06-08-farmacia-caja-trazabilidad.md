# Farmacia · Caja · Trazabilidad — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the nav menu with groups, unify Caja into one page, add stock indicators on prescriptions, add a pending-prescriptions list in pharmacy, and track medication shortages end-to-end.

**Architecture:** Three independent phases. Phase 1 is pure UI reorganization (no DB changes). Phase 2 adds read-only stock info to existing prescription and dispensing flows. Phase 3 adds a new `almacen_alertas` table and wires it into prescription issuance and dispensing.

**Tech Stack:** React + TypeScript, Supabase client, shadcn/ui (Tabs, Badge, Collapsible). No new libraries.

---

## File Map

| File | Change |
|------|--------|
| `src/components/AppLayout.tsx` | Add group sections to NAV_ITEMS, replace Caja·Turno+Caja·Config with Caja→/caja |
| `src/pages/Caja.tsx` | **NEW** — Tabs wrapper for CajaTurno + CorteCaja |
| `src/pages/Farmacia.tsx` | Remove "corte" tab; add Faltantes sub-view in Inventario (Task 9) |
| `src/pages/Configuracion.tsx` | Add Cajas card linking to /configuracion/caja |
| `src/App.tsx` | Add /caja route; fix /farmacia roles |
| `src/features/recetas/components/PrescriptionEditorModal.tsx` | Add stockMap, fetch stock on pickMedicamento, show badges |
| `src/features/farmacia/SurtirReceta.tsx` | Add pending prescriptions list (Task 5); resolve alerts (Task 8) |
| `src/features/camino-paciente/services/prescriptionService.ts` | Insert almacen_alertas in issuePrescription |
| `supabase/migrations/20260608000001_almacen_alertas.sql` | **NEW** — almacen_alertas table + RLS |

---

## Task 1: Fase 1 — Menu reorganization (AppLayout.tsx)

**Files:**
- Modify: `src/components/AppLayout.tsx`

- [ ] **Step 1: Add `section` field to NavItem interface and update NAV_ITEMS**

Replace the `NavItem` interface and `NAV_ITEMS` array with grouped structure. The section label renders as a visual separator when it changes.

```typescript
interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  roles?: AppRole[];
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  // ── Clínica ──
  { section: "Clínica", to: "/", icon: LayoutDashboard, label: "Panel principal", roles: ["admin", "receptionist", "doctor", "nurse"] },
  { to: "/recepcion", icon: Headset, label: "Recepción", roles: ["admin", "receptionist"] },
  { to: "/pacientes", icon: Users, label: "Pacientes", roles: ["admin", "receptionist", "doctor", "nurse"] },
  { to: "/agenda", icon: CalendarDays, label: "Agenda", roles: ["admin", "receptionist", "doctor", "nurse"] },
  { to: "/nueva-cita", icon: CalendarPlus, label: "Nueva cita", roles: ["admin", "receptionist"] },
  { to: "/doctor", icon: Stethoscope, label: "Panel del doctor", roles: ["admin", "doctor"] },
  { to: "/expedientes", icon: FileText, label: "Expedientes", roles: ["admin", "doctor", "nurse"] },
  { to: "/recetas", icon: FileText, label: "Recetas", roles: ["admin", "doctor", "nurse"] },
  { to: "/citas", icon: ClipboardList, label: "Citas", roles: ["admin", "receptionist", "doctor", "nurse"] },
  { to: "/recordatorios", icon: BellRing, label: "Recordatorios", roles: ["admin", "receptionist", "doctor"] },
  // ── Operaciones ──
  { section: "Operaciones", to: "/farmacia", icon: Pill, label: "Farmacia", roles: ["admin", "nurse", "receptionist"] },
  { to: "/caja", icon: CreditCard, label: "Caja", roles: ["admin", "manager", "cajero", "receptionist"] },
  // ── Admin ──
  { section: "Admin", to: "/facturacion", icon: Receipt, label: "Facturación", roles: ["admin", "receptionist"] },
  { to: "/inbox", icon: MessageCircle, label: "Conversaciones", roles: ["admin", "receptionist", "doctor", "nurse"] },
  { to: "/auditoria", icon: ShieldCheck, label: "Auditoría", roles: ["admin"] },
  { to: "/configuracion", icon: Settings, label: "Configuración", roles: ["admin", "doctor"] },
  // patient-only
  { to: "/mis-recetas", icon: Pill, label: "Mis recetas", roles: ["patient"] },
];
```

- [ ] **Step 2: Update nav rendering to show section separators**

Replace the `visibleNav.map(...)` block inside `<nav>` with:

```tsx
<nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
  {(() => {
    let lastSection = "";
    return visibleNav.map((item) => {
      const showSection = item.section && item.section !== lastSection;
      if (item.section) lastSection = item.section;
      const isActive = location.pathname === item.to;
      const showBadge = item.to === "/inbox" && escaladasCount > 0;
      return (
        <div key={item.to}>
          {showSection && (
            <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              {item.section}
            </p>
          )}
          <NavLink
            to={item.to}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <item.icon className="h-[18px] w-[18px]" />
            <span className="flex-1">{item.label}</span>
            {showBadge && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 text-[10px] font-bold rounded-full bg-red-500 text-white px-1.5">
                {escaladasCount}
              </span>
            )}
          </NavLink>
        </div>
      );
    });
  })()}
</nav>
```

- [ ] **Step 3: Remove unused `Timer` import**

Remove `Timer` from the lucide-react import line (it was used for Caja·Turno which is now gone).

- [ ] **Step 4: Commit**

```bash
git add src/components/AppLayout.tsx
git commit -m "feat: reorganize nav menu with Clínica/Operaciones/Admin groups"
```

---

## Task 2: Fase 1 — Nueva página Caja.tsx + rutas (App.tsx)

**Files:**
- Create: `src/pages/Caja.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/pages/Caja.tsx`**

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CajaTurno from "@/pages/CajaTurno";
import CorteCaja from "@/features/farmacia/CorteCaja";

export default function Caja() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Caja</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gestión de turno y corte de caja</p>
      </div>
      <Tabs defaultValue="turno" className="space-y-6">
        <TabsList>
          <TabsTrigger value="turno">Turno</TabsTrigger>
          <TabsTrigger value="corte">Corte de caja</TabsTrigger>
        </TabsList>
        <TabsContent value="turno">
          <CajaTurno />
        </TabsContent>
        <TabsContent value="corte">
          <CorteCaja />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Update App.tsx — add /caja route, fix /farmacia roles**

In `src/App.tsx`:

1. Add import: `import Caja from "@/pages/Caja";`

2. Change `/farmacia` route roles from `["admin","doctor","nurse"]` to `["admin","nurse","receptionist"]`:
```tsx
<Route path="/farmacia" element={<ProtectedRoute allowedRoles={["admin","nurse","receptionist"]}><Farmacia /></ProtectedRoute>} />
```

3. Add `/caja` route (after the existing caja routes):
```tsx
<Route path="/caja" element={<ProtectedRoute allowedRoles={["admin","manager","cajero","receptionist"]}><Caja /></ProtectedRoute>} />
```

4. Keep `/caja/turno` and `/configuracion/caja` routes as aliases (don't remove — existing bookmarks/links still work).

- [ ] **Step 3: Commit**

```bash
git add src/pages/Caja.tsx src/App.tsx
git commit -m "feat: add unified Caja page with Turno and Corte tabs"
```

---

## Task 3: Fase 1 — Farmacia cleanup + Configuracion Cajas card

**Files:**
- Modify: `src/pages/Farmacia.tsx`
- Modify: `src/pages/Configuracion.tsx`

- [ ] **Step 1: Remove "Corte de caja" tab from Farmacia.tsx**

Remove the `CorteCaja` import:
```typescript
// DELETE this line:
import CorteCaja from "@/features/farmacia/CorteCaja";
```

Remove the tab trigger:
```tsx
// DELETE this line:
<TabsTrigger value="corte">Corte de caja</TabsTrigger>
```

Remove the tab content:
```tsx
// DELETE these lines:
<TabsContent value="corte"><CorteCaja /></TabsContent>
```

- [ ] **Step 2: Add Cajas card to Configuracion.tsx**

In `src/pages/Configuracion.tsx`, add a card for Cajas after the "Mi machote de receta" card (around line 113). Add `CreditCard` to the lucide-react import first.

```tsx
{(isAdmin || hasRole("manager")) && (
  <Link
    to="/configuracion/caja"
    className="group flex items-center justify-between rounded-xl border border-primary/30 bg-gradient-to-r from-primary/5 to-transparent p-5 shadow-card hover:shadow-elevated transition-shadow"
  >
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <CreditCard className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-display font-semibold text-card-foreground">Configuración de cajas</h2>
        <p className="text-sm text-muted-foreground">Registrar cajas registradoras, fondos de apertura y tipo (general/farmacia).</p>
      </div>
    </div>
    <ArrowRight className="h-5 w-5 text-primary group-hover:translate-x-0.5 transition-transform" />
  </Link>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Farmacia.tsx src/pages/Configuracion.tsx
git commit -m "feat: remove Corte de Caja from Farmacia, add Cajas card to Configuracion"
```

---

## Task 4: Fase 2a — Stock badges in PrescriptionEditorModal.tsx

**Files:**
- Modify: `src/features/recetas/components/PrescriptionEditorModal.tsx`

- [ ] **Step 1: Add stockMap state and helper**

After line 71 (`const [issuedNumber, setIssuedNumber] = useState<string | null>(null);`), add:

```typescript
const [stockMap, setStockMap] = useState<Record<string, number>>({});

async function fetchStockForIds(medIds: string[]) {
  if (medIds.length === 0) return;
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("lotes_medicamento")
    .select("medicamento_id, existencia")
    .in("medicamento_id", medIds)
    .gt("existencia", 0)
    .gte("fecha_caducidad", today);
  if (!data) return;
  const totals: Record<string, number> = {};
  for (const l of data) {
    totals[l.medicamento_id] = (totals[l.medicamento_id] ?? 0) + l.existencia;
  }
  setStockMap((prev) => ({ ...prev, ...totals }));
}
```

- [ ] **Step 2: Fetch stock for existing items when they load**

In the `useEffect` block, after `setItems(its ?? []);` (around line 103), add:

```typescript
const existingMedIds = (its ?? [])
  .map((i: any) => i.medication_id)
  .filter(Boolean) as string[];
if (existingMedIds.length > 0) fetchStockForIds(existingMedIds);
```

Also reset stockMap when modal opens (at the start of the useEffect, after `setIssuedNumber(null)`):
```typescript
setStockMap({});
```

- [ ] **Step 3: Fetch stock in pickMedicamento**

Replace the `pickMedicamento` function:

```typescript
function pickMedicamento(id: string) {
  const m = meds.find((x) => x.id === id);
  if (!m) return;
  setDraft((d) => ({ ...d, medication_id: m.id, generic_name: m.nombre, presentation: m.descripcion ?? d.presentation }));
  fetchStockForIds([m.id]);
}
```

- [ ] **Step 4: Add stock badge to items list render**

In the items render block, after the `it.is_controlled` warning block (around line 256) and before the closing `</div>` of the item content, add:

```tsx
{it.medication_id && (
  <span className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${
    (stockMap[it.medication_id] ?? 0) >= (it.quantity ?? 1)
      ? "text-green-600"
      : "text-destructive"
  }`}>
    {stockMap[it.medication_id] !== undefined ? (
      (stockMap[it.medication_id] ?? 0) >= (it.quantity ?? 1)
        ? `🟢 ${stockMap[it.medication_id]} en stock`
        : `🔴 solo ${stockMap[it.medication_id] ?? 0} disponibles`
    ) : null}
  </span>
)}
{!it.medication_id && (
  <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-destructive">
    🔴 sin ligar a inventario
  </span>
)}
```

- [ ] **Step 5: Commit**

```bash
git add src/features/recetas/components/PrescriptionEditorModal.tsx
git commit -m "feat: show real-time stock indicators on prescription items"
```

---

## Task 5: Fase 2b — Pending prescriptions list in SurtirReceta.tsx

**Files:**
- Modify: `src/features/farmacia/SurtirReceta.tsx`

- [ ] **Step 1: Add state and type for pending prescriptions**

After the existing type declarations (around line 85), add:

```typescript
type PendingRx = {
  id: string;
  prescription_number: string | null;
  issue_date: string | null;
  status: string;
  patients: { nombre: string; apellidos: string } | null;
};
```

After `const [notes, setNotes] = useState("");` (around line 140), add:

```typescript
const [pendingRx, setPendingRx] = useState<PendingRx[]>([]);
const [pendingOpen, setPendingOpen] = useState(true);
const [loadingPending, setLoadingPending] = useState(false);
```

- [ ] **Step 2: Load pending prescriptions**

After the existing `useEffect` for `initialCode` (around line 143), add:

```typescript
useEffect(() => {
  if (!activeClinicId) return;
  setLoadingPending(true);
  supabase
    .from("prescriptions")
    .select("id, prescription_number, issue_date, status, patients(nombre, apellidos)")
    .in("status", ["issued", "partially_dispensed"])
    .eq("clinic_id", activeClinicId)
    .order("issue_date", { ascending: false })
    .limit(30)
    .then(({ data }) => {
      setPendingRx((data as unknown as PendingRx[]) ?? []);
      setLoadingPending(false);
    });
}, [activeClinicId]);
```

- [ ] **Step 3: Add pending list UI above the scanner form**

In the `return (...)` block, before the `<form onSubmit={onSubmitCode}...>` scanner section, insert:

```tsx
{/* Recetas pendientes */}
{(pendingRx.length > 0 || loadingPending) && (
  <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
    <button
      type="button"
      onClick={() => setPendingOpen((v) => !v)}
      className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/30 transition-colors"
    >
      <span>Recetas pendientes ({pendingRx.length})</span>
      {pendingOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </button>
    {pendingOpen && (
      <div className="border-t border-border overflow-x-auto">
        {loadingPending ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Folio</th>
                <th className="px-4 py-2 text-left font-medium">Paciente</th>
                <th className="px-4 py-2 text-left font-medium">Fecha</th>
                <th className="px-4 py-2 text-left font-medium">Estado</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {pendingRx.map((r) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs">{r.prescription_number ?? r.id.slice(0, 8)}</td>
                  <td className="px-4 py-2">
                    {r.patients ? `${r.patients.nombre} ${r.patients.apellidos}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {r.issue_date ? format(new Date(r.issue_date), "dd/MM/yyyy", { locale: es }) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={r.status === "partially_dispensed" ? "secondary" : "outline"} className="text-xs">
                      {r.status === "partially_dispensed" ? "Parcial" : "Emitida"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => {
                        const num = r.prescription_number ?? r.id;
                        setCode(num);
                        loadPrescription(num);
                      }}
                    >
                      Surtir →
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: Add missing imports**

Add `ChevronUp, ChevronDown` to the lucide-react import line:
```typescript
import { AlertTriangle, ScanLine, Search, Lock, CheckCircle2, Loader2, X, ChevronUp, ChevronDown } from "lucide-react";
```

- [ ] **Step 5: Commit**

```bash
git add src/features/farmacia/SurtirReceta.tsx
git commit -m "feat: add pending prescriptions list above scanner in SurtirReceta"
```

---

## Task 6: Fase 3a — Migration: almacen_alertas table

**Files:**
- Create: `supabase/migrations/20260608000001_almacen_alertas.sql`

- [ ] **Step 1: Write migration**

```sql
-- almacen_alertas: tracks medication shortages detected at prescription issuance
create table if not exists almacen_alertas (
  id                   uuid primary key default gen_random_uuid(),
  clinic_id            uuid references clinics(id) on delete cascade,
  tipo                 text not null check (tipo in ('faltante_receta', 'stock_minimo')),
  medicamento_id       uuid references medicamentos(id) on delete set null,
  generic_name         text,
  quantity_needed      int not null,
  quantity_available   int not null default 0,
  prescription_id      uuid references prescriptions(id) on delete set null,
  prescription_item_id uuid references prescription_items(id) on delete set null,
  status               text not null default 'pending' check (status in ('pending', 'resolved', 'external')),
  resolved_at          timestamptz,
  created_at           timestamptz not null default now()
);

create index on almacen_alertas (clinic_id, status, created_at desc);
create index on almacen_alertas (medicamento_id, status);

-- RLS: same pattern as movimientos_inventario
alter table almacen_alertas enable row level security;

create policy "almacen_alertas_clinic_member_select"
  on almacen_alertas for select
  using (
    clinic_id in (
      select clinic_id from clinic_members where user_id = auth.uid()
    )
  );

create policy "almacen_alertas_admin_nurse_insert"
  on almacen_alertas for insert
  with check (
    clinic_id in (
      select clinic_id from clinic_members
      where user_id = auth.uid()
        and role in ('admin', 'nurse', 'doctor')
    )
  );

create policy "almacen_alertas_admin_nurse_update"
  on almacen_alertas for update
  using (
    clinic_id in (
      select clinic_id from clinic_members
      where user_id = auth.uid()
        and role in ('admin', 'nurse', 'receptionist')
    )
  );
```

- [ ] **Step 2: Apply migration to Supabase**

Run in project root:
```bash
npx supabase db push
```

Expected: migration applied without errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260608000001_almacen_alertas.sql
git commit -m "feat: add almacen_alertas table for medication shortage tracking"
```

---

## Task 7: Fase 3b — Insert alerts when prescription is issued

**Files:**
- Modify: `src/features/camino-paciente/services/prescriptionService.ts`

- [ ] **Step 1: Update prescriptions select to include clinic_id**

In `issuePrescription()` around line 78, change the select:
```typescript
// FROM:
.select("id, patient_id, doctor_id, status")
// TO:
.select("id, patient_id, doctor_id, status, clinic_id")
```

- [ ] **Step 2: Update prescription_items select to include medication_id and quantity**

Around line 105, change the items select:
```typescript
// FROM:
.select("id, generic_name, dose, route, frequency, duration, instructions")
// TO:
.select("id, generic_name, dose, route, frequency, duration, instructions, medication_id, quantity")
```

- [ ] **Step 3: Add almacen_alertas inserts after UPDATE prescriptions**

After line 165 (`if (error) return { ok: false, error: error.message };`) and before the return statement, add:

```typescript
// Best-effort: insert shortage alerts for items with insufficient stock
try {
  const today = new Date().toISOString().slice(0, 10);
  for (const item of (items as Array<{ id: string; generic_name: string; medication_id: string | null; quantity: number | null }>) ) {
    const needed = Number(item.quantity ?? 0);
    if (needed <= 0) continue;

    let stockActual = 0;
    if (item.medication_id) {
      const { data: lotes } = await supabase
        .from("lotes_medicamento")
        .select("existencia")
        .eq("medicamento_id", item.medication_id)
        .gt("existencia", 0)
        .gte("fecha_caducidad", today);
      stockActual = (lotes ?? []).reduce((s: number, l: { existencia: number }) => s + l.existencia, 0);
    }

    if (stockActual < needed) {
      await supabase.from("almacen_alertas" as any).insert({
        clinic_id: (rx as any).clinic_id ?? null,
        tipo: "faltante_receta",
        medicamento_id: item.medication_id ?? null,
        generic_name: item.medication_id ? null : item.generic_name,
        quantity_needed: needed,
        quantity_available: stockActual,
        prescription_id,
        prescription_item_id: item.id,
      });
    }
  }
} catch {
  /* best-effort — never blocks prescription issuance */
}
```

- [ ] **Step 4: Commit**

```bash
git add src/features/camino-paciente/services/prescriptionService.ts
git commit -m "feat: insert almacen_alertas on prescription issuance when stock is insufficient"
```

---

## Task 8: Fase 3c — Resolve alerts when prescription is dispensed

**Files:**
- Modify: `src/features/farmacia/SurtirReceta.tsx`

- [ ] **Step 1: Add alert resolution in confirmDispense**

In `confirmDispense()`, after the `logAudit(rx.clinic_id, "prescription_dispensed", ...)` call (around line 370) and before `setSubmitting(false)`, add:

```typescript
// Resolve almacen_alertas for dispensed items
try {
  const dispensedItemIds = dispensable.map((d) => d.item.id);
  await supabase
    .from("almacen_alertas" as any)
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .in("prescription_item_id", dispensedItemIds)
    .eq("status", "pending");
} catch {
  /* best-effort */
}
```

- [ ] **Step 2: Refresh pending list after successful dispense**

After the `setSubmitting(false)` call (around line 382), refresh the pending list. The easiest approach: add a `loadPendingRx` function extracted from the useEffect, then call it here.

Extract the pending load into a named function (add before the useEffect):

```typescript
const loadPendingRx = async () => {
  if (!activeClinicId) return;
  const { data } = await supabase
    .from("prescriptions")
    .select("id, prescription_number, issue_date, status, patients(nombre, apellidos)")
    .in("status", ["issued", "partially_dispensed"])
    .eq("clinic_id", activeClinicId)
    .order("issue_date", { ascending: false })
    .limit(30);
  setPendingRx((data as unknown as PendingRx[]) ?? []);
};
```

Update the useEffect to call `loadPendingRx()` instead of inline code.

Then in `confirmDispense`, after `setSubmitting(false)`:
```typescript
loadPendingRx();
```

- [ ] **Step 3: Commit**

```bash
git add src/features/farmacia/SurtirReceta.tsx
git commit -m "feat: resolve almacen_alertas and refresh pending list after dispensing"
```

---

## Task 9: Fase 3d — Faltantes sub-tab in Farmacia Inventario

**Files:**
- Modify: `src/pages/Farmacia.tsx`

- [ ] **Step 1: Add state and types for Faltantes**

In `Farmacia.tsx`, add after the existing state declarations (around line 80):

```typescript
const [inventarioView, setInventarioView] = useState<"catalogo" | "faltantes">("catalogo");

type Alerta = {
  id: string;
  tipo: string;
  medicamento_id: string | null;
  generic_name: string | null;
  quantity_needed: number;
  quantity_available: number;
  status: string;
  created_at: string;
  prescription_id: string | null;
  prescription_item_id: string | null;
  medicamentos?: { nombre: string } | null;
};

const [alertas, setAlertas] = useState<Alerta[]>([]);
const [loadingAlertas, setLoadingAlertas] = useState(false);
const [filtroAlertas, setFiltroAlertas] = useState<"pending" | "resolved" | "external">("pending");
```

- [ ] **Step 2: Add loadAlertas function**

After the `loadData` function (around line 94), add:

```typescript
async function loadAlertas() {
  setLoadingAlertas(true);
  const { data } = await supabase
    .from("almacen_alertas" as any)
    .select("*, medicamentos(nombre)")
    .eq("status", filtroAlertas)
    .order("created_at", { ascending: false })
    .limit(100);
  setAlertas((data as unknown as Alerta[]) ?? []);
  setLoadingAlertas(false);
}
```

Add useEffect to load when view changes:
```typescript
useEffect(() => {
  if (tab === "inventario" && inventarioView === "faltantes") {
    loadAlertas();
  }
}, [tab, inventarioView, filtroAlertas]);
```

- [ ] **Step 3: Add resolveAlerta helper**

```typescript
async function resolveAlerta(id: string, newStatus: "resolved" | "external") {
  const { error } = await supabase
    .from("almacen_alertas" as any)
    .update({ status: newStatus, resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    toast({ variant: "destructive", title: "Error", description: friendlyError(error) });
    return;
  }
  setAlertas((prev) => prev.filter((a) => a.id !== id));
}
```

- [ ] **Step 4: Add sub-view toggle and Faltantes UI inside Inventario TabsContent**

In the Inventario `TabsContent`, BEFORE the existing header `<div className="flex flex-col sm:flex-row...">`, add a sub-view toggle:

```tsx
{/* Sub-view toggle */}
<div className="flex gap-2">
  <button
    onClick={() => setInventarioView("catalogo")}
    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
      inventarioView === "catalogo"
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted"
    }`}
  >
    Catálogo
  </button>
  <button
    onClick={() => setInventarioView("faltantes")}
    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
      inventarioView === "faltantes"
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted"
    }`}
  >
    Faltantes
  </button>
</div>
```

Then wrap the existing inventario content in `{inventarioView === "catalogo" && (...)}`.

Add a faltantes view block:

```tsx
{inventarioView === "faltantes" && (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold">Bitácora de faltantes</h2>
      <div className="flex gap-1">
        {(["pending", "resolved", "external"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFiltroAlertas(s)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              filtroAlertas === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {s === "pending" ? "Pendientes" : s === "resolved" ? "Resueltos" : "Externos"}
          </button>
        ))}
      </div>
    </div>

    {loadingAlertas ? (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    ) : alertas.length === 0 ? (
      <div className="text-center py-10 text-muted-foreground">
        <AlertTriangle className="mx-auto h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">Sin alertas {filtroAlertas === "pending" ? "pendientes" : filtroAlertas === "resolved" ? "resueltas" : "externas"}</p>
      </div>
    ) : (
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">Medicamento</th>
              <th className="px-4 py-2 text-center font-medium">Solicitado</th>
              <th className="px-4 py-2 text-center font-medium">Disponible</th>
              <th className="px-4 py-2 text-center font-medium">Diferencia</th>
              <th className="px-4 py-2 text-left font-medium">Fecha</th>
              {filtroAlertas === "pending" && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {alertas.map((a) => (
              <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2 font-medium">
                  {(a.medicamentos as any)?.nombre ?? a.generic_name ?? "Sin nombre"}
                </td>
                <td className="px-4 py-2 text-center">{a.quantity_needed}</td>
                <td className="px-4 py-2 text-center text-destructive">{a.quantity_available}</td>
                <td className="px-4 py-2 text-center font-semibold text-destructive">
                  -{a.quantity_needed - a.quantity_available}
                </td>
                <td className="px-4 py-2 text-muted-foreground text-xs">
                  {format(new Date(a.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                </td>
                {filtroAlertas === "pending" && (
                  <td className="px-4 py-2">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => resolveAlerta(a.id, "external")}>
                        Externo
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50"
                        onClick={() => resolveAlerta(a.id, "resolved")}>
                        Recibido
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/Farmacia.tsx
git commit -m "feat: add Faltantes sub-view in Farmacia Inventario tab"
```

---

## Task 10: Build + deploy

- [ ] **Step 1: Run local build**

```bash
cd C:\Users\pablo\clinica-mexico-spa
npm run build
```

Expected: build completes with no TypeScript errors. Chunk size warnings are OK.

- [ ] **Step 2: Deploy to Cloudflare**

```bash
wrangler deploy
```

Expected: "Published clinica-mexico-spa"

- [ ] **Step 3: Smoke test**

1. Navigate to `https://integrika.mx` and confirm login page loads
2. Log in as admin — verify menu shows Clínica / Operaciones / Admin groups
3. Click Caja → confirm Turno and Corte tabs both render
4. Click Farmacia → confirm no "Corte de caja" tab
5. Click Configuración → confirm "Configuración de cajas" card appears

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: post-deploy smoke test passed — farmacia-caja-trazabilidad complete"
```
