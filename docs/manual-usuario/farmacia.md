# Farmacia / Caja

> Punto de venta, surtido de recetas, inventario, solicitudes de insumos de enfermería, compras y cierre de turno. Lo usan: admin, cajero, recepción, enfermería (solo tab Insumos).

## Operación — cómo se usa

### Cómo cobrar una venta (tab Punto de Venta)

1. Busca el producto por nombre o escanea código de barras.
2. Da clic en el producto para agregarlo al carrito.
3. Elige forma de pago: efectivo, tarjeta, transferencia o mixto.
4. En mixto, captura un monto y el otro se calcula solo.
5. Confirma cobro — se genera el ticket interno con desglose de IVA.

### Cómo surtir una receta (tab Surtir receta)

1. Busca la receta pendiente por folio o paciente.
2. Revisa el stock de cada medicamento (badge rojo = falta, verde = disponible).
3. Confirma surtido — descuenta inventario por FEFO (primero el lote que caduca antes).

### Cómo solicitar insumos (tab Insumos — enfermería)

1. Selecciona el insumo y la cantidad necesaria.
2. Da clic en "Solicitar" — la solicitud queda en estado `pendiente`.
3. Espera aprobación de farmacia/admin. El estado cambia a `aprobada` o `rechazada`.

### Cómo aprobar/rechazar una solicitud de insumos (tab Insumos — farmacia/admin)

1. Revisa la lista de solicitudes pendientes.
2. Da clic en "Aprobar" — el sistema descuenta stock automáticamente (FEFO) y registra el movimiento en `movimientos_inventario`. Esta acción es atómica: si no hay stock suficiente, la aprobación falla y no se descuenta nada.
3. O da clic en "Rechazar" — captura un motivo breve, visible para quien solicitó.

### Cómo cerrar turno (tab Cierre)

1. Da clic en "Cerrar turno" — el sistema pide conteo físico ciego (no muestra el esperado todavía).
2. Captura el conteo real por método de pago.
3. El sistema compara contra lo esperado y muestra la diferencia.
4. Si la diferencia excede el umbral configurado, se bloquea el cierre hasta firma de supervisor.

## Reglas de negocio — por qué se comporta así

- **Regla:** el surtido de receta descuenta el lote que caduca primero (FEFO), no el de mayor stock.
  **Razón:** evita mermas por caducidad — cumplimiento normativo de manejo de inventario clínico.
- **Regla:** aprobar una solicitud de insumos es una operación atómica (todo o nada).
  **Razón:** evita estados intermedios donde se descontó stock pero la solicitud quedó sin marcar aprobada (o viceversa).
- **Regla:** el conteo de cierre de turno es ciego (no se muestra el esperado antes de capturar el real).
  **Razón:** evita que el cajero ajuste su conteo para que "cuadre" en vez de contar de verdad.
- **Regla:** diferencia de cierre por encima del umbral bloquea hasta firma de supervisor.
  **Razón:** control de caja — diferencias grandes requieren explicación antes de cerrar el turno.

## Errores frecuentes

| Síntoma | Causa | Qué hacer |
|---|---|---|
| "No se puede cobrar sin turno abierto" | El turno de farmacia no fue abierto al iniciar el día | Ir a tab Cierre → abrir turno antes de vender |
| Solicitud de insumo queda en "pendiente" mucho tiempo | Nadie con rol admin/farmacia la ha revisado | Avisar a recepción/admin, o usar el chat de ayuda para escalar |
| Aprobar solicitud falla con error de stock | No hay suficiente cantidad del insumo en almacén | Verificar inventario real, ajustar cantidad solicitada o reabastecer primero |
| Badge rojo en Surtir receta no desaparece tras reabastecer | El stock se recalcula al refrescar la pantalla, no en tiempo real | Recargar la pantalla (F5) |

## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/Farmacia.tsx` (tabs: pos, surtir, inventario, insumos, compras, cierre)
- **Insumos:** UI en `src/pages/farmacia/SolicitudesInsumos.tsx`; RPCs `aprobar_solicitud_insumo` / `rechazar_solicitud_insumo` (atómicas, FEFO, registran en `movimientos_inventario`)
- **Tablas Supabase:** `solicitudes_insumos`, `entregas_turno`, `movimientos_inventario`, `cortes`, `fondos_movimientos`
- **Cómo agregar un campo nuevo a una solicitud:** migración `ALTER TABLE solicitudes_insumos ADD COLUMN ...` + actualizar el formulario en `SolicitudesInsumos.tsx` + regenerar `types.ts` (`generate_typescript_types`)
- **Cómo agregar una regla de negocio nueva (ej. límite de cantidad por solicitud):** la validación de aprobación vive en el RPC `aprobar_solicitud_insumo` (Postgres), no en el frontend — agregarla ahí para que no se pueda saltar desde otra vía
