# Nueva cita

> Aquí agendas una cita médica nueva desde cero: eliges paciente, médico, consultorio, fecha y hora. La usan recepción y administración.

## Operación — cómo se usa

### Cómo agendar una cita

1. Elige el **paciente** en el selector. Si no está registrado, da clic en "Nuevo paciente" (junto al selector) para darlo de alta sin salir de esta pantalla — al guardarlo, queda seleccionado automáticamente.
2. Elige el **médico** — el selector muestra también su especialidad.
3. Si quieres, elige el **consultorio** (es opcional).
4. Captura la **fecha** (no puedes elegir una fecha anterior a hoy), la **hora de inicio** y la **hora de fin**.
5. Si quieres, escribe el **motivo de consulta** y **notas adicionales** (indicaciones especiales, alergias a considerar).
6. Da clic en **"Agendar cita"**. Si todo está bien, verás un aviso de confirmación y la pantalla te regresa a la Agenda médica.

### Cómo cancelar sin guardar

1. Da clic en **"Cancelar"** — te regresa a la Agenda médica sin crear la cita y borra lo que llevabas escrito.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** paciente, médico, fecha, hora de inicio y hora de fin son obligatorios — si falta alguno, el sistema marca en rojo los campos que faltan y no deja continuar.
  **Por qué:** son los datos mínimos para que la cita exista y aparezca correctamente en la agenda.
- **Lo que pasa:** no puedes elegir una fecha anterior a hoy.
  **Por qué:** no tiene sentido agendar una consulta en el pasado.
- **Lo que pasa:** si cierras o recargas la página sin guardar, al volver a "Nueva cita" encuentras lo que ya habías escrito.
  **Por qué:** el formulario guarda un borrador automático mientras lo llenas, para que no pierdas tu trabajo si te interrumpen.
- **Lo que pasa:** consultorio, motivo y notas son opcionales.
  **Por qué:** a veces no se sabe el consultorio de antemano o no hace falta un motivo detallado; se puede completar después desde el detalle de la cita.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No encuentro al paciente en el selector | Todavía no está registrado en el sistema | Da clic en "Nuevo paciente" junto al selector y regístralo ahí mismo |
| No me deja elegir una fecha | Elegiste una fecha anterior a hoy | Elige hoy o una fecha futura |
| Los campos aparecen en rojo y no me deja agendar | Falta llenar paciente, médico, fecha u hora | Completa los campos marcados en rojo |
| Volví a esta pantalla y ya tenía datos escritos de antes | El formulario guarda un borrador mientras trabajas | Es normal; si no lo necesitas, da clic en "Cancelar" para empezar limpio |
| Me sale un error al agendar | Puede haber un conflicto de horario u otro problema de validación | Lee el mensaje de error y ajusta los datos; si persiste, avisa a soporte |

## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/NuevaCita.tsx` (ruta `/nueva-cita`)
- **Subcomponente:** `src/components/PacienteModal.tsx` (alta rápida de paciente sin salir del formulario)
- **Tablas Supabase involucradas:** `doctors`, `patients`, `rooms` (lectura, para poblar los selectores)
- **Creación real de la cita:** vía edge function `create-appointment` (invocada con `supabase.functions.invoke`), no un insert directo — recibe `patient_id`, `doctor_id`, `room_id`, `fecha_inicio`, `fecha_fin`, `motivo_consulta`, `notas`.
- **Borrador persistente:** el estado del formulario se guarda en `sessionStorage` bajo la clave `nueva-cita-draft` en cada cambio (`useEffect`), y se limpia al agendar con éxito o al cancelar.
- **Validación de campos requeridos:** `useFieldErrors` hook (`markErrors`/`clearError`/`errorClass`) — ver `src/hooks/useFieldErrors.ts`.
- **Cómo agregar un campo nuevo:** agregar al estado `form`, al JSX del formulario, incluirlo en el `body` de la invocación a `create-appointment`, y agregar el manejo correspondiente dentro de esa edge function (`supabase/functions/create-appointment/`).
- **Cómo agregar una regla de negocio nueva:** si es de validación de campos requeridos, ajustar `missing` en `handleSubmit`; si es de negocio más profunda (ej. evitar traslapes de horario), debe vivir en la edge function `create-appointment`, no solo en el frontend.

_/aprende 2026-07-06_
