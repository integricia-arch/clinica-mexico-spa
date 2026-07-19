# Módulo Contable — Memoria Técnica (Fases 1-8, cierre 2026-07-19)

Fecha: 2026-07-19 | Estado: Producción, módulo CERRADO (fase 10) | Migraciones: `20260718150000` a `20260719160000`

Fase 9 (IVA) queda pospuesta — requiere decisión de negocio (régimen fiscal, tasas, RESICO vs general). Fases 1-8 son la base de devengo simple (sin partida doble) MÁS un sistema de partida doble en paralelo (pólizas) para reportes formales. Ver sección 9 para cómo se relacionan ambos.

## 1. Arquitectura de Datos

```
appointment_insumos
  ├─ id (PK)
  ├─ appointment_id → appointments(id)
  ├─ insumo_id → insumos(id)
  ├─ clinic_id → clinics(id)
  ├─ tipo: 'consumo' | 'reversa' [CHECK]
  ├─ cantidad: int > 0
  ├─ costo_unitario_centavos: int > 0 [SNAPSHOT al consumo]
  ├─ user_id: auth.uid()
  └─ created_at: timestamptz DEFAULT now()
  Índices: (appointment_id), (clinic_id, created_at)
  RLS: SELECT solo miembros clínica; INSERT/UPDATE/DELETE: negado (solo RPCs)

doctor_honorarios_config
  ├─ id (PK)
  ├─ doctor_id → doctors(id)
  ├─ clinic_id → clinics(id)
  ├─ tipo: 'porcentaje' | 'fijo_por_consulta' [CHECK]
  ├─ valor: numeric(12,2) [CHECK: 0<x≤100 si %, >0 si fijo]
  ├─ vigente_desde: date DEFAULT current_date
  ├─ created_at: timestamptz
  ├─ created_by: auth.uid()
  └─ UNIQUE (doctor_id, clinic_id, vigente_desde)
  Índice: (doctor_id, clinic_id, vigente_desde DESC)
  RLS: SELECT miembros; INSERT admin/manager
  Diseño: append-only histórico (NO UPDATE/DELETE del cliente)

cuentas_contables
  ├─ id (PK)
  ├─ codigo: text UNIQUE
  ├─ nombre: text
  ├─ tipo: 'ingreso' | 'egreso' [CHECK]
  ├─ es_fijo: boolean (marca gastos fijos para punto equilibrio)
  ├─ codigo_sat: text (SAT Anexo 24, NO implementado)
  ├─ activo: boolean
  └─ created_at: timestamptz
  Catálogo semilla (9 cuentas):
    • ING_CONSULTAS, ING_FARMACIA, ING_OTROS (ingresos)
    • EGR_COMPRAS, EGR_HONORARIOS, EGR_RENTA, EGR_NOMINA, EGR_SERVICIOS, EGR_OTROS (egresos)
  RLS: SELECT USING(true) — tabla global pública
  
movimientos_contables [Append-only, base de devengo]
  ├─ id (PK)
  ├─ clinic_id → clinics(id) [multi-tenant]
  ├─ cuenta_id → cuentas_contables(id)
  ├─ origen: 'manual' | 'consulta' | 'farmacia' | 'compra' | 'honorario' [CHECK]
  ├─ monto_centavos: bigint ≠ 0 [negativo = contramovimiento]
  ├─ fecha_devengo: date [SIEMPRE presente]
  ├─ fecha_pago: date [NULL = no cobrado/pagado]
  ├─ evento: 'devengo' | 'cancelacion' [CHECK]
  ├─ reference_type: 'movimiento_caja' | 'pharmacy_sale' | 'factura_proveedor' | 'honorario_appointment'
  ├─ reference_id: uuid [vinculo a tabla origen]
  ├─ descripcion: text
  ├─ created_by: auth.uid()
  └─ created_at: timestamptz
  Índices: (clinic_id, fecha_devengo), (clinic_id, fecha_pago WHERE fecha_pago IS NOT NULL)
  Idempotencia: UNIQUE (reference_type, reference_id, evento) WHERE reference_id IS NOT NULL
  RLS: SELECT miembros; INSERT solo admin/manager (origen='manual')
  Triggers: contab_movimiento_caja, contab_pharmacy_sale, contab_factura_proveedor
  
doctor_honorarios_detalle [Vista, grano cita]
  Campos: appointment_id, doctor_id, patient_id, clinic_id, fecha, servicio_id,
           precio_servicio_centavos, config_tipo, config_valor, config_vigente_desde,
           honorario_centavos
  Filtros cita: status NOT IN ('cancelada','liberada','solicitada','tentativa') 
               AND fecha_fin < now()
               AND doctor_id IS NOT NULL
  Agregable por: paciente, doctor, día
  Política de config: LATERAL JOIN a vigente_desde ≤ fecha_cita (última config activa)
  Sin config: 100% del precio (regla histórica actual)
  
pnl_mensual(p_clinic_id, p_desde, p_hasta) [Función SECURITY DEFINER]
  Retorna: mes, ingresos_centavos, costo_ventas_centavos, utilidad_bruta_centavos,
           gastos_operativos_centavos, utilidad_neta_centavos, margen_bruto_pct, margen_neto_pct
  
flujo_efectivo(p_clinic_id, p_desde, p_hasta) [Función SECURITY DEFINER]
  Retorna: mes, cobros_centavos, pagos_centavos, flujo_neto_centavos
  
kpis_dashboard(p_clinic_id, p_desde, p_hasta) [Función SECURITY DEFINER]
  Retorna: 11 KPIs (ver sección 2)

RPC auxiliares:
  • registrar_insumos_cita(p_appointment_id, p_items: jsonb) → int
    Inserta appointment_insumos + descuenta stock atómicamente
  • revertir_insumos_cita(p_appointment_id) → int
    Reversa idempotente (CHECK: si existe 'reversa' → RETURN 0)
  • contab_devengar_honorarios() → int [Cron 8:30 UTC diario]
    Inserta devengo de honorarios hasta ayer (self-healing)
```

## 2. Fórmulas Exactas de KPIs y Columnas

### 2.1 P&L Mensual (`pnl_mensual`)

```sql
-- Base de datos
ingresos_centavos = SUM(mc.monto_centavos)
  FROM movimientos_contables mc
  WHERE mc.clinic_id = p_clinic_id
    AND cc.tipo = 'ingreso'
    AND mc.fecha_devengo BETWEEN p_desde AND p_hasta
  GROUP BY mes

costo_ventas_centavos = SUM(CASE 
    WHEN ai.tipo = 'consumo' THEN ai.costo_unitario_centavos * ai.cantidad
    ELSE -ai.costo_unitario_centavos * ai.cantidad
  END)
  FROM appointment_insumos ai
  WHERE ai.clinic_id = p_clinic_id
    AND ai.created_at::date BETWEEN p_desde AND p_hasta
  GROUP BY mes
  
utilidad_bruta_centavos = ingresos_centavos - costo_ventas_centavos

gastos_operativos_centavos = SUM(mc.monto_centavos)
  FROM movimientos_contables mc
  WHERE mc.clinic_id = p_clinic_id
    AND cc.tipo = 'egreso' 
    AND cc.codigo ≠ 'EGR_COMPRAS'  ← EXCLUYE compras proveedores
    AND mc.fecha_devengo BETWEEN p_desde AND p_hasta
  GROUP BY mes
  INCLUYE: honorarios + gastos fijos (renta, nómina, servicios) + manuales

utilidad_neta_centavos = utilidad_bruta_centavos - gastos_operativos_centavos

margen_bruto_pct = CASE
    WHEN ingresos_centavos = 0 THEN NULL
    ELSE ROUND((utilidad_bruta_centavos::numeric / ingresos_centavos * 100), 2)
  END

margen_neto_pct = CASE
    WHEN ingresos_centavos = 0 THEN NULL
    ELSE ROUND((utilidad_neta_centavos::numeric / ingresos_centavos * 100), 2)
  END
```

**Tratamiento de reversas/cancelaciones:**
- `appointment_insumos.tipo='reversa'` descuenta el costo (inserción de rows negativas)
- `movimientos_contables.evento='cancelacion'` (monto_centavos negativo)
- Ambas via `CASE WHEN tipo='consumo'` o `WHEN evento='devengo'` suman; else restan

### 2.2 Flujo de Efectivo (`flujo_efectivo`)

```sql
cobros_centavos = SUM(mc.monto_centavos)
  FROM movimientos_contables mc
  WHERE mc.clinic_id = p_clinic_id
    AND cc.tipo = 'ingreso'
    AND mc.fecha_pago BETWEEN p_desde AND p_hasta  ← USA fecha_pago NO devengo
  GROUP BY mes

pagos_centavos = SUM(mc.monto_centavos)
  FROM movimientos_contables mc
  WHERE mc.clinic_id = p_clinic_id
    AND cc.tipo = 'egreso'
    AND mc.fecha_pago BETWEEN p_desde AND p_hasta
  GROUP BY mes

flujo_neto_centavos = cobros_centavos - pagos_centavos
```

**Nota:** `fecha_pago` es NULL para:
- Movimientos devengados pero NO cobrados/pagados (CxC, CxP)
- Honorarios (se devengan, fecha_pago permanece NULL; cobro real = cobro caja)

### 2.3 KPIs Dashboard (`kpis_dashboard`)

```sql
-- 1. Ingresos totales (período)
ingresos_totales_centavos = SUM(mc.monto_centavos)
  FROM movimientos_contables mc
  WHERE mc.clinic_id = p_clinic_id
    AND cc.tipo = 'ingreso'
    AND mc.fecha_devengo BETWEEN p_desde AND p_hasta

-- 2. Utilidad bruta (período)
utilidad_bruta_centavos = ingresos_totales_centavos - costo_ventas
  (mismo cálculo que pnl_mensual, SUM de todos meses)

-- 3. Margen bruto % (período)
margen_bruto_pct = CASE
    WHEN ingresos_totales_centavos = 0 THEN NULL
    ELSE ROUND(utilidad_bruta_centavos::numeric / ingresos_totales_centavos * 100, 2)
  END

-- 4. Utilidad neta (período)
utilidad_neta_centavos = utilidad_bruta_centavos - gastos_operativos_centavos

-- 5. Margen neto % (período)
margen_neto_pct = CASE
    WHEN ingresos_totales_centavos = 0 THEN NULL
    ELSE ROUND(utilidad_neta_centavos::numeric / ingresos_totales_centavos * 100, 2)
  END

-- 6. Flujo operativo neto (período, base fecha_pago)
flujo_operativo_centavos = cobros_totales - pagos_totales
  WHERE mc.fecha_pago BETWEEN p_desde AND p_hasta

-- 7. Punto de equilibrio (período)
punto_equilibrio_centavos = CASE
    WHEN margen_bruto_pct IS NULL OR margen_bruto_pct ≤ 0 THEN NULL
    ELSE ROUND(gastos_fijos::numeric / (margen_bruto_pct / 100))::bigint
  END
  gastos_fijos = SUM(mc.monto_centavos)
    WHERE mc.clinic_id = p_clinic_id
      AND cc.tipo = 'egreso'
      AND cc.es_fijo = true
      AND mc.fecha_devengo BETWEEN p_desde AND p_hasta

-- 8. CxP vencidas (SNAPSHOT hoy, NO acotado a período)
cxp_vencidas_centavos = SUM(fp.saldo_pendiente_centavos)
  FROM facturas_proveedor fp
  WHERE fp.clinic_id = p_clinic_id
    AND fp.saldo_pendiente_centavos > 0
    AND fp.fecha_vencimiento < current_date  ← Vencidas hoy

-- 9. CxC pendientes (SNAPSHOT hoy, NO acotado a período)
cxc_pendientes_centavos = (
    SELECT SUM(ROUND(ps.total * 100))
    FROM pharmacy_sales ps
    WHERE ps.clinic_id = p_clinic_id
      AND ps.payment_status = 'pending'
      AND ps.status ≠ 'cancelled'
  ) + (
    SELECT SUM(ROUND(m.total * 100))
    FROM movimientos m
    WHERE m.clinic_id = p_clinic_id
      AND m.estado IN ('parcial', 'borrador')
      AND m.total > 0
  )

-- 10. Costo insumos promedio por cita (período)
costo_insumos_por_cita_centavos = CASE
    WHEN v_citas_con_consumo = 0 THEN NULL
    ELSE ROUND(v_costo_insumos_neto::numeric / v_citas_con_consumo)::bigint
  END
  v_costo_insumos_neto = SUM(CASE 
      WHEN ai.tipo = 'consumo' THEN ai.costo_unitario_centavos * ai.cantidad
      ELSE -ai.costo_unitario_centavos * ai.cantidad
    END)
  v_citas_con_consumo = COUNT(DISTINCT ai.appointment_id) 
    FILTER (WHERE ai.tipo = 'consumo')

-- 11. Ingreso promedio por consulta (período)
ingreso_promedio_consulta_centavos = CASE
    WHEN v_citas_atendidas = 0 THEN NULL
    ELSE ROUND(v_ingresos_consulta::numeric / v_citas_atendidas)::bigint
  END
  v_ingresos_consulta = SUM(mc.monto_centavos)
    FROM movimientos_contables mc
    WHERE mc.clinic_id = p_clinic_id
      AND cc.codigo = 'ING_CONSULTAS'
      AND mc.fecha_devengo BETWEEN p_desde AND p_hasta
  v_citas_atendidas = COUNT(DISTINCT m.appointment_id)
    FROM movimientos_contables mc
    JOIN movimientos m ON m.id = mc.reference_id
      AND mc.reference_type = 'movimiento_caja'
    WHERE mc.clinic_id = p_clinic_id
      AND m.appointment_id IS NOT NULL
      AND mc.fecha_devengo BETWEEN p_desde AND p_hasta
```

## 3. Reglas de Devengo vs Flujo de Efectivo

| Evento | fecha_devengo | fecha_pago | Trigger/Cron | Ejemplos |
|--------|---------------|------------|--------------|----------|
| **Cobro caja** | creación de `movimientos` | Cuando se pagó (misma fecha, DDL reciente) | `contab_movimiento_caja()` AFTER INSERT/UPDATE ON movimientos WHERE estado='pagado' | Cobro de consulta, ingreso genérico |
| **Venta farmacia** | creación de `pharmacy_sales` | Mismo día (asume pago al contado) | `contab_pharmacy_sale()` AFTER INSERT ON pharmacy_sales | Venta OTC, sin crédito |
| **Factura proveedor** | fecha_factura (O created_at si NULL) | Cuando saldo=0 (UPDATE dispara) | `contab_factura_proveedor()` AFTER INSERT + UPDATE ON facturas_proveedor | Compra a proveedor (CxP) |
| **Honorario médico** | Fecha de cita (via `doctor_honorarios_detalle`) | NULL (nunca se cobra directo; cobro es via caja) | Cron `contab_devengar_honorarios()` 8:30 UTC diario | Devengo de gasto médico |
| **Egresos manuales** | Capturado por usuario | Null o capturado | INSERT manual vía RLS | Gastos ad-hoc |

**Regla de devengo vs pagos:**
- `fecha_devengo`: Cuándo ocurrió el evento económico (venta, gasto)
- `fecha_pago`: Cuándo se efectúa la transacción de dinero
- `flujo_efectivo` filtra por `fecha_pago` (dinero real)
- `pnl_mensual` filtra por `fecha_devengo` (accrual accounting)
- Para reconciliación: diferencia `pnl_mensual - flujo_efectivo` = cambios en CxC/CxP

## 4. Snapshot de Costos

### 4.1 Insumos Clínicos (`appointment_insumos`)

```sql
INSERT INTO public.appointment_insumos
  (appointment_id, insumo_id, clinic_id, tipo, cantidad, 
   costo_unitario_centavos, user_id)
VALUES
  (..., ..., ..., 'consumo', cantidad_solicitada, 
   SNAPSHOT_DEL_INSUMO.costo_centavos, auth.uid());
```

- **Cuándo se captura:** Durante `registrar_insumos_cita()` (RPC SECURITY DEFINER)
- **Formato:** Centavos (int > 0), congelado al momento del consumo
- **Dónde se obtiene:** `insumos.costo_centavos` (columna en tabla `insumos`)
- **Reversabilidad:** `tipo='reversa'` reinvierte el costo (cantidad > 0, pero se suma negativamente vía CASE)
- **Stock:** Descuento/restauro atómico en la misma RPC via `UPDATE insumos SET stock = stock ± cantidad`

### 4.2 Honorarios Médicos (`doctor_honorarios_config`, `doctor_honorarios_detalle`)

```sql
-- Configuración histórica (vigencias)
INSERT INTO doctor_honorarios_config
  (doctor_id, clinic_id, tipo, valor, vigente_desde, created_by)
VALUES
  (doctor_uuid, clinic_uuid, 'porcentaje', 75.00, '2026-07-18'::date, auth.uid());
  -- O: tipo='fijo_por_consulta', valor=50000 (centavos = 500 MXN fijos)

-- Devengo dinámico: LATERAL JOIN a config vigente a fecha_cita
SELECT ...
  CASE
    WHEN cfg.tipo = 'porcentaje'
      THEN ROUND(s.precio_centavos * cfg.valor / 100)::bigint
    WHEN cfg.tipo = 'fijo_por_consulta'
      THEN cfg.valor::bigint
    ELSE s.precio_centavos  -- Sin config: 100%
  END AS honorario_centavos
```

- **Historial:** `doctor_honorarios_config` es append-only; cambios = nueva fila con `vigente_desde`
- **Política:** Siempre usa la última config activa a `fecha_cita` (ORDER BY vigente_desde DESC LIMIT 1)
- **Sin config:** Defecto 100% del precio del servicio (regla histórica)
- **Devengo:** Cron `contab_devengar_honorarios()` 8:30 UTC inserta diario hasta ayer

## 5. Limitaciones Conocidas y Deudas

### 5.1 Costo de Medicamentos Farmacia (Fase posterior)

**Problema:** `pnl_mensual.costo_ventas_centavos` incluye SOLO insumos de citas (`appointment_insumos`).
El costo de medicamentos vendidos en farmacia (`pharmacy_sales`) NO se resta.

**Razón:** `pharmacy_sales` no guarda costo unitario snapshot limpiamente vinculado a `movimientos_inventario`.
`movimientos_inventario` es solo medicamentos (medicamento_id NOT NULL), sin referencia directa a ventas.

**Impacto:** Margen bruto inflado (no resta COGS farmacia). Margen neto correcto (porque honorarios y otros gastos sí están).

**Fix:** Fase 5 — agregar `costo_unitario_centavos` snapshot en `pharmacy_sale_items` y sincronizar con `movimientos_inventario`.

### 5.2 Reversas de Insumos Sin Wireo Contable

**Problema:** `revertir_insumos_cita()` invierte stock pero NO automático — requiere llamada manual.
Si cita se cancela sin llamar RPC, las reversas nunca se crean (inconsistencia stock ≠ movimientos_contables).

**Fix:** Trigger en `appointments` UPDATE status='cancelada' → dispara `revertir_insumos_cita()` automático.

### 5.3 Sin Idempotency-Key en Retry

**Problema:** `registrar_insumos_cita()` inserta directamente sin validar si ya existe.
Red timeout + retry = duplicados en `appointment_insumos`.

**Fix:** Agregar campo `idempotency_key` (UUID) en `appointment_insumos` + UNIQUE constraint.

### 5.4 CxP/CxC Snapshot "Hoy"

**Limitación:** `kpis_dashboard.cxp_vencidas_centavos` y `cxc_pendientes_centavos` no se acotan a `p_desde/p_hasta`.
Usan `current_date` (hoy) — facturas vencidas ayer siguen vencidas hoy.

**Impacto:** Estos KPIs son comparables mes-a-mes pero NO acumulables en un rango arbitrario (son snapshots).

**Diseño intencional:** Los acreededores vencidos "hoy" importan más que en qué mes vencieron.

### 5.5 Punto de Equilibrio con Redondeo

```sql
punto_equilibrio_centavos = ROUND(v_gastos_fijos / (v_margen_bruto_pct / 100))::bigint
```

**Limitación:** Margen bruto redondeado a 2 decimales → punto equilibrio redondeado nuevamente.
Para gastos muy altos o márgenes muy bajos, error acumulado puede ±1-2%.

**Aceptado:** Break-even es indicador, no precisión. Nivel de clínica, no por cita.

## 6. Cómo Auditar un Número

### 6.1 Ejemplo: Verificar Ingresos de Julio 2026

```sql
-- Paso 1: Verificar entrada a kpis_dashboard
SELECT * FROM public.kpis_dashboard(
  '12345678-...clinic_id...', 
  '2026-07-01'::date, 
  '2026-07-31'::date
);
-- Ver ingresos_totales_centavos = X

-- Paso 2: Descender a pnl_mensual por mes
SELECT * FROM public.pnl_mensual(
  '12345678-...clinic_id...', 
  '2026-07-01'::date, 
  '2026-07-31'::date
);
-- Ver ingresos_centavos por mes dentro de julio = X total

-- Paso 3: Verificar origen de movimientos
SELECT 
  cc.codigo, cc.nombre,
  COUNT(*) AS filas,
  SUM(mc.monto_centavos) AS total_centavos,
  MAX(mc.fecha_devengo) AS ultima_fecha
FROM public.movimientos_contables mc
JOIN public.cuentas_contables cc ON cc.id = mc.cuenta_id
WHERE mc.clinic_id = '12345678-...clinic_id...'
  AND cc.tipo = 'ingreso'
  AND mc.fecha_devengo BETWEEN '2026-07-01' AND '2026-07-31'
GROUP BY cc.codigo, cc.nombre
ORDER BY total_centavos DESC;
-- Desglose por cuenta (ING_CONSULTAS, ING_FARMACIA, ING_OTROS)

-- Paso 4: Auditar cobros de caja (origen='consulta')
SELECT 
  mov.id AS movimiento_id,
  mov.reference_id AS caja_id,
  mov.monto_centavos,
  mov.fecha_devengo,
  mov.descripcion,
  m.folio,
  m.total,
  a.appointment_id
FROM public.movimientos_contables mov
JOIN public.movimientos m ON m.id = mov.reference_id 
  AND mov.reference_type = 'movimiento_caja'
WHERE mov.clinic_id = '12345678-...clinic_id...'
  AND mov.origen = 'consulta'
  AND mov.fecha_devengo BETWEEN '2026-07-01' AND '2026-07-31'
ORDER BY mov.created_at;
-- Cada fila = un cobro que disparó el trigger

-- Paso 5: Auditar ventas de farmacia
SELECT 
  mov.id AS movimiento_id,
  mov.reference_id AS pharmacy_sale_id,
  mov.monto_centavos,
  mov.fecha_devengo,
  ps.total,
  ps.payment_status,
  ps.status
FROM public.movimientos_contables mov
JOIN public.pharmacy_sales ps ON ps.id = mov.reference_id
  AND mov.reference_type = 'pharmacy_sale'
WHERE mov.clinic_id = '12345678-...clinic_id...'
  AND mov.fecha_devengo BETWEEN '2026-07-01' AND '2026-07-31'
ORDER BY mov.created_at;

-- Paso 6: Verificar honorarios devengados (cron)
SELECT 
  mov.id AS movimiento_id,
  mov.reference_id AS appointment_id,
  mov.monto_centavos,
  mov.fecha_devengo,
  dhd.fecha,
  dhd.doctor_id,
  dhd.honorario_centavos
FROM public.movimientos_contables mov
JOIN public.doctor_honorarios_detalle dhd ON dhd.appointment_id = mov.reference_id
  AND mov.reference_type = 'honorario_appointment'
WHERE mov.clinic_id = '12345678-...clinic_id...'
  AND mov.fecha_devengo BETWEEN '2026-07-01' AND '2026-07-31'
ORDER BY mov.created_at;

-- Paso 7: Verificar costo de insumos consumidos
SELECT 
  date_trunc('month', ai.created_at)::date AS mes,
  COUNT(*) AS lineas_consumo,
  COUNT(DISTINCT ai.appointment_id) AS citas,
  SUM(CASE WHEN ai.tipo = 'consumo' THEN ai.costo_unitario_centavos * ai.cantidad END) AS costo_total_consumo,
  SUM(CASE WHEN ai.tipo = 'reversa' THEN ai.costo_unitario_centavos * ai.cantidad END) AS costo_total_reversa,
  SUM(CASE 
      WHEN ai.tipo = 'consumo' THEN ai.costo_unitario_centavos * ai.cantidad
      ELSE -ai.costo_unitario_centavos * ai.cantidad
    END) AS costo_neto
FROM public.appointment_insumos ai
WHERE ai.clinic_id = '12345678-...clinic_id...'
  AND ai.created_at::date BETWEEN '2026-07-01' AND '2026-07-31'
GROUP BY mes
ORDER BY mes;
```

### 6.2 Ejemplo: Rastrear una Cita Específica (Ingresos + Egresos + Márgenes)

```sql
-- Dado: appointment_id = 'abc123...'
-- Rastrear flujo completo

-- Ingresos
SELECT * FROM public.doctor_honorarios_detalle WHERE appointment_id = 'abc123...';
-- Precio del servicio, config honorario, honorario_centavos

SELECT * FROM public.movimientos_contables 
WHERE reference_id = 'abc123...' 
  AND reference_type = 'honorario_appointment'
  AND evento = 'devengo';
-- Devengo devengado en movimientos

-- Egresos: insumos consumidos
SELECT 
  ai.id,
  i.nombre,
  ai.cantidad,
  ai.costo_unitario_centavos,
  (ai.costo_unitario_centavos * ai.cantidad) AS costo_total,
  ai.tipo
FROM public.appointment_insumos ai
JOIN public.insumos i ON i.id = ai.insumo_id
WHERE ai.appointment_id = 'abc123...';

-- Margen de esta cita
SELECT 
  (SELECT honorario_centavos FROM doctor_honorarios_detalle WHERE appointment_id = 'abc123...') AS ingreso,
  (SELECT SUM(costo_unitario_centavos * cantidad) 
   FROM appointment_insumos 
   WHERE appointment_id = 'abc123...' AND tipo = 'consumo') AS costo_insumos,
  (SELECT honorario_centavos FROM doctor_honorarios_detalle WHERE appointment_id = 'abc123...')
  - (SELECT SUM(costo_unitario_centavos * cantidad) 
     FROM appointment_insumos 
     WHERE appointment_id = 'abc123...' AND tipo = 'consumo') AS margen_cita;
```

## 7. Seguridad y Políticas RLS

**SECURITY DEFINER + REVOKE FROM PUBLIC:**

```sql
-- Todas las RPCs y triggers
REVOKE EXECUTE ON FUNCTION public.registrar_insumos_cita FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_insumos_cita TO authenticated;

REVOKE EXECUTE ON FUNCTION public.pnl_mensual FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pnl_mensual TO authenticated;

REVOKE EXECUTE ON FUNCTION public.contab_movimiento_caja FROM PUBLIC;  -- trigger
REVOKE EXECUTE ON FUNCTION public.contab_pharmacy_sale FROM PUBLIC;    -- trigger
REVOKE EXECUTE ON FUNCTION public.contab_factura_proveedor FROM PUBLIC; -- trigger

REVOKE EXECUTE ON FUNCTION public.contab_devengar_honorarios FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contab_devengar_honorarios TO service_role;
```

**Controles de acceso por tabla:**

- `appointment_insumos`: RLS SELECT miembros; INSERT/UPDATE/DELETE negado (RPC only)
- `movimientos_contables`: RLS SELECT miembros; INSERT admin/manager (origin='manual')
- `doctor_honorarios_config`: RLS SELECT miembros; INSERT admin/manager
- `cuentas_contables`: USING(true) — tabla pública de catálogo

## 8. Cron y Scheduling

```sql
-- Devengo de honorarios (auto-healing, idempotente)
SELECT cron.schedule('contab-devengar-honorarios', '30 8 * * *',
  $$ SELECT public.contab_devengar_honorarios(); $$);
```

- **Horario:** 8:30 UTC diario (02:30 CDMX)
- **Qué hace:** Inserta honorarios hasta ayer (TODAY - 1)
- **Idempotencia:** UNIQUE(reference_type, reference_id, evento) ON CONFLICT DO NOTHING
- **Healing:** Si falló un día, se rellena en siguientes ejecuciones

## 9. Partida Doble (Fase 6C/7/8) — cómo se relaciona con `movimientos_contables`

`movimientos_contables` (fases 1-4) es devengo de una sola columna: suma/resta por cuenta,
sin balance debe=haber. **No se tocó ni se reemplazó.** En paralelo se construyó un sistema
de partida doble clásico (`polizas`/`poliza_partidas`) para reportes formales (balanza,
libro diario, balance general, estado de resultados con debe/haber). Ambos sistemas
coexisten; `movimientos_contables` sigue siendo la fuente de `kpis_dashboard`/`pnl_mensual`.
`polizas` NO se genera automático desde `movimientos_contables` — son captura manual vía
`crear_poliza()` o desde el dashboard/POS en fases futuras. `contab_auditoria_huecos()`
detecta pólizas sin `reference_type` y movimientos_contables sin póliza asociada, para
cerrar la brecha manualmente.

```
poliza_folios (clinic_id, tipo) → ultimo_folio [SEQUENCE por clínica+tipo]
polizas
  ├─ id, clinic_id, folio, tipo: ingreso|egreso|diario
  ├─ fecha, concepto, uuid_cfdi
  ├─ reference_type, reference_id, evento: registro|cancelacion  [idempotencia]
  ├─ estado: activa|cancelada
  └─ created_by
poliza_partidas
  ├─ poliza_id, orden, cuenta_id → cuentas_contables
  ├─ debe_centavos, haber_centavos  [exactamente uno > 0 por partida]
  └─ descripcion
cuentas_contables — se le agregó `naturaleza: deudora|acreedora` (fase 6C, columna nueva
  sobre el catálogo de fase 1; necesaria para saldo en balanza/balance general)
```

**Reglas de negocio duras (enforced en `crear_poliza()`, SECURITY DEFINER):**
- Mínimo 2 partidas, cada una con debe XOR haber > 0.
- `SUM(debe) = SUM(haber)` o rechaza con `poliza_desbalanceada`.
- Candado de período: rechaza fecha dentro de un mes ya cerrado (`contab_cierres.cerrado_at IS NOT NULL`)
  — `cierre_mensual()` crea su propia póliza de cierre ANTES de marcar cerrado, así no se autobloquea.
- Idempotencia por `(reference_type, reference_id, evento)`: si ya existe, regresa el id existente sin duplicar.
- `cancelar_poliza()` no borra — inserta una póliza reversa (debe/haber invertidos) vinculada por `reference_type='poliza_reversa'`.

**Fase 7 — Cierre mensual:** `cierre_mensual(clinic_id, periodo)` solo admin/manager de esa
clínica, rechaza mes en curso (`periodo_no_terminado`), calcula neto de cuentas
ingreso/egreso del mes, genera póliza que cancela esos saldos contra la cuenta `305`
(Resultados acumulados) y marca `contab_cierres`. Después de cerrado, `crear_poliza()`
bloquea nuevas pólizas con fecha en ese mes.

**Fase 8 — Conciliación bancaria:** `contab_estados_cuenta` (líneas de banco, import CSV vía
`contab_importar_estado_cuenta()`, dedupe por `line_hash` — el hash se calcula en el RPC,
no vía `GENERATED ALWAYS AS`, porque `fecha::text` no es IMMUTABLE y Postgres rechaza el
cast con 42P17). `contab_matching_bancario()` sugiere partida candidata por monto exacto +
fecha ±2 días, excluyendo partidas ya conciliadas. `contab_conciliar_linea()`/
`contab_desconciliar_linea()` hacen el match manual, ambos con check de tenant. Sin
integración a API bancaria — el usuario sube CSV manual (v1).

**Reportes en vivo (fase 6C):** `balanza_comprobacion`, `libro_diario`, `auxiliares_cuenta`,
`estado_resultados`, `balance_general` — las 5 leen directo de `polizas`/`poliza_partidas`,
todas con tenant-check como primera operación, `search_path=public`, EXECUTE revocado de
PUBLIC/anon (solo `authenticated`/`service_role`). Verificado vía `get_advisors(security)`
+ inspección manual de `pg_proc`/`pg_policies` en el cierre de fase 10 (2026-07-19) — limpio.

**Bug encontrado y corregido en fase 10:** el candado de período solo protegía
`crear_poliza()`. Un egreso manual capturado directo en `movimientos_contables`
(`RegistrarEgresoModal`) con fecha en mes cerrado pasaba la policy RLS sin problema —
el trigger que intenta generar la póliza correspondiente sí fallaba por el candado,
pero traga la excepción (encola en `contab_asientos_pendientes`) sin abortar el INSERT
ni avisar al usuario. Fix: trigger `trg_contab_valida_periodo_movimiento_manual`
(`20260719170000_fase10_candado_movimientos_manual.sql`) bloquea síncrono cualquier
INSERT `origen='manual'` con `fecha_devengo` en un mes ya cerrado.

**Seguridad — checklist de fase 10 (auditoría completa, 2026-07-19):**
Las 14 funciones SECURITY DEFINER de fases 6C/7/8 cumplen el checklist obligatorio de
CLAUDE.md (search_path fijo, REVOKE PUBLIC + GRANT mínimo, tenant-check primero). Único
hallazgo del `get_advisors`: los WARN de `pg_graphql_*_table_exposed` son ruido — GRANT de
tabla a `anon`/`authenticated` es el default de Supabase al crear tabla, pero RLS deniega
todo lo que no tiene policy explícita (verificado con `pg_policies`: ninguna tabla contable
tiene policy para `anon`). `poliza_folios` tiene RLS habilitado sin ninguna policy —
intencional, deny-all; solo se toca desde `crear_poliza()` que es SECURITY DEFINER y
bypassa RLS. `cuentas_contables` mantiene `SELECT USING(true)` para `authenticated` — es
catálogo compartido sin datos de clínica, no requiere scoping por tenant.

## Relaciones Clave

- [[reference_usefielderrors-hook]] — validación de formularios
- [[Fases de Desarrollo Contable]] — roadmap actual (fase 9 IVA pospuesta, sin fecha)
- [[Glosario Financiero]] — términos de negocio

**Última actualización:** 2026-07-19 | Fases 1-8 en producción, módulo cerrado (fase 10)
