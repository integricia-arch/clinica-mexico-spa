# Pacientes

> Aquí buscas, registras y editas la información de los pacientes de la clínica, y consultas su historial de citas, recetas y pagos. La usan principalmente recepción y administración; doctores y enfermería pueden consultarla para ver el historial.

## Operación — cómo se usa

### Cómo buscar un paciente

1. Escribe en el buscador el nombre, apellido, teléfono o CURP del paciente (al menos 2 letras).
2. La lista se filtra sola mientras escribes — no hace falta dar Enter.
3. Si no aparece nadie, revisa que esté bien escrito o que el paciente no esté dado de baja.

### Cómo ver el historial de un paciente

1. Da clic en cualquier parte de la tarjeta del paciente (no en el lápiz).
2. Se abre un panel a la derecha con tres pestañas: **Citas**, **Recetas** y **Pagos**.
3. Revisa cada pestaña — muestra los últimos registros, con su fecha y estado (por ejemplo, una cita en verde significa confirmada; en rojo, cancelada).
4. Si una pestaña dice "Sin registros", es que el paciente no tiene historial todavía en esa categoría.

### Cómo registrar un paciente nuevo

1. Da clic en **"Nuevo paciente"** (arriba a la derecha).
2. Llena **nombre** y **apellidos** — son los únicos campos obligatorios.
3. Si los tienes a la mano, completa también: fecha de nacimiento, sexo, CURP, RFC, teléfono, email.
4. En la sección de dirección, captura calle y número, colonia, municipio, estado y código postal — cada uno es un campo separado, no los mezcles en uno solo.
5. En datos clínicos puedes anotar tipo de sangre, alergias y notas generales (por ejemplo, padecimientos relevantes).
6. Si quieres, agrega un contacto de emergencia (nombre y teléfono).
7. Da clic en **"Registrar paciente"** — si todo está bien, verás un aviso de confirmación y el paciente aparece en la lista.

### Cómo editar un paciente existente

1. Localiza al paciente en la lista.
2. Da clic en el ícono de lápiz de su tarjeta (no en el resto de la tarjeta, porque eso abre el historial).
3. Modifica los campos que necesites.
4. Da clic en **"Guardar cambios"**.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** solo nombre y apellidos son obligatorios para registrar a un paciente; todo lo demás es opcional.
  **Por qué:** así puedes registrar a alguien rápido (por ejemplo, si llega de urgencia) y completar sus datos después.
- **Lo que pasa:** el botón "Nuevo paciente" y el lápiz de editar solo aparecen si tu usuario es administrador o recepción.
  **Por qué:** para que solo el personal autorizado pueda crear o modificar expedientes; otros roles (doctor, enfermería) solo pueden consultar.
- **Lo que pasa:** la dirección se captura en varios campos separados (calle, colonia, municipio, estado, código postal) en vez de un solo cuadro de texto.
  **Por qué:** así la información queda ordenada y se puede usar después para trámites o reportes sin tener que volver a separarla a mano.
- **Lo que pasa:** el sexo solo se puede elegir entre "Masculino", "Femenino" u "Otro" desde una lista, no se puede escribir libremente.
  **Por qué:** evita errores de captura y mantiene la información consistente en todo el sistema.
- **Lo que pasa:** la búsqueda solo funciona a partir de 2 letras escritas.
  **Por qué:** para no sobrecargar el sistema buscando con una sola letra entre todos los pacientes.
- **Lo que pasa:** si hay más de 100 pacientes que coinciden, solo se muestran los primeros 100.
  **Por qué:** para que la pantalla cargue rápido. Si no encuentras a quien buscas, afina la búsqueda con más datos (apellido completo, teléfono, CURP).

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No veo el botón "Nuevo paciente" ni el lápiz de editar | Tu usuario no tiene permiso (no eres administrador ni recepción) | Pide a un administrador o recepción que registre o edite al paciente |
| Busco a un paciente y no aparece | Está mal escrito, tiene pocas letras, o el paciente está dado de baja | Revisa la ortografía, escribe al menos 2 letras, o busca por teléfono/CURP |
| Doy clic en la tarjeta y no pasa nada | Probablemente diste clic justo en el ícono del lápiz, que abre edición en vez del historial | Da clic en otra parte de la tarjeta (el nombre o el ícono de iniciales) |
| El historial dice "Sin registros" en alguna pestaña | El paciente todavía no tiene citas, recetas o pagos registrados en el sistema | Es normal si es un paciente nuevo; no necesitas hacer nada |
| Guardé un paciente pero no veo todos sus datos reflejados | Puede que la pantalla no se haya actualizado | Recarga la página (F5) o vuelve a buscar al paciente |


## Implementación — para el siguiente dev/agente

- **Archivo(s) principal(es):** `src/pages/PacientesLista.tsx` (lista + búsqueda + drawer de historial), `src/components/PacienteModal.tsx` (alta/edición)
- **Tablas Supabase involucradas:** `patients` (lectura/escritura), `appointments`, `prescriptions`, `pharmacy_sales` (solo lectura, para el historial)
- **RPCs/edge functions:** ninguna — todo es CRUD directo vía cliente Supabase (`select`/`insert`/`update` sobre `patients`)
- **Campos de `patients` usados en el formulario:** `nombre`, `apellidos` (requeridos), `fecha_nacimiento`, `sexo` (`M`/`F`/`Otro` — CHECK constraint, ver `CLAUDE.md`), `curp`, `rfc`, `telefono`, `email`, `direccion`, `colonia`, `municipio`, `estado`, `codigo_postal`, `tipo_sangre`, `alergias`, `notas`, `contacto_emergencia_nombre`, `contacto_emergencia_telefono`. **No existe `domicilio_ciudad`** — cualquier dato de ciudad/localidad debe mapearse a `municipio`.
- **Permisos de edición:** `canEdit = hasRole("admin") || hasRole("receptionist")` en `PacientesLista.tsx` — controla la visibilidad de "Nuevo paciente" y el botón de editar, no hay RLS adicional documentada aquí.
- **Búsqueda:** `ilike` sobre `nombre`, `apellidos`, `telefono`, `curp` con debounce de 300ms; mínimo 2 caracteres; límite de 100 resultados (`.limit(100)`).
- **Cómo agregar un campo nuevo:** migración `ALTER TABLE patients ADD COLUMN ...` → agregar a `FormState` y `EMPTY_FORM` en `PacienteModal.tsx` → agregar el `<Field>` correspondiente en el JSX → incluir en `payload` dentro de `handleSubmit` → regenerar `types.ts` (`generate_typescript_types`).
- **Cómo agregar una regla de negocio nueva:** la validación de campos requeridos vive en el frontend (`handleSubmit` en `PacienteModal.tsx`, usa `useFieldErrors`); si la regla debe ser inviolable (no solo UX), agregarla también como CHECK constraint o trigger en Postgres para que no se pueda saltar desde otra vía (ej. el bot de Telegram, que también inserta en `patients`).

