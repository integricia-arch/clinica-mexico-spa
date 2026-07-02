# Módulo Almacén Separado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extraer el tab "Inventario" de `src/pages/Farmacia.tsx` (9 sub-vistas,
~730 líneas, en parte JSX inline nunca antes extraído a componente propio) a
un módulo independiente: `src/features/almacen/`, página `Almacen.tsx`, ruta
`/almacen` sin `TurnoGuard`, item de sidebar propio.

**Architecture:** A diferencia del split de Compras (puro `git mv`), este
split combina: (a) mover 5 componentes ya propios de
`src/features/farmacia/` a `src/features/almacen/`, y (b) extraer 3 vistas
que hoy son JSX inline dentro de `Farmacia.tsx` (`faltantes`, `caducidades`,
`catalogo`) a componentes nuevos autocontenidos — cada uno recibe
`medicamentos`/`lotes` como props cuando los necesita y maneja su propio
estado de UI (search, dialogs, forms) internamente, sin lift-state a un
padre. `AlmacenTabs.tsx` es solo el pill-nav + router de las 9 sub-vistas.
`Almacen.tsx` es un wrapper delgado que hace su propio fetch de
`medicamentos`/`lotes` (mismo patrón que `Compras.tsx`, sin hook compartido).

**Tech Stack:** React 18 + TypeScript + Vite, React Router, Supabase JS.

## Global Constraints

- No se cambia lógica de negocio de ningún panel — es extracción de JSX +
  reubicación de archivos + routing, no un refactor funcional.
- Roles de acceso a `/almacen`: `["admin","nurse","receptionist","cajero"]`
  (mismos que `/farmacia`/`/compras` hoy).
- `/almacen` NO lleva `TurnoGuard`.
- `/almacen` NO se agrega a `FOCUS_ROUTES` en `AppLayout.tsx`.
- Tras mutar datos (guardar medicamento, registrar movimiento), los
  componentes de Almacén llaman `onReload()` (refetch del padre) en vez de
  actualizar estado local optimista — simplificación aceptada porque
  `medicamentos`/`lotes` ya no viven en el componente que muta, viven en
  `Almacen.tsx`.
- Sin tests unitarios nuevos: este repo no tiene tests de componente para
  páginas/features de Farmacia/Compras (confirmado: `find src -iname
  "*.test.*"` no devuelve nada bajo esas carpetas). La verificación correcta,
  igual que en el split de Compras, es `npx tsc --noEmit` + `npm run build` +
  smoke test manual en navegador por cada task.
- Implementar vista por vista (no todo en un commit) — este split es más
  grande que el de Compras.

---

### Task 1: Mover 5 componentes simples + scaffold de `AlmacenTabs`/`Almacen.tsx` + routing/nav

**Files:**
- Move (git mv): `src/features/farmacia/{InventarioCiclico.tsx,ReporteCOFEPRIS.tsx,ReporteRotacionABC.tsx,ActasMerma.tsx,LibroControlControlados.tsx}` → `src/features/almacen/`
- Modify: `src/pages/Farmacia.tsx` (actualizar 5 import paths, sin tocar nada más)
- Create: `src/features/almacen/AlmacenTabs.tsx`
- Create: `src/pages/Almacen.tsx`
- Modify: `src/App.tsx` (import + ruta)
- Modify: `src/components/AppLayout.tsx` (import ícono `Package` + `NavItem`)

**Interfaces:**
- Consumes: `PuntoReorden` desde `@/features/compras/PuntoReorden` (ya existe, sin cambios).
- Produces: `AlmacenTabs({ medicamentos, lotes, onReload, loading }: { medicamentos: Medicamento[]; lotes: Lote[]; onReload: () => void; loading: boolean }) : JSX.Element` — consumido por Tasks 2, 3, 4 (agregan vistas) y por `Almacen.tsx`. `Almacen` (default export) — consumido por Task 1 mismo (routing).

- [ ] **Step 1: Mover los 5 componentes**

```bash
cd src/features/farmacia
git mv InventarioCiclico.tsx ReporteCOFEPRIS.tsx ReporteRotacionABC.tsx ActasMerma.tsx LibroControlControlados.tsx ../almacen/
cd ../../..
```

(`src/features/almacen/` no existe aún — `git mv` la crea automáticamente al mover el primer archivo.)

- [ ] **Step 2: Actualizar los 5 imports en `Farmacia.tsx`**

Reemplazar:

```tsx
import InventarioCiclico from "@/features/farmacia/InventarioCiclico";
import ReporteCOFEPRIS from "@/features/farmacia/ReporteCOFEPRIS";
import ReporteRotacionABC from "@/features/farmacia/ReporteRotacionABC";
import ActasMerma from "@/features/farmacia/ActasMerma";
import PuntoReorden from "@/features/compras/PuntoReorden";
import LibroControlControlados from "@/features/farmacia/LibroControlControlados";
```

por:

```tsx
import InventarioCiclico from "@/features/almacen/InventarioCiclico";
import ReporteCOFEPRIS from "@/features/almacen/ReporteCOFEPRIS";
import ReporteRotacionABC from "@/features/almacen/ReporteRotacionABC";
import ActasMerma from "@/features/almacen/ActasMerma";
import PuntoReorden from "@/features/compras/PuntoReorden";
import LibroControlControlados from "@/features/almacen/LibroControlControlados";
```

(Esto mantiene `Farmacia.tsx` compilando y su tab "Inventario" funcionando
igual que hoy — se elimina recién en Task 5, una vez que `AlmacenTabs` tenga
paridad completa de las 9 vistas.)

- [ ] **Step 3: Verificar que no queda ninguna referencia a las rutas viejas**

```bash
grep -n "features/farmacia/InventarioCiclico\|features/farmacia/ReporteCOFEPRIS\|features/farmacia/ReporteRotacionABC\|features/farmacia/ActasMerma\|features/farmacia/LibroControlControlados" src -r
```

Expected: sin resultados.

- [ ] **Step 4: Escribir `src/features/almacen/AlmacenTabs.tsx`**

```tsx
import { useState } from "react";
import type { Tables } from "@/integrations/supabase/types";
import InventarioCiclico from "@/features/almacen/InventarioCiclico";
import ReporteCOFEPRIS from "@/features/almacen/ReporteCOFEPRIS";
import ReporteRotacionABC from "@/features/almacen/ReporteRotacionABC";
import ActasMerma from "@/features/almacen/ActasMerma";
import LibroControlControlados from "@/features/almacen/LibroControlControlados";
import PuntoReorden from "@/features/compras/PuntoReorden";

type Medicamento = Tables<"medicamentos">;
type Lote = Tables<"lotes_medicamento">;

type AlmacenView =
  | "catalogo" | "faltantes" | "caducidades"
  | "conteos" | "cofepris" | "abc" | "mermas" | "reorden" | "controlados";

interface Props {
  medicamentos: Medicamento[];
  lotes: Lote[];
  onReload: () => void;
  loading: boolean;
}

export default function AlmacenTabs({ medicamentos, lotes, onReload, loading }: Props) {
  const [view, setView] = useState<AlmacenView>("conteos");

  const stockTotal = (medId: string) =>
    lotes.filter(l => l.medicamento_id === medId).reduce((s, l) => s + l.existencia, 0);
  const bajosStock = medicamentos.filter(m => stockTotal(m.id) < m.stock_minimo);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Almacén</h1>
        <p className="mt-1 text-sm text-muted-foreground">Control de inventario y compras</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setView("conteos")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${view === "conteos" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >Conteos</button>
        <button
          onClick={() => setView("cofepris")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${view === "cofepris" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >COFEPRIS</button>
        <button
          onClick={() => setView("abc")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${view === "abc" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >ABC / Rotación</button>
        <button
          onClick={() => setView("mermas")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${view === "mermas" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >Mermas</button>
        <button
          onClick={() => setView("reorden")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors relative ${view === "reorden" ? "bg-orange-500 text-white" : "text-muted-foreground hover:bg-muted"}`}
        >
          Reorden
          {bajosStock.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-xs font-bold h-4 min-w-[1rem] px-1">{bajosStock.length}</span>
          )}
        </button>
        <button
          onClick={() => setView("controlados")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${view === "controlados" ? "bg-red-600 text-white" : "text-muted-foreground hover:bg-muted"}`}
        >Controlados</button>
      </div>

      {view === "conteos" && <InventarioCiclico />}
      {view === "cofepris" && <ReporteCOFEPRIS />}
      {view === "abc" && <ReporteRotacionABC />}
      {view === "mermas" && <ActasMerma />}
      {view === "reorden" && (
        <PuntoReorden medicamentos={medicamentos} lotes={lotes} onOcCreada={() => setView("reorden")} />
      )}
      {view === "controlados" && <LibroControlControlados medicamentos={medicamentos} />}
    </div>
  );
}
```

(`onReload` no se usa todavía en este archivo — se usa a partir de Task 4,
cuando `CatalogoMedicamentos` lo necesita tras guardar. TypeScript no falla
por un prop no usado dentro del cuerpo de la función siempre que esté
destructurado y tipado; se deja destructurado desde ahora para no tener que
tocar la firma de nuevo en Task 4.)

- [ ] **Step 5: Escribir `src/pages/Almacen.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import AlmacenTabs from "@/features/almacen/AlmacenTabs";

type Medicamento = Tables<"medicamentos">;
type Lote = Tables<"lotes_medicamento">;

export default function Almacen() {
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: meds }, { data: lts }] = await Promise.all([
      supabase.from("medicamentos").select("*").eq("activo", true).order("nombre"),
      supabase.from("lotes_medicamento").select("*").order("fecha_caducidad"),
    ]);
    setMedicamentos(meds ?? []);
    setLotes(lts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return <AlmacenTabs medicamentos={medicamentos} lotes={lotes} onReload={loadData} loading={loading} />;
}
```

- [ ] **Step 6: Ruta `/almacen` en `src/App.tsx`**

Después de la línea:
```tsx
import Compras from "@/pages/Compras";
```
agregar:
```tsx
import Almacen from "@/pages/Almacen";
```

Después de la línea:
```tsx
<Route path="/compras" element={<ProtectedRoute allowedRoles={["admin","nurse","receptionist","cajero"]}><Compras /></ProtectedRoute>} />
```
agregar:
```tsx
<Route path="/almacen" element={<ProtectedRoute allowedRoles={["admin","nurse","receptionist","cajero"]}><Almacen /></ProtectedRoute>} />
```

- [ ] **Step 7: Item de nav en `src/components/AppLayout.tsx`**

Cambiar el import de íconos (agregar `Package`):
```tsx
import {
  LayoutDashboard, Users, CalendarDays, Receipt, FileText,
  Pill, Settings, Menu, X, Bell, ChevronDown, LogOut,
  Headset, MessageCircle, BellRing, ClipboardList, Stethoscope,
  CreditCard, Lock, UserRound, ChevronLeft, ChevronRight,
  Send, Gift, ShoppingCart,
} from "lucide-react";
```
por:
```tsx
import {
  LayoutDashboard, Users, CalendarDays, Receipt, FileText,
  Pill, Settings, Menu, X, Bell, ChevronDown, LogOut,
  Headset, MessageCircle, BellRing, ClipboardList, Stethoscope,
  CreditCard, Lock, UserRound, ChevronLeft, ChevronRight,
  Send, Gift, ShoppingCart, Package,
} from "lucide-react";
```

Cambiar:
```tsx
  { section: "Operaciones", to: "/farmacia", icon: CreditCard, label: "Caja", roles: ["admin", "nurse", "receptionist", "cajero"] },
  { to: "/compras", icon: ShoppingCart, label: "Compras", roles: ["admin", "nurse", "receptionist", "cajero"] },
```
por:
```tsx
  { section: "Operaciones", to: "/farmacia", icon: CreditCard, label: "Caja", roles: ["admin", "nurse", "receptionist", "cajero"] },
  { to: "/compras", icon: ShoppingCart, label: "Compras", roles: ["admin", "nurse", "receptionist", "cajero"] },
  { to: "/almacen", icon: Package, label: "Almacén", roles: ["admin", "nurse", "receptionist", "cajero"] },
```

- [ ] **Step 8: Verificar build**

```bash
npx tsc --noEmit -p tsconfig.json
npm run build
```

Expected: ambos sin errores (exit code 0).

- [ ] **Step 9: Smoke test manual**

```bash
npm run dev
```

En el navegador: iniciar sesión (rol `admin`), confirmar item "Almacén" en el
sidebar (sección Operaciones, entre Compras y Enfermería), navegar a
`/almacen`, confirmar que carga sin turno de caja abierto y que las pestañas
Conteos/COFEPRIS/ABC-Rotación/Mermas/Reorden/Controlados muestran los mismos
datos que hoy se ven en Farmacia → Inventario para esas mismas sub-vistas.
Confirmar que `/farmacia` sigue funcionando exactamente igual (su tab
Inventario todavía tiene las 9 vistas, duplicado temporal esperado).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: scaffold módulo Almacén (6/9 vistas) + ruta /almacen + nav"
```

---

### Task 2: Extraer `FaltantesPanel.tsx`

**Files:**
- Create: `src/features/almacen/FaltantesPanel.tsx`
- Modify: `src/features/almacen/AlmacenTabs.tsx`

**Interfaces:**
- Consumes: nada (componente 100% autocontenido, sin props).
- Produces: `FaltantesPanel(): JSX.Element` (default export), consumido por `AlmacenTabs.tsx`.

- [ ] **Step 1: Escribir `src/features/almacen/FaltantesPanel.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function FaltantesPanel() {
  const { toast } = useToast();
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loadingAlertas, setLoadingAlertas] = useState(false);
  const [filtroAlertas, setFiltroAlertas] = useState<"pending" | "resolved" | "external">("pending");

  const loadAlertas = useCallback(async () => {
    setLoadingAlertas(true);
    const { data } = await supabase
      .from("almacen_alertas" as never)
      .select("*, medicamentos(nombre)")
      .eq("status", filtroAlertas)
      .order("created_at", { ascending: false })
      .limit(100);
    setAlertas((data as any[]) ?? []);
    setLoadingAlertas(false);
  }, [filtroAlertas]);

  useEffect(() => { loadAlertas(); }, [loadAlertas]);

  async function resolveAlerta(id: string, newStatus: "resolved" | "external") {
    const { error } = await supabase
      .from("almacen_alertas" as never)
      .update({ status: newStatus, resolved_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    setAlertas((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Bitácora de faltantes</h2>
        <div className="flex gap-1">
          {(["pending", "resolved", "external"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFiltroAlertas(s)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${filtroAlertas === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
            >
              {s === "pending" ? "Pendientes" : s === "resolved" ? "Resueltos" : "Externos"}
            </button>
          ))}
        </div>
      </div>
      {loadingAlertas ? (
        <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
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
              {alertas.map((a: any) => (
                <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2 font-medium">{a.medicamentos?.nombre ?? a.generic_name ?? "Sin nombre"}</td>
                  <td className="px-4 py-2 text-center">{a.quantity_needed}</td>
                  <td className="px-4 py-2 text-center text-destructive">{a.quantity_available}</td>
                  <td className="px-4 py-2 text-center font-semibold text-destructive">-{a.quantity_needed - a.quantity_available}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{format(new Date(a.created_at), "dd/MM/yyyy HH:mm", { locale: es })}</td>
                  {filtroAlertas === "pending" && (
                    <td className="px-4 py-2">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => resolveAlerta(a.id, "external")}>Externo</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50" onClick={() => resolveAlerta(a.id, "resolved")}>Recibido</Button>
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
  );
}
```

Nota: el componente carga alertas en su propio `mount` (sin depender de un
`tab === "inventario"` externo como hacía `Farmacia.tsx`) porque solo se
monta cuando `AlmacenTabs` selecciona `view === "faltantes"` — mismo efecto
de carga perezosa, lograda por unmount/remount en vez de un `if` sobre `tab`.

- [ ] **Step 2: Wire en `AlmacenTabs.tsx`**

Agregar el import (junto a los demás de `@/features/almacen/`):
```tsx
import FaltantesPanel from "@/features/almacen/FaltantesPanel";
```

Agregar el botón del pill-nav, entre "Conteos" y "COFEPRIS" no — el orden
visual original era Catálogo, Caducidades, Faltantes, Conteos, COFEPRIS, ABC,
Mermas, Reorden, Controlados. Como Catálogo/Caducidades se agregan en Tasks 3
y 4, por ahora insertar el botón de Faltantes **antes** de "Conteos":

```tsx
        <button
          onClick={() => setView("faltantes")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${view === "faltantes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >Faltantes</button>
        <button
          onClick={() => setView("conteos")}
```

(reemplaza la línea `<button onClick={() => setView("conteos")}` agregando
el bloque de Faltantes justo antes).

Agregar la vista, junto a las otras condicionales de render:
```tsx
      {view === "faltantes" && <FaltantesPanel />}
      {view === "conteos" && <InventarioCiclico />}
```

- [ ] **Step 3: Verificar build**

```bash
npx tsc --noEmit -p tsconfig.json
npm run build
```

Expected: sin errores.

- [ ] **Step 4: Smoke test manual**

En `/almacen`, pestaña "Faltantes": confirmar que lista alertas pendientes,
que los filtros Pendientes/Resueltos/Externos funcionan, y que "Recibido"/
"Externo" resuelven una alerta y la quitan de la lista — comparar contra el
comportamiento actual en `/farmacia` → Inventario → Faltantes (que sigue
existiendo intacto hasta Task 5).

- [ ] **Step 5: Commit**

```bash
git add src/features/almacen/FaltantesPanel.tsx src/features/almacen/AlmacenTabs.tsx
git commit -m "feat: extraer FaltantesPanel a módulo Almacén"
```

---

### Task 3: Extraer `CaducidadesPanel.tsx`

**Files:**
- Create: `src/features/almacen/CaducidadesPanel.tsx`
- Modify: `src/features/almacen/AlmacenTabs.tsx`

**Interfaces:**
- Consumes: `medicamentos: Medicamento[]`, `lotes: Lote[]` (tipos `Tables<"medicamentos">`/`Tables<"lotes_medicamento">`, ya producidos por `Almacen.tsx` en Task 1).
- Produces: `CaducidadesPanel({ medicamentos, lotes }: { medicamentos: Medicamento[]; lotes: Lote[] }): JSX.Element`, consumido por `AlmacenTabs.tsx`. También produce el cálculo de `proxCaducidad`/`lotesCriticos` que `AlmacenTabs.tsx` necesita replicar (mínimamente) para el badge del pill-nav.

- [ ] **Step 1: Escribir `src/features/almacen/CaducidadesPanel.tsx`**

```tsx
import type { Tables } from "@/integrations/supabase/types";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";

type Medicamento = Tables<"medicamentos">;
type Lote = Tables<"lotes_medicamento">;

interface Props {
  medicamentos: Medicamento[];
  lotes: Lote[];
}

export default function CaducidadesPanel({ medicamentos, lotes }: Props) {
  const hoy = new Date();
  const en30 = new Date(hoy); en30.setDate(hoy.getDate() + 30);
  const en60 = new Date(hoy); en60.setDate(hoy.getDate() + 60);
  const en90 = new Date(hoy); en90.setDate(hoy.getDate() + 90);

  const lotesCriticos = lotes.filter(l => l.fecha_caducidad && new Date(l.fecha_caducidad) <= en30 && l.existencia > 0);
  const lotesAlerta   = lotes.filter(l => l.fecha_caducidad && new Date(l.fecha_caducidad) > en30 && new Date(l.fecha_caducidad) <= en60 && l.existencia > 0);
  const lotesAtencion = lotes.filter(l => l.fecha_caducidad && new Date(l.fecha_caducidad) > en60 && new Date(l.fecha_caducidad) <= en90 && l.existencia > 0);
  const proxCaducidad = [...lotesCriticos, ...lotesAlerta, ...lotesAtencion];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Lotes próximos a vencer</h2>
        <p className="text-xs text-muted-foreground">Protocolo FEFO — despachar el más próximo a vencer primero</p>
      </div>

      {proxCaducidad.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="mx-auto h-8 w-8 mb-2 opacity-30" />
          <p className="text-sm">Sin lotes próximos a vencer en los próximos 90 días</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[
            { label: "🔴 Crítico — menos de 30 días", lotes: lotesCriticos, color: "border-destructive/40 bg-destructive/5", badge: "bg-destructive text-destructive-foreground" },
            { label: "🟠 Alerta — 30 a 60 días", lotes: lotesAlerta, color: "border-orange-400/40 bg-orange-50 dark:bg-orange-950/20", badge: "bg-orange-500 text-white" },
            { label: "🟡 Atención — 60 a 90 días", lotes: lotesAtencion, color: "border-yellow-400/40 bg-yellow-50 dark:bg-yellow-950/20", badge: "bg-yellow-500 text-white" },
          ].map(({ label, lotes: tier, color, badge }) => tier.length > 0 && (
            <div key={label} className={`rounded-xl border ${color} overflow-hidden`}>
              <div className="px-4 py-2 border-b border-inherit flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${badge}`}>{tier.length}</span>
                <span className="text-sm font-semibold">{label}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-inherit">
                    <th className="px-4 py-2 text-left font-medium">Medicamento</th>
                    <th className="px-4 py-2 text-left font-medium">Lote</th>
                    <th className="px-4 py-2 text-center font-medium">Caducidad</th>
                    <th className="px-4 py-2 text-center font-medium">Días</th>
                    <th className="px-4 py-2 text-center font-medium">Existencia</th>
                    <th className="px-4 py-2 text-left font-medium">Acción sugerida</th>
                  </tr>
                </thead>
                <tbody>
                  {tier.map(lote => {
                    const med = medicamentos.find(m => m.id === lote.medicamento_id);
                    const diasRestantes = Math.ceil((new Date(lote.fecha_caducidad).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
                    const accion = diasRestantes <= 15
                      ? "Destrucción COFEPRIS"
                      : diasRestantes <= 30
                      ? "Oferta / devolución proveedor"
                      : diasRestantes <= 60
                      ? "Priorizar despacho (FEFO)"
                      : "Monitorear";
                    return (
                      <tr key={lote.id} className="border-b border-inherit/50 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-2 font-medium">{med?.nombre ?? "—"}</td>
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{lote.numero_lote}</td>
                        <td className="px-4 py-2 text-center text-xs">
                          {format(new Date(lote.fecha_caducidad), "dd/MM/yyyy")}
                        </td>
                        <td className="px-4 py-2 text-center font-bold">
                          <span className={diasRestantes <= 30 ? "text-destructive" : diasRestantes <= 60 ? "text-orange-600" : "text-yellow-600"}>
                            {diasRestantes}d
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">{lote.existencia}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{accion}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire en `AlmacenTabs.tsx`**

Agregar el import:
```tsx
import CaducidadesPanel from "@/features/almacen/CaducidadesPanel";
```

Agregar el cálculo de `proxCaducidad` para el badge (junto a `bajosStock`):
```tsx
  const stockTotal = (medId: string) =>
    lotes.filter(l => l.medicamento_id === medId).reduce((s, l) => s + l.existencia, 0);
  const bajosStock = medicamentos.filter(m => stockTotal(m.id) < m.stock_minimo);

  const hoy = new Date();
  const en90 = new Date(hoy); en90.setDate(hoy.getDate() + 90);
  const proxCaducidad = lotes.filter(l => l.fecha_caducidad && new Date(l.fecha_caducidad) <= en90 && l.existencia > 0);
```

Agregar el botón, **antes** del de "Faltantes" (orden visual original:
Caducidades antes de Faltantes):
```tsx
        <button
          onClick={() => setView("caducidades")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors relative ${view === "caducidades" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          Caducidades
          {proxCaducidad.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold h-4 min-w-[1rem] px-1">
              {proxCaducidad.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setView("faltantes")}
```

Agregar la vista:
```tsx
      {view === "caducidades" && <CaducidadesPanel medicamentos={medicamentos} lotes={lotes} />}
      {view === "faltantes" && <FaltantesPanel />}
```

- [ ] **Step 3: Verificar build**

```bash
npx tsc --noEmit -p tsconfig.json
npm run build
```

Expected: sin errores.

- [ ] **Step 4: Smoke test manual**

En `/almacen`, pestaña "Caducidades": confirmar que el badge de conteo y los
3 buckets (crítico/alerta/atención) coinciden exactamente con lo que muestra
hoy `/farmacia` → Inventario → Caducidades para los mismos datos.

- [ ] **Step 5: Commit**

```bash
git add src/features/almacen/CaducidadesPanel.tsx src/features/almacen/AlmacenTabs.tsx
git commit -m "feat: extraer CaducidadesPanel a módulo Almacén"
```

---

### Task 4: Extraer `CatalogoMedicamentos.tsx` (la vista más grande, con dialogs)

**Files:**
- Create: `src/features/almacen/CatalogoMedicamentos.tsx`
- Modify: `src/features/almacen/AlmacenTabs.tsx`

**Interfaces:**
- Consumes: `medicamentos: Medicamento[]`, `lotes: Lote[]`, `onReload: () => void`. `MedicamentoProveedoresPanel` desde `@/features/compras/MedicamentoProveedoresPanel` (props `medicamentoId: string`, `medicamentoNombre: string`, ya existente sin cambios).
- Produces: `CatalogoMedicamentos({ medicamentos, lotes, onReload }: { medicamentos: Medicamento[]; lotes: Lote[]; onReload: () => void }): JSX.Element`, consumido por `AlmacenTabs.tsx`.

- [ ] **Step 1: Escribir `src/features/almacen/CatalogoMedicamentos.tsx`**

```tsx
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, AlertTriangle, Package, Pill, ArrowDownCircle, ArrowUpCircle, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { friendlyError } from "@/lib/errors";
import MedicamentoProveedoresPanel from "@/features/compras/MedicamentoProveedoresPanel";

type Medicamento = Tables<"medicamentos">;
type Lote = Tables<"lotes_medicamento">;

const formatMXN = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const CATEGORIAS = ["Analgésico","Antibiótico","Antiinflamatorio","Antihipertensivo","Antidiabético",
  "Gastrointestinal","Antihistamínico","Broncodilatador","Neurológico","Soluciones","Vitaminas","Tópico","Otro"];
const UNIDADES = ["tableta","cápsula","frasco","ampolleta","pieza","sobre","ml","g"];

const SALE_TYPES = [
  { value: "otc", label: "OTC / venta libre" },
  { value: "receta_requerida", label: "Requiere receta médica" },
  { value: "receta_retenida", label: "Receta retenida" },
  { value: "controlado", label: "Controlado (psicotrópico/estupefaciente)" },
  { value: "no_medicamento", label: "Insumo / no medicamento" },
] as const;

const EMPTY_MED = {
  nombre: "", categoria: "Analgésico", descripcion: "", precio_unitario: "", stock_minimo: "0", stock_maximo: "0", unidad: "tableta",
  tipo_control: "otc",
  barcode: "", sku: "", codigo_interno: "",
  laboratorio: "", principio_activo: "", forma_farmaceutica: "", concentracion: "", presentacion: "",
  registro_sanitario: "",
  sale_type: "otc",
  allow_direct_sale: true,
  requires_prescription: false,
  is_controlled: false,
  regulatory_notes: "",
  indicaciones_uso: "",
  contraindicaciones: "",
  advertencias: "",
  interacciones_relevantes: "",
  fuente_info: "",
  equivalence_group_key: "",
};
const EMPTY_MOV = { medicamento_id:"", lote_id:"", tipo:"entrada", cantidad:"", motivo:"", numero_lote:"", fecha_caducidad:"" };

interface Props {
  medicamentos: Medicamento[];
  lotes: Lote[];
  onReload: () => void;
}

export default function CatalogoMedicamentos({ medicamentos, lotes, onReload }: Props) {
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const canWrite = hasRole("admin") || hasRole("nurse");

  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [medModal, setMedModal] = useState(false);
  const [editMed, setEditMed] = useState<Medicamento | null>(null);
  const [medForm, setMedForm] = useState(EMPTY_MED);
  const [savingMed, setSavingMed] = useState(false);

  const [movModal, setMovModal] = useState(false);
  const [movForm, setMovForm] = useState(EMPTY_MOV);
  const [savingMov, setSavingMov] = useState(false);

  const hoy = new Date();
  const en30 = new Date(hoy); en30.setDate(hoy.getDate() + 30);

  const stockTotal = (medId: string) =>
    lotes.filter(l => l.medicamento_id === medId).reduce((s, l) => s + l.existencia, 0);
  const lotesDe = (medId: string) => lotes.filter(l => l.medicamento_id === medId);

  const bajosStock = medicamentos.filter(m => stockTotal(m.id) < m.stock_minimo);
  const proxCaducidad = lotes.filter(l => l.fecha_caducidad && new Date(l.fecha_caducidad) <= en30 && l.existencia > 0);

  const filtered = medicamentos.filter(m => {
    const s = search.trim().toLowerCase();
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
    ].some(v => (v ?? "").toLowerCase().includes(s));
  });

  // ── Medicamento CRUD ──────────────────────────────────────────────
  function openNewMed() { setEditMed(null); setMedForm(EMPTY_MED); setMedModal(true); }
  function openEditMed(m: Medicamento) {
    setEditMed(m);
    setMedForm({
      nombre: m.nombre,
      categoria: m.categoria,
      descripcion: m.descripcion ?? "",
      precio_unitario: String(m.precio_unitario),
      stock_minimo: String(m.stock_minimo),
      stock_maximo: String((m as Medicamento & { stock_maximo?: number }).stock_maximo ?? 0),
      tipo_control: (m as Medicamento & { tipo_control?: string }).tipo_control ?? "otc",
      unidad: m.unidad,
      barcode: (m as Medicamento & { barcode?: string | null }).barcode ?? "",
      sku: (m as Medicamento & { sku?: string | null }).sku ?? "",
      codigo_interno: (m as Medicamento & { codigo_interno?: string | null }).codigo_interno ?? "",
      laboratorio: (m as Medicamento & { laboratorio?: string | null }).laboratorio ?? "",
      principio_activo: (m as Medicamento & { principio_activo?: string | null }).principio_activo ?? "",
      forma_farmaceutica: (m as Medicamento & { forma_farmaceutica?: string | null }).forma_farmaceutica ?? "",
      concentracion: (m as Medicamento & { concentracion?: string | null }).concentracion ?? "",
      presentacion: (m as Medicamento & { presentacion?: string | null }).presentacion ?? "",
      registro_sanitario: (m as Medicamento & { registro_sanitario?: string | null }).registro_sanitario ?? "",
      sale_type: m.sale_type ?? "otc",
      allow_direct_sale: m.allow_direct_sale ?? true,
      requires_prescription: m.requires_prescription ?? false,
      is_controlled: m.is_controlled ?? false,
      regulatory_notes: m.regulatory_notes ?? "",
      indicaciones_uso: (m as Medicamento & { indicaciones_uso?: string | null }).indicaciones_uso ?? "",
      contraindicaciones: (m as Medicamento & { contraindicaciones?: string | null }).contraindicaciones ?? "",
      advertencias: (m as Medicamento & { advertencias?: string | null }).advertencias ?? "",
      interacciones_relevantes: (m as Medicamento & { interacciones_relevantes?: string | null }).interacciones_relevantes ?? "",
      fuente_info: (m as Medicamento & { fuente_info?: string | null }).fuente_info ?? "",
      equivalence_group_key: (m as Medicamento & { equivalence_group_key?: string | null }).equivalence_group_key ?? "",
    });
    setMedModal(true);
  }

  async function saveMed() {
    if (!medForm.nombre.trim()) { toast({ variant:"destructive", title:"Error", description:"Nombre requerido" }); return; }
    setSavingMed(true);
    const blocksDirect = ["receta_requerida", "receta_retenida", "controlado"].includes(medForm.sale_type);
    const allowsDirect = blocksDirect ? false : medForm.allow_direct_sale;
    const requiresRx = blocksDirect ? true : medForm.requires_prescription;
    const isControlled = medForm.sale_type === "controlado" ? true : medForm.is_controlled;

    const payload = {
      nombre: medForm.nombre.trim(),
      categoria: medForm.categoria,
      descripcion: medForm.descripcion || null,
      precio_unitario: parseFloat(medForm.precio_unitario) || 0,
      stock_minimo: parseInt(medForm.stock_minimo) || 0,
      stock_maximo: parseInt((medForm as typeof medForm & { stock_maximo?: string }).stock_maximo ?? "0") || 0,
      tipo_control: (medForm as typeof medForm & { tipo_control?: string }).tipo_control ?? "otc",
      unidad: medForm.unidad,
      barcode: medForm.barcode.trim() || null,
      sku: medForm.sku.trim() || null,
      codigo_interno: medForm.codigo_interno.trim() || null,
      laboratorio: medForm.laboratorio.trim() || null,
      principio_activo: medForm.principio_activo.trim() || null,
      forma_farmaceutica: medForm.forma_farmaceutica.trim() || null,
      concentracion: medForm.concentracion.trim() || null,
      presentacion: medForm.presentacion.trim() || null,
      registro_sanitario: medForm.registro_sanitario.trim() || null,
      sale_type: medForm.sale_type,
      allow_direct_sale: allowsDirect,
      requires_prescription: requiresRx,
      is_controlled: isControlled,
      regulatory_notes: medForm.regulatory_notes.trim() || null,
      indicaciones_uso: medForm.indicaciones_uso.trim() || null,
      contraindicaciones: medForm.contraindicaciones.trim() || null,
      advertencias: medForm.advertencias.trim() || null,
      interacciones_relevantes: medForm.interacciones_relevantes.trim() || null,
      fuente_info: medForm.fuente_info.trim() || null,
      equivalence_group_key: medForm.equivalence_group_key.trim() || null,
    };
    if (editMed) {
      const { error } = await supabase.from("medicamentos").update(payload).eq("id", editMed.id);
      if (error) { toast({ variant:"destructive", title:"Error", description: friendlyError(error) }); }
      else { toast({ title:"Medicamento actualizado" }); setMedModal(false); onReload(); }
    } else {
      const { error } = await supabase.from("medicamentos").insert(payload);
      if (error) { toast({ variant:"destructive", title:"Error", description: friendlyError(error) }); }
      else { toast({ title:"Medicamento registrado" }); setMedModal(false); onReload(); }
    }
    setSavingMed(false);
  }

  async function deactivateMed(m: Medicamento) {
    const { error } = await supabase.from("medicamentos").update({ activo: false }).eq("id", m.id);
    if (error) toast({ variant:"destructive", title:"Error", description: friendlyError(error) });
    else { toast({ title:"Medicamento desactivado" }); onReload(); }
  }

  // ── Movimientos ───────────────────────────────────────────────────
  function openMov(tipo: string, medId = "") {
    setMovForm({ ...EMPTY_MOV, tipo, medicamento_id: medId });
    setMovModal(true);
  }

  async function saveMov() {
    if (!movForm.medicamento_id || !movForm.cantidad || parseInt(movForm.cantidad) <= 0) {
      toast({ variant:"destructive", title:"Error", description:"Selecciona medicamento y cantidad válida" }); return;
    }
    if (movForm.tipo === "entrada" && !movForm.numero_lote) {
      toast({ variant:"destructive", title:"Error", description:"Número de lote requerido para entradas" }); return;
    }
    if (movForm.tipo === "entrada" && !movForm.fecha_caducidad) {
      toast({ variant:"destructive", title:"Error", description:"Fecha de caducidad requerida para entradas de lote" }); return;
    }
    setSavingMov(true);
    const cantidad = parseInt(movForm.cantidad);
    let loteId: string | null = movForm.lote_id || null;

    try {
      if (movForm.tipo === "entrada") {
        const existente = lotesDe(movForm.medicamento_id).find(l => l.numero_lote === movForm.numero_lote);
        if (existente) {
          await supabase.rpc("increment_lote_existencia" as never, {
            p_lote_id: existente.id,
            p_cantidad: cantidad,
          } as never);
          loteId = existente.id;
        } else {
          const { data: nuevoLote, error } = await supabase.from("lotes_medicamento").insert({
            medicamento_id: movForm.medicamento_id,
            numero_lote: movForm.numero_lote,
            fecha_caducidad: movForm.fecha_caducidad,
            existencia: cantidad,
          }).select().single();
          if (error) throw error;
          loteId = nuevoLote.id;
        }
      } else if (loteId) {
        const lote = lotes.find(l => l.id === loteId);
        if (lote) {
          if (cantidad > lote.existencia) {
            toast({ variant: "destructive", title: "Stock insuficiente", description: `Solo hay ${lote.existencia} unidades disponibles en el lote seleccionado.` });
            setSavingMov(false);
            return;
          }
          const nueva = lote.existencia - cantidad;
          await supabase.from("lotes_medicamento").update({ existencia: nueva }).eq("id", lote.id);
        }
      }

      const { error } = await supabase.from("movimientos_inventario").insert({
        medicamento_id: movForm.medicamento_id, lote_id: loteId,
        tipo: movForm.tipo as any, cantidad, motivo: movForm.motivo || null,
      });
      if (error) throw error;

      toast({ title: movForm.tipo === "entrada" ? "Entrada registrada" : movForm.tipo === "merma" ? "Merma registrada" : movForm.tipo === "uso_interno" ? "Uso interno registrado" : "Salida registrada" });
      setMovModal(false);
      setMovForm(EMPTY_MOV);
      onReload();
    } catch (e: any) {
      toast({ variant:"destructive", title:"Error", description:e.message });
    }
    setSavingMov(false);
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Farmacia y almacén</h1>
          <p className="mt-1 text-sm text-muted-foreground">Control de inventario y dispensación</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openMov("salida")}>
              <ArrowUpCircle className="mr-2 h-4 w-4" />Salida
            </Button>
            <Button onClick={() => openMov("entrada")}>
              <ArrowDownCircle className="mr-2 h-4 w-4" />Entrada
            </Button>
          </div>
        )}
      </div>

      {/* Alertas */}
      {bajosStock.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">⚠ {bajosStock.length} medicamento{bajosStock.length > 1 ? "s" : ""} bajo mínimo</p>
            <p className="text-xs text-muted-foreground mt-0.5">{bajosStock.map(m => m.nombre).join(", ")}</p>
          </div>
        </div>
      )}
      {proxCaducidad.length > 0 && (
        <div className="w-full text-left rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">{proxCaducidad.length} lote{proxCaducidad.length > 1 ? "s" : ""} próximo{proxCaducidad.length > 1 ? "s" : ""} a vencer (≤30d)</p>
            <p className="text-xs text-muted-foreground mt-0.5">Ver pestaña "Caducidades" para el detalle por urgencia</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Package, label: "Total productos", value: medicamentos.length, color: "" },
          { icon: Pill, label: "Lotes activos", value: lotes.filter(l => l.existencia > 0).length, color: "" },
          { icon: AlertTriangle, label: "Stock bajo", value: bajosStock.length, color: "text-destructive" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className={`flex items-center gap-2 text-sm font-medium text-muted-foreground ${color}`}>
              <Icon className="h-4 w-4" />{label}
            </div>
            <p className={`mt-1 text-2xl font-bold ${color || "text-foreground"}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Búsqueda + nuevo */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, código de barras, SKU, laboratorio, principio activo..." value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        {canWrite && (
          <Button variant="outline" onClick={openNewMed}>
            <Plus className="mr-2 h-4 w-4" />Nuevo medicamento
          </Button>
        )}
      </div>

      {/* Lista de medicamentos */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Pill className="mx-auto h-10 w-10 mb-3 opacity-30" />
          <p>No se encontraron medicamentos</p>
          {canWrite && <Button variant="outline" className="mt-4" onClick={openNewMed}><Plus className="mr-2 h-4 w-4" />Registrar medicamento</Button>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(med => {
            const stock = stockTotal(med.id);
            const bajo = stock < med.stock_minimo;
            const isOpen = expanded === med.id;
            const lotesActivos = lotesDe(med.id).filter(l => l.existencia > 0);
            return (
              <div key={med.id} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : med.id)}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Pill className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-card-foreground truncate">{med.nombre}</p>
                    <p className="text-xs text-muted-foreground">{med.categoria} · {med.unidad}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    <Badge variant={bajo ? "destructive" : "secondary"}>
                      {stock} {bajo ? "⚠ bajo mínimo" : "en stock"}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{formatMXN(med.precio_unitario)}</span>
                  </div>
                  {canWrite && (
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openMov("entrada", med.id)}>
                        <ArrowDownCircle className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openMov("salida", med.id)}>
                        <ArrowUpCircle className="h-4 w-4 text-orange-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditMed(med)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                </div>

                {isOpen && (() => {
                  const mx = med as Medicamento & {
                    indicaciones_uso?: string | null; contraindicaciones?: string | null;
                    advertencias?: string | null; interacciones_relevantes?: string | null;
                    fuente_info?: string | null; equivalence_group_key?: string | null;
                    principio_activo?: string | null; concentracion?: string | null;
                    laboratorio?: string | null; presentacion?: string | null;
                  };
                  return (
                  <div className="border-t border-border px-5 py-4 bg-muted/10 space-y-3">
                    {med.descripcion && <p className="text-sm text-muted-foreground">{med.descripcion}</p>}

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {mx.principio_activo && <p><span className="font-semibold">Principio activo:</span> {mx.principio_activo} {mx.concentracion ?? ""}</p>}
                      {mx.laboratorio && <p><span className="font-semibold">Laboratorio:</span> {mx.laboratorio}</p>}
                      {mx.presentacion && <p><span className="font-semibold">Presentación:</span> {mx.presentacion}</p>}
                      <p>
                        <span className="font-semibold">Tipo:</span>{" "}
                        <Badge variant={med.is_controlled ? "destructive" : med.requires_prescription ? "secondary" : "outline"}>
                          {med.sale_type ?? "otc"}
                        </Badge>
                      </p>
                    </div>

                    {(mx.indicaciones_uso || mx.contraindicaciones || mx.advertencias || mx.interacciones_relevantes) && (
                      <div className="space-y-1.5 rounded-lg border border-border bg-card p-3 text-xs">
                        {mx.indicaciones_uso && <p><span className="font-semibold">Indicaciones:</span> {mx.indicaciones_uso}</p>}
                        {mx.contraindicaciones && <p className="text-destructive"><span className="font-semibold">Contraindicaciones:</span> {mx.contraindicaciones}</p>}
                        {mx.advertencias && <p className="text-warning"><span className="font-semibold">Advertencias:</span> {mx.advertencias}</p>}
                        {mx.interacciones_relevantes && <p><span className="font-semibold">Interacciones:</span> {mx.interacciones_relevantes}</p>}
                        {med.regulatory_notes && <p><span className="font-semibold">Notas regulatorias:</span> {med.regulatory_notes}</p>}
                        {mx.fuente_info && <p className="italic text-muted-foreground">Fuente: {mx.fuente_info}</p>}
                        <p className="italic text-muted-foreground border-t border-border/40 pt-1.5">
                          Información demo operativa. Validar contra etiqueta, registro sanitario, IPP/etiquetado autorizado y responsable sanitario antes de operación real. No sustituye criterio médico.
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Lotes ({lotesActivos.length})</p>
                      <p className="text-xs text-muted-foreground">Mínimo: {med.stock_minimo} {med.unidad}</p>
                    </div>
                    {lotesActivos.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin lotes con existencia</p>
                    ) : (
                      <div className="space-y-1">
                        {lotesDe(med.id).map(lote => {
                          const cad = new Date(lote.fecha_caducidad);
                          const vencido = cad < hoy;
                          const prox = cad <= en30 && !vencido;
                          return (
                            <div key={lote.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs">
                              <span className="font-medium">{lote.numero_lote}</span>
                              <span className={`${vencido ? "text-destructive" : prox ? "text-warning" : "text-muted-foreground"}`}>
                                Cad: {format(cad, "dd/MM/yyyy", { locale: es })}
                                {vencido ? " ⚠ VENCIDO" : prox ? " ⚠ Próximo" : ""}
                              </span>
                              <Badge variant={lote.existencia === 0 ? "outline" : "secondary"}>
                                {lote.existencia} {med.unidad}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {canWrite && (
                      <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => deactivateMed(med)}>
                        Desactivar medicamento
                      </Button>
                    )}
                  </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal medicamento */}
      <Dialog open={medModal} onOpenChange={v => !v && setMedModal(false)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editMed ? "Editar medicamento" : "Nuevo medicamento"}</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nombre comercial *</Label>
                <Input value={medForm.nombre} onChange={e => setMedForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Tempra 500 mg" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Código de barras</Label>
                  <Input value={medForm.barcode} onChange={e => setMedForm(f => ({ ...f, barcode: e.target.value }))} placeholder="EAN-13 / UPC" />
                </div>
                <div className="space-y-1.5">
                  <Label>SKU</Label>
                  <Input value={medForm.sku} onChange={e => setMedForm(f => ({ ...f, sku: e.target.value }))} placeholder="SKU proveedor" />
                </div>
                <div className="space-y-1.5">
                  <Label>Código interno</Label>
                  <Input value={medForm.codigo_interno} onChange={e => setMedForm(f => ({ ...f, codigo_interno: e.target.value }))} placeholder="Clave interna" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Laboratorio</Label>
                <Input value={medForm.laboratorio} onChange={e => setMedForm(f => ({ ...f, laboratorio: e.target.value }))} placeholder="Ej: Pfizer" />
              </div>
              <div className="space-y-1.5">
                <Label>Principio activo</Label>
                <Input value={medForm.principio_activo} onChange={e => setMedForm(f => ({ ...f, principio_activo: e.target.value }))} placeholder="Ej: Paracetamol" />
              </div>
              <div className="space-y-1.5">
                <Label>Forma farmacéutica</Label>
                <Input value={medForm.forma_farmaceutica} onChange={e => setMedForm(f => ({ ...f, forma_farmaceutica: e.target.value }))} placeholder="Tableta, jarabe, ampolla..." />
              </div>
              <div className="space-y-1.5">
                <Label>Concentración</Label>
                <Input value={medForm.concentracion} onChange={e => setMedForm(f => ({ ...f, concentracion: e.target.value }))} placeholder="Ej: 500 mg" />
              </div>
              <div className="space-y-1.5">
                <Label>Presentación</Label>
                <Input value={medForm.presentacion} onChange={e => setMedForm(f => ({ ...f, presentacion: e.target.value }))} placeholder="Caja c/20, frasco 120 ml..." />
              </div>
              <div className="space-y-1.5">
                <Label>Registro sanitario (COFEPRIS)</Label>
                <Input value={medForm.registro_sanitario} onChange={e => setMedForm(f => ({ ...f, registro_sanitario: e.target.value }))} placeholder="N° de registro" />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={medForm.categoria} onValueChange={v => setMedForm(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Unidad</Label>
                <Select value={medForm.unidad} onValueChange={v => setMedForm(f => ({ ...f, unidad: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Precio ($)</Label>
                <Input type="number" min="0" step="0.01" value={medForm.precio_unitario}
                  onChange={e => setMedForm(f => ({ ...f, precio_unitario: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Stock mínimo (reorden)</Label>
                <Input type="number" min="0" value={medForm.stock_minimo}
                  onChange={e => setMedForm(f => ({ ...f, stock_minimo: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Stock máximo (reponer hasta)</Label>
                <Input type="number" min="0" value={(medForm as typeof medForm & { stock_maximo?: string }).stock_maximo ?? "0"}
                  onChange={e => setMedForm(f => ({ ...f, stock_maximo: e.target.value } as typeof f))} />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <div className="space-y-1.5">
                <Label>Control COFEPRIS</Label>
                <Select value={(medForm as typeof medForm & { tipo_control?: string }).tipo_control ?? "otc"} onValueChange={v => setMedForm(f => ({ ...f, tipo_control: v } as typeof f))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="otc">OTC / Sin receta</SelectItem>
                    <SelectItem value="rx_simple">Receta simple</SelectItem>
                    <SelectItem value="psicotropico_iii">Psicotrópico Grupo III</SelectItem>
                    <SelectItem value="psicotropico_i_ii">Psicotrópico Grupo I-II</SelectItem>
                    <SelectItem value="estupefaciente">Estupefaciente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de venta *</Label>
                <Select value={medForm.sale_type} onValueChange={v => {
                  const blocks = ["receta_requerida","receta_retenida","controlado"].includes(v);
                  setMedForm(f => ({
                    ...f,
                    sale_type: v,
                    allow_direct_sale: blocks ? false : f.allow_direct_sale,
                    requires_prescription: blocks ? true : f.requires_prescription,
                    is_controlled: v === "controlado" ? true : f.is_controlled,
                  }));
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SALE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {medForm.is_controlled && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>Medicamento sujeto a control sanitario. La venta directa queda bloqueada y debe surtirse contra receta correspondiente.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={medForm.allow_direct_sale}
                    disabled={["receta_requerida","receta_retenida","controlado"].includes(medForm.sale_type)}
                    onChange={e => setMedForm(f => ({ ...f, allow_direct_sale: e.target.checked }))} />
                  Permitir venta directa
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={medForm.requires_prescription}
                    disabled={["receta_requerida","receta_retenida","controlado"].includes(medForm.sale_type)}
                    onChange={e => setMedForm(f => ({ ...f, requires_prescription: e.target.checked }))} />
                  Requiere receta
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={medForm.is_controlled}
                    disabled={medForm.sale_type === "controlado"}
                    onChange={e => setMedForm(f => ({ ...f, is_controlled: e.target.checked }))} />
                  Es controlado
                </label>
              </div>

              <div className="space-y-1.5">
                <Label>Notas regulatorias</Label>
                <Textarea value={medForm.regulatory_notes}
                  onChange={e => setMedForm(f => ({ ...f, regulatory_notes: e.target.value }))}
                  placeholder="Restricciones, observaciones COFEPRIS..." rows={2} />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Información clínica</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Indicaciones de uso</Label>
                  <Textarea rows={2} value={medForm.indicaciones_uso}
                    onChange={e => setMedForm(f => ({ ...f, indicaciones_uso: e.target.value }))}
                    placeholder="Para qué se indica…" />
                </div>
                <div className="space-y-1.5">
                  <Label>Contraindicaciones</Label>
                  <Textarea rows={2} value={medForm.contraindicaciones}
                    onChange={e => setMedForm(f => ({ ...f, contraindicaciones: e.target.value }))}
                    placeholder="Hipersensibilidad, embarazo…" />
                </div>
                <div className="space-y-1.5">
                  <Label>Advertencias</Label>
                  <Textarea rows={2} value={medForm.advertencias}
                    onChange={e => setMedForm(f => ({ ...f, advertencias: e.target.value }))}
                    placeholder="Precauciones, riesgos…" />
                </div>
                <div className="space-y-1.5">
                  <Label>Interacciones relevantes</Label>
                  <Textarea rows={2} value={medForm.interacciones_relevantes}
                    onChange={e => setMedForm(f => ({ ...f, interacciones_relevantes: e.target.value }))}
                    placeholder="Anticoagulantes, alcohol…" />
                </div>
                <div className="space-y-1.5">
                  <Label>Clave de equivalencia</Label>
                  <Input value={medForm.equivalence_group_key}
                    onChange={e => setMedForm(f => ({ ...f, equivalence_group_key: e.target.value }))}
                    placeholder="paracetamol|500mg|tableta|oral" />
                </div>
                <div className="space-y-1.5">
                  <Label>Fuente de información</Label>
                  <Input value={medForm.fuente_info}
                    onChange={e => setMedForm(f => ({ ...f, fuente_info: e.target.value }))}
                    placeholder="Etiqueta / IPP / proveedor…" />
                </div>
              </div>
              <p className="text-[11px] italic text-muted-foreground">
                Información demo operativa. Validar contra etiqueta, registro sanitario, IPP/etiquetado autorizado y responsable sanitario antes de operación real. No sustituye criterio médico.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea value={medForm.descripcion} onChange={e => setMedForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Notas comerciales o adicionales..." rows={2} />
            </div>

            {editMed && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <MedicamentoProveedoresPanel
                  medicamentoId={editMed.id}
                  medicamentoNombre={medForm.nombre}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMedModal(false)}>Cancelar</Button>
            <Button onClick={saveMed} disabled={savingMed}>{savingMed ? "Guardando..." : editMed ? "Guardar cambios" : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal movimiento */}
      <Dialog open={movModal} onOpenChange={v => !v && setMovModal(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {movForm.tipo === "entrada" ? "Registrar entrada"
                : movForm.tipo === "salida" ? "Dispensar / Salida"
                : movForm.tipo === "uso_interno" ? "Uso interno"
                : movForm.tipo === "merma" ? "Registrar merma"
                : "Ajuste de inventario"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Tipo de movimiento</Label>
              <Select value={movForm.tipo} onValueChange={v => setMovForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada (compra / recepción)</SelectItem>
                  <SelectItem value="salida">Salida (dispensación)</SelectItem>
                  <SelectItem value="ajuste">Ajuste de inventario</SelectItem>
                  <SelectItem value="uso_interno">Uso interno (consumo clínica)</SelectItem>
                  <SelectItem value="merma">Merma (daño / vencido / destrucción)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Medicamento *</Label>
              <Select value={movForm.medicamento_id} onValueChange={v => setMovForm(f => ({ ...f, medicamento_id: v, lote_id: "" }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {medicamentos.map(m => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {movForm.tipo === "entrada" ? (
              <>
                <div className="space-y-1.5">
                  <Label>Número de lote *</Label>
                  <Input value={movForm.numero_lote} onChange={e => setMovForm(f => ({ ...f, numero_lote: e.target.value }))} placeholder="LOT-2026-XXX" />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha de caducidad</Label>
                  <Input type="date" value={movForm.fecha_caducidad} onChange={e => setMovForm(f => ({ ...f, fecha_caducidad: e.target.value }))} />
                </div>
              </>
            ) : movForm.medicamento_id ? (
              <div className="space-y-1.5">
                <Label>Lote</Label>
                <Select value={movForm.lote_id} onValueChange={v => setMovForm(f => ({ ...f, lote_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar lote" /></SelectTrigger>
                  <SelectContent>
                    {lotesDe(movForm.medicamento_id).filter(l => l.existencia > 0).map(l => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.numero_lote} — {l.existencia} unid — cad. {format(new Date(l.fecha_caducidad), "dd/MM/yyyy", { locale: es })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Cantidad *</Label>
              <Input type="number" min="1" value={movForm.cantidad} onChange={e => setMovForm(f => ({ ...f, cantidad: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Motivo / notas</Label>
              <Input value={movForm.motivo} onChange={e => setMovForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovModal(false)}>Cancelar</Button>
            <Button onClick={saveMov} disabled={savingMov}>
              {savingMov ? "Guardando…"
                : movForm.tipo === "entrada" ? "Registrar entrada"
                : movForm.tipo === "merma" ? "Registrar merma"
                : movForm.tipo === "uso_interno" ? "Registrar uso"
                : "Registrar salida"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

Diferencias intencionales respecto al código original en `Farmacia.tsx`
(documentadas — no son omisiones):
- `saveMed`/`deactivateMed`/`saveMov` ya no hacen `setMedicamentos`/`setLotes`
  optimista — llaman `onReload()` al final (`medicamentos`/`lotes` ahora son
  props del padre `Almacen.tsx`, no state local de este componente).
- El botón "Ver detalle de lotes →" que en el original navegaba a la
  sub-vista Caducidades (`setInventarioView("caducidades")`) se reemplaza por
  un bloque de alerta sin botón, ya que cambiar de vista ahora es
  responsabilidad de `AlmacenTabs` (el padre), no de este componente — el
  mensaje solo indica "Ver pestaña Caducidades", sin control funcional. Si se
  quiere el botón funcional, agregar un prop `onVerCaducidades?: () => void`
  — no incluido por YAGNI hasta que se pida.
- `loading` (spinner mientras carga el catálogo) ya no aplica aquí — lo
  maneja `AlmacenTabs.tsx` centralizado para las 9 vistas (Task 1, Step 4).

- [ ] **Step 2: Wire en `AlmacenTabs.tsx`**

Agregar el import:
```tsx
import CatalogoMedicamentos from "@/features/almacen/CatalogoMedicamentos";
```

Agregar el botón, como **primer** botón del pill-nav (orden visual original:
Catálogo era el primero):
```tsx
        <button
          onClick={() => setView("catalogo")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${view === "catalogo" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >Catálogo</button>
        <button
          onClick={() => setView("caducidades")}
```

Agregar la vista:
```tsx
      {view === "catalogo" && <CatalogoMedicamentos medicamentos={medicamentos} lotes={lotes} onReload={onReload} />}
      {view === "caducidades" && <CaducidadesPanel medicamentos={medicamentos} lotes={lotes} />}
```

Cambiar el valor inicial de `useState` de `"conteos"` a `"catalogo"` (ahora sí
existe contenido para esa vista, coincide con el default original):
```tsx
  const [view, setView] = useState<AlmacenView>("catalogo");
```

- [ ] **Step 3: Verificar build**

```bash
npx tsc --noEmit -p tsconfig.json
npm run build
```

Expected: sin errores.

- [ ] **Step 4: Smoke test manual — paridad completa**

En `/almacen`, ya con las 9 pestañas: Catálogo (buscar medicamento, expandir
uno, editarlo y guardar cambios — confirmar que `onReload()` refresca la
lista sin recargar la página; registrar una entrada y una salida de
inventario desde los botones del header; crear un medicamento nuevo). Repetir
en `/farmacia` → Inventario los mismos pasos y confirmar resultados
idénticos (ambos módulos leen la misma tabla `medicamentos`/`lotes_medicamento`,
así que un cambio hecho en uno debe reflejarse en el otro tras recargar).

- [ ] **Step 5: Commit**

```bash
git add src/features/almacen/CatalogoMedicamentos.tsx src/features/almacen/AlmacenTabs.tsx
git commit -m "feat: extraer CatalogoMedicamentos a módulo Almacén (paridad completa 9/9 vistas)"
```

---

### Task 5: Quitar el tab "Inventario" de `Farmacia.tsx` + limpieza de código muerto

**Files:**
- Modify: `src/pages/Farmacia.tsx`

**Interfaces:**
- Consumes: nada nuevo — `AlmacenTabs` ya tiene paridad completa (Task 4).
- Produces: `Farmacia.tsx` reducido a POS / Surtir receta / Insumos / Cierre, sin código muerto.

- [ ] **Step 1: Quitar el `TabsTrigger` de Inventario**

Quitar la línea:
```tsx
          <TabsTrigger value="inventario">Inventario</TabsTrigger>
```

- [ ] **Step 2: Quitar el `TabsContent` de Inventario completo**

Quitar el bloque completo desde `<TabsContent value="inventario" className="space-y-6">`
hasta su `</TabsContent>` de cierre (todo el pill-nav + las 9 vistas + los 2
dialogs `medModal`/`movModal`) — es el bloque que las Tasks 1-4 ya
reprodujeron en `src/features/almacen/`.

- [ ] **Step 3: Quitar el state y las funciones que quedan sin uso**

Quitar estas declaraciones de state (todas exclusivas de Inventario):
```tsx
  const [expanded, setExpanded] = useState<string | null>(null);
  const [medModal, setMedModal] = useState(false);
  const [editMed, setEditMed] = useState<Medicamento | null>(null);
  const [medForm, setMedForm] = useState(EMPTY_MED);
  const [savingMed, setSavingMed] = useState(false);
  const [movModal, setMovModal] = useState(false);
  const [movForm, setMovForm] = useState(EMPTY_MOV);
  const [savingMov, setSavingMov] = useState(false);
  const [inventarioView, setInventarioView] = useState<"catalogo" | "faltantes" | "caducidades" | "conteos" | "cofepris" | "abc" | "mermas" | "reorden" | "controlados">("catalogo");
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loadingAlertas, setLoadingAlertas] = useState(false);
  const [filtroAlertas, setFiltroAlertas] = useState<"pending" | "resolved" | "external">("pending");
```

Quitar `search`, que también es exclusivo de Inventario:
```tsx
  const [search, setSearch] = useState("");
```

Quitar el efecto que dependía de `inventarioView`:
```tsx
  useEffect(() => {
    if (tab === "inventario" && inventarioView === "faltantes") loadAlertas();
  }, [tab, inventarioView, loadAlertas]);
```

Quitar las funciones `loadAlertas`, `resolveAlerta`, `stockTotal`, `lotesDe`,
`openNewMed`, `openEditMed`, `saveMed`, `deactivateMed`, `openMov`, `saveMov`
completas (todas ya extraídas a `CatalogoMedicamentos.tsx`/`FaltantesPanel.tsx`).

Quitar los cálculos:
```tsx
  const hoy = new Date();
  const en30 = new Date(hoy); en30.setDate(hoy.getDate() + 30);
  const en60 = new Date(hoy); en60.setDate(hoy.getDate() + 60);
  const en90 = new Date(hoy); en90.setDate(hoy.getDate() + 90);
  const bajosStock = medicamentos.filter(m => stockTotal(m.id) < m.stock_minimo);
  const lotesCriticos = lotes.filter(l => l.fecha_caducidad && new Date(l.fecha_caducidad) <= en30 && l.existencia > 0);
  const lotesAlerta   = lotes.filter(l => l.fecha_caducidad && new Date(l.fecha_caducidad) > en30 && new Date(l.fecha_caducidad) <= en60 && l.existencia > 0);
  const lotesAtencion = lotes.filter(l => l.fecha_caducidad && new Date(l.fecha_caducidad) > en60 && new Date(l.fecha_caducidad) <= en90 && l.existencia > 0);
  const proxCaducidad = [...lotesCriticos, ...lotesAlerta, ...lotesAtencion];

  const filtered = medicamentos.filter(m => {
    const s = search.trim().toLowerCase();
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
    ].some(v => (v ?? "").toLowerCase().includes(s));
  });
```

- [ ] **Step 4: Quitar el fetch de `lotes` en `loadData()`**

Cambiar:
```tsx
  async function loadData() {
    setLoading(true);
    const [{ data: meds }, { data: lts }] = await Promise.all([
      supabase.from("medicamentos").select("*").eq("activo", true).order("nombre"),
      supabase.from("lotes_medicamento").select("*").order("fecha_caducidad"),
    ]);
    setMedicamentos(meds ?? []);
    setLotes(lts ?? []);
    setLoading(false);
  }
```
por:
```tsx
  async function loadData() {
    setLoading(true);
    const { data: meds } = await supabase.from("medicamentos").select("*").eq("activo", true).order("nombre");
    setMedicamentos(meds ?? []);
    setLoading(false);
  }
```

Quitar el state `lotes`/`setLotes` y el `type Lote = Tables<"lotes_medicamento">`
(ya sin uso en este archivo — confirmar con el Step 6 de este task).

- [ ] **Step 5: Quitar los imports que quedan sin uso**

Quitar (confirmados exclusivos de Inventario en la auditoría de esta sesión —
`grep -c` de cada uno dio usos solo dentro del rango 375-1106 salvo `Badge`,
que se queda porque también se usa en el header en la línea con
`<Badge variant="outline" ...>Abierto</Badge>`):

```tsx
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Plus, AlertTriangle, Package, Pill, ArrowDownCircle, ArrowUpCircle, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { friendlyError } from "@/lib/errors";
import InventarioCiclico from "@/features/almacen/InventarioCiclico";
import ReporteCOFEPRIS from "@/features/almacen/ReporteCOFEPRIS";
import ReporteRotacionABC from "@/features/almacen/ReporteRotacionABC";
import ActasMerma from "@/features/almacen/ActasMerma";
import PuntoReorden from "@/features/compras/PuntoReorden";
import LibroControlControlados from "@/features/almacen/LibroControlControlados";
import MedicamentoProveedoresPanel from "@/features/compras/MedicamentoProveedoresPanel";
```

(`SolicitudesInsumos`, `Label`, `Input`, `Button` sí se quedan — usados por
POS/Insumos/Cierre.)

Quitar las constantes que quedan sin uso:
```tsx
const CATEGORIAS = [...];
const UNIDADES = [...];
const SALE_TYPES = [...];
const EMPTY_MED = {...};
const EMPTY_MOV = {...};
```

`formatMXN` — verificar con grep si POS/Cierre lo usan antes de quitarlo (ver
Step 6); si no, quitarlo también.

- [ ] **Step 6: Verificar que no queda ninguna referencia rota ni import sin uso**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "Farmacia.tsx"
```

Expected: sin salida (0 errores en este archivo). Un error de "declared but
never read" en algún import indica que ese Step 5 dejó algo de más —
quitarlo puntualmente y volver a correr el comando.

```bash
grep -n "formatMXN\b" src/pages/Farmacia.tsx
```

Si solo aparece en un import o const sin otro uso, quitarlo. Si aparece
usado en JSX de POS/Cierre, dejarlo.

- [ ] **Step 7: Build completo + smoke test final**

```bash
npm run build
npm run dev
```

En el navegador:
1. `/farmacia`: confirmar que el tabs list ahora es solo Punto de Venta /
   Surtir receta / Insumos / Cierre (sin "Inventario"), y que las 4 pestañas
   restantes funcionan igual que antes (vender, surtir receta, ver insumos,
   cerrar turno).
2. `/almacen`: confirmar que las 9 pestañas siguen funcionando igual que en
   el smoke test de Task 4.
3. Editar un medicamento desde `/almacen` → Catálogo, luego ir a `/farmacia`
   → Punto de Venta y confirmar que el medicamento editado aparece
   actualizado ahí también (mismo dato, dos módulos).

- [ ] **Step 8: Commit**

```bash
git add src/pages/Farmacia.tsx
git commit -m "refactor: quitar tab Inventario de Farmacia.tsx (módulo Almacén completo)"
```

---

## Self-Review

**Spec coverage:** las 9 sub-vistas quedan cubiertas (Task 1: conteos,
cofepris, abc, mermas, reorden, controlados — Task 2: faltantes — Task 3:
caducidades — Task 4: catálogo). Ruta/nav cubiertos en Task 1. Limpieza de
`Farmacia.tsx` cubierta en Task 5. Cross-import `MedicamentoProveedoresPanel`
cubierto en Task 4. No hay requisito del spec sin task.

**Type consistency:** `AlmacenView` se define una vez en Task 1 con los 9
valores completos y no cambia en tasks posteriores (solo se agrega contenido
condicional, no nuevos valores del tipo) — evita el bug de "tipo definido en
una task, usado con otro nombre en otra". `Medicamento`/`Lote` son siempre
`Tables<"medicamentos">`/`Tables<"lotes_medicamento">` en los 4 archivos
nuevos, mismo alias que en `Farmacia.tsx`/`Compras.tsx` ya existentes.
`onReload: () => void` es el mismo tipo en `Almacen.tsx` (Task 1),
`AlmacenTabs.tsx` (Task 1) y `CatalogoMedicamentos.tsx` (Task 4).
