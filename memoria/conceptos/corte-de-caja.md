---
tags: [concepto, caja, farmacia]
---

# Corte de Caja — Arquitectura (Opción B)

## Flujo
1. Cajero abre turno con **fondo inicial** (efectivo físico en caja)
2. Durante turno: registra **egresos/ingresos** del fondo
3. **Corte X**: snapshot parcial sin cerrar (folio X-xxxxxx)
4. **Corte Z**: cierre definitivo con conteo ciego (folio Z-xxxxxx)

## Fórmula
```
Efectivo esperado = Fondo inicial + Cobros efectivo + Neto fondos
Diferencia = Contado (ciego) - Efectivo esperado
```

## Tablas
- `turnos` — turno general del cajero
- `pharmacy_cash_shifts` — turno farmacia (POS)
- `cortes` — registra Z y X con folio de `cortes_folio_seq`
- `fondos_movimientos` — egresos/ingresos durante turno

## Problema conocido: `pharmacy_shift_id = NULL`
Cajas no marcadas `es_farmacia = true` → trigger no asigna `pharmacy_shift_id` en `turnos`.
Fix en RPCs: fallback temporal por cajero + ventana de tiempo.
Ver [[diario/2026-06-09]].

## RPCs
- `turno_close(p_turno_id, p_contado, p_notas)` — cierra, genera Z
- `turno_corte_x(p_turno_id)` — snapshot sin cerrar, genera X
- `turno_fondo_movimiento(p_turno_id, p_tipo, p_monto, p_motivo)` — egreso/ingreso
