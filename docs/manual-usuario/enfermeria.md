# Enfermería

> Aquí el equipo de enfermería solicita insumos/medicamentos a farmacia y registra la entrega de turno con el resumen de pacientes y pendientes para quien entra al siguiente turno. La usan enfermería y, para aprobar solicitudes, administración/gerencia.

## Operación — cómo se usa

Esta pantalla tiene dos pestañas: **"Solicitudes de Insumos"** y **"Entrega de Turno"**.

### Cómo solicitar un insumo o medicamento

1. En la pestaña "Solicitudes de Insumos", elige el insumo en el selector y escribe la cantidad que necesitas.
2. Si quieres, agrega un motivo.
3. Da clic en **"Solicitar"** — la solicitud queda en estado "Pendiente" hasta que alguien de administración la revise.

### Cómo aprobar o rechazar una solicitud (admin/gerencia)

1. Si tu rol es administrador o gerente, verás botones de aprobar/rechazar junto a cada solicitud pendiente.
2. Al aprobar, el inventario se actualiza automáticamente. Al rechazar, la solicitud queda marcada como rechazada sin tocar el inventario.

### Cómo registrar una entrega de turno

1. Ve a la pestaña "Entrega de Turno" y da clic en **"Nueva entrega"**.
2. Elige la **sala**, el **turno** (matutino, vespertino o nocturno) y la **fecha**.
3. Si ya sabes quién recibe el turno, elige la **enfermera que recibe**.
4. Escribe un **resumen general** del turno si quieres dejar contexto.
5. En **Pacientes**, da clic en "Agregar" por cada paciente que quieras dejar anotado: su nombre, su estado (estable, pendiente, urgente) y una observación.
6. En **Pendientes**, da clic en "Agregar" por cada tarea pendiente: su descripción y prioridad (alta, media, baja).
7. Da clic en **"Guardar entrega"**.

### Cómo consultar o cerrar una entrega ya registrada

1. En la lista de entregas, da clic en **"Ver"** sobre cualquier fila para abrir el detalle completo (pacientes y pendientes anotados).
2. Si la entrega sigue abierta, verás el botón **"Cerrar turno"** — da clic para marcarla como cerrada.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** solo administración o gerencia pueden aprobar o rechazar solicitudes de insumos.
  **Por qué:** aprobar una solicitud mueve inventario real — esa decisión requiere supervisión.
- **Lo que pasa:** al aprobar una solicitud, el inventario se descuenta automáticamente.
  **Por qué:** evita que alguien tenga que hacer el ajuste de inventario a mano por separado.
- **Lo que pasa:** una entrega de turno cerrada ya no muestra el botón de "Cerrar turno".
  **Por qué:** una vez cerrada, ya cumplió su función informativa para el cambio de turno; queda como registro histórico.
- **Lo que pasa:** la sala se elige de una lista si existen salas registradas; si no hay ninguna, puedes escribirla a mano.
  **Por qué:** así la pantalla funciona incluso en clínicas que todavía no han configurado sus salas en el sistema.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No veo botones para aprobar o rechazar una solicitud | Tu rol no es administrador ni gerente | Pide a un administrador o gerente que la revise |
| No aparece el insumo que necesito en el selector | El medicamento no está activo o no pertenece a la clínica activa | Verifica con farmacia si el insumo está dado de alta y activo |
| No me deja crear la entrega de turno | No escribiste el nombre de la sala | La sala es obligatoria; complétala antes de guardar |
| Ya cerré un turno por error | No hay botón para reabrirlo desde aquí | Avisa a soporte o a un administrador para corregirlo directamente en la base de datos |

## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/Enfermeria.tsx` (ruta `/enfermeria`) — solo compone dos pestañas, sin lógica propia.
- **Subcomponentes:** `src/features/farmacia/SolicitudesInsumos.tsx` (alta y aprobación de solicitudes), `src/features/enfermeria/EntregaTurno.tsx` (alta/consulta/cierre de entregas de turno), helpers en `src/features/enfermeria/entregaTurnoHelpers.ts`
- **Tablas Supabase involucradas:** `medicamentos` (lectura, filtrada por `clinic_id`), `solicitudes_insumos`, `entregas_turno` (incluye `pacientes_json`/`pendientes_json` como columnas JSON), `rooms`
- **RPCs:** `aprobar_solicitud_insumo`, `rechazar_solicitud_insumo` (mueven inventario/estado de la solicitud), `list_nurses` (poblar selector de "enfermera que recibe")
- **Permisos:** `canApprove = hasRole("admin") || hasRole("manager")` en `SolicitudesInsumos.tsx` controla los botones de aprobar/rechazar.
- **Roles con acceso a la ruta:** `admin`, `manager`, `nurse` (ver `App.tsx`, ruta `/enfermeria`).
- **Cómo agregar un campo nuevo a la entrega de turno:** como `pacientes_json`/`pendientes_json` son columnas JSON, agregar el campo al tipo `PacienteRow`/`PendienteRow` en `entregaTurnoHelpers.ts` y al JSX del formulario — no requiere migración de columna a menos que se quiera indexar/filtrar por ese campo.
- **Cómo agregar una regla de negocio nueva:** la lógica de aprobación/rechazo de inventario vive en las RPCs de Postgres (`aprobar_solicitud_insumo`/`rechazar_solicitud_insumo`), no en el frontend — ahí es donde debe ir cualquier regla nueva sobre movimientos de inventario.

_/aprende 2026-07-06_
