# M2: Módulo Estudios/Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable reception to register lab/imaging results from the patient's expediente accordion, with Supabase Storage file upload, while fixing a multi-clinic RLS security gap on `patient_studies`.

**Architecture:** Add `clinic_id` column to `patient_studies` (security fix), extend `studiesService.ts` with Storage helpers (`uploadStudyFile`, `getStudyFileUrl`, `isStoragePath`), add Supabase Storage upload to `StudyResultDrawer`, and wire a studies sub-section into `Expedientes.tsx` accordion for reception.

**Tech Stack:** React 18 + TypeScript + Vite + Supabase (PostgREST + Storage) + shadcn/ui + vitest

## Global Constraints

- No new npm packages — use Supabase JS client (`@supabase/supabase-js`) already installed
- `archivo_url` uses prefix `sb:` to distinguish Storage paths from direct URLs (exact prefix, no variation)
- Storage bucket name: `estudios-resultados` (exact)
- Signed URL TTL: 3600 seconds (1 hour)
- Storage path format: `{clinic_id}/{patient_id}/{study_id}/{timestamp}-{sanitized_filename}`
- File size limit: 52428800 bytes (50 MB)
- Allowed MIME types: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `application/zip`, `application/xml`, `application/dicom`
- All RLS on `patient_studies` must filter by `clinic_id` via `clinic_memberships`
- No types.ts regeneration in this plan — keep existing `any` casts in `studiesService.ts`
- Test runner: `npx vitest run` — test files in `src/test/`
- TypeScript check: `npx tsc --noEmit` must pass after each task
- Caveman mode active — responses terse, code blocks unchanged

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260622120000_patient_studies_clinic_scope.sql` | Create | `clinic_id` column, RLS fix, Storage bucket |
| `src/features/panel-doctor/services/studiesService.ts` | Modify | `isStoragePath`, `uploadStudyFile`, `getStudyFileUrl`; update `PatientStudy` + `listStudiesByPatient` + `requestStudy` |
| `src/features/panel-doctor/hooks/usePatientClinicalSnapshot.ts` | Modify | Add `clinicId` param, pass to `listStudiesByPatient` |
| `src/pages/PanelDoctor.tsx` | Modify | Add `useActiveClinic()`, pass `activeClinicId` to `usePatientClinicalSnapshot` |
| `src/features/panel-doctor/components/DoctorActionPanel.tsx` | Modify | Add `useActiveClinic()`, pass `clinicId` to RequestStudyDrawer + StudyResultDrawer |
| `src/features/panel-doctor/components/RequestStudyDrawer.tsx` | Modify | Add `clinicId` prop, pass to `requestStudy` |
| `src/features/panel-doctor/components/StudyResultDrawer.tsx` | Modify | Add `clinicId` prop, add Supabase Storage upload button, smart URL open |
| `src/pages/Expedientes.tsx` | Modify | Studies accordion section, `StudyRow` inline component, pending badge |
| `src/test/studiesService.test.ts` | Create | Unit tests for `isStoragePath` |

---

### Task 1: Migration — clinic_id + RLS + Storage bucket

**Files:**
- Create: `supabase/migrations/20260622120000_patient_studies_clinic_scope.sql`

**Interfaces:**
- Consumes: existing `patient_studies` table, `clinic_memberships` table, `patients.clinic_id`
- Produces: `patient_studies.clinic_id` column (NOT NULL uuid FK), new RLS policies, `estudios-resultados` Storage bucket

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260622120000_patient_studies_clinic_scope.sql` with this exact content:

```sql
-- M2: Add clinic_id to patient_studies + fix RLS + create Storage bucket
-- Security: old RLS used is_clinic_staff (role-only, not clinic-scoped)

-- 1. Add clinic_id column (nullable first, then backfill, then NOT NULL)
ALTER TABLE public.patient_studies
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT;

-- 2. Backfill from patients.clinic_id
UPDATE public.patient_studies ps
SET clinic_id = p.clinic_id
FROM public.patients p
WHERE ps.patient_id = p.id
  AND ps.clinic_id IS NULL;

-- 3. Enforce NOT NULL now that backfill is done
ALTER TABLE public.patient_studies
  ALTER COLUMN clinic_id SET NOT NULL;

-- 4. Index for clinic-scoped queries
CREATE INDEX IF NOT EXISTS idx_patient_studies_clinic_patient
  ON public.patient_studies(clinic_id, patient_id, solicitado_at DESC);

-- 5. Drop old RLS policies (role-only, not clinic-scoped)
DROP POLICY IF EXISTS "Staff manage patient_studies" ON public.patient_studies;
DROP POLICY IF EXISTS "Patient view own studies" ON public.patient_studies;

-- 6. New RLS: clinic_memberships-based (proper multi-tenant scope)
CREATE POLICY "Clinic staff manage patient_studies"
ON public.patient_studies FOR ALL TO authenticated
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

CREATE POLICY "Patient view own studies"
ON public.patient_studies FOR SELECT TO authenticated
USING (
  patient_id IN (
    SELECT id FROM public.patients WHERE user_id = auth.uid()
  )
);

-- 7. Storage bucket: estudios-resultados (private, 50 MB, specific MIME types)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'estudios-resultados',
  'estudios-resultados',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/zip',
    'application/xml',
    'application/dicom'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 8. Storage RLS: clinic staff can upload (path must start with their clinic_id)
CREATE POLICY "Clinic staff upload estudios"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'estudios-resultados'
  AND (storage.foldername(name))[1] IN (
    SELECT clinic_id::text FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- 9. Storage RLS: clinic members can read their clinic's files
CREATE POLICY "Clinic staff read estudios"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'estudios-resultados'
  AND (storage.foldername(name))[1] IN (
    SELECT clinic_id::text FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
```

- [ ] **Step 2: Verify TypeScript still compiles (no TS changes in this task)**

```bash
npx tsc --noEmit
```

Expected: no errors (no TypeScript files changed)

- [ ] **Step 3: Commit the migration**

```bash
git add supabase/migrations/20260622120000_patient_studies_clinic_scope.sql
git commit -m "feat: add clinic_id to patient_studies + fix RLS + Storage bucket

- patient_studies had no clinic scope (is_clinic_staff checks role only)
- backfills clinic_id from patients.clinic_id then sets NOT NULL
- new RLS uses clinic_memberships for proper multi-tenant isolation
- creates estudios-resultados Storage bucket (private, 50MB, pdf/img)"
```

> **Note for deployment:** Apply this migration with `supabase db push --linked` before deploying Tasks 2-4. The `clinic_id NOT NULL` constraint will cause new inserts to fail until Task 2 (which adds `clinic_id` to `requestStudy`) is deployed simultaneously. Deploy Tasks 1-4 together in one deploy.

---

### Task 2: studiesService.ts + callers

**Files:**
- Modify: `src/features/panel-doctor/services/studiesService.ts`
- Modify: `src/features/panel-doctor/hooks/usePatientClinicalSnapshot.ts`
- Modify: `src/features/panel-doctor/components/DoctorActionPanel.tsx`
- Modify: `src/features/panel-doctor/components/RequestStudyDrawer.tsx`
- Create: `src/test/studiesService.test.ts`

**Interfaces:**
- Consumes: `supabase` client from `@/integrations/supabase/client`, `PatientStudy` interface
- Produces:
  - `isStoragePath(url: string): boolean` — exported pure helper
  - `uploadStudyFile(clinicId, patientId, studyId, file): Promise<string>` — returns `sb:{path}`
  - `getStudyFileUrl(archivoUrl: string): Promise<string>` — returns direct URL or signed URL
  - `listStudiesByPatient(patientId: string, clinicId: string): Promise<PatientStudy[]>`
  - `requestStudy(input: { ..., clinic_id: string }): Promise<PatientStudy>`
  - `PatientStudy` interface gains `clinic_id: string`

- [ ] **Step 1: Write the failing test first**

Create `src/test/studiesService.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isStoragePath } from "../features/panel-doctor/services/studiesService";

describe("isStoragePath", () => {
  it("returns true for sb: prefix", () => {
    expect(isStoragePath("sb:estudios-resultados/clinic-id/patient-id/study-id/1234-file.pdf")).toBe(true);
  });

  it("returns false for http URLs", () => {
    expect(isStoragePath("http://localhost:3001/files/test.pdf")).toBe(false);
  });

  it("returns false for https URLs", () => {
    expect(isStoragePath("https://example.com/file.pdf")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isStoragePath("")).toBe(false);
  });

  it("returns false for partial prefix", () => {
    expect(isStoragePath("s:path")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
npx vitest run src/test/studiesService.test.ts
```

Expected: FAIL — `isStoragePath is not a function` (not exported yet)

- [ ] **Step 3: Update studiesService.ts**

Replace the full content of `src/features/panel-doctor/services/studiesService.ts`:

```typescript
import { supabase } from "@/integrations/supabase/client";

// Tipos locales (la tabla no está aún en types.ts generados)
export interface PatientStudy {
  id: string;
  patient_id: string;
  doctor_id: string;
  clinic_id: string;
  appointment_id: string | null;
  journey_instance_id: string | null;
  expediente_id: string | null;
  consultation_note_id: string | null;
  tipo: "lab" | "imagen" | "otro";
  nombre: string;
  motivo: string | null;
  prioridad: "rutina" | "urgente" | "stat";
  area_laboratorio: string | null;
  requiere_ayuno: boolean;
  indicaciones_paciente: string | null;
  observaciones: string | null;
  status: "solicitado" | "recibido" | "revisado" | "reutilizado" | "descartado";
  solicitado_at: string;
  solicitado_por: string | null;
  recibido_at: string | null;
  recibido_por: string | null;
  revisado_at: string | null;
  revisado_por: string | null;
  resultado_resumen: string | null;
  interpretacion_medica: string | null;
  archivo_url: string | null;
  laboratorio_origen: string | null;
  replaces_study_id: string | null;
  justificacion_repeticion: string | null;
  created_at: string;
  updated_at: string;
}

// patient_studies is not yet in the generated Supabase types — suppress until regenerated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => supabase.from(name as any);

const BUCKET = "estudios-resultados";

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Returns true if the url is a Supabase Storage path (sb: prefix), false for direct URLs */
export function isStoragePath(url: string): boolean {
  return url.startsWith("sb:");
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

/**
 * Uploads a file to Supabase Storage under the clinic/patient/study path.
 * Returns the archivo_url value to store in patient_studies: "sb:{path}"
 */
export async function uploadStudyFile(
  clinicId: string,
  patientId: string,
  studyId: string,
  file: File,
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

/**
 * Resolves archivo_url to an accessible URL.
 * - sb:{path} → signed URL valid for 1 hour
 * - any other string → returned as-is (local server URL, manual URL)
 */
export async function getStudyFileUrl(archivoUrl: string): Promise<string> {
  if (!isStoragePath(archivoUrl)) return archivoUrl;
  const path = archivoUrl.slice(3);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function listStudiesByPatient(
  patientId: string,
  clinicId: string,
): Promise<PatientStudy[]> {
  const { data, error } = await tbl("patient_studies")
    .select("*")
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .order("solicitado_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PatientStudy[];
}

export async function listStudiesByJourney(journeyId: string): Promise<PatientStudy[]> {
  const { data, error } = await tbl("patient_studies")
    .select("*")
    .eq("journey_instance_id", journeyId)
    .order("solicitado_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PatientStudy[];
}

export async function requestStudy(input: {
  patient_id: string;
  doctor_id: string;
  clinic_id: string;
  appointment_id?: string | null;
  journey_instance_id?: string | null;
  expediente_id?: string | null;
  consultation_note_id?: string | null;
  tipo: "lab" | "imagen" | "otro";
  nombre: string;
  motivo?: string | null;
  prioridad?: "rutina" | "urgente" | "stat";
  area_laboratorio?: string | null;
  requiere_ayuno?: boolean;
  indicaciones_paciente?: string | null;
  observaciones?: string | null;
  replaces_study_id?: string | null;
  justificacion_repeticion?: string | null;
}): Promise<PatientStudy> {
  const { data: u } = await supabase.auth.getUser();
  const payload = {
    ...input,
    prioridad: input.prioridad ?? "rutina",
    requiere_ayuno: input.requiere_ayuno ?? false,
    status: "solicitado",
    solicitado_por: u.user?.id ?? null,
  };
  const { data, error } = await tbl("patient_studies")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(payload as any)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as PatientStudy;
}

export async function registerStudyResult(
  studyId: string,
  payload: {
    resultado_resumen?: string | null;
    archivo_url?: string | null;
    laboratorio_origen?: string | null;
    observaciones?: string | null;
  },
): Promise<PatientStudy> {
  const { data: u } = await supabase.auth.getUser();
  const updatePayload = {
    ...payload,
    status: "recibido",
    recibido_at: new Date().toISOString(),
    recibido_por: u.user?.id ?? null,
  };
  const { data, error } = await tbl("patient_studies")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updatePayload as any)
    .eq("id", studyId)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as PatientStudy;
}

export async function reviewStudy(
  studyId: string,
  payload: { interpretacion_medica: string },
): Promise<PatientStudy> {
  const { data: u } = await supabase.auth.getUser();
  const updatePayload = {
    interpretacion_medica: payload.interpretacion_medica,
    status: "revisado",
    revisado_at: new Date().toISOString(),
    revisado_por: u.user?.id ?? null,
  };
  const { data, error } = await tbl("patient_studies")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updatePayload as any)
    .eq("id", studyId)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as PatientStudy;
}

export function hasPendingStudies(studies: PatientStudy[]): boolean {
  return studies.some((s) => s.status === "solicitado");
}

export function hasUnreviewedResults(studies: PatientStudy[]): boolean {
  return studies.some((s) => s.status === "recibido");
}
```

- [ ] **Step 4: Run the test — expect pass**

```bash
npx vitest run src/test/studiesService.test.ts
```

Expected: 5 tests pass

- [ ] **Step 5: Update usePatientClinicalSnapshot.ts**

In `src/features/panel-doctor/hooks/usePatientClinicalSnapshot.ts`, change the function signature and the `listStudiesByPatient` call:

Change line 53:
```typescript
// OLD:
export function usePatientClinicalSnapshot(patientId: string | null, doctorId: string | null): PatientSnapshot {

// NEW:
export function usePatientClinicalSnapshot(patientId: string | null, doctorId: string | null, clinicId: string | null): PatientSnapshot {
```

Change line 92 (the `listStudiesByPatient` call inside `Promise.all`):
```typescript
// OLD:
        listStudiesByPatient(patientId),

// NEW:
        clinicId ? listStudiesByPatient(patientId, clinicId) : Promise.resolve([]),
```

- [ ] **Step 6: Update DoctorActionPanel.tsx**

In `src/features/panel-doctor/components/DoctorActionPanel.tsx`:

Add import at top:
```typescript
import { useActiveClinic } from "@/hooks/useActiveClinic";
```

Add hook call inside the component (after line 30 — after `const patientId = item.patient?.id ?? null;`):
```typescript
  const { activeClinicId } = useActiveClinic();
```

Update `usePatientClinicalSnapshot` call — the hook is not called directly in `DoctorActionPanel` (it receives `snapshot` as a prop). So we only need to:
1. Pass `clinicId` to `RequestStudyDrawer`
2. Pass `clinicId` to `StudyResultDrawer`

Update `RequestStudyDrawer` usage (around line 178):
```typescript
      <RequestStudyDrawer
        open={studyOpen}
        onClose={() => setStudyOpen(false)}
        patientId={patientId}
        doctorId={doctorId}
        clinicId={activeClinicId ?? ""}
        appointmentId={item.appointment_id}
        journeyInstanceId={journeyId}
        expedienteId={expId}
        onCreated={() => snapshot.reload()}
      />
```

Update `StudyResultDrawer` usage (around line 197):
```typescript
      <StudyResultDrawer
        open={!!resultStudy}
        onClose={() => setResultStudy(null)}
        study={resultStudy}
        clinicId={activeClinicId ?? ""}
        journeyInstanceId={journeyId}
        onSaved={() => snapshot.reload()}
      />
```

- [ ] **Step 7: Update PanelDoctor.tsx — the only caller of usePatientClinicalSnapshot**

In `src/pages/PanelDoctor.tsx`:

Add import (after line 10):
```typescript
import { useActiveClinic } from "@/hooks/useActiveClinic";
```

Add hook call inside `PanelDoctor` component (after line 15 — after `const isAdmin = ...`):
```typescript
  const { activeClinicId } = useActiveClinic();
```

Change line 48:
```typescript
// OLD:
  const snapshot = usePatientClinicalSnapshot(selected?.patient?.id ?? null, doctorId);

// NEW:
  const snapshot = usePatientClinicalSnapshot(selected?.patient?.id ?? null, doctorId, activeClinicId);
```

- [ ] **Step 8: Update RequestStudyDrawer.tsx**

In `src/features/panel-doctor/components/RequestStudyDrawer.tsx`:

Add `clinicId: string` to the `Props` interface:
```typescript
interface Props {
  open: boolean;
  onClose: () => void;
  patientId: string;
  doctorId: string;
  clinicId: string;
  appointmentId?: string | null;
  journeyInstanceId?: string | null;
  expedienteId?: string | null;
  onCreated?: () => void;
}
```

Destructure `clinicId` from props:
```typescript
export default function RequestStudyDrawer({
  open, onClose, patientId, doctorId, clinicId, appointmentId, journeyInstanceId, expedienteId, onCreated,
}: Props) {
```

Update the `requestStudy` call inside `submit` (add `clinic_id`):
```typescript
      const study = await requestStudy({
        patient_id: patientId,
        doctor_id: doctorId,
        clinic_id: clinicId,
        appointment_id: appointmentId ?? null,
        journey_instance_id: journeyInstanceId ?? null,
        expediente_id: expedienteId ?? null,
        tipo, nombre, motivo: motivo || null, prioridad,
        requiere_ayuno: ayuno,
        indicaciones_paciente: indicaciones || null,
      });
```

- [ ] **Step 9: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 10: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass (5 new + 27 existing = 32 total)

- [ ] **Step 11: Commit**

```bash
git add src/features/panel-doctor/services/studiesService.ts \
        src/features/panel-doctor/hooks/usePatientClinicalSnapshot.ts \
        src/features/panel-doctor/components/DoctorActionPanel.tsx \
        src/features/panel-doctor/components/RequestStudyDrawer.tsx \
        src/test/studiesService.test.ts
git commit -m "feat: extend studiesService with Storage helpers + clinic_id

- add isStoragePath(), uploadStudyFile(), getStudyFileUrl() 
- listStudiesByPatient now requires clinicId param (defense-in-depth)
- requestStudy now requires clinic_id (required after migration)
- propagate clinicId to usePatientClinicalSnapshot and RequestStudyDrawer
- 5 unit tests for isStoragePath"
```

---

### Task 3: StudyResultDrawer.tsx — Supabase Storage upload

**Files:**
- Modify: `src/features/panel-doctor/components/StudyResultDrawer.tsx`

**Interfaces:**
- Consumes:
  - `uploadStudyFile(clinicId, patientId, studyId, file): Promise<string>` from Task 2
  - `getStudyFileUrl(archivoUrl: string): Promise<string>` from Task 2
  - `isStoragePath(url: string): boolean` from Task 2
- Produces: `StudyResultDrawer` with `clinicId: string` prop, Supabase Storage upload, smart file open

- [ ] **Step 1: Replace StudyResultDrawer.tsx**

Replace full content of `src/features/panel-doctor/components/StudyResultDrawer.tsx`:

```typescript
import { useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/errors";
import {
  registerStudyResult,
  reviewStudy,
  uploadStudyFile,
  getStudyFileUrl,
  isStoragePath,
  type PatientStudy,
} from "../services/studiesService";
import { advancePatientJourneyFromClinicalEvent } from "@/features/camino-paciente/services/clinicalEvents";
import { Cloud, HardDrive, Link, ExternalLink } from "lucide-react";

const LOCAL_SERVER_URL = import.meta.env.VITE_LOCAL_FILE_SERVER ?? "http://localhost:3001";
const LOCAL_SERVER_KEY = import.meta.env.VITE_LOCAL_FILE_SERVER_KEY ?? "clinica-local-2024";

interface Props {
  open: boolean;
  onClose: () => void;
  study: PatientStudy | null;
  clinicId: string;
  journeyInstanceId?: string | null;
  onSaved?: () => void;
}

export default function StudyResultDrawer({
  open, onClose, study, clinicId, journeyInstanceId, onSaved,
}: Props) {
  const { toast } = useToast();
  const [resumen, setResumen] = useState(study?.resultado_resumen ?? "");
  const [archivoUrl, setArchivoUrl] = useState(study?.archivo_url ?? "");
  const [laboratorio, setLaboratorio] = useState(study?.laboratorio_origen ?? "");
  const [interpretacion, setInterpretacion] = useState(study?.interpretacion_medica ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const cloudInputRef = useRef<HTMLInputElement>(null);
  const localInputRef = useRef<HTMLInputElement>(null);

  const uploadToCloud = async (file: File) => {
    if (!study) return;
    setUploading(true);
    try {
      const url = await uploadStudyFile(clinicId, study.patient_id, study.id, file);
      setArchivoUrl(url);
      toast({ title: "Archivo subido a nube", description: "Guardado en Supabase Storage" });
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Error al subir a nube",
        description: e instanceof Error ? e.message : "Error desconocido",
      });
    } finally {
      setUploading(false);
    }
  };

  const uploadToLocal = async (file: File) => {
    setUploading(true);
    try {
      const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const resp = await fetch(`${LOCAL_SERVER_URL}/upload/${encodeURIComponent(safeName)}`, {
        method: "PUT",
        headers: { "X-API-Key": LOCAL_SERVER_KEY, "Content-Type": "application/octet-stream" },
        body: file,
      });
      if (!resp.ok) throw new Error(`Servidor local respondió ${resp.status}`);
      const { url } = await resp.json();
      setArchivoUrl(url);
      toast({ title: "Archivo guardado localmente", description: url });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        variant: "destructive",
        title: "Error al subir al servidor local",
        description: msg + ". Verifica que el servidor esté corriendo: node scripts/local-file-server.cjs",
      });
    } finally {
      setUploading(false);
    }
  };

  const openFile = async () => {
    if (!archivoUrl) return;
    try {
      const url = await getStudyFileUrl(archivoUrl);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Error al abrir archivo",
        description: e instanceof Error ? e.message : "No se pudo obtener la URL",
      });
    }
  };

  if (!study) return null;

  const doRegister = async () => {
    setSaving(true);
    try {
      await registerStudyResult(study.id, {
        resultado_resumen: resumen || null,
        archivo_url: archivoUrl || null,
        laboratorio_origen: laboratorio || null,
      });
      if (journeyInstanceId) {
        await advancePatientJourneyFromClinicalEvent("study_received", {
          journey_instance_id: journeyInstanceId,
          study_id: study.id,
        });
      }
      toast({ title: "Resultado registrado" });
      onSaved?.();
      onClose();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: friendlyError(e) });
    } finally {
      setSaving(false);
    }
  };

  const doReview = async () => {
    if (!interpretacion.trim()) {
      toast({ variant: "destructive", title: "Falta interpretación médica" });
      return;
    }
    setSaving(true);
    try {
      await reviewStudy(study.id, { interpretacion_medica: interpretacion });
      if (journeyInstanceId) {
        await advancePatientJourneyFromClinicalEvent("study_reviewed", {
          journey_instance_id: journeyInstanceId,
          study_id: study.id,
        });
      }
      toast({ title: "Estudio revisado" });
      onSaved?.();
      onClose();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: friendlyError(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{study.nombre}</SheetTitle>
          <p className="text-xs text-muted-foreground capitalize">
            {study.tipo} · {study.prioridad} · {study.status}
          </p>
        </SheetHeader>

        <div className="space-y-3 py-4">
          {study.status === "solicitado" && (
            <>
              <div>
                <Label className="text-xs">Resumen del resultado</Label>
                <Textarea value={resumen} onChange={(e) => setResumen(e.target.value)} rows={4} />
              </div>

              <div>
                <Label className="text-xs">Archivo del estudio</Label>
                <div className="space-y-2 mt-1">
                  {/* Option 1: Supabase Storage (cloud) */}
                  <input
                    ref={cloudInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.dcm,.zip,.xml"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadToCloud(f); }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    disabled={uploading}
                    onClick={() => cloudInputRef.current?.click()}
                  >
                    <Cloud className="h-3.5 w-3.5" />
                    {uploading ? "Subiendo…" : "Subir a nube (Supabase)"}
                  </Button>

                  {/* Option 2: Local server */}
                  <input
                    ref={localInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.dcm,.zip,.xml"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadToLocal(f); }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 text-muted-foreground"
                    disabled={uploading}
                    onClick={() => localInputRef.current?.click()}
                  >
                    <HardDrive className="h-3.5 w-3.5" />
                    {uploading ? "Subiendo…" : "Guardar en servidor local"}
                  </Button>

                  {/* Option 3: Manual URL */}
                  <div className="flex items-center gap-2">
                    <Link className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <Input
                      value={archivoUrl}
                      onChange={(e) => setArchivoUrl(e.target.value)}
                      placeholder="Pegar URL directa (Drive, red interna, etc.)"
                      className="text-xs"
                    />
                  </div>

                  {archivoUrl && (
                    <button
                      type="button"
                      onClick={openFile}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {isStoragePath(archivoUrl) ? "Abrir desde nube" : "Abrir archivo"}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-xs">Laboratorio de origen</Label>
                <Input value={laboratorio} onChange={(e) => setLaboratorio(e.target.value)} />
              </div>
            </>
          )}

          {study.status === "recibido" && (
            <>
              {study.resultado_resumen && (
                <div className="rounded-md border border-border p-3 text-xs">
                  <p className="font-medium mb-1">Resultado</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">{study.resultado_resumen}</p>
                </div>
              )}
              {study.archivo_url && (
                <button
                  type="button"
                  onClick={openFile}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {isStoragePath(study.archivo_url) ? "Ver archivo (nube)" : "Ver archivo"}
                </button>
              )}
              <div>
                <Label className="text-xs">Interpretación médica</Label>
                <Textarea
                  value={interpretacion}
                  onChange={(e) => setInterpretacion(e.target.value)}
                  rows={5}
                />
              </div>
            </>
          )}

          {study.status === "revisado" && (
            <div className="text-xs text-muted-foreground space-y-2">
              <p className="rounded-md border border-border p-3">
                <span className="font-medium">Resultado:</span> {study.resultado_resumen ?? "—"}
              </p>
              {study.archivo_url && (
                <button
                  type="button"
                  onClick={openFile}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {isStoragePath(study.archivo_url) ? "Ver archivo (nube)" : "Ver archivo"}
                </button>
              )}
              <p className="rounded-md border border-border p-3">
                <span className="font-medium">Interpretación:</span>{" "}
                {study.interpretacion_medica ?? "—"}
              </p>
            </div>
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cerrar
          </Button>
          {study.status === "solicitado" && (
            <Button onClick={doRegister} disabled={saving}>
              Registrar resultado
            </Button>
          )}
          {study.status === "recibido" && (
            <Button onClick={doReview} disabled={saving}>
              Marcar revisado
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/features/panel-doctor/components/StudyResultDrawer.tsx
git commit -m "feat: add Supabase Storage upload to StudyResultDrawer

Three upload options: cloud (Supabase Storage), local server, manual URL.
'Ver archivo' resolves sb: paths to signed URLs (1h TTL) via getStudyFileUrl.
Adds clinicId prop required for uploadStudyFile path construction."
```

---

### Task 4: Expedientes.tsx — Studies accordion section

**Files:**
- Modify: `src/pages/Expedientes.tsx`

**Interfaces:**
- Consumes:
  - `listStudiesByPatient(patientId, clinicId): Promise<PatientStudy[]>` from Task 2
  - `getStudyFileUrl(archivoUrl): Promise<string>` from Task 2
  - `isStoragePath(url): boolean` from Task 2
  - `StudyResultDrawer` component from Task 3 (requires `clinicId` prop)
  - `useActiveClinic()` → `{ activeClinicId: string | null }`
  - `useAuth()` → `{ hasRole }` (already imported in Expedientes.tsx)
  - `PatientStudy` type from Task 2
- Produces: Studies section in each expediente accordion, pending studies badge, reception registers results

- [ ] **Step 1: Add imports to Expedientes.tsx**

At the top of `src/pages/Expedientes.tsx`, after the existing imports, add:

```typescript
import { FlaskConical, ExternalLink } from "lucide-react";
import { listStudiesByPatient, getStudyFileUrl, isStoragePath, type PatientStudy } from "@/features/panel-doctor/services/studiesService";
import StudyResultDrawer from "@/features/panel-doctor/components/StudyResultDrawer";
import { useActiveClinic } from "@/hooks/useActiveClinic";
```

- [ ] **Step 2: Add useActiveClinic hook call**

Inside the `Expedientes()` component, after `const { hasRole } = useAuth();`, add:

```typescript
  const { activeClinicId } = useActiveClinic();
```

- [ ] **Step 3: Add estudios state**

After the existing state declarations (after `saving` state), add:

```typescript
  const [estudios, setEstudios] = useState<Record<string, PatientStudy[]>>({});
  const [studyResultOpen, setStudyResultOpen] = useState(false);
  const [studySelected, setStudySelected] = useState<PatientStudy | null>(null);
  const [currentExpPatientId, setCurrentExpPatientId] = useState<string>("");
```

- [ ] **Step 4: Add loadEstudios function**

After the `loadNotas` function, add:

```typescript
  async function loadEstudios(expId: string, patientId: string) {
    if (!activeClinicId) return;
    try {
      const data = await listStudiesByPatient(patientId, activeClinicId);
      setEstudios((e) => ({ ...e, [expId]: data }));
    } catch {
      setEstudios((e) => ({ ...e, [expId]: [] }));
    }
  }
```

- [ ] **Step 5: Update toggleExpand to pass patient_id and load estudios**

Change the `toggleExpand` function signature and body:

```typescript
  function toggleExpand(expId: string, patientId: string) {
    if (expanded === expId) { setExpanded(null); return; }
    setExpanded(expId);
    loadNotas(expId);
    loadEstudios(expId, patientId);
  }
```

- [ ] **Step 6: Update the toggleExpand call in the JSX**

Find the accordion row `onClick` (around line 199):

```typescript
// OLD:
                onClick={() => toggleExpand(exp.id)}>

// NEW:
                onClick={() => toggleExpand(exp.id, exp.patient_id)}>
```

- [ ] **Step 7: Add pending studies badge to accordion header**

In the accordion header div (inside the map, after the `<ChevronDown>` / `<ChevronUp>` icons, before the closing `>`), add a badge showing pending count.

Find this block (around line 225):

```typescript
                {expanded === exp.id
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
```

Replace with:

```typescript
                {(() => {
                  const pending = (estudios[exp.id] ?? []).filter(
                    (s) => s.status === "solicitado" || s.status === "recibido"
                  ).length;
                  return pending > 0 ? (
                    <span className="flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning">
                      <FlaskConical className="h-3 w-3" />
                      {pending}
                    </span>
                  ) : null;
                })()}
                {expanded === exp.id
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
```

- [ ] **Step 8: Add estudios section inside the expanded accordion**

Find the closing `</div>` of the expanded content (after the notas section, around line 301):

```typescript
                  {/* end of notas section */}
                  </div>
                )}
              </div>
```

Replace the closing `</div>` of the expanded panel (the one that wraps everything, with `className="border-t border-border px-5 py-4 space-y-4 bg-muted/20"`) with the estudios section added before its close:

Find the pattern (the expanded panel ends at line ~300):
```typescript
                  )}
                </div>
              )}
```

The estudios section goes BEFORE the first `</div>` that closes the `border-t border-border px-5 py-4 space-y-4 bg-muted/20` div.

After the last `</div>` inside `space-y-4` (after the notas section closes), add:

```typescript
                  {/* Estudios / Laboratorio */}
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <FlaskConical className="h-4 w-4 text-muted-foreground" />
                        Estudios / Laboratorio
                      </p>
                    </div>
                    {!estudios[exp.id] ? (
                      <p className="text-xs text-muted-foreground">Cargando...</p>
                    ) : estudios[exp.id].length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin estudios solicitados</p>
                    ) : (
                      <div className="space-y-2">
                        {estudios[exp.id].map((study) => (
                          <StudyRow
                            key={study.id}
                            study={study}
                            canRegister={hasRole("admin") || hasRole("receptionist")}
                            onRegister={() => {
                              setStudySelected(study);
                              setCurrentExpPatientId(exp.patient_id);
                              setStudyResultOpen(true);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
```

- [ ] **Step 9: Add StudyResultDrawer to the component's modal section**

After the `</PrescriptionEditorModal>` closing tag (at the bottom of the return, before the final `</div>`), add:

```typescript
      <StudyResultDrawer
        open={studyResultOpen}
        onClose={() => setStudyResultOpen(false)}
        study={studySelected}
        clinicId={activeClinicId ?? ""}
        onSaved={() => {
          if (expanded && currentExpPatientId) {
            loadEstudios(expanded, currentExpPatientId);
          }
        }}
      />
```

- [ ] **Step 10: Add StudyRow component at the bottom of the file**

At the very bottom of `Expedientes.tsx`, after the existing `SoapField` component, add:

```typescript
const STUDY_STATUS_COLORS: Record<string, string> = {
  solicitado: "bg-warning/10 text-warning",
  recibido: "bg-blue-500/10 text-blue-600",
  revisado: "bg-success/10 text-success",
  reutilizado: "bg-muted text-muted-foreground",
  descartado: "bg-muted text-muted-foreground",
};

const STUDY_STATUS_LABELS: Record<string, string> = {
  solicitado: "Pendiente",
  recibido: "Resultado recibido",
  revisado: "Revisado",
  reutilizado: "Reutilizado",
  descartado: "Descartado",
};

const STUDY_TIPO_LABELS: Record<string, string> = {
  lab: "Lab",
  imagen: "Imagen",
  otro: "Otro",
};

function StudyRow({
  study,
  canRegister,
  onRegister,
}: {
  study: PatientStudy;
  canRegister: boolean;
  onRegister: () => void;
}) {
  const handleOpenFile = async () => {
    if (!study.archivo_url) return;
    try {
      const url = await getStudyFileUrl(study.archivo_url);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      /* silently ignore — UI shows no error for read-only view */
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-card-foreground truncate">{study.nombre}</p>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
            {STUDY_TIPO_LABELS[study.tipo] ?? study.tipo}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STUDY_STATUS_COLORS[study.status] ?? "bg-muted text-muted-foreground"}`}
          >
            {STUDY_STATUS_LABELS[study.status] ?? study.status}
          </span>
        </div>
        {study.motivo && (
          <p className="text-xs text-muted-foreground truncate">{study.motivo}</p>
        )}
        <p className="text-[10px] text-muted-foreground">
          Solicitado: {format(new Date(study.solicitado_at), "dd/MM/yyyy HH:mm", { locale: es })}
          {study.prioridad !== "rutina" && (
            <span className="ml-2 font-semibold text-destructive uppercase">{study.prioridad}</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {study.archivo_url && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={isStoragePath(study.archivo_url) ? "Ver archivo (nube)" : "Ver archivo"}
            onClick={handleOpenFile}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        )}
        {canRegister && study.status === "solicitado" && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={onRegister}
          >
            Registrar resultado
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 11: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 12: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 13: Visual verification**

Start the dev server:
```bash
npm run dev
```

Navigate to `http://localhost:8080` (or configured port) → Expedientes page.

Verify:
1. Expand an expediente that has pending studies → studies section appears below notas
2. Pending count badge shows in accordion header before expanding
3. "Registrar resultado" button visible for admin/receptionist, hidden for doctor-only roles
4. Click "Registrar resultado" → StudyResultDrawer opens with 3 upload options
5. "Subir a nube" button triggers file picker → uploads to Supabase Storage → `archivoUrl` shows `sb:{path}` prefix
6. "Abrir desde nube" button → resolves signed URL → opens in new tab
7. Estudios with `status=revisado` show green badge, `recibido` blue, `solicitado` orange

- [ ] **Step 14: Commit**

```bash
git add src/pages/Expedientes.tsx
git commit -m "feat: add estudios/lab section to expediente accordion

Reception can see pending studies per patient and register results
(upload to Supabase Storage or local server, or paste URL).
Pending count badge shown in accordion header before expanding.
StudyRow shows status, tipo, prioridad, solicitado_at, Ver archivo link."
```
