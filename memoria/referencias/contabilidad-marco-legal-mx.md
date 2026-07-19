# Marco legal y normativo — contabilidad en México (para el módulo contable)

**Fecha:** 2026-07-18 · Investigación web (WebSearch), sin implementación. Complementa
`contpaq-gap-analysis.md`.

## 1. Postulados básicos de contabilidad (NIF A-2)

La NIF A-2 establece 8 postulados básicos. Para cada uno, qué implica hoy para
`clinica-mexico-spa`:

| Postulado | Definición | Estado en nuestro módulo |
|---|---|---|
| **Sustancia económica** | La esencia económica de una operación debe prevalecer sobre su forma legal | Parcial — el costo snapshot de insumos y honorarios captura la esencia económica del momento, pero sin doble partida el registro no refleja la operación completa (solo un lado) |
| **Entidad económica** | La contabilidad se lleva para una entidad específica, separada de sus dueños y de otras entidades | **Cumplido** — `clinic_id` + RLS en todas las tablas del módulo, multiclínica desde el diseño |
| **Negocio en marcha** | Se presume que la entidad seguirá operando; sin esta presunción no aplican criterios de valuación normales | No aplica evaluarlo en software — es un juicio del contador, no un dato que el sistema calcule |
| **Devengación contable** | Los efectos de una transacción se reconocen cuando ocurren, no cuando se cobran/pagan | **Cumplido** — `movimientos_contables` guarda `fecha_devengo` y `fecha_pago` por separado; el cron diario devenga honorarios independientemente del cobro |
| **Asociación de costos y gastos con ingresos** | Los costos/gastos se reconocen en el mismo período que los ingresos que ayudaron a generar | **Cumplido parcialmente** — costo de insumos snapshot por cita asocia el costo directo a cada consulta; limitación conocida: costo de medicamentos de farmacia NO está incluido en costo de ventas |
| **Valuación** | Los eventos económicos se cuantifican en términos monetarios con una base consistente | **Cumplido** — todo en centavos (evita error de redondeo de floats), snapshot de costo al momento de la transacción |
| **Dualidad económica** | Toda operación afecta dos lados: recursos (activo) y su fuente (pasivo/capital) — cargo y abono deben cuadrar | **NO cumplido hoy** — `movimientos_contables` es de una sola entrada (ingreso o egreso), sin partida doble. Este es el gap que Pablo confirmó como requisito (ver sección 4 del gap analysis: modelo de pólizas cargo/abono) |
| **Consistencia** | Los mismos criterios contables se aplican de manera uniforme en el tiempo, para que la información sea comparable | **Cumplido** — `doctor_honorarios_config` es histórico con vigencias (nunca UPDATE destructivo), permite comparar períodos con la regla vigente en cada uno |

## 2. Requerimientos legales mínimos — Código Fiscal de la Federación (CFF)

### CFF Art. 28 — obligación de llevar contabilidad

- Fracción I: qué se considera contabilidad — libros, sistemas y registros contables,
  papeles de trabajo, estados de cuenta, cuentas especiales, libros sociales, control de
  inventarios, discos/cintas u otros medios procesables, equipos/sistemas electrónicos
  de registro fiscal, y demás documentación comprobatoria de los asientos.
- Fracción III: los registros/asientos deben llevarse en **medios electrónicos**
  conforme el Reglamento y reglas del SAT (esto es la base legal de "contabilidad
  electrónica").
- Fracción IV: quienes están obligados a llevar contabilidad deben **enviar
  mensualmente su información contable** a través del portal del SAT (catálogo de
  cuentas + balanza), salvo excepciones (ver sección 3).

### Reglamento del CFF, Art. 33-34 — qué integra la contabilidad y su conservación

- **Art. 33**: la documentación que integra la contabilidad incluye — registros o
  asientos contables auxiliares y **catálogo de cuentas**; avisos/solicitudes de
  inscripción al RFC; declaraciones anuales, informativas y de pagos provisionales;
  estados de cuenta bancarios; documentación comprobatoria de asientos; y (fracción
  específica) el **control de inventarios y método de valuación**.
- **Art. 34**: el contribuyente debe conservar el **diseño del sistema electrónico**
  donde almacena y procesa sus datos contables, incluyendo diagramas del mismo — es
  decir, la documentación de la arquitectura del sistema (relevante: nuestro propio
  módulo contable, si algún día alimenta contabilidad fiscal, debería documentarse con
  este nivel de detalle).
- **Plazo de registro**: los registros contables deben asentarse dentro de los **5 días
  siguientes** a la realización de la operación (regla general de "contabilidad al
  corriente").
- **Conservación**: la contabilidad y su documentación deben conservarse **5 años**,
  contados a partir de la fecha en que se presentaron o debieron presentarse las
  declaraciones relacionadas.

### Obligación de contabilidad electrónica (envío mensual al SAT) — quién sí / quién no

- **Personas morales**: TODAS están obligadas a enviar contabilidad electrónica
  (incluidas las de RESICO personas morales), con o sin fines de lucro.
- **Personas físicas** con actividad empresarial, enajenación de bienes o
  arrendamiento: obligadas, **salvo** que sus ingresos del ejercicio anterior sean
  menores a $4,000,000 MXN (exentas de envío, aunque deben seguir llevando su
  contabilidad).
- **RESICO personas físicas**: relevadas de la obligación de envío si registran sus
  operaciones en "Mis cuentas" del SAT — no aplica a RESICO personas morales, que sí
  deben enviar.
- **Plazos de envío**: balanza mensual a más tardar el día 3 del segundo mes posterior
  (ej. balanza de enero se envía a más tardar el 3 de marzo); balanza ajustada de
  cierre de ejercicio a más tardar el 20 de abril del año siguiente (personas morales).

**Relevancia para clinica-mexico-spa**: si la clínica opera como persona moral (lo
usual para una PyME con varios doctores/empleados), el contador YA está obligado a
enviar contabilidad electrónica — esto confirma que la responsabilidad fiscal formal
recae en su CONTPAQi/Aspel, no en nuestro sistema, salvo que se decida (N2) que nuestro
sistema se vuelva el sistema de registro oficial.

## 3. Vínculo con auditorías del SAT (facultades de comprobación)

El SAT ejerce sus facultades de comprobación (CFF Art. 42) por tres vías principales:
**revisión electrónica** (con base en la información que el SAT ya tiene, incluida la
contabilidad electrónica enviada), **revisión de gabinete** (requerimiento de
documentación sin visita física), y **visita domiciliaria** (auditoría presencial).

### Qué pide el SAT durante una revisión

- **Pólizas y auxiliares**: se entregan solo cuando el SAT los requiere expresamente —
  en el marco de una revisión (electrónica, de gabinete o compulsa) o en trámites de
  devolución/compensación de saldo a favor. No se envían mensualmente por default (a
  diferencia del catálogo y la balanza, que sí son de envío mensual obligatorio).
- **Balanza de comprobación**: es el reporte más frecuentemente solicitado y el que el
  SAT usa para monitorear consistencia de cifras — saldos iniciales, movimientos del
  período (cargos y abonos) y saldos finales por cuenta.
- **Vínculo UUID-póliza**: cada póliza debe identificar la operación ligándola al folio
  fiscal (UUID) del CFDI relacionado, o a la documentación soporte que identifique forma
  de pago y contribuciones causadas — esta es la conexión formal entre "lo que se
  facturó" y "lo que se contabilizó".
- **Formato**: cuando la autoridad requiere información de pólizas (auditoría o
  devolución/compensación), el contribuyente debe entregar el archivo en **XML**
  conforme al esquema del Anexo 24.

### Qué significa esto para nuestro módulo

- Lo que YA registramos (`movimientos_contables` con `reference_type`/`reference_id`
  ligado a CFDI de consultas/farmacia, fechas de devengo/pago, costo snapshot) **sí
  sirve como papel de trabajo interno / soporte gerencial** — es información que el
  contador puede usar como insumo para construir sus pólizas oficiales, y que la
  clínica puede usar para responder preguntas rápidas ("¿cuánto facturamos en
  insumos en marzo?") sin esperar al corte del contador.
- Lo que **NO sustituye** la contabilidad fiscal: nuestras tablas no son pólizas con
  cargo/abono balanceado, no tienen catálogo con código agrupador SAT poblado, y no se
  envían al SAT. Si llega una revisión electrónica o de gabinete, el sujeto obligado a
  responder con pólizas/auxiliares formales es el contribuyente a través de su
  contabilidad oficial (la que lleva el contador en CONTPAQi/Aspel), no nuestro sistema.
- La decisión de Pablo de exigir partida doble con cargo/abono, catálogo con
  tipo+naturaleza y balanza de comprobación (ver gap analysis, sección "Requisitos
  confirmados") acerca nuestro módulo un paso hacia poder servir de soporte más robusto
  — pero mientras no se implemente contabilidad electrónica (envío XML al SAT) y el
  vínculo UUID-póliza completo, sigue siendo una herramienta de gestión gerencial con
  papel de trabajo de calidad, no un sustituto legal de la contabilidad fiscal.

## 4. Fuentes

- [NIF A-2 Postulados básicos de la información contable (PDF)](https://practicasprofesionales.ula.edu.mx/documentos/ACC280/semana%201/NIF_A2_pos_bas_RF.pdf)
- [Los postulados básicos de la NIF A-2: Explicación sencilla](https://facture.com.mx/los-postulados-basicos-de-la-nif-a-2-explicacion-sencilla/)
- [8 postulados básicos (NIF A-2) que todo Contador debe conocer](https://contadormx.com/8-postulados-basicos-nif-a-2-que-todo-contador-debe-conocer-y-entender/)
- [Art. 28 CFF 2026 — Obligación de Llevar Contabilidad](https://sdv.com.mx/compendio/codigo-fiscal/articulo-28/)
- [Artículos 33 y 34 del Reglamento del CFF — SAT](http://omawww.sat.gob.mx/fichas_tematicas/buzon_tributario/Paginas/arts_33_34-rcff.aspx)
- [Plazos para conservación de la Contabilidad y documentación del CFF](https://contadormx.com/plazos-para-conservacion-de-la-contabilidad-y-documentacion-del-cff/)
- [En qué plazo puede destruirse la contabilidad — IDC](https://idconline.mx/fiscal-contable/2024/02/26/en-que-plazo-puede-destruirse-la-contabilidad)
- [Contabilidad electrónica al SAT: guía completa 2026 — Taxcom Advisors](https://www.taxcom.mx/blog/cumplimiento-fiscal/contabilidad-electronica-sat-guia-2026/)
- [Contabilidad electrónica ante el SAT: obligaciones 2026 — Praxium](https://praxiumconsultores.com/blog/contabilidad-electronica-sat-obligaciones-2026)
- [¿Quiénes están obligados a llevar la contabilidad electrónica? — FacturoPorTi](https://facturoporti.com.mx/llevar-contabilidad-electronica/)
- [Contabilidad electrónica SAT 2026: guía — Fintax (catálogo, balanza, acuses)](https://www.fintax.mx/es/guias/guia-contabilidad-electronica-sat-2026-catalogo-balanza-acuses)
- [Envía tu Contabilidad Electrónica — Portal SAT](https://www.sat.gob.mx/aplicacion/42150/envia-tu-contabilidad-electronica)
- [Pólizas contables electrónicas: ¿Cómo estructurarlas según el SAT? — CONTPAQi](https://www.contpaqi.com/publicaciones/tendencias-fiscales/polizas-contables-electronicas-como-estructurarlas-segun-el-sat)
