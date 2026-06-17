# Gestión de usuarios y roles

> Aquí creas cuentas para que el personal pueda entrar al sistema, les asignas qué pueden hacer (roles), y vinculas médicos y enfermeras con su cuenta de acceso. La usa el administrador.

## Operación — cómo se usa

La pantalla tiene tres pestañas: **Cuentas de usuario**, **Médicos del registro** y **Enfermeras del registro**.

### Cómo crear una cuenta nueva

1. Da clic en **"Nuevo usuario"** (arriba a la derecha).
2. Escribe el correo y una contraseña inicial (mínimo 12 caracteres).
3. Elige el rol (Administrador, Gerente, Recepción, Médico, Enfermería, Paciente o Cajero).
4. Si el rol es **Administrador** o **Gerente**, el sistema te pide además un **PIN de autorización** (4 a 6 dígitos, lo escribes dos veces para confirmar). Este PIN se usa después para autorizar cierres de turno con diferencias de caja.
5. Da clic en **"Crear"** — la cuenta queda activa de inmediato, la persona ya puede iniciar sesión con ese correo y contraseña.

### Cómo asignar o quitar un rol a alguien que ya tiene cuenta

1. Ve a la pestaña **"Cuentas de usuario"**.
2. Busca a la persona por correo (o filtra por rol con los botones de arriba).
3. En la columna **"Asignar / Remover"**, da clic sobre el rol que quieres activar o desactivar — el botón se marca con un check cuando está asignado.
4. El cambio aplica al instante, no hace falta guardar nada más.

### Cómo deshabilitar o habilitar el acceso de alguien (sin eliminar su cuenta)

1. En la fila del usuario, da clic en el ícono de **candado** (columna de la derecha).
2. Si estaba activo, queda deshabilitado: la persona ya no puede iniciar sesión, pero su cuenta, historial y roles se conservan.
3. Para reactivarlo, da clic otra vez en el mismo ícono (ahora aparece como candado abierto).

No puedes deshabilitar a un usuario marcado como **"Permanente"** — es una protección para que la clínica nunca se quede sin un administrador con acceso.

### Cómo cambiar el correo o la contraseña de alguien

1. Da clic en el ícono de **lápiz** para cambiar el correo, o en el ícono de **llave** para cambiar la contraseña.
2. Escribe el nuevo valor (la contraseña debe tener mínimo 12 caracteres).
3. Confirma — el cambio aplica de inmediato.

### Cómo configurar el PIN de autorización de un administrador o gerente

1. En la fila de la persona, junto a sus roles, da clic en el enlace **"PIN"** (solo aparece si tiene rol Administrador o Gerente).
2. Escribe el PIN nuevo (4 a 6 dígitos) y confírmalo.
3. Si lo dejas vacío, el PIN actual no cambia.

### Cómo vincular un médico o enfermera con una cuenta de acceso

Un médico o enfermera registrado en el sistema **no puede iniciar sesión ni firmar recetas** hasta que tenga una cuenta vinculada. Si falta vincular a alguien, verás un número en un círculo naranja junto a la pestaña correspondiente.

1. Ve a la pestaña **"Médicos del registro"** o **"Enfermeras del registro"** (o búscalo directamente en "Cuentas de usuario", donde también aparece resaltado en amarillo con la etiqueta "Sin cuenta").
2. Da clic en **"Crear y vincular"**.
3. Elige una de las dos opciones:
   - **Crear cuenta nueva**: escribe correo y contraseña inicial (mínimo 12 caracteres).
   - **Usar cuenta existente**: selecciona de la lista una cuenta que ya exista en el sistema.
4. Confirma — el médico o enfermera ya puede iniciar sesión con esa cuenta.

### Cómo desvincular la cuenta de un médico o enfermera

1. En la fila del médico o enfermera (con cuenta vinculada), da clic en **"Desvincular"**.
2. Confirma la acción.
3. La persona pierde el acceso al sistema, pero **su cuenta de usuario no se elimina** — puedes volver a vincularla después, a él/ella o a otra persona.

### Cómo dar de alta o editar los datos de un médico o enfermera

1. En la pestaña correspondiente, da clic en **"Nuevo médico"** / **"Nueva enfermera"**, o en el lápiz para editar uno existente.
2. Llena nombre, apellidos, especialidad (o categoría, si es enfermera), cédula profesional, teléfono y horario de atención.
3. Guarda — los datos quedan disponibles para agenda y recetas.

Si necesitas dar de baja a alguien que ya tiene citas o recetas asociadas, el sistema no te dejará eliminarlo — marca su casilla **"Activo"** en desmarcado en su lugar.

### Cómo asignar una contraseña base a todos los usuarios

1. Da clic en **"Contraseña base"** (arriba a la derecha).
2. Escribe una contraseña (mínimo 12 caracteres).
3. Confirma con **"Aplicar a todos"** — se aplica a todas las cuentas excepto a los administradores permanentes.
4. Comunica la contraseña de forma segura y pide a cada persona que la cambie en cuanto entre.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** no puedes deshabilitar ni eliminar a un usuario marcado como "Permanente".
  **Por qué:** así la clínica nunca se queda sin al menos un administrador que pueda entrar al sistema.
- **Lo que pasa:** las contraseñas deben tener mínimo 12 caracteres.
  **Por qué:** es el mínimo de seguridad que exige el sistema para proteger las cuentas.
- **Lo que pasa:** un médico o enfermera sin cuenta vinculada no aparece como "listo para trabajar" — sale resaltado en amarillo.
  **Por qué:** sin cuenta no puede iniciar sesión ni firmar recetas, así que es algo que el administrador necesita resolver antes de que esa persona empiece a atender pacientes.
- **Lo que pasa:** al crear un usuario con rol Administrador o Gerente, te pide un PIN de 4 a 6 dígitos.
  **Por qué:** ese PIN se usa más adelante para autorizar cierres de turno cuando hay diferencias de dinero en caja — es una firma de respaldo, no una contraseña.
- **Lo que pasa:** no puedes eliminar a un médico o enfermera que ya tiene citas, recetas o expedientes asociados.
  **Por qué:** eliminarlo borraría la trazabilidad de esos registros clínicos; en su lugar se marca como inactivo, que oculta a la persona de la agenda sin perder el historial.
- **Lo que pasa:** desvincular a un médico o enfermera no borra la cuenta de usuario.
  **Por qué:** así puedes reasignar esa misma cuenta a otra persona o volver a vincularla más adelante sin perder nada.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| Un médico no puede iniciar sesión | No tiene una cuenta vinculada todavía | Ve a "Médicos del registro" y da clic en "Crear y vincular" |
| No puedo deshabilitar a un usuario | Está marcado como "Permanente" | Es una protección del sistema; pide a otro administrador permanente que haga el cambio si realmente es necesario |
| No me deja eliminar a un médico/enfermera | Tiene citas, recetas o expedientes asociados | Márcalo como inactivo en lugar de eliminarlo |
| No aparece el campo de PIN al crear el usuario | El rol elegido no es Administrador ni Gerente | El PIN solo aplica a esos dos roles; los demás no lo necesitan |
| Aplico la "Contraseña base" pero algunos usuarios no cambian | Son administradores permanentes | Es intencional — a ellos no se les puede tocar la contraseña por esta vía, cámbiala individualmente con el ícono de llave |
| Vinculé mal un médico con la cuenta de otra persona | Te equivocaste de cuenta en "Usar cuenta existente" | Da clic en "Desvincular" y repite el proceso con la cuenta correcta |


## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/AdminUsuarios.tsx` (tabs: usuarios, médicos, enfermeras — todo en un solo componente, ~1800 líneas)
- **Edge function:** `supabase/functions/admin-users/index.ts` — acciones: `list`, `create`, `update`, `set_password`, `set_base_password_all`, `toggle_role`, `link_doctor_user`, `unlink_doctor_user`, `link_nurse_user`, `unlink_nurse_user`, `toggle_ban`, `delete`
- **Tablas Supabase:** `doctors`, `nurses` (vinculación vía `user_id`), roles vía la tabla/función que resuelve `AppRole` (consultar `toggle_role` en la edge function), PIN de supervisor vía RPC `set_supervisor_pin`
- **RPCs:** `set_supervisor_pin(p_user_id, p_pin)` — usado tanto al crear un admin/manager como al editar el PIN desde la lista
- **Cómo agregar un rol nuevo:** agregar el valor a `AppRole` y a `ROLE_OPTIONS`/`ROLE_LABELS`/`ROLE_BADGE` en `AdminUsuarios.tsx`, y replicar la validación correspondiente en la edge function (`toggle_role`, `create`)
- **Cómo agregar una regla de negocio nueva (ej. otro requisito para crear un rol):** la validación de creación vive en `handleCreate` (frontend, validación de UX) y debe reforzarse también en `supabase/functions/admin-users/index.ts` acción `create` — el frontend nunca es la única barrera

