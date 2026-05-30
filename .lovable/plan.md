# Plan: Farmacia POS — Venta directa + FIFO + Clasificación regulatoria

Cambio grande (>5 archivos, migración de schema, nueva pantalla POS). Resumen y ejecución por fases.

## Estado actual

- `medicamentos` ya tiene `requiere_receta` y `controlado` (de migración previa). Falta multi-clínica (no tiene `clinic_id`) y la clasificación granular.
- `lotes_medicamento` ya existe con `numero_lote`, `fecha_caducidad`, `existencia`. Falta `clinic_id`, `fecha_entrada` (para FIFO estricto).
- `movimientos_inventario` ya existe con enum `movimiento_tipo: entrada|salida|ajuste|caducidad`. Hay que ampliar enum y agregar `clinic_id`, `reference_type`, `reference_id`.
- No existen `pharmacy_sales` ni `pharmacy_sale_items`.
- Página `src/pages/Farmacia.tsx` ya existe (a revisar para agregar tab "Venta directa" sin reescribir).

## Fase 1 — Migración DB (una sola migración)

1. Ampliar `medicamentos`:
   - `clinic_id uuid NOT NULL DEFAULT <salud_integral_mx>`
   - `sale_type text NOT NULL DEFAULT 'otc'` con CHECK in (`otc`,`receta_requerida`,`receta_retenida`,`controlado`,`no_medicamento`)
   - `is_controlled boolean NOT NULL DEFAULT false`
   - `requires_prescription boolean NOT NULL DEFAULT false`
   - `requires_retained_prescription boolean NOT NULL DEFAULT false`
   - `requires_special_prescription boolean NOT NULL DEFAULT false`
   - `allow_direct_sale boolean NOT NULL DEFAULT true`
   - `regulatory_notes text`
   - Backfill desde `requiere_receta`/`controlado` ya existentes (mantener columnas legacy por compatibilidad).
   - GRANTs + RLS multi-clínica restrictive.

2. Ampliar `lotes_medicamento`:
   - `clinic_id uuid NOT NULL DEFAULT <...>`
   - `fecha_entrada timestamptz NOT NULL DEFAULT now()`
   - `costo_unitario numeric(10,2)` (opcional, ya útil para PEPS)
   - Index `(medicamento_id, fecha_entrada, fecha_caducidad)` para FIFO.
   - RLS multi-clínica restrictive.

3. Ampliar `movimientos_inventario`:
   - Nuevos valores en enum: `salida_venta`, `salida_surtido_receta`, `cancelacion`.
   - `clinic_id`, `reference_type text`, `reference_id uuid`, `cantidad` permite signo (o se asume positivo y el tipo decide la dirección — mantengo positivo + tipo).
   - RLS multi-clínica restrictive.

4. Tablas nuevas: `pharmacy_sales` y `pharmacy_sale_items` con GRANTs + RLS por clínica + por staff (admin/nurse/receptionist). Bitácora vía `audit_logs`.

5. RPC SECURITY DEFINER `pharmacy_register_sale(p_payload jsonb) returns uuid`:
   - Valida cada item: producto activo, lote no vencido, existencia.
   - Si `sale_type = 'direct_sale'`: rechaza items con `requires_prescription=true` o `is_controlled=true` o `allow_direct_sale=false`.
   - Selecciona lote FIFO (más antigua `fecha_entrada`, luego `fecha_caducidad` ASC, no vencido) si no se especifica.
   - Si se especifica `lote_id` manual y existe lote más antiguo → requiere `override_reason` + rol admin/nurse → audita.
   - Descuenta `lotes_medicamento.existencia` y crea `movimientos_inventario` con `salida_venta` o `salida_surtido_receta`.
   - Inserta sale + items, calcula totales. Devuelve `sale_id`.
   - Audita evento (`pharmacy_sale_created`, `pharmacy_sale_blocked_prescription_required`, `pharmacy_sale_blocked_controlled`, `pharmacy_lot_override`).

6. RPC `pharmacy_pick_fifo_lot(p_medicamento_id, p_clinic_id, p_qty) returns table` — helper para el front.

## Fase 2 — Frontend (mínimo, dentro de Farmacia.tsx existente)

- Añadir tab "Venta directa" en la página existente. Sin pantallas nuevas en otros archivos.
- Componente único `src/features/farmacia/VentaDirecta.tsx`:
  - Buscador de producto (existente `medicamentos`).
  - Al seleccionar, muestra `sale_type`, badge regulatorio, lote sugerido (FIFO), existencia, caducidad.
  - Si `requires_prescription` o `is_controlled` o `!allow_direct_sale` → bloquea con mensaje literal solicitado.
  - Carrito local (useReducer), totales, descuento, método de pago, cliente (Público general / paciente existente).
  - Submit → llama RPC `pharmacy_register_sale`. Toast éxito/error.
- Sin Redux/Zustand. zod + react-hook-form donde aplique. MXN con `Intl.NumberFormat('es-MX')`.

## Fase 3 — Validación

- `npm run build` (lo corre el harness).
- Smoke con read_query:
  - venta OTC sin paciente OK
  - bloqueo medicamento con `requires_prescription`
  - bloqueo `is_controlled`
  - FIFO escoge lote más antiguo
  - no vende lote vencido

## Fuera de alcance (explícito)

- CFDI / facturación electrónica.
- Devoluciones (deja `payment_status` con `pending|paid|invoiced` listo).
- Recetario controlado oficial COFEPRIS.
- Refactor de `Farmacia.tsx` existente: solo se le agrega un tab.

## Riesgos

- Cambiar el enum `movimiento_tipo` en Postgres requiere `ALTER TYPE ... ADD VALUE` por valor (no se puede en la misma transacción que se usan). Mitigación: hacer `ALTER TYPE` al inicio de la migración y usar los nuevos valores solo en código posterior (Postgres exige commit; usaré varias `ALTER TYPE ADD VALUE IF NOT EXISTS` y no los referencio en la misma migración, solo desde la RPC creada en migración posterior — o creo la RPC en una segunda migración).

Plan listo. ¿Procedo a ejecutar?
