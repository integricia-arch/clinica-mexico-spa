# Flujo 1 — Camino del Paciente Completo (dictado por usuario, Jun 17 2026)

> Fuente primaria: descripción operativa del usuario. Base para análisis de inteligencia de procesos.

## Flujo dictado (raw, preservado textualmente)

### Etapa 1 — Agenda
- Paciente agenda cita por chat
- Sistema verifica: horario disponible, doctor, servicio, consultorio
- Notifica a todos los participantes por mensaje
- Solicita confirmación (Aceptar) a cada uno
- Confirma y agenda
- Emite recordatorio al paciente

### Etapa 2 — Llegada / Recepción
- Paciente llega
- Recepción lo recibe
- Llena datos necesarios para su consulta
- Si aplica: se asigna personal de enfermería para:
  - Valoración de llegada
  - Captura de datos / signos vitales
  - Llenado de expediente electrónico
  - Preparación del paciente

### Etapa 3 — Consulta médica
- Doctor recibe datos pre-capturados (síntomas capturados por bot / enfermera / panel doctor)
- Doctor inicia consulta
- Escribe observaciones en el sistema

### Etapa 4 — Prescripción y referencia
- Doctor determina que requiere análisis o radiografía
- Emite receta con pase al análisis/radiografía (interno o externo)
- Al agregar medicamentos: sistema verifica existencia en almacén en tiempo real
- Opción: paciente puede surtir en farmacia interna

### Etapa 5 — Farmacia / POS
- Paciente llega a farmacia
- Escanea QR de receta
- Sistema indica ubicación de los medicamentos
- Farmacéutico hace el cobro en POS
- Selecciona método de pago

### Etapa 6 — Facturación
- Paciente solicita factura
- Sistema pregunta si está registrado fiscalmente
- **Escenario A (registrado):** cobro + emisión CFDI directa
- **Escenario B (no registrado):** evaluar opciones:
  - Opción B1: paciente envía CSF por chat, sistema lee el XML y registra datos fiscales automáticamente → pasa a caja → factura
  - Opción B2: paciente genera factura por sí mismo vía QR + bot self-service

### Etapa 7 — Seguimiento / Alta
- Paciente regresa en fecha asignada con análisis / radiografías
- Investigar: viabilidad de digitalizar documentos físicos (análisis, radiografías) para expediente electrónico
- Doctor revisa resultados
- Doctor da indicaciones
- Si requiere seguimiento: agenda nueva cita (misma lógica Etapa 1)
- Si no: emite cobro (si aplica) y da de alta

---

## Preguntas abiertas del usuario

1. **CSF por chat**: ¿qué tan práctico y costoso es que un paciente no registrado envíe su CSF al chat, el sistema lo lea y registre los datos fiscales correctamente?
2. **Digitalización de estudios**: ¿es viable digitalizar análisis / radiografías físicas para el expediente electrónico?

---

## Objetivos declarados

- Reducir tiempos de atención
- Evitar errores
- Evitar malas consultas
- Prevenir demandas
- Evitar pérdidas humanas o situaciones complejas
- Sistema con retroalimentación y mejora continua
- Cobertura 360° del flujo completo

---

## Estado
- [ ] Análisis de brechas vs sistema actual
- [ ] Benchmarking con otros sistemas (Epic, SAP Health, Medilink, etc.)
- [ ] Plan de mejoras por etapa
- [ ] Chat inteligente de ayuda con IA
- [ ] Inteligencia de procesos (process mining / analytics)
