# Configuración del Camino del Paciente

> Aquí defines cómo fluye la atención de un paciente dentro de la clínica: qué etapas hay (llegada, triage, consulta, receta, cobro, etc.), qué campos se capturan en cada una, y qué reglas bloquean o advierten si algo falta. Solo la usa el administrador.

## Operación — cómo se usa

### Cómo elegir o crear una plantilla de camino

1. Entra a "Configuración" → "Configuración del Camino del Paciente".
2. Arriba ves las **plantillas** disponibles (tarjetas). La marcada "Base" es la que usa la clínica por defecto.
3. Da clic en una tarjeta para trabajar sobre esa plantilla.
4. Para crear una nueva, da clic en **"Nueva plantilla"**, ponle nombre, tipo y descripción — se crea copiando las etapas de la plantilla base (o, si no hay ninguna, con las etapas críticas mínimas).

### Cómo editar una etapa del flujo (pestaña "Etapas")

1. En la lista de etapas, da clic en **"Editar"** sobre la que quieras cambiar.
2. Ajusta: nombre visible, descripción, si es obligatoria, si permite "No aplica", si requiere responsable asignado, si bloquea el avance del paciente, si requiere adjuntar un documento, tiempo máximo recomendado, y qué roles pueden completarla o autorizar una excepción.
3. Guarda los cambios.

Las etapas marcadas con un candado son **críticas** — no se pueden eliminar y siempre quedan como obligatorias, aunque sí puedes ajustar el resto de sus opciones.

### Cómo agregar campos a una etapa (pestaña "Campos")

1. Elige la etapa en el selector de arriba.
2. Da clic en **"Agregar campo"** y elige uno de la lista de opciones disponibles para ese tipo de etapa (solo se muestran campos coherentes con la etapa, para evitar configuraciones inválidas).
3. Para quitar un campo ya agregado, da clic en **"Quitar"** junto a él.

### Cómo administrar catálogos protegidos (pestaña "Catálogos")

Los catálogos son listas de opciones (por ejemplo, motivos o resultados) que usan ciertas etapas. Aquí solo puedes **activar o desactivar** cada elemento — nunca se elimina, para no perder la trazabilidad de registros que ya lo usaron.

### Cómo crear una regla de validación (pestaña "Reglas")

1. Da clic en **"Nueva regla"**.
2. Ponle un nombre, elige la etapa origen, y describe en palabras simples la condición ("si requiere análisis = sí y resultado vacío") y la acción ("bloquear avance hasta cargar resultado").
3. Elige la severidad: **Informativa**, **Advertencia** o **Bloqueante**.
4. Guarda — la regla queda activa de inmediato.

### Cómo probar la configuración antes de publicarla (Simulador)

1. Da clic en **"Simular camino"** (arriba, junto a las pestañas).
2. Elige un escenario y revisa cómo quedaría cada etapa: aprobada, bloqueada, con override requerido, u omitida.
3. Cierra el simulador cuando termines — es solo una vista previa, no cambia nada real.

### Cómo revisar si la configuración tiene errores (pestaña "Diagnóstico")

Aquí ves un semáforo (Segura / Con advertencias / Inválida) con el detalle de cada observación. Si hay errores, no podrás publicar una versión nueva hasta corregirlos.

### Cómo publicar una versión nueva (pestaña "Versiones")

1. Todo lo que edites (etapas, campos, catálogos, reglas) se guarda como **borrador** — no afecta a los pacientes todavía.
2. Escribe el **motivo del cambio** (obligatorio).
3. Da clic en **"Publicar"** sobre la versión borrador. Si la configuración tiene errores, el sistema no te deja publicar — corrígelos primero en "Diagnóstico".
4. Al publicar, la versión anterior queda archivada (puedes **"Restaurar"** cualquier versión archivada si necesitas volver atrás).

### Cómo consultar el flujo completo de referencia (pestaña "Flujo completo")

Esta pestaña es solo informativa: describe las 7 etapas del flujo ideal de atención (Agenda, Llegada, Consulta, Prescripción, Farmacia, Facturación, Seguimiento/Alta) como visión general del sistema. No se edita desde aquí.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** las etapas críticas no se pueden eliminar y siempre son obligatorias.
  **Por qué:** son los pasos mínimos que garantizan que el paciente reciba una atención segura y trazable (identificación, consulta, prescripción, etc.) — quitarlas rompería la integridad del expediente.
- **Lo que pasa:** los cambios no afectan a los pacientes hasta que publicas una versión.
  **Por qué:** así puedes experimentar y corregir errores sin arriesgar que un paciente real quede atrapado en una configuración a medio terminar.
- **Lo que pasa:** no puedes publicar si el diagnóstico marca errores.
  **Por qué:** publicar una configuración inválida (por ejemplo, una etapa crítica sin ningún rol autorizado a completarla) dejaría a los pacientes sin poder avanzar en su atención.
- **Lo que pasa:** los elementos de un catálogo no se eliminan, solo se desactivan.
  **Por qué:** si un registro clínico ya usó esa opción, borrarla dejaría el historial incompleto o inconsistente.
- **Lo que pasa:** una etapa crítica debe tener al menos un rol autorizado a completarla.
  **Por qué:** sin esto, nadie en el sistema podría cerrar esa etapa y el paciente quedaría bloqueado ahí indefinidamente.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No puedo eliminar una etapa | Está marcada como crítica (tiene candado) | Es una protección del sistema; solo puedes ajustar sus opciones, no eliminarla |
| El botón "Publicar" está deshabilitado | La configuración tiene errores pendientes | Revisa la pestaña "Diagnóstico" y corrige lo que indique antes de intentar de nuevo |
| Edité varias cosas pero al recargar la página siguen viéndose los valores viejos | Solo guardaste un borrador, no publicaste la versión | Ve a "Versiones" y publica el borrador con un motivo de cambio |
| Necesito volver a como estaba la semana pasada | Hay una versión archivada de esa fecha | Ve a "Versiones" y da clic en "Restaurar" sobre la versión que corresponda |
| No encuentro la opción que necesito en "Agregar campo" | El catálogo de campos disponibles depende del tipo de etapa | Solo se muestran campos coherentes con esa etapa; si de verdad falta una opción, pide ayuda al equipo técnico |

## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/configuracion/CaminoPaciente.tsx` (exporta `CaminoPacienteConfig`, ruta `/configuracion/camino-paciente`). ~1150 líneas — múltiples sub-componentes internos: `FieldsPanel`, `CatalogsPanel`, `RulesPanel`, `VersionsPanel`, `SimulatorDialog`, `NewTemplateDialog`, `StepEditorSheet`, `FlujoPacientePanel`.
- **Hooks/lib de soporte:** `src/features/camino-paciente/hooks/useJourneyData.ts` (`useJourneyTemplates`, `useJourneyVersion`), `lib/stepKeys.ts`, `lib/validateJourneyConfiguration.ts`, `lib/simulateJourney.ts`, `lib/getAvailableOptionsForStep.ts`, `components/ConfigHealthBadge.tsx`.
- **Tablas Supabase:** `journey_templates`, `journey_template_versions` (draft/active/archived), `journey_step_definitions`, `journey_step_fields`, `journey_option_catalogs`, `journey_option_items`, `journey_validation_rules`.
- **RPCs/edge functions:** ninguna — todo el CRUD es `supabase.from(...)` directo desde el componente.
- **Cómo agregar un tipo de etapa nuevo:** actualizar `STEP_TYPE_LABELS` en `stepKeys.ts` y las opciones disponibles en `getAvailableOptionsForStep.ts`.
- **Cómo agregar una regla de negocio nueva sobre publicación:** la validación de "puede publicar" vive en `validateJourneyConfiguration.ts` (`canPublish`); agregar el nuevo check ahí para que se refleje tanto en el botón "Publicar" como en la pestaña "Diagnóstico".
- **Publicación de versión:** archiva la versión `active` anterior, marca la nueva como `active`, actualiza `journey_templates.active_version_id` — tres updates secuenciales sin transacción explícita (revisar si se necesita atomicidad si se reporta inconsistencia).

_/aprende 2026-07-06_
