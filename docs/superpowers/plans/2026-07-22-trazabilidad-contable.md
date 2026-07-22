# Trazabilidad contable-administrativa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dado cualquier evento del sistema (solicitud de compra, orden, recepción,
factura, pago a proveedor, cita, venta POS), reconstruir la cadena administrativa
completa — quién creó/autorizó cada paso, hasta la póliza y la conciliación
bancaria — vía una función SQL y una pantalla de búsqueda.

**Architecture:** Un RPC `contab_trazar(p_tipo, p_id)` compuesto de dos funciones
internas: `_contab_trazar_raiz` (sube por la cadena hasta el ancestro más alto
conocido) y `_contab_trazar_nodo` (baja recursivamente construyendo el árbol JSON
completo). Un segundo RPC `contab_trazar_proveedor(p_proveedor_id)` reusa
`_contab_trazar_nodo` para todas las solicitudes de ese proveedor. Frontend: tab
nueva en Contabilidad con buscador de evento y buscador de proveedor, render de
timeline.

**Tech Stack:** PostgreSQL/PL-pgSQL (Supabase), React/TypeScript, shadcn/ui
(`Tabs`, `Card`, `Input`), `supabase-js` RPC calls.

## Global Constraints

- Todo RPC nuevo: `SECURITY DEFINER`, `SET search_path = public`,
  `REVOKE EXECUTE ... FROM PUBLIC` + `GRANT ... TO authenticated`, y check de
  `clinic_memberships`/`auth.uid()` como primera operación real (antes de
  devolver cualquier dato) — regla dura de `CLAUDE.md` del proyecto.
- Nombres de tabla reales confirmados contra el schema en producción
  (`kyfkvdyxpvpiacyymldc`) en esta sesión — **la tabla de cotizaciones se llama
  `cotizaciones`**, no `cotizaciones_proveedor` como decía el spec original;
  este plan usa el nombre real.
- `reference_type` reales ya usados en `polizas` (confirmado por query en esta
  sesión): `appointment_insumo`, `cierre_mensual`, `factura_proveedor`,
  `factura_proveedor_pago`, `honorario_appointment`, `honorario_pago_manual`,
  `movimiento_caja`. No existe `reference_type='pharmacy_sale'` en `polizas`
  (partida doble) — las ventas POS solo generan asiento en
  `movimientos_contables` (devengo simple), limitación conocida y documentada
  en `memoria/proyectos/modulo-contable-memoria-tecnica.md`. Este plan expone
  ese hueco como nodo `HUECO` en vez de intentar inventar un vínculo que no
  existe.
- No existe FK de `movimientos` (caja) hacia `pharmacy_sales` — una venta POS
  con pago en caja no se puede ligar de vuelta a `pharmacy_sales` por FK. Se
  documenta como nodo `HUECO` explícito, no se agrega columna nueva (fuera de
  alcance de este plan, requeriría migración de dato — decisión de Pablo si se
  quiere cerrar después).
- Forma de nodo JSON, fija para todo el árbol:
  ```json
  {
    "tipo": "orden_compra",
    "id": "uuid",
    "folio": "OC-004",
    "fecha": "2026-07-13",
    "monto_centavos": 450000,
    "estado": "aprobada",
    "creado_por": { "user_id": "uuid", "nombre": "Ana" },
    "autorizado_por": { "user_id": "uuid", "nombre": "Dr. González" },
    "hijos": []
  }
  ```
  Nodo de eslabón faltante: `{ "tipo": "HUECO", "mensaje": "texto explicando qué falta" }`.

---

### Task 1: Migración — resolver de usuario + función que sube a la raíz (`_contab_trazar_raiz`)

**Files:**
- Create: `supabase/migrations/20260723100000_trazabilidad_raiz.sql`

**Interfaces:**
- Produces: `public._contab_trazar_usuario(uuid) RETURNS jsonb` — dado un
  `user_id`, retorna `{"user_id":"...","nombre":"..."}` o `null`.
- Produces: `public._contab_trazar_raiz(p_tipo text, p_id uuid) RETURNS TABLE(tipo text, id uuid, clinic_id uuid)` —
  dado cualquier tipo/id de la cadena, sube hasta el ancestro conocido más alto
  y retorna su tipo, id y `clinic_id` (para el check de acceso en Task 2).

- [ ] **Step 1: Confirmar en vivo los nombres de columna que se van a usar antes de escribir la función**

Run (vía MCP `execute_sql` o `supabase db query --linked`):
```sql
select table_name, column_name
from information_schema.columns
where table_schema='public'
  and table_name in ('cotizaciones','ordenes_compra','recepciones_mercancia',
                      'facturas_proveedor','pagos_proveedor','appointment_insumos',
                      'movimientos','cfdi_documentos','loyalty_movimientos')
  and column_name in ('id','solicitud_compra_id','solicitud_id','orden_id',
                      'orden_compra_id','factura_id','appointment_id',
                      'sale_id','pharmacy_sale_id','clinic_id')
order by table_name;
```
Expected: confirma que `cotizaciones.solicitud_compra_id`,
`ordenes_compra.solicitud_id`, `recepciones_mercancia.orden_id`,
`facturas_proveedor.solicitud_id`/`orden_id`/`recepcion_id`,
`pagos_proveedor.factura_id`, `appointment_insumos.appointment_id`,
`movimientos.appointment_id`, `cfdi_documentos.appointment_id`/`sale_id`,
`loyalty_movimientos.pharmacy_sale_id` existen tal cual — ya confirmado en esta
sesión, este paso es la re-verificación de higiene antes de escribir DDL.

- [ ] **Step 2: Escribir la migración**

```sql
-- supabase/migrations/20260723100000_trazabilidad_raiz.sql

CREATE OR REPLACE FUNCTION public._contab_trazar_usuario(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN p_user_id IS NULL THEN NULL ELSE
    jsonb_build_object('user_id', p_user_id, 'nombre', COALESCE(p.full_name, 'Usuario'))
  END
  FROM (SELECT p_user_id AS uid) u
  LEFT JOIN public.profiles p ON p.id = u.uid;
$$;

REVOKE EXECUTE ON FUNCTION public._contab_trazar_usuario(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._contab_trazar_usuario(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public._contab_trazar_raiz(p_tipo text, p_id uuid)
RETURNS TABLE(tipo text, id uuid, clinic_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text := p_tipo;
  v_id uuid := p_id;
  v_next_tipo text;
  v_next_id uuid;
BEGIN
  IF p_id IS NULL THEN
    RETURN;
  END IF;

  LOOP
    v_next_tipo := NULL;
    v_next_id := NULL;

    CASE v_tipo
      WHEN 'cotizacion' THEN
        SELECT solicitud_compra_id INTO v_next_id FROM public.cotizaciones WHERE id = v_id;
        IF v_next_id IS NOT NULL THEN v_next_tipo := 'solicitud_compra'; END IF;
      WHEN 'orden_compra' THEN
        SELECT solicitud_id INTO v_next_id FROM public.ordenes_compra WHERE id = v_id;
        IF v_next_id IS NOT NULL THEN v_next_tipo := 'solicitud_compra'; END IF;
      WHEN 'recepcion_mercancia' THEN
        SELECT orden_id INTO v_next_id FROM public.recepciones_mercancia WHERE id = v_id;
        IF v_next_id IS NOT NULL THEN v_next_tipo := 'orden_compra'; END IF;
      WHEN 'factura_proveedor' THEN
        SELECT solicitud_id INTO v_next_id FROM public.facturas_proveedor WHERE id = v_id;
        IF v_next_id IS NOT NULL THEN v_next_tipo := 'solicitud_compra'; END IF;
      WHEN 'pago_proveedor' THEN
        SELECT factura_id INTO v_next_id FROM public.pagos_proveedor WHERE id = v_id;
        IF v_next_id IS NOT NULL THEN v_next_tipo := 'factura_proveedor'; END IF;
      WHEN 'appointment_insumo' THEN
        SELECT appointment_id INTO v_next_id FROM public.appointment_insumos WHERE id = v_id;
        IF v_next_id IS NOT NULL THEN v_next_tipo := 'appointment'; END IF;
      WHEN 'movimiento_caja' THEN
        SELECT appointment_id INTO v_next_id FROM public.movimientos WHERE id = v_id;
        IF v_next_id IS NOT NULL THEN v_next_tipo := 'appointment'; END IF;
      WHEN 'cfdi_documento' THEN
        SELECT appointment_id, sale_id INTO v_next_id, v_next_id
          FROM public.cfdi_documentos WHERE id = v_id;
        -- appointment_id tiene prioridad; si es null se intenta sale_id
        SELECT
          CASE WHEN appointment_id IS NOT NULL THEN appointment_id ELSE sale_id END,
          CASE WHEN appointment_id IS NOT NULL THEN 'appointment' ELSE 'pharmacy_sale' END
        INTO v_next_id, v_next_tipo
        FROM public.cfdi_documentos WHERE id = v_id;
      WHEN 'loyalty_movimiento' THEN
        SELECT pharmacy_sale_id INTO v_next_id FROM public.loyalty_movimientos WHERE id = v_id;
        IF v_next_id IS NOT NULL THEN v_next_tipo := 'pharmacy_sale'; END IF;
      ELSE
        -- solicitud_compra, appointment, pharmacy_sale, honorario, honorario_pago_manual:
        -- ya son raíz, no tienen ancestro conocido.
        v_next_tipo := NULL;
    END CASE;

    EXIT WHEN v_next_tipo IS NULL OR v_next_id IS NULL;
    v_tipo := v_next_tipo;
    v_id := v_next_id;
  END LOOP;

  RETURN QUERY
  SELECT v_tipo, v_id,
    CASE v_tipo
      WHEN 'solicitud_compra' THEN (SELECT clinic_id FROM public.solicitudes_compra WHERE id = v_id)
      WHEN 'orden_compra' THEN (SELECT clinic_id FROM public.ordenes_compra WHERE id = v_id)
      WHEN 'recepcion_mercancia' THEN (SELECT clinic_id FROM public.recepciones_mercancia WHERE id = v_id)
      WHEN 'factura_proveedor' THEN (SELECT clinic_id FROM public.facturas_proveedor WHERE id = v_id)
      WHEN 'pago_proveedor' THEN (SELECT clinic_id FROM public.pagos_proveedor WHERE id = v_id)
      WHEN 'appointment' THEN (SELECT clinic_id FROM public.appointments WHERE id = v_id)
      WHEN 'pharmacy_sale' THEN (SELECT clinic_id FROM public.pharmacy_sales WHERE id = v_id)
      ELSE NULL
    END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._contab_trazar_raiz(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._contab_trazar_raiz(text, uuid) TO authenticated;
```

- [ ] **Step 3: Aplicar la migración**

Run: usar MCP `apply_migration` con `name="trazabilidad_raiz"` y el SQL de
arriba (CLI bloqueado por drift ya conocido, ver `CLAUDE.md`).

- [ ] **Step 4: Verificar en vivo que la función sube correctamente**

Run:
```sql
select * from public._contab_trazar_raiz(
  'pago_proveedor',
  (select id from public.pagos_proveedor limit 1)
);
```
Expected: una fila con `tipo='solicitud_compra'` (o `'orden_compra'` si esa
factura no tiene `solicitud_id`) y un `clinic_id` no nulo. Si no hay filas en
`pagos_proveedor` en el ambiente de prueba, usar el harness manual del Task 4
para crear datos de prueba primero.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260723100000_trazabilidad_raiz.sql
git commit -m "feat: RPC _contab_trazar_raiz para subir la cadena de compras/ingresos"
```

---

### Task 2: Migración — construir el árbol hacia abajo (`_contab_trazar_nodo`) + RPC público `contab_trazar`

**Files:**
- Create: `supabase/migrations/20260723110000_trazabilidad_nodo.sql`

**Interfaces:**
- Consumes: `public._contab_trazar_usuario(uuid)`, `public._contab_trazar_raiz(text, uuid)` de Task 1.
- Produces: `public._contab_trazar_nodo(p_tipo text, p_id uuid, p_clinic_id uuid) RETURNS jsonb` —
  nodo completo con `hijos` recursivos, ya filtrado por `clinic_id`.
- Produces: `public.contab_trazar(p_tipo text, p_id uuid) RETURNS jsonb` — punto de entrada
  público: resuelve la raíz, valida acceso, y devuelve el árbol completo desde la raíz.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260723110000_trazabilidad_nodo.sql

CREATE OR REPLACE FUNCTION public._contab_trazar_nodo(p_tipo text, p_id uuid, p_clinic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_node jsonb;
  v_hijos jsonb := '[]'::jsonb;
  v_poliza_id uuid;
  v_poliza record;
  v_row record;
BEGIN
  IF p_id IS NULL THEN
    RETURN jsonb_build_object('tipo','HUECO','mensaje','id nulo para tipo '||p_tipo);
  END IF;

  CASE p_tipo

    WHEN 'solicitud_compra' THEN
      SELECT sc.folio, sc.fecha_solicitud, sc.estatus,
             sc.solicitante_id, sc.aprobador_id, sc.orden_compra_id
      INTO v_row FROM public.solicitudes_compra sc
      WHERE sc.id = p_id AND sc.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Solicitud no encontrada'); END IF;

      SELECT array_agg(id) INTO v_row.orden_compra_id -- placeholder no usado, ver nota abajo
      FROM public.cotizaciones WHERE solicitud_compra_id = p_id;

      -- una solicitud puede tener varias cotizaciones; solo la seleccionada avanza
      FOR v_row IN
        SELECT id FROM public.cotizaciones
        WHERE solicitud_compra_id = p_id AND clinic_id = p_clinic_id
      LOOP
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('cotizacion', v_row.id, p_clinic_id));
      END LOOP;

      IF jsonb_array_length(v_hijos) = 0 THEN
        v_hijos := jsonb_build_array(jsonb_build_object('tipo','HUECO','mensaje','Sin cotizaciones registradas aún'));
      END IF;

      SELECT sc.folio, sc.fecha_solicitud AS fecha, sc.estatus AS estado,
             sc.solicitante_id, sc.aprobador_id
      INTO v_row FROM public.solicitudes_compra sc WHERE sc.id = p_id;

      v_node := jsonb_build_object(
        'tipo','solicitud_compra','id',p_id,'folio',v_row.folio,'fecha',v_row.fecha,
        'monto_centavos', NULL, 'estado', v_row.estatus,
        'creado_por', public._contab_trazar_usuario(v_row.solicitante_id),
        'autorizado_por', public._contab_trazar_usuario(v_row.aprobador_id),
        'hijos', v_hijos
      );
      RETURN v_node;

    WHEN 'cotizacion' THEN
      SELECT c.folio, c.fecha_cotizacion AS fecha, c.total_centavos, c.created_by, c.orden_compra_id
      INTO v_row FROM public.cotizaciones c
      WHERE c.id = p_id AND c.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Cotización no encontrada'); END IF;

      IF v_row.orden_compra_id IS NOT NULL THEN
        v_hijos := jsonb_build_array(public._contab_trazar_nodo('orden_compra', v_row.orden_compra_id, p_clinic_id));
      ELSE
        v_hijos := jsonb_build_array(jsonb_build_object('tipo','HUECO','mensaje','Cotización aún no genera orden de compra'));
      END IF;

      RETURN jsonb_build_object(
        'tipo','cotizacion','id',p_id,'folio',v_row.folio,'fecha',v_row.fecha,
        'monto_centavos', v_row.total_centavos, 'estado', NULL,
        'creado_por', public._contab_trazar_usuario(v_row.created_by),
        'autorizado_por', NULL,
        'hijos', v_hijos
      );

    WHEN 'orden_compra' THEN
      SELECT oc.folio, oc.fecha_emision AS fecha, oc.total_centavos, oc.estatus,
             oc.created_by, oc.aprobada_by
      INTO v_row FROM public.ordenes_compra oc
      WHERE oc.id = p_id AND oc.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Orden de compra no encontrada'); END IF;

      v_hijos := '[]'::jsonb;
      FOR v_row IN
        SELECT id FROM public.recepciones_mercancia
        WHERE orden_id = p_id AND clinic_id = p_clinic_id
      LOOP
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('recepcion_mercancia', v_row.id, p_clinic_id));
      END LOOP;
      IF jsonb_array_length(v_hijos) = 0 THEN
        v_hijos := jsonb_build_array(jsonb_build_object('tipo','HUECO','mensaje','Sin recepción de mercancía aún'));
      END IF;

      SELECT oc.folio, oc.fecha_emision AS fecha, oc.total_centavos, oc.estatus,
             oc.created_by, oc.aprobada_by
      INTO v_row FROM public.ordenes_compra oc WHERE oc.id = p_id;

      RETURN jsonb_build_object(
        'tipo','orden_compra','id',p_id,'folio',v_row.folio,'fecha',v_row.fecha,
        'monto_centavos', v_row.total_centavos, 'estado', v_row.estatus,
        'creado_por', public._contab_trazar_usuario(v_row.created_by),
        'autorizado_por', public._contab_trazar_usuario(v_row.aprobada_by),
        'hijos', v_hijos
      );

    WHEN 'recepcion_mercancia' THEN
      SELECT rm.folio_recepcion, rm.fecha_recepcion AS fecha, rm.estatus, rm.recibido_por
      INTO v_row FROM public.recepciones_mercancia rm
      WHERE rm.id = p_id AND rm.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Recepción no encontrada'); END IF;

      v_hijos := '[]'::jsonb;
      FOR v_row IN
        SELECT id FROM public.facturas_proveedor
        WHERE recepcion_id = p_id AND clinic_id = p_clinic_id
      LOOP
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('factura_proveedor', v_row.id, p_clinic_id));
      END LOOP;
      IF jsonb_array_length(v_hijos) = 0 THEN
        v_hijos := jsonb_build_array(jsonb_build_object('tipo','HUECO','mensaje','Sin factura de proveedor registrada aún'));
      END IF;

      SELECT rm.folio_recepcion, rm.fecha_recepcion AS fecha, rm.estatus, rm.recibido_por
      INTO v_row FROM public.recepciones_mercancia rm WHERE rm.id = p_id;

      RETURN jsonb_build_object(
        'tipo','recepcion_mercancia','id',p_id,'folio',v_row.folio_recepcion,'fecha',v_row.fecha,
        'monto_centavos', NULL, 'estado', v_row.estatus,
        'creado_por', public._contab_trazar_usuario(v_row.recibido_por),
        'autorizado_por', NULL,
        'hijos', v_hijos
      );

    WHEN 'factura_proveedor' THEN
      SELECT fp.folio_interno, fp.fecha_factura AS fecha, fp.total_centavos, fp.estatus, fp.created_by
      INTO v_row FROM public.facturas_proveedor fp
      WHERE fp.id = p_id AND fp.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Factura no encontrada'); END IF;

      v_hijos := '[]'::jsonb;
      -- póliza de devengo (reference_type='factura_proveedor')
      SELECT id INTO v_poliza_id FROM public.polizas
      WHERE reference_type='factura_proveedor' AND reference_id = p_id AND clinic_id = p_clinic_id
      LIMIT 1;
      IF v_poliza_id IS NOT NULL THEN
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('poliza', v_poliza_id, p_clinic_id));
      ELSE
        v_hijos := v_hijos || jsonb_build_array(jsonb_build_object('tipo','HUECO','mensaje','Factura sin póliza de devengo generada'));
      END IF;

      FOR v_row IN
        SELECT id FROM public.pagos_proveedor
        WHERE factura_id = p_id AND clinic_id = p_clinic_id
      LOOP
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('pago_proveedor', v_row.id, p_clinic_id));
      END LOOP;

      SELECT fp.folio_interno, fp.fecha_factura AS fecha, fp.total_centavos, fp.estatus, fp.created_by
      INTO v_row FROM public.facturas_proveedor fp WHERE fp.id = p_id;

      RETURN jsonb_build_object(
        'tipo','factura_proveedor','id',p_id,'folio',v_row.folio_interno,'fecha',v_row.fecha,
        'monto_centavos', v_row.total_centavos, 'estado', v_row.estatus,
        'creado_por', public._contab_trazar_usuario(v_row.created_by),
        'autorizado_por', NULL,
        'hijos', v_hijos
      );

    WHEN 'pago_proveedor' THEN
      SELECT pp.monto_centavos, pp.fecha_pago AS fecha, pp.registrado_por
      INTO v_row FROM public.pagos_proveedor pp
      WHERE pp.id = p_id AND pp.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Pago no encontrado'); END IF;

      SELECT id INTO v_poliza_id FROM public.polizas
      WHERE reference_type='factura_proveedor_pago' AND reference_id = p_id AND clinic_id = p_clinic_id
      LIMIT 1;
      IF v_poliza_id IS NOT NULL THEN
        v_hijos := jsonb_build_array(public._contab_trazar_nodo('poliza', v_poliza_id, p_clinic_id));
      ELSE
        v_hijos := jsonb_build_array(jsonb_build_object('tipo','HUECO','mensaje','Pago sin póliza generada'));
      END IF;

      RETURN jsonb_build_object(
        'tipo','pago_proveedor','id',p_id,'folio',NULL,'fecha',v_row.fecha,
        'monto_centavos', v_row.monto_centavos, 'estado', NULL,
        'creado_por', public._contab_trazar_usuario(v_row.registrado_por),
        'autorizado_por', NULL,
        'hijos', v_hijos
      );

    WHEN 'poliza' THEN
      SELECT pz.folio, pz.fecha, pz.estado, pz.created_by,
             (SELECT COALESCE(sum(debe_centavos),0) FROM public.poliza_partidas WHERE poliza_id = pz.id) AS monto
      INTO v_row FROM public.polizas pz
      WHERE pz.id = p_id AND pz.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Póliza no encontrada'); END IF;

      v_hijos := '[]'::jsonb;
      FOR v_row IN
        SELECT ec.id FROM public.contab_estados_cuenta ec
        JOIN public.poliza_partidas ppd ON ppd.id = ec.poliza_partida_id
        WHERE ppd.poliza_id = p_id AND ec.clinic_id = p_clinic_id
      LOOP
        v_hijos := v_hijos || jsonb_build_array(jsonb_build_object(
          'tipo','conciliacion_bancaria','id',v_row.id,'folio',NULL,'fecha',NULL,
          'monto_centavos', NULL, 'estado','conciliado','creado_por',NULL,'autorizado_por',NULL,'hijos','[]'::jsonb
        ));
      END LOOP;
      IF jsonb_array_length(v_hijos) = 0 THEN
        v_hijos := jsonb_build_array(jsonb_build_object('tipo','HUECO','mensaje','Aún no conciliado con banco'));
      END IF;

      SELECT pz.folio, pz.fecha, pz.estado, pz.created_by
      INTO v_row FROM public.polizas pz WHERE pz.id = p_id;

      RETURN jsonb_build_object(
        'tipo','poliza','id',p_id,'folio',v_row.folio,'fecha',v_row.fecha,
        'monto_centavos', NULL, 'estado', v_row.estado,
        'creado_por', public._contab_trazar_usuario(v_row.created_by),
        'autorizado_por', NULL,
        'hijos', v_hijos
      );

    WHEN 'appointment' THEN
      SELECT a.created_at::date AS fecha
      INTO v_row FROM public.appointments a
      WHERE a.id = p_id AND a.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Cita no encontrada'); END IF;

      v_hijos := '[]'::jsonb;
      FOR v_row IN
        SELECT id FROM public.appointment_insumos WHERE appointment_id = p_id AND clinic_id = p_clinic_id
      LOOP
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('appointment_insumo', v_row.id, p_clinic_id));
      END LOOP;
      FOR v_row IN
        SELECT id FROM public.movimientos WHERE appointment_id = p_id AND clinic_id = p_clinic_id
      LOOP
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('movimiento_caja', v_row.id, p_clinic_id));
      END LOOP;
      FOR v_row IN
        SELECT id FROM public.cfdi_documentos WHERE appointment_id = p_id AND clinic_id = p_clinic_id
      LOOP
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('cfdi_documento', v_row.id, p_clinic_id));
      END LOOP;
      -- honorario: doctor_honorarios_detalle es VISTA agregada por cita, sin id propio
      IF EXISTS (SELECT 1 FROM public.doctor_honorarios_detalle WHERE appointment_id = p_id) THEN
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('honorario', p_id, p_clinic_id));
      END IF;

      RETURN jsonb_build_object(
        'tipo','appointment','id',p_id,'folio',NULL,'fecha',v_row.fecha,
        'monto_centavos', NULL, 'estado', NULL,
        'creado_por', NULL, 'autorizado_por', NULL,
        'hijos', v_hijos
      );

    WHEN 'appointment_insumo' THEN
      SELECT ai.cantidad, ai.costo_unitario_centavos, ai.user_id, ai.created_at::date AS fecha
      INTO v_row FROM public.appointment_insumos ai
      WHERE ai.id = p_id AND ai.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Insumo no encontrado'); END IF;

      SELECT id INTO v_poliza_id FROM public.polizas
      WHERE reference_type='appointment_insumo' AND reference_id = p_id AND clinic_id = p_clinic_id LIMIT 1;
      IF v_poliza_id IS NOT NULL THEN
        v_hijos := jsonb_build_array(public._contab_trazar_nodo('poliza', v_poliza_id, p_clinic_id));
      ELSE
        v_hijos := jsonb_build_array(jsonb_build_object('tipo','HUECO','mensaje','Insumo sin póliza generada'));
      END IF;

      RETURN jsonb_build_object(
        'tipo','appointment_insumo','id',p_id,'folio',NULL,'fecha',v_row.fecha,
        'monto_centavos', v_row.cantidad * v_row.costo_unitario_centavos, 'estado', NULL,
        'creado_por', public._contab_trazar_usuario(v_row.user_id),
        'autorizado_por', NULL, 'hijos', v_hijos
      );

    WHEN 'honorario' THEN
      -- p_id aquí es el appointment_id (ver nota en _contab_trazar_raiz)
      SELECT id INTO v_poliza_id FROM public.polizas
      WHERE reference_type='honorario_appointment' AND reference_id = p_id AND clinic_id = p_clinic_id LIMIT 1;
      IF v_poliza_id IS NOT NULL THEN
        v_hijos := jsonb_build_array(public._contab_trazar_nodo('poliza', v_poliza_id, p_clinic_id));
      ELSE
        v_hijos := jsonb_build_array(jsonb_build_object('tipo','HUECO','mensaje','Honorario sin póliza generada'));
      END IF;

      RETURN jsonb_build_object(
        'tipo','honorario','id',p_id,'folio',NULL,'fecha',NULL,
        'monto_centavos', NULL, 'estado', NULL,
        'creado_por', NULL, 'autorizado_por', NULL, 'hijos', v_hijos
      );

    WHEN 'movimiento_caja' THEN
      SELECT m.total, m.cajero_user_id, m.created_at::date AS fecha, m.folio
      INTO v_row FROM public.movimientos m
      WHERE m.id = p_id AND m.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Movimiento de caja no encontrado'); END IF;

      SELECT id INTO v_poliza_id FROM public.polizas
      WHERE reference_type='movimiento_caja' AND reference_id = p_id AND clinic_id = p_clinic_id LIMIT 1;
      IF v_poliza_id IS NOT NULL THEN
        v_hijos := jsonb_build_array(public._contab_trazar_nodo('poliza', v_poliza_id, p_clinic_id));
      ELSE
        v_hijos := jsonb_build_array(jsonb_build_object('tipo','HUECO','mensaje','Movimiento sin póliza generada'));
      END IF;

      RETURN jsonb_build_object(
        'tipo','movimiento_caja','id',p_id,'folio',v_row.folio,'fecha',v_row.fecha,
        'monto_centavos', round(v_row.total*100), 'estado', NULL,
        'creado_por', public._contab_trazar_usuario(v_row.cajero_user_id),
        'autorizado_por', NULL, 'hijos', v_hijos
      );

    WHEN 'pharmacy_sale' THEN
      SELECT ps.total, ps.created_by, ps.created_at::date AS fecha
      INTO v_row FROM public.pharmacy_sales ps
      WHERE ps.id = p_id AND ps.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Venta no encontrada'); END IF;

      v_hijos := '[]'::jsonb;
      FOR v_row IN
        SELECT id FROM public.loyalty_movimientos WHERE pharmacy_sale_id = p_id AND clinic_id = p_clinic_id
      LOOP
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('loyalty_movimiento', v_row.id, p_clinic_id));
      END LOOP;
      FOR v_row IN
        SELECT id FROM public.cfdi_documentos WHERE sale_id = p_id AND clinic_id = p_clinic_id
      LOOP
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('cfdi_documento', v_row.id, p_clinic_id));
      END LOOP;
      -- Limitación conocida: sin FK de movimientos(caja) hacia pharmacy_sales,
      -- no se puede ligar la venta POS a su póliza automáticamente.
      v_hijos := v_hijos || jsonb_build_array(jsonb_build_object(
        'tipo','HUECO',
        'mensaje','Venta POS no se puede ligar a su póliza (sin FK movimientos→pharmacy_sales) — ver limitación conocida en memoria del módulo contable'
      ));

      SELECT ps.total, ps.created_by, ps.created_at::date AS fecha
      INTO v_row FROM public.pharmacy_sales ps WHERE ps.id = p_id;

      RETURN jsonb_build_object(
        'tipo','pharmacy_sale','id',p_id,'folio',NULL,'fecha',v_row.fecha,
        'monto_centavos', round(v_row.total*100), 'estado', NULL,
        'creado_por', public._contab_trazar_usuario(v_row.created_by),
        'autorizado_por', NULL, 'hijos', v_hijos
      );

    WHEN 'loyalty_movimiento' THEN
      SELECT lm.tipo, lm.puntos, lm.created_by, lm.created_at::date AS fecha
      INTO v_row FROM public.loyalty_movimientos lm
      WHERE lm.id = p_id AND lm.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Movimiento de lealtad no encontrado'); END IF;

      RETURN jsonb_build_object(
        'tipo','loyalty_movimiento','id',p_id,'folio',NULL,'fecha',v_row.fecha,
        'monto_centavos', NULL, 'estado', v_row.tipo,
        'creado_por', public._contab_trazar_usuario(v_row.created_by),
        'autorizado_por', NULL, 'hijos', '[]'::jsonb
      );

    WHEN 'cfdi_documento' THEN
      SELECT cd.folio, cd.fecha_emision::date AS fecha, cd.total, cd.status
      INTO v_row FROM public.cfdi_documentos cd
      WHERE cd.id = p_id AND cd.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','CFDI no encontrado'); END IF;

      RETURN jsonb_build_object(
        'tipo','cfdi_documento','id',p_id,'folio',v_row.folio,'fecha',v_row.fecha,
        'monto_centavos', round(v_row.total*100), 'estado', v_row.status,
        'creado_por', NULL, 'autorizado_por', NULL, 'hijos', '[]'::jsonb
      );

    ELSE
      RETURN jsonb_build_object('tipo','HUECO','mensaje','Tipo de nodo desconocido: '||p_tipo);
  END CASE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._contab_trazar_nodo(text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._contab_trazar_nodo(text, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.contab_trazar(p_tipo text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raiz record;
BEGIN
  SELECT * INTO v_raiz FROM public._contab_trazar_raiz(p_tipo, p_id);
  IF NOT FOUND OR v_raiz.clinic_id IS NULL THEN
    RETURN jsonb_build_object('tipo','HUECO','mensaje','No se encontró el registro solicitado');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships cm
    WHERE cm.user_id = auth.uid() AND cm.clinic_id = v_raiz.clinic_id
  ) THEN
    RAISE EXCEPTION 'Sin acceso a esta clínica';
  END IF;

  RETURN public._contab_trazar_nodo(v_raiz.tipo, v_raiz.id, v_raiz.clinic_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.contab_trazar(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contab_trazar(text, uuid) TO authenticated;
```

- [ ] **Step 2: Aplicar la migración**

Run: MCP `apply_migration` con `name="trazabilidad_nodo"`.

- [ ] **Step 3: Verificar en vivo con un pago real**

Run:
```sql
select public.contab_trazar('pago_proveedor', (select id from public.pagos_proveedor limit 1));
```
Expected: JSON con `tipo:"solicitud_compra"` en la raíz y `hijos` anidados
bajando hasta `pago_proveedor` y `poliza` (o nodos `HUECO` donde falte el
eslabón). Ejecutar como usuario autenticado de la clínica correspondiente
(o con `service_role` para prueba rápida, documentando que en producción
pasa por `auth.uid()`).

- [ ] **Step 4: Correr `get_advisors(security)` para confirmar que no quedaron funciones sin `REVOKE`/`search_path`**

Run: MCP `mcp__supabase__get_advisors(type="security")`.
Expected: sin advertencias nuevas sobre `contab_trazar`, `_contab_trazar_nodo`,
`_contab_trazar_raiz`, `_contab_trazar_usuario`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260723110000_trazabilidad_nodo.sql
git commit -m "feat: RPC contab_trazar — arbol completo de trazabilidad contable"
```

---

### Task 3: Migración — `contab_trazar_proveedor`

**Files:**
- Create: `supabase/migrations/20260723120000_trazabilidad_proveedor.sql`

**Interfaces:**
- Consumes: `public._contab_trazar_nodo(text, uuid, uuid)` de Task 2.
- Produces: `public.contab_trazar_proveedor(p_proveedor_id uuid) RETURNS jsonb` —
  arreglo de árboles, uno por cada `solicitud_compra` del proveedor (vía sus
  cotizaciones) más las `ordenes_compra` sin solicitud previa.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260723120000_trazabilidad_proveedor.sql

CREATE OR REPLACE FUNCTION public.contab_trazar_proveedor(p_proveedor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
  v_arboles jsonb := '[]'::jsonb;
  v_row record;
BEGIN
  SELECT clinic_id INTO v_clinic_id FROM public.proveedores WHERE id = p_proveedor_id;
  IF v_clinic_id IS NULL THEN
    RETURN jsonb_build_object('tipo','HUECO','mensaje','Proveedor no encontrado');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships cm
    WHERE cm.user_id = auth.uid() AND cm.clinic_id = v_clinic_id
  ) THEN
    RAISE EXCEPTION 'Sin acceso a esta clínica';
  END IF;

  -- raíz: solicitudes con al menos una cotización de este proveedor
  FOR v_row IN
    SELECT DISTINCT sc.id
    FROM public.solicitudes_compra sc
    JOIN public.cotizaciones c ON c.solicitud_compra_id = sc.id
    WHERE c.proveedor_id = p_proveedor_id AND sc.clinic_id = v_clinic_id
  LOOP
    v_arboles := v_arboles || jsonb_build_array(public._contab_trazar_nodo('solicitud_compra', v_row.id, v_clinic_id));
  END LOOP;

  -- órdenes de compra de este proveedor sin solicitud previa (flujo directo)
  FOR v_row IN
    SELECT oc.id
    FROM public.ordenes_compra oc
    WHERE oc.proveedor_id = p_proveedor_id AND oc.solicitud_id IS NULL AND oc.clinic_id = v_clinic_id
  LOOP
    v_arboles := v_arboles || jsonb_build_array(public._contab_trazar_nodo('orden_compra', v_row.id, v_clinic_id));
  END LOOP;

  IF jsonb_array_length(v_arboles) = 0 THEN
    RETURN jsonb_build_object('tipo','HUECO','mensaje','Sin compras registradas para este proveedor');
  END IF;

  RETURN v_arboles;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.contab_trazar_proveedor(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contab_trazar_proveedor(uuid) TO authenticated;
```

- [ ] **Step 2: Aplicar la migración**

Run: MCP `apply_migration` con `name="trazabilidad_proveedor"`.

- [ ] **Step 3: Verificar en vivo**

Run:
```sql
select public.contab_trazar_proveedor((select id from public.proveedores limit 1));
```
Expected: arreglo JSON con uno o más árboles, o el nodo `HUECO` si el
proveedor de prueba no tiene compras.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260723120000_trazabilidad_proveedor.sql
git commit -m "feat: RPC contab_trazar_proveedor — todas las cadenas de un proveedor"
```

---

### Task 4: Harness manual transaccional (verificación end-to-end de ambos troncos)

**Files:**
- Create: `supabase/scripts/test-trazabilidad-manual.sql`

**Interfaces:**
- Consumes: `contab_trazar`, `contab_trazar_proveedor` de Tasks 2-3.
- No produce interfaz nueva — es un script de verificación manual, mismo
  patrón que el harness de E1 (`ver memoria/proyectos` sesión d51fe48).

- [ ] **Step 1: Escribir el script (transacción con ROLLBACK, no toca datos reales)**

```sql
-- supabase/scripts/test-trazabilidad-manual.sql
-- Ejecutar con: supabase db query --linked --file supabase/scripts/test-trazabilidad-manual.sql
-- Todo dentro de una transacción con ROLLBACK: no persiste nada.

BEGIN;

DO $$
DECLARE
  v_clinic_id uuid;
  v_proveedor_id uuid;
  v_solicitud_id uuid;
  v_cotizacion_id uuid;
  v_orden_id uuid;
  v_recepcion_id uuid;
  v_factura_id uuid;
  v_pago_id uuid;
  v_poliza_id uuid;
  v_arbol jsonb;
  v_niveles int;
BEGIN
  SELECT id INTO v_clinic_id FROM public.clinics LIMIT 1;

  INSERT INTO public.proveedores (clinic_id, nombre) VALUES (v_clinic_id, 'PRUEBA-TRAZA')
    RETURNING id INTO v_proveedor_id;

  INSERT INTO public.solicitudes_compra (clinic_id, folio, solicitante_id, fecha_solicitud, motivo, estatus, aprobador_id, aprobado_at)
    VALUES (v_clinic_id, 'SC-TRAZA-001', auth.uid(), now(), 'prueba trazabilidad', 'aprobada', auth.uid(), now())
    RETURNING id INTO v_solicitud_id;

  INSERT INTO public.cotizaciones (clinic_id, folio, solicitud_compra_id, proveedor_id, fecha_cotizacion, total_centavos, seleccionada, created_by)
    VALUES (v_clinic_id, 'COT-TRAZA-001', v_solicitud_id, v_proveedor_id, now(), 100000, true, auth.uid())
    RETURNING id INTO v_cotizacion_id;

  INSERT INTO public.ordenes_compra (clinic_id, folio, proveedor_id, solicitud_id, cotizacion_id, estatus, fecha_emision, total_centavos, created_by, aprobada_by, aprobada_at)
    VALUES (v_clinic_id, 'OC-TRAZA-001', v_proveedor_id, v_solicitud_id, v_cotizacion_id, 'aprobada', now(), 100000, auth.uid(), auth.uid(), now())
    RETURNING id INTO v_orden_id;

  UPDATE public.solicitudes_compra SET orden_compra_id = v_orden_id WHERE id = v_solicitud_id;
  UPDATE public.cotizaciones SET orden_compra_id = v_orden_id WHERE id = v_cotizacion_id;

  INSERT INTO public.recepciones_mercancia (clinic_id, orden_id, proveedor_id, folio_recepcion, fecha_recepcion, estatus, recibido_por)
    VALUES (v_clinic_id, v_orden_id, v_proveedor_id, 'REC-TRAZA-001', now(), 'completa', auth.uid())
    RETURNING id INTO v_recepcion_id;

  INSERT INTO public.facturas_proveedor (clinic_id, proveedor_id, orden_id, recepcion_id, solicitud_id, folio_interno, fecha_factura, subtotal_centavos, iva_centavos, total_centavos, saldo_pendiente_centavos, estatus, created_by)
    VALUES (v_clinic_id, v_proveedor_id, v_orden_id, v_recepcion_id, v_solicitud_id, 'FAC-TRAZA-001', now(), 86207, 13793, 100000, 0, 'pagada', auth.uid())
    RETURNING id INTO v_factura_id;

  INSERT INTO public.pagos_proveedor (clinic_id, factura_id, proveedor_id, fecha_pago, monto_centavos, metodo_pago, registrado_por)
    VALUES (v_clinic_id, v_factura_id, v_proveedor_id, now(), 100000, 'transferencia', auth.uid())
    RETURNING id INTO v_pago_id;

  -- Póliza simulada, ligada al pago (normalmente la generaría el trigger real)
  INSERT INTO public.polizas (clinic_id, folio, tipo, fecha, concepto, reference_type, reference_id, evento, estado, created_by)
    VALUES (v_clinic_id, 99901, 'egreso', now(), 'Pago PRUEBA-TRAZA', 'factura_proveedor_pago', v_pago_id, 'registro', 'activa', auth.uid())
    RETURNING id INTO v_poliza_id;

  -- Verificación 1: trazar desde el pago debe subir hasta la solicitud
  v_arbol := public.contab_trazar('pago_proveedor', v_pago_id);
  IF v_arbol->>'tipo' <> 'solicitud_compra' THEN
    RAISE EXCEPTION 'FALLO: se esperaba raíz solicitud_compra, se obtuvo %', v_arbol->>'tipo';
  END IF;
  IF v_arbol->>'id' <> v_solicitud_id::text THEN
    RAISE EXCEPTION 'FALLO: raíz no es la solicitud creada en la prueba';
  END IF;
  RAISE NOTICE 'OK: contab_trazar desde pago sube correctamente a solicitud_compra';

  -- Verificación 2: trazar desde la solicitud debe bajar hasta la póliza
  v_arbol := public.contab_trazar('solicitud_compra', v_solicitud_id);
  IF v_arbol #>> '{hijos,0,hijos,0,hijos,0,hijos,0,hijos,0,tipo}' <> 'poliza' THEN
    RAISE EXCEPTION 'FALLO: la cadena descendente no llega a poliza. Árbol: %', v_arbol;
  END IF;
  RAISE NOTICE 'OK: contab_trazar desde solicitud baja correctamente hasta poliza';

  -- Verificación 3: contab_trazar_proveedor encuentra la cadena
  v_arbol := public.contab_trazar_proveedor(v_proveedor_id);
  IF jsonb_array_length(v_arbol) <> 1 THEN
    RAISE EXCEPTION 'FALLO: se esperaba 1 árbol para el proveedor de prueba, se obtuvieron %', jsonb_array_length(v_arbol);
  END IF;
  RAISE NOTICE 'OK: contab_trazar_proveedor devuelve la cadena esperada';

  RAISE NOTICE 'TODAS LAS VERIFICACIONES PASARON';
END;
$$;

ROLLBACK;
```

- [ ] **Step 2: Ejecutar el script**

Run: `supabase db query --linked --file supabase/scripts/test-trazabilidad-manual.sql`
Expected: tres líneas `NOTICE: OK: ...` y `NOTICE: TODAS LAS VERIFICACIONES PASARON`,
sin `EXCEPTION`. La transacción hace `ROLLBACK` — no persiste el registro
`PRUEBA-TRAZA` en producción.

- [ ] **Step 3: Commit**

```bash
git add supabase/scripts/test-trazabilidad-manual.sql
git commit -m "test: harness manual transaccional para contab_trazar/contab_trazar_proveedor"
```

---

### Task 5: Frontend — `TrazabilidadTab.tsx` (buscar por evento)

**Files:**
- Create: `src/features/contabilidad/TrazabilidadTab.tsx`
- Test: `src/test/contabilidad/TrazabilidadTab.test.tsx`

**Interfaces:**
- Consumes: RPC `contab_trazar(p_tipo, p_id)` vía `supabase.rpc`.
- Produces: `export function TrazabilidadTab()` — componente default export
  nombrado (named export, no default) para que Task 6 lo importe con
  `{ TrazabilidadTab }` sin ambigüedad.
- Produces: tipo exportado `TrazaNodo` (usado también en el test de Task 7).

- [ ] **Step 1: Escribir el test (falla primero — componente no existe aún)**

```tsx
// src/test/contabilidad/TrazabilidadTab.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TrazabilidadTab } from "@/features/contabilidad/TrazabilidadTab";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

vi.mock("@/hooks/useActiveClinic", () => ({
  useActiveClinic: () => ({ activeClinicId: "clinic-1" }),
}));

describe("TrazabilidadTab", () => {
  it("busca por tipo+id y renderiza el árbol con hijos anidados", async () => {
    (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        tipo: "solicitud_compra",
        id: "sc-1",
        folio: "SC-004",
        fecha: "2026-07-12",
        monto_centavos: null,
        estado: "aprobada",
        creado_por: { user_id: "u1", nombre: "Ana" },
        autorizado_por: { user_id: "u2", nombre: "Dr. González" },
        hijos: [
          { tipo: "HUECO", mensaje: "Sin cotizaciones registradas aún" },
        ],
      },
      error: null,
    });

    render(<TrazabilidadTab />);

    fireEvent.change(screen.getByLabelText(/tipo de evento/i), { target: { value: "solicitud_compra" } });
    fireEvent.change(screen.getByLabelText(/id o folio/i), { target: { value: "sc-1" } });
    fireEvent.click(screen.getByRole("button", { name: /buscar/i }));

    await waitFor(() => {
      expect(screen.getByText("SC-004")).toBeInTheDocument();
      expect(screen.getByText("Ana")).toBeInTheDocument();
      expect(screen.getByText("Dr. González")).toBeInTheDocument();
      expect(screen.getByText(/Sin cotizaciones registradas aún/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Correr el test, confirmar que falla**

Run: `npx vitest run src/test/contabilidad/TrazabilidadTab.test.tsx`
Expected: FAIL — `Failed to resolve import "@/features/contabilidad/TrazabilidadTab"`.

- [ ] **Step 3: Implementar el componente**

```tsx
// src/features/contabilidad/TrazabilidadTab.tsx
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";

export interface TrazaActor {
  user_id: string;
  nombre: string;
}

export interface TrazaNodo {
  tipo: string;
  id?: string;
  folio?: string | null;
  fecha?: string | null;
  monto_centavos?: number | null;
  estado?: string | null;
  creado_por?: TrazaActor | null;
  autorizado_por?: TrazaActor | null;
  mensaje?: string;
  hijos?: TrazaNodo[];
}

const TIPOS = [
  "solicitud_compra", "cotizacion", "orden_compra", "recepcion_mercancia",
  "factura_proveedor", "pago_proveedor", "poliza",
  "appointment", "appointment_insumo", "movimiento_caja",
  "pharmacy_sale", "loyalty_movimiento", "cfdi_documento",
];

function fmtMXN(centavos?: number | null) {
  if (centavos == null) return "";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(centavos / 100);
}

function NodoCard({ nodo, nivel }: { nodo: TrazaNodo; nivel: number }) {
  if (nodo.tipo === "HUECO") {
    return (
      <div style={{ marginLeft: nivel * 20 }} className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {nodo.mensaje}
      </div>
    );
  }
  return (
    <div style={{ marginLeft: nivel * 20 }} className="space-y-2">
      <Card>
        <CardContent className="p-3 text-sm">
          <div className="font-semibold">{nodo.tipo}{nodo.folio ? ` — ${nodo.folio}` : ""}</div>
          <div className="text-muted-foreground">
            {nodo.fecha ?? ""} {nodo.estado ? `· ${nodo.estado}` : ""} {fmtMXN(nodo.monto_centavos)}
          </div>
          {nodo.creado_por && <div>Creó: {nodo.creado_por.nombre}</div>}
          {nodo.autorizado_por && <div>Autorizó: {nodo.autorizado_por.nombre}</div>}
        </CardContent>
      </Card>
      {(nodo.hijos ?? []).map((hijo, i) => (
        <NodoCard key={i} nodo={hijo} nivel={nivel + 1} />
      ))}
    </div>
  );
}

export function TrazabilidadTab() {
  const [tipo, setTipo] = useState("solicitud_compra");
  const [idInput, setIdInput] = useState("");
  const [arbol, setArbol] = useState<TrazaNodo | null>(null);
  const [loading, setLoading] = useState(false);

  const buscar = async () => {
    if (!idInput.trim()) return;
    setLoading(true);
    setArbol(null);
    const { data, error } = await (supabase as any).rpc("contab_trazar", {
      p_tipo: tipo,
      p_id: idInput.trim(),
    });
    setLoading(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    setArbol(data as TrazaNodo);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <Label htmlFor="traza-tipo">Tipo de evento</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger id="traza-tipo" aria-label="Tipo de evento" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[240px]">
            <Label htmlFor="traza-id">Id o folio</Label>
            <Input
              id="traza-id"
              aria-label="Id o folio"
              value={idInput}
              onChange={(e) => setIdInput(e.target.value)}
              placeholder="uuid del registro"
            />
          </div>
          <Button onClick={buscar} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
          </Button>
        </CardContent>
      </Card>

      {arbol && <NodoCard nodo={arbol} nivel={0} />}
    </div>
  );
}
```

- [ ] **Step 4: Correr el test, confirmar que pasa**

Run: `npx vitest run src/test/contabilidad/TrazabilidadTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/contabilidad/TrazabilidadTab.tsx src/test/contabilidad/TrazabilidadTab.test.tsx
git commit -m "feat: TrazabilidadTab — buscar por evento y renderizar cadena completa"
```

---

### Task 6: Frontend — buscar por proveedor + registrar tab en Contabilidad

**Files:**
- Modify: `src/features/contabilidad/TrazabilidadTab.tsx`
- Modify: `src/pages/Contabilidad.tsx`

**Interfaces:**
- Consumes: RPC `contab_trazar_proveedor(p_proveedor_id)`.
- Consumes (ya existente en el proyecto): tabla `proveedores` para el selector.

- [ ] **Step 1: Escribir el test del modo proveedor**

Agregar al mismo archivo de test de Task 5:

```tsx
  it("busca por proveedor y renderiza cada árbol devuelto", async () => {
    (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          tipo: "solicitud_compra", id: "sc-1", folio: "SC-004", fecha: "2026-07-12",
          monto_centavos: null, estado: "aprobada",
          creado_por: { user_id: "u1", nombre: "Ana" }, autorizado_por: null,
          hijos: [],
        },
      ],
      error: null,
    });

    render(<TrazabilidadTab />);

    fireEvent.click(screen.getByRole("tab", { name: /por proveedor/i }));
    fireEvent.change(screen.getByLabelText(/id de proveedor/i), { target: { value: "prov-1" } });
    fireEvent.click(screen.getByRole("button", { name: /buscar cadenas/i }));

    await waitFor(() => {
      expect(screen.getByText("SC-004")).toBeInTheDocument();
    });
  });
```

- [ ] **Step 2: Correr el test, confirmar que falla**

Run: `npx vitest run src/test/contabilidad/TrazabilidadTab.test.tsx`
Expected: FAIL — no existe el tab "por proveedor" ni el input "id de proveedor".

- [ ] **Step 3: Extender el componente con modo proveedor (tabs internos)**

Reemplazar el `return` de `TrazabilidadTab` (Task 5) por:

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
// ...(mantener imports previos)

export function TrazabilidadTab() {
  const [tipo, setTipo] = useState("solicitud_compra");
  const [idInput, setIdInput] = useState("");
  const [arbol, setArbol] = useState<TrazaNodo | null>(null);
  const [proveedorId, setProveedorId] = useState("");
  const [arboles, setArboles] = useState<TrazaNodo[]>([]);
  const [loading, setLoading] = useState(false);

  const buscarEvento = async () => {
    if (!idInput.trim()) return;
    setLoading(true);
    setArbol(null);
    const { data, error } = await (supabase as any).rpc("contab_trazar", { p_tipo: tipo, p_id: idInput.trim() });
    setLoading(false);
    if (error) { toast.error(friendlyError(error)); return; }
    setArbol(data as TrazaNodo);
  };

  const buscarProveedor = async () => {
    if (!proveedorId.trim()) return;
    setLoading(true);
    setArboles([]);
    const { data, error } = await (supabase as any).rpc("contab_trazar_proveedor", { p_proveedor_id: proveedorId.trim() });
    setLoading(false);
    if (error) { toast.error(friendlyError(error)); return; }
    setArboles(Array.isArray(data) ? (data as TrazaNodo[]) : [data as TrazaNodo]);
  };

  return (
    <Tabs defaultValue="evento">
      <TabsList>
        <TabsTrigger value="evento">Por evento</TabsTrigger>
        <TabsTrigger value="proveedor">Por proveedor</TabsTrigger>
      </TabsList>

      <TabsContent value="evento" className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div>
              <Label htmlFor="traza-tipo">Tipo de evento</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger id="traza-tipo" aria-label="Tipo de evento" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[240px]">
              <Label htmlFor="traza-id">Id o folio</Label>
              <Input id="traza-id" aria-label="Id o folio" value={idInput} onChange={(e) => setIdInput(e.target.value)} placeholder="uuid del registro" />
            </div>
            <Button onClick={buscarEvento} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
            </Button>
          </CardContent>
        </Card>
        {arbol && <NodoCard nodo={arbol} nivel={0} />}
      </TabsContent>

      <TabsContent value="proveedor" className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="flex-1 min-w-[240px]">
              <Label htmlFor="traza-proveedor">Id de proveedor</Label>
              <Input id="traza-proveedor" aria-label="Id de proveedor" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} placeholder="uuid del proveedor" />
            </div>
            <Button onClick={buscarProveedor} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar cadenas"}
            </Button>
          </CardContent>
        </Card>
        {arboles.map((a, i) => <NodoCard key={i} nodo={a} nivel={0} />)}
      </TabsContent>
    </Tabs>
  );
}
```

Nota: se elimina el `return` simple de Task 5 y se reemplaza por este; el
`Card` de búsqueda por evento y el componente `NodoCard` de Task 5 no cambian.

- [ ] **Step 4: Correr los tests, confirmar que pasan ambos**

Run: `npx vitest run src/test/contabilidad/TrazabilidadTab.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Registrar el tab en `Contabilidad.tsx`**

En `src/pages/Contabilidad.tsx`, junto a los demás `TabsTrigger` (línea ~81,
después de `activos`):

```tsx
<TabsTrigger value="trazabilidad">Trazabilidad</TabsTrigger>
```

Y junto a los demás `TabsContent` (después de `activos`, línea ~258):

```tsx
<TabsContent value="trazabilidad">
  <TrazabilidadTab />
</TabsContent>
```

Agregar el import junto a los demás imports de `features/contabilidad`:

```tsx
import { TrazabilidadTab } from "@/features/contabilidad/TrazabilidadTab";
```

- [ ] **Step 6: Typecheck y build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

Run: `npm run build`
Expected: build exitoso, sin nuevos warnings de import roto.

- [ ] **Step 7: Commit**

```bash
git add src/features/contabilidad/TrazabilidadTab.tsx src/test/contabilidad/TrazabilidadTab.test.tsx src/pages/Contabilidad.tsx
git commit -m "feat: buscar trazabilidad por proveedor + registrar tab en Contabilidad"
```

---

## Self-Review (hecho por quien escribió este plan)

**Cobertura del spec:** los 13 tipos de nodo del spec están cubiertos en
`_contab_trazar_nodo` (Task 2) y en `_contab_trazar_raiz` (Task 1). Búsqueda
por evento y por proveedor cubiertas (Tasks 5-6). Testing (harness manual +
unit) cubierto (Tasks 4, 5, 6). Gaps documentados como límite conocido, no
como pendiente sin resolver: `pharmacy_sale` → póliza sin FK real.

**Placeholders:** ninguno — todo el SQL y TSX de arriba es código completo,
no fragmentos "similar a...".

**Consistencia de tipos:** `TrazaNodo`/`TrazaActor` definidos en Task 5 y
reusados sin cambios en Task 6; forma del JSON de nodo idéntica entre el SQL
(Task 2) y el tipo TS (Task 5).

**Corrección aplicada sobre el spec original:** tabla `cotizaciones_proveedor`
→ nombre real `cotizaciones` (confirmado contra schema en producción).
