# Gap analysis — Módulo Contable vs. CONTPAQi y herramientas contables MX

**Fecha:** 2026-07-18 · Investigación web (WebSearch), sin implementación.

## 1. Contexto e hipótesis de trabajo

La clínica ya paga un **contador externo** que lleva la contabilidad fiscal formal
(probablemente en CONTPAQi o Aspel COI, como hace el 90%+ de los despachos contables
en México). **Hipótesis de este análisis:** nuestro módulo contable (fases 1-4,
2026-07-18) NO necesita reemplazar a CONTPAQi — necesita darle a la dueña/gerente
información gerencial en tiempo real (P&L, flujo, KPIs) que hoy solo existe un mes
después, cuando el contador entrega sus reportes. Es un **panel de control interno**,
no un sistema fiscal.

Bajo esta hipótesis, el gap frente a CONTPAQi se divide en dos categorías muy distintas:
huecos que sí duelen para gestión diaria (N1) vs. huecos que solo importan si algún día
se quiere prescindir del contador o sustituir su software (N2).

## 2. Qué hace cada herramienta — resumen de la investigación

| Característica | CONTPAQi Contabilidad | Aspel COI | Alegra / Bind ERP (SaaS) | Nuestro módulo (clinica-mexico-spa) |
|---|---|---|---|---|
| Catálogo de cuentas c/ código agrupador SAT (Anexo 24) | Sí, 8 categorías (activo/pasivo/capital/resultados/costos/gastos/RIF/orden), hasta 9 niveles | Sí, hasta 20 dígitos y 9 niveles | Sí (Alegra, enfoque fiscal MX) | Catálogo simple `cuentas_contables` (tipo ingreso/egreso, es_fijo) — columna `codigo_sat` preparada, sin llenar |
| Pólizas y doble partida (debe/haber) | Sí, pólizas modelo/prepólizas, ligadas a CFDI | Sí, pólizas dinámicas desde lectura de CFDI | Parcial (Alegra genera asientos automáticos) | No — `movimientos_contables` es ingreso/egreso simple (partida simple), append-only |
| Conciliación bancaria | Sí (módulo Bancos aparte) | Sí | Sí, automática vía integración bancaria (Alegra) | No existe — hay corte de caja (turnos/cajas) pero sin conciliar contra estado de cuenta bancario |
| Contabilidad electrónica SAT (XML balanza, catálogo, pólizas — Anexo 24) | Sí, los 5 archivos, con verificación previa | Sí, XML+ZIP listos para buzón tributario | Alegra: exporta info fiscal, no XML Anexo 24 completo | No — explícitamente excluido, solo columna `codigo_sat` reservada |
| DIOT / IVA | Sí | Sí, un clic | Parcial (reportes de IVA, no DIOT directo en todas) | No existe |
| Balanza de comprobación | Sí | Sí (mensual/anual) | Sí (reporte simplificado) | No — existe `pnl_mensual` (P&L) pero no balanza por cuenta contable con saldos deudores/acreedores |
| Estado de resultados (P&L) | Sí | Sí | Sí | **Sí** — `pnl_mensual` |
| Balance general (estado de situación financiera) | Sí | Sí | Sí (básico) | No — excluido a propósito (Fase 2 futura) |
| Estado de flujo de efectivo | Sí | Sí | Parcial | **Sí** — `flujo_efectivo` (cobros/pagos reales) |
| CFDI vinculado a pólizas | Sí (automático) | Sí (automático) | Sí | Parcial — CFDI existe y alimenta `movimientos_contables` (origen=consulta/farmacia), pero no como póliza formal |
| Multiempresa / multiclínica | Sí | Sí | Sí | **Sí** — `clinic_id` + RLS en todo el módulo |
| Presupuestos | Sí (comparativo presupuesto vs. real) | Sí | Parcial (algunas ediciones) | No existe — no hay tabla de presupuesto ni comparativo |
| Depreciación de activos fijos | Sí | Sí (contable y fiscal) | Parcial | No existe |
| Nómina | Vía módulo aparte (CONTPAQi Nóminas) | Vía módulo aparte | Vía integración | Honorarios de doctores sí (`doctor_honorarios_config`); nómina administrativa = egreso manual |
| KPIs gerenciales (margen, punto de equilibrio, DSO/DPO/DIO, costo por consulta) | No — no es su enfoque | No | No (fuera de foco fiscal) | **Sí** — todo el bloque de KPIs de la Fase 4, esto es diferenciador nuestro, ninguna herramienta contable fiscal lo trae nativo |
| Costo de insumos snapshot por transacción | No aplica | No aplica | No | **Sí** — `appointment_insumos` con costo congelado al momento |

**Conclusión de la comparación:** CONTPAQi/Aspel COI/Alegra están optimizados para el
cumplimiento fiscal (SAT, DIOT, balance, depreciación); nuestro módulo está optimizado
para gestión operativa diaria de una clínica (margen por consulta, honorarios, punto de
equilibrio) que esas herramientas no cubren de fábrica. Son complementarios, no
sustitutos, mientras exista un contador externo.

## 3. Mínimo básico recomendado — dos niveles

### Nivel 1 (N1) — cerrar huecos gerenciales, el contador sigue siendo dueño de lo fiscal

Objetivo: que la gerencia no tenga que esperar al corte del contador para saber si algo
no cuadra, sin construir un sistema fiscal paralelo.

| Ítem | Por qué vale la pena | Esfuerzo |
|---|---|---|
| **Balanza simple** (saldo por `cuenta_contable` en un período, aunque sea solo ingreso/egreso sin debe/haber) | Hoy solo hay P&L consolidado; ver el desglose por cuenta ayuda a detectar errores de captura antes de que lleguen al contador | S — es una vista/RPC de agregación sobre tablas que ya existen |
| **Conciliación de corte de caja vs. estado de cuenta bancario** | Ya existe el plan de corte de caja (Opción B, `memoria/proyectos/project_corte-caja-arquitectura.md`) pero conciliar contra el banco real (no solo contra lo esperado del sistema) detecta fraude/errores de depósito | M — requiere importar/pegar el estado de cuenta (CSV/manual) y hacer match; no hay integración bancaria automática hoy |
| **Presupuesto mensual por cuenta + comparativo vs. real** | El punto de equilibrio ya existe; un presupuesto por cuenta (ej. "renta: $X/mes") permite alertar desviaciones antes de fin de mes | M — tabla `presupuestos` (cuenta_id, mes, monto) + vista comparativa, reutiliza `cuentas_contables` |
| **Reporte exportable "para el contador"** (CSV/Excel de `movimientos_contables` con columnas mapeadas a lo que pide un despacho: fecha, concepto, monto, cuenta, CFDI UUID si aplica) | Reduce fricción real hoy: el contador probablemente pide un Excel mensual de movimientos — si el sistema ya lo exporta, se ahorra captura doble | S — export existente en Fase 4 UI se extiende con columnas adicionales |
| **Alertas de cuentas sin `codigo_sat`** al cierre de mes | Prepara terreno para N2 sin comprometerse a construirlo ahora; barato de hacer | S |
| **Depreciación simple de activos fijos** (lista de activos, vida útil, gasto mensual calculado) | Si la clínica compra equipo médico caro, el gasto de depreciación mejora la precisión del P&L gerencial aunque no sea fiscalmente válido | M |

### Nivel 2 (N2) — solo si algún día se quiere prescindir del contador o de su software

Objetivo: nuestro sistema podría generar contabilidad fiscal formal. Esto es un cambio
de alcance grande, no una extensión incremental — implica volverse un sistema de
registro fiscal con todas las obligaciones legales que eso conlleva (Anexo 24, DIOT,
retención de responsabilidad ante el SAT).

| Ítem | Esfuerzo | Nota |
|---|---|---|
| **Doble partida (debe/haber) real** — migrar `movimientos_contables` a asientos con líneas debe/haber que cuadren a cero | L | Cambio de modelo de datos de fondo; el plan actual ya lo dejó posible ("el modelo permite migrar después") pero es refactor mayor, no aditivo |
| **Catálogo de cuentas con código agrupador SAT completo** (Anexo 24, 8 categorías, niveles) | M | La columna `codigo_sat` ya existe; falta poblar catálogo y mapear cada cuenta |
| **Contabilidad electrónica SAT** (XML balanza + catálogo + pólizas, envío a buzón tributario) | L | Requiere doble partida primero (N2 depende de este ítem), más lógica de generación XML conforme al esquema del SAT — normalmente un proveedor certificado (PAC) ya lo resuelve, reinventar esto es alto riesgo/bajo retorno |
| **Balance general (estado de situación financiera)** | M-L | Requiere doble partida y cuentas de activo/pasivo/capital, no solo ingreso/egreso |
| **DIOT** | M | Requiere identificar proveedores/terceros y IVA acreditable/trasladado por transacción — hoy no se captura ese detalle |
| **Nómina completa** (ISR, IMSS, subsidios) | L | Fuera del dominio actual (honorarios de doctores no son nómina patronal); construir esto es replicar un producto entero (CONTPAQi Nóminas, Aspel NOI) |
| **Conciliación bancaria automática** (feed bancario vía Open Banking/API) | L | Depende de proveedor bancario/agregador (Alegra/Bind lo resuelven con integraciones de terceros, no propias) |

## 3.5 Requisitos confirmados por Pablo (2026-07-18) — ya NO son opcionales N2

Pablo decidió que lo siguiente deja de ser "solo si se quiere reemplazar al contador"
y pasa a ser **requisito confirmado del sistema**, independientemente de que el
contador externo siga existiendo:

- **Modelo de pólizas y partidas** — cada movimiento se registra como una póliza
  (cabecera) con 2+ partidas (líneas) de cargo/abono que deben sumar cero.
- **Catálogo de cuentas con tipo + naturaleza** — cada cuenta tiene tipo (activo,
  pasivo, capital, ingreso, egreso) y naturaleza (deudora o acreedora), no solo
  ingreso/egreso simple.
- **Balanza de comprobación** — saldo inicial, cargos, abonos y saldo final por cuenta
  en un período, cuadrando entre sí (total cargos = total abonos).
- **Reportes básicos que CONTPAQi/Aspel COI consideran imprescindibles**: balanza de
  comprobación, auxiliares por cuenta, libro diario, libro mayor, estado de resultados,
  balance general.

### Modelo de datos típico (cómo lo estructuran CONTPAQi / Aspel COI / libros contables clásicos)

**Póliza (cabecera) — 1 fila por operación:**

| Campo | Descripción |
|---|---|
| `poliza_id` | PK |
| `fecha` | fecha de la operación |
| `numero_poliza` | folio único, correlativo por tipo |
| `tipo_poliza` | `ingreso` (entradas a banco/caja) \| `egreso` (salidas de banco/caja) \| `diario` (no mueve banco: devengos, ajustes, depreciación) |
| `concepto` | descripción del movimiento |
| `rfc_tercero` | RFC del cliente/proveedor relacionado (nullable) |
| `uuid_cfdi` | folio fiscal del CFDI relacionado (nullable) — el vínculo que pide el SAT en auditoría |
| `clinic_id` | multiclínica, ya existe el patrón en el proyecto |

**Partida (línea de la póliza) — N filas por póliza, deben cuadrar a 0:**

| Campo | Descripción |
|---|---|
| `partida_id` | PK |
| `poliza_id` | FK a la cabecera |
| `cuenta_id` | FK a `cuentas_contables` |
| `cargo_centavos` | monto al debe (0 si esta línea es abono) |
| `abono_centavos` | monto al haber (0 si esta línea es cargo) |
| `descripcion` | detalle de la línea (opcional, hereda de la póliza si vacío) |

Regla de integridad: `SUM(cargo_centavos) = SUM(abono_centavos)` por `poliza_id` — se
valida en el mismo INSERT transaccional (o con un CHECK/trigger), nunca a posteriori.

**Catálogo de cuentas — se le agregan 2 columnas al `cuentas_contables` actual:**

| Campo nuevo | Valores |
|---|---|
| `tipo` | `activo` \| `pasivo` \| `capital` \| `ingreso` \| `egreso` (reemplaza el actual `tipo: ingreso/egreso` binario) |
| `naturaleza` | `deudora` (activo, egreso — aumenta con cargos) \| `acreedora` (pasivo, capital, ingreso — aumenta con abonos) |

**Balanza de comprobación — vista/RPC derivada, no tabla nueva:**

Por cuenta y período: `saldo_inicial` (saldo final del período anterior) +
`SUM(cargo_centavos)` − `SUM(abono_centavos)` (si naturaleza deudora; invertido si
acreedora) = `saldo_final`. Se calcula agregando `partidas` filtradas por rango de
fecha vía `poliza.fecha`, no se persiste (igual que `pnl_mensual` hoy es una vista).

**Libro diario**: listado cronológico de pólizas con sus partidas (una póliza puede
imprimir varias líneas). **Libro mayor**: mismas partidas agrupadas por cuenta en vez
de por póliza, con saldo acumulado corrido. Ambos son reportes/vistas sobre las mismas
2 tablas (`polizas`, `partidas`) — no requieren almacenamiento adicional.

### Ruta de migración desde `movimientos_contables` (single-entry) actual

El objetivo es no perder lo ya registrado en Fases 1-4 ni reescribir los triggers que
alimentan el módulo (pago de consulta, venta farmacia, recepción de compra, honorarios).

1. **Cuenta puente temporal** — crear una cuenta contraparte por cada `origen` existente
   (ej. `1105 - Caja/Bancos operativo`, cuenta puente genérica de naturaleza deudora)
   para no tener que inventar la contrapartida real de cada movimiento histórico.
2. **Backfill**: cada fila histórica de `movimientos_contables` se convierte en 1
   póliza con 2 partidas: la cuenta original (`cuenta_id` de la fila) recibe cargo o
   abono según si era ingreso/egreso, y la cuenta puente recibe la partida contraria del
   mismo monto. Esto preserva el historial exacto sin re-capturar nada, a costa de que
   la cuenta puente no representa la realidad bancaria fina (aceptable para datos
   históricos; hacia adelante las pólizas nuevas sí deben ligar a la cuenta bancaria
   real cuando se sepa).
3. **Vistas de compatibilidad**: mantener `pnl_mensual` y `flujo_efectivo` funcionando
   durante la transición con una vista que replique la forma de `movimientos_contables`
   a partir de `partidas` (`SELECT cuenta_id, cargo_centavos - abono_centavos AS
   monto_centavos, ... FROM partidas JOIN polizas ...`), para no romper el dashboard
   existente mientras se reescriben sus fuentes.
4. **Triggers/RPCs existentes** (`registrar_insumos_cita`, devengo de honorarios, etc.)
   se adaptan para insertar pólizas de 2 partidas en vez de una fila de
   `movimientos_contables` — cambio de la capa de escritura, no del disparador de
   negocio (siguen disparando exactamente en los mismos eventos: pago de consulta, venta
   farmacia, recepción de compra, honorario devengado).
5. **Corte**: una vez migrado el backfill y las vistas de compatibilidad probadas,
   `movimientos_contables` se congela (solo lectura, para auditoría histórica) o se
   deprecacomo tabla y las vistas pasan a leer directo de `partidas`/`polizas`.

Este es insumo directo para la Fase 6 (a escribir por separado); aquí solo se deja
descrito el modelo y la ruta, sin implementar nada.

## 3.6 Obligación legal del contribuyente vs. funcionalidad de software

Marcado explícito (detalle legal completo en `contabilidad-marco-legal-mx.md`):

| Ítem | ¿Obligación LEGAL del contribuyente (CFF/NIF)? | ¿O solo funcionalidad de software? |
|---|---|---|
| Llevar contabilidad con partida doble, catálogo, balanza | **Legal** — NIF A-2 (dualidad económica) + CFF Art. 28 exigen esto de cualquier contribuyente con obligación contable, independiente del software usado | El software es el medio, no la obligación |
| Registrar dentro de los 5 días de la operación | **Legal** — Reglamento CFF Art. 33-34 | El sistema puede ayudar a cumplirlo (registro automático vía triggers), pero el plazo es del contribuyente |
| Conservar 5 años | **Legal** — Reglamento CFF | Backup/retención es responsabilidad de infraestructura, no una "característica contable" |
| Enviar XML mensual (catálogo + balanza) al SAT | **Legal, solo si el contribuyente es persona moral o persona física sobre el umbral** — CFF Art. 28 fracc. IV | Generar el XML con el esquema exacto del Anexo 24 es funcionalidad de software (N2, alto riesgo si se hace mal) |
| DIOT | **Legal** para quien tenga proveedores/terceros con IVA | Automatizarla es funcionalidad de software |
| Vincular UUID de CFDI a la póliza | **Legal** — lo exige el SAT en revisión | El campo `uuid_cfdi` en la póliza es la funcionalidad que lo habilita |
| Balance general, estado de resultados | **Legal** — son estados financieros básicos exigidos por NIF/normatividad mercantil | Generarlos automático de una vista es funcionalidad de software |
| KPIs gerenciales (margen, punto de equilibrio, DSO/DPO/DIO) | **NO es obligación legal** — no existe requisito fiscal ni contable que exija calcular punto de equilibrio o costo por consulta | 100% funcionalidad de software — es el valor agregado de nuestro módulo sobre lo que exige la ley |
| Presupuesto mensual, conciliación caja-banco, export "para el contador" | **NO es obligación legal** | 100% funcionalidad de software gerencial (N1) |
| Nómina (ISR, IMSS) | **Legal** (LISR, LSS) si hay empleados con relación laboral | Automatizar el cálculo es funcionalidad de software (fuera de alcance, ver plan original) |

## 4. Recomendación final

- **No construir N2 ahora.** El costo/beneficio no cierra mientras exista un contador
  externo pagando CONTPAQi/Aspel — sería duplicar un producto maduro y certificado, con
  riesgo legal (Anexo 24 mal generado = problema con el SAT) y sin necesidad de negocio
  clara.
- **N1 es el siguiente paso natural** después de las Fases 1-4 ya implementadas: son
  extensiones pequeñas/medianas sobre tablas que ya existen (`cuentas_contables`,
  `movimientos_contables`), no una arquitectura nueva. El ítem de mayor retorno
  inmediato es el **export "para el contador"** (barato, reduce fricción real hoy) y la
  **balanza simple** (barato, detecta errores antes de que lleguen al despacho).
- Priorizar dentro de N1 en este orden por esfuerzo/impacto: (1) reporte export
  contador, (2) balanza simple, (3) alertas codigo_sat faltante, (4) presupuesto
  mensual, (5) conciliación banco vs. caja, (6) depreciación simple.

## 5. Fuentes

- [Conoce lo que CONTPAQi® Contabilidad puede hacer por ti](https://www.compuflash.mx/caracteristicas-contpaq-contabilidad)
- [CONTPAQi Contabilidad® — sitio oficial de contenidos](https://contenidos.contpaqi.com/contabilidad)
- [Catálogo de cuentas — CONTPAQi Comercial](https://conocimiento.blob.core.windows.net/conocimiento/Manuales/CONTPAQi_Comercial_Start_Pro/catalogo_de_cuentas.html)
- [Aspel-COI | Incosistemas](https://www.incosistemas.com/aspel-coi)
- [Nuevo Aspel COI 11.0 — AspelSoluciones](https://www.aspelsoluciones.com/aspel-coi)
- [Automatiza tu Contabilidad con Aspel COI 10.0](https://consultoriati.com.mx/automatiza-tu-contabilidad-con-aspel-coi-10/)
- [Software de contabilidad en México 2026: mejores opciones para pymes](https://programascontabilidad.com/comparativas-de-software/software-de-contabilidad-mexico/)
- [Alegra — Software Contable para pymes y contadores en México](https://www.alegra.com/mexico/contabilidad/)
- [Alegra vs CONTPAQi 2026: precios, nube y opiniones](https://blog.alegra.com/mexico/alegra-vs-contpaqi/)
- [Alegra vs Bind ERP México 2026](https://programascontabilidad.com/comparativas-de-software/bind-erp-alegra/)
- [¿Cómo conciliar tus bancos conectados en Alegra?](https://ayuda.alegra.com/mex/conciliacion-bancaria-a-facturas)
- Documentos internos: `docs/superpowers/plans/2026-07-18-modulo-contable.md`, `CLAUDE.md` (sección "Módulo Contable")
- [Pólizas contables electrónicas: ¿Cómo estructurarlas según el SAT? — CONTPAQi](https://www.contpaqi.com/publicaciones/tendencias-fiscales/polizas-contables-electronicas-como-estructurarlas-segun-el-sat)
- [Relacionando UUID con Pólizas: Guía para la Contabilidad Electrónica](https://www.studocu.com/es-mx/document/universidad-mexicana-sc/computacion-administrativa/uuid-en-las-polizas-uuid-en-las-polizas/26541317)
- Ver además marco legal completo en `contabilidad-marco-legal-mx.md` (NIF A-2, CFF Art. 28, Reglamento CFF Art. 33-34, obligación de envío mensual, facultades de comprobación del SAT)
