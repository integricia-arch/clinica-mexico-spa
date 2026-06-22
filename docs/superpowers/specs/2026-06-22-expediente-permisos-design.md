# Expediente: Visibilidad por Rol + Permisos + Editar/Eliminar — Design Spec

**Date:** 2026-06-22
**Status:** Approved

## Goal

Doctors only see their own expedientes (plus those shared with them). Admin/owner can grant view or edit access to other doctors. Admin/owner can edit and reassign. Admin/owner can soft-delete.

## Context: Current State

- `Expedientes.tsx` loads all expedientes regardless of role (no visibility filter)
- `canWrite = hasRole("admin") || hasRole("doctor")` — no edit/delete buttons exist
- `expedientes` table has `activo` column (soft delete already supported in query)
- `expedientes.doctor_id` — the assigned/owner doctor
- No per-expediente permission system exists

## Access Matrix

| Action | Admin | Owner (assigned doctor) | Edit-granted doctor | View-granted doctor | Receptionist |
|---|---|---|---|---|---|
| Ver expediente | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver notas/estudios | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear expediente | ✅ | — | — | — | — |
| Editar tipo | ✅ | ✅ | ✅ | ❌ | ❌ |
| Reasignar doctor (nuevo owner) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Gestionar permisos compartidos | ✅ | ✅ | ❌ | ❌ | ❌ |
| Reasignar owner | ✅ | ✅ | ❌ | ❌ | ❌ |
| Eliminar (soft delete) | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## Task 1: Migration — expediente_permissions table

**File:** `supabase/migrations/{timestamp}_expediente_permissions.sql`

```sql
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

CREATE INDEX idx_exp_permissions_expediente ON public.expediente_permissions(expediente_id);
CREATE INDEX idx_exp_permissions_doctor ON public.expediente_permissions(doctor_id);

CREATE TRIGGER trg_exp_permissions_audit
AFTER INSERT OR UPDATE OR DELETE ON public.expediente_permissions
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
```

---

## Task 2: Expedientes.tsx — role visibility + permission helpers

### 2A: Determine current user's doctor profile

On mount (alongside `loadExpedientes`):

```typescript
const [myDoctorId, setMyDoctorId] = useState<string | null>(null);

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

### 2B: Role-based visibility filter in loadExpedientes

```typescript
async function loadExpedientes() {
  setLoading(true);
  try {
    const isAdmin = hasRole("admin");
    const isReceptionist = hasRole("receptionist");

    let query = "select=*,patients(nombre,apellidos,tipo_sangre,alergias),doctors(nombre,apellidos,especialidad)&activo=eq.true&order=updated_at.desc";

    // Doctor-only: filter to owned + shared expedientes
    if (!isAdmin && !isReceptionist && myDoctorId) {
      // Fetch shared expediente IDs separately
      const { data: shared } = await supabase
        .from("expediente_permissions")
        .select("expediente_id")
        .eq("doctor_id", myDoctorId);
      const sharedIds = (shared ?? []).map((r) => r.expediente_id);

      // Build OR filter: own + shared
      const ownFilter = `doctor_id.eq.${myDoctorId}`;
      const sharedFilter = sharedIds.length > 0
        ? `,id.in.(${sharedIds.join(",")})`
        : "";
      query += `&or=(${ownFilter}${sharedFilter})`;
    }

    const data = await restSelect("expedientes", query);
    setExpedientes(data ?? []);
  } catch (e: unknown) {
    toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los expedientes" });
  }
  setLoading(false);
}
```

Note: `loadExpedientes` now depends on `myDoctorId` — call it inside a `useEffect` that watches `myDoctorId`.

### 2C: Permission helpers (pure functions)

```typescript
function canEdit(exp: Expediente): boolean {
  if (hasRole("admin")) return true;
  if (myDoctorId === exp.doctor_id) return true; // owner
  if (sharedPermissions[exp.id] === "edit") return true;
  return false;
}

function canManagePermissions(exp: Expediente): boolean {
  return hasRole("admin") || myDoctorId === exp.doctor_id;
}

function canDelete(exp: Expediente): boolean {
  return hasRole("admin") || myDoctorId === exp.doctor_id;
}

function canReassign(exp: Expediente): boolean {
  return hasRole("admin") || myDoctorId === exp.doctor_id;
}
```

`sharedPermissions: Record<string, "view" | "edit">` — loaded once when expedientes load:

```typescript
const [sharedPermissions, setSharedPermissions] = useState<Record<string, "view" | "edit">>({});

// After loading expedientes, load shared permissions for this doctor:
async function loadSharedPermissions(expIds: string[]) {
  if (!myDoctorId || expIds.length === 0) return;
  const { data } = await supabase
    .from("expediente_permissions")
    .select("expediente_id, permission")
    .eq("doctor_id", myDoctorId)
    .in("expediente_id", expIds);
  const map: Record<string, "view" | "edit"> = {};
  (data ?? []).forEach((r) => { map[r.expediente_id] = r.permission as "view" | "edit"; });
  setSharedPermissions(map);
}
```

---

## Task 3: Expedientes.tsx — Edit modal

Reuse the existing "Nuevo expediente" Dialog pattern. New state:

```typescript
const [editModal, setEditModal] = useState(false);
const [editTarget, setEditTarget] = useState<Expediente | null>(null);
const [editForm, setEditForm] = useState({ doctor_id: "", tipo: "primera_vez" });
```

Open edit: sets `editTarget` and `editForm` from the expediente, opens modal.

Save edit:
```typescript
async function handleSaveEdit() {
  if (!editTarget) return;
  setSaving(true);
  try {
    await supabase
      .from("expedientes")
      .update({ doctor_id: editForm.doctor_id, tipo: editForm.tipo })
      .eq("id", editTarget.id);

    // If doctor reassigned and user wants to keep old doctor as edit-granted:
    // (handled by "Mantener acceso" checkbox — inserts into expediente_permissions)

    setExpedientes((prev) =>
      prev.map((e) =>
        e.id === editTarget.id
          ? { ...e, doctor_id: editForm.doctor_id, tipo: editForm.tipo,
              doctors: doctors.find((d) => d.id === editForm.doctor_id) ?? e.doctors }
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

Edit modal fields:
- **Tipo** — Select dropdown (same options as create modal) — visible to owner+edit-granted+admin
- **Médico responsable** — Select dropdown with all active doctors — visible only if `canReassign(exp)` (admin or owner)
- **Mantener acceso de edición al médico anterior** — Checkbox, shown only when `doctor_id` changes — inserts `{ expediente_id, doctor_id: originalDoctorId, permission: "edit", clinic_id }` into `expediente_permissions`

---

## Task 4: Expedientes.tsx — Manage permissions modal

New component (inline in Expedientes.tsx): `PermissionsModal`

State:
```typescript
const [permModal, setPermModal] = useState(false);
const [permTarget, setPermTarget] = useState<Expediente | null>(null);
const [expPermissions, setExpPermissions] = useState<PermissionRow[]>([]);
```

```typescript
interface PermissionRow {
  id: string;
  doctor_id: string;
  permission: "view" | "edit";
  doctors?: { nombre: string; apellidos: string } | null;
}
```

Load: when modal opens, fetch `expediente_permissions WHERE expediente_id = permTarget.id` with doctor join.

UI:
- List of granted doctors with their permission level + "Quitar" button
- "Añadir médico" row: Select doctor (excludes owner and already-granted) + Select permission (view/edit) + "Añadir" button
- Save is immediate (each add/remove hits DB directly, no "Save" button needed)

Operations:
```typescript
// Add permission
await supabase.from("expediente_permissions").insert({
  expediente_id: permTarget.id,
  doctor_id: selectedDoctorId,
  permission: selectedPermission,
  granted_by: myDoctorId,
  clinic_id: activeClinicId,
});

// Remove permission
await supabase.from("expediente_permissions").delete().eq("id", row.id);

// Change permission level
await supabase
  .from("expediente_permissions")
  .update({ permission: newLevel })
  .eq("id", row.id);
```

---

## Task 5: Expedientes.tsx — Delete (soft delete) + action buttons in accordion header

### Soft delete

```typescript
async function handleDelete(exp: Expediente) {
  if (!window.confirm(
    `¿Eliminar expediente de ${exp.patients?.nombre} ${exp.patients?.apellidos}? ` +
    `El expediente se ocultará del sistema. NOM-004 requiere retención de 5 años — no se borra de la base de datos.`
  )) return;
  try {
    await supabase.from("expedientes").update({ activo: false }).eq("id", exp.id);
    setExpedientes((prev) => prev.filter((e) => e.id !== exp.id));
    toast({ title: "Expediente eliminado" });
  } catch {
    toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el expediente" });
  }
}
```

### Action buttons in accordion header

Add three icon buttons to the right of the header row (before ChevronUp/Down), conditional by permission:

```tsx
{/* Action buttons — stop propagation so they don't toggle the accordion */}
<div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
  {canManagePermissions(exp) && (
    <Button variant="ghost" size="icon" className="h-7 w-7" title="Gestionar acceso"
      onClick={() => { setPermTarget(exp); setPermModal(true); }}>
      <Users className="h-3.5 w-3.5" />
    </Button>
  )}
  {canEdit(exp) && (
    <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar expediente"
      onClick={() => openEditModal(exp)}>
      <Pencil className="h-3.5 w-3.5" />
    </Button>
  )}
  {canDelete(exp) && (
    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Eliminar expediente"
      onClick={() => handleDelete(exp)}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  )}
</div>
```

Icons needed: `Users`, `Trash2` (add to lucide imports; `Pencil` already imported)

---

## Out of Scope (YAGNI)

- Notifications when permissions granted/revoked
- Permission change history/audit trail in UI (audit_trigger logs it in DB)
- Per-nota or per-estudio permissions
- Bulk reassignment
- Permission expiry dates

---

## Security Notes

- `expediente_permissions` RLS scoped by `clinic_id` via `clinic_memberships` — same pattern as M2
- Soft delete (`activo=false`) satisfies NOM-004 retention — no physical DELETE
- Doctor visibility filter enforced at query layer (frontend) + RLS at DB layer
- `canEdit`, `canManagePermissions`, `canDelete` are pure helpers — evaluated client-side from already-loaded data; server-side RLS is the real gate

---

## File Map

| File | Action |
|---|---|
| `supabase/migrations/{ts}_expediente_permissions.sql` | Create |
| `src/pages/Expedientes.tsx` | Modify (Tasks 2-5) |
