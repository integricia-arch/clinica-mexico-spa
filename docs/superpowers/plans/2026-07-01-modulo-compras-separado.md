# Módulo Compras Separado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extraer el módulo de Compras (hoy una pestaña dentro de `Farmacia.tsx`,
gateado por `TurnoGuard` de caja) a un módulo independiente: carpeta propia,
ruta propia `/compras` sin turno de caja, y entrada propia en el sidebar.

**Architecture:** Reubicación de 18 componentes + 1 context de
`src/features/farmacia/` a `src/features/compras/`, página nueva delgada
(`Compras.tsx`), ruta nueva sin `TurnoGuard`, item de nav nuevo. Es un
refactor mecánico de archivos/routing — no se toca lógica de negocio de
ningún panel.

**Tech Stack:** React 18 + TypeScript + Vite, React Router, Supabase JS.

## Global Constraints

- No se cambia lógica de negocio de ningún panel movido — solo ubicación e imports.
- Roles de acceso a `/compras`: `["admin","nurse","receptionist","cajero"]` (mismos que `/farmacia` hoy).
- `/compras` NO lleva `TurnoGuard`.
- `/compras` NO se agrega a `FOCUS_ROUTES` en `AppLayout.tsx` (debe mostrar sidebar).
- Hooks (`src/hooks/*`) no se mueven — quedan donde están.
- Verificación de cada task: `npm run build` (typecheck + bundle) debe pasar sin errores. No se escriben tests unitarios nuevos: es una reubicación sin cambio de comportamiento: el build (TS) y la suite existente (`npx vitest run`) son la verificación correcta.

---

### Task 1: Mover archivos de compras a `src/features/compras/`

**Files:**
- Move (git mv): los 18 archivos de compras + `ComprasNavContext.tsx`, listados abajo.
- Modify: los 5 archivos que importan `@/context/ComprasNavContext` (path fix).

Lista completa a mover, de `src/features/farmacia/` → `src/features/compras/`:

```
ComprasTabs.tsx
DashboardCompras.tsx
SolicitudesCompra.tsx
CotizacionesPanel.tsx
OrdenesCompra.tsx
RecepcionMercancia.tsx
FacturasProveedor.tsx
AlertasCxpPanel.tsx
CfdiUploadPanel.tsx
ThreeWayMatchPanel.tsx
ReporteAgingCxP.tsx
DevolucionesProveedor.tsx
EvaluacionProveedores.tsx
PresupuestoPanel.tsx
BitacoraTemperaturaPanel.tsx
AuditLogPanel.tsx
MedicamentoProveedoresPanel.tsx
PuntoReorden.tsx
```

Y de `src/context/` → `src/features/compras/`:
```
ComprasNavContext.tsx
```

**Interfaces:**
- Consumes: nada (task inicial).
- Produces: todos los archivos anteriores ahora viven bajo `@/features/compras/<Nombre>`, importables por Task 2 y Task 3.

- [ ] **Step 1: Crear la carpeta y mover los 18 componentes**

```bash
mkdir -p src/features/compras
cd src/features/farmacia
git mv ComprasTabs.tsx DashboardCompras.tsx SolicitudesCompra.tsx CotizacionesPanel.tsx OrdenesCompra.tsx RecepcionMercancia.tsx FacturasProveedor.tsx AlertasCxpPanel.tsx CfdiUploadPanel.tsx ThreeWayMatchPanel.tsx ReporteAgingCxP.tsx DevolucionesProveedor.tsx EvaluacionProveedores.tsx PresupuestoPanel.tsx BitacoraTemperaturaPanel.tsx AuditLogPanel.tsx MedicamentoProveedoresPanel.tsx PuntoReorden.tsx ../compras/
cd ../../..
```

- [ ] **Step 2: Mover `ComprasNavContext.tsx`**

```bash
git mv src/context/ComprasNavContext.tsx src/features/compras/ComprasNavContext.tsx
```

`src/context/` queda vacía — se elimina sola al no tener archivos rastreados (no requiere `rmdir` explícito, git no versiona carpetas vacías).

- [ ] **Step 3: Corregir el import de `ComprasNavContext` en los 5 archivos que lo usan**

Estos 5 archivos (ya movidos a `src/features/compras/`) importan
`@/context/ComprasNavContext`, que ya no existe en esa ruta:
`ComprasTabs.tsx`, `CotizacionesPanel.tsx`, `OrdenesCompra.tsx`,
`RecepcionMercancia.tsx`, `SolicitudesCompra.tsx`.

En cada uno, cambiar:

```ts
import { ComprasNavProvider, useComprasNav } from "@/context/ComprasNavContext";
```
(o solo `useComprasNav` según el archivo) por:
```ts
import { ComprasNavProvider, useComprasNav } from "@/features/compras/ComprasNavContext";
```

Usa buscar-y-reemplazar literal de la cadena `@/context/ComprasNavContext` →
`@/features/compras/ComprasNavContext` en esos 5 archivos — el resto de cada
línea de import (qué símbolos importa) no cambia.

- [ ] **Step 4: Verificar que no queda ninguna referencia a la ruta vieja**

```bash
grep -rn "@/context/ComprasNavContext" src
```

Expected: sin resultados (comando no imprime nada).

- [ ] **Step 5: Confirmar que los imports relativos (`./Xxx`) entre archivos movidos siguen resolviendo**

Todos los imports relativos entre estos componentes (ej. `ComprasTabs.tsx`
importando `./DashboardCompras`, `RecepcionMercancia.tsx` importando
`./CfdiUploadPanel`, `FacturasProveedor.tsx` importando
`./ThreeWayMatchPanel`, `./CfdiUploadPanel`, `./AlertasCxpPanel`) siguen
funcionando porque **todos** los archivos referenciados se movieron juntos a
la misma carpeta nueva. No requiere cambios — solo confirmar visualmente que
ningún import relativo quedó apuntando fuera:

```bash
grep -n '^import.*from "\./' src/features/compras/*.tsx
```

Expected: todas las rutas listadas (`./DashboardCompras`, `./SolicitudesCompra`,
`./OrdenesCompra`, `./RecepcionMercancia`, `./FacturasProveedor`,
`./ReporteAgingCxP`, `./DevolucionesProveedor`, `./EvaluacionProveedores`,
`./CotizacionesPanel`, `./PresupuestoPanel`, `./BitacoraTemperaturaPanel`,
`./AuditLogPanel`, `./CfdiUploadPanel`, `./ThreeWayMatchPanel`,
`./AlertasCxpPanel`) corresponden a archivos que SÍ existen en
`src/features/compras/`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: mover componentes de compras a src/features/compras/"
```

(El build seguirá roto hasta Task 2 y 3, que arreglan los importadores
externos — `Farmacia.tsx`. Este commit es intermedio y aceptable porque el
plan continúa en la siguiente task del mismo PR/branch.)

---

### Task 2: Crear `src/pages/Compras.tsx`

**Files:**
- Create: `src/pages/Compras.tsx`

**Interfaces:**
- Consumes: `ComprasTabs` desde `@/features/compras/ComprasTabs` (produced by Task 1). Prop: `medicamentos: Medicamento[]` donde `Medicamento` es `{ id: string; nombre: string; unidad: string }` (definido inline en `ComprasTabs.tsx`, cualquier objeto con esos campos sirve — el resultado de `supabase.from("medicamentos").select("*")` los incluye).
- Produces: componente `Compras` (default export), usado por Task 4 en el routing.

- [ ] **Step 1: Escribir `src/pages/Compras.tsx`**

```tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import ComprasTabs from "@/features/compras/ComprasTabs";

type Medicamento = Tables<"medicamentos">;

export default function Compras() {
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("medicamentos")
        .select("*")
        .eq("activo", true)
        .order("nombre");
      setMedicamentos(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Compras</h1>
      <ComprasTabs medicamentos={medicamentos} />
    </div>
  );
}
```

- [ ] **Step 2: Verificar que el archivo compila de forma aislada**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "Compras.tsx" || echo "sin errores en Compras.tsx"
```

Expected: `sin errores en Compras.tsx` (puede haber errores en otros archivos
todavía no corregidos por tasks futuras — se filtra explícitamente por este
archivo).

- [ ] **Step 3: Commit**

```bash
git add src/pages/Compras.tsx
git commit -m "feat: agregar página Compras standalone"
```

---

### Task 3: Limpiar `src/pages/Farmacia.tsx`

**Files:**
- Modify: `src/pages/Farmacia.tsx`

**Interfaces:**
- Consumes: `PuntoReorden` y `MedicamentoProveedoresPanel` desde su nueva ruta `@/features/compras/...` (produced by Task 1).
- Produces: `Farmacia.tsx` sin pestaña "Compras", listo para que Task 6 confirme el build completo.

- [ ] **Step 1: Quitar los imports muertos y actualizar rutas de los que siguen en uso**

Reemplazar este bloque de imports (líneas 20-40 originales):

```tsx
import OrdenesCompra from "@/features/farmacia/OrdenesCompra";
import RecepcionMercancia from "@/features/farmacia/RecepcionMercancia";
import FacturasProveedor from "@/features/farmacia/FacturasProveedor";
import InventarioCiclico from "@/features/farmacia/InventarioCiclico";
import ReporteCOFEPRIS from "@/features/farmacia/ReporteCOFEPRIS";
import ReporteRotacionABC from "@/features/farmacia/ReporteRotacionABC";
import ReporteAgingCxP from "@/features/farmacia/ReporteAgingCxP";
import DevolucionesProveedor from "@/features/farmacia/DevolucionesProveedor";
import EvaluacionProveedores from "@/features/farmacia/EvaluacionProveedores";
import ActasMerma from "@/features/farmacia/ActasMerma";
import DashboardCompras from "@/features/farmacia/DashboardCompras";
import ComprasTabs from "@/features/farmacia/ComprasTabs";
import PuntoReorden from "@/features/farmacia/PuntoReorden";
import LibroControlControlados from "@/features/farmacia/LibroControlControlados";
import SolicitudesCompra from "@/features/farmacia/SolicitudesCompra";
import SolicitudesInsumos from "@/features/farmacia/SolicitudesInsumos";
import MedicamentoProveedoresPanel from "@/features/farmacia/MedicamentoProveedoresPanel";
import BitacoraTemperaturaPanel from "@/features/farmacia/BitacoraTemperaturaPanel";
import CotizacionesPanel from "@/features/farmacia/CotizacionesPanel";
import PresupuestoPanel from "@/features/farmacia/PresupuestoPanel";
import AuditLogPanel from "@/features/farmacia/AuditLogPanel";
```

por:

```tsx
import InventarioCiclico from "@/features/farmacia/InventarioCiclico";
import ReporteCOFEPRIS from "@/features/farmacia/ReporteCOFEPRIS";
import ReporteRotacionABC from "@/features/farmacia/ReporteRotacionABC";
import ActasMerma from "@/features/farmacia/ActasMerma";
import PuntoReorden from "@/features/compras/PuntoReorden";
import LibroControlControlados from "@/features/farmacia/LibroControlControlados";
import SolicitudesInsumos from "@/features/farmacia/SolicitudesInsumos";
import MedicamentoProveedoresPanel from "@/features/compras/MedicamentoProveedoresPanel";
```

(`OrdenesCompra`, `RecepcionMercancia`, `FacturasProveedor`, `ReporteAgingCxP`,
`DevolucionesProveedor`, `EvaluacionProveedores`, `DashboardCompras`,
`ComprasTabs`, `SolicitudesCompra`, `BitacoraTemperaturaPanel`,
`CotizacionesPanel`, `PresupuestoPanel`, `AuditLogPanel` no se usan en JSX en
ningún otro lugar de este archivo fuera de la pestaña "Compras" que se
elimina en el siguiente step — confirmado con
`grep -c "<NombreComponente" src/pages/Farmacia.tsx` antes de este cambio,
que dio 0 para los 13 nombres anteriores.)

- [ ] **Step 2: Quitar el `TabsTrigger` y el `TabsContent` de "Compras"**

Buscar y eliminar esta línea dentro de `<TabsList>`:

```tsx
          <TabsTrigger value="compras">Compras</TabsTrigger>
```

Y este bloque `TabsContent`:

```tsx
        <TabsContent value="compras" className="space-y-6">
          <ComprasTabs medicamentos={medicamentos} />
        </TabsContent>
```

- [ ] **Step 3: Verificar que no queda ninguna referencia a `ComprasTabs` ni a rutas viejas de `@/features/farmacia/` para los archivos movidos**

```bash
grep -n "ComprasTabs\|features/farmacia/OrdenesCompra\|features/farmacia/RecepcionMercancia\|features/farmacia/FacturasProveedor\|features/farmacia/ReporteAgingCxP\|features/farmacia/DevolucionesProveedor\|features/farmacia/EvaluacionProveedores\|features/farmacia/DashboardCompras\|features/farmacia/SolicitudesCompra\|features/farmacia/BitacoraTemperaturaPanel\|features/farmacia/CotizacionesPanel\|features/farmacia/PresupuestoPanel\|features/farmacia/AuditLogPanel\|features/farmacia/PuntoReorden\|features/farmacia/MedicamentoProveedoresPanel" src/pages/Farmacia.tsx
```

Expected: sin resultados.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Farmacia.tsx
git commit -m "refactor: quitar pestaña Compras de Farmacia.tsx"
```

---

### Task 4: Ruta `/compras` en `src/App.tsx`

**Files:**
- Modify: `src/App.tsx:21` (imports), `src/App.tsx:104` (routes, junto a `/farmacia`)

**Interfaces:**
- Consumes: `Compras` default export desde `@/pages/Compras` (produced by Task 2).
- Produces: ruta `/compras` navegable, sin `TurnoGuard`.

- [ ] **Step 1: Agregar el import**

Después de la línea:
```tsx
import Farmacia from "@/pages/Farmacia";
```
agregar:
```tsx
import Compras from "@/pages/Compras";
```

- [ ] **Step 2: Agregar la ruta**

Después de la línea (actual línea 104):
```tsx
<Route path="/farmacia" element={<ProtectedRoute allowedRoles={["admin","nurse","receptionist","cajero"]}><TurnoGuard cajaFilter="farmacia"><Farmacia /></TurnoGuard></ProtectedRoute>} />
```
agregar:
```tsx
<Route path="/compras" element={<ProtectedRoute allowedRoles={["admin","nurse","receptionist","cajero"]}><Compras /></ProtectedRoute>} />
```

Nota: sin `TurnoGuard` envolviendo — a diferencia de `/farmacia`, Compras no
exige turno de caja abierto.

- [ ] **Step 3: Verificar routing por build**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "App.tsx" || echo "sin errores en App.tsx"
```

Expected: `sin errores en App.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: agregar ruta /compras sin TurnoGuard"
```

---

### Task 5: Item de navegación en `src/components/AppLayout.tsx`

**Files:**
- Modify: `src/components/AppLayout.tsx:3-9` (imports de iconos), `src/components/AppLayout.tsx:45` (NAV_ITEMS)

**Interfaces:**
- Consumes: nada nuevo (usa React Router `NavLink`, ya presente en el archivo).
- Produces: entrada de sidebar visible para navegar a `/compras`.

- [ ] **Step 1: Agregar el ícono `ShoppingCart` al import de `lucide-react`**

Cambiar:
```tsx
import {
  LayoutDashboard, Users, CalendarDays, Receipt, FileText,
  Pill, Settings, Menu, X, Bell, ChevronDown, LogOut,
  Headset, MessageCircle, BellRing, ClipboardList, Stethoscope,
  CreditCard, Lock, UserRound, ChevronLeft, ChevronRight,
  Send, Gift,
} from "lucide-react";
```
por:
```tsx
import {
  LayoutDashboard, Users, CalendarDays, Receipt, FileText,
  Pill, Settings, Menu, X, Bell, ChevronDown, LogOut,
  Headset, MessageCircle, BellRing, ClipboardList, Stethoscope,
  CreditCard, Lock, UserRound, ChevronLeft, ChevronRight,
  Send, Gift, ShoppingCart,
} from "lucide-react";
```

- [ ] **Step 2: Agregar el `NavItem` de Compras**

Cambiar:
```tsx
  { section: "Operaciones", to: "/farmacia", icon: CreditCard, label: "Caja", roles: ["admin", "nurse", "receptionist", "cajero"] },
  { to: "/enfermeria", icon: Stethoscope, label: "Enfermería", roles: ["admin", "manager", "nurse"] },
```
por:
```tsx
  { section: "Operaciones", to: "/farmacia", icon: CreditCard, label: "Caja", roles: ["admin", "nurse", "receptionist", "cajero"] },
  { to: "/compras", icon: ShoppingCart, label: "Compras", roles: ["admin", "nurse", "receptionist", "cajero"] },
  { to: "/enfermeria", icon: Stethoscope, label: "Enfermería", roles: ["admin", "manager", "nurse"] },
```

- [ ] **Step 3: Confirmar que `/compras` NO está en `FOCUS_ROUTES`**

```bash
grep -n "FOCUS_ROUTES" src/components/AppLayout.tsx
```

Expected: `const FOCUS_ROUTES = ["/caja", "/farmacia"];` — sin `/compras`. No
se modifica esta línea.

- [ ] **Step 4: Verificar build**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "AppLayout.tsx" || echo "sin errores en AppLayout.tsx"
```

Expected: `sin errores en AppLayout.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/components/AppLayout.tsx
git commit -m "feat: agregar item de navegación Compras al sidebar"
```

---

### Task 6: Verificación completa

**Files:** ninguno (solo comandos).

**Interfaces:**
- Consumes: el resultado completo de Tasks 1-5.
- Produces: confirmación de que el módulo compras separado funciona de punta a punta.

- [ ] **Step 1: Build completo**

```bash
npm run build
```

Expected: build termina sin errores (exit code 0).

- [ ] **Step 2: Suite de tests existente**

```bash
npx vitest run
```

Expected: todos los tests pasan (ninguno de los existentes referencia rutas
de compras movidas, pero confirma que no se rompió nada transversal, ej.
`useDashboardHoy.test.ts`).

- [ ] **Step 3: Smoke manual en dev server**

```bash
npm run dev
```

Con el servidor corriendo, en el navegador (usar Claude in Chrome o manual):
1. Iniciar sesión con un usuario rol `admin`.
2. Confirmar que el sidebar muestra un item **"Compras"** separado de **"Caja"**.
3. Navegar a `/compras` **sin** tener un turno de caja abierto — debe cargar
   directo (sin bloqueo de `TurnoGuard`), mostrando las pestañas
   Dashboard/Solicitudes/Cotizaciones/OC/Recepción/CxP/etc.
4. Navegar a `/farmacia` — confirmar que la pestaña "Compras" ya no aparece
   en ese tabs list, y que el resto de pestañas (POS, Surtir, Inventario,
   Insumos, Cierre) siguen funcionando igual que antes.
5. Dentro de Inventario → editar un medicamento → confirmar que el panel de
   proveedores por medicamento (`MedicamentoProveedoresPanel`) sigue
   apareciendo en el modal (cross-module import correcto).

- [ ] **Step 4: Detener el dev server**

```bash
# Ctrl+C en la terminal donde corre `npm run dev`
```

- [ ] **Step 5: Commit final (si quedó algo pendiente de los steps anteriores)**

```bash
git status
```

Si no hay cambios sin commitear, no se requiere commit — Tasks 1-5 ya
commitearon todo.
