# Investigación Formal: Gestión de Turnos y Cortes de Caja en POS
**Fecha:** 2026-06-15 | **Fuentes:** NIF C-1/IMCP, COSO, IIA, Toast, Lightspeed, Shopify POS, Odoo POS, SAP B1

---

## ESTADO ACTUAL DEL SISTEMA vs. MEJORES PRÁCTICAS

### ✅ Ya implementado correctamente
- Conteo ciego al CIERRE (no muestra esperado antes de ingresar conteo)
- Umbral de diferencia + supervisor override (PIN o contraseña)
- Fondos movimientos: egreso/ingreso con motivo (fondos_movimientos)
- Fondo siguiente turno + depósito al cierre (corte_set_fondo)
- Acta de arqueo imprimible (printActaArqueo)
- Corte X sin cerrar turno (turno_corte_x - fixed 2026-06-15)
- Conciliación tarjeta/transferencia (PagoReconcile + get_corte_pago_total)
- Audit log inmutable (audit_logs)
- Supervisor PIN para autorizar diferencias (turno_close_with_pin)
- Desglose por denominación en CIERRE (DenominacionCounter)

### ❌ Gaps por implementar (ordenados por impacto)

| # | Gap | Prioridad | Riesgo |
|---|-----|-----------|--------|
| 1 | Conteo ciego en APERTURA — cajero no ve fondo esperado antes de contar | ALTA | Hereda faltantes sin documentar |
| 2 | Verificación fondo recibido vs. fondo_siguiente_turno del Z anterior | ALTA | Faltante entre turnos sin dueño |
| 3 | Desglose por denominación en APERTURA | ALTA | Sin evidencia de qué recibió cajero |
| 4 | Devoluciones sin flujo de autorización supervisor | MEDIA | Vector de fraude (refund fraud) |
| 5 | Sin distinción Cash Drop vs. Egreso genérico | MEDIA | Cash drops sin doble firma |
| 6 | Sin campo de explicación obligatorio en diferencias | MEDIA | Sin bitácora de incidencias |
| 7 | Sin folio correlativo de apertura | BAJA | Trazabilidad incompleta |
| 8 | Sin límite de efectivo configurable con alerta | BAJA | Riesgo de robo |

---

## FÓRMULA CORRECTA DE CONCILIACIÓN DE EFECTIVO

```
EFECTIVO ESPERADO =
  Fondo de Apertura
  + Ventas en Efectivo
  + Cash In (entradas no-venta)
  - Cash Out (salidas no-venta)
  - Devoluciones en Efectivo
  - Cash Drops durante el turno

DIFERENCIA = Efectivo Contado (físico) - Efectivo Esperado
Si > 0 → SOBRANTE | Si < 0 → FALTANTE | Si = 0 → CUADRADA
```

## UMBRAL DE DIFERENCIA (ESTÁNDARES INDUSTRIA)
- Retail general: ±$100 MXN por turno
- Restaurantes: ±$200 MXN
- Clínicas/consultorios: ±$50-100 MXN (menor volumen efectivo)
- Reporte a dirección: varianza ≥ $2,000 MXN
- Investigación formal: 3+ varianzas consecutivas mismo cajero

## SEPARACIÓN DE FUNCIONES MÍNIMA (COSO)
- Quien ABRE ≠ quien CIERRA
- Quien MANEJA efectivo ≠ quien REGISTRA contablemente
- Devoluciones: requieren supervisor distinto al cajero
- Cash drops: doble firma (cajero + supervisor)

## CORTE X vs CORTE Z
- **Corte X**: snapshot sin cerrar; no resetea contadores; puede hacerse N veces
- **Corte Z**: cierre definitivo; congela contadores; genera asiento contable; 1 por turno

## PLAN DE IMPLEMENTACIÓN (PENDIENTE)

### Fase 1 — Control crítico
- Conteo ciego apertura + verificación vs. Z anterior + denominaciones en apertura
- Requiere: columnas `conteo_apertura`, `diferencia_apertura` en `turnos`
- UI: `TurnoOpenWizard.tsx` y `OpenShiftCard` en `ShiftPanel.tsx`

### Fase 2 — Prevención de fraude
- Flujo de autorización supervisor para devoluciones
- Tipo "cash_drop" en fondos_movimientos con campo destino

### Fase 3 — Auditoría y trazabilidad
- Campo explicación obligatorio en diferencias
- Folio correlativo de apertura
- Límite de efectivo configurable con alerta en UI

---

## REFERENCIAS CLAVE
- NIF C-1 (CINIF/IMCP) — Efectivo y Equivalentes
- CFF Art. 29, 29-A, 30 — CFDI y conservación de documentos (5 años)
- Marco COSO — Segregación de funciones
- Toast POS: Cash Drawer Lockdown, Blind Closeout
- Lightspeed: Opening/Closing Register, Denomination Count
- Odoo POS: Cash Control, Maximum Difference setting
- Shopify POS: Register Sessions, Mid-session cash counts
