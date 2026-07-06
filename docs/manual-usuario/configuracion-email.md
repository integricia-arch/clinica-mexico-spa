# Email y notificaciones

> Aquí defines qué nombre y correo ve el paciente cuando el sistema le envía un correo (facturas CFDI, recordatorios). Solo la usa el administrador.

## Operación — cómo se usa

1. Entra a "Configuración" → "Email y notificaciones".
2. Escribe el **nombre del remitente** (ej. "Integriclinica") — es el nombre que el paciente ve en su bandeja de entrada.
3. Escribe el **correo emisor** (ej. facturacion@tudominio.com) — debe pertenecer a un dominio ya verificado en el proveedor de envío de correos (Resend). Si lo dejas vacío, se usa el remitente por defecto del sistema.
4. Si quieres que las respuestas del paciente lleguen a un correo distinto del emisor, captúralo en **"Responder a"** (opcional).
5. Da clic en **"Guardar configuración de email"** — el botón solo se activa si hiciste algún cambio.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** el correo emisor debe pertenecer a un dominio verificado en Resend.
  **Por qué:** los proveedores de correo (Gmail, Outlook, etc.) marcan como spam o rechazan los correos que vienen de un dominio sin verificar — verificarlo es lo que le da validez técnica al envío.
- **Lo que pasa:** si dejas el correo emisor vacío, el sistema usa un remitente por defecto.
  **Por qué:** así la clínica puede empezar a operar sin configurar su propio dominio de correo, y personalizarlo después cuando lo tenga listo.
- **Lo que pasa:** el botón de guardar solo se activa si hay cambios pendientes.
  **Por qué:** evita guardar sin necesidad cuando no modificaste nada.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| Los correos de la clínica caen en spam | El dominio del correo emisor no está verificado en Resend | Verifica el dominio en el panel de Resend agregando los registros DNS indicados |
| Guardé pero el botón sigue igual | No hiciste ningún cambio en los campos, o ya se guardó correctamente | Revisa que los valores mostrados sean los que esperabas; si sí cambiaron, ya se guardó |
| No sé qué correo poner y lo dejé vacío | Es válido dejarlo vacío | El sistema usará el remitente por defecto mientras no configures uno propio |
| Las respuestas de los pacientes no me llegan a donde esperaba | El campo "Responder a" está vacío o apunta a otro correo | Completa "Responder a" con el correo donde quieres recibir las respuestas |

## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/configuracion/ConfiguracionEmail.tsx` (ruta `/configuracion/email`).
- **Hook compartido:** `useClinicSettingsForm<EmailSettings>(activeClinicId, "email", DEFAULTS)` (`src/hooks/useClinicSettingsForm.ts`) — mismo patrón genérico que otras pantallas de configuración basadas en `clinic_settings`.
- **Tabla Supabase:** `clinic_settings` (fila `section = 'email'`, JSON `data: {from_name, from_email, reply_to}`).
- **Proveedor de envío:** Resend — la verificación de dominio se hace en el panel externo de Resend, no desde esta pantalla.
- **Cómo agregar un campo nuevo (ej. firma HTML del correo):** agregar la propiedad a la interfaz `EmailSettings` y a `DEFAULTS`, y el input correspondiente en el JSX — el hook `useClinicSettingsForm` persiste automáticamente cualquier campo que esté en el tipo.

_/aprende 2026-07-06_
