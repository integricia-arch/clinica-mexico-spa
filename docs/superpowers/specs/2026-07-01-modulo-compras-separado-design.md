# Módulo Compras como módulo separado (fuera de Caja/Farmacia)

## Contexto

El módulo de Compras (solicitudes, cotizaciones, órdenes de compra, recepción
de mercancía, cuentas por pagar, devoluciones, evaluación de proveedores,
presupuesto, bitácora de temperatura, auditoría) hoy vive como una pestaña
(`"compras"`) dentro de `src/pages/Farmacia.tsx`, que en el sidebar aparece
etiquetada **"Caja"** (`AppLayout.tsx:45`, ruta `/farmacia`) y está protegida
por `TurnoGuard cajaFilter="farmacia"` — o sea, exige un turno de caja abierto.

Compras es back-office: no debería depender de que haya un turno de caja
abierto, y merece navegación y ruta propias.

## Objetivo

Extraer Compras a un módulo independiente:
- Carpeta propia `src/features/compras/`.
- Ruta propia `/compras`, sin `TurnoGuard`.
- Entrada propia en el sidebar, sección "Operaciones".
- `Farmacia.tsx` deja de contener la pestaña "Compras".

## Alcance

### Archivos que se mueven de `src/features/farmacia/` a `src/features/compras/`

- `ComprasTabs.tsx`
- `DashboardCompras.tsx`
- `SolicitudesCompra.tsx`
- `CotizacionesPanel.tsx`
- `OrdenesCompra.tsx`
- `RecepcionMercancia.tsx`
- `FacturasProveedor.tsx`
- `AlertasCxpPanel.tsx`
- `CfdiUploadPanel.tsx`
- `ThreeWayMatchPanel.tsx`
- `ReporteAgingCxP.tsx`
- `DevolucionesProveedor.tsx`
- `EvaluacionProveedores.tsx`
- `PresupuestoPanel.tsx`
- `BitacoraTemperaturaPanel.tsx`
- `AuditLogPanel.tsx`
- `MedicamentoProveedoresPanel.tsx`
- `PuntoReorden.tsx`

`src/context/ComprasNavContext.tsx` → `src/features/compras/ComprasNavContext.tsx`
(hoy es el único archivo en `src/context/`; se elimina esa carpeta).

### Lo que NO se mueve

- Hooks (`useCicloCompras.ts`, `useOrdenesCompra.ts`, `useSolicitudesCompra.ts`,
  `useCxpAlertas.ts`, etc.) se quedan en `src/hooks/` — convención plana ya
  existente en todo el repo; ningún feature tiene su propia carpeta de hooks.
- `PaymentCapture.tsx` — es de POS (`PuntoDeVenta.tsx`), no de compras.
- `permissions.ts`, `ShiftPanel.tsx`, `CorteCaja.tsx`, `TicketInterno.tsx`,
  `ReturnDialog.tsx`, `PuntoDeVenta.tsx`, `SurtirReceta.tsx`,
  `RecetaValidacionModal.tsx`, `SolicitudesInsumos.tsx`,
  `InventarioCiclico.tsx`, `ActasMerma.tsx`, `ReporteCOFEPRIS.tsx`,
  `ReporteRotacionABC.tsx` — siguen siendo de Farmacia/POS/inventario.

### Cross-module import esperado

`Farmacia.tsx` sigue usando `MedicamentoProveedoresPanel` dentro del modal de
edición de medicamento (pestaña Inventario) — se importa desde su nueva
ubicación `@/features/compras/MedicamentoProveedoresPanel`. Es la única
referencia cross-module intencional.

### `src/pages/Farmacia.tsx`

- Quitar `TabsTrigger value="compras"` y su `TabsContent`.
- Quitar el import de `ComprasTabs`.
- Quitar los imports muertos que ya no se usan tras el split: `DashboardCompras`,
  `BitacoraTemperaturaPanel`, `AuditLogPanel`, y cualquier otro import de
  compras que no se referencie en JSX fuera de la pestaña eliminada (auditar
  caso por caso al implementar).
- Actualizar el import de `MedicamentoProveedoresPanel` a la nueva ruta.

### `src/pages/Compras.tsx` (nuevo)

Wrapper delgado, mismo patrón que otras páginas de un solo feature:

```tsx
import ComprasTabs from "@/features/compras/ComprasTabs";
// obtiene medicamentos igual que Farmacia.tsx los obtiene hoy, o los recibe
// como prop si se decide compartir el fetch — a definir en el plan de
// implementación revisando cómo Farmacia.tsx carga `medicamentos` hoy.
export default function Compras() {
  return <ComprasTabs medicamentos={medicamentos} />;
}
```

### `src/App.tsx` (routing)

Agregar ruta nueva, sin `TurnoGuard`:

```tsx
<Route path="/compras" element={
  <ProtectedRoute allowedRoles={["admin","nurse","receptionist","cajero"]}>
    <Compras />
  </ProtectedRoute>
} />
```

### `src/components/AppLayout.tsx` (nav)

- Nuevo `NavItem`: `{ to: "/compras", icon: ShoppingCart, label: "Compras", roles: ["admin","nurse","receptionist","cajero"] }`, en la sección "Operaciones", junto al item existente de "Caja" (`/farmacia`).
- `/compras` **no** se agrega a `FOCUS_ROUTES` — a diferencia de POS, Compras debe mostrar el sidebar normal.

## Fuera de alcance

- No se cambian permisos/roles existentes más allá de replicar los de Farmacia.
- No se toca lógica de negocio de ningún panel — es un movimiento de archivos
  + routing + nav, no un refactor funcional.
- No se agregan hooks nuevos ni se reorganiza `src/hooks/`.

## Riesgos / puntos de atención al implementar

- Verificar cada import relativo (`./Xxx`) dentro de los archivos movidos —
  al cambiar de carpeta, imports relativos entre paneles de compras deben
  seguir resolviendo (todos se mueven juntos, así que las relativas entre
  ellos no cambian; solo cambian los imports *hacia* hooks/lib compartidos,
  que pasan de `../../hooks/x` a `../../hooks/x` — verificar profundidad de
  carpeta, ya que `features/compras/` está al mismo nivel que
  `features/farmacia/`, la profundidad no cambia).
- `ComprasTabs` recibe `medicamentos` como prop — confirmar de dónde los toma
  `Farmacia.tsx` hoy y replicar el fetch (o compartir) en `Compras.tsx`.
- Confirmar que ningún otro archivo fuera de `Farmacia.tsx` importe algo de
  la lista movida antes de mover (grep final antes de tocar imports).
