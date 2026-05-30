## Objetivo

Convertir `/farmacia` en POS operativo. Mantener venta directa y surtido de receta funcionando. No tocar RLS general, no crear almacén, no CFDI.

## Cambios de DB (migración única)

1. `ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager'` (al inicio, fuera de transacción lógica).
2. `pharmacy_sales`: agregar `cashier_user_id uuid`, `manager_authorized_by uuid`, `suspended_at timestamptz`. Default `cashier_user_id = auth.uid()` vía trigger BEFORE INSERT (no romper RPC existente).
3. `pharmacy_register_sale(jsonb)`: aceptar opcional `manager_authorized_by` y `status='suspended'` (mantener firma compatible). Si `discount > 0` y caller no es admin/manager, rechazar con mensaje claro.
4. Sin cambios en RLS de las tablas existentes.

## Frontend

### `src/features/farmacia/permissions.ts` (nuevo)
Helper centralizado:
- `canPosView`, `canPosSell`, `canPosDispensePrescription`, `canPosDiscount`, `canPosCancelPaid`, `canPosOverrideLot`, `canPosViewDailyCut`, `canPosAuditView`.
- Mapeo: cajero = `receptionist|nurse`; gerente = `manager|admin`; admin = `admin`. Cada permiso devuelve boolean según `useAuth().roles`.

### `src/features/farmacia/PuntoDeVenta.tsx` (nuevo)
Pantalla POS principal con layout 3 columnas (responsive: colapsa a stack en <md):
- **Topbar**: cajero (nombre), clínica activa, fecha/hora MX (live), turno placeholder.
- **Input unificado** (autoFocus, h-14, texto grande): detecta tipo de entrada con `parseScannedInput()`:
  - QR/URL/folio RX-* o UUID con `verificar-receta` → cambia a sub-modo `dispense` y delega a `SurtirReceta` (lo abrimos en panel central). 
  - Resto → búsqueda en `medicamentos` por `nombre`, `categoria`, `descripcion` (futuro: código de barras/SKU/lab/presentación; campos opcionales si no existen se ignoran sin fallar).
  - 0 coincidencias → "Producto no encontrado". 1 → agrega al carrito. >1 → selector inline.
- **Panel izquierdo**: productos frecuentes (top 12 por ventas recientes, fallback a 12 primeros activos).
- **Panel central**: carrito con producto, lote FIFO, caducidad, cantidad ±, precio, subtotal, alertas regulatorias (badge + tooltip). Botones touch h-12 mínimo.
- **Panel derecho**: cliente (Público general / paciente), subtotal, descuento (bloqueado si no `canPosDiscount`), método de pago (efectivo/tarjeta/transferencia/mixto/pendiente), checkbox "Requiere factura", botones grandes Suspender / Cancelar / Cobrar.
- Al cobrar exitosamente: muestra **TicketInterno** (modal imprimible con `window.print` y estilos print-only). Sin CFDI.

### `src/features/farmacia/TicketInterno.tsx` (nuevo)
Modal print-friendly: folio, fecha/hora, cajero, productos, cantidades, total, método pago, paciente/receta si aplica. Botón "Reimprimir" reutilizable después si `canPosAuditView`.

### `src/pages/Farmacia.tsx` (editar)
- Default tab cambia a `pos`.
- Tabs en orden: **Punto de venta** (PuntoDeVenta), **Surtir receta** (existente, accesible directo), **Venta directa** (mantener), **Inventario** (lo existente actual).
- Mantiene CRUD existente sin tocar.

### Bloqueos regulatorios (reutilizar de VentaDirecta)
Centralizar `blockReasonForDirectSale(med)` en `permissions.ts` y reusar. Mensajes exactos del prompt.

## Trazabilidad

Cada venta sigue creando `pharmacy_sales` + `pharmacy_sale_items` + `movimientos_inventario (salida_venta|salida_surtido_receta)` con `reference_type='pharmacy_sale'`. Agregar comentario en `PuntoDeVenta.tsx` cabecera explicando liga futura con almacén.

## Auditoría

Eventos vía `audit_logs` (mismo patrón que SurtirReceta):
- `pos_sale_completed`, `pos_sale_suspended`, `pos_sale_cancelled`, `pos_discount_authorized`, `pos_lot_overridden`, `pos_blocked_direct_sale` (con motivo), `pos_blocked_no_stock`, `pos_ticket_reprint`. Surtido de receta ya está auditado.

## Layout ASCII

```text
+--------------------------------------------------+
| Cajero · Clínica · 30/05/2026 14:32 · Turno A    |
+--------------------------------------------------+
| [ Escanear / buscar producto o receta ____ ] [↵] |
+----------+---------------------+-----------------+
| Frec.    | Carrito             | Cliente         |
|  - Med A |  Med X  FIFO L-203  | [Público ▼]     |
|  - Med B |   2 × $45  = $90    |                 |
|  - …     |  Med Y  FIFO L-118  | Subtotal $...   |
|          |   1 × $120 = $120   | Desc.    $0     |
|          |                     | Total    $210   |
|          |                     | Pago [Efectivo▼]|
|          |                     | [Suspender]     |
|          |                     | [Cancelar]      |
|          |                     | [ COBRAR ]      |
+----------+---------------------+-----------------+
```

## Validaciones manuales post-build

- `/farmacia` abre en POS.
- Buscar OTC y cobrar funciona.
- Escanear RX abre flujo SurtirReceta.
- Producto `requires_prescription` o `controlado` muestra mensaje exacto y no entra al carrito.
- Descuento global deshabilitado para `receptionist/nurse`; habilitado para `manager/admin`.
- Suspender deja la venta con `status='suspended'` (no descuenta inventario).
- Inventario continúa registrando `movimientos_inventario` con `reference_id=sale_id`.
- `npm run build` pasa.

## Out of scope (explícito)

- Almacén, compras, entradas masivas, devoluciones, corte de caja completo (sólo placeholder de vista), CFDI, refactor de archivos no listados, cambios de RLS.

## Pendientes que quedan como TODO en código

- Búsqueda por código de barras/SKU/laboratorio (requiere agregar columnas a `medicamentos` en migración futura).
- Pago mixto: UI permite seleccionarlo y guarda `payment_method='mixto'`, pero el desglose por método se guarda en `notes` hasta tener tabla `pharmacy_sale_payments`.
- Corte del día y devoluciones: módulos siguientes.