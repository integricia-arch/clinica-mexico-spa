# Solicitudes ARCO

> Aquí gestionas las solicitudes que los pacientes hacen sobre sus datos personales: acceso, rectificación, cancelación u oposición (ARCO), conforme a la ley mexicana de protección de datos (LFPDPPP). Solo la usa el administrador.

## Operación — cómo se usa

### Cómo revisar las solicitudes pendientes

1. Entra a "Solicitudes ARCO" (`/admin/arco`). Arriba ves tres números: **Pendientes**, **Vencidas (riesgo legal)** y **Total históricas**.
2. Si hay solicitudes vencidas, aparece un aviso naranja recordando que no responder a tiempo es una infracción legal — atiéndelas de inmediato.
3. Usa el filtro **"Filtrar"** para ver solo Pendientes, En proceso, Resueltos, Rechazados, o Todos.
4. En la tabla ves, por cada solicitud: folio, tipo (Acceso, Rectificación, Cancelación u Oposición), quién la solicitó, fecha en que se recibió, plazo restante (o si ya venció), y su estado.

### Cómo atender una solicitud

1. Da clic en **"Ver"** sobre la solicitud.
2. Revisa los datos del solicitante (nombre, correo, teléfono, clínica), la fecha en que se recibió, el plazo legal, y la descripción que escribió el paciente.
3. Escribe **notas internas** (solo las ve el equipo de la clínica, nunca se le envían al paciente) y, si corresponde, la **respuesta al titular** (el texto formal que se le comunicará).
4. Elige una acción:
   - **En proceso** — para marcar que ya empezaste a trabajar en ella.
   - **Rechazar** — si la solicitud no procede.
   - **Marcar resuelto** — cuando ya diste respuesta al paciente.
5. Después de guardar, envía la respuesta manualmente al correo del paciente (el sistema no envía el correo por ti — te muestra el correo exacto al que debes escribir).

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** el plazo legal para responder una solicitud ARCO es de 20 días hábiles (LFPDPPP Arts. 21-34).
  **Por qué:** es el plazo que marca la ley mexicana de protección de datos personales; no es una regla del sistema, es un requisito legal.
- **Lo que pasa:** si una solicitud pasa su plazo sin resolverse, el sistema la marca como "vencida" con una advertencia visible de riesgo legal.
  **Por qué:** no responder en plazo es una infracción directa según la ley (LFPDPPP Art. 64) — la clínica puede enfrentar sanciones, por eso la urgencia se muestra de forma destacada.
- **Lo que pasa:** las notas internas nunca se le muestran al paciente; la respuesta al titular sí, pero el sistema no la envía automáticamente por correo.
  **Por qué:** separa el trabajo interno de gestión (donde puedes escribir libremente) de la comunicación formal al paciente, y deja el envío final bajo control humano para revisar el texto antes de mandarlo.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| Veo el aviso naranja de solicitudes vencidas | Una o más solicitudes pasaron su plazo legal de 20 días hábiles sin resolverse | Atiéndelas de inmediato — es un riesgo legal real para la clínica |
| Guardé la respuesta pero el paciente dice que no le llegó nada | El sistema no envía el correo automáticamente | Copia el texto de la respuesta y envíalo manualmente al correo del paciente que se muestra en el detalle |
| No sé qué tipo de solicitud elegir para un caso nuevo | Los tipos corresponden a los cuatro derechos ARCO de la ley | Acceso = quiere saber qué datos tienes de él; Rectificación = corregir datos; Cancelación = borrar sus datos; Oposición = que dejes de usar sus datos para algo específico |
| Marqué "Resuelto" por error | El estado se puede volver a abrir | Abre la solicitud otra vez y cámbiala a "En proceso" o el estado correcto |

## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/ARCOAdmin.tsx` (ruta `/admin/arco`).
- **Tabla Supabase:** `arco_requests` (`folio`, `tipo`: acceso/rectificacion/cancelacion/oposicion, `nombre`, `email`, `telefono`, `descripcion`, `clinic_name`, `created_at`, `deadline_at`, `status`: pendiente/en_proceso/resuelto/rechazado, `resolved_at`, `notas_internas`, `respuesta`).
- **RPCs/edge functions:** ninguna — CRUD directo con `supabase.from("arco_requests")`; el envío del correo de respuesta al titular es 100% manual (fuera del sistema).
- **Cálculo de plazo:** `diasRestantes()` usa `differenceInDays` de `date-fns` sobre `deadline_at`; el `deadline_at` se calcula/asigna al crear la solicitud (fuera de este archivo — buscar el punto de creación de `arco_requests`, probablemente un formulario público o edge function, para confirmar el cálculo de 20 días hábiles).
- **Cómo agregar un tipo de solicitud nuevo:** agregar el valor a `ARCOTipo` y a `TIPO_LABEL`.
- **Cómo agregar un estado nuevo:** agregar el valor a `ARCOStatus` y a `STATUS_BADGE`, y considerar el impacto en `resolved_at` (hoy solo se setea para `resuelto`/`rechazado`).

_/aprende 2026-07-06_
