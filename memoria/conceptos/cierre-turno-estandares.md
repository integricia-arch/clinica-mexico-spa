---
tags: [concepto, caja, farmacia, estándares, auditoria]
creado: 2026-06-11
fuentes:
  - Microsoft Dynamics 365 Commerce (shift-drawer-management, cash-mgmt)
  - Aspel CAJA 5.0 manual
  - Manual de procedimientos de caja (administración pública MX)
  - AgendaPro / DECAP / SAIT — mejores prácticas corte de caja MX
  - SAT México — CFDI 4.0, factura global, retención 5 años
  - Lightspeed, Dutchie POS, Xenia retail best practices
---

# Estándares Formales — Cierre de Turno y Corte de Caja

> Investigación de fuentes formales (manuales de administración, POS enterprise, normativa SAT MX).
> Cada punto tiene su status en el proyecto clinica-mexico-spa.

Leyenda: ✅ Implementado | ⚠ Parcial | ❌ No implementado | 🔜 En plan

---

## A. APERTURA DE TURNO

| # | Requisito | Status |
|---|-----------|--------|
| 1 | Fondo inicial declarado por cajero | ✅ |
| 2 | Fuente del fondo identificada (caja fuerte, banco) | ❌ |
| 3 | Cajero identificado por nombre + rol en el registro | ✅ |
| 4 | Fecha y hora exacta de apertura registrada | ✅ |
| 5 | Terminal/caja asignada | ✅ (tabla `cajas`) |
| 6 | Confirmación explícita del cajero (wizard step) | ✅ |
| 7 | Alerta si fondo < fondo mínimo configurado | ⚠ Campo existe, UI no advierte |

---

## B. OPERACIONES DURANTE EL TURNO

| # | Requisito | Status |
|---|-----------|--------|
| 8 | Ventas registradas por forma de pago (efectivo / tarjeta / transferencia / mixto) | ✅ |
| 9 | Ingresos de efectivo al fondo (float entries) con motivo | ✅ (`fondos_movimientos` tipo ingreso) |
| 10 | Egresos de efectivo del fondo (tender removal) con motivo | ✅ (`fondos_movimientos` tipo egreso) |
| 11 | Depósito parcial a caja fuerte (safe drop) trazado | ❌ No hay concepto de caja fuerte |
| 12 | Depósito a banco durante turno (bank drop) trazado | ❌ |
| 13 | Devoluciones / reembolsos registrados y vinculados al turno | ✅ |
| 14 | Ventas suspendidas (carrito en pausa, reanudables) | ❌ No implementado |
| 15 | Cambio de cajero en el mismo turno | ❌ Un cajero por turno |
| 16 | Modo multi-usuario en un turno compartido | ❌ |
| 17 | IVA desglosado por venta (base + tasa + exento) | ✅ |
| 18 | Código forma de pago SAT (01/03/04/28) en cada transacción | ✅ (`metodos_pago.codigo_sat`) |

---

## C. CORTE X (Parcial sin cerrar)

| # | Requisito | Status |
|---|-----------|--------|
| 19 | Generación de Corte X sin cerrar el turno | ✅ RPC `turno_corte_x` |
| 20 | Folio X único secuencial (X-xxxxxx) | ✅ |
| 21 | Totales por forma de pago en el snapshot | ✅ |
| 22 | Timestamp del corte X | ✅ |
| 23 | Múltiples cortes X por turno posibles | ✅ |
| 24 | Impresión / export del Corte X | ✅ |

---

## D. CIERRE DE TURNO — CONTEO CIEGO

| # | Requisito | Status |
|---|-----------|--------|
| 25 | Conteo ciego obligatorio (cajero cuenta antes de ver esperado) | ✅ |
| 26 | Toggle para deshabilitar conteo ciego (config por clínica) | ✅ (`requiere_conteo_ciego`) |
| 27 | Desglose por denominación de billetes y monedas | ❌ Solo total, no denominaciones |
| 28 | Conteo por tipo de pago (efectivo / tarjeta / transferencia) | ✅ Implícito (efectivo manual, otros del sistema) |
| 29 | Notas del cajero al cierre | ✅ |

---

## E. CORTE Z — REPORTE FINAL

| # | Requisito | Status |
|---|-----------|--------|
| 30 | Efectivo esperado = fondo + cobros efectivo + ingresos − egresos | ✅ |
| 31 | Diferencia calculada (faltante/sobrante) | ✅ |
| 32 | Umbral de diferencia configurable por clínica | ✅ (`clinic_settings.caja.umbral_diferencia`) |
| 33 | Bloqueo si diferencia > umbral (hasta autorización) | ✅ RPC lanza `DIFF_EXCEEDS_THRESHOLD` |
| 34 | Autorización supervisor con PIN para override | 🔜 En spec, pendiente implementar |
| 35 | Folio Z secuencial único | ✅ (`cortes_folio_seq`) |
| 36 | Timestamp de cierre registrado | ✅ |
| 37 | Cajero que cerró el turno registrado (`generado_by`) | ✅ |
| 38 | Supervisor que autorizó registrado (`autorizado_by`) | ⚠ Existe columna, pero graba cajero no supervisor (bug conocido) |
| 39 | Desglose ventas por forma de pago en el Corte Z | ✅ |
| 40 | Total de tickets / transacciones del turno | ✅ |
| 41 | Devoluciones desglosadas en el reporte | ✅ |
| 42 | Movimientos de fondo (ingresos/egresos) en el reporte | ✅ |
| 43 | IVA total desglosado (base gravable + IVA) | ✅ |
| 44 | Impresión / export del Corte Z | ✅ (CorteZPrint component) |
| 45 | Re-impresión del último Corte Z | ❌ No implementado |

---

## F. AUDITORÍA Y TRAZABILIDAD

| # | Requisito | Status |
|---|-----------|--------|
| 46 | Log completo de acciones del turno (`audit_logs`) | ✅ |
| 47 | Historial de cortes consultable por admin | ✅ (tab en CajaTurno) |
| 48 | Reconciliación con contabilidad / headquarters | ❌ No hay módulo contable |
| 49 | Retención mínima de registros 5 años (obligación SAT) | ❌ No hay política de retención |
| 50 | Reportes exportables a PDF/Excel para auditoría fiscal | ❌ Solo visualización, sin export |

---

## G. FACTURACIÓN SAT (México)

| # | Requisito | Status |
|---|-----------|--------|
| 51 | CFDI 4.0 por cada venta individual | ❌ Pendiente (facturación real) |
| 52 | Factura global al público en general (ventas sin CFDI individual) | ❌ Pendiente |
| 53 | Código de forma de pago SAT en el CFDI | ✅ (código existe, integración PAC pendiente) |
| 54 | IVA 16% o tasa correcta / exento por medicamento | ✅ |
| 55 | Libro de control COFEPRIS (medicamentos controlados) | ✅ |

---

## H. CONFIGURACIÓN POR CLÍNICA

| # | Requisito | Status |
|---|-----------|--------|
| 56 | Umbral de diferencia configurable | ✅ |
| 57 | Conteo ciego obligatorio (toggle) | ✅ |
| 58 | Fondo mínimo de apertura configurable | ✅ (campo existe) |
| 59 | Alerta si fondo apertura < mínimo | ⚠ Campo existe, lógica no implementada |
| 60 | Permite venta sin turno (override para admin/gerente) | ⚠ Toggle existe en Ajustes, no se verifica en POS |

---

## Resumen de Gaps Críticos

### Pendientes de implementar (en orden de prioridad):

1. **#34 Autorización supervisor con PIN** — en spec `2026-06-11-supervisor-pin-design.md` 🔜
2. **#38 `autorizado_by` graba supervisor no cajero** — bug de auditoría (parte del plan supervisor PIN)
3. **#45 Re-impresión Corte Z** — fácil, solo frontend
4. **#27 Desglose por denominaciones** — billetes/monedas en conteo ciego
5. **#59 Alerta fondo mínimo al abrir turno** — campo existe, falta verificación en TurnoOpenWizard
6. **#60 Verificar `permite_venta_sin_turno` en POS** — campo existe en config, no se lee en POS
7. **#11-12 Safe drop / bank drop** — conceptos avanzados, bajo prioridad para clínica
8. **#14 Ventas suspendidas** — carrito en pausa, bajo prioridad
9. **#48-50 Contabilidad / export / retención** — largo plazo
10. **#51-52 CFDI real + factura global** — requiere PAC, largo plazo
