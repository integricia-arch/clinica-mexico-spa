# 01 — PRD: Documento de Requisitos de Producto

**App:** ClínicaMX SaaS  
**Tagline:** Gestión integral de clínicas médicas en México con agendamiento automático por Telegram y bot IA.

---

## Problema

Las clínicas pequeñas/medianas en México gestionan citas por WhatsApp/teléfono manual. No hay sistema centralizado para agenda, recordatorios, expedientes, farmacia interna y caja. La recepción gasta horas en tareas que pueden automatizarse.

## Usuario Objetivo

**Primario:** Recepcionista/administrador de clínica (1-10 médicos). No técnico. Usa WhatsApp todo el día. Necesita ver el estado de citas y pacientes en un dashboard limpio.

**Secundario:** Doctor que quiere ver su agenda del día y acceder a expedientes.

**Terciario:** Paciente que agenda/cancela citas por Telegram sin hablar con nadie.

---

## Funcionalidades Principales (Imprescindibles)

### Bot Telegram (IA)
- Paciente escribe en lenguaje natural → bot agenda cita automáticamente
- Bot consulta disponibilidad de doctores en tiempo real
- Confirmación de cita por Telegram
- Escalada a humano (recepción) cuando bot no puede resolver
- Comandos: /cita, /cancelar, /recordatorio

### Recordatorios Automáticos
- T-24h: recordatorio automático antes de cada cita
- T-2h: segundo recordatorio
- Recordatorio manual desde dashboard (recepción)
- pg_cron cada 5 minutos procesa pendientes

### Dashboard Admin/Recepción
- Vista agenda semanal por doctor
- Lista de pacientes con búsqueda
- Nueva cita manual
- Detalle de cita (editar, cancelar, recordatorios)
- Inbox conversaciones Telegram (escaladas + todas)
- Respuesta directa al paciente desde inbox

### Expedientes
- Historia clínica por paciente
- Documentos adjuntos

### Farmacia
- Registro de ventas con receta
- Catálogo de medicamentos
- Corte de caja

### Facturación
- Folios de consulta
- Reportes básicos

### Configuración
- Horarios de la clínica
- Datos de doctores (horario, especialidad, duración cita)
- Calendarios/excepciones por doctor

---

## Funcionalidades Opcionales (v2)

- WhatsApp como canal adicional (hoy solo Telegram)
- App móvil nativa
- Portal del paciente (login propio)
- Integración con SAT para facturación electrónica (CFDI)
- Multi-clínica / franquicia (ya parcialmente preparado: tabla `clinics`)
- Telemedicina / videoconsulta

---

## Fuera del Alcance (v1)

- No hay app móvil nativa (solo responsive web)
- No hay integración con aseguradoras
- No hay diagnóstico con IA (solo agendamiento)
- No hay CFDI electrónico
- No hay portal de pacientes con login

---

## Historias de Usuario

- Como **recepcionista**, quiero ver todas las citas del día en un calendario para saber qué médico tiene disponibilidad.
- Como **recepcionista**, quiero responder al paciente directamente desde el inbox para no salir de la app.
- Como **paciente**, quiero agendar cita por Telegram a cualquier hora para no tener que llamar.
- Como **paciente**, quiero recibir recordatorio automático para no olvidar mi cita.
- Como **doctor**, quiero ver mi agenda semanal para planificar mi día.
- Como **admin**, quiero ver el corte de caja de farmacia para cuadrar ingresos.
- Como **recepcionista**, quiero crear recordatorios manuales para pacientes sin Telegram.

---

## Métricas de Éxito

- Tasa de citas agendadas por bot vs. manual > 60%
- Tasa de no-show < 15% (con recordatorios automáticos)
- Tiempo promedio de agendamiento por recepción < 2 min
- 0 citas duplicadas en el mismo horario/doctor
- Inbox: conversaciones escaladas resueltas en < 5 min
