# Módulo Contable — Plan de desarrollo

**Fecha:** 2026-07-18 · **Estado:** PROPUESTO (no ejecutado)
**Objetivo:** contabilizar insumos por cita, honorarios de doctores (por paciente / doctor / día), y un módulo contable de ingresos/egresos con los KPIs mínimos de contabilidad privada.

---

## 1. Lo que YA existe (reutilizar, no reconstruir)

| Pieza | Dónde | Estado |
|---|---|---|
| Honorarios por doctor/periodo | vista `doctor_earnings_by_period` (honorarios_centavos, ventas_atribuidas_centavos, consultas) | ✅ existe — falta granularidad por paciente y por día |
| Ingresos farmacia | `pharmacy_sales` + `pharmacy_sale_payments` (método, monto, terminal) | ✅ completo |
| Inventario/insumos | `insumos` (costo_centavos, stock), `movimientos_inventario` (tipo, reference_type/reference_id) | ✅ base lista — `reference_type` permite ligar a citas |
| Caja/turnos | `cajas`, `turnos` (apertura/cierre) | ✅; plan corte de caja Opción B pendiente (folio Z, conteo ciego) |
| Cuentas por pagar | `facturas_proveedor` + edge `notify-cxp-vencimiento` | ✅ base CxP |
| Ciclo de compras | `solicitudes_compra`, `ordenes_compra_items`, `recepciones_mercancia` | ✅ egresos de inventario trazables |
| Facturación | módulo CFDI completo (timbrar, cancelar, REP) | ✅ ingresos fiscales |

Conclusión de exploración: **no se necesita un ERP nuevo** — falta la capa que consolida esto en asientos de ingresos/egresos + 3 tablas puente.

## 2. Investigación — mínimos de contabilidad privada (NIF/NIIF PYMES)

Estados financieros mínimos que cualquier empresa debe poder producir (NIIF para PYMES, Sección 3; NIF A-3 México):

1. **Estado de resultados (P&L):** ingresos − costo de ventas = utilidad bruta; − gastos operativos = utilidad operativa; − impuestos = utilidad neta.
2. **Estado de situación financiera (balance):** activos, pasivos, capital. (Fase posterior — arranque solo P&L + flujo.)
3. **Estado de flujos de efectivo:** entradas/salidas de efectivo por operación, inversión, financiamiento.
4. **Notas / base de devengo:** ingresos y gastos se reconocen cuando ocurren, no cuando se cobran (guardar fecha devengo Y fecha cobro).

### KPIs mínimos a implementar (dashboard contable)

| KPI | Fórmula | Fuente en el sistema |
|---|---|---|
| Ingresos totales (día/mes) | Σ consultas cobradas + ventas farmacia | appointments + pharmacy_sales |
| Costo de ventas | Σ insumos consumidos (costo snapshot) + costo medicamentos vendidos | appointment_insumos + movimientos_inventario |
| **Utilidad bruta y margen bruto %** | (Ingresos − Costo) / Ingresos | calculado |
| Gastos operativos | Σ egresos registrados (renta, nómina, servicios, honorarios) | tabla nueva `gastos` + honorarios |
| **Utilidad neta y margen neto %** | (Ingresos − Costo − Gastos) / Ingresos | calculado |
| **Flujo de efectivo operativo** | cobros reales − pagos reales del período | pagos + gastos con fecha_pago |
| **Punto de equilibrio** | gastos fijos / margen de contribución % | config gastos fijos + margen |
| Cuentas por pagar vencidas (DPO) | facturas_proveedor por antigüedad | existente |
| Cuentas por cobrar (DSO) | citas/ventas con pago pendiente | payment_status |
| Rotación de inventario (DIO) | inventario promedio / costo ventas × días | insumos + movimientos |
| Ingreso promedio por consulta / por doctor | Σ ingresos ÷ consultas | doctor_earnings ampliada |
| Costo de insumos por cita | Σ appointment_insumos ÷ citas | tabla nueva |

Nota México: el catálogo de cuentas se alinea al **código agrupador SAT** (Anexo 24) solo si después se quiere contabilidad electrónica — el diseño lo deja posible (columna `codigo_sat` opcional), no lo implementa.

## 3. Fases

### Fase 1 — Insumos por cita
- Tabla `appointment_insumos` (appointment_id, insumo_id, cantidad, costo_unitario_centavos **snapshot al momento**, user_id, clinic_id, RLS por membership).
- Al registrar consumo: INSERT + `movimientos_inventario` (tipo salida, reference_type='appointment') — descuenta stock.
- UI: en cierre de consulta (vista doctor/enfermera), selector de insumos usados.
- Verificación: consumir insumo en cita de prueba → stock baja, costo queda snapshot aunque el precio del insumo cambie después.

### Fase 2 — Honorarios por paciente/doctor/día
- Revisar definición actual de `doctor_earnings_by_period` (cómo calcula honorarios_centavos).
- Tabla `doctor_honorarios_config` (doctor_id, tipo: porcentaje|fijo_por_consulta, valor, vigente_desde) — histórico, nunca UPDATE destructivo.
- Vista nueva `doctor_honorarios_detalle` (grano: cita) → agregable por paciente, doctor, día. `security_invoker = on` (checklist del proyecto).
- Verificación: cuadrar 1 día contra `doctor_earnings_by_period` existente.

### Fase 3 — Núcleo contable ingresos/egresos
- Tabla `cuentas_contables` (catálogo simple: tipo ingreso|egreso, nombre, codigo_sat opcional, es_fijo bool).
- Tabla `movimientos_contables` (fecha_devengo, fecha_pago nullable, cuenta_id, monto_centavos, origen: enum manual|consulta|farmacia|compra|honorario, reference_type/reference_id, clinic_id, RLS).
- Triggers/jobs que pueblan automático desde: pago de consulta, venta farmacia, recepción de compra, honorarios devengados. Egresos manuales (renta, luz, nómina) por UI.
- Seguridad: checklist SECURITY DEFINER completo; sin `USING(true)`.
- Verificación: E2E SQL con rollback (patrón `reference_e2e-auth-triggers-rollback`).

### Fase 4 — Reportes y KPIs
- Vistas materializadas o RPCs: `pnl_mensual`, `flujo_efectivo`, `kpis_dashboard` (tabla de KPIs de arriba).
- UI: página "Contabilidad" (patrón useBI.ts existente): P&L del período, flujo, tarjetas KPI, export CSV.
- Verificación: cuadre manual de 1 mes contra corte de farmacia.

### Fase 5 — Cierre
- Code review con agente (obligatorio, como hoy).
- Documentar en CLAUDE.md + manual de usuario (`docs/manual-usuario/`).

## 4. Qué NO haremos (y por qué)
- Balance general completo y depreciación de activos — fase posterior, no es el dolor actual.
- Contabilidad electrónica SAT (XML polizas) — solo se deja la columna `codigo_sat` preparada.
- Nómina — los honorarios de doctores sí; nómina administrativa queda como egreso manual.
- Doble partida estricta (debe/haber) — ingresos/egresos simples primero; el modelo permite migrar después.

## 5. Casos límite
- Cita cancelada con insumos ya consumidos → movimiento de reversa, no DELETE.
- Cambio de % de honorarios a mitad de mes → tabla config con vigencias, el detalle usa la vigente a la fecha de la cita.
- Insumo con costo 0 o sin costo → bloquear consumo hasta capturar costo.
- Multi-clínica: TODO filtrado por clinic_id + membership (regla dura del repo).

## 6. Fuentes
- NIIF para PYMES (norma, Sección 2-3): mef.gob.pe / colmenares.com.co (3a ed. 2025)
- Estados financieros básicos NIF: soyconta.com
- Guías NIIF PYMES: siigo.com, nubox.com, incp.org.co
