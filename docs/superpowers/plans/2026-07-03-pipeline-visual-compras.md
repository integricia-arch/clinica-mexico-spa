# Pipeline Visual de Compras + KPIs Inteligencia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar visualmente en qué paso está cada trámite de compra (Solicitud→Cotización→OC→Recepción→Factura→Pago), quién es responsable si está atrasado, y llevar esas métricas al módulo de Inteligencia como KPIs de operación.

**Architecture:** Un hook nuevo (`usePipelineCompras`) deriva etapa/responsable/días-atrasado en el cliente a partir de datos que `useCicloCompras` (ya existente) trae de la vista SQL `v_ciclo_compras` (ya existente, sin cambios). Dos consumidores de ese hook: un kanban nuevo en el módulo Compras y una tab nueva en la página de Inteligencia (`BI.tsx`).

**Tech Stack:** React 18 + TypeScript, Tailwind + shadcn/ui (`Dialog`, `Badge`, `Tabs`), recharts (ya usado en `BI.tsx`), date-fns, vitest.

## Global Constraints

- Sin migraciones de base de datos nuevas — todo se deriva client-side de `v_ciclo_compras` (spec, sección Arquitectura).
- "Responsable" es un rol (`compras | gerencia | almacen | finanzas`), no una persona — no existe campo de comprador asignado en BD (spec, sección "Responsable — limitación conocida").
- Umbrales de "atrasado" son constantes fijas en código en esta fase, no configurables por clínica (spec, "Fuera de alcance").
- `tsc --noEmit` y `npm run build` deben quedar limpios al final de cada task (convención del proyecto, ver `CLAUDE.md`).
- Mantener el lenguaje visual existente: `rounded-xl border bg-card`, `Badge` de shadcn, mismos patrones que `DashboardCompras.tsx` — no introducir una identidad visual nueva (spec, "Dirección visual").

---

### Task 1: Hook `usePipelineCompras` con lógica de etapa/responsable/atraso

**Files:**
- Create: `src/hooks/usePipelineCompras.ts`
- Test: `src/test/pipelineCompras.test.ts`

**Interfaces:**
- Consumes: `useCicloCompras(clinicId: string | null)` de `src/hooks/useCicloCompras.ts`, que devuelve `{ rows: CicloRow[], loading: boolean, error: string | null, refresh: () => void }`. `CicloRow` ya define los campos: `pago_id`, `factura_id`, `recepcion_id`, `orden_id`, `cotizacion_id`, `estatus_orden`, `match_diferencia_centavos`, `match_status`, `fecha_solicitud`, `aprobada_at`, `fecha_recepcion` (todos `string | null` salvo `fecha_solicitud: string`).
- Produces: tipos `EtapaPipeline`, `RolResponsable`, `PipelineItem`, constante `UMBRAL_DIAS`, funciones puras `calcularEtapa`, `calcularResponsable`, `calcularDiasEnEtapa`, `esAtrasado`, y el hook `usePipelineCompras(clinicId)` que devuelve `{ items: PipelineItem[], completados: number, loading: boolean, error: string | null, refresh: () => void }`. Estos nombres son los que consumen las Tasks 3 y 4.

- [ ] **Step 1: Escribir el archivo del hook con la lógica completa**

```typescript
// src/hooks/usePipelineCompras.ts
import { useMemo } from "react";
import { differenceInDays, parseISO } from "date-fns";
import { useCicloCompras, CicloRow } from "@/hooks/useCicloCompras";

export type EtapaPipeline =
  | "solicitud"
  | "cotizacion"
  | "orden_compra"
  | "recepcion"
  | "factura"
  | "pago";

export type RolResponsable = "compras" | "gerencia" | "almacen" | "finanzas";

export interface PipelineItem extends CicloRow {
  etapa: EtapaPipeline;
  diasEnEtapa: number;
  responsable: RolResponsable | null;
  atrasado: boolean;
}

export const UMBRAL_DIAS: Record<EtapaPipeline, number> = {
  solicitud: 2,
  cotizacion: 3,
  orden_compra: 5,
  recepcion: 2,
  factura: 7,
  pago: Infinity,
};

export function calcularEtapa(row: CicloRow): EtapaPipeline {
  if (row.pago_id != null) return "pago";
  if (row.factura_id != null) return "factura";
  if (row.recepcion_id != null) return "recepcion";
  if (row.orden_id != null) return "orden_compra";
  if (row.cotizacion_id != null) return "cotizacion";
  return "solicitud";
}

function tieneDiferenciaSinAprobar(row: CicloRow): boolean {
  return (
    row.match_diferencia_centavos !== null &&
    row.match_diferencia_centavos !== 0 &&
    row.match_status !== "aprobado_gerente" &&
    row.match_status !== "ok"
  );
}

export function calcularResponsable(row: CicloRow, etapa: EtapaPipeline): RolResponsable | null {
  switch (etapa) {
    case "solicitud":
    case "cotizacion":
      return "compras";
    case "orden_compra":
      return row.estatus_orden === "pendiente_aprobacion" ? "gerencia" : "almacen";
    case "recepcion":
      return "almacen";
    case "factura":
      return tieneDiferenciaSinAprobar(row) ? "gerencia" : "finanzas";
    case "pago":
      return null;
  }
}

// v_ciclo_compras no expone una fecha propia de creación de la cotización;
// se usa fecha_solicitud como referencia de antigüedad del ciclo en esa etapa.
function fechaReferencia(row: CicloRow, etapa: EtapaPipeline): string | null {
  switch (etapa) {
    case "solicitud":
    case "cotizacion":
      return row.fecha_solicitud;
    case "orden_compra":
      return row.aprobada_at ?? row.fecha_solicitud;
    case "recepcion":
      return row.aprobada_at ?? row.fecha_solicitud;
    case "factura":
      return row.fecha_recepcion ?? row.aprobada_at ?? row.fecha_solicitud;
    case "pago":
      return null;
  }
}

export function calcularDiasEnEtapa(
  row: CicloRow,
  etapa: EtapaPipeline,
  ahora: Date = new Date()
): number {
  const fecha = fechaReferencia(row, etapa);
  if (!fecha) return 0;
  return Math.max(0, differenceInDays(ahora, parseISO(fecha)));
}

export function esAtrasado(diasEnEtapa: number, etapa: EtapaPipeline): boolean {
  return diasEnEtapa > UMBRAL_DIAS[etapa];
}

export function usePipelineCompras(clinicId: string | null) {
  const { rows, loading, error, refresh } = useCicloCompras(clinicId);

  const items: PipelineItem[] = useMemo(() => {
    const ahora = new Date();
    return rows
      .filter((r) => r.pago_id == null)
      .map((r) => {
        const etapa = calcularEtapa(r);
        const diasEnEtapa = calcularDiasEnEtapa(r, etapa, ahora);
        return {
          ...r,
          etapa,
          diasEnEtapa,
          responsable: calcularResponsable(r, etapa),
          atrasado: esAtrasado(diasEnEtapa, etapa),
        };
      });
  }, [rows]);

  const completados = useMemo(
    () => rows.filter((r) => r.pago_id != null).length,
    [rows]
  );

  return { items, completados, loading, error, refresh };
}
```

- [ ] **Step 2: Escribir los tests**

```typescript
// src/test/pipelineCompras.test.ts
import { describe, it, expect } from "vitest";
import {
  calcularEtapa,
  calcularResponsable,
  calcularDiasEnEtapa,
  esAtrasado,
  type EtapaPipeline,
} from "../hooks/usePipelineCompras";
import type { CicloRow } from "../hooks/useCicloCompras";

function fila(overrides: Partial<CicloRow> = {}): CicloRow {
  return {
    solicitud_id: "sc-1",
    clinic_id: "clinic-1",
    folio_solicitud: "SC-0001",
    estatus_solicitud: "aprobada",
    fecha_solicitud: "2026-06-01T00:00:00.000Z",
    solicitante_nombre: "Ana",
    cotizacion_id: null,
    folio_cotizacion: null,
    cotizacion_total_centavos: null,
    orden_id: null,
    folio_orden: null,
    estatus_orden: null,
    orden_total_centavos: null,
    aprobada_by: null,
    aprobada_at: null,
    recepcion_id: null,
    folio_recepcion: null,
    estatus_recepcion: null,
    fecha_recepcion: null,
    factura_id: null,
    folio_factura: null,
    estatus_factura: null,
    factura_total_centavos: null,
    match_status: null,
    match_diferencia_centavos: null,
    match_revisado_by: null,
    match_revisado_at: null,
    pago_id: null,
    fecha_pago: null,
    pago_monto_centavos: null,
    metodo_pago: null,
    ...overrides,
  };
}

describe("calcularEtapa", () => {
  it("solicitud sin cotización", () => {
    expect(calcularEtapa(fila())).toBe("solicitud");
  });
  it("cotización sin OC", () => {
    expect(calcularEtapa(fila({ cotizacion_id: "cot-1" }))).toBe("cotizacion");
  });
  it("OC sin recepción", () => {
    expect(calcularEtapa(fila({ cotizacion_id: "cot-1", orden_id: "oc-1" }))).toBe("orden_compra");
  });
  it("recepción sin factura", () => {
    expect(
      calcularEtapa(fila({ cotizacion_id: "cot-1", orden_id: "oc-1", recepcion_id: "gr-1" }))
    ).toBe("recepcion");
  });
  it("factura sin pago", () => {
    expect(
      calcularEtapa(
        fila({ cotizacion_id: "cot-1", orden_id: "oc-1", recepcion_id: "gr-1", factura_id: "fac-1" })
      )
    ).toBe("factura");
  });
  it("ciclo completo con pago", () => {
    expect(
      calcularEtapa(
        fila({
          cotizacion_id: "cot-1", orden_id: "oc-1", recepcion_id: "gr-1",
          factura_id: "fac-1", pago_id: "pago-1",
        })
      )
    ).toBe("pago");
  });
});

describe("calcularResponsable", () => {
  it("solicitud → compras", () => {
    expect(calcularResponsable(fila(), "solicitud")).toBe("compras");
  });
  it("cotización → compras", () => {
    expect(calcularResponsable(fila({ cotizacion_id: "cot-1" }), "cotizacion")).toBe("compras");
  });
  it("OC pendiente_aprobacion → gerencia", () => {
    expect(
      calcularResponsable(fila({ orden_id: "oc-1", estatus_orden: "pendiente_aprobacion" }), "orden_compra")
    ).toBe("gerencia");
  });
  it("OC confirmada → almacen", () => {
    expect(
      calcularResponsable(fila({ orden_id: "oc-1", estatus_orden: "confirmada" }), "orden_compra")
    ).toBe("almacen");
  });
  it("recepción → almacen", () => {
    expect(calcularResponsable(fila({ recepcion_id: "gr-1" }), "recepcion")).toBe("almacen");
  });
  it("factura con diferencia sin aprobar → gerencia", () => {
    expect(
      calcularResponsable(
        fila({ factura_id: "fac-1", match_diferencia_centavos: 500, match_status: "diferencia" }),
        "factura"
      )
    ).toBe("gerencia");
  });
  it("factura ok esperando pago → finanzas", () => {
    expect(
      calcularResponsable(
        fila({ factura_id: "fac-1", match_diferencia_centavos: 0, match_status: "ok" }),
        "factura"
      )
    ).toBe("finanzas");
  });
  it("pago → sin responsable", () => {
    expect(calcularResponsable(fila({ pago_id: "pago-1" }), "pago")).toBeNull();
  });
});

describe("calcularDiasEnEtapa + esAtrasado", () => {
  it("cuenta días desde fecha_solicitud en etapa solicitud", () => {
    const ahora = new Date("2026-06-05T00:00:00.000Z");
    const dias = calcularDiasEnEtapa(fila({ fecha_solicitud: "2026-06-01T00:00:00.000Z" }), "solicitud", ahora);
    expect(dias).toBe(4);
    expect(esAtrasado(dias, "solicitud")).toBe(true); // umbral solicitud = 2
  });
  it("no atrasado dentro del umbral", () => {
    const ahora = new Date("2026-06-02T00:00:00.000Z");
    const dias = calcularDiasEnEtapa(fila({ fecha_solicitud: "2026-06-01T00:00:00.000Z" }), "solicitud", ahora);
    expect(esAtrasado(dias, "solicitud")).toBe(false);
  });
  it("etapa pago nunca está atrasada", () => {
    expect(esAtrasado(9999, "pago" as EtapaPipeline)).toBe(false);
  });
});
```

- [ ] **Step 3: Correr los tests**

Run: `npx vitest run src/test/pipelineCompras.test.ts`
Expected: PASS (todos los tests en verde — 14 casos entre los 3 `describe`)

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePipelineCompras.ts src/test/pipelineCompras.test.ts
git commit -m "feat: hook usePipelineCompras con lógica de etapa/responsable/atraso"
```

---

### Task 2: Constantes compartidas de etiquetas y colores

**Files:**
- Create: `src/features/compras/pipelineConstants.ts`

**Interfaces:**
- Consumes: tipos `EtapaPipeline`, `RolResponsable` de `src/hooks/usePipelineCompras.ts` (Task 1).
- Produces: `ETAPA_LABEL`, `ETAPA_ORDEN`, `ROL_LABEL`, `ROL_COLOR` — usados por Task 3 (kanban) y Task 4 (BI).

- [ ] **Step 1: Escribir el archivo de constantes**

```typescript
// src/features/compras/pipelineConstants.ts
import type { EtapaPipeline, RolResponsable } from "@/hooks/usePipelineCompras";

export const ETAPA_LABEL: Record<EtapaPipeline, string> = {
  solicitud: "Solicitud",
  cotizacion: "Cotización",
  orden_compra: "Orden de Compra",
  recepcion: "Recepción",
  factura: "Factura",
  pago: "Completado",
};

export const ETAPA_ORDEN: EtapaPipeline[] = [
  "solicitud", "cotizacion", "orden_compra", "recepcion", "factura",
];

export const ROL_LABEL: Record<RolResponsable, string> = {
  compras: "Compras",
  gerencia: "Gerencia",
  almacen: "Almacén",
  finanzas: "Finanzas",
};

export const ROL_COLOR: Record<RolResponsable, string> = {
  compras: "bg-indigo-100 text-indigo-800",
  gerencia: "bg-amber-100 text-amber-800",
  almacen: "bg-teal-100 text-teal-800",
  finanzas: "bg-violet-100 text-violet-800",
};
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores

- [ ] **Step 3: Commit**

```bash
git add src/features/compras/pipelineConstants.ts
git commit -m "feat: constantes de etiquetas y colores del pipeline de compras"
```

---

### Task 3: Componente kanban `PipelineCompras` + integración en `ComprasTabs`

**Files:**
- Create: `src/features/compras/PipelineCompras.tsx`
- Modify: `src/features/compras/ComprasTabs.tsx:1-18` (imports), `:29-42` (TabsList), `:52` (TabsContent)

**Interfaces:**
- Consumes: `usePipelineCompras(clinicId)` (Task 1) → `{ items: PipelineItem[], completados: number, loading, error, refresh }`; `ETAPA_LABEL`, `ETAPA_ORDEN`, `ROL_LABEL`, `ROL_COLOR` (Task 2); `useActiveClinic()` de `@/hooks/useActiveClinic` (ya usado en `DashboardCompras.tsx`, expone `{ activeClinicId }`).
- Produces: default export `PipelineCompras` (componente React sin props), montado en la tab `"pipeline"` de `ComprasTabs.tsx`.

- [ ] **Step 1: Escribir el componente**

```tsx
// src/features/compras/PipelineCompras.tsx
import { useMemo, useState } from "react";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { usePipelineCompras, type PipelineItem } from "@/hooks/usePipelineCompras";
import { ETAPA_LABEL, ETAPA_ORDEN, ROL_LABEL, ROL_COLOR } from "./pipelineConstants";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CircleDot, CheckCircle2 } from "lucide-react";

const fmt = (c: number | null) =>
  c == null ? "—" : (c / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function TarjetaPipeline({ item, onClick }: { item: PipelineItem; onClick: () => void }) {
  const monto =
    item.etapa === "factura" ? item.factura_total_centavos :
    item.etapa === "orden_compra" || item.etapa === "recepcion" ? item.orden_total_centavos :
    item.cotizacion_total_centavos;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border bg-card p-3 space-y-1.5 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold">{item.folio_solicitud}</span>
        {item.responsable && (
          <Badge className={`text-[10px] ${ROL_COLOR[item.responsable]}`}>
            {ROL_LABEL[item.responsable]}
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground truncate">{item.solicitante_nombre ?? "—"}</p>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{fmt(monto)}</span>
        <span className={item.atrasado ? "text-destructive font-semibold" : "text-muted-foreground"}>
          {item.diasEnEtapa}d
        </span>
      </div>
    </button>
  );
}

function StepperDetalle({ item }: { item: PipelineItem }) {
  const pasos: { label: string; fecha: string | null; quien: string | null; hecho: boolean }[] = [
    { label: "Solicitud", fecha: item.fecha_solicitud, quien: item.solicitante_nombre, hecho: true },
    { label: "Cotización", fecha: null, quien: null, hecho: item.cotizacion_id != null },
    { label: "Orden de Compra", fecha: item.aprobada_at, quien: item.aprobada_by, hecho: item.orden_id != null },
    { label: "Recepción", fecha: item.fecha_recepcion, quien: null, hecho: item.recepcion_id != null },
    { label: "Factura", fecha: null, quien: item.match_revisado_by, hecho: item.factura_id != null },
    { label: "Pago", fecha: item.fecha_pago, quien: null, hecho: item.pago_id != null },
  ];

  return (
    <div className="space-y-3">
      {pasos.map((p, i) => (
        <div key={i} className="flex items-start gap-2.5">
          {p.hecho ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
          ) : (
            <CircleDot className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium">{p.label}</p>
            <p className="text-xs text-muted-foreground">
              {p.hecho
                ? `${p.fecha ? new Date(p.fecha).toLocaleDateString("es-MX") : "—"}${p.quien ? ` · ${p.quien}` : ""}`
                : "Pendiente"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PipelineCompras() {
  const { activeClinicId } = useActiveClinic();
  const { items, completados, loading, error } = usePipelineCompras(activeClinicId);
  const [busqueda, setBusqueda] = useState("");
  const [ocultarCompletados, setOcultarCompletados] = useState(true);
  const [seleccionado, setSeleccionado] = useState<PipelineItem | null>(null);

  const itemsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.folio_solicitud.toLowerCase().includes(q) ||
        (i.solicitante_nombre ?? "").toLowerCase().includes(q)
    );
  }, [items, busqueda]);

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );

  if (error) return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      Error cargando el pipeline: {error}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar folio o solicitante…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="max-w-xs h-8 text-sm"
        />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Checkbox
            checked={ocultarCompletados}
            onCheckedChange={(v) => setOcultarCompletados(v === true)}
          />
          Ocultar completados
        </label>
        {!ocultarCompletados && (
          <span className="text-xs text-muted-foreground">
            {completados} ciclo{completados !== 1 ? "s" : ""} completado{completados !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {ETAPA_ORDEN.map((etapa) => {
          const enEtapa = itemsFiltrados.filter((i) => i.etapa === etapa);
          return (
            <div key={etapa} className="rounded-xl border bg-muted/30 p-2.5 space-y-2 min-h-[120px]">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-semibold">{ETAPA_LABEL[etapa]}</h4>
                <span className="text-xs text-muted-foreground">{enEtapa.length}</span>
              </div>
              <div className="space-y-2">
                {enEtapa.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Sin trámites</p>
                ) : (
                  enEtapa.map((item) => (
                    <TarjetaPipeline
                      key={item.solicitud_id}
                      item={item}
                      onClick={() => setSeleccionado(item)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
        {ocultarCompletados ? null : (
          <div className="rounded-xl border bg-muted/30 p-2.5 space-y-2 min-h-[120px]">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-semibold">{ETAPA_LABEL.pago}</h4>
              <span className="text-xs text-muted-foreground">{completados}</span>
            </div>
            <p className="text-xs text-muted-foreground text-center py-4">
              {completados} ciclo{completados !== 1 ? "s" : ""} pagado{completados !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      <Dialog open={seleccionado != null} onOpenChange={(open) => !open && setSeleccionado(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{seleccionado?.folio_solicitud}</DialogTitle>
          </DialogHeader>
          {seleccionado && <StepperDetalle item={seleccionado} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Agregar la tab "Pipeline" en `ComprasTabs.tsx`**

En `src/features/compras/ComprasTabs.tsx`, agregar el import junto a los demás (después de la línea de `import DashboardCompras from "./DashboardCompras";`):

```tsx
import PipelineCompras from "./PipelineCompras";
```

Agregar el trigger en `TabsList`, justo después de `<TabsTrigger value="dashboard">Dashboard</TabsTrigger>`:

```tsx
<TabsTrigger value="pipeline">Pipeline</TabsTrigger>
```

Agregar el contenido, justo después de `<TabsContent value="dashboard" className="mt-4"><DashboardCompras /></TabsContent>`:

```tsx
<TabsContent value="pipeline" className="mt-4"><PipelineCompras /></TabsContent>
```

- [ ] **Step 3: Verificar tipos y build**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 errores de tipos, build exitoso (warnings preexistentes de code-splitting no relacionados son aceptables)

- [ ] **Step 4: Commit**

```bash
git add src/features/compras/PipelineCompras.tsx src/features/compras/ComprasTabs.tsx
git commit -m "feat: kanban visual del ciclo de compras con detalle por trámite"
```

---

### Task 4: KPIs de ciclo de compras en Inteligencia (`BI.tsx`)

**Files:**
- Modify: `src/pages/BI.tsx:1-22` (imports), añadir función `TabCompras` (nueva, junto a las demás `Tab*` del archivo, antes de `export default function BI()` en la línea 758), `:758-878` (registro de tab)

**Interfaces:**
- Consumes: `usePipelineCompras(clinicId)` (Task 1), `useActiveClinic()` (mismo hook que Task 3), `ROL_LABEL`, `ROL_COLOR` (Task 2).
- Produces: función `TabCompras` (no exportada, local al archivo, mismo patrón que `TabFinanzas`/`TabInventario` ya existentes) y la tab `"compras"` registrada en el componente `BI`.

- [ ] **Step 1: Agregar imports necesarios**

En `src/pages/BI.tsx`, agregar después de la línea `import { useAuth } from "@/hooks/useAuth";`:

```tsx
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { usePipelineCompras } from "@/hooks/usePipelineCompras";
import { ROL_LABEL, ROL_COLOR } from "@/features/compras/pipelineConstants";
```

- [ ] **Step 2: Escribir la función `TabCompras`**

Insertar antes de `export default function BI() {` (línea 758):

```tsx
function TabCompras() {
  const { activeClinicId } = useActiveClinic();
  const { items, loading } = usePipelineCompras(activeClinicId);

  const atrasados = items.filter((i) => i.atrasado);

  const porRol = (["compras", "gerencia", "almacen", "finanzas"] as const).map((rol) => ({
    rol,
    count: atrasados.filter((i) => i.responsable === rol).length,
  }));
  const maxRol = Math.max(...porRol.map((r) => r.count), 1);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cuellos de botella — trámites atrasados por responsable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {atrasados.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sin trámites atrasados</p>
          ) : (
            porRol
              .filter((r) => r.count > 0)
              .sort((a, b) => b.count - a.count)
              .map((r) => (
                <div key={r.rol} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <Badge className={ROL_COLOR[r.rol]}>{ROL_LABEL[r.rol]}</Badge>
                    <span className="font-semibold">{r.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-destructive"
                      style={{ width: `${(r.count / maxRol) * 100}%` }}
                    />
                  </div>
                </div>
              ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Trámites activos por etapa</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {items.length} trámite{items.length !== 1 ? "s" : ""} en curso,{" "}
            {atrasados.length} atrasado{atrasados.length !== 1 ? "s" : ""}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Nota (limitación aceptada, ver spec "Fuera de alcance"):** este panel muestra
el ranking de cuellos de botella (100% preciso con los datos disponibles) y un
conteo simple de activos/atrasados. Los 5 lead times completos por tramo no se
incluyen en esta fase porque `CicloRow`/`v_ciclo_compras` no expone una fecha
propia de creación de cotización — agregarla es un cambio de vista SQL fuera
de alcance de este plan.

- [ ] **Step 3: Registrar la tab en el componente `BI`**

Agregar el trigger en el `TabsList` de `BI()` (después de `<TabsTrigger value="finanzas">...`):

```tsx
<TabsTrigger value="compras">Compras</TabsTrigger>
```

Agregar el contenido, después del `<TabsContent value="finanzas" ...>` existente:

```tsx
<TabsContent value="compras" className="mt-4">
  <TabCompras />
</TabsContent>
```

- [ ] **Step 4: Verificar tipos y build**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 errores de tipos, build exitoso

- [ ] **Step 5: Commit**

```bash
git add src/pages/BI.tsx
git commit -m "feat: KPIs de cuellos de botella del ciclo de compras en Inteligencia"
```

---

### Task 5: Verificación final de branch completo

**Files:** ninguno (solo verificación)

**Interfaces:** N/A

- [ ] **Step 1: Correr toda la suite de tests**

Run: `npx vitest run`
Expected: todos los archivos de test en verde, incluyendo `src/test/pipelineCompras.test.ts`

- [ ] **Step 2: Verificar tipos en el branch completo**

Run: `npx tsc --noEmit`
Expected: 0 errores

- [ ] **Step 3: Build de producción**

Run: `npm run build`
Expected: build exitoso (warnings preexistentes de code-splitting aceptables, sin errores nuevos)

- [ ] **Step 4: Smoke test visual (manual, no automatizable en este entorno — ver limitación de captcha documentada en `memoria/STATE.md`)**

Navegar a `/compras` → tab "Pipeline": confirmar que el kanban carga sin errores de consola, que las tarjetas muestran el folio/responsable/días correctos para al menos un trámite real, y que el click abre el diálogo con el stepper. Navegar a la página de Inteligencia → tab "Compras": confirmar que el ranking de cuellos de botella carga sin errores.

- [ ] **Step 5: Commit final (si hubo fixes en este task)**

```bash
git add -A
git commit -m "fix: ajustes finales post-verificación pipeline compras"
```
(Omitir este commit si no hubo cambios — `git status` debe estar limpio si Tasks 1-4 ya cerraron todo correctamente.)
