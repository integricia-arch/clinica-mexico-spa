# Fase 6 — Partida doble, pólizas automáticas y reportes contables

**Fecha:** 2026-07-19 · **Estado:** APROBADO por Pablo (mensajes 2026-07-18/19)
**Insumos:** `memoria/referencias/contpaq-gap-analysis.md`, `memoria/referencias/contabilidad-marco-legal-mx.md`,
`memoria/proyectos/modulo-contable-memoria-tecnica.md`.
**Objetivo:** que caja y compras generen pólizas balanceadas (cargo/abono) en automático,
con catálogo de cuentas con tipo+naturaleza y reportes (balanza, diario, mayor/auxiliares,
estado de resultados, balance) siempre al día — son queries en vivo sobre pólizas, sin jobs extra.

## Reglas duras (heredadas del repo)
- Checklist SECURITY DEFINER completo; RLS por membership; sin USING(true) multi-tenant.
- Idempotencia por (reference_type, reference_id, evento) igual que movimientos_contables.
- E2E SQL con rollback por sub-fase; revisor agente por sub-fase; no avanzar con CRITICAL/HIGH.
- No romper lo existente: pnl_mensual/flujo_efectivo/kpis_dashboard siguen funcionando
  (vistas de compatibilidad durante la transición; movimientos_contables se conserva).

## 6A — Esquema y catálogo
1. `cuentas_contables`: agregar columnas `naturaleza` ('deudora'|'acreedora'), ampliar CHECK de
   `tipo` a ('activo','pasivo','capital','ingreso','egreso'), `cuenta_padre_id` nullable (jerarquía),
   `codigo_agrupador_sat` (renombrar/reusar codigo_sat), `nivel` int. Filas existentes: backfill
   naturaleza (ingreso=acreedora, egreso=deudora).
2. Seed catálogo mínimo clínica alineado a código agrupador SAT (Anexo 24) — verificar códigos
   exactos con búsqueda web antes de sembrar:
   - Activo: 101 Caja, 102 Bancos, 105 Clientes (CxC), 115 Inventario-Almacén (sub: insumos,
     medicamentos), 118 IVA acreditable.
   - Pasivo: 201 Proveedores (CxP), 205 Acreedores (sub: honorarios médicos por pagar),
     209 IVA trasladado.
   - Capital: 301 Capital social / 305 Resultados acumulados / cuenta puente de migración.
   - Ingresos: 401 consultas, 402 farmacia, 403 otros.
   - Costos: 501 costo de insumos, 502 costo farmacia (preparada, sin poblar v1).
   - Gastos: 601 honorarios, 602 renta, 603 nómina, 604 servicios, 699 otros.
3. Tablas nuevas:
   - `polizas` (id, clinic_id, folio serial por clínica+tipo, fecha, tipo 'ingreso'|'egreso'|'diario',
     concepto, uuid_cfdi nullable, reference_type/reference_id/evento (idempotencia UNIQUE parcial),
     estado 'contabilizada'|'cancelada', created_by, created_at).
   - `poliza_partidas` (id, poliza_id FK CASCADE, orden, cuenta_id, debe_centavos ≥0,
     haber_centavos ≥0, CHECK exactamente uno >0, descripcion).
   - Validación Σdebe=Σhaber: trigger CONSTRAINT DEFERRABLE al final de la transacción sobre
     poliza_partidas (o RPC única `crear_poliza(jsonb)` que valida antes de insertar — preferir RPC,
     más simple; clientes NUNCA insertan partidas directo: RLS SELECT-only).
4. RLS: SELECT members en ambas; escritura solo RPCs/triggers definer. Cancelación = póliza de
   reversa (nunca UPDATE/DELETE), RPC `cancelar_poliza`.
5. E2E rollback: crear póliza balanceada OK, desbalanceada rechazada, cancelación genera reversa,
   RLS negativa.

## 6B — Generación automática (asientos)
Extender los triggers de Fase 3 (mismos eventos, misma idempotencia) para que además de
movimientos_contables generen la póliza. Sin IVA en v1 (los cobros de caja no desglosan IVA hoy;
documentar; facturas proveedor SÍ traen iva_centavos → separar cargo gasto/almacén + cargo IVA
acreditable).
- Cobro caja pagado: cargo 101 Caja, abono 401/403. (tipo póliza: ingreso)
- Venta farmacia: cargo 101 Caja, abono 402. Cancelación → póliza reversa.
- Factura proveedor: cargo 115 Almacén (subtotal) + cargo 118 IVA acreditable (iva_centavos),
  abono 201 Proveedores. Pago (saldo→0): cargo 201, abono 102 Bancos. (tipo: egreso/diario)
- Honorario devengado (cron existente): cargo 601, abono 205 Acreedores-honorarios.
- Insumo consumido en cita (registrar_insumos_cita): cargo 501, abono 115-insumos.
  Reversa → póliza inversa.
- Backfill histórico: RPC one-shot que convierte movimientos_contables previos sin póliza en
  pólizas de 2 partidas (contracuenta = cuenta puente 3xx), idempotente.
- E2E rollback: cada evento genera su póliza balanceada; re-evento no duplica; totales de pólizas
  cuadran con movimientos_contables del mismo período.

## 6C — Reportes en vivo
RPCs SECURITY DEFINER (membership primero, REVOKE/GRANT):
- `balanza_comprobacion(p_clinic_id, p_desde, p_hasta)`: por cuenta: saldo inicial, cargos, abonos,
  saldo final (naturaleza aplicada). Σ debe = Σ haber global como assert del E2E.
- `libro_diario(p_clinic_id, p_desde, p_hasta)`: pólizas con partidas ordenadas por folio/fecha.
- `auxiliares_cuenta(p_clinic_id, p_cuenta_id, p_desde, p_hasta)`: movimientos por cuenta (mayor).
- `estado_resultados(...)` y `balance_general(p_clinic_id, p_al date)`: desde saldos de balanza.
UI: tabs nuevos en Contabilidad — Balanza, Libro diario, Auxiliares, Balance — export CSV cada uno.
Los reportes existentes (P&L/flujo/KPIs) se mantienen tal cual.
E2E: balanza cuadra (debe=haber), balance A=P+C con datos sembrados, rollback.

## 6D — Cierre
- Revisor global + get_advisors(security) (cuando haya MCP).
- Actualizar memoria técnica, CLAUDE.md y manual de usuario (/contabilidad).
- STATE.md.

## Fuera de alcance v1 (documentar, no hacer)
- IVA en cobros de caja (requiere desglose en movimientos de caja — cambio de captura).
- Costo de medicamentos vendidos (502 preparada; falta costo snapshot en venta farmacia).
- Contabilidad electrónica SAT (XML) y DIOT — el contador externo la lleva; el modelo ya deja
  uuid_cfdi y codigo_agrupador_sat listos.
- Depreciación de activos fijos y nómina detallada.
