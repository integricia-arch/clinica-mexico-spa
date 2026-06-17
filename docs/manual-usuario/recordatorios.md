# Recordatorios

> Aquí ves todos los recordatorios de citas que el sistema ha programado o enviado — por WhatsApp, SMS, correo o Telegram. La usan admin, recepción y doctores para confirmar que los pacientes están siendo avisados de sus citas.

## Operación — cómo se usa

### Cómo ver los recordatorios de un periodo o tipo

1. Entra a "Recordatorios" — verás la lista completa, ordenada para que los **pendientes** aparezcan primero y luego por fecha programada.
2. Usa el filtro **Status** para ver solo Pendientes, Enviados, Fallidos o Cancelados.
3. Usa el filtro **Tipo** para ver solo recordatorios automáticos de 24 horas antes (T-24h), de 2 horas antes (T-2h), o los manuales que alguien creó desde la cita.
4. Da clic en "Actualizar" si quieres traer los datos más recientes — la pantalla no se refresca sola.

### Cómo reintentar un recordatorio que falló o enviarlo antes de tiempo

1. Busca la fila del recordatorio. Si salió mal, verás la etiqueta roja "Fallido" y, debajo, el motivo del error.
2. Da clic en el botón de la derecha:
   - Si está **Fallido**, el botón dice "Reintentar".
   - Si está **Pendiente**, el botón dice "Enviar ahora" (lo manda de inmediato sin esperar a la hora programada).
3. El sistema te avisa si el reintento se solicitó correctamente y actualiza la lista.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** los recordatorios "T-24h" y "T-2h" los crea el sistema solo, no se pueden armar desde aquí.
  **Por qué:** se generan automáticamente cuando se agenda una cita, para avisar 24 y 2 horas antes. Si necesitas un aviso adicional o distinto, créalo manualmente desde el detalle de esa cita (botón "Nuevo recordatorio" en la pantalla de la cita).
- **Lo que pasa:** un recordatorio "Enviado" no tiene botón de acción.
  **Por qué:** ya se mandó, no hay nada más que hacer con él desde aquí.
- **Lo que pasa:** un recordatorio "Cancelado" tampoco tiene botón de acción.
  **Por qué:** alguien lo canceló desde el detalle de la cita; esta pantalla solo lo muestra, no se puede revivir ni reenviar desde aquí.
- **Lo que pasa:** el canal (WhatsApp, SMS, Correo, Telegram) no se elige aquí.
  **Por qué:** el canal queda fijo según cómo esté identificado el paciente (su Telegram vinculado, su correo, etc.); esta pantalla solo te dice por dónde se va a mandar o se mandó.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| Quiero cancelar un recordatorio y no encuentro cómo | Esta pantalla no cancela, solo reintenta o muestra | Ve a la cita correspondiente (Detalle de Cita) y cancela el recordatorio desde ahí |
| Quiero crear un recordatorio nuevo para avisar algo distinto | Esta pantalla es solo de consulta y reintento, no de creación | Ve a la cita correspondiente y da clic en "Nuevo recordatorio" |
| Un recordatorio dice "Fallido" y no entiendo el error | El texto que aparece debajo de la etiqueta roja es el motivo técnico que reportó el canal de envío (ej. número inválido, sin WhatsApp vinculado) | Verifica que el paciente tenga bien su teléfono o correo, y luego da clic en "Reintentar" |
| Le doy "Reintentar" y sigue fallando | El problema de fondo no se resolvió (ej. el paciente no tiene Telegram vinculado o el número está mal) | Corrige el dato de contacto del paciente antes de reintentar de nuevo |
| No veo los recordatorios que acabo de crear desde una cita | La lista no se actualiza sola | Da clic en "Actualizar" |
| Solo veo hasta cierta cantidad de recordatorios y faltan algunos viejos | La pantalla muestra los 500 más próximos por fecha programada | Usa los filtros de Status/Tipo para acotar, o revisa la cita específica en Detalle de Cita |


## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/Recordatorios.tsx` — vista global de solo lectura + reintento, sin creación/edición/cancelación.
- **Relación con `DetalleCita.tsx`:** ambas pantallas leen/escriben la misma tabla `recordatorios_cita`. `DetalleCita.tsx` (sección "Recordatorios" del detalle de cita) es donde se **crean, reprograman y cancelan** recordatorios manuales por cita individual (rol admin/receptionist, ver `puedeGestionarRecordatorios`). `Recordatorios.tsx` es la vista **global/agregada** de todos los recordatorios (automáticos T-24h/T-2h + manuales) con filtros por status/tipo y botón de reintento — no tiene creación ni cancelación propia.
- **Tablas Supabase:** `recordatorios_cita` (no está en los tipos generados, se castea `as any`/`unknown`), join con `identidades_canal` (canal_id, display_name, patients) y `appointments` (fecha_inicio, patients, servicios).
- **RPCs/edge functions:** `enviar-recordatorios` (Supabase Edge Function) — recibe `{ recordatorio_id }` y dispara el envío real por el canal correspondiente (WhatsApp/SMS/correo/Telegram); se invoca tanto desde "Reintentar/Enviar ahora" en esta pantalla como desde "Enviar ahora" en `DetalleCita.tsx`.
- **Roles con acceso a la ruta:** `admin`, `receptionist`, `doctor` (ver `App.tsx` línea ~100 y `AppLayout.tsx` línea 44). Dentro del componente no hay distinción de rol — cualquiera con acceso a la ruta puede reintentar/enviar.
- **Cómo agregar un campo nuevo:** migración `ALTER TABLE recordatorios_cita ADD COLUMN ...` + actualizar el `select()` en `fetchData()` y la interfaz `Recordatorio` en `Recordatorios.tsx` + regenerar tipos si se agrega a `types.ts`.
- **Cómo agregar una regla de negocio nueva (ej. límite de reintentos):** la lógica de envío real vive en la edge function `enviar-recordatorios` (Supabase), no en el frontend — agregarla ahí. El frontend solo invoca y refresca la lista.

