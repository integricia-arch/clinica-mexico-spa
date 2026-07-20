# Plan — Trazabilidad Contabilidad ↔ Trámite Operativo ↔ Almacén

Fecha: 2026-07-20 | Estado: PLAN, nada implementado aún | Depende de: módulo contable (fases 1-10, cerrado), UI pólizas (hoy)

## 1. Objetivo

Un clic en cualquier reporte contable (auxiliar, libro diario, balanza) lleva al
trámite operativo que lo originó (cita, venta farmacia, compra, egreso). Y al
revés: desde el trámite operativo (expediente, POS, compra, almacén) un clic
lleva a la póliza/movimiento contable que generó. Alcance: contabilidad, cobros,
pagos, entradas/salidas de almacén.

## 2. Mapa de trazabilidad — qué existe hoy

Todo movimiento contable YA guarda `reference_type` + `reference_id` (llave de
trazabilidad nativa, `movimientos_contables` y `poliza_partidas`/`polizas` por
igual) — el dato existe, lo que falta es exponerlo como link clicable en UI.

| Trámite operativo | `reference_type` | Cuenta(s) afectadas | Trigger | UI hoy (reporte) | Link → trámite | Link trámite → póliza |
|---|---|---|---|---|---|---|
| Cobro de consulta (caja) | `consulta` | 101 Caja / 401 Ingresos consultas | `contab_movimiento_caja` | Libro diario ✅ | ❌ | ❌ |
| Cobro "otros" (caja) | `manual`→evento `cobro_caja_otros` | 101 / 403 Otros ingresos | `contab_movimiento_caja` | Libro diario ✅ | ❌ | ❌ |
| Venta de farmacia | `farmacia`/`pharmacy_sale` | 101 / 402 Ingresos farmacia | `contab_pharmacy_sale` | Libro diario ✅ | ❌ | ❌ |
| Factura de proveedor (compra) | `compra`/`factura_proveedor` | 115 Almacén / 201 Proveedores (+118 IVA acreditable) | `contab_factura_proveedor` | Libro diario ✅ | ❌ | ❌ |
| Honorario médico devengado | `honorario_appointment` | 601 Honorarios / 205.01 Honorarios por pagar | Cron `contab_devengar_honorarios` | Libro diario ✅ | ❌ | ❌ |
| Consumo de insumo en cita (salida almacén) | `appointment_insumo` | 501 Costo insumos / 115.01 Almacén insumos | `contab_consumo_insumo` (agregado ayer, fase 10) | Libro diario ✅ | ❌ | ❌ |
| Egreso manual (capturado por usuario) | `movimiento_manual` | cuenta elegida / 101 o 102 | Trigger sobre `movimientos_contables` | Libro diario ✅ | ❌ | ❌ |
| Póliza manual (NuevaPolizaDialog) | el que capture el usuario | libre | Directo (`crear_poliza`) | Libro diario ✅ | N/A (ya es el origen) | N/A |
| Cancelación de póliza | `poliza_reversa` | espejo de la original | `cancelar_poliza` | Libro diario ✅ | ❌ | ❌ |

**Huecos reales (no solo de UI, de dato):**
- **Venta de medicamentos en farmacia**: el ingreso sí se traza (`pharmacy_sale`),
  pero el COSTO del medicamento vendido NO — limitación ya documentada en memoria
  técnica §5.1 (`movimientos_inventario` de medicamentos no tiene snapshot de
  costo vinculado a la venta). Sin esto, "entradas/salidas de almacén" de
  medicamentos no puede trazarse completo a contabilidad, a diferencia de
  insumos clínicos que sí quedó cerrado ayer.
- **Entradas de almacén** (recepción de mercancía, `recepciones_mercancia`):
  hoy la póliza se genera desde `factura_proveedor` (cuando llega la factura),
  no desde la recepción física — si recepción y factura no coinciden en fecha,
  el momento contable no es el mismo que el momento físico de entrada. Confirmar
  si esto es aceptable (devengo = fecha de factura, correcto contablemente) o si
  el negocio espera ver la recepción física como punto de trazabilidad también.

## 3. Plan de UI — clic bidireccional

Reutiliza lo ya construido hoy (`PolizaDetalleDialog`) en vez de crear otro
componente de detalle de póliza.

### 3.1 Reporte → trámite (auxiliar/diario/balanza → origen)

```
AuxiliaresTab / LibroDiarioTab (fila de movimiento)
  [Cuenta] [Descripción] [Cargo] [Abono] [Ver trámite →]
                                              │
                    reference_type + reference_id ya en la fila
                                              │
                    switch(reference_type):
                      consulta/honorario_appointment → abre modal Expediente/Cita (id)
                      farmacia/pharmacy_sale          → abre modal Venta POS (id)
                      compra/factura_proveedor        → abre modal Compra/Factura (id)
                      appointment_insumo              → abre modal Cita + tab Insumos
                      movimiento_manual               → abre RegistrarEgresoModal en modo lectura
```

### 3.2 Trámite → póliza (reversa)

```
Pantalla operativa (Expediente, POS, Compra, Egreso)
  [...datos del trámite...]
  [Ver asiento contable]  ← nuevo botón, solo si ya se generó póliza
        │
        RPC nueva (mínima): buscar poliza_id por (reference_type, reference_id)
        │
        Abre PolizaDetalleDialog (ya existe, se reusa tal cual)
```

Solo falta UNA pieza de backend nueva: una función/vista que resuelva
`(reference_type, reference_id) → poliza_id` (o `movimiento_contable_id` si el
trámite solo vive en el sistema de devengo simple, no en partida doble) — el
resto es cableado de botones en pantallas que ya existen.

## 4. Fases propuestas

**Fase 0 — Auditoría de huecos reales (medio día).**
Confirmar contra la BD real (no solo memoria) qué `reference_type` existen hoy
en `movimientos_contables` y `polizas`, cuáles trámites NUNCA generan póliza
(farmacia COGS, recepciones), y si `recepciones_mercancia` necesita su propio
`reference_type` distinto de `factura_proveedor`. Sin este paso, el resto del
plan puede construir sobre supuestos viejos.

**Fase 1 — Resolver `(reference_type, reference_id) → asiento` (backend, chico).**
Una función/vista `contab_resolver_asiento(reference_type, reference_id)` que
regrese `poliza_id` o `movimiento_contable_id` según cuál sistema lo tenga.
Reutilizable por ambas direcciones del link.

**Fase 2 — Reportes → trámite (frontend).**
Botón "Ver trámite" en `LibroDiarioTab`/`AuxiliaresTab`/`BalanzaTab` (auxiliar
ya tiene drill-down por cuenta, falta el último salto a trámite). Requiere un
`switch` por `reference_type` a la pantalla/modal correspondiente — varias de
esas pantallas (Expediente, POS, Compra) hay que revisar si abren en modal o
requieren navegación de página completa.

**Fase 3 — Trámite → reporte (frontend, reversa).**
Botón "Ver asiento contable" en cada pantalla operativa relevante
(Expediente/cita, POS venta, Compra/factura, RegistrarEgresoModal). Usa Fase 1
+ reusa `PolizaDetalleDialog`.

**Fase 4 — Cerrar huecos de dato encontrados en Fase 0** (si Fase 0 confirma que
existen — ej. farmacia COGS). Esto es trabajo de esquema/trigger nuevo, no solo
UI, y ya estaba identificado como deuda desde fase 4 original (memoria técnica
§5.1) — no es nuevo, solo se prioriza si el plan de trazabilidad lo requiere
para estar completo.

## 5. Validaciones por fase

- **Fase 0:** query de auditoría (`SELECT DISTINCT reference_type FROM movimientos_contables` y mismo para `polizas`) — comparar contra esta tabla, documentar diferencias.
- **Fase 1:** probar `contab_resolver_asiento` contra 5 casos reales (uno por cada `reference_type` existente), confirmar que regresa el id correcto o `NULL` limpio si no existe póliza aún.
- **Fase 2/3:** probar el clic ida y vuelta con una cita real que tenga: cobro + honorario + insumo consumido — las 3 pólizas deben ser alcanzables desde el expediente, y cada una debe regresar al expediente correcto.
- **Fase 4:** depende del hallazgo — no se puede definir validación hasta tener el hallazgo de Fase 0.

## 6. Siguiente paso

Este documento es solo el plan — nada implementado. Antes de construir, decidir:
1. ¿Empezar por Fase 0 (auditoría) para confirmar supuestos, o saltar directo a Fase 1 asumiendo que este mapa ya es correcto?
2. ¿Alcance de Fase 4 (farmacia COGS) entra en este esfuerzo o se mantiene como deuda aparte (como ya estaba documentado)?

## Relaciones

- [[modulo-contable-memoria-tecnica]] — mapa de datos y fórmulas base
- Construido sobre: `PolizaDetalleDialog.tsx`, `ValidadorCuadreDialog.tsx` (sesión 2026-07-20)
