# Módulo Contable Completo — Plan maestro (Fable 5)

**Fecha:** 2026-07-19 · **Estado:** PROPUESTO (aprobar antes de ejecutar fases nuevas)
**Autor del plan:** Fable 5 (orquestador). **Ejecución:** subagentes sonnet/haiku por fase, gate de revisión por fase.
**Insumos:** `memoria/referencias/contpaq-gap-analysis.md`, `memoria/referencias/contabilidad-marco-legal-mx.md`,
`memoria/proyectos/modulo-contable-memoria-tecnica.md`, plan Fase 6 (`2026-07-19-fase6-partida-doble.md`).

---

## 1. Principio rector: módulo separado, unificado por eventos

La contabilidad es un **módulo autónomo** con frontera dura:

```
Módulos operativos (caja, farmacia, compras, citas, honorarios, almacén)
        │  eventos (triggers/cron idempotentes — NUNCA escritura directa)
        ▼
┌─ MÓDULO CONTABLE ─────────────────────────────────────────────┐
│ Catálogo de cuentas (tipo+naturaleza+agrupador SAT, jerárquico)│
│ Pólizas + partidas (cargo/abono, Σdebe=Σhaber, append-only)    │
│ Motor de asientos (mapeo evento→póliza, tabla de reglas)       │
│ Reportes en vivo (balanza, diario, mayor, ER, balance, P&L)    │
│ UI /contabilidad (tabs) · RPCs SECURITY DEFINER · RLS         │
└───────────────────────────────────────────────────────────────┘
```

Reglas de frontera (no negociables):
- Ningún módulo operativo lee/escribe tablas contables directo; solo dispara eventos.
- Ninguna pantalla operativa calcula cifras contables; consume RPCs del módulo.
- Todo asiento nace de un evento identificable: idempotencia por `(reference_type, reference_id, evento)`.
- Append-only: correcciones = póliza de reversa/ajuste, jamás UPDATE/DELETE de asientos.
- Convención de nombres: tablas/RPCs con prefijo `contab_`/dominio contable; código UI en
  `src/features/contabilidad/`; migraciones etiquetadas `faseNx_`.

## 2. Normas que el módulo debe cuidar

**Contables (NIF):**
- NIF A-2 postulados — con partida doble se cumplen los 8 (dualidad económica era el faltante).
- NIF A-3/B-6: estados financieros mínimos: estado de resultados, balance (situación financiera),
  flujo de efectivo; base de devengo (ya implementada: fecha_devengo/fecha_pago).
- Consistencia: cuentas con naturaleza fija; tipo/código inmutables tras uso (ya aplicado en UI).

**Fiscales (CFF 28, RCFF 33-34, Anexo 24):**
- Registro ≤5 días hábiles tras la operación → los asientos automáticos lo cumplen por diseño.
- Conservación 5 años → append-only + backups Supabase.
- Catálogo alineado a código agrupador SAT (columna ya prevista) y póliza con `uuid_cfdi` y RFC
  del tercero → deja listo el papel de trabajo para revisiones SAT y la futura e-contabilidad.
- Alcance declarado: este módulo es **gestión gerencial + soporte de auditoría**; la contabilidad
  fiscal formal (envío XML, DIOT, declaraciones) la lleva el contador externo. No sustituirlo es
  decisión explícita (ver gap analysis §responsabilidad legal).

## 3. Estado actual (ya en producción)

| Pieza | Fase | Estado |
|---|---|---|
| Insumos por cita (costo snapshot, reversas) | 1 | ✅ |
| Honorarios con vigencias + detalle por cita | 2 | ✅ |
| Ingresos/egresos base devengo + triggers caja/farmacia/facturas + cron honorarios | 3 | ✅ |
| P&L, flujo, KPIs + página /contabilidad + egreso manual | 4 | ✅ |
| Docs + manual usuario + memoria técnica + gap analysis + marco legal | 5 | ✅ |
| Menú lateral, tabs Pólizas(single-entry)/Catálogos, CRUD cuentas | 5.5 | ✅ |
| Esquema partida doble: catálogo tipo+naturaleza, polizas/partidas, crear/cancelar_poliza | 6A | 🔄 en ejecución |

## 4. Fases restantes

### 6B — Motor de asientos automáticos (caja y compras en automático)
Detalle completo en plan Fase 6 §6B. Resumen: extender triggers existentes para generar póliza
balanceada por evento (cobro caja → cargo Caja/abono Ingresos; factura proveedor → cargo
Almacén+IVA acreditable/abono Proveedores; pago → cargo Proveedores/abono Bancos; honorario →
cargo Gasto/abono Acreedores; insumo consumido → cargo Costo/abono Almacén; cancelaciones →
póliza reversa). Backfill del histórico single-entry vía cuenta puente. **Mejora sobre el plan 6B
original:** tabla de mapeo `contab_reglas_asiento` (evento → cuenta cargo/cuenta abono por clínica,
editable por admin) en vez de cuentas hard-codeadas en los triggers — así el catálogo es
configurable sin migraciones.
**E2E:** cada evento → póliza cuadrada; idempotencia; totales pólizas ≡ movimientos_contables.

### 6C — Reportes contables en vivo
Balanza de comprobación (saldo inicial/cargos/abonos/saldo final), libro diario, libro mayor/
auxiliares por cuenta, estado de resultados y balance general desde saldos — RPCs + tabs UI +
CSV. "Siempre actualizado" = queries en vivo sobre pólizas (sin jobs). Detalle en plan 6C.
**E2E:** Σdebe=Σhaber; A = P + C con datos sembrados.

### 7 — Cierre mensual y control
- RPC `cierre_mensual(clinic, periodo)`: valida balanza cuadrada, congela período (candado:
  triggers rechazan pólizas con fecha en período cerrado; ajustes van al período abierto),
  genera póliza de cierre de resultados (ingresos/gastos → resultado del ejercicio).
- Auditoría: reporte de asientos sin referencia, referencias sin asiento (huecos), y
  conciliación pólizas vs cortes de caja (total corte Z ≡ pólizas de caja del turno).

### 8 — Conciliación bancaria (gerencial)
- Tabla `contab_estados_cuenta` (carga CSV del banco) + matching semiautomático contra pólizas
  de bancos (monto+fecha±2días) + UI de conciliación. Sin API bancaria en v1.

### 9 — IVA y preparación fiscal (opcional, decidir tras 6-8)
- Desglose IVA en cobros de caja (cambio de captura en módulo caja — coordinar, es su módulo).
- Reporte IVA acreditable vs trasladado por mes (insumo para el contador, pre-DIOT).
- Exportador Anexo 24 (XML catálogo+balanza) SOLO si algún día se decide e-contabilidad propia.

### 10 — Cierre del módulo
- Revisor global + get_advisors(security) + actualización de memoria técnica, CLAUDE.md,
  manual de usuario, STATE.md. Deudas restantes al registro.

## 5. Integración con módulos existentes (mapa)

| Módulo origen | Evento | Asiento (regla default) |
|---|---|---|
| Caja (`movimientos` pagado) | cobro | Caja → Ingresos consultas/otros |
| Farmacia (`pharmacy_sales`) | venta / cancelación | Caja → Ingresos farmacia / reversa |
| Compras (`facturas_proveedor`) | factura / pago | Almacén+IVA → Proveedores / Proveedores → Bancos |
| Honorarios (cron devengo) | devengo | Gasto honorarios → Acreedores honorarios |
| Citas (`appointment_insumos`) | consumo / reversa | Costo insumos → Almacén insumos / inversa |
| Egresos manuales (UI) | captura | Gasto X → Caja/Bancos según forma de pago |
| Corte de caja (`cortes`) | cierre Z | solo conciliación (fase 7), no genera asiento |

## 6. Orden de ejecución y gates
6A (en curso) → 6B → 6C → 7 → 8 → (9 opcional) → 10. Una fase por vez; cada una: migración +
E2E SQL rollback + revisor agente (sonnet) + validación del orquestador + commit/push. Ejecutar
en sesiones con `/model sonnet`; Fable solo para replanear o resolver diseño trabado.

## 7. Fuera de alcance permanente (v1)
Nómina detallada, depreciación de activos fijos, multiempresa consolidada, API bancaria,
sustitución del contador (envíos SAT). Todo queda con el terreno preparado (uuid_cfdi,
codigo_agrupador_sat, estructura de pólizas estándar).
