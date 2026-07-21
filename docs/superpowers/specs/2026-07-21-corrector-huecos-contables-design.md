# Corrector de huecos contables (diagnóstico + fix asistido) — Design

Fecha: 2026-07-21 | Estado: aprobado por Pablo, pendiente de plan de implementación

## Problema

`ValidadorCuadreDialog` (fase 7) ya corre 4 checks de solo-lectura: balanza, ecuación
contable, huecos devengo↔partida doble (`contab_auditoria_huecos`), cortes Z vs pólizas
(`contab_concilia_cortes`). Cuando algo no cuadra, el usuario no tiene forma de corregirlo
desde la UI — tiene que ir a Pólizas → Nueva póliza y reconstruir el asiento a mano.

Se detectaron en producción (2026-07-21, verificación visual): ecuación contable con
diferencia de $420, 5 movimientos `sin_poliza`, 1 corte Z con diferencia de $2,001.50.

## Alcance

**v1 corrige la causa raíz: huecos `sin_poliza`** (movimientos_contables sin póliza
asociada). Por qué no atacar los 4 checks por separado: la diferencia en la ecuación
contable y en cortes Z son consecuencia de los mismos huecos — un movimiento devengado
sin su póliza correspondiente descuadra tanto el balance general como la conciliación de
caja. Cerrar el hueco cierra ambos síntomas. Construir un "fix" independiente para cada
check sería lógica redundante.

**Fuera de alcance v1:**
- Huecos `sin_referencia` (pólizas sin `reference_type`) — requieren decisión humana de
  a qué evento pertenecen, no hay dato suficiente para inferir. Se siguen reportando
  solamente.
- Diferencias de cortes Z que **no** vengan de un hueco (ej. faltante físico real de caja)
  — no se auto-corrigen, siguen reportados. El corrector no inventa ajustes de efectivo.
- Balanza descuadrada a nivel póliza individual (violaría `crear_poliza()`, no puede
  ocurrir si el motor de asientos está sano — no es un caso real a cubrir).

## Flujo

1. Usuario corre "Validar cuadre" (ya existe).
2. Para cada fila `sin_poliza` de `contab_auditoria_huecos`, un nuevo botón "Diagnosticar"
   dispara `contab_diagnosticar_hueco(movimiento_id)` (RPC nueva, `SECURITY DEFINER`,
   check de membership) que:
   - Lee el `movimientos_contables` original (`origen`, `reference_type`, `monto_centavos`,
     `cuenta_id`).
   - Mapea `origen` → tipo de póliza y par de cuentas debe/haber, usando el mismo mapeo
     que ya usa la captura manual de pólizas (`origen='honorario'` → cargo cuenta origen
     del movimiento / abono `205.01 Honorarios por pagar`, etc. — tabla de mapeo fija en
     el RPC, un `CASE` por `origen`, ningún origen nuevo se soporta silenciosamente).
   - Devuelve la póliza propuesta (tipo, partidas con cuenta+monto) **sin escribir nada**.
3. UI muestra la propuesta en un panel de confirmación:
   - Tabla de partidas propuestas (cuenta, debe/haber).
   - Justificación técnica: 2-3 líneas fijas por tipo de origen citando la regla de
     partida doble ya documentada (NIF A-2/C-1 — devengo y dualidad económica) y el
     artículo del proyecto que la exige (`crear_poliza()` — regla dura "SUM(debe)=SUM(haber)").
     Estas referencias son texto estático por tipo de origen, no generadas por LLM en
     runtime — evita alucinar cita normativa.
   - Botones: "Aplicar" / "Descartar".
4. "Aplicar" llama `crear_poliza()` con el `reference_type`/`reference_id`/`evento` del
   movimiento original (garantiza idempotencia — si se corre dos veces, `crear_poliza()`
   regresa el id existente, no duplica).
5. Tras aplicar (una o varias), botón "Re-validar" vuelve a correr los 4 checks para
   confirmar que el hueco y sus síntomas (ecuación, corte) se cerraron.

## Componentes

- **Migración SQL nueva**: `contab_diagnosticar_hueco(p_movimiento_id uuid) RETURNS jsonb`
  — solo lectura, mismo patrón de membership check que `contab_auditoria_huecos`.
  `REVOKE ... FROM PUBLIC` + `GRANT ... TO authenticated` (checklist obligatorio del
  proyecto para `SECURITY DEFINER` nuevas).
- **`useReportesContables.ts`**: nuevo hook `useDiagnosticoHueco()` (mismo patrón que los
  4 hooks existentes en ese archivo).
- **`ValidadorCuadreDialog.tsx`**: agrega botón "Diagnosticar" por fila de hueco `sin_poliza`
  + subcomponente `PropuestaCorreccionCard` (partidas, justificación, Aplicar/Descartar).
  Reusa `crear_poliza` vía el mismo cliente que ya usa `PolizasTab`/`NuevaPolizaDialog`
  (no duplicar llamada RPC — extraer a `src/features/contabilidad/polizasService.ts` si
  no existe ya un wrapper único).

## Manejo de errores

- `contab_diagnosticar_hueco` sobre un `origen` no mapeado en el `CASE` → excepción
  `origen_sin_mapeo_contable: %` — UI muestra el hueco como "requiere corrección manual",
  no rompe el resto del diagnóstico (uno por uno, no transaccional entre huecos).
- `crear_poliza()` puede rechazar por período cerrado (`contab_cierres`) — UI muestra el
  error tal cual (ya viene con mensaje claro del RPC), no se reintenta ni se oculta.

## Testing

- Un test SQL (`supabase/scripts` o `_tmp_*.sql` de verificación, no vive en migración)
  que sobre datos PRUEBA-* del ambiente confirma: diagnosticar cada uno de los 5 huecos
  actuales produce partidas balanceadas (`SUM(debe)=SUM(haber)`), aplicar cierra el hueco
  (no vuelve a aparecer en `contab_auditoria_huecos` tras aplicar).
- Verificación manual en browser (como ya se hizo en esta sesión): correr validador antes/
  después, confirmar que ecuación contable y corte Z bajan su diferencia.

## Después de esto

Continuar con el plan de trazabilidad reporte↔trámite ya documentado en
`memoria/proyectos/plan-trazabilidad-contable-almacen.md`, arrancando por su Fase 0
(auditoría de `reference_type` reales en BD) — este corrector es un prerequisito útil
porque deja el dato de pólizas limpio antes de construir trazabilidad sobre él.
