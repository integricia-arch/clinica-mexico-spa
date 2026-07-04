# Almacén — Catálogo unificado + buscador tolerante Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la fila de 9 pestañas de `AlmacenTabs.tsx` por una navegación con Catálogo como vista default + 2 chips de filtro rápido + un dropdown "Reportes y control" para las 7 vistas de baja frecuencia, y hacer el buscador de `CatalogoMedicamentos.tsx` tolerante a acentos y a 1 error de tipeo.

**Architecture:** Cambios acotados a 2 componentes existentes (`AlmacenTabs.tsx`, `CatalogoMedicamentos.tsx`) + 1 archivo nuevo de funciones puras (`src/features/almacen/lib/busquedaTolerante.ts`). Ningún componente de reporte/control (`FaltantesPanel`, `CaducidadesPanel`, `InventarioCiclico`, `ReporteCOFEPRIS`, `ReporteRotacionABC`, `ActasMerma`, `PuntoReorden`, `LibroControlControlados`) cambia — solo el control de UI que dispara su render.

**Tech Stack:** React + TypeScript, Tailwind, shadcn/ui (`DropdownMenu`, `Badge`, `Input`), Vitest para tests.

## Global Constraints

- Vista por default sigue siendo `catalogo` (sin cambio de estado inicial).
- Cero queries nuevas: chips reusan `bajosStock` y `proxCaducidad` ya calculados en `AlmacenTabs.tsx`.
- Ningún componente de reporte/control cambia su lógica de datos — solo el control de UI que lo dispara.
- Buscador: aplicar `normalizarTexto` a ambos lados del `.includes()`; Levenshtein-1 solo para palabras >4 caracteres, por palabra.
- ñ no se debe quitar en `normalizarTexto` (no es diacrítico compuesto en NFD).
- No se toca `almacen_alertas`, `medicamentos`, `lotes_medicamento` (estructura de datos).
- No se rediseña paleta/tipografía — sistema Tailwind/shadcn existente.

---

## Task 1: `busquedaTolerante.ts` — normalización y Levenshtein acotado

**Files:**
- Create: `src/features/almacen/lib/busquedaTolerante.ts`
- Test: `src/test/almacen/busquedaTolerante.test.ts`

**Interfaces:**
- Produces: `normalizarTexto(s: string): string`, `distanciaLevenshtein(a: string, b: string, maxDist?: number): boolean` — ambos exports nombrados, usados por Task 2.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/test/almacen/busquedaTolerante.test.ts
import { describe, it, expect } from "vitest";
import { normalizarTexto, distanciaLevenshtein } from "@/features/almacen/lib/busquedaTolerante";

describe("normalizarTexto", () => {
  it("quita acentos comunes del español", () => {
    expect(normalizarTexto("Acetaminofén")).toBe("acetaminofen");
    expect(normalizarTexto("María José")).toBe("maria jose");
  });

  it("no quita la ñ (no es diacrítico compuesto)", () => {
    expect(normalizarTexto("Niño")).toBe("niño");
    expect(normalizarTexto("PEQUEÑO")).toBe("pequeño");
  });

  it("pasa a minúsculas y recorta espacios", () => {
    expect(normalizarTexto("  IBUPROFENO  ")).toBe("ibuprofeno");
  });

  it("maneja string vacío", () => {
    expect(normalizarTexto("")).toBe("");
  });
});

describe("distanciaLevenshtein", () => {
  it("true cuando las palabras son idénticas (distancia 0)", () => {
    expect(distanciaLevenshtein("paracetamol", "paracetamol", 1)).toBe(true);
  });

  it("true cuando hay exactamente 1 error de tipeo", () => {
    expect(distanciaLevenshtein("acetaminofen", "acetaminofn", 1)).toBe(true); // falta 1 letra
    expect(distanciaLevenshtein("acetaminofen", "aceteminofen", 1)).toBe(true); // 1 sustitución
    expect(distanciaLevenshtein("acetaminofen", "acetaminofehn", 1)).toBe(true); // 1 letra de más
  });

  it("false cuando hay 2 o más errores de tipeo", () => {
    expect(distanciaLevenshtein("acetaminofen", "aceteminofn", 1)).toBe(false);
  });

  it("false para palabras muy distintas", () => {
    expect(distanciaLevenshtein("paracetamol", "ibuprofeno", 1)).toBe(false);
  });

  it("maneja strings vacíos", () => {
    expect(distanciaLevenshtein("", "", 1)).toBe(true);
    expect(distanciaLevenshtein("a", "", 1)).toBe(true);
    expect(distanciaLevenshtein("ab", "", 1)).toBe(false);
  });

  it("es case-sensitive por diseño — el caller normaliza antes de llamar", () => {
    expect(distanciaLevenshtein("Paracetamol", "paracetamol", 1)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/almacen/busquedaTolerante.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/almacen/lib/busquedaTolerante"`

- [ ] **Step 3: Write the implementation**

```typescript
// src/features/almacen/lib/busquedaTolerante.ts

/**
 * Normaliza texto para búsqueda: minúsculas, sin espacios extremos, sin
 * diacríticos (acentos). La ñ NO se toca — en descomposición NFD la ñ es
 * un carácter propio (U+00F1), no una letra base + diacrítico combinante,
 * así que el rango de combining marks (U+0300–U+036F) no la afecta.
 */
export function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * True si la distancia de edición (Levenshtein) entre a y b es <= maxDist.
 * Early-exit por fila: no calcula la distancia exacta si ya se sabe que
 * va a superar maxDist, evitando el costo O(n*m) completo en el caso común
 * de palabras muy distintas.
 */
export function distanciaLevenshtein(a: string, b: string, maxDist = 1): boolean {
  if (Math.abs(a.length - b.length) > maxDist) return false;
  if (a === b) return true;

  const m = a.length;
  const n = b.length;
  let prevRow = Array.from({ length: n + 1 }, (_, j) => j);

  for (let i = 1; i <= m; i++) {
    const currRow = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        prevRow[j] + 1,
        currRow[j - 1] + 1,
        prevRow[j - 1] + cost,
      );
      currRow.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > maxDist) return false;
    prevRow = currRow;
  }

  return prevRow[n] <= maxDist;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/almacen/busquedaTolerante.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Commit**

```bash
git add src/features/almacen/lib/busquedaTolerante.ts src/test/almacen/busquedaTolerante.test.ts
git commit -m "feat: buscador tolerante a acentos y typos para Almacén"
```

---

## Task 2: Integrar buscador tolerante en `CatalogoMedicamentos.tsx`

**Files:**
- Modify: `src/features/almacen/CatalogoMedicamentos.tsx:89-102` (bloque `filtered`)
- Test: `src/test/almacen/catalogoFiltro.test.ts`

**Interfaces:**
- Consumes: `normalizarTexto(s: string): string`, `distanciaLevenshtein(a: string, b: string, maxDist?: number): boolean` de Task 1.
- Produces: función pura extraída `matchTolerante(campo: string, terminoNormalizado: string): boolean`, exportada desde `CatalogoMedicamentos.tsx` para testear sin montar el componente completo.

El componente tiene lógica de datos embebida en el cuerpo de la función (no exportable directamente). Para poder testear la lógica de filtro sin renderizar React, se extrae `matchTolerante` como función pura exportada en el mismo archivo, y `filtered` la usa.

- [ ] **Step 1: Write the failing test**

```typescript
// src/test/almacen/catalogoFiltro.test.ts
import { describe, it, expect } from "vitest";
import { matchTolerante } from "@/features/almacen/CatalogoMedicamentos";

describe("matchTolerante", () => {
  it("encuentra por includes simple ignorando mayúsculas", () => {
    expect(matchTolerante("Acetaminofén", "acetaminofen")).toBe(true);
  });

  it("ignora acentos en el campo comparado", () => {
    expect(matchTolerante("Acetaminofén 500mg", "acetaminofen")).toBe(true);
  });

  it("tolera 1 error de tipeo en palabras largas (>4 caracteres)", () => {
    expect(matchTolerante("Acetaminofén 500mg", "acetaminofn")).toBe(true);
  });

  it("no aplica Levenshtein a palabras cortas (evita falsos positivos)", () => {
    // "IVA" (3 chars) vs "iba" tienen distancia 1 pero no deben matchear
    // por Levenshtein — solo por includes exacto tras normalizar.
    expect(matchTolerante("IVA incluido", "iba")).toBe(false);
  });

  it("campo vacío o null no matchea término no vacío", () => {
    expect(matchTolerante("", "acetaminofen")).toBe(false);
  });

  it("término vacío matchea cualquier campo (comportamiento includes)", () => {
    expect(matchTolerante("Acetaminofén", "")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/almacen/catalogoFiltro.test.ts`
Expected: FAIL — `matchTolerante` no exportado desde `CatalogoMedicamentos.tsx` (aún no existe).

- [ ] **Step 3: Implement `matchTolerante` and wire it into `filtered`**

En `src/features/almacen/CatalogoMedicamentos.tsx`, agregar el import y la función pura antes del componente (después de la línea 22, junto a `formatMXN`):

```typescript
import { normalizarTexto, distanciaLevenshtein } from "@/features/almacen/lib/busquedaTolerante";

// ... (después de formatMXN, antes de CATEGORIAS)

/**
 * Compara un campo del medicamento contra el término de búsqueda ya
 * normalizado, palabra por palabra. Términos vacíos matchean cualquier
 * campo (mismo comportamiento que .includes("") === true).
 */
export function matchTolerante(campo: string | null | undefined, terminoNormalizado: string): boolean {
  if (!terminoNormalizado) return true;
  const campoNorm = normalizarTexto(campo ?? "");
  if (!campoNorm) return false;
  if (campoNorm.includes(terminoNormalizado)) return true;

  const palabrasTermino = terminoNormalizado.split(/\s+/).filter(w => w.length > 4);
  if (palabrasTermino.length === 0) return false;
  const palabrasCampo = campoNorm.split(/\s+/).filter(w => w.length > 4);

  return palabrasTermino.some(pt =>
    palabrasCampo.some(pc => distanciaLevenshtein(pt, pc, 1)),
  );
}
```

Reemplazar el bloque `filtered` (líneas 89-102) por:

```typescript
  const filtered = medicamentos.filter(m => {
    const s = normalizarTexto(search);
    if (!s) return true;
    const mx = m as Medicamento & {
      barcode?: string | null; sku?: string | null; codigo_interno?: string | null;
      laboratorio?: string | null; principio_activo?: string | null;
      concentracion?: string | null; presentacion?: string | null;
    };
    return [
      m.nombre, m.categoria,
      mx.barcode, mx.sku, mx.codigo_interno,
      mx.laboratorio, mx.principio_activo, mx.concentracion, mx.presentacion,
    ].some(v => matchTolerante(v, s));
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/almacen/catalogoFiltro.test.ts src/test/almacen/busquedaTolerante.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Run full test suite to check no regression**

Run: `npm test`
Expected: PASS — no test previously passing should fail

- [ ] **Step 6: Commit**

```bash
git add src/features/almacen/CatalogoMedicamentos.tsx src/test/almacen/catalogoFiltro.test.ts
git commit -m "feat: aplicar buscador tolerante en CatalogoMedicamentos"
```

---

## Task 3: Prop `quickFilter` en `CatalogoMedicamentos.tsx`

**Files:**
- Modify: `src/features/almacen/CatalogoMedicamentos.tsx` (interface `Props`, firma del componente, bloque `filtered`, UI de chips)
- Test: `src/test/almacen/catalogoQuickFilter.test.ts`

**Interfaces:**
- Consumes: `stockTotal(medId: string): number` y `proxCaducidad` ya existentes en el componente (líneas 82-83, 87).
- Produces: prop `quickFilter?: "bajo_stock" | "por_caducar" | null` en `CatalogoMedicamentos`, y función pura exportada `aplicaQuickFilter(m: Medicamento, lotes: Lote[], quickFilter: "bajo_stock" | "por_caducar" | null | undefined): boolean` consumida por Task 4 (para saber qué valores son válidos) y usada internamente en `filtered`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/test/almacen/catalogoQuickFilter.test.ts
import { describe, it, expect } from "vitest";
import { aplicaQuickFilter } from "@/features/almacen/CatalogoMedicamentos";
import type { Tables } from "@/integrations/supabase/types";

type Medicamento = Tables<"medicamentos">;
type Lote = Tables<"lotes_medicamento">;

function med(overrides: Partial<Medicamento> = {}): Medicamento {
  return {
    id: "m1", nombre: "Test", categoria: "Otro", unidad: "tableta",
    precio_unitario: 10, stock_minimo: 5, activo: true,
    sale_type: "otc", allow_direct_sale: true, requires_prescription: false,
    is_controlled: false, regulatory_notes: null, descripcion: null,
    ...overrides,
  } as Medicamento;
}

function lote(overrides: Partial<Lote> = {}): Lote {
  const hoy = new Date();
  const en10 = new Date(hoy); en10.setDate(hoy.getDate() + 10);
  return {
    id: "l1", medicamento_id: "m1", numero_lote: "L1",
    existencia: 10, fecha_caducidad: en10.toISOString().slice(0, 10),
    ...overrides,
  } as Lote;
}

describe("aplicaQuickFilter", () => {
  it("sin filtro (null/undefined) siempre pasa", () => {
    expect(aplicaQuickFilter(med(), [], null)).toBe(true);
    expect(aplicaQuickFilter(med(), [], undefined)).toBe(true);
  });

  it("bajo_stock: pasa cuando stockTotal < stock_minimo", () => {
    const m = med({ id: "m1", stock_minimo: 5 });
    const lotes = [lote({ medicamento_id: "m1", existencia: 2 })];
    expect(aplicaQuickFilter(m, lotes, "bajo_stock")).toBe(true);
  });

  it("bajo_stock: no pasa cuando stockTotal >= stock_minimo", () => {
    const m = med({ id: "m1", stock_minimo: 5 });
    const lotes = [lote({ medicamento_id: "m1", existencia: 10 })];
    expect(aplicaQuickFilter(m, lotes, "bajo_stock")).toBe(false);
  });

  it("por_caducar: pasa cuando tiene un lote con existencia>0 y caducidad <=90 dias", () => {
    const m = med({ id: "m1" });
    const lotes = [lote({ medicamento_id: "m1", existencia: 5 })]; // en10 dias, por defecto
    expect(aplicaQuickFilter(m, lotes, "por_caducar")).toBe(true);
  });

  it("por_caducar: no pasa si el lote proximo a vencer tiene existencia 0", () => {
    const m = med({ id: "m1" });
    const lotes = [lote({ medicamento_id: "m1", existencia: 0 })];
    expect(aplicaQuickFilter(m, lotes, "por_caducar")).toBe(false);
  });

  it("por_caducar: no pasa si todos los lotes vencen en mas de 90 dias", () => {
    const hoy = new Date();
    const en200 = new Date(hoy); en200.setDate(hoy.getDate() + 200);
    const m = med({ id: "m1" });
    const lotes = [lote({ medicamento_id: "m1", existencia: 5, fecha_caducidad: en200.toISOString().slice(0, 10) })];
    expect(aplicaQuickFilter(m, lotes, "por_caducar")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/almacen/catalogoQuickFilter.test.ts`
Expected: FAIL — `aplicaQuickFilter` no exportado (no existe todavía).

- [ ] **Step 3: Implement `aplicaQuickFilter`, prop `quickFilter`, and wire into `filtered`**

Agregar, junto a `matchTolerante` en `CatalogoMedicamentos.tsx`:

```typescript
export function aplicaQuickFilter(
  m: Medicamento,
  lotes: Lote[],
  quickFilter: "bajo_stock" | "por_caducar" | null | undefined,
): boolean {
  if (!quickFilter) return true;
  const lotesDelMed = lotes.filter(l => l.medicamento_id === m.id);
  if (quickFilter === "bajo_stock") {
    const stock = lotesDelMed.reduce((s, l) => s + l.existencia, 0);
    return stock < m.stock_minimo;
  }
  // por_caducar
  const hoy = new Date();
  const en90 = new Date(hoy); en90.setDate(hoy.getDate() + 90);
  return lotesDelMed.some(l => l.fecha_caducidad && new Date(l.fecha_caducidad) <= en90 && l.existencia > 0);
}
```

Actualizar `interface Props` (línea 56-60):

```typescript
interface Props {
  medicamentos: Medicamento[];
  lotes: Lote[];
  onReload: () => void;
  quickFilter?: "bajo_stock" | "por_caducar" | null;
}
```

Actualizar la firma del componente (línea 62):

```typescript
export default function CatalogoMedicamentos({ medicamentos, lotes, onReload, quickFilter = null }: Props) {
```

Actualizar `filtered` para encadenar ambos filtros (texto + quickFilter):

```typescript
  const filtered = medicamentos.filter(m => {
    if (!aplicaQuickFilter(m, lotes, quickFilter)) return false;
    const s = normalizarTexto(search);
    if (!s) return true;
    const mx = m as Medicamento & {
      barcode?: string | null; sku?: string | null; codigo_interno?: string | null;
      laboratorio?: string | null; principio_activo?: string | null;
      concentracion?: string | null; presentacion?: string | null;
    };
    return [
      m.nombre, m.categoria,
      mx.barcode, mx.sku, mx.codigo_interno,
      mx.laboratorio, mx.principio_activo, mx.concentracion, mx.presentacion,
    ].some(v => matchTolerante(v, s));
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/almacen/catalogoQuickFilter.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/almacen/CatalogoMedicamentos.tsx src/test/almacen/catalogoQuickFilter.test.ts
git commit -m "feat: prop quickFilter en CatalogoMedicamentos (bajo_stock/por_caducar)"
```

---

## Task 4: Rediseño de navegación en `AlmacenTabs.tsx`

**Files:**
- Modify: `src/features/almacen/AlmacenTabs.tsx` (reemplaza la fila de 9 botones, líneas 53-102)
- Test: manual/visual (ver Step 4) — la lógica de conteo (`bajosStock`, `proxCaducidad`) ya está cubierta indirectamente por Task 3; este task es composición de UI, no lógica pura nueva.

**Interfaces:**
- Consumes: `quickFilter?: "bajo_stock" | "por_caducar" | null` prop de `CatalogoMedicamentos` (Task 3).
- Produces: nada consumido por tasks posteriores — es el último task del plan.

- [ ] **Step 1: Add `quickFilter` state and `DropdownMenu` imports**

En `src/features/almacen/AlmacenTabs.tsx`, agregar imports (después de línea 1):

```typescript
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
```

Agregar el nuevo estado junto a `view` (línea 28):

```typescript
  const [view, setView] = useState<AlmacenView>("catalogo");
  const [quickFilter, setQuickFilter] = useState<"bajo_stock" | "por_caducar" | null>(null);
```

- [ ] **Step 2: Replace the 9-button row (lines 53-102) with the new nav**

```typescript
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setQuickFilter(q => q === "bajo_stock" ? null : "bajo_stock"); setView("catalogo"); }}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors relative ${quickFilter === "bajo_stock" ? "bg-orange-500 text-white" : "text-muted-foreground hover:bg-muted"}`}
        >
          Bajo stock
          {bajosStock.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-xs font-bold h-4 min-w-[1rem] px-1">
              {bajosStock.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setQuickFilter(q => q === "por_caducar" ? null : "por_caducar"); setView("catalogo"); }}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors relative ${quickFilter === "por_caducar" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          Por caducar
          {proxCaducidad.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold h-4 min-w-[1rem] px-1">
              {proxCaducidad.length}
            </span>
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1">
              Reportes y control
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setView("faltantes")} className="cursor-pointer">
              Faltantes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("conteos")} className="cursor-pointer">
              Conteos
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("cofepris")} className="cursor-pointer">
              COFEPRIS
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("abc")} className="cursor-pointer">
              ABC / Rotación
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("mermas")} className="cursor-pointer">
              Mermas
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("reorden")} className="cursor-pointer gap-2">
              Reorden
              {bajosStock.length > 0 && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{bajosStock.length}</Badge>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("controlados")} className="cursor-pointer">
              Controlados
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {view !== "catalogo" && (
          <button
            onClick={() => setView("catalogo")}
            className="rounded-lg px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground"
          >
            ← Volver al catálogo
          </button>
        )}
      </div>
```

Nota de diseño: el botón "← Volver al catálogo" no está en el spec explícitamente, pero es necesario — sin un botón "Catálogo" fijo en la fila principal, el usuario que entra a una vista del dropdown (ej. "Mermas") no tiene forma de volver sin reabrir el dropdown y no hay un ítem "Catálogo" ahí. Aparece solo cuando `view !== "catalogo"`, no compite visualmente en el caso común (vista default).

- [ ] **Step 3: Pass `quickFilter` down to `CatalogoMedicamentos`**

Actualizar línea 104:

```typescript
      {view === "catalogo" && <CatalogoMedicamentos medicamentos={medicamentos} lotes={lotes} onReload={onReload} quickFilter={quickFilter} />}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, navegar a `/almacen` en el browser:
- Confirmar que carga en Catálogo por default.
- Click en "Bajo stock" → el grid de catálogo se filtra, badge muestra el conteo correcto.
- Click de nuevo en "Bajo stock" → se desactiva el filtro (toggle).
- Click en "Por caducar" → filtra por lotes próximos a vencer (≤90d).
- Abrir dropdown "Reportes y control" → los 7 ítems navegan a su vista correspondiente (contenido de cada panel sin cambios).
- Desde una vista del dropdown (ej. Mermas), click "← Volver al catálogo" regresa a Catálogo.
- Buscar "acetaminofen" sin acento encuentra "Acetaminofén" (verificación visual de Task 2).

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: PASS — ningún test roto por el cambio de navegación

- [ ] **Step 6: Commit**

```bash
git add src/features/almacen/AlmacenTabs.tsx
git commit -m "feat: navegacion Almacen unificada - catalogo default, chips rapidos, dropdown reportes"
```

---

## Self-Review Notes

- **Cobertura del spec:** Navegación (Task 4) ✅, prop `quickFilter` (Task 3) ✅, buscador tolerante + `normalizarTexto`/`distanciaLevenshtein` (Tasks 1-2) ✅, badges trasladados (Task 4: chip "Por caducar" reemplaza badge Caducidades, badge en ítem "Reorden" del dropdown) ✅, testing de casos de acentos/ñ/Levenshtein/quickFilter (Tasks 1-3) ✅, fuera de alcance respetado (ningún panel interno tocado, sin cambios de paleta) ✅.
- **Desviación del spec documentada:** el spec no menciona un botón de retorno a catálogo desde las vistas del dropdown; se agregó uno condicional (Task 4 Step 2) porque sin él la navegación queda rota — no es un requisito nuevo de producto, es necesario para que el diseño funcione.
- **Tipos:** `quickFilter` usa el mismo union type (`"bajo_stock" | "por_caducar" | null`) en `CatalogoMedicamentos` (Task 3) y en el estado de `AlmacenTabs` (Task 4) — verificado consistente.
