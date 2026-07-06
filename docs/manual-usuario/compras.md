# Compras

> Aquí se maneja todo el ciclo de compra a proveedores: desde que alguien solicita comprar algo hasta que se recibe la mercancía y se paga la factura. La usa el encargado de compras/administración.

## Operación — cómo se usa

El flujo normal de una compra sigue este orden:

**Solicitud → Cotización → Orden de Compra → Recepción de mercancía → Factura / Cuentas por Pagar → Pago**

### Cómo pedir una compra (pestaña "Solicitudes")

1. Da clic en **"Nueva solicitud"**.
2. Indica el área que solicita (Farmacia, Consultorios, Enfermería, etc.) y el motivo.
3. Agrega uno o más artículos con cantidad y unidad.
4. Guarda — la solicitud queda en borrador.
5. Da clic en **"Enviar"** para mandarla a aprobación.
6. Quien aprueba compras revisa la lista de solicitudes pendientes y da clic en **"Aprobar"** o **"Rechazar"** (con motivo).
7. Una solicitud aprobada se convierte en Orden de Compra con el botón **"Convertir a OC"**.

### Cómo comparar precios de proveedores (pestaña "Cotizaciones")

1. Da clic en **"Nueva cotización"**.
2. Agrega los artículos que quieres cotizar y el precio que ofrece cada proveedor.
3. Guarda la cotización — sirve como respaldo antes de generar la orden de compra, para elegir al proveedor con mejor precio.

### Cómo generar una Orden de Compra (pestaña "Órdenes de Compra")

1. Da clic en **"Nueva Orden de Compra"** (o conviértela desde una solicitud aprobada o una cotización).
2. Revisa los artículos, cantidades y precios — no puedes confirmar si hay artículos sin precio capturado.
3. Según el estado de la orden verás distintos botones:
   - **Borrador** → "Confirmar" la manda a pendiente de aprobación.
   - **Pendiente de aprobación** → un manager puede "Aprobar" o "Rechazar" (con motivo).
   - **Confirmada / Parcial** → puedes registrar la recepción de mercancía, o "Revertir" si algo salió mal.
   - **Borrador / Confirmada** → puedes "Cancelar" la orden completa.

### Cómo registrar la llegada de mercancía (pestaña "Recepción")

1. Da clic en **"Nueva recepción"**.
2. Elige la Orden de Compra que estás recibiendo (solo aparecen las que están confirmadas o parciales).
3. Captura cuánto llegó de cada artículo — si la cantidad no coincide con lo pedido, la recepción queda marcada "con diferencias".
4. Guarda. Si la recepción está pendiente de verificar, un responsable la revisa y confirma.
5. La mercancía recibida entra al inventario de Almacén automáticamente.

### Cómo registrar la factura y pagar al proveedor (pestaña "Cuentas por Pagar")

1. Da clic en **"Nueva factura"** (o "Registrar CFDI real" si la compra se hizo con una factura provisional/acumulada y ahora ya tienes el CFDI definitivo — necesitas capturar el UUID para confirmar).
2. Captura los datos de la factura del proveedor y el monto.
3. Cuando llegue el momento de pagar, da clic en **"Registrar pago"** — solo se habilita si la recepción de mercancía ya está verificada.
4. Captura fecha, forma de pago e importe — el sistema calcula el saldo pendiente.

### Cómo ver qué facturas están por vencer (pestaña "Aging")

Reporte de antigüedad de saldos: qué facturas de proveedor llevan más tiempo sin pagarse, agrupadas por rango de días. Úsalo para priorizar pagos y evitar recargos o corte de suministro.

### Cómo devolver mercancía a un proveedor (pestaña "Devoluciones")

Registra aquí la mercancía que se regresa a un proveedor (defectuosa, de más, equivocada) y su motivo — queda ligada a la recepción original.

### Cómo calificar a un proveedor (pestaña "Evaluación")

Registra el desempeño del proveedor (tiempos de entrega, calidad, precio) para decidir con quién seguir comprando.

### Cómo ver el gasto contra el presupuesto (pestaña "Presupuesto")

Compara lo gastado contra el presupuesto asignado por periodo/categoría, para saber si hay margen antes de aprobar una nueva compra.

### Cómo llevar el control de temperatura de medicamentos que la requieren (pestaña "Temperatura")

Bitácora de temperatura para medicamentos que necesitan cadena de frío al transportarse/almacenarse — registro obligatorio para cumplimiento.

### Cómo ver el panorama general (pestaña "Dashboard")

Resumen visual del estado de compras: solicitudes pendientes, órdenes activas, alertas de cuentas por pagar próximas a vencer.

### Cómo ver en qué va cada compra de un vistazo (pestaña "Pipeline")

Vista de embudo: en qué etapa está cada compra (solicitada, cotizada, ordenada, recibida, facturada, pagada), sin tener que entrar solicitud por solicitud.

### Cómo revisar quién hizo qué cambio (pestaña "Auditoría" — solo admin/manager)

Bitácora de acciones sobre compras (quién aprobó, rechazó, canceló, modificó) — solo visible para administración.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** no puedes confirmar una Orden de Compra si algún artículo no tiene precio capturado. **Por qué:** una orden sin precio no sirve para comprometer el gasto ni para comparar contra el presupuesto.
- **Lo que pasa:** solo puedes registrar recepción sobre órdenes "confirmada" o "parcial". **Por qué:** una orden en borrador o cancelada no representa un compromiso real de compra — no debe generar entrada de inventario.
- **Lo que pasa:** "Registrar pago" de una factura solo se habilita si la recepción ya está "verificada". **Por qué:** no se paga mercancía que no se ha confirmado que llegó completa y en buen estado.
- **Lo que pasa:** la pestaña "Auditoría" solo la ven admin o manager. **Por qué:** el registro de auditoría es información sensible de control interno, no operativa del día a día.
- **Lo que pasa:** una recepción con cantidad distinta a lo pedido queda marcada "con diferencias" en vez de aceptarse silenciosamente. **Por qué:** para que alguien revise y decida (aceptar parcial, reclamar al proveedor) en vez de que la diferencia pase desapercibida.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No puedo confirmar la Orden de Compra | Falta precio en uno o más artículos | Revisa la lista de artículos y captura el precio faltante |
| No aparece la orden que busco al registrar una recepción | Solo se listan órdenes confirmadas o parciales | Verifica el estado de la orden en la pestaña "Órdenes de Compra" |
| No puedo registrar el pago de una factura | La recepción de esa compra aún no está verificada | Ve a "Recepción" y confirma/verifica la entrada de mercancía primero |
| No veo la pestaña "Auditoría" | Tu rol no es admin ni manager | Pide a un administrador que revise el historial si lo necesitas |
| La recepción quedó marcada "con diferencias" | Lo recibido no coincide con lo pedido en la orden | Revisa el detalle, contacta al proveedor si falta o sobra mercancía |

## Implementación — para el siguiente dev/agente

- **Archivo(s) principal(es):** `src/pages/Compras.tsx`, `src/features/compras/ComprasTabs.tsx` (envuelve todo en `ComprasNavProvider`/`useComprasNav` para navegación entre tabs con estado en URL/contexto)
- **Subcomponentes por tab:** `DashboardCompras.tsx`, `PipelineCompras.tsx`, `SolicitudesCompra.tsx`, `CotizacionesPanel.tsx`, `OrdenesCompra.tsx`, `RecepcionMercancia.tsx`, `FacturasProveedor.tsx` (tab CxP), `ReporteAgingCxP.tsx`, `DevolucionesProveedor.tsx`, `EvaluacionProveedores.tsx`, `PresupuestoPanel.tsx`, `BitacoraTemperaturaPanel.tsx`, `AuditLogPanel.tsx` — todos en `src/features/compras/`
- **Estados de Orden de Compra (`estatus`):** `borrador` → `pendiente_aprobacion` → `confirmada`/`parcial` → recepción → cancelada (posible desde borrador/confirmada)
- **Alertas de CxP:** hook `useCxpAlertas(activeClinicId)` alimenta el badge numérico en la pestaña "Cuentas por Pagar"
- **Tablas Supabase relevantes:** `solicitudes_compra`, `ordenes_compra_items` (NO tipada en `types.ts` — usar `untypedTable()`), `recepciones_mercancia` (columna `folio_recepcion`, no `folio`), `recepciones_items` (NO tipada), `facturas_proveedor` (NO tipada) — ver mapeo completo de columnas reales en `CLAUDE.md` del repo ("Schema Drift") antes de escribir queries nuevas
- **Cómo agregar un campo nuevo:** migración sobre la tabla correspondiente + actualizar el `select`/formulario en el subcomponente del tab + regenerar `types.ts` si la tabla está tipada
- **Cómo agregar una regla de negocio nueva:** las validaciones de transición de estado (ej. bloquear pago sin recepción verificada) deben reforzarse en el RPC/trigger de Postgres, no solo deshabilitando el botón en el frontend — el frontend actual solo oculta/deshabilita, no siempre valida server-side

_/aprende 2026-07-06_
