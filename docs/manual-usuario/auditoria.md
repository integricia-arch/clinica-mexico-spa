# Auditoría

> Aquí ves el historial de lo que ha pasado en el sistema: citas, expedientes, farmacia y caja. También revisas si los recordatorios de citas se enviaron bien y si hubo errores técnicos en el punto de venta. La usa el administrador o quien supervisa la clínica.

## Operación — cómo se usa

La pantalla tiene tres pestañas: **Seguimientos**, **Registro general** y **Farmacia / Caja**.

### Cómo revisar los recordatorios de citas (pestaña "Seguimientos")

1. Entra a "Auditoría" — esta es la pestaña que ves primero.
2. Usa los botones de arriba para filtrar: **Pendiente**, **Enviado**, **Fallido** o **Todos**.
3. Revisa la tabla: paciente, médico, tipo de recordatorio, fecha en que estaba programado, y su estado.
4. Si un recordatorio pendiente ya pasó su fecha, lo ves marcado en rojo como "Vencido".
5. Da clic en la fecha de la columna "Cita" para ir directo a esa cita en la Agenda.
6. Si quieres ver los datos más recientes, da clic en "Actualizar".

### Cómo revisar el historial general de cambios (pestaña "Registro general")

1. Da clic en la pestaña "Registro general".
2. Usa el filtro de "Módulo" para ver solo los cambios de un área (Pacientes, Agenda, Expedientes, Farmacia, Caja, etc.) o deja "Todos".
3. En la tabla ves: fecha y hora, módulo, qué se modificó, tipo de acción (creación, actualización, cancelación, eliminación, consulta), quién lo hizo y el identificador del registro.
4. Más abajo, en la sección "Errores POS", ves los errores técnicos más recientes del punto de venta (hasta 50). Si dice "Sin errores registrados", todo está bien.
5. Si necesitas ver el detalle de un error, da clic en "Payload" para desplegarlo, o en el ícono de copiar para mandarlo a soporte técnico.

### Cómo revisar operaciones de Farmacia y Caja (pestaña "Farmacia / Caja")

1. Da clic en la pestaña "Farmacia / Caja".
2. Arriba ves los errores técnicos del punto de venta, igual que en "Registro general".
3. Abajo ves las operaciones de farmacia y caja: aperturas/cierres de turno, cortes, movimientos de fondo y ventas.
4. Usa el filtro desplegable para ver solo un tipo (Turnos caja, Cortes, Turnos farmacia, Movimientos de fondo, Ventas farmacia) o deja "Todos".
5. Si una operación trae datos adicionales (folio, monto, diferencia), los ves resumidos en la tarjeta. Da clic en "JSON" para ver el detalle completo, o en el ícono de copiar para llevarlo a otro lado.
6. Da clic en "Actualizar" para refrescar la lista.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** Solo ves operaciones de Farmacia/Caja de la clínica activa en ese momento.
  **Por qué:** Cada clínica tiene su propia caja y su propio inventario — no se mezclan los registros entre clínicas.
- **Lo que pasa:** El registro general muestra como máximo los últimos 200 eventos, y los errores POS los últimos 50.
  **Por qué:** Es un historial reciente para detectar problemas rápido, no un reporte completo de todo lo que ha ocurrido desde siempre.
- **Lo que pasa:** Un recordatorio de cita "Vencido" no se reenvía solo.
  **Por qué:** El sistema solo marca que ya pasó su hora programada; alguien tiene que revisar por qué no se envió y decidir si contactar al paciente manualmente.
- **Lo que pasa:** Esta pantalla no tiene botón para exportar o descargar el historial.
  **Por qué:** Es una vista de consulta y monitoreo, no un generador de reportes.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No veo ninguna operación de Farmacia/Caja | No tienes una clínica activa seleccionada, o no hay eventos para el filtro elegido | Verifica la clínica activa arriba en el sistema, o cambia el filtro a "Todos" |
| Un recordatorio dice "Fallido" | El sistema intentó enviarlo (SMS/WhatsApp/llamada) y no se pudo entregar | Contacta al paciente por otro medio y revisa que su teléfono esté correcto en su expediente |
| Veo muchos errores en "Errores POS" | El punto de venta tuvo problemas técnicos al cobrar o registrar movimientos | Copia el detalle del error (botón de copiar) y compártelo con soporte técnico |
| No encuentro un cambio que sé que se hizo hace tiempo | El historial general solo guarda los últimos 200 registros más recientes | Si necesitas algo más antiguo, pide ayuda a soporte técnico para consultarlo directamente en la base de datos |
| La lista no se actualiza aunque sé que algo cambió | La pantalla no se refresca sola | Da clic en el botón "Actualizar" de la sección correspondiente |


## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/Auditoria.tsx` (3 tabs: `seguimientos`, `general`, `farmacia`, manejados con state local `tab`)
- **Tablas Supabase involucradas:** `audit_logs` (registro general y log de farmacia/caja filtrado por `tabla` IN [`pharmacy_cash_shifts`, `pharmacy_sales`, `fondos_movimientos`, `turnos`, `cortes`]), `pos_error_logs` (errores técnicos del POS), `recordatorios_cita` (join con `appointments`, `patients`, `doctors`) para la pestaña de seguimientos
- **RPCs/edge functions:** Ninguna — todas las cargas son `select` directos vía `supabase.from(...)`, no hay mutaciones desde esta pantalla
- **Filtrado de clínica:** la pestaña "Farmacia / Caja" depende de `useActiveClinic()`; `loadFarmLogs()` solo corre si hay `activeClinic.id` y se re-ejecuta en el `useEffect` cuando cambia el tab o la clínica activa
- **Mapeo de etiquetas:** `TABLA_LABEL` (tabla → módulo/nombre legible), `ACCION_LABEL`/`ACCION_COLOR` (crear/actualizar/cancelar/eliminar/consultar), `EVENT_LABEL` (eventos especiales de farmacia como `pharmacy_shift_opened`, `corte_x_generado`, etc., leídos de `datos_nuevos.event`)
- **Cómo agregar una tabla nueva al registro general:** agregar la entrada correspondiente en `TABLA_LABEL` (con su `modulo` y `nombre`); si el módulo es nuevo, agregarlo también al array `MODULOS`
- **Cómo agregar un evento especial nuevo a Farmacia/Caja:** agregar la tabla al arreglo `PHARMACY_TABLAS` y al `.in("tabla", [...])` de `loadFarmLogs()`, y si tiene un evento con etiqueta propia, agregarlo a `EVENT_LABEL`
- **Límites de carga:** `audit_logs` general = 200 filas, `pos_error_logs` = 50, `audit_logs` de farmacia = 100, `recordatorios_cita` = 100 — todos hardcoded con `.limit(...)`, sin paginación
- **No hay exportación/descarga implementada** en esta pantalla

