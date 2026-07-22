# Trazabilidad contable-administrativa — diseño

**Fecha:** 2026-07-22
**Estado:** Aprobado, listo para plan de implementación

## Problema

El sistema ya genera pólizas automáticas para eventos de dinero (caja, farmacia,
honorarios, compras), y ya existen los FKs y campos de actor (`aprobador_id`,
`aprobada_by`, `recibido_por`, `created_by`, `registrado_por`) que ligan cada paso
del proceso administrativo. Lo que falta es una forma de **caminar esa cadena**:
dado cualquier evento (un pago, una solicitud, una cita, una venta), reconstruir
la cadena completa — quién autorizó qué, en qué fecha, hasta llegar a la póliza y
la conciliación bancaria.

## Alcance

Dos troncos, un mismo árbol de trazabilidad:

**Tronco compras → pagos** (egresos):
```
solicitud_compra → cotizacion_proveedor → orden_compra → recepcion_mercancia
  → factura_proveedor → pago_proveedor → poliza → conciliacion_bancaria
```

**Tronco ingresos**:
```
appointment → { appointment_insumo, honorario, movimiento_caja, cfdi_documento }
  → poliza → conciliacion_bancaria

pharmacy_sale → { loyalty_movimiento, movimiento_caja, cfdi_documento }
  → poliza → conciliacion_bancaria
```

13 tipos de nodo. Ningún cambio de schema requerido — todas las FKs y campos de
actor ya existen en producción:

| Tabla | Campos de actor/liga usados |
|---|---|
| `solicitudes_compra` | `solicitante_id`, `aprobador_id`, `aprobado_at`, `orden_compra_id` |
| `cotizaciones_proveedor` | liga a `ordenes_compra.cotizacion_id` |
| `ordenes_compra` | `created_by`, `aprobada_by`, `aprobada_at`, `solicitud_id`, `cotizacion_id` |
| `recepciones_mercancia` | `recibido_por`, `orden_id` |
| `facturas_proveedor` | `created_by`, `orden_id`, `recepcion_id`, `solicitud_id`, `match_revisado_by` |
| `pagos_proveedor` | `registrado_por`, `factura_id` |
| `polizas` | `created_by`, `reference_type`, `reference_id` |
| `contab_estados_cuenta` | `imported_by`, `poliza_partida_id` (conciliación) |
| `appointments` | raíz del tronco ingresos |
| `appointment_insumos` | `user_id`, `appointment_id` |
| `doctor_honorarios_detalle` | `appointment_id` |
| `movimientos` (caja) | `cajero_user_id`, `appointment_id` |
| `pharmacy_sales` | raíz de venta POS, `patient_id`, `doctor_id` |
| `loyalty_movimientos` | `pharmacy_sale_id`, `created_by` |
| `cfdi_documentos` | `appointment_id`, `sale_id`, `cfdi_relacionado_uuid` (notas de crédito/cancelación) |

## Backend

### `contab_trazar(p_tipo text, p_id uuid) RETURNS jsonb`

- `SECURITY DEFINER`, `SET search_path = public`.
- Primera operación: valida `clinic_memberships`/`auth.uid()` del usuario contra el
  `clinic_id` del registro — mismo patrón que el resto de RPCs del módulo contable.
- Sube al ancestro raíz del tronco correspondiente con una cadena fija de
  `SELECT`s por tipo (switch en PL/pgSQL) — no se construye un motor de grafo
  genérico: la profundidad y forma de la cadena son fijas y conocidas (~6-7
  niveles), un motor genérico sería sobre-ingeniería para esta necesidad.
- Desde la raíz arma el árbol completo hacia abajo con JOINs anidados (un query
  por tronco), retorna JSON anidado con la forma de nodo:
  ```json
  {
    "tipo": "orden_compra",
    "id": "uuid",
    "folio": "OC-004",
    "fecha": "2026-07-13",
    "monto_centavos": 450000,
    "estado": "aprobada",
    "actor": { "user_id": "uuid", "nombre": "Dr. González" },
    "hijos": [ ... ]
  }
  ```
- Eslabón faltante (ej. pago sin póliza generada aún) → nodo
  `{ "tipo": "HUECO", "mensaje": "..." }` en vez de fallar la función completa.
- Read-only, sin efectos secundarios, idempotente.

### `contab_trazar_proveedor(p_proveedor_id uuid) RETURNS jsonb`

- Mismo control de acceso.
- Junta todas las raíces `solicitud_compra` (y `orden_compra` sin solicitud previa,
  si el flujo lo permite) de ese proveedor, llama la misma lógica de armado de
  árbol de `contab_trazar` para cada una, retorna arreglo de árboles.

## Frontend

Tab nueva dentro de Contabilidad: `/contabilidad/trazabilidad`.

- **Buscar por evento**: input de folio/id. Autodetecta la tabla probando cada
  tipo (o selector manual si el texto es ambiguo). Llama `contab_trazar`.
- **Buscar por proveedor**: selector de proveedor. Llama `contab_trazar_proveedor`,
  lista de cadenas, cada una expandible.
- Resultado: timeline vertical — icono por tipo, folio, fecha, actor, monto por
  nodo. Click en un nodo navega a la pantalla real de ese registro (ej. Orden de
  Compra → `/compras/ordenes/:id`).
- Nodo `HUECO` resaltado (rojo/amarillo) con el mensaje de qué eslabón falta.

## Testing

- Harness manual transaccional (mismo patrón que E1: script SQL en transacción
  con `ROLLBACK`) que arma un caso completo end-to-end por cada tronco y valida
  que el JSON devuelto tenga los niveles y actores esperados.
- Frontend: test que, dado un JSON mock de `contab_trazar`, renderiza el timeline
  con el número de nodos y el estado `HUECO` correctos.

## Fuera de alcance (YAGNI, no construir ahora)

- Motor de grafo genérico / tabla de configuración de edges — la cadena es fija.
- Exportar el árbol a PDF/Excel — no pedido.
- Trazabilidad de `loyalty_planes_progreso` (recompensa física entregada como
  merma de almacén) — mencionado como posible extensión, no confirmado, no
  incluido en este spec.
