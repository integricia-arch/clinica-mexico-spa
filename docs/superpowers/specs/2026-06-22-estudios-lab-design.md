# Módulo Estudios/Lab — Design Spec

**Date:** 2026-06-22
**Status:** Approved

## Goal

Reception registers lab/imaging results from the patient's expediente. Doctor views results and opens the file from DoctorActionPanel. Storage: Supabase Storage (primary) with local-server fallback.

## Context: What Already Exists

| Artifact | Status |
|---|---|
| `patient_studies` table | Exists (migration `20260527213529`) — missing `clinic_id` |
| `studiesService.ts` | Full CRUD (requestStudy, registerStudyResult, reviewStudy, list*) |
| `RequestStudyDrawer.tsx` | Doctor requests study — wired in DoctorActionPanel |
| `StudyResultDrawer.tsx` | Register result + review — local file server upload only |
| `usePatientClinicalSnapshot.ts` | Fetches studies for panel doctor |
| Journey events | `study_requested`, `study_received`, `study_reviewed` wired |

**Security gap found:** `patient_studies` RLS uses `is_clinic_staff(auth.uid())` which checks role only (no clinic scope). Any staff from any clinic can read/write all studies. Fix: add `clinic_id` column + update RLS.

## What This Spec Adds

1. **Migration:** `clinic_id` column on `patient_studies` + RLS fix + Supabase Storage bucket
2. **studiesService.ts:** `uploadStudyFile()`, `getStudyFileUrl()`, `clinic_id` filter on queries
3. **StudyResultDrawer.tsx:** Supabase Storage upload option (alongside local server + URL)
4. **Expedientes.tsx:** Studies section in the accordion expansion (reception registers results)

## Architecture

### Data Flow

```
Doctor (DoctorActionPanel)
  → RequestStudyDrawer → requestStudy() → patient_studies status=solicitado

Reception (Expedientes.tsx, accordion expanded)
  → sees pending studies badge on expediente header
  → clicks "Registrar resultado" → StudyResultDrawer (reused component)
  → uploadStudyFile() → Supabase Storage bucket estudios-resultados
  → registerStudyResult() → patient_studies status=recibido, archivo_url=sb:{path}

Doctor (DoctorActionPanel, usePatientClinicalSnapshot)
  → sees study with status=recibido
  → "Ver archivo" → getStudyFileUrl(path) → signed URL (1h) → opens in new tab
  → "Marcar revisado" → reviewStudy() → status=revisado
```

### archivo_url Encoding

`archivo_url` stores one of three formats:
- `sb:{storage-path}` — Supabase Storage (new primary). UI calls `getStudyFileUrl()` → signed URL
- `http://...` or `https://...` — direct URL (local server or manual). UI opens directly
- Detection: `archivo_url.startsWith("sb:")` → storage path; else → direct URL

Storage path format: `{clinic_id}/{patient_id}/{study_id}/{timestamp}-{filename}`
Bucket name: `estudios-resultados`

---

## Task 1: Migration — clinic_id + RLS + Storage Bucket

**File:** `supabase/migrations/{timestamp}_patient_studies_clinic_scope.sql`

Changes:
1. Add `clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT` to `patient_studies` — with backfill via `patients.clinic_id` join
2. Drop old RLS policies on `patient_studies`
3. Create new RLS: `clinic_id IN (SELECT clinic_id FROM clinic_memberships WHERE user_id = auth.uid())`
4. Add index: `(clinic_id, patient_id, solicitado_at DESC)`
5. Create Storage bucket `estudios-resultados` (private, 50 MB per file)
6. Storage RLS: upload allowed for clinic staff, read allowed for clinic members

**Backfill SQL:**
```sql
ALTER TABLE public.patient_studies
  ADD COLUMN clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT;

UPDATE public.patient_studies ps
SET clinic_id = p.clinic_id
FROM public.patients p
WHERE ps.patient_id = p.id;

ALTER TABLE public.patient_studies
  ALTER COLUMN clinic_id SET NOT NULL;
```

**New RLS policies:**
```sql
DROP POLICY IF EXISTS "Staff manage patient_studies" ON public.patient_studies;
DROP POLICY IF EXISTS "Patient view own studies" ON public.patient_studies;

CREATE POLICY "Clinic staff manage patient_studies"
ON public.patient_studies FOR ALL TO authenticated
USING (
  clinic_id IN (
    SELECT clinic_id FROM public.clinic_memberships WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  clinic_id IN (
    SELECT clinic_id FROM public.clinic_memberships WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Patient view own studies"
ON public.patient_studies FOR SELECT TO authenticated
USING (
  patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
);
```

**Storage bucket (via Supabase SQL API / dashboard):**
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'estudios-resultados',
  'estudios-resultados',
  false,
  52428800,  -- 50 MB
  ARRAY['application/pdf','image/jpeg','image/png','image/webp','application/zip','application/xml','application/dicom']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Clinic staff upload estudios"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'estudios-resultados'
  AND (storage.foldername(name))[1] IN (
    SELECT clinic_id::text FROM public.clinic_memberships WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Clinic staff read estudios"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'estudios-resultados'
  AND (storage.foldername(name))[1] IN (
    SELECT clinic_id::text FROM public.clinic_memberships WHERE user_id = auth.uid()
  )
);
```

---

## Task 2: studiesService.ts — Storage + clinic_id

**File:** `src/features/panel-doctor/services/studiesService.ts` (modify)

Add to `PatientStudy` interface:
```typescript
clinic_id: string;
```

Update `listStudiesByPatient` to filter by `clinic_id`:
```typescript
export async function listStudiesByPatient(
  patientId: string,
  clinicId: string
): Promise<PatientStudy[]> {
  const { data, error } = await tbl("patient_studies")
    .select("*")
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .order("solicitado_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PatientStudy[];
}
```

Add `clinic_id` to `requestStudy` input and payload.

New functions:
```typescript
const BUCKET = "estudios-resultados";

export async function uploadStudyFile(
  clinicId: string,
  patientId: string,
  studyId: string,
  file: File
): Promise<string> {
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  const path = `${clinicId}/${patientId}/${studyId}/${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return `sb:${path}`;
}

export async function getStudyFileUrl(archivoUrl: string): Promise<string> {
  if (!archivoUrl.startsWith("sb:")) return archivoUrl;
  const path = archivoUrl.slice(3);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
```

---

## Task 3: StudyResultDrawer.tsx — Supabase Storage upload

**File:** `src/features/panel-doctor/components/StudyResultDrawer.tsx` (modify)

Add prop `clinicId: string` to `Props`.

Replace the file upload section with three options (in order):
1. **Supabase Storage** (primary, cloud): button `"Subir a nube (Supabase)"` → calls `uploadStudyFile(clinicId, study.patient_id, study.id, file)` → sets `archivoUrl` to `sb:{path}`
2. **Servidor local** (existing): button `"Guardar en servidor local"` → existing `uploadToLocal` logic
3. **URL manual** (existing): text input for direct URL

"Ver archivo" button: if `archivoUrl.startsWith("sb:")` → calls `getStudyFileUrl(archivoUrl)` → opens result in new tab. Else opens `archivoUrl` directly.

---

## Task 4: Expedientes.tsx — Estudios section in accordion

**File:** `src/pages/Expedientes.tsx` (modify)

State additions:
```typescript
const [estudios, setEstudios] = useState<Record<string, PatientStudy[]>>({});
const [studyResultOpen, setStudyResultOpen] = useState(false);
const [studySelected, setStudySelected] = useState<PatientStudy | null>(null);
```

Update `toggleExpand` to also load studies:
```typescript
function toggleExpand(expId: string, patientId: string) {
  if (expanded === expId) { setExpanded(null); return; }
  setExpanded(expId);
  loadNotas(expId);
  loadEstudios(expId, patientId);
}
```

New loader (uses `useActiveClinic` hook for `activeClinicId`):
```typescript
async function loadEstudios(expId: string, patientId: string) {
  try {
    const data = await listStudiesByPatient(patientId, activeClinicId);
    setEstudios((e) => ({ ...e, [expId]: data }));
  } catch {
    setEstudios((e) => ({ ...e, [expId]: [] }));
  }
}
```

Badge on accordion header: count of `estudios[exp.id]?.filter(s => s.status === "solicitado" || s.status === "recibido").length`

Estudios section (renders inside expanded accordion, below notas):

```tsx
{/* Estudios section */}
<div className="px-5 py-3 border-t border-border">
  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
    Estudios / Laboratorio
  </p>
  {!estudios[exp.id] ? (
    <p className="text-xs text-muted-foreground">Cargando…</p>
  ) : estudios[exp.id].length === 0 ? (
    <p className="text-xs text-muted-foreground">Sin estudios solicitados</p>
  ) : (
    <div className="space-y-2">
      {estudios[exp.id].map((study) => (
        <StudyRow
          key={study.id}
          study={study}
          onRegister={() => { setStudySelected(study); setStudyResultOpen(true); }}
        />
      ))}
    </div>
  )}
</div>

<StudyResultDrawer
  open={studyResultOpen}
  onClose={() => setStudyResultOpen(false)}
  study={studySelected}
  clinicId={activeClinicId}
  onSaved={() => {
    // Reload studies for the expanded expediente
    const exp = expedientes.find((e) => e.id === expanded);
    if (exp) loadEstudios(expanded!, exp.patient_id);
  }}
/>
```

`StudyRow` inline component (small, stays inside Expedientes.tsx):
- Shows: nombre, tipo chip, prioridad chip, status badge (colored), `solicitado_at` date
- Status colors: `solicitado`=orange, `recibido`=blue, `revisado`=green, `descartado`/`reutilizado`=gray
- Shows "Registrar resultado" button if `status === "solicitado"` AND user has role receptionist or admin
- Shows "Ver archivo" button if `archivo_url` is set — resolves signed URL then opens new tab
- "Registrar resultado" hidden from doctors (they use DoctorActionPanel)

Role check for "Registrar resultado": `hasRole("admin") || hasRole("receptionist")`

---

## Out of Scope (M2)

- Notifications to doctor when result arrives
- HL7/FHIR integration
- OCR of PDF results
- Google Drive / OneDrive
- Standalone `/estudios` page with global queue
- Types regeneration (types.ts) — existing `any` cast continues until team regenerates

---

## Security Decisions

| Decision | Rationale |
|---|---|
| `clinic_id` on `patient_studies` required | `is_clinic_staff` is role-only, not clinic-scoped — gap found during spec |
| Supabase Storage bucket private, no public URLs | NOM-004: expediente clínico access must be authenticated |
| Signed URLs expire in 1 hour | Link can't be shared/bookmarked beyond session |
| Storage path prefixed by `clinic_id` | Storage RLS uses folder path to enforce clinic scope |
| `sb:` prefix on stored path | Distinguishes cloud storage from direct URLs; no ambiguity |

---

## Compliance Note (NOM-004-SSA3-2012)

Estudios de laboratorio e imagen son parte del expediente clínico. Retención mínima: 5 años. Supabase (AWS us-east-1) tiene Data Processing Agreement. Supabase Storage with authenticated signed URLs satisfies access control requirements. Google Drive / Microsoft 365 require separate data-processor assessment under LFPDPPP — out of scope for M2.
