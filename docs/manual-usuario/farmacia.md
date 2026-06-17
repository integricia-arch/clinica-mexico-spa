# Caja / Farmacia

> Aquí cobras ventas, entregas medicamentos y cierras tu turno. Si trabajas en recepción o eres enfermera, también pasas por aquí para pedir insumos.

## Antes de vender: abrir tu caja

Cuando entras a "Caja" y no has abierto turno todavía, el sistema te pide estos pasos — es normal, hazlo así:

1. **Elige tu caja** (si solo hay una, el sistema la elige por ti).
2. **Cuenta el efectivo que tienes en la caja en ese momento** y captúralo. No te muestra cuánto "debería" haber — cuenta primero, el sistema compara después.
3. El sistema te dice si tu conteo coincide con el fondo esperado. Si hay diferencia, te avisa — revisa antes de continuar.
4. Confirma — listo, ya puedes cobrar.

**¿Por qué cuento antes de ver el monto esperado?** Para que el conteo sea real. Si vieras primero cuánto "debería haber", sería fácil ajustar el número sin contar de verdad. Así se evitan errores y faltantes que nadie nota hasta el cierre.

## Cómo cobrar una venta

1. Busca el producto escribiendo el nombre, o escanéalo con el lector de código de barras.
2. Da clic sobre el producto para agregarlo al carrito.
3. Elige cómo paga el cliente: efectivo, tarjeta, transferencia, o una combinación (mixto).
4. Si es mixto, escribe un monto y el sistema calcula el otro solo.
5. Confirma el cobro — se genera el ticket con el desglose del IVA.

## Cómo entregar una receta

1. Busca la receta por folio o por el nombre del paciente.
2. Revisa cada medicamento: si ves una etiqueta roja, significa que falta stock; verde, que sí hay.
3. Confirma la entrega — el sistema descuenta del almacén automáticamente.

## Cómo pedir insumos (si eres enfermera)

1. Elige el insumo que necesitas y cuántos.
2. Da clic en "Solicitar".
3. Espera — alguien de farmacia o el administrador aprueba o rechaza tu solicitud. Te enteras cuando cambia de estado.

## Cómo aprobar una solicitud de insumos (si trabajas en farmacia/admin)

1. Revisa la lista de solicitudes pendientes.
2. Si hay suficiente en el almacén, da clic en "Aprobar" — el sistema descuenta el insumo solo, no hace falta hacer nada más.
3. Si no procede, da clic en "Rechazar" y escribe brevemente por qué — la persona que pidió lo verá.

## Cómo cerrar tu turno al final del día

1. Da clic en "Cerrar turno".
2. El sistema te pide contar el efectivo físico que tienes — otra vez sin mostrarte el esperado primero.
3. Captura tu conteo por cada forma de pago (efectivo, tarjeta, etc.).
4. El sistema compara y te muestra si hubo diferencia.
5. Si la diferencia es grande, no vas a poder cerrar solo — necesitas que un supervisor lo autorice contigo presente.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No puedo cobrar nada | No has abierto tu turno todavía | Ve a "Caja" y sigue los pasos de apertura (arriba) |
| Mi solicitud de insumo lleva mucho tiempo sin respuesta | Nadie de farmacia/admin la ha revisado aún | Avísale a recepción o usa el botón de ayuda para hablar con alguien |
| Al aprobar una solicitud me da error de stock | No hay suficiente del insumo en el almacén | Revisa el inventario real antes de aprobar, o pide que reabastezcan primero |
| La etiqueta roja de un medicamento no se quita aunque ya llegó más | La pantalla no se actualiza solita | Recarga la página (F5) |
| No puedo cerrar mi turno, dice que la diferencia es muy grande | Hay más o menos dinero del que debería haber | Busca a tu supervisor — necesita autorizar el cierre contigo presente |


## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/Farmacia.tsx` (tabs: pos, surtir, inventario, insumos, compras, cierre)
- **Apertura de turno:** `src/components/turno/TurnoOpenWizard.tsx` + `TurnoGuard.tsx` (gate que se muestra si no hay turno abierto)
- **Insumos:** UI en `src/pages/farmacia/SolicitudesInsumos.tsx`; RPCs `aprobar_solicitud_insumo` / `rechazar_solicitud_insumo` (atómicas, FEFO, registran en `movimientos_inventario`)
- **Tablas Supabase:** `solicitudes_insumos`, `entregas_turno`, `movimientos_inventario`, `cortes`, `fondos_movimientos`, `pharmacy_cash_shifts`, `turnos`
- **Cómo agregar un campo nuevo a una solicitud:** migración `ALTER TABLE solicitudes_insumos ADD COLUMN ...` + actualizar el formulario en `SolicitudesInsumos.tsx` + regenerar `types.ts` (`generate_typescript_types`)
- **Cómo agregar una regla de negocio nueva (ej. límite de cantidad por solicitud):** la validación de aprobación vive en el RPC `aprobar_solicitud_insumo` (Postgres), no en el frontend — agregarla ahí para que no se pueda saltar desde otra vía
