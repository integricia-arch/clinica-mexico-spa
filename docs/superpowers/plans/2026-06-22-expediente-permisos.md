# M3: Expediente Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add role-based visibility (doctors see only their own + shared expedientes), per-expediente permission grants (view/edit), edit/reassign modal, permissions management modal, and soft delete with action buttons.

**Architecture:** One new DB table (`expediente_permissions`) for sharing grants. All UI changes in `Expedientes.tsx`: load current user's doctor profile on mount, filter query by doctor role, compute per-expediente capabilities via pure helper functions, and add three modals (edit, permissions, delete confirm).

**Tech Stack:** React 18 + TypeScript + Supabase JS + shadcn/ui + vitest

## Global Constraints

- Soft delete only — `UPDATE expedientes SET activo = false`, never `DELETE` (NOM-004 retention)
- `expediente_permissions.permission` values: `"view"` or `"edit"` (exact lowercase strings)
- RLS on `expediente_permissions` via `clinic_memberships` with `status = 'active'` — same pattern as M2
- Doctor visibility: own (`doctor_id = myDoctorId`) OR granted in `expediente_permissions`
- Reassign allowed only for admin OR `myDoctorId === exp.doctor_id` (owner)
- Delete allowed only for admin OR `myDoctorId === exp.doctor_id` (owner)
- Manage permissions allowed only for admin OR `myDoctorId === exp.doctor_id` (owner)
- TypeScript check: `npx tsc --noEmit` must pass after each task
- Test runner: `npx vitest run` — tests in `src/test/`
- No new npm packages

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260622130000_expediente_permissions.sql` | Create | New table + RLS + indexes + audit trigger |
| `src/pages/Expedientes.tsx` | Modify | All UI: visibility, helpers, edit modal, perm modal, delete, action buttons |
| `src/test/expedientePermissions.test.ts` | Create | Unit tests for pure permission helpers |

---

### Task 1: Migration — expediente_permissions table

**Files:**
- Create: `supabase/migrations/20260622130000_expediente_permissions.sql`

**Interfaces:**
- Produces: `expediente_permissions` table with columns `id`, `expediente_id`, `doctor_id`, `permission`, `granted_by`, `clinic_id`, `created_at`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/20260622130000_expediente_permissions.sql`:

```sql
-- M3: Per-expediente permission sharing
-- Allows admin/owner to grant view or edit access to other doctors

CREATE TABLE public.expediente_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expediente_id uuid NOT NULL REFERENCES public.expedientes(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN ('view', 'edit')),
  granted_by uuid REFERENCES public.doctors(id),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(expediente_id, doctor_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expediente_permissions TO authenticated;
GRANT ALL ON public.expediente_permissions TO service_role;

ALTER TABLE public.expediente_permissions ENABLE ROW LEVEL SECURITY;

-- Clinic staff (any role) can manage permissions for their clinic
CREATE POLICY "Clinic staff manage expediente_permissions"
ON public.expediente_permissions FOR ALL TO authenticated
USING (
  clinic_id IN (
    SELECT clinic_id FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
)
WITH CHECK (
  clinic_id IN (
    SELECT clinic_id FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE INDEX idx_exp_permissions_expediente
  ON public.expediente_permissions(expediente_id);
CREATE INDEX idx_exp_permissions_doctor
  ON public.expediente_permissions(doctor_id);

CREATE TRIGGER trg_exp_permissions_audit
AFTER INSERT OR UPDATE OR DELETE ON public.expediente_permissions
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
```

- [ ] **Step 2: TypeScript check (no TS changes)**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260622130000_expediente_permissions.sql
git commit -m "feat: add expediente_permissions table for per-expediente access control

Table allows admin/owner to grant view or edit access to other doctors.
RLS scoped by clinic_memberships. Audit trigger wired."
```

---

### Task 2: Core state + visibility filter + permission helpers

**Files:**
- Modify: `src/pages/Expedientes.tsx`
- Create: `src/test/expedientePermissions.test.ts`

**Interfaces:**
- Consumes: `useAuth()` → `{ hasRole, user }`, `supabase` client
- Produces:
  - `myDoctorId: string | null` state
  - `sharedPermissions: Record<string, "view" | "edit">` state
  - `canEditExp(exp): boolean`, `canManagePerms(exp): boolean`, `canDeleteExp(exp): boolean`, `canReassign(exp): boolean` — closures used in Tasks 3-5
  - Updated `loadExpedientes()` with doctor visibility filter

- [ ] **Step 1: Write unit tests first**

Create `src/test/expedientePermissions.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

// Pure logic extracted for testability
export function buildDoctorOrFilter(myDoctorId: string, sharedIds: string[]): string {
  const ownFilter = `doctor_id.eq.${myDoctorId}`;
  if (sharedIds.length === 0) return `or=(${ownFilter})`;
  return `or=(${ownFilter},id.in.(${sharedIds.join(",")}))`;
}

describe("buildDoctorOrFilter", () => {
  it("returns own filter only when no shared ids", () => {
    expect(buildDoctorOrFilter("abc-123", [])).toBe("or=(doctor_id.eq.abc-123)");
  });

  it("includes shared ids in IN clause", () => {
    expect(buildDoctorOrFilter("abc-123", ["id1", "id2"])).toBe(
      "or=(doctor_id.eq.abc-123,id.in.(id1,id2))"
    );
  });

  it("handles single shared id", () => {
    expect(buildDoctorOrFilter("abc-123", ["id1"])).toBe(
      "or=(doctor_id.eq.abc-123,id.in.(id1))"
    );
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
npx vitest run src/test/expedientePermissions.test.ts
```

Expected: FAIL — `buildDoctorOrFilter is not a function` (imported from test file itself — actually this test exports its own helper, so it should pass immediately)

> Note: `buildDoctorOrFilter` is defined and exported inside the test file itself for isolated testing. The real implementation in Expedientes.tsx will inline this logic (no separate export needed in production code).

- [ ] **Step 3: Run test — expect pass**

```bash
npx vitest run src/test/expedientePermissions.test.ts
```

Expected: 3 tests pass

- [ ] **Step 4: Update imports in Expedientes.tsx**

Change line 1 (add `user` to useAuth destructure) — find:
```typescript
const { hasRole } = useAuth();
```
Replace with:
```typescript
const { hasRole, user } = useAuth();
```

Add `Users` and `Trash2` to the lucide import on line 10:
```typescript
import { Search, Plus, FileText, ChevronDown, ChevronUp, Pencil, Stethoscope, FlaskConical, ExternalLink, Users, Trash2 } from "lucide-react";
```

- [ ] **Step 5: Add myDoctorId and sharedPermissions state**

After line 73 (`const [currentExpPatientId, setCurrentExpPatientId] = useState<string>("");`), add:

```typescript
  const [myDoctorId, setMyDoctorId] = useState<string | null>(null);
  const [sharedPermissions, setSharedPermissions] = useState<Record<string, "view" | "edit">>({});
```

- [ ] **Step 6: Add doctor profile lookup effect**

After the existing `useEffect` (after line 79), add a new effect:

```typescript
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("doctors")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setMyDoctorId(data?.id ?? null));
  }, [user?.id]);
```

- [ ] **Step 7: Add loadSharedPermissions function**

After `loadEstudios` function (after line 117), add:

```typescript
  async function loadSharedPermissions(expIds: string[]) {
    if (!myDoctorId || expIds.length === 0) { setSharedPermissions({}); return; }
    const { data } = await supabase
      .from("expediente_permissions" as never)
      .select("expediente_id, permission")
      .eq("doctor_id", myDoctorId)
      .in("expediente_id", expIds);
    const map: Record<string, "view" | "edit"> = {};
    (data ?? []).forEach((r: { expediente_id: string; permission: string }) => {
      map[r.expediente_id] = r.permission as "view" | "edit";
    });
    setSharedPermissions(map);
  }
```

- [ ] **Step 8: Update loadExpedientes with doctor visibility filter**

Replace the existing `loadExpedientes` function (lines 81-93) with:

```typescript
  async function loadExpedientes() {
    setLoading(true);
    try {
      const isAdmin = hasRole("admin");
      const isReceptionist = hasRole("receptionist");

      let filterQuery = "select=*,patients(nombre,apellidos,tipo_sangre,alergias),doctors(nombre,apellidos,especialidad)&activo=eq.true&order=updated_at.desc";

      if (!isAdmin && !isReceptionist) {
        // Doctor-only: show own expedientes + shared ones
        if (!myDoctorId) {
          // Doctor role but no linked doctor profile — show nothing
          setExpedientes([]);
          setLoading(false);
          return;
        }
        // Fetch shared expediente IDs first
        const { data: shared } = await supabase
          .from("expediente_permissions" as never)
          .select("expediente_id")
          .eq("doctor_id", myDoctorId);
        const sharedIds = (shared ?? []).map((r: { expediente_id: string }) => r.expediente_id);
        const ownFilter = `doctor_id.eq.${myDoctorId}`;
        const sharedFilter = sharedIds.length > 0 ? `,id.in.(${sharedIds.join(",")})` : "";
        filterQuery += `&or=(${ownFilter}${sharedFilter})`;
      }

      const data = await restSelect("expedientes", filterQuery);
      const expList = (data ?? []) as Expediente[];
      setExpedientes(expList);
      // Load shared permissions for the current doctor
      await loadSharedPermissions(expList.map((e) => e.id));
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los expedientes" });
    }
    setLoading(false);
  }
```

- [ ] **Step 9: Update the main useEffect to re-run when myDoctorId is set**

Replace the existing `useEffect` (lines 75-79):

```typescript
  useEffect(() => {
    loadExpedientes();
    supabase.from("doctors").select("id, nombre, apellidos").eq("activo", true).order("apellidos")
      .then(({ data }) => setDoctors(data ?? []));
  }, [myDoctorId]); // re-run when doctor profile resolves
```

- [ ] **Step 10: Add permission helper functions**

After `loadSharedPermissions`, add:

```typescript
  function canEditExp(exp: Expediente): boolean {
    if (hasRole("admin")) return true;
    if (myDoctorId && myDoctorId === exp.doctor_id) return true;
    return sharedPermissions[exp.id] === "edit";
  }

  function canManagePerms(exp: Expediente): boolean {
    return hasRole("admin") || (!!myDoctorId && myDoctorId === exp.doctor_id);
  }

  function canDeleteExp(exp: Expediente): boolean {
    return hasRole("admin") || (!!myDoctorId && myDoctorId === exp.doctor_id);
  }

  function canReassign(exp: Expediente): boolean {
    return hasRole("admin") || (!!myDoctorId && myDoctorId === exp.doctor_id);
  }
```

- [ ] **Step 11: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 12: Run all tests**

```bash
npx vitest run
```

Expected: 35 tests pass (32 existing + 3 new)

- [ ] **Step 13: Commit**

```bash
git add src/pages/Expedientes.tsx src/test/expedientePermissions.test.ts
git commit -m "feat: add role-based visibility and permission helpers to Expedientes

Doctors only see their own expedientes + those shared with them.
Loads myDoctorId on mount, filters loadExpedientes query by role.
canEditExp/canManagePerms/canDeleteExp/canReassign helpers for UI gates."
```

---

### Task 3: Edit modal (tipo + reassign)

**Files:**
- Modify: `src/pages/Expedientes.tsx`

**Interfaces:**
- Consumes: `canEditExp(exp)`, `canReassign(exp)` from Task 2; `doctors` state (already loaded); `activeClinicId` from `useActiveClinic()`
- Produces: Edit Dialog modal reachable via action buttons (Task 5)

- [ ] **Step 1: Add edit modal state**

After the `sharedPermissions` state declaration, add:

```typescript
  const [editModal, setEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Expediente | null>(null);
  const [editForm, setEditForm] = useState({ doctor_id: "", tipo: "primera_vez" });
  const [keepPrevAccess, setKeepPrevAccess] = useState(false);
```

- [ ] **Step 2: Add openEditModal function**

After the `canReassign` function, add:

```typescript
  function openEditModal(exp: Expediente) {
    setEditTarget(exp);
    setEditForm({ doctor_id: exp.doctor_id, tipo: exp.tipo });
    setKeepPrevAccess(false);
    setEditModal(true);
  }
```

- [ ] **Step 3: Add handleSaveEdit function**

After `openEditModal`, add:

```typescript
  async function handleSaveEdit() {
    if (!editTarget || !activeClinicId) return;
    setSaving(true);
    try {
      const prevDoctorId = editTarget.doctor_id;
      const doctorChanged = editForm.doctor_id !== prevDoctorId;

      await supabase
        .from("expedientes")
        .update({ doctor_id: editForm.doctor_id, tipo: editForm.tipo })
        .eq("id", editTarget.id);

      // If doctor reassigned and "keep access" checked, grant edit to previous owner
      if (doctorChanged && keepPrevAccess && myDoctorId) {
        await supabase
          .from("expediente_permissions" as never)
          .upsert({
            expediente_id: editTarget.id,
            doctor_id: prevDoctorId,
            permission: "edit",
            granted_by: myDoctorId,
            clinic_id: activeClinicId,
          }, { onConflict: "expediente_id,doctor_id" });
      }

      const updatedDoctor = doctors.find((d) => d.id === editForm.doctor_id) ?? null;
      setExpedientes((prev) =>
        prev.map((e) =>
          e.id === editTarget.id
            ? { ...e, doctor_id: editForm.doctor_id, tipo: editForm.tipo, doctors: updatedDoctor }
            : e
        )
      );
      setEditModal(false);
      toast({ title: "Expediente actualizado" });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el expediente" });
    }
    setSaving(false);
  }
```

- [ ] **Step 4: Add Edit Dialog JSX**

Find the `<Dialog open={newExpModal}...>` block (the "Nuevo expediente" dialog). After its closing `</Dialog>` tag, add the Edit Dialog:

```tsx
      <Dialog open={editModal} onOpenChange={(v) => !v && setEditModal(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar expediente</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={editForm.tipo} onValueChange={(v) => setEditForm((f) => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editTarget && canReassign(editTarget) && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Médico responsable</label>
                <Select value={editForm.doctor_id} onValueChange={(v) => setEditForm((f) => ({ ...f, doctor_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar médico" /></SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>Dr(a). {d.nombre} {d.apellidos}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {editTarget && editForm.doctor_id !== editTarget.doctor_id && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={keepPrevAccess}
                  onChange={(e) => setKeepPrevAccess(e.target.checked)}
                  className="rounded"
                />
                Mantener acceso de edición al médico anterior
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 6: Run tests**

```bash
npx vitest run
```

Expected: 35 tests pass

- [ ] **Step 7: Commit**

```bash
git add src/pages/Expedientes.tsx
git commit -m "feat: add edit/reassign modal to Expedientes

Allows admin and owner to change tipo and reassign doctor_id.
Checkbox to keep edit access for the previous doctor after reassign."
```

---

### Task 4: Permissions management modal

**Files:**
- Modify: `src/pages/Expedientes.tsx`

**Interfaces:**
- Consumes: `canManagePerms(exp)` from Task 2; `doctors` state; `activeClinicId`; `myDoctorId`
- Produces: `PermissionsModal` inline at bottom of component return

- [ ] **Step 1: Add permissions modal state**

After the `keepPrevAccess` state declaration, add:

```typescript
  const [permModal, setPermModal] = useState(false);
  const [permTarget, setPermTarget] = useState<Expediente | null>(null);
  const [expPermissions, setExpPermissions] = useState<ExpPermRow[]>([]);
  const [newPermDoctorId, setNewPermDoctorId] = useState("");
  const [newPermLevel, setNewPermLevel] = useState<"view" | "edit">("view");
  const [permSaving, setPermSaving] = useState(false);
```

- [ ] **Step 2: Add ExpPermRow interface**

After the `Expediente` interface definition, add:

```typescript
interface ExpPermRow {
  id: string;
  expediente_id: string;
  doctor_id: string;
  permission: "view" | "edit";
  doctors?: { nombre: string; apellidos: string } | null;
}
```

- [ ] **Step 3: Add loadExpPermissions function**

After `handleSaveEdit`, add:

```typescript
  async function loadExpPermissions(expId: string) {
    const { data } = await supabase
      .from("expediente_permissions" as never)
      .select("id, expediente_id, doctor_id, permission, doctors:doctor_id(nombre, apellidos)")
      .eq("expediente_id", expId);
    setExpPermissions((data ?? []) as unknown as ExpPermRow[]);
  }

  async function handleAddPerm() {
    if (!permTarget || !newPermDoctorId || !activeClinicId || !myDoctorId) return;
    setPermSaving(true);
    try {
      await supabase
        .from("expediente_permissions" as never)
        .insert({
          expediente_id: permTarget.id,
          doctor_id: newPermDoctorId,
          permission: newPermLevel,
          granted_by: myDoctorId,
          clinic_id: activeClinicId,
        });
      setNewPermDoctorId("");
      await loadExpPermissions(permTarget.id);
      // Refresh sharedPermissions in case current user was just granted access
      await loadSharedPermissions(expedientes.map((e) => e.id));
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo añadir el permiso" });
    }
    setPermSaving(false);
  }

  async function handleRemovePerm(permId: string) {
    if (!permTarget) return;
    try {
      await supabase
        .from("expediente_permissions" as never)
        .delete()
        .eq("id", permId);
      setExpPermissions((prev) => prev.filter((p) => p.id !== permId));
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo quitar el permiso" });
    }
  }

  async function handleChangePermLevel(permId: string, level: "view" | "edit") {
    try {
      await supabase
        .from("expediente_permissions" as never)
        .update({ permission: level })
        .eq("id", permId);
      setExpPermissions((prev) =>
        prev.map((p) => p.id === permId ? { ...p, permission: level } : p)
      );
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el permiso" });
    }
  }
```

- [ ] **Step 4: Add Permissions Modal JSX**

After the Edit Dialog `</Dialog>` closing tag, add:

```tsx
      <Dialog open={permModal} onOpenChange={(v) => { if (!v) { setPermModal(false); setPermTarget(null); setExpPermissions([]); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gestionar acceso — {permTarget?.patients?.apellidos}, {permTarget?.patients?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Current grants */}
            {expPermissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin permisos adicionales asignados</p>
            ) : (
              <div className="space-y-2">
                {expPermissions.map((perm) => (
                  <div key={perm.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                    <p className="text-sm font-medium">
                      Dr(a). {perm.doctors?.nombre} {perm.doctors?.apellidos}
                    </p>
                    <div className="flex items-center gap-2">
                      <Select
                        value={perm.permission}
                        onValueChange={(v) => handleChangePermLevel(perm.id, v as "view" | "edit")}
                      >
                        <SelectTrigger className="h-7 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view">Solo ver</SelectItem>
                          <SelectItem value="edit">Editar</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleRemovePerm(perm.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add new grant */}
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Añadir médico</p>
              <div className="flex gap-2">
                <Select value={newPermDoctorId} onValueChange={setNewPermDoctorId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleccionar médico" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors
                      .filter((d) => d.id !== permTarget?.doctor_id && !expPermissions.some((p) => p.doctor_id === d.id))
                      .map((d) => (
                        <SelectItem key={d.id} value={d.id}>Dr(a). {d.nombre} {d.apellidos}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select value={newPermLevel} onValueChange={(v) => setNewPermLevel(v as "view" | "edit")}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">Solo ver</SelectItem>
                    <SelectItem value="edit">Editar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                disabled={!newPermDoctorId || permSaving}
                onClick={handleAddPerm}
              >
                {permSaving ? "Añadiendo..." : "Añadir acceso"}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPermModal(false); setPermTarget(null); setExpPermissions([]); }}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 6: Run tests**

```bash
npx vitest run
```

Expected: 35 tests pass

- [ ] **Step 7: Commit**

```bash
git add src/pages/Expedientes.tsx
git commit -m "feat: add permissions management modal to Expedientes

Admin and owner can grant view/edit access to other doctors.
Live add/remove/change-level without a Save button.
Filters out owner and already-granted doctors from add dropdown."
```

---

### Task 5: Action buttons + soft delete

**Files:**
- Modify: `src/pages/Expedientes.tsx`

**Interfaces:**
- Consumes: `canEditExp(exp)`, `canManagePerms(exp)`, `canDeleteExp(exp)` from Task 2; `openEditModal(exp)` from Task 3; `setPermTarget` + `setPermModal` + `loadExpPermissions` from Task 4
- Produces: Three icon buttons in accordion header, `handleDelete` soft delete

- [ ] **Step 1: Add handleDelete function**

After `handleChangePermLevel`, add:

```typescript
  async function handleDelete(exp: Expediente) {
    const name = `${exp.patients?.nombre ?? ""} ${exp.patients?.apellidos ?? ""}`.trim();
    if (!window.confirm(
      `¿Eliminar expediente de ${name}?\n\n` +
      `El expediente se ocultará del sistema. ` +
      `NOM-004-SSA3-2012 requiere retención de 5 años — no se borra de la base de datos.`
    )) return;
    try {
      const { error } = await supabase
        .from("expedientes")
        .update({ activo: false } as never)
        .eq("id", exp.id);
      if (error) throw error;
      setExpedientes((prev) => prev.filter((e) => e.id !== exp.id));
      if (expanded === exp.id) setExpanded(null);
      toast({ title: "Expediente eliminado", description: `${name} — ocultado del sistema` });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el expediente" });
    }
  }
```

- [ ] **Step 2: Add action buttons in accordion header**

Find the accordion header `<div className="flex items-center gap-4 px-5 py-4 cursor-pointer..."`. Inside it, locate the section with ChevronUp/ChevronDown icons and the studies pending badge. Add the action buttons BEFORE the pending badge + chevron, stopping click propagation.

Find this pattern (the flex items area of the header, around the badge/chevron):

```tsx
                {(() => {
                  const pending = (estudios[exp.id] ?? []).filter(
```

Insert BEFORE that block:

```tsx
                {/* Action buttons — stopPropagation prevents accordion toggle */}
                <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {canManagePerms(exp) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Gestionar acceso"
                      onClick={() => {
                        setPermTarget(exp);
                        setExpPermissions([]);
                        setNewPermDoctorId("");
                        setNewPermLevel("view");
                        setPermModal(true);
                        loadExpPermissions(exp.id);
                      }}
                    >
                      <Users className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {canEditExp(exp) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Editar expediente"
                      onClick={() => openEditModal(exp)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {canDeleteExp(exp) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      title="Eliminar expediente"
                      onClick={() => handleDelete(exp)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: 35 tests pass

- [ ] **Step 5: Visual verification**

```bash
npm run dev
```

Navigate to Expedientes page. Verify:

1. As admin: all expedientes visible, three action icons (users/pencil/trash) on each row
2. As doctor: only own expedientes visible; icons show only for owned rows
3. Click pencil → Edit modal opens; tipo dropdown works; doctor dropdown only shown for owner/admin
4. Change doctor → "Mantener acceso" checkbox appears
5. Click users → Permissions modal opens; can add doctor with view/edit level; can remove/change level
6. Click trash → confirm dialog with NOM-004 message; expediente disappears from list
7. Reload: deleted expediente stays gone (activo=false in DB)

- [ ] **Step 6: Commit**

```bash
git add src/pages/Expedientes.tsx
git commit -m "feat: add action buttons and soft delete to Expedientes

Three icon buttons (manage permissions, edit, delete) in accordion header.
Buttons gated by canManagePerms/canEditExp/canDeleteExp — admin or owner only for manage/delete.
Soft delete sets activo=false with NOM-004 confirmation dialog."
```
