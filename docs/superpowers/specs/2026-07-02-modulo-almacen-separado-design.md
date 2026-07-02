# Módulo Almacén como módulo separado (fuera de Caja/Farmacia)

## Contexto

El tab "Inventario" de `src/pages/Farmacia.tsx` (líneas 375-1107 en la versión
actual) mezcla, a diferencia de Compras (que ya eran componentes en archivos
separados y solo requirió `git mv`):

- Componentes ya propios en `src/features/farmacia/`: `InventarioCiclico.tsx`
  (conteos), `ReporteCOFEPRIS.tsx`, `ReporteRotacionABC.tsx`, `ActasMerma.tsx`
  (mermas), `LibroControlControlados.tsx`.
- Componentes cross-import ya en `src/features/compras/`: `PuntoReorden.tsx`,
  `MedicamentoProveedoresPanel.tsx` (usado dentro del modal de medicamento).
- **JSX inline dentro de `Farmacia.tsx`, nunca extraído a componente propio**:
  vistas `catalogo` (~591-1000+, incluye los dialogs `medModal`/`movModal` de
  alta/edición de medicamento y registro de movimientos de inventario) y
  `caducidades` (492-564). La vista `faltantes` (430-491) también es inline
  pero es más simple (solo lista + resolver alerta).
- Estado del componente padre `Farmacia.tsx` usado únicamente por estas 3
  vistas inline: `inventarioView`, `alertas`/`loadingAlertas`/`filtroAlertas`/
  `loadAlertas`, `medModal`/`movModal`/`medForm`/`movForm`/`savingMed`/
  `savingMov`, `expanded`, `search`, y los cálculos `stockTotal`, `lotesDe`,
  `bajosStock`, `proxCaducidad`, `lotesCriticos/Alerta/Atencion`, `filtered`.
- `inventarioView` state controla las 9 sub-vistas: `catalogo | faltantes |
  caducidades | conteos | cofepris | abc | mermas | reorden | controlados`.

Almacén es back-office igual que Compras: no debería depender de un turno de
caja abierto, y merece navegación y ruta propias.

## Objetivo

Extraer el tab "Inventario" completo (las 9 sub-vistas) a un módulo
independiente:
- Carpeta propia `src/features/almacen/`.
- Ruta propia `/almacen`, sin `TurnoGuard`.
- Entrada propia en el sidebar, sección "Operaciones".
- `Farmacia.tsx` queda solo con POS / Surtir receta / Insumos / Cierre.

## Alcance

### Archivos que se mueven de `src/features/farmacia/` a `src/features/almacen/`

- `InventarioCiclico.tsx`
- `ReporteCOFEPRIS.tsx`
- `ReporteRotacionABC.tsx`
- `ActasMerma.tsx`
- `LibroControlControlados.tsx`

### Lo que NO se mueve

- `PuntoReorden.tsx`, `MedicamentoProveedoresPanel.tsx` — ya viven en
  `src/features/compras/`. Almacén los importa cross-module, igual que
  Farmacia lo hace hoy (mismo patrón que Compras → `MedicamentoProveedoresPanel`
  desde Farmacia).
- Hooks (`useProveedores.ts`, etc.) se quedan en `src/hooks/` — convención
  plana ya existente.
- `SurtirReceta.tsx`, `PuntoDeVenta.tsx`, `SolicitudesInsumos.tsx`,
  `CajaTurno.tsx`, `CorteTurno.tsx` — siguen siendo de Farmacia/POS/Cierre.

### Componentes nuevos en `src/features/almacen/`

**`AlmacenTabs.tsx`** — pill-nav de las 9 sub-vistas (mismo patrón visual que
hoy: botones con estado activo/badges), sub-state `inventarioView`. Recibe
`medicamentos`, `lotes`, `onReload` como props (del wrapper `Almacen.tsx`).
Calcula `bajosStock`/`proxCaducidad` (y sus 3 buckets) **solo para los conteos
de los badges del nav** — cálculo liviano, aceptando la duplicación menor con
el mismo cálculo dentro de `CatalogoMedicamentos.tsx`/`CaducidadesPanel.tsx`.
Renderiza según `inventarioView`:
- `catalogo` → `<CatalogoMedicamentos medicamentos lotes onReload />`
- `faltantes` → `<FaltantesPanel />`
- `caducidades` → `<CaducidadesPanel medicamentos lotes />`
- `conteos` → `<InventarioCiclico />`
- `cofepris` → `<ReporteCOFEPRIS />`
- `abc` → `<ReporteRotacionABC />`
- `mermas` → `<ActasMerma />`
- `reorden` → `<PuntoReorden medicamentos lotes onOcCreada />`
- `controlados` → `<LibroControlControlados medicamentos />`

**`CatalogoMedicamentos.tsx`** — autocontenido. Recibe `medicamentos: Medicamento[]`,
`lotes: Lote[]`, `onReload: () => void` como props. Maneja internamente:
búsqueda (`search`), fila expandida (`expanded`), dialogs `medModal`/`movModal`
con sus forms (`medForm`/`movForm`, `EMPTY_MED`/`EMPTY_MOV`, `CATEGORIAS`/
`UNIDADES`/`SALE_TYPES`), handlers `openMov`/`openEditMed`/`openNewMed`/
`deactivateMed`/save de medicamento y movimiento (llaman `onReload()` tras
mutar), cálculos `stockTotal`/`lotesDe`/`filtered`/alertas de stock bajo y
caducidad dentro de su propio header. Importa `MedicamentoProveedoresPanel`
desde `@/features/compras/MedicamentoProveedoresPanel` (cross-import
intencional, igual que hoy).

**`CaducidadesPanel.tsx`** — autocontenido salvo por props `medicamentos`,
`lotes`. Calcula internamente `lotesCriticos`/`lotesAlerta`/`lotesAtencion`
(<30d, 30-60d, 60-90d) y renderiza la tabla agrupada por urgencia.

**`FaltantesPanel.tsx`** — 100% autocontenido, sin props (igual que
`InventarioCiclico`/`ActasMerma` hoy). Query propia a `almacen_alertas`,
estado `alertas`/`loadingAlertas`/`filtroAlertas`, `resolveAlerta`.

### `src/pages/Almacen.tsx` (nuevo)

Wrapper delgado, mismo patrón que `Compras.tsx`:

```tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AlmacenTabs from "@/features/almacen/AlmacenTabs";
import type { Tables } from "@/integrations/supabase/types";

type Medicamento = Tables<"medicamentos">;
type Lote = Tables<"lotes_medicamento">;

export default function Almacen() {
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => { loadData(); }, []);

  return <AlmacenTabs medicamentos={medicamentos} lotes={lotes} onReload={loadData} loading={loading} />;
}
```

Fetch propio e independiente del de `Farmacia.tsx` — misma duplicación menor
ya aceptada entre `Farmacia.tsx` y `Compras.tsx` (cada página carga sus datos,
no hay hook compartido).

### `src/pages/Farmacia.tsx`

- Quitar `TabsTrigger value="inventario"` y su `TabsContent` completo.
- Quitar el `state` `inventarioView`, `alertas`/`loadingAlertas`/`filtroAlertas`/
  `loadAlertas`, `medModal`/`movModal`/`medForm`/`movForm`/`savingMed`/
  `savingMov`, `expanded`, `search`.
- Quitar los cálculos `stockTotal`, `lotesDe`, `bajosStock`, `proxCaducidad`,
  `lotesCriticos/Alerta/Atencion`, `filtered`, `hoy`/`en30`/`en60`/`en90`.
- Quitar el fetch de `lotes_medicamento` en `loadData()` — `lotes` deja de
  usarse en Farmacia.tsx (verificar: solo se usaba dentro de Inventario). El
  fetch de `medicamentos` se queda (lo sigue usando `SolicitudesInsumos`).
- Quitar imports de los 5 componentes movidos + `PuntoReorden` +
  `MedicamentoProveedoresPanel`.
- Auditar caso por caso (igual que se hizo con Compras) qué otros imports
  quedan huérfanos tras el split: `Dialog`/`DialogContent`/`DialogHeader`/
  `DialogTitle`/`DialogFooter`, `Select*`, `Textarea`, `Badge`, iconos
  (`Search`, `Plus`, `AlertTriangle`, `Package`, `Pill`, `ArrowDownCircle`,
  `ArrowUpCircle`, `Pencil`, `ChevronDown`, `ChevronUp`), `format`/`es` de
  date-fns, `friendlyError`, y las constantes `CATEGORIAS`/`UNIDADES`/
  `SALE_TYPES`/`EMPTY_MED`/`EMPTY_MOV` — no eliminar a ciegas, confirmar cada
  uno sin uso restante en POS/Surtir/Insumos/Cierre antes de borrar.

### `src/App.tsx` (routing)

Agregar ruta nueva, sin `TurnoGuard`, mismos roles que `/compras`:

```tsx
<Route path="/almacen" element={
  <ProtectedRoute allowedRoles={["admin","nurse","receptionist","cajero"]}>
    <Almacen />
  </ProtectedRoute>
} />
```

### `src/components/AppLayout.tsx` (nav)

Nuevo `NavItem` en la sección "Operaciones", junto a Caja/Compras:

```tsx
{ to: "/almacen", icon: Package, label: "Almacén", roles: ["admin", "nurse", "receptionist", "cajero"] },
```

`Package` ya está importado hoy en `Farmacia.tsx`; verificar si `AppLayout.tsx`
ya lo importa o hay que agregarlo. `/almacen` **no** se agrega a `FOCUS_ROUTES`.

## Fuera de alcance

- No se cambian permisos/roles existentes más allá de replicar los de Caja/Compras.
- No se toca lógica de negocio de ningún panel — es extracción de JSX inline
  a componentes propios + movimiento de archivos + routing + nav, no un
  refactor funcional de las reglas de negocio existentes.
- No se unifica el fetch de `medicamentos`/`lotes` entre Farmacia/Compras/Almacén
  en un hook compartido — se mantiene la convención actual de fetch por página.

## Riesgos / puntos de atención al implementar

- **Este split es más grande que el de Compras**: ~500 líneas de JSX nunca
  antes extraídas a componente (`catalogo` + `caducidades`), con estado y
  handlers de CRUD entrelazados con el resto de `Farmacia.tsx`. Implementar
  vista por vista, no todo de un solo commit — empezar por las 5 vistas que
  ya son `git mv` puro (conteos/cofepris/abc/mermas/controlados), luego
  extraer `faltantes` (simple), luego `caducidades`, y dejar `catalogo`
  (la más grande, con los 2 dialogs) al final.
- Verificar que `lotes` realmente no se use fuera de Inventario en
  `Farmacia.tsx` antes de quitar su fetch (confirmado por grep en esta sesión,
  re-confirmar en el momento de implementar por si hubo cambios).
- `medModal`/`movModal` usan `friendlyError` para mostrar errores de guardado
  — mover el import junto con el componente, no asumir que ya existe en
  `almacen/`.
- Badges de conteo en `AlmacenTabs.tsx` (bajo stock / próximas caducidades)
  duplican un cálculo barato que también corre dentro de
  `CatalogoMedicamentos`/`CaducidadesPanel` — aceptado a propósito, no crear
  un hook compartido para esto.
- `tsc --noEmit` y `npm run build` deben quedar limpios antes de dar por
  terminada cada vista extraída, no solo al final.
