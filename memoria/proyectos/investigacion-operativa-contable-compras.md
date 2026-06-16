# Investigación Operativa y Contable: Ciclo de Compras para Farmacia/Clínica en México

**Fecha:** 2026-06-15
**Sistema de referencia:** integrika.mx
**Alcance:** Normativa NIF, COFEPRIS, benchmarks ERP (SAP B1, Odoo 17, QuickBooks), COSO 2013, gaps priorizados

---

## 1. Normas de Información Financiera (NIF) Aplicables

### 1.1 NIF C-4 — Inventarios (norma central)

La **NIF C-4** emitida por el CINIF es la norma rector para el reconocimiento, valuación, presentación y revelación de inventarios en México. Para una farmacia o clínica pequeña, sus disposiciones más relevantes son:

#### Métodos de valuación permitidos
- **Costo promedio ponderado**: El método más usado en farmacias pequeñas por su simplicidad operativa. El costo promedio se recalcula en cada entrada de mercancía. El sistema integrika.mx debe verificar que usa este método de manera consistente.
- **PEPS (Primeras Entradas, Primeras Salidas / FIFO)**: Permitido por NIF C-4 y especialmente adecuado en farmacia ya que coincide naturalmente con el principio FEFO (First Expired, First Out) requerido por COFEPRIS. Sin embargo, su implementación correcta requiere un kardex detallado por lote y fecha.
- **UEPS (LIFO)**: **Prohibido** tanto por NIF C-4 como por IAS 2. Ningún sistema farmacéutico debe implementarlo.
- **Costo específico**: Aplicable para bienes diferenciados de alto valor unitario (equipos médicos, implantes), no para medicamento de consumo masivo.

#### Reconocimiento inicial
Los inventarios deben registrarse al **costo de adquisición**, que incluye:
- Precio de compra neto (facturas de proveedor menos descuentos comerciales)
- Fletes, seguros y otros costos directamente atribuibles al traslado
- Impuestos no recuperables (IVA no acreditable si aplica)

**Nota crítica para integrika.mx**: El IVA pagado en compras de medicamentos gravados a 0% o exentos tiene tratamiento especial que debe configurarse correctamente en el módulo de CxP.

#### Valuación posterior y deterioro
La NIF C-4 exige que al cierre de cada período se evalúe si el valor en libros excede el **Valor Neto Realizable (VNR)**. Si existe deterioro (medicamentos próximos a caducar, dañados, de lento movimiento), se debe:
1. Reconocer una **provisión por deterioro** (cargo a resultados, acreedor a "Provisión por deterioro de inventarios")
2. Cuando se destruyen físicamente, reversar la provisión contra la baja del inventario

#### Reconocimiento de mermas
La NIF C-4 establece que **todas las pérdidas en inventarios se reconocen en resultados** en el período en que ocurren. Tipos de merma en farmacia:
- **Merma normal**: Pérdidas esperadas dentro de parámetros operativos normales → se incluyen en el costo de ventas
- **Merma anormal**: Robos, daños excepcionales, vencimientos masivos → se reconocen como gasto del período separado del costo de ventas, con revelación en notas

**Implicación para el sistema**: El Acta de Merma firmada con PIN supervisor cubre el aspecto operativo, pero el sistema debe generar automáticamente el asiento contable diferenciando merma normal vs. anormal.

### 1.2 NIF D-2 — Costos por Contratos con Clientes

La **NIF D-2** (vigente desde 2021, convergente con IFRS 15) aplica cuando la farmacia tiene contratos con clientes (hospitales, empresas, aseguradoras) que incluyen obligaciones de desempeño múltiples. Para el ciclo OC→recepción→costo de ventas:

- Los costos que **sí** producen inventario se rigen por NIF C-4
- Los costos de cumplir contratos que **no** generan inventario (logística especial, empaque personalizado) se rigen por NIF D-2
- El flujo correcto es: **OC aprobada → Recepción FEFO por lote → Costo al kardex → Reconocimiento en costo de ventas al momento de la dispensación/venta**

### 1.3 NIF C-19 — Instrumentos Financieros por Pagar

Las **Cuentas por Pagar a Proveedores (CxP)** se rigen por **NIF C-19**, vigente desde enero 2018. Puntos clave:

- **Reconocimiento inicial**: Al valor razonable de los bienes/servicios recibidos, que en la práctica es el valor nominal de la factura acordada
- **Medición posterior**: Al costo amortizado usando la tasa de interés efectiva. Para CxP a menos de 12 meses, se puede usar el valor nominal (sin amortizar)
- **Devengación**: Aunque el proveedor no haya timbrado el CFDI, si el bien fue recibido (la recepción de mercancía existe en el sistema), la CxP se debe reconocer devengada
- **Descuentos por pronto pago**: Se reconocen como reducción del costo cuando se hacen efectivos (no al momento de la compra)

**Implicación para integrika.mx**: El sistema hace 3-way match OC+recepción+factura, lo cual es correcto. Sin embargo, debe asegurar que cuando la recepción se registra antes del CFDI del proveedor, se cree automáticamente una CxP provisional (acumulada devengada) que se sustituye por la CxP definitiva al recibir y timbrar el CFDI.

### 1.4 NIF A-2 — Postulados Básicos (marco subyacente)

Tres postulados de NIF A-2 son directamente relevantes para el ciclo de compras:

- **Devengación contable**: Los efectos de las transacciones se reconocen cuando ocurren, no cuando se cobra/paga. La recepción de mercancía activa la CxP aunque no haya CFDI.
- **Asociación de costos y gastos con ingresos**: El costo del medicamento se reconoce cuando se vende (devengo del ingreso). FIFO/Promedio son los mecanismos para esta asociación.
- **Consistencia**: La entidad debe aplicar el mismo método de valuación de inventarios período a período; cambios requieren revelación y ajuste retrospectivo.

### 1.5 NIF B-10 — Efectos de la Inflación

Aunque México salió de entorno inflacionario en periodos recientes, si la inflación acumulada en tres años supera el 26%, la **NIF B-10** exige reexpresar los estados financieros. Las farmacias con inventarios significativos deben monitorear este umbral, pues afecta el costo de ventas reexpresado.

### 1.6 NIF C-9 — Provisiones, Contingencias y Compromisos

Aplica para reconocer:
- Provisiones por devoluciones estimadas a proveedores
- Contingencias por sanciones COFEPRIS pendientes de resolución
- Compromisos de compra bajo contratos con proveedores (contratos marco)

### 1.7 NIF C-16 — Deterioro de Activos de Larga Duración

Para equipos de refrigeración, cámaras frigoríficas y mobiliario de almacén farmacéutico que puede deteriorarse, aplica NIF C-16 para el reconocimiento de pérdidas por deterioro de activos fijos relacionados con el almacén.

---

## 2. Normativa COFEPRIS y Farmacéutica

### 2.1 Buenas Prácticas de Almacenamiento (BPA)

**NOM-059-SSA1-2015 — Buenas Prácticas de Fabricación de Medicamentos**
Aunque está orientada principalmente a fabricantes, establece los estándares de referencia para el almacenamiento correcto que los distribuidores y farmacias deben cumplir en la cadena de custodia. Exige:
- Almacenamiento en condiciones de temperatura y humedad controladas con registro continuo (bitácoras de temperatura)
- Separación física de medicamentos aprobados, rechazados, en cuarentena y devueltos
- Identificación clara de zonas de almacenamiento
- Procedimientos escritos (POE) para recepción, almacenamiento y despacho

**NOM-072-SSA1-2012 — Etiquetado de Medicamentos**
Establece los requisitos mínimos que debe verificar el sistema al recibir mercancía:
- Nombre genérico y denominación distintiva
- Número de lote, fecha de fabricación y fecha de caducidad
- Condiciones especiales de almacenamiento (cadena de frío, protección de luz)
- Número de registro sanitario

**Implicación para integrika.mx**: La recepción de mercancía debe validar que el CFDI del proveedor y la etiqueta física coincidan en número de lote, fecha de caducidad y número de registro sanitario.

### 2.2 Guía COFEPRIS para Almacenes de Distribución

La **Guía para Almacenes de Depósito y Distribución de Medicamentos** (COFEPRIS, disponible en gob.mx) establece que los establecimientos deben:
- Mantener registros por lote de todos los medicamentos recibidos, almacenados y dispensados
- Tener un sistema de trazabilidad que permita localizar y retirar cualquier lote en menos de 24 horas ante una alerta sanitaria
- Documentar las condiciones de temperatura durante toda la estadía del medicamento
- Registrar las mermas, destrucciones y devoluciones con justificación firmada por el Responsable Sanitario

**Principio FEFO obligatorio**: COFEPRIS requiere que los medicamentos con menor vida útil restante se dispensen primero. El sistema integrika.mx tiene implementado FEFO en la recepción por lote, lo cual es correcto y necesario.

### 2.3 Medicamentos Controlados: Psicotrópicos y Estupefacientes

Esta área es la de **mayor riesgo de incumplimiento regulatorio** para cualquier farmacia:

#### Libros de Control (trámite COFEPRIS-03-005)
Todas las farmacias que manejan medicamentos controlados (Fracciones I, II, III de la LGS) deben obtener permiso de libros de control. Los libros deben registrar:
- Entradas: proveedor, número de factura, lote, cantidad, fecha
- Salidas: número de receta, médico prescriptor, cédula profesional, paciente, cantidad
- Existencia: balance permanente (entradas - salidas = existencia en libro = existencia física)
- Destrucciones/mermas: acta circunstanciada con firma del Responsable Sanitario y testigos

#### Sistema Integral de Sustancias (COFEPRIS, 2024)
En 2024, COFEPRIS implementó una plataforma digital para el control y vigilancia de sustancias reguladas en tiempo real, incluyendo psicotrópicos y estupefacientes. Las farmacias con permiso deben reportar digitalmente sus movimientos.

#### Requisitos del Responsable Sanitario
- Firma obligatoria en todas las entradas y salidas de controlados
- Presencia física durante auditorías COFEPRIS
- Responsabilidad personal por inconsistencias entre libro y existencia física

**Brecha crítica identificada**: El sistema integrika.mx no documenta si tiene módulo diferenciado para el libro de control de psicotrópicos/estupefacientes. Este es un **gap de alta criticidad** que debe implementarse.

### 2.4 Qué Registrar para Pasar una Auditoría COFEPRIS

Una inspección COFEPRIS a una farmacia típicamente revisa:

| Aspecto | Documento/Registro Requerido |
|---------|------------------------------|
| Licencia sanitaria | Vigente y visible |
| Responsable sanitario | Aviso vigente, horario |
| Medicamentos controlados | Libro de control actualizado |
| Cadena de frío | Bitácora de temperatura (registrador continuo) |
| Lotes próximos a caducar | Área de cuarentena con etiqueta |
| Medicamentos vencidos | Acta de destrucción firmada |
| Recepción de mercancía | Facturas con número de lote |
| Devoluciones | Documentación de motivo y cantidad |
| Trazabilidad lotes | Capacidad de rastreo en <24 horas |

### 2.5 Obligaciones de Pérdidas/Mermas de Controlados

Las mermas de controlados (psicotrópicos/estupefacientes) tienen un procedimiento especial:
1. Comunicación inmediata al Responsable Sanitario
2. Levantamiento de acta circunstanciada con fecha, cantidad, motivo, testigos
3. Reporte a COFEPRIS (para cantidades que excedan umbrales reglamentarios)
4. Ajuste simultáneo en libro de control y en el sistema ERP
5. Conservación del acta por al menos 5 años

---

## 3. Benchmarks ERP: Funcionalidades de Referencia

### 3.1 SAP Business One — Módulo MM/Purchasing

SAP B1 es el ERP de referencia para PyMEs con procesos complejos de compras. Sus controles que integrika.mx podría no tener:

#### Flujo completo documentado
`Solicitud de Compra (interna) → Solicitud de Cotización (RFQ) → Oferta Comparativa → Orden de Compra → GRPO (Goods Receipt PO) → Factura de Proveedor → Pago`

El sistema integrika.mx parece iniciar en OC directamente, **sin el paso previo de Solicitud de Compra** (Requisición interna) ni comparativa de cotizaciones.

#### Aprobaciones multi-nivel por monto
SAP B1 permite configurar matrices de aprobación:
- Hasta MXN 5,000: aprueba supervisor de turno
- MXN 5,001 - 50,000: aprueba gerente de compras
- Más de MXN 50,000: requiere dirección general

Esta configuración es automática y bloquea el flujo hasta recibir la firma electrónica del nivel correspondiente.

#### Presupuesto de compras
SAP B1 permite asignar presupuesto por centro de costo y categoría de artículo. Al crear una OC, verifica automáticamente si hay presupuesto disponible y alerta o bloquea según configuración.

#### Tolerancias configurables en 3-way match
El sistema puede configurar tolerancias permitidas:
- Diferencia de precio: ±2%
- Diferencia de cantidad: ±1 unidad por lote
Si la factura excede la tolerancia, se bloquea automáticamente para revisión manual.

#### Historial de precio de compra vs. precio de lista
SAP B1 muestra alertas cuando el precio de una factura supera el precio acordado en la orden de compra, y permite ver el historial de precios del proveedor para detectar incrementos inusuales.

#### Gestión de anticipos y pagos parciales
Módulo para registrar anticipos a proveedores, aplicarlos contra facturas futuras y gestionar notas de crédito.

### 3.2 Odoo 17 — Purchase + Inventory

Odoo 17 tiene un módulo de compras muy maduro con funcionalidades relevantes:

#### Solicitudes de cotización (RFQ) y comparativa
Permite enviar la misma solicitud a múltiples proveedores y comparar respuestas en una matriz de decisión antes de confirmar la OC.

#### Flujos de aprobación configurables
Reglas de aprobación basadas en monto, categoría de producto, proveedor nuevo vs. existente.

#### Evaluación de proveedores integrada
Sistema de rating 1-5 estrellas por criterios con pesos configurables (precio, entrega, calidad, comunicación). El rating aparece automáticamente en las RFQ y OC para orientar la decisión de compra. integrika.mx tiene KPIs de evaluación de proveedores, pero Odoo los integra directamente en el flujo de selección.

#### Reabastecimiento automático
Basado en stock mínimo/máximo, genera automáticamente solicitudes de compra o RFQs sin intervención manual, con aprobación requerida antes de enviar al proveedor.

#### Integración contable automática
Al validar una factura de proveedor, Odoo genera automáticamente los asientos contables:
- Débito: Inventario (cuenta de activo)
- Crédito: Cuentas por Pagar
- Separación automática de IVA acreditable

#### Portal de proveedores
Módulo que permite al proveedor confirmar la OC, subir su factura digital y consultar el estado de pago directamente, reduciendo comunicación por email.

### 3.3 QuickBooks Enterprise — Purchase Order → Bill → Payment

QuickBooks Enterprise tiene un flujo simplificado pero con controles importantes:

- Las **OC son transacciones no-contabilizadas** que reservan presupuesto pero no afectan el libro mayor hasta que se recibe la mercancía o se registra la factura
- El **Vendor Center** centraliza: saldo pendiente, historial de transacciones (facturas, pagos, OC), y permite configurar alertas de vencimiento
- Permite **programar pagos** con anticipación para gestión de flujo de efectivo
- Funcionalidad de **duplicados**: detecta automáticamente facturas con el mismo número o monto del mismo proveedor en períodos cercanos

**Brecha frente a integrika.mx**: QuickBooks es más débil en trazabilidad por lote e inventario FEFO, áreas donde integrika.mx aparenta estar mejor configurado.

### 3.4 Funcionalidades Estándar de Industria Ausentes o No Documentadas

| Funcionalidad | SAP B1 | Odoo 17 | QB Ent. | integrika.mx |
|--------------|--------|---------|---------|--------------|
| Solicitud de compra/requisición interna | ✓ | ✓ | ✓ | No documentado |
| Solicitud de cotización multi-proveedor | ✓ | ✓ | Limitado | No documentado |
| Comparativa de cotizaciones | ✓ | ✓ | No | No documentado |
| Aprobación multi-nivel por monto | ✓ | ✓ | Limitado | No documentado |
| Control presupuestal por categoría | ✓ | ✓ | Limitado | No documentado |
| Portal de proveedores | ✓ | ✓ | No | No documentado |
| Anticipos a proveedores | ✓ | ✓ | ✓ | No documentado |
| Detección automática facturas duplicadas | ✓ | ✓ | ✓ | No documentado |
| Libro control psicotrópicos | No (add-on) | No (add-on) | No | No documentado |
| Bitácora temperatura (cadena frío) | No (IoT) | No (IoT) | No | No documentado |
| Reporte COFEPRIS automático | No | No | No | No documentado |

---

## 4. Control Interno COSO 2013 Aplicado al Ciclo de Compras

### 4.1 Riesgos de Fraude más Comunes en Compras de Farmacia

El ACFE (Association of Certified Fraud Examiners) y el IIA identifican los siguientes esquemas de fraude como los más frecuentes en el ciclo de compras de empresas pequeñas del sector salud:

#### Esquemas de proveedor fantasma (Ghost Vendor)
Un empleado crea un proveedor ficticio en el sistema, genera OC y CxP hacia ese proveedor, y aprueba el pago a una cuenta bancaria que controla. En farmacias, esto suele ocurrir con proveedores de servicios (limpieza, mantenimiento, mensajería) más que con medicamentos, porque los medicamentos tienen trazabilidad física.

**Control requerido**: El alta de proveedores debe estar separada de la capacidad de crear OC y de aprobar pagos. El sistema debe requerir validación de RFC ante el SAT antes de activar un proveedor.

#### Facturas duplicadas
El mismo CFDI se registra dos veces, o se crea un CFDI manual paralelo al timbrado. El comprador cómplice aprueba ambos pagos.

**Control requerido**: Verificación automática de UUID del CFDI contra el SAT (ya está en integrika.mx según el contexto), y bloqueo de CxP con UUID ya registrado.

#### Kickbacks (sobornos del proveedor)
El comprador favorece a cierto proveedor a cambio de comisiones. Esto se manifiesta en precios por encima del mercado, calidad inferior, o selección sin proceso competitivo.

**Control requerido**: Comparativa de cotizaciones obligatoria para compras mayores a cierto monto, y sistema de evaluación de precios vs. referencias de mercado.

#### Robo de inventario con documentación falsificada
Un empleado retira medicamentos del almacén y genera actas de merma o devoluciones falsas para cuadrar el inventario.

**Control requerido**: Las mermas deben requerir aprobación de un supervisor **distinto** al empleado que las reporta, con conteo físico de verificación independiente.

#### Recepción parcial con pago total
Se recibe menos unidades de las facturadas pero se aprueba el pago completo. El encargado de almacén es cómplice.

**Control requerido**: El 3-way match automático que ya tiene el sistema es el control correcto, pero debe ser inviolable (no debe poderse aprobar una factura si la cantidad recibida es menor a la facturada, sin una nota de crédito del proveedor).

### 4.2 Segregación de Funciones Requerida

Bajo COSO 2013 y mejores prácticas del IIA, en el ciclo de compras de una farmacia pequeña se deben separar al menos las siguientes funciones:

| Función | Rol que puede realizar | Rol que NO puede realizar |
|---------|----------------------|---------------------------|
| Dar de alta proveedores | Administración/Contabilidad | Comprador, almacenista, pagador |
| Crear solicitud de compra | Cualquier área usuaria | Contabilidad, pagador |
| Aprobar OC (nivel 1) | Supervisor de área | Quien crea la OC |
| Aprobar OC (nivel 2, montos altos) | Gerente/Director | Supervisor de área |
| Recibir mercancía física | Almacenista | Comprador, contabilidad, pagador |
| Registrar recepción en sistema | Almacenista o farmacéutico | Comprador |
| Validar 3-way match | Contabilidad | Almacenista, comprador |
| Autorizar pago CxP | Dirección/Gerencia | Contabilidad, comprador |
| Ejecutar el pago (banco) | Dirección | Contabilidad |
| Registrar la merma | Farmacéutico/Almacenista | Persona que la aprueba |
| Aprobar acta de merma | Supervisor con PIN | Quien registra la merma |
| Realizar inventario cíclico | Conteo ciego por persona independiente | Almacenista regular |

### 4.3 Controles Preventivos vs. Detectivos

#### Controles Preventivos (evitan que el fraude ocurra)
- Flujo de aprobación multi-nivel en OC configurado en sistema
- Validación de RFC/UUID del CFDI contra SAT en tiempo real
- Límites de monto por usuario configurados en roles del sistema
- Alta de proveedor requiere documentación: RFC, CLABE, cuenta bancaria, licencia sanitaria del proveedor
- Contraseña/PIN diferente para cada función crítica del sistema

#### Controles Detectivos (identifican el fraude después de ocurrido)
- Inventario cíclico con conteo ciego (ya implementado en integrika.mx)
- Revisión mensual de proveedores dados de alta vs. RF validados en SAT
- Análisis de variaciones de precio por proveedor (compras actuales vs. historial)
- Reporte de OC sin factura después de X días (mercancía recibida no facturada)
- Reporte de facturas sin recepción asociada (cobros por lo que no se recibió)
- Auditoría de accesos al sistema: quién aprobó qué, cuándo y desde dónde
- Conciliación mensual de saldos CxP vs. estados de cuenta de proveedores
- Análisis de patrones: mismo proveedor, monto similar repetido en cortos períodos

### 4.4 Vulnerabilidades de Control Interno en el Flujo Actual

Basado en el contexto del sistema descrito, se identifican estas vulnerabilidades potenciales:

1. **Sin requisición interna previa a la OC**: No hay evidencia de que el proceso comience con una necesidad documentada por el área usuaria, lo que abre la posibilidad de compras no justificadas.

2. **Sin aprobación multi-nivel documentada**: El flujo borrador→confirmada→recibida no especifica quién puede confirmar y a qué montos. Si una sola persona puede crear Y confirmar una OC, hay conflicto de funciones.

3. **Sin comparativa de cotizaciones**: No se documenta el proceso de selección del proveedor. Compras directas sin cotización competitiva son el escenario perfecto para kickbacks.

4. **Sin validación de proveedor nuevo**: No se describe un proceso formal de alta y validación de proveedores (due diligence de proveedor).

5. **Mermas con PIN supervisor**: Positivo que requiere PIN, pero si el supervisor y el almacenista están en turno juntos sin supervisión independiente, el control es débil.

6. **Sin libro de controlados separado**: Para psicotrópicos/estupefacientes, el inventario regular no es suficiente; COFEPRIS exige libro de control separado.

---

## 5. Gaps Identificados: Lista Priorizada

### 5.1 Resumen Ejecutivo de Brechas

El sistema integrika.mx tiene una base sólida con 3-way match, FEFO por lote, evaluación de proveedores y CFDI timbrado. Las brechas más relevantes están en: (a) controles de prevención de fraude en el proceso de selección y aprobación, (b) cumplimiento regulatorio para controlados, y (c) integración contable automática de algunos eventos.

---

## Tabla de Gaps Priorizados

| # | Gap | Criticidad | Norma/Referencia | Descripción | Esfuerzo de Implementación |
|---|-----|-----------|-----------------|-------------|---------------------------|
| 1 | **Libro de control de psicotrópicos y estupefacientes** | **ALTA** | LGS Art. 237-240; COFEPRIS-03-005; Reglamento de Insumos para la Salud Art. 47 | Módulo separado para medicamentos Fracción I/II/III con registro de entrada (factura+lote), salida (receta+paciente+médico), balance permanente, reporte a COFEPRIS. Inconsistencia entre libro y físico es causa de clausura. | Alto — módulo nuevo, integrado con inventario existente |
| 2 | **Flujo de aprobación multi-nivel por monto en OC** | **ALTA** | COSO 2013 Control Activities; IIA GTAG 13; SAP B1 best practice | Configurar matriz de aprobación: nivel 1 (supervisor, hasta X MXN), nivel 2 (gerente, hasta Y MXN), nivel 3 (director, montos mayores). La OC no puede confirmarse sin la firma electrónica del nivel correspondiente. | Medio — configuración de roles y workflow en sistema |
| 3 | **Validación automática de RFC de proveedor vs. SAT (69B)** | **ALTA** | CFF Art. 69-B; SAT lista de operaciones inexistentes; NIF C-19 | Al dar de alta un proveedor, consultar automáticamente el SAT para verificar: RFC activo, no en lista negra Art. 69-B (EFOS/EDOS). Previene deducción de facturas de proveedores ficticios. | Medio — API SAT disponible, requiere integración |
| 4 | **Solicitud de compra/requisición interna previa a OC** | **ALTA** | COSO 2013 Control Environment; IIA GTAG 13 segregación | Cualquier OC debe originarse en una solicitud de compra aprobada por el área usuaria. Esto crea la trazabilidad: necesidad → aprobación → cotización → OC → recepción → pago. Sin este paso, las compras pueden no estar justificadas. | Medio — flujo nuevo antes de la OC existente |
| 5 | **Proceso formal de alta y validación de proveedores** | **ALTA** | COSO 2013 Risk Assessment; ACFE Fraud Prevention | Checklist obligatorio al dar de alta proveedor nuevo: RFC+constancia SAT, CLABE bancaria verificada, licencia sanitaria vigente (COFEPRIS), referencias comerciales. Un usuario de Compras no puede darse de alta a sí mismo proveedores. | Medio — formulario + flujo de aprobación separado |
| 6 | **Bitácora de temperatura para cadena de frío** | **ALTA** | NOM-059-SSA1-2015; COFEPRIS Guía Almacenes; BPA | Para medicamentos que requieren refrigeración (vacunas, insulinas, biotecnológicos), registro continuo de temperatura con alarma automática al salir del rango. Integración con sensores IoT o registro manual con aprobación de responsable sanitario. | Alto — hardware + integración IoT o proceso manual documentado |
| 7 | **CxP provisional devengada (recepción sin CFDI)** | **ALTA** | NIF C-19; NIF A-2 postulado de devengación | Cuando se registra recepción de mercancía pero el proveedor aún no ha timbrado el CFDI, el sistema debe generar automáticamente una CxP provisional (accrual) en contabilidad. Al llegar el CFDI, la provisional se cancela y se genera la CxP definitiva. | Medio — asiento automático en módulo contable |
| 8 | **Comparativa de cotizaciones multi-proveedor** | **MEDIA** | COSO 2013 Risk Assessment; IIA; SAP B1/Odoo 17 best practice | Para OC mayores a un monto umbral (ej. MXN 10,000), requerir al menos 3 cotizaciones de proveedores distintos y documentar el criterio de selección. Esto previene kickbacks y garantiza precio de mercado. | Medio — módulo de RFQ y matriz de comparación |
| 9 | **Detección automática de CFDI duplicado** | **MEDIA** | CFF; NIF C-19; SAT CFDI UUID único | Verificar que el UUID del CFDI recibido no haya sido registrado antes en el sistema (mismo o diferente período). Bloquear el ingreso si es duplicado. Previene doble pago. | Bajo — validación en módulo CxP al registrar CFDI |
| 10 | **Asiento contable automático de merma normal vs. anormal** | **MEDIA** | NIF C-4 §42-47; NIF A-2 | El acta de merma debe generar automáticamente el asiento diferenciando: merma normal → costo de ventas; merma anormal → gastos del período (cuenta separada). La clasificación debe quedar en el acta con aprobación del contador. | Bajo — lógica de clasificación + asiento automático |
| 11 | **Reporte de OC pendientes de recepción por antigüedad** | **MEDIA** | COSO 2013 Monitoring Activities; IIA | Dashboard/reporte de OC confirmadas sin recepción después de X días (ej. 15 días). Alerta automática al gerente de compras para follow-up con proveedor o cancelación. Evita OC abiertas permanentemente que distorsionan compromisos. | Bajo — consulta/reporte sobre datos existentes |
| 12 | **Evaluación de proveedor integrada en selección de OC** | **MEDIA** | Odoo 17 best practice; KPI proveedor | El score del proveedor (ya calculado) debe mostrarse automáticamente al crear una OC y alertar si el proveedor tiene rating bajo. No bloquear, pero requerir justificación para usar proveedores con mala evaluación. | Bajo — integración de KPI existente en pantalla de OC |
| 13 | **Portal o confirmación electrónica de OC por proveedor** | **MEDIA** | SAP B1/Odoo best practice; COSO 2013 | Mecanismo para que el proveedor confirme la OC (por email, portal o WhatsApp Business API) y registre la fecha estimada de entrega. Esto genera un registro de compromiso exigible y reduce disputas en recepción. | Alto — portal externo o integración API |
| 14 | **Control presupuestal por categoría de compra** | **MEDIA** | COSO 2013 Control Activities; SAP B1 | Asignar presupuesto mensual/anual por categoría (medicamentos, material de curación, papelería, servicios). El sistema debe alertar cuando una OC lleva el gasto de categoría a >80% del presupuesto, y bloquear si lo supera (con excepción autorizada). | Alto — módulo presupuestal, puede requerir desarrollo |
| 15 | **Reporte automático de mermas de controlados a COFEPRIS** | **MEDIA** | LGS Art. 237; Reglamento de Insumos para la Salud | Cuando se registra una merma de medicamento controlado, generar automáticamente el borrador del reporte reglamentario para COFEPRIS, con los campos requeridos (cantidad, lote, motivo, fecha). El responsable sanitario lo revisa y envía. | Alto — integración con plataforma COFEPRIS o exportación estructurada |
| 16 | **Auditoría de log de accesos y cambios en datos maestros** | **MEDIA** | COSO 2013 Monitoring; IIA GTAG 1; SOX basis | Registro inmutable (append-only) de: cambios en datos de proveedores (CLABE, dirección), modificaciones de precios en OC confirmadas, cambios en cantidades de recepción. Accesible solo para auditoría interna/dirección. | Bajo — tabla de log, activar en módulos críticos |
| 17 | **Nota de crédito obligatoria para diferencias en 3-way match** | **BAJA** | NIF C-19; SAP B1 best practice | Si la factura excede en cantidad o precio lo recibido/acordado en OC, el sistema debe bloquear el pago y generar automáticamente una solicitud de nota de crédito al proveedor, con folio de seguimiento hasta su resolución. | Bajo — lógica adicional en módulo 3-way match existente |
| 18 | **Control de anticipos a proveedores** | **BAJA** | NIF C-19; NIF C-4; SAP B1/QB best practice | Módulo para registrar anticipos pagados a proveedores (depósitos por pedidos especiales), generar un activo temporal en balance, y aplicar automáticamente contra la CxP cuando llega la factura. Sin este control, los anticipos se pierden en cuentas genéricas. | Medio — submodulo de anticipos en CxP |
| 19 | **Conciliación automática CxP vs. estado de cuenta proveedor** | **BAJA** | COSO 2013 Monitoring; NIF C-19 | Módulo o proceso mensual para conciliar el saldo que el sistema muestra como CxP con el proveedor vs. el estado de cuenta que el proveedor envía. Las diferencias deben documentarse y resolverse. | Medio — proceso de conciliación + pantalla de diferencias |
| 20 | **Evaluación de riesgo de concentración de proveedor** | **BAJA** | COSO 2013 Risk Assessment; BCP (continuidad) | Reporte que muestre qué porcentaje del gasto total va a cada proveedor. Si un solo proveedor representa >40% del gasto en una categoría crítica, alertar como riesgo de concentración para diversificar fuentes de suministro. | Bajo — reporte analítico sobre datos existentes |

---

## 6. Conclusiones y Prioridades de Implementación

### Corto plazo (0-3 meses, impacto regulatorio crítico)
1. **Libro de control de psicotrópicos** — riesgo de clausura COFEPRIS
2. **Validación de RFC vs. SAT 69B** — riesgo fiscal (deducción de facturas inexistentes)
3. **CxP provisional devengada** — cumplimiento NIF C-19
4. **Detección automática de CFDI duplicado** — prevención fraude inmediata

### Mediano plazo (3-6 meses, control interno y operación)
5. **Flujo de aprobación multi-nivel en OC** — COSO segregación funciones
6. **Proceso formal de alta de proveedores** — prevención proveedor fantasma
7. **Solicitud de compra interna previa a OC** — trazabilidad de necesidad
8. **Asiento automático merma normal vs. anormal** — NIF C-4 correcta

### Largo plazo (6-12 meses, madurez operativa)
9. **Comparativa de cotizaciones multi-proveedor** — anti-kickback
10. **Control presupuestal por categoría** — gestión financiera
11. **Bitácora de temperatura** — BPA cadena frío
12. **Portal de proveedores** — eficiencia operativa

---

## Referencias y Fuentes

### Normas Mexicanas
- [NIF C-4 Inventarios — CINIF (texto oficial rmp.mx)](https://rmp.mx/Boletin/2018/Diciembre/doc/NIF%20C-4.pdf)
- [NIF C-4 Guía Completa 2025 — CPCON Group](https://cpcongroup.mx/insights/nif-c-4-inventarios)
- [NIF C-4 Medición, deterioro y revelación — IDC Online 2026](https://idconline.mx/fiscal-contable/2026/03/06/nif-c-4-medicion-deterioro-y-revelacion-de-inventarios)
- [Tratamiento contable faltantes de inventarios — AMCP](https://amcpdf.org.mx/tratamiento-contable-y-fiscal-de-los-faltantes-de-inventarios-y-su-registro-contable-parte-uno/)
- [NIF C-19 Instrumentos financieros por pagar — vLex México](https://vlex.com.mx/vid/nif-c-19-instrumentos-593543062)
- [Costo de Ventas — análisis integral NIF C-4 y D-2 (HubSpot)](https://cdn2.hubspot.net/hubfs/4362409/MaterialesCursos/1013_12julio2018_COSTO_VENTAS_CON_AN%C3%81LISIS_INTEGRAL_INVENTARIOS_(NIF%20C4).pdf)

### Normativa COFEPRIS / SSA
- [NOM-059-SSA1-2015 Buenas Prácticas de Fabricación — DOF](https://www.dof.gob.mx/nota_detalle.php?codigo=5424575&fecha=05%2F02%2F2016)
- [NOM-072-SSA1-2012 Etiquetado de Medicamentos — SIDOF](https://sidof.segob.gob.mx/notas/docFuente/5278341)
- [Guía Almacenes de Distribución — COFEPRIS gob.mx](https://www.gob.mx/cofepris/documentos/guia-para-almacenes-de-deposito-y-distribucion-de-medicamentos-y-demas-insumos-para-la-salud)
- [Trazabilidad y Normativa COFEPRIS 2026 — FarmaBlog](https://farmablog.com.mx/2026/03/19/trazabilidad-normativa-farmacias-mexico-cofepris/)
- [COFEPRIS-03-005 Libros de Control — CONAMER](https://catalogonacional.gob.mx/FichaTramite?traHomoclave=COFEPRIS-03-005)
- [Sistema Integral de Sustancias COFEPRIS 2024](https://www.saludyfarmacos.org/lang/es/boletin-farmacos/boletines/may202403/13_me/)

### ERP de Referencia
- [3-Way Matching SAP Business One — Dokka](https://dokka.com/3-way-matching-in-sap-business-one-how-to-eliminate-stock-variance-and-grpo-errors/)
- [Gestión de Compras SAP Business One — Itop Academy](https://itop.academy/blog/item/gestion-compras-sap-business-one.html)
- [Odoo Purchase Module Features — SBS ME](https://sbs-me.com/odoo-purchase-module-features-and-benefits-for-efficient-procurement/)
- [Odoo Vendor Evaluation — Apps Store](https://apps.odoo.com/apps/modules/19.0/eg_vendor_lifecycle)
- [QuickBooks Enterprise Purchasing Workflows — Fourlane](https://www.fourlane.com/quickbooks-enterprise-purchasing-workflows-explained)

### Control Interno y Fraude
- [COSO Framework — Pathlock](https://pathlock.com/blog/internal-controls/coso-framework/)
- [Segregación de funciones — Auditool](https://www.auditool.org/blog/control-interno/como-mejorar-el-control-interno-por-medio-de-la-segregacion-de-funciones/)
- [Fraude en compras — métodos auditores — Auditool](https://www.auditool.org/blog/fraude/metodos-de-fraude-en-compras-que-deben-ser-conocidos-por-los-auditores)
- [Proveedor fantasma — fraude — Portafolio](https://blogs.portafolio.co/buenas-practicas-de-auditoria-y-control-interno-en-las-organizaciones/fraude-traves-proveedores-fantasma/)
- [Procurement Fraud Schemes 12 examples — Usetorg](https://usetorg.com/blog/procurement-fraud)
- [Vendor Fraud Schemes — Tipalti](https://tipalti.com/resources/learn/vendor-fraud/)
- [Control inventario farmacias México — CPCON](https://cpcongroup.mx/insights/control-de-inventario-para-farmacias)

---

*Documento generado por investigación asistida por IA — junio 2026. Verificar normas vigentes con contador certificado (CPC) antes de implementar controles contables. Las NIF son emitidas por CINIF y pueden sufrir actualizaciones anuales.*
