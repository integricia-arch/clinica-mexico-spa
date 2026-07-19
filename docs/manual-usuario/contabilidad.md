# Contabilidad

> Pantalla de gestión contable: ve ingresos, gastos, ganancias netas y KPIs clave de tu clínica. Administrador de clínica.

## Operación — cómo se usa

### Cómo ver el estado financiero (ingresos, gastos, ganancia) del mes

1. Abre la pantalla **Contabilidad** desde el menú de administración.
2. Verifica que el rango de fechas en la parte superior sea el período que quieres analizar (por defecto, el mes actual).
3. En las tarjetas de la parte superior, observa:
   - **Ingresos totales:** dinero que entró por consultas y farmacia.
   - **Costo de ventas:** lo que te gastó en insumos clínicos (algodón, jeringuillas, etc.) para esas consultas.
   - **Utilidad bruta:** lo que ganaste antes de los gastos de operación (renta, luz, salarios administrativos).
   - **Gastos operativos:** renta, servicios, nómina administrativa (todo lo que no es insumos ni honorarios).
   - **Utilidad neta:** la ganancia final (lo que realmente ganas después de TODO).
4. Mira el gráfico de **Estado de Resultados (P&L)** — las barras te muestran visualmente cómo crecen ingresos y bajan por gastos.
5. Si necesitas los datos en Excel, haz clic en **Exportar CSV** — descargas una hoja con todos los movimientos contables del período.

### Cómo registrar un egreso manual (renta, luz, servicios, etc.)

1. Ve a **Contabilidad** → sección **Egresos manuales** (abajo de los KPIs).
2. Haz clic en **Agregar egreso nuevo** o **+ Egreso**.
3. Llena los campos:
   - **Tipo de gasto:** elige de la lista (Renta, Servicios, Nómina administrativa, Otros egresos, etc.).
   - **Monto:** escribe la cantidad sin decimales — el sistema suma centavos automáticamente (ej. escribir 1500 = $1,500.00).
   - **Fecha:** cuándo pagaste (fecha de pago real, no de factura).
   - **Descripción:** qué es (ej. "Renta julio" o "Factura CFE folio 12345").
4. Haz clic en **Guardar**.
5. Verás el egreso en la lista abajo y el resumen de **Utilidad neta** se recalculará automáticamente.

### Cómo entender cada KPI (indicador clave)

| Indicador | Qué significa | Por qué importa |
|-----------|---------------|-----------------|
| Ingresos totales | Todo lo que cobró la clínica (citas + farmacia) | Base de la ganancia; si crece, el negocio crece |
| Costo de ventas | Lo que gastaste en insumos para hacer esas consultas | Entre más bajo, más ganancia sin perder calidad |
| Margen bruto % | (Ingresos menos Costo) dividido Ingresos por 100 | Si es menor a 60%, revisa que insumos no suban |
| Gastos operativos | Renta, luz, agua, nómina admin (fijos + variables) | Son los "gastos para estar abierto" sin atender |
| Margen neto % | (Ingresos menos Costo menos Gastos) dividido Ingresos | Es tu ganancia real; si es menor a 10% está apretado |
| Flujo de efectivo | Dinero que realmente entró vs. que realmente salió | No es lo mismo que "ganancia" (puedes ganar pero no tener cash) |

## Reglas de negocio — por qué se comporta así

- **Los insumos se registran en citas, no manualmente.** Cuando la enfermera cierra una cita, selecciona qué insumos se usaron — el costo se suma automático. Por eso la clínica "ve" qué gastó en cada paciente.
  **Por qué:** control preciso: sabes exactamente cuánto cuesta cada tipo de consulta (pediatría ≠ cirugía).

- **Egresos manuales solo los registra el admin.** Si eres enfermera o recepcionista, no puedes agregar gastos (evita gastos fantasma).
  **Por qué:** auditoría; la clínica necesita saber que cada peso que reporta fue aprobado.

- **Existe una fecha de "devengo" y una de "pago".** Devengo = cuándo ocurrió (ej. cita el 15 de julio). Pago = cuándo cobraste (ej. cliente pagó el 20).
  **Por qué:** NIIF (norma contable) exige diferenciar — un cliente que paga a crédito genera ingreso en julio pero dinero en agosto.

- **El costo de insumos está "congelado" en el momento de la consulta.** Si un insumo costaba $100 en junio y $120 en julio, los insumos de junio siempre valen $100 — no cambian.
  **Por qué:** coherencia; de otro modo, cambiar un precio viejo reescribiría la historia y no podrías confiar en reportes pasados.

- **No incluimos costo de medicamentos de farmacia.** Si vendes una caja de amoxicilina, el ingreso entra, pero el costo no se descuenta (limitación conocida).
  **Por qué:** los medicamentos se gestionan como un stock separado; el detalle de costo medicamento-por-medicamento es futuro.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| El monto de un egreso aparece con decimales raros (ej. 1500.01) | Convertión de centavos; error menor de redondeo en cálculos. | Reporta al dev si es >$1, probable bug. |
| Hice clic en "Exportar CSV" y no descargó nada | Bloqueador de ventanas emergentes del navegador. | Permite ventanas emergentes para integrika.mx. |
| Un insumo no aparece en cierre de cita | Está marcado como inactivo O no tiene precio capturado. | En Inventario, edita el insumo y fija Costo > 0, márcalo activo. |
| Veo un egreso del mes pasado hoy | Los egresos manuales se ven en el período donde caiga la **fecha de devengo** (no fecha de creación). | Si lo quieres en otro período, edítalo (solo admin). |

## Implementación — para el siguiente dev/agente

_El botón "?" dentro de la app corta el contenido justo antes de este encabezado._

- **Archivo(s) principal(es):** `src/pages/Contabilidad.tsx`, `src/components/ContabilityDashboard.tsx`, `src/hooks/useBI.ts` (KPIs y rangos).
- **Tablas Supabase involucradas:** `appointment_insumos`, `cuentas_contables`, `movimientos_contables`, `doctor_honorarios_config`.
- **RPCs/edge functions:** `registrar_insumos_cita()` (insert insumos + descuenta stock), `kpis_dashboard()` (retorna P&L), trigger PG en `movimientos` y `pharmacy_sales`.
- **Cómo agregar un tipo de egreso nuevo:** en migration, `INSERT INTO cuentas_contables (codigo, nombre, tipo, es_fijo) ...` — aparecerá automático en el dropdown.
- **Cómo agregar una regla de negocio nueva:** triggers en Postgres (`contab_*`) para automático, o policy RLS si necesita control de acceso.

_/aprende 2026-07-18_ — Fase 5 documentación módulo contable.
