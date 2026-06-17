# Análisis de Inteligencia de Procesos — Integriclinica
**Flujo 1: Camino Paciente Completo**
*Fecha: junio 2026 | Versión: 1.0 | Clasificación: Estratégico*

---

## 1. Benchmarking con Sistemas de Referencia

### 1.1 Epic EHR — Patient Journey & Appointment Lifecycle

Epic organiza el flujo completo como un "encounter" con estados bien definidos: `scheduled → arrived → roomed → in-progress → discharged → closed`. Cada transición dispara eventos en su event bus interno (Cosmos DB + HL7 FHIR R4). Lo que Integriclinica tiene como `journey_instances` con `snapshot_json` y `current_step_key` es conceptualmente análogo, pero con diferencias operativas importantes:

- Epic usa **clinical decision support (CDS Hooks)** que se disparan en tiempo real al prescribir: interacciones medicamento-medicamento, alergias, dosis máximas. Integriclinica verifica stock pero no tiene CDS de seguridad clínica.
- Epic tiene **in-basket** (mensajería médico→paciente) integrado al EMR. El sistema actual usa Telegram + ayuda_chat_sesiones de forma desconectada del expediente.
- El "camino del paciente" de Integriclinica (`advancePatientJourneyFromClinicalEvent`) es el equivalente funcional del ADT (Admission-Discharge-Transfer) de Epic. La arquitectura es correcta; la brecha es la profundidad clínica.

### 1.2 SAP S/4HANA Healthcare

SAP modela el ciclo como `Patient Service Request → Clinical Order → Fulfillment → Billing`. La facturación está estrechamente acoplada al acto clínico desde el origen. En Integriclinica, el CFDI se genera post-facto como módulo separado (`cfdi-timbrar` edge function), lo que abre la brecha de trazabilidad: una venta de farmacia puede surtirse y cobrarse sin que la factura CFDI quede ligada al `appointment_id` ni al `journey_instance_id`. SAP resuelve esto con un "account" que acumula todos los cargos del encounter antes de liquidar.

### 1.3 HL7 FHIR Workflow Standards (MX: NOM-024-SSA3)

FHIR R4 define los recursos `Appointment`, `Encounter`, `MedicationRequest`, `DiagnosticReport`, `Invoice`, `Coverage`. La NOM-024-SSA3 (expediente clínico electrónico en México) exige:

- Identificación del paciente con mínimo: nombre completo, CURP, fecha de nacimiento, sexo.
- Registro de alergias como entidad independiente (no campo de texto libre).
- Notas de consulta con estructura SOAP mínima — Integriclinica cumple esto.
- Firma electrónica del médico responsable en cada nota — **brecha crítica: no implementada**.
- Mecanismo de no-repudio y sellado de tiempo (timestamp con CA confiable) — no implementado.

La NOM-024 también requiere que el expediente sea auditable e inviolable. La tabla `notas_consulta` actualmente permite edición post-emisión (el manual dice "da clic en el lápiz"), lo cual es una no-conformidad.

### 1.4 OpenClinic GA / MedFile (Open Source)

OpenClinic implementa módulos de: registro, citas, expediente (SOAP), farmacia, laboratorio, radiología, estadística. Su arquitectura es monolítica (PHP/MySQL). La brecha relevante de OpenClinic es que sí incluye **módulo DICOM básico** mediante integración con Orthanc (servidor DICOM open source), algo que Integriclinica no tiene.

### 1.5 Sistemas SaaS Clínicos MX

| Sistema | Fortaleza | Brecha vs Integriclinica |
|---|---|---|
| **Doctoralia** | Marketplace de citas, reputación online | Integriclinica tiene el bot Telegram que Doctoralia no tiene; Doctoralia no tiene POS ni CFDI |
| **MedScanner** | OCR de estudios, digitalización rápida | Integriclinica no tiene este módulo — brecha más relevante de la Etapa 7 |
| **SaludTools** | CRM pacientes, recordatorios automáticos, CFDI | Integriclinica está a la par en CFDI; SaludTools no tiene turno de farmacia propio |
| **Helisa Clínicas** | Facturación CFDI 4.0 madura, contabilidad integrada | Integriclinica tiene CFDI funcional pero sin contabilidad ni libro mayor |

### 1.6 ITIL Service Management aplicado a clínicas

ITIL define "incident management" (algo que falla en el momento), "problem management" (causa raíz), y "service request" (solicitud predecible). Aplicado a clínicas: una cita no confirmada por el médico es un "incident", un patrón de no-shows del 30% es un "problem". El sistema actual tiene `audit_logs` y `pos_error_logs` pero no tiene un proceso formal de escalación ITIL — la tabla `ayuda_chat_sesiones` con estado `escalada` es un embrión de esto.

---

## 2. Análisis de Brechas por Etapa

### Etapa 1 — Agenda (Bot Telegram → Cita)

**Qué falta para clase mundial:**
- Confirmación multi-canal: WhatsApp Business API (no solo Telegram), SMS fallback.
- Reglas de disponibilidad basadas en tipo de servicio: una consulta de 30 min no puede agendarse igual que una cirugía de 2 h. `NuevaCitaDialog` ya tiene duración configurable, pero no hay validación de solapamiento de quirófanos/salas.
- Prepago o depósito al agendar (reduce no-shows). `StripePaymentModal` existe en `DetalleCita.tsx` pero no está en el flujo de agendado.

**Punto de dolor actual:** el bot de Telegram maneja el state en `bot_sesiones.flow_data`. Si el usuario abandona a mitad del flujo y regresa horas después, el estado puede quedar corrupto. No hay timeout/cleanup de sesiones huérfanas documentado.

**Errores que un buen sistema elimina:** doble agendado (dos pacientes en el mismo slot/doctor/consultorio). El sistema tiene realtime en `appointments` pero el constraint de unicidad de slot no está explícito en las migraciones.

### Etapa 2 — Llegada / Recepción

**Qué falta:**
- Check-in digital por QR (el paciente escanea al llegar, se registra `arrived_at` automáticamente).
- Valoración de triage enfermería con flujo estructurado (signos vitales → tabla, no solo nota de texto).
- Alerta de paciente de alto riesgo visible en recepción (alergias severas, diagnósticos crónicos).

**Punto de dolor actual:** recepción no puede registrar llegada directamente desde `RecepcionDashboard.tsx` (es "solo lectura"), debe ir a `DetalleCita.tsx`. Un clic extra que en hora pico genera fricción.

### Etapa 3 — Consulta

**Qué falta:**
- Firma electrónica de nota (NOM-024 incumplida).
- Plantillas de nota por especialidad (SOAP pediátrico, urgencia vs crónico).
- Dictado de voz para capturar la nota (reduce tiempo de documentación hasta 40% según Epic).
- Listas de problemas crónicos como entidades persistentes (diabetes, HTA), no notas sueltas.

**Punto de dolor actual:** las notas permiten edición post-guardado. Para NOM-024 las notas deben ser inmutables post-firma.

### Etapa 4 — Prescripción / Referencia

**Qué falta:**
- CDS (Clinical Decision Support): verificar contra alergias del paciente y contra interacciones medicamentosas al agregar cada medicamento.
- Pase de referencia estructurado para estudios externos (no solo texto libre).
- Control de recetas de medicamentos controlados (NOM-010-SSA2): el sistema muestra advertencia pero no genera el formato oficial ni liga a COFEPRIS.

**Punto de dolor actual:** el semáforo de stock es reactivo al momento de emitir. Si el stock se agota entre que el médico empieza la receta y la emite, no hay re-verificación.

### Etapa 5 — Farmacia POS

**Qué falta:**
- Verificación de identidad al surtir (para medicamentos controlados: cédula del paciente).
- Claridad sobre si la venta directa en POS respeta FEFO o solo decrementa existencia genérica.
- API pública autenticada para farmacia externa (no solo QR web).

**Punto de dolor actual:** la etiqueta roja de stock no se actualiza automáticamente — el manual documenta que requiere F5 (recarga manual).

### Etapa 6 — Facturación CFDI

**Estado actual:** módulo robusto. `cfdi-timbrar`, `cfdi-cancelar`, `cfdi-rep`, `cfdi-email`, factura global, nota de crédito. Cumple CFDI 4.0.

**Qué falta para clase mundial:**
- Trazabilidad cruzada: el CFDI no está ligado al `appointment_id` ni al `journey_instance_id`.
- Dashboard de cuentas por cobrar a pacientes (para PPD + REP).

### Etapa 7 — Seguimiento / Alta

**Qué falta:**
- Digitalización de estudios físicos (ver Q2 abajo).
- Cierre formal con diagnóstico de egreso codificado (CIE-10/CIE-11).
- Instrucciones de alta en formato imprimible/enviable al paciente.
- Encuesta post-consulta automática (NPS clínico).

---

## 3. Preguntas Abiertas — Respuesta Técnica

### Q1: CSF vía Chat — Viabilidad y Costo

El flujo propuesto: paciente no registrado envía su Constancia de Situación Fiscal (CSF) al chat → sistema extrae RFC, nombre, CP fiscal, régimen → registra en `cfdi_receptores`.

**Factibilidad técnica:** Alta. La CSF del SAT es un PDF con texto embebido (generado digitalmente), lo que en la mayoría de los casos no requiere OCR real sino extracción de texto de PDF.

**Opciones y costo estimado:**

| Opción | Costo/documento | Precisión | Notas |
|---|---|---|---|
| **pdf-parse / pdfjs (local)** | $0 | 95% (PDF nativo) / 0% (foto) | Suficiente si el paciente envía el PDF original del SAT |
| **AWS Textract** | ~$0.015 USD/página | 90-95% | Maneja fotos bien; <500 CSF/mes = <$8 USD/mes |
| **Google Document AI** | ~$0.065 USD/página | 92-97% | Más caro, bueno para documentos estructurados |
| **Claude Vision (claude-sonnet-4-6)** | ~$0.003 USD/imagen | 95%+ | Más flexible: maneja foto + PDF + variantes SAT; ya tienes edge functions |

**Recomendación para MX:** Dos capas:
1. `pdf-parse` en Edge Function (sin costo) — intenta extracción de texto
2. Si falla: Claude Vision con prompt estructurado para extraer RFC, nombre, CP, régimen

Costo esperado: <$10 USD/mes para una clínica mediana.

**Riesgos SAT:**
- CSF desactualizada (cambio de domicilio, régimen) → CFDI rechazado. Mitigación: mostrar datos extraídos al paciente y pedir confirmación explícita antes de guardar.
- Datos fiscales son datos personales sensibles bajo LFPDPPP — almacenar con RLS restrictivo.

**Implementación sugerida:**
1. Edge function `cfdi-parse-csf` recibe archivo (PDF o imagen base64)
2. Intenta `pdf-parse`; si extrae campos esperados, retorna datos
3. Si falla, llama a Claude API con vision prompt estructurado
4. Frontend muestra modal de confirmación antes de guardar en `cfdi_receptores`

### Q2: Digitalización de Estudios — Análisis Completo

**DICOM vs PDF/Imagen:**

| Criterio | DICOM | PDF/Imagen |
|---|---|---|
| **Estándar médico** | Estándar para imagenología (RX, TAC, RM, USG) | Adecuado para análisis de laboratorio, reportes escritos |
| **Infraestructura** | Servidor DICOM (Orthanc, dcm4chee) — requiere VM, no corre en Workers | Solo Supabase Storage |
| **Costo almacenamiento** | TAC de tórax: 50-150 MB. 100 pacientes/día = 5-15 GB/día = $115-345 USD/mes | PDF laboratorio: 0.5-2 MB. 100/día = 50-200 MB/día = <$5 USD/mes |
| **NOM-024-SSA3** | Exige conservar estudios propios en formato original del equipo (DICOM) | Para estudios de terceros en papel, digitalizar como imagen es aceptable |

**Recomendación pragmática:**
- **Fase 1 (inmediata):** Upload PDF/imagen a Supabase Storage desde `StudyResultDrawer`. URL en `url_archivo` ya existente. Costo: mínimo.
- **Fase 2 (si clínica adquiere equipos de imagen propios):** VM con Orthanc ($12/mes DigitalOcean) + proxy desde Edge Function + visor Cornerstone.js embebido.
- Para digitalizar placas físicas: escáner de transparencias ~$200 USD genera TIFF de calidad clínica suficiente.

**Proveedores MX:**
- **Nuvó / Meditrek:** almacenamiento DICOM en nube para MX, HIPAA-equivalente, API REST, ~$0.10 USD/estudio.
- **Recomendación:** Supabase Storage para laboratorio (PDF) + Nuvó para imagenología DICOM si se necesita, ambos con URL firmada en `StudyResultDrawer`.

---

## 4. Chat Inteligente de Ayuda con IA — Arquitectura

### Contexto actual
- 18 archivos markdown en `docs/manual-usuario/` (bien estructurados)
- `ayuda_chat_sesiones` / `ayuda_chat_mensajes` con `rol: asistente_ia` modelado pero sin IA conectada
- Restricción: Cloudflare Workers no puede hostear Ollama (no soporta procesos persistentes)

### Arquitectura recomendada: RAG ligero + Claude Haiku

```
Usuario (HelpChatWidget)
  → Supabase Edge Function: help-chat-ai
      → 1. Carga 2-3 manuals relevantes según ruta_activa
      → 2. Claude API claude-haiku-4-5 (respuesta rápida, bajo costo)
      → 3. Guarda respuesta en ayuda_chat_mensajes (rol: asistente_ia)
      → 4. Si confianza baja → UPDATE estado = 'escalada' → notifica staff
```

**RAG sobre los 18 manuals:**
- Los 18 archivos totalizan ~30,000-50,000 tokens — caben en el contexto de Claude sin embeddings.
- **Opción A (recomendada para ahora):** cargar los 2-3 manuals relevantes según `ruta_activa` directamente al contexto. Sin infraestructura adicional.
- **Opción B (cuando manuals >100,000 tokens):** pgvector en Supabase para embeddings. `SELECT ... ORDER BY embedding <-> query_embedding LIMIT 3`. Costo: embeddings gratuitos con `text-embedding-3-small` (~$0.02/1M tokens).

**Modelo:** Claude Haiku (claude-haiku-4-5)
- Latencia: 300-800ms P95
- Costo por consulta: ~$0.0003 USD (500 tokens entrada + 200 respuesta)
- 1,000 consultas/mes = $0.30 USD

**Cuándo escalar a humano:**
- Modelo responde con incertidumbre explícita
- Consulta contiene palabras clave: "error", "no puedo cobrar", "se trabó", "emergencia"
- Usuario escribe >3 mensajes sin resolver (contador en `ayuda_chat_mensajes`)
- Fuera del horario de soporte (configurable por clínica)

**Integración con stack:**
1. Nueva edge function `help-chat-ai` recibe `{ sesion_id, mensaje, ruta_activa, clinica_id }`
2. Carga manuals relevantes según `ruta_activa`
3. Llama Claude API con manuals como system prompt
4. Guarda respuesta en `ayuda_chat_mensajes` con `rol: asistente_ia`
5. `HelpChatWidget.tsx` ya escucha realtime → respuesta aparece automáticamente

---

## 5. Inteligencia de Procesos (Process Mining)

### Eventos a loggear

La tabla `journey_instance_audit` es el lugar correcto. Estructura recomendada para event log:

```sql
-- Eventos clave del flujo 1
appointment_events (
  id uuid,
  appointment_id uuid,
  event_type text, -- 'scheduled','arrived','triage_done','consultation_opened',
                   -- 'prescription_issued','dispensed','invoiced','discharged'
  actor_id uuid,
  actor_role text, -- 'patient','nurse','doctor','cashier','bot'
  timestamp timestamptz,
  metadata jsonb
)
```

### KPIs clínicos clave

| KPI | Cálculo | Umbral referencia |
|---|---|---|
| **Tiempo promedio de espera** | `arrived_at - scheduled_at` / `consultation_opened_at - arrived_at` | <20 min (clínica eficiente) |
| **Tasa de no-show** | `COUNT(status='no_show') / COUNT(status IN ('confirmada','no_show'))` | <10% con recordatorios activos |
| **Tiempo ciclo consulta→receta→surtido** | `dispensed_at - consultation_opened_at` | <45 min en clínica integrada |
| **Tasa errores de dispensación** | `devoluciones_farmacia / total_ventas_farmacia` | <0.5% |
| **Tasa cancelación last-minute** | Cancelaciones <24h antes / total citas | <5% |
| **Conversión bot→cita** | Sesiones Telegram que completan `await_confirm` / total sesiones iniciadas | >60% |

### Herramientas

| Herramienta | Tipo | Costo | Recomendación |
|---|---|---|---|
| **PM4PY** | Open source (Python) | $0 | Para análisis periódicos (mensual), suficiente |
| **Metabase (self-hosted)** | BI open source | $0 | **Recomendado para empezar** — conector Supabase directo |
| **Celonis** | SaaS enterprise | $50,000+/año | Excesivo para esta escala |

**Recomendación práctica:** Agregar pestaña "Proceso" al `BI.tsx` existente con queries SQL directas en Supabase. PM4PY cuando se quiera análisis de rutas (¿qué pacientes se saltan la farmacia?).

---

## 6. Escenarios de Riesgo (360°)

| Escenario | Impacto | Cobertura actual | Gap / Acción |
|---|---|---|---|
| **Médico no disponible en momento de cita** | Alto | `operational_status` en `doctors` previene nuevas asignaciones | Sin protocolo de reasignación urgente + notificación automática a pacientes afectados ese día |
| **Medicamento sin stock al surtir** | Alto | Semáforo en POS + verificación al emitir | Sin reserva atómica — condición de carrera entre prescripción y despacho |
| **Paciente con alergia a medicamento recetado** | **Crítico** | Verificación "alergias confirmadas sí/no" | Sin matching alérgeno↔medicamento específico. Amoxicilina + alergia penicilina no se detecta |
| **Error de identidad (paciente equivocado)** | **Crítico** | Ninguna | Sin foto en ficha, sin verificación biométrica, sin confirmación al surtir controlados |
| **Falla de conectividad en POS** | Alto | `beforeunload` warning con carrito activo | Sin modo offline. Si Supabase cae, farmacia no puede cobrar |
| **CFDI rechazado por SAT** | Medio | Edge functions retornan error | Sin guía de resolución inline. Agregar lookup de códigos SAT con mensaje en español |
| **Estudio no llega antes de cita de seguimiento** | Medio | `StudyResultDrawer` muestra "pendiente" | Sin alerta proactiva al médico N días antes si estudio sigue pendiente |
| **Paciente sin seguro que no puede pagar** | Bajo-Medio | Ninguna | Decisión de negocio: pago en parcialidades, convenio, referencia a servicio social |
| **Emergencia médica durante la consulta** | **Crítico** | Ninguna | Sin botón de emergencia, sin protocolo de alerta al staff, sin referencia a 065 |

---

## 7. Recomendaciones Priorizadas (Top 10)

Criterio: **seguridad del paciente > reducción de errores > eficiencia operativa**

| # | Mejora | Impacto | Esfuerzo (h) | Complejidad |
|---|---|---|---|---|
| **R1** | CDS de alergias al prescribir | Seguridad — crítico | 16-24 | 3/5 |
| **R2** | Inmutabilidad de notas clínicas (NOM-024) | Legal/regulatorio — crítico | 8 | 2/5 |
| **R3** | Reserva de inventario al emitir receta (soft lock) | Reducción errores | 20-30 | 4/5 |
| **R4** | Foto y verificación de identidad del paciente | Seguridad | 12-16 | 2/5 |
| **R5** | Check-in digital por QR al llegar | Eficiencia + datos | 16-20 | 3/5 |
| **R6** | Chat IA de soporte interno (RAG + Claude Haiku) | Eficiencia operativa | 12-16 | 2/5 |
| **R7** | Botón de emergencia en Panel Doctor | Seguridad | 8-10 | 2/5 |
| **R8** | Trazabilidad CFDI ↔ appointment_id | Auditoría fiscal | 10-14 | 2/5 |
| **R9** | Alerta proactiva estudios pendientes antes de seguimiento | Eficiencia clínica | 8-12 | 2/5 |
| **R10** | Dashboard KPIs de proceso (pestaña "Proceso" en BI) | Mejora continua | 16-24 | 3/5 |

### Detalle de cada recomendación

**R1 — CDS de Alergias:** Al agregar medicamento en `PrescriptionEditorModal`, verificar contra alergias del paciente. Si principio activo o familia farmacológica coincide → alerta bloqueante. La infraestructura (alergias en `patients`, medicamentos en `prescription_items`) ya existe. Falta: tabla de equivalencias alérgeno↔familia farmacológica.

**R2 — Inmutabilidad de notas:** Desactivar edición post-guardado en `notas_consulta`. Implementar adenda (nota adicional que referencia la nota original) para correcciones. Cumple NOM-024-SSA3.

**R3 — Reserva de inventario:** Al emitir receta, crear registro en `reservas_inventario` que descuente "disponible" sin afectar "existencia" hasta el surtido o expiración de la receta. Elimina condición de carrera.

**R4 — Foto de paciente:** Upload a Supabase Storage. Mostrar en `PanelDoctor.tsx`, POS al surtir controlados, valoración de llegada. Error de identidad es el segundo error más frecuente en clínicas.

**R5 — Check-in QR:** El recordatorio de cita incluye link/QR. Al escanearlo, registra `arrived_at` y notifica a recepción. Genera datos precisos para KPIs de espera.

**R6 — Chat IA:** Edge function `help-chat-ai` con Claude Haiku + manuals como contexto. Activa `rol: asistente_ia` ya modelado en `ayuda_chat_mensajes`. Costo: ~$0.30 USD/1,000 consultas.

**R7 — Botón de emergencia:** Botón visible en `PanelDoctor.tsx` que: (a) envía alerta realtime a admin/manager, (b) muestra número 065, (c) registra evento en `audit_logs`.

**R8 — Trazabilidad CFDI:** Agregar `appointment_id` como campo opcional en `cfdi_documentos`. En flujo de timbrado, ofrecer pre-selección del appointment del día del paciente.

**R9 — Alerta estudios:** Cron job (pg_cron) que 48h antes de citas tipo `seguimiento` verifica si estudios solicitados tienen resultado. Si no, notifica médico y recepción vía realtime/Telegram.

**R10 — KPIs de proceso:** Pestaña "Proceso" en `BI.tsx` con: tiempo promedio de espera, tasa no-show, tiempo consulta→receta→surtido, conversión bot→cita. Queries SQL directas sobre `appointment_events`.

---

## Estado de Conformidad Regulatoria MX

| Regulación | Estado | Acción requerida |
|---|---|---|
| **CFDI 4.0 (SAT)** | Conforme | Agregar trazabilidad appointment↔CFDI (R8) |
| **NOM-024-SSA3 (expediente electrónico)** | Parcial | Inmutabilidad de notas (R2), firma electrónica del médico (alta complejidad, no en top 10) |
| **NOM-010-SSA2 (medicamentos controlados)** | Parcial | Advertencia existe; falta formato oficial y liga a COFEPRIS |
| **LFPDPPP (protección de datos personales)** | Sin info suficiente | Revisar aviso de privacidad, encriptación datos sensibles en reposo |
| **COFEPRIS (establecimiento farmacéutico)** | No evaluable | Depende de licencia física de la clínica, no del software |

---

## Referencias cruzadas

- `memoria/proyectos/flujo1-camino-paciente-completo.md` — flujo raw dictado por usuario
- `docs/manual-usuario/` — 18 manuales operativos por pantalla
- `memoria/proyectos/investigacion-enfermeria-operativa.md`
- `memoria/proyectos/investigacion-almacen-compras-proveedores.md`
- `memoria/proyectos/cfdi-facturacion-electronica.md`

_/aprende 2026-06-17_
