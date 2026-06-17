# Panel del doctor

> Aquí atiendes a tus pacientes del día: ves tu agenda, abres la consulta, capturas tu nota, pides análisis, emites recetas y das de alta. Lo usa el doctor (y el administrador, que puede ver el panel de cualquier doctor).

## Operación — cómo se usa

### Cómo confirmar tus citas pendientes

Si tienes citas que todavía no has confirmado, las ves en un recuadro amarillo arriba de todo, antes que tu lista de pacientes del día.

1. Revisa la cita: paciente, fecha, servicio y consultorio.
2. Da clic en **Confirmar** si puedes atenderla.
3. Si no puedes, da clic en **Rechazar**, escribe brevemente el motivo (mínimo unas palabras, por ejemplo "quirófano programado") y confirma. Recepción se entera para reasignar al paciente, y el paciente recibe un aviso neutral — no ve tu motivo.

### Cómo elegir al paciente que vas a atender

1. En la columna izquierda ves la lista de citas de hoy, ordenadas por hora.
2. Cada tarjeta te muestra la hora, el nombre del paciente, el servicio, el consultorio y en qué parte del proceso va (por ejemplo "Por llegar", "En consulta", "Pago").
3. Si ves una etiqueta roja de **"Consentimiento"** o **"Alergias"**, significa que ese paciente no tiene esa información registrada — revísala antes de avanzar.
4. Da clic sobre la tarjeta del paciente que vas a atender. Se abre su expediente a la derecha.

### Cómo revisar al paciente antes de la consulta

Al seleccionar un paciente ves, en la parte derecha:

1. **Ficha superior:** nombre, edad, sexo, teléfono, tipo de sangre y alergias. Si no tiene alergias confirmadas, te lo advierte en rojo — debes confirmarlas antes de recetar.
2. **Camino del paciente:** una línea con los pasos por los que va pasando (llegada, triage, consulta, receta, pago, salida). Puedes tocar cualquier paso para abrirlo y capturar datos ahí mismo.
3. **Pestañas de historial:** antecedentes, estudios previos, recetas previas y notas de consultas anteriores — revísalas para tener contexto antes de empezar.

### Cómo atender la consulta paso a paso

1. Da clic en **"Abrir consulta"** — esto marca el inicio de la atención y abre la ventana para capturar tu nota.
2. Llena la nota de consulta: diagnóstico, lo que el paciente refiere (subjetivo), lo que tú observas (objetivo), tu análisis y tu plan. Guarda.
3. Si necesitas análisis o estudios, da clic en **"Solicitar análisis"** — eso lo ves más abajo.
4. Si vas a recetar, da clic en **"Emitir receta"** — eso lo ves más abajo. El sistema no te deja avanzar si las alergias del paciente no están confirmadas.
5. Cuando termines, da clic en **"Cerrar consulta"**.
6. Da clic en **"Enviar a pago"** para que el paciente pase a caja, o en **"Dar de alta"** si no requiere pago en este momento.

### Cómo pedir un análisis o estudio

1. Da clic en **"Solicitar análisis"**.
2. Elige el tipo (laboratorio, imagen u otro) y la prioridad (rutina, urgente o STAT).
3. Escribe el nombre del estudio y el motivo clínico.
4. Si el paciente necesita estar en ayuno, activa esa opción.
5. Escribe indicaciones para el paciente si aplica.
6. Da clic en **"Solicitar"** — el estudio queda pendiente hasta que alguien registre el resultado.

### Cómo revisar el resultado de un estudio

Cuando un resultado ya está disponible, aparece en un recuadro azul de "Resultados pendientes de revisión" dentro de las acciones clínicas.

1. Da clic sobre el nombre del estudio.
2. Si el resultado todavía no está registrado, captura el resumen, la URL del archivo (si aplica) y el laboratorio de origen, luego da clic en **"Registrar resultado"**.
3. Una vez que el resultado ya está registrado, escribe tu interpretación médica y da clic en **"Marcar revisado"** — esto deja constancia de que tú lo evaluaste.

### Cómo emitir una receta

1. Da clic en **"Emitir receta"**.
2. Captura los medicamentos, dosis e indicaciones en el editor de receta.
3. Confirma para emitirla — queda ligada a la consulta y al expediente del paciente.

### Cómo programar un seguimiento

1. Da clic en **"Programar seguimiento"**.
2. Elige la fecha y el canal por el que se hará contacto (llamada, WhatsApp, correo o presencial).
3. Agrega notas si quieres dejar contexto para quien dé el seguimiento.
4. Da clic en **"Programar"**.

### Cómo ver el panel de otro doctor (solo administrador)

1. En la parte superior derecha, usa el selector de doctor.
2. Elige al doctor cuya agenda quieres ver — el panel cambia para mostrar sus citas y pacientes.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** no puedes emitir una receta si las alergias del paciente no están confirmadas. **Por qué:** recetar sin saber si el paciente es alérgico a algún medicamento es un riesgo médico — el sistema te obliga a revisarlo primero.
- **Lo que pasa:** si tu estatus está marcado como "no disponible", "vacaciones", "incapacidad" o "suspendido", no se te asignan citas nuevas automáticamente. **Por qué:** evita que el sistema te llene la agenda mientras no puedes atender; las citas que ya tenías programadas sí las sigues viendo.
- **Lo que pasa:** al rechazar una cita, el paciente no ve el motivo que escribiste — solo recepción lo ve. **Por qué:** para no generar confusión o molestia al paciente con información clínica o administrativa que no le corresponde.
- **Lo que pasa:** solo ves las citas del día de hoy en tu cola. **Por qué:** el panel está pensado para la atención del momento, no como agenda completa — para ver fechas futuras o pasadas usa el módulo de citas.
- **Lo que pasa:** cada acción (abrir consulta, guardar nota, solicitar estudio, emitir receta, cerrar consulta, enviar a pago, dar de alta, programar seguimiento) avanza el "camino del paciente" automáticamente. **Por qué:** así todo el equipo (recepción, farmacia, caja) sabe en qué etapa va el paciente sin que tengas que avisarles uno por uno.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No me deja emitir la receta | Las alergias del paciente no están confirmadas | Ve a la ficha del paciente, confirma o registra sus alergias, e intenta de nuevo |
| No veo a un paciente que sé que tiene cita hoy | La cita pudo no estar confirmada por ti, o es de otro doctor | Revisa el recuadro de "Citas por confirmar" arriba, o pide a recepción que verifique a quién está asignada |
| Quiero ver la agenda de otro doctor | Por defecto el panel solo muestra tu propia agenda | Solo el administrador puede cambiar de doctor, con el selector de la parte superior |
| No me deja avanzar el camino del paciente | Falta completar el paso anterior (por ejemplo, no se ha capturado la nota de consulta) | Revisa la línea de "Camino del paciente" y completa el paso pendiente antes de continuar |
| El resultado de un estudio no aparece aunque ya lo tienen en el laboratorio | Nadie lo ha registrado en el sistema todavía | Pide a quien recibe los resultados que los capture, o regístralo tú mismo si lo tienes a la mano |
| Dice que no tengo perfil médico vinculado | Tu usuario no está ligado a ningún doctor en el sistema | Pide al administrador que revise tu cuenta y la vincule a tu perfil de doctor |


## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/PanelDoctor.tsx`
- **Componentes:** `src/features/panel-doctor/components/DoctorConfirmationPanel.tsx` (citas pendientes de confirmar, vía edge function `notify-doctor-confirmation`), `DoctorPatientQueue.tsx` (lista de citas del día), `PatientClinicalContext.tsx` (ficha + camino + tabs de historial), `DoctorActionPanel.tsx` (botones de acción clínica), `RequestStudyDrawer.tsx`, `StudyResultDrawer.tsx`, `FollowupDrawer.tsx`
- **Hooks:** `useDoctorQueue.ts` (carga citas del día + journey + consentimientos, realtime sobre `appointments`/`journey_instances`), `usePatientClinicalSnapshot.ts` (notas, recetas, estudios, expediente del paciente seleccionado)
- **Servicios:** `ensureExpediente.ts` (crea expediente si no existe antes de la primera nota/receta/estudio), `studiesService.ts` (`requestStudy`, `registerStudyResult`, `reviewStudy`), `@/features/camino-paciente/services/clinicalEvents.ts` → `advancePatientJourneyFromClinicalEvent()` (motor de eventos que avanza el journey: `consultation_opened`, `consultation_note_saved`, `study_requested`, `study_received`, `study_reviewed`, `prescription_issued`, `consultation_closed`, `patient_sent_to_billing`, `patient_discharged`, `followup_created`)
- **Modales reusados de otros módulos:** `src/components/NotaConsultaModal.tsx` (nota SOAP), `src/features/recetas/components/PrescriptionEditorModal.tsx` (receta)
- **Tablas Supabase:** `appointments` (incluye `doctor_confirmation_status`, `doctor_id`), `doctors` (incluye `operational_status*`), `patients`, `journey_instances` (`snapshot_json` con `current_step_key`/`progress_percent`), `consentimientos`, `servicios`, `rooms`, estudios/recetas/notas viven en sus propias tablas consumidas por `usePatientClinicalSnapshot`
- **Edge function:** `notify-doctor-confirmation` (confirma/rechaza cita, notifica a recepción/paciente)
- **Cómo agregar un campo nuevo:** migración en la tabla correspondiente + actualizar el tipo en el hook (`useDoctorQueue.ts` o `usePatientClinicalSnapshot.ts`) + el componente que lo muestra + regenerar `types.ts`
- **Cómo agregar una regla de negocio nueva:** si es de avance del journey (qué paso requiere qué condición), vive en `advancePatientJourneyFromClinicalEvent` / la definición de pasos del journey, no en este panel — el panel solo dispara eventos, no decide reglas de flujo

