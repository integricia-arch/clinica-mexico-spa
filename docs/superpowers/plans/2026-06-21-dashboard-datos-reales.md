# Dashboard con Datos Reales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all hardcoded demo data in `Dashboard.tsx` with real Supabase queries so administrators see their clinic's actual operational data.

**Architecture:** Create a dedicated `useDashboardHoy` hook that runs 5 parallel Supabase queries for today's data, then update `Dashboard.tsx` to consume it. No DB schema changes — all required tables already exist.

**Tech Stack:** React 18, TypeScript, Supabase JS client, shadcn/ui Skeleton, date-fns, Vitest + @testing-library/react

## Global Constraints

- `activeClinicId` from `useActiveClinic()` — every query must include `.eq("clinic_id", activeClinicId)` and return empty state when `activeClinicId` is null
- Import Supabase client from `@/integrations/supabase/client`
- Import `useActiveClinic` from `@/hooks/useActiveClinic`
- `pharmacy_sales.total` is stored in centavos (integer) — divide by 100 for display
- `audit_logs` is not in the generated TS types — cast with `as unknown as "appointments"` (same pattern as `Auditoria.tsx:273`)
- Date formatting locale: `es` from `date-fns/locale`
- Run tests: `npm run test` (Vitest)
- Confirmed appointment status values: `"solicitada" | "tentativa" | "pendiente_formulario" | "confirmada" | "recordatorio_enviado" | "confirmada_paciente" | "confirmada_medico" | "cancelada" | "liberada"`
- No `tipo_consulta` column in appointments — use `motivo_consulta` (nullable) with fallback `"Consulta general"`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| **CREATE** | `src/hooks/useDashboardHoy.ts` | 5 parallel Supabase queries, data transformation, return typed state |
| **MODIFY** | `src/pages/Dashboard.tsx` | Consume hook, replace hardcoded arrays, add loading skeleton, real date |
| **CREATE** | `src/test/useDashboardHoy.test.ts` | Unit tests for data transformation helpers (pure functions) |

---

## Task 1: `useDashboardHoy` hook

**Files:**
- Create: `src/hooks/useDashboardHoy.ts`
- Create: `src/test/useDashboardHoy.test.ts`

**Interfaces:**
- Produces for Task 2:
  ```typescript
  interface CitaHoy {
    id: string;
    hora: string;           // "09:30"
    paciente: string;       // "María González"
    medico: string;         // "Dr. Carlos Mendoza"
    tipo: string;           // motivo_consulta truncado o "Consulta general"
    estado: string;         // label legible del status enum
  }

  interface ActividadItem {
    id: string;
    texto: string;
    tiempo: string;         // "Hace 12 min"
    created_at: string;
  }

  interface DashboardHoyData {
    loading: boolean;
    error: string | null;
    totalCitasHoy: number;
    citasHoy: CitaHoy[];
    ingresosHoy: number;        // centavos — dividir /100 al mostrar
    totalPacientes: number;
    alertasPendientes: number;
    citasSinConfirmar: number;
    actividadReciente: ActividadItem[];
    refresh: () => void;
  }
  ```

- [ ] **Step 1.1: Write failing tests for pure helper functions**

Create `src/test/useDashboardHoy.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

// Import the helpers we'll create
import {
  formatHora,
  formatNombrePaciente,
  formatNombreDoctor,
  mapStatusToLabel,
  mapAuditToTexto,
  tiempoRelativo,
} from "../hooks/useDashboardHoy";

describe("formatHora", () => {
  it("extracts HH:mm from ISO string", () => {
    expect(formatHora("2026-06-21T09:30:00+00:00")).toBe("09:30");
  });
  it("handles UTC midnight", () => {
    expect(formatHora("2026-06-21T00:00:00.000Z")).toBe("00:00");
  });
});

describe("formatNombrePaciente", () => {
  it("combines nombre and apellido_paterno", () => {
    expect(formatNombrePaciente("María", "González")).toBe("María González");
  });
  it("returns nombre alone when apellido null", () => {
    expect(formatNombrePaciente("Ana", null)).toBe("Ana");
  });
});

describe("formatNombreDoctor", () => {
  it("prefixes Dr. and combines name", () => {
    expect(formatNombreDoctor("Carlos", "Mendoza Ruiz")).toBe("Dr. Carlos Mendoza Ruiz");
  });
});

describe("mapStatusToLabel", () => {
  it("maps confirmada", () => {
    expect(mapStatusToLabel("confirmada")).toBe("Confirmada");
  });
  it("maps confirmada_paciente", () => {
    expect(mapStatusToLabel("confirmada_paciente")).toBe("Confirmada por paciente");
  });
  it("maps confirmada_medico", () => {
    expect(mapStatusToLabel("confirmada_medico")).toBe("Confirmada por médico");
  });
  it("maps pendiente_formulario", () => {
    expect(mapStatusToLabel("pendiente_formulario")).toBe("Pendiente de formulario");
  });
  it("maps recordatorio_enviado", () => {
    expect(mapStatusToLabel("recordatorio_enviado")).toBe("Recordatorio enviado");
  });
  it("maps solicitada", () => {
    expect(mapStatusToLabel("solicitada")).toBe("Solicitada");
  });
  it("maps cancelada", () => {
    expect(mapStatusToLabel("cancelada")).toBe("Cancelada");
  });
  it("maps tentativa", () => {
    expect(mapStatusToLabel("tentativa")).toBe("Tentativa");
  });
  it("maps liberada", () => {
    expect(mapStatusToLabel("liberada")).toBe("Liberada");
  });
  it("returns raw value for unknown status", () => {
    expect(mapStatusToLabel("unknown_status")).toBe("unknown_status");
  });
});

describe("mapAuditToTexto", () => {
  it("crear + patients", () => {
    expect(mapAuditToTexto("crear", "patients", { nombre: "Ana" })).toBe(
      "Nuevo paciente registrado: Ana"
    );
  });
  it("crear + patients without nombre in datos", () => {
    expect(mapAuditToTexto("crear", "patients", null)).toBe(
      "Nuevo paciente registrado"
    );
  });
  it("crear + appointments", () => {
    expect(mapAuditToTexto("crear", "appointments", null)).toBe("Cita agendada");
  });
  it("actualizar + appointments", () => {
    expect(mapAuditToTexto("actualizar", "appointments", null)).toBe("Cita actualizada");
  });
  it("crear + pharmacy_sales", () => {
    expect(mapAuditToTexto("crear", "pharmacy_sales", null)).toBe(
      "Venta registrada en farmacia"
    );
  });
  it("crear + notas_consulta", () => {
    expect(mapAuditToTexto("crear", "notas_consulta", null)).toBe(
      "Nota clínica registrada"
    );
  });
  it("crear + expedientes", () => {
    expect(mapAuditToTexto("crear", "expedientes", null)).toBe("Expediente creado");
  });
  it("fallback for unknown accion+tabla", () => {
    expect(mapAuditToTexto("consultar", "medicamentos", null)).toBe(
      "Consulta en medicamentos"
    );
  });
});

describe("tiempoRelativo", () => {
  it("returns 'Hace un momento' for < 1 min", () => {
    const now = new Date().toISOString();
    expect(tiempoRelativo(now)).toBe("Hace un momento");
  });
  it("returns 'Hace X min' for < 60 min", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(tiempoRelativo(fiveMinAgo)).toBe("Hace 5 min");
  });
  it("returns 'Hace X h' for >= 60 min", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
    expect(tiempoRelativo(twoHoursAgo)).toBe("Hace 2 h");
  });
});
```

- [ ] **Step 1.2: Run tests — confirm they FAIL**

```bash
npm run test -- useDashboardHoy
```

Expected: multiple FAIL with "Cannot find module '../hooks/useDashboardHoy'"

- [ ] **Step 1.3: Create `src/hooks/useDashboardHoy.ts`**

```typescript
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CitaHoy {
  id: string;
  hora: string;
  paciente: string;
  medico: string;
  tipo: string;
  estado: string;
}

export interface ActividadItem {
  id: string;
  texto: string;
  tiempo: string;
  created_at: string;
}

export interface DashboardHoyData {
  loading: boolean;
  error: string | null;
  totalCitasHoy: number;
  citasHoy: CitaHoy[];
  ingresosHoy: number;
  totalPacientes: number;
  alertasPendientes: number;
  citasSinConfirmar: number;
  actividadReciente: ActividadItem[];
  refresh: () => void;
}

// ─── Pure helpers (exported for testing) ─────────────────────────────────────

export function formatHora(fechaIso: string): string {
  return fechaIso.slice(11, 16);
}

export function formatNombrePaciente(
  nombre: string,
  apellido: string | null
): string {
  return apellido ? `${nombre} ${apellido}` : nombre;
}

export function formatNombreDoctor(nombre: string, apellidos: string): string {
  return `Dr. ${nombre} ${apellidos}`;
}

const STATUS_LABEL: Record<string, string> = {
  confirmada: "Confirmada",
  confirmada_paciente: "Confirmada por paciente",
  confirmada_medico: "Confirmada por médico",
  pendiente_formulario: "Pendiente de formulario",
  recordatorio_enviado: "Recordatorio enviado",
  solicitada: "Solicitada",
  cancelada: "Cancelada",
  tentativa: "Tentativa",
  liberada: "Liberada",
};

export function mapStatusToLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

const CONFIRMED_STATUSES = new Set([
  "confirmada",
  "confirmada_paciente",
  "confirmada_medico",
  "recordatorio_enviado",
]);

const ACCION_LABEL: Record<string, string> = {
  crear: "Creación",
  actualizar: "Actualización",
  cancelar: "Cancelación",
  eliminar: "Eliminación",
  consultar: "Consulta",
};

export function mapAuditToTexto(
  accion: string,
  tabla: string,
  datosNuevos: Record<string, unknown> | null
): string {
  if (accion === "crear" && tabla === "patients") {
    const nombre = datosNuevos?.nombre as string | undefined;
    return nombre
      ? `Nuevo paciente registrado: ${nombre}`
      : "Nuevo paciente registrado";
  }
  if (accion === "crear" && tabla === "appointments") return "Cita agendada";
  if (accion === "actualizar" && tabla === "appointments") return "Cita actualizada";
  if (accion === "crear" && tabla === "pharmacy_sales")
    return "Venta registrada en farmacia";
  if (accion === "crear" && tabla === "notas_consulta")
    return "Nota clínica registrada";
  if (accion === "crear" && tabla === "expedientes") return "Expediente creado";
  const accionLabel = ACCION_LABEL[accion] ?? accion;
  return `${accionLabel} en ${tabla}`;
}

export function tiempoRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Hace un momento";
  if (mins < 60) return `Hace ${mins} min`;
  return `Hace ${Math.floor(mins / 60)} h`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

type AuditRow = {
  id: string;
  created_at: string;
  accion: string;
  tabla: string;
  datos_nuevos: Record<string, unknown> | null;
};

export function useDashboardHoy(): DashboardHoyData {
  const { activeClinicId } = useActiveClinic();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCitasHoy, setTotalCitasHoy] = useState(0);
  const [citasHoy, setCitasHoy] = useState<CitaHoy[]>([]);
  const [ingresosHoy, setIngresosHoy] = useState(0);
  const [totalPacientes, setTotalPacientes] = useState(0);
  const [alertasPendientes, setAlertasPendientes] = useState(0);
  const [citasSinConfirmar, setCitasSinConfirmar] = useState(0);
  const [actividadReciente, setActividadReciente] = useState<ActividadItem[]>([]);

  const load = useCallback(async () => {
    if (!activeClinicId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const todayStart = format(new Date(), "yyyy-MM-dd") + "T00:00:00.000Z";
      const tomorrowStart = format(
        new Date(Date.now() + 86_400_000),
        "yyyy-MM-dd"
      ) + "T00:00:00.000Z";

      const [citasRes, ventasRes, pacientesRes, auditRes, alertasRes] =
        await Promise.all([
          // 1. Citas de hoy con joins a patients y doctors
          supabase
            .from("appointments")
            .select(
              "id, fecha_inicio, status, motivo_consulta, patients(nombre, apellido_paterno), doctors(nombre, apellidos)"
            )
            .eq("clinic_id", activeClinicId)
            .gte("fecha_inicio", todayStart)
            .lt("fecha_inicio", tomorrowStart)
            .order("fecha_inicio", { ascending: true }),

          // 2. Ventas completadas hoy
          supabase
            .from("pharmacy_sales")
            .select("total")
            .eq("clinic_id", activeClinicId)
            .eq("status", "completed")
            .gte("created_at", todayStart)
            .lt("created_at", tomorrowStart),

          // 3. Total pacientes activos
          supabase
            .from("patients")
            .select("id", { count: "exact", head: true })
            .eq("activo", true),

          // 4. Audit logs de hoy (actividad reciente)
          supabase
            .from("audit_logs" as unknown as "appointments")
            .select("id, created_at, accion, tabla, datos_nuevos")
            .eq("clinic_id", activeClinicId)
            .gte("created_at", todayStart)
            .lt("created_at", tomorrowStart)
            .order("created_at", { ascending: false })
            .limit(10),

          // 5. Alertas de stock pendientes
          supabase
            .from("almacen_alertas")
            .select("id", { count: "exact", head: true })
            .eq("clinic_id", activeClinicId)
            .eq("status", "pending"),
        ]);

      // ── Citas ──────────────────────────────────────────────────────────────
      const citasRaw = citasRes.data ?? [];
      const mappedCitas: CitaHoy[] = citasRaw.map((c) => {
        const p = c.patients as { nombre: string; apellido_paterno: string | null } | null;
        const d = c.doctors as { nombre: string; apellidos: string } | null;
        return {
          id: c.id,
          hora: formatHora(c.fecha_inicio),
          paciente: p
            ? formatNombrePaciente(p.nombre, p.apellido_paterno)
            : "Paciente",
          medico: d ? formatNombreDoctor(d.nombre, d.apellidos) : "Médico",
          tipo: (c.motivo_consulta as string | null)?.slice(0, 30) ?? "Consulta general",
          estado: mapStatusToLabel(c.status as string),
        };
      });

      const sinConfirmar = citasRaw.filter(
        (c) => !CONFIRMED_STATUSES.has(c.status as string)
      ).length;

      // ── Ingresos ──────────────────────────────────────────────────────────
      const ingresos = (ventasRes.data ?? []).reduce(
        (sum, v) => sum + Number(v.total),
        0
      );

      // ── Actividad reciente ────────────────────────────────────────────────
      const auditRows = (auditRes.data ?? []) as unknown as AuditRow[];
      const actividad: ActividadItem[] = auditRows.map((row) => ({
        id: row.id,
        texto: mapAuditToTexto(row.accion, row.tabla, row.datos_nuevos),
        tiempo: tiempoRelativo(row.created_at),
        created_at: row.created_at,
      }));

      // ── Commit state ──────────────────────────────────────────────────────
      setTotalCitasHoy(citasRaw.length);
      setCitasHoy(mappedCitas);
      setCitasSinConfirmar(sinConfirmar);
      setIngresosHoy(ingresos);
      setTotalPacientes(pacientesRes.count ?? 0);
      setAlertasPendientes(alertasRes.count ?? 0);
      setActividadReciente(actividad);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando dashboard");
    } finally {
      setLoading(false);
    }
  }, [activeClinicId]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    loading,
    error,
    totalCitasHoy,
    citasHoy,
    ingresosHoy,
    totalPacientes,
    alertasPendientes,
    citasSinConfirmar,
    actividadReciente,
    refresh: load,
  };
}
```

- [ ] **Step 1.4: Run tests — confirm they PASS**

```bash
npm run test -- useDashboardHoy
```

Expected output:
```
✓ src/test/useDashboardHoy.test.ts (17 tests)
  ✓ formatHora > extracts HH:mm from ISO string
  ✓ formatHora > handles UTC midnight
  ✓ formatNombrePaciente > combines nombre and apellido_paterno
  ✓ formatNombrePaciente > returns nombre alone when apellido null
  ✓ formatNombreDoctor > prefixes Dr. and combines name
  ✓ mapStatusToLabel > maps confirmada
  ... (all 17 pass)
```

- [ ] **Step 1.5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `useDashboardHoy.ts`

- [ ] **Step 1.6: Commit**

```bash
git add src/hooks/useDashboardHoy.ts src/test/useDashboardHoy.test.ts
git commit -m "feat: add useDashboardHoy hook with real Supabase queries"
```

---

## Task 2: Update Dashboard.tsx

**Files:**
- Modify: `src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes from Task 1: `useDashboardHoy` returning `DashboardHoyData`
- Uses shadcn/ui `Skeleton` from `@/components/ui/skeleton`
- Uses `format` from `date-fns` and `es` locale from `date-fns/locale`

- [ ] **Step 2.1: Replace Dashboard.tsx content**

Replace the entire file `src/pages/Dashboard.tsx` with:

```tsx
import { CalendarDays, Users, Receipt, AlertCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import StatCard from "@/components/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardHoy } from "@/hooks/useDashboardHoy";

// ─── Status color map ─────────────────────────────────────────────────────────

const estadoColor: Record<string, string> = {
  "Confirmada": "bg-success/10 text-success",
  "Confirmada por paciente": "bg-success/10 text-success",
  "Confirmada por médico": "bg-success/10 text-success",
  "Pendiente de formulario": "bg-warning/10 text-warning",
  "Recordatorio enviado": "bg-info/10 text-info",
  "Solicitada": "bg-muted text-muted-foreground",
  "Cancelada": "bg-destructive/10 text-destructive",
  "Tentativa": "bg-muted text-muted-foreground",
  "Liberada": "bg-muted text-muted-foreground",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="lg:col-span-2 h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatIngresosHoy(centavos: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(centavos / 100);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const data = useDashboardHoy();

  const fechaHoy = format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es });
  const fechaCapital = fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1);

  if (data.loading) return <DashboardSkeleton />;

  if (data.error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">{data.error}</p>
        <button
          onClick={data.refresh}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" /> Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-display text-2xl font-bold text-foreground">Panel principal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumen de operaciones — {fechaCapital}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CalendarDays}
          title="Citas hoy"
          value={String(data.totalCitasHoy)}
          change={data.totalCitasHoy === 0 ? "Sin citas programadas" : `${data.citasSinConfirmar} sin confirmar`}
          changeType={data.citasSinConfirmar > 0 ? "negative" : "positive"}
        />
        <StatCard
          icon={Users}
          title="Pacientes activos"
          value={data.totalPacientes.toLocaleString("es-MX")}
          change="Total registrados activos"
          changeType="positive"
        />
        <StatCard
          icon={Receipt}
          title="Ingresos del día"
          value={formatIngresosHoy(data.ingresosHoy)}
          change="Ventas farmacia completadas hoy"
          changeType="positive"
        />
        <StatCard
          icon={AlertCircle}
          title="Alertas de stock"
          value={String(data.alertasPendientes)}
          change={data.alertasPendientes === 0 ? "Sin alertas pendientes" : "Requieren atención"}
          changeType={data.alertasPendientes > 0 ? "negative" : "positive"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Agenda del día */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-display font-semibold text-card-foreground">Agenda de hoy</h2>
            <span className="text-xs font-medium text-muted-foreground">
              {data.totalCitasHoy} {data.totalCitasHoy === 1 ? "cita programada" : "citas programadas"}
            </span>
          </div>
          {data.citasHoy.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Sin citas programadas para hoy
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.citasHoy.map((cita) => (
                <div
                  key={cita.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors"
                >
                  <span className="w-12 shrink-0 text-sm font-semibold text-foreground">
                    {cita.hora}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-card-foreground">
                      {cita.paciente}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {cita.medico} · {cita.tipo}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      estadoColor[cita.estado] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {cita.estado}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actividad reciente */}
        <div className="rounded-xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-display font-semibold text-card-foreground">Actividad reciente</h2>
          </div>
          {data.actividadReciente.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Sin actividad registrada hoy
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.actividadReciente.map((item) => (
                <div key={item.id} className="px-5 py-3.5">
                  <p className="text-sm text-card-foreground leading-snug">{item.texto}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.tiempo}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Banner alertas pendientes */}
      {data.citasSinConfirmar > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Recordatorios pendientes</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.citasSinConfirmar}{" "}
              {data.citasSinConfirmar === 1 ? "cita no ha" : "citas no han"} sido{" "}
              {data.citasSinConfirmar === 1 ? "confirmada" : "confirmadas"} para hoy.
              Se recomienda contactar a {data.citasSinConfirmar === 1 ? "al paciente" : "los pacientes"} por teléfono.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2.2: TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: zero errors. If you see errors about `StatCard` props (`changeType`), check `src/components/StatCard.tsx` for the accepted values of `changeType` and adjust accordingly (may be `"positive" | "negative" | "neutral"` — use whatever the component accepts).

- [ ] **Step 2.3: Run all tests**

```bash
npm run test
```

Expected: all tests pass including the 17 from Task 1.

- [ ] **Step 2.4: Build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: build succeeds with no TypeScript or module resolution errors.

- [ ] **Step 2.5: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: replace hardcoded demo data in Dashboard with real Supabase queries"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| `totalCitasHoy` from appointments | Task 1 query #1 |
| `ingresosHoy` from pharmacy_sales | Task 1 query #2 |
| `totalPacientes` from patients count | Task 1 query #3 |
| `actividadReciente` from audit_logs | Task 1 query #4 |
| `alertasPendientes` from almacen_alertas | Task 1 query #5 |
| `citasSinConfirmar` derived from appointments | Task 1, `sinConfirmar` calc |
| Loading skeleton | Task 2 `DashboardSkeleton` |
| Error state + retry button | Task 2 error branch |
| Empty states (no citas, no actividad) | Task 2 conditional renders |
| Real date in header | Task 2 `fechaCapital` |
| Banner real vs hardcoded "3 pacientes" | Task 2 `citasSinConfirmar > 0` |
| `tipo_consulta` doesn't exist → use `motivo_consulta` | Task 1 `mappedCitas`, fallback "Consulta general" |
| `activeClinicId = null` → empty state | Task 1 early return |
| `pharmacy_sales.total` ÷ 100 | Task 2 `formatIngresosHoy` |

**Placeholder scan:** No TBDs, TODOs, or vague steps found.

**Type consistency:**
- `CitaHoy`, `ActividadItem`, `DashboardHoyData` defined in Task 1, consumed in Task 2 ✓
- `formatHora`, `mapStatusToLabel`, etc. exported in Task 1, tested in Task 1 ✓
- `useDashboardHoy` returns `DashboardHoyData` — Dashboard.tsx types match ✓
