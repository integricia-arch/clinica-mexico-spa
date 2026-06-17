# Recepción

> Es la pantalla principal donde ves de un vistazo todo lo que necesita tu atención hoy: casos pendientes en el chat, citas que esperan confirmación del doctor y la agenda del día. La usan recepción y administración.

## Operación — cómo se usa

### Cómo revisar qué necesita atención ahora

1. Entra a "Recepción" — es la primera pantalla que ves al iniciar sesión (o a la que regresas seguido).
2. Mira las tarjetas de arriba: cada una solo aparece si hay algo de ese tipo pendiente (si no ves una tarjeta de "Urgentes", por ejemplo, es porque no hay ninguna ahorita).
3. Atiende primero las tarjetas en rojo (urgentes, rechazadas por doctor, insistencias) y luego las amarillas (pendientes, sin paciente, sin cita).

### Cómo atender un caso del chat

1. En "Casos por atender" verás la lista de conversaciones que el sistema escaló para que las revise una persona.
2. Revisa las etiquetas de cada caso:
   - **Urgente** — necesita atención inmediata.
   - **Insiste** — el paciente ha vuelto a escribir sin que nadie le responda; el número te dice cuántas veces.
   - **Sin paciente** — quien escribe no está identificado en el sistema todavía.
   - **Sin cita** — no tiene una cita asociada a esta conversación.
   - **Doctor pendiente / Doctor rechazó** — la cita relacionada está esperando o fue rechazada por el médico.
3. Da clic en "Abrir" para ir al Inbox y responder o resolver el caso desde ahí.

### Cómo dar seguimiento a citas que esperan al doctor

1. En "Pendientes de confirmar por doctor" verás las citas que ya se agendaron pero el médico todavía no ha dicho si las acepta.
2. Da clic sobre cualquier renglón para abrir el detalle de esa cita y darle seguimiento (por ejemplo, llamar al doctor).

### Cómo reasignar una cita que el doctor rechazó

1. En "Rechazadas por doctor · requieren reasignación" verás las citas que el médico no aceptó, junto con el motivo si lo dio.
2. Da clic sobre el renglón para abrir la cita y asignarla a otro doctor u horario.

### Cómo ver la agenda del día

1. En "Citas del día" aparecen todas las citas programadas para hoy, ordenadas por hora.
2. Cada renglón muestra el horario, el paciente, el doctor, el teléfono (si está registrado) y el estado de la cita (Solicitada, Confirmada, Cancelada, etc.).
3. Da clic sobre una cita para abrir su detalle.

### Cómo crear una cita nueva

1. Da clic en el botón "Nueva cita" (arriba a la derecha).
2. Completa el flujo de agendado que se abre.

### Cómo ir al Inbox completo

1. Da clic en el botón "Inbox" (arriba a la derecha) para ver todas las conversaciones, no solo las escaladas.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** las tarjetas y listas solo muestran información, no se puede editar nada directamente desde aquí. **Por qué:** esta pantalla es un panel de control para detectar pendientes rápido; para actuar (responder un chat, cambiar una cita) siempre te manda a la pantalla específica (Inbox o el detalle de la cita).
- **Lo que pasa:** una tarjeta (como "Urgentes" o "Sin cita asignada") desaparece sola cuando ya no hay ningún caso de ese tipo. **Por qué:** así la pantalla no se llena de tarjetas en cero y resalta solo lo que realmente necesita tu atención.
- **Lo que pasa:** la información se actualiza sola, sin que tengas que recargar la página. **Por qué:** la pantalla está conectada en tiempo real a las conversaciones y citas, para que veas casos nuevos o cambios de estado apenas ocurren.
- **Lo que pasa:** solo ves en "Casos por atender" las conversaciones marcadas como escaladas. **Por qué:** son las que el sistema (o alguien más) decidió que necesitan que una persona las revise; las demás siguen su curso normal en el Inbox.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No veo ninguna tarjeta arriba | No hay nada pendiente en este momento | Es buena señal, no necesitas hacer nada |
| Un caso dice "Sin paciente" | Quien escribió no está vinculado a un registro de paciente todavía | Ábrelo desde "Abrir" y crea o vincula el paciente desde el Inbox |
| Una cita aparece en "Rechazadas por doctor" | El médico revisó la cita y no la aceptó (puede dar un motivo) | Da clic en la cita y reasígnala a otro doctor u horario |
| Llevo rato sin ver actualizarse algo aunque ya respondí el chat | Puede ser un problema de conexión momentáneo | Recarga la página (F5) |
| Veo una etiqueta "Insiste" con un número alto | El paciente ha escrito varias veces sin respuesta | Atiende ese caso primero, es prioridad |


## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/RecepcionDashboard.tsx` (dashboard de solo lectura, sin formularios propios)
- **Tablas Supabase involucradas:** `appointments`, `patients`, `doctors`, `conversaciones`, `identidades_canal`, `doctor_contact_attempts`
- **Realtime:** suscripción a canal `recepcion-realtime` sobre `postgres_changes` en `conversaciones` y `appointments` (re-ejecuta `loadAll()` en cualquier cambio)
- **Navegación de salida:** `/inbox`, `/inbox?id=<conversacion_id>`, `/nueva-cita`, `/cita/:id` — toda acción real (responder, reasignar, agendar) ocurre en esas pantallas, no aquí
- **Métricas derivadas (`opStats`):** calculadas en el cliente con `useMemo` a partir de `convs` (escaladas, urgentes, sin paciente, sin cita, insistencias) — no son columnas, son cálculos sobre `status`, `prioridad`, `insiste` y la relación `appointments`
- **Cómo agregar una tarjeta nueva:** agregar el cálculo correspondiente a `stats`/`opStats`, luego un objeto `{ show, el }` al arreglo `cards` con el ícono de `lucide-react` y el `variant` de `StatCard`
- **Cómo agregar una regla de negocio nueva:** si depende de datos ya cargados, ajustar el `select`/filtro en `loadAll()`; si es una validación de negocio (ej. quién puede reasignar), debe vivir en la pantalla de destino (`/cita/:id`) o en un RPC, no en este dashboard
