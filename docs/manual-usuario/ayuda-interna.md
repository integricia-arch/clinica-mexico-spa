# Ayuda interna

> Aquí ves y respondes las dudas que cualquier persona del equipo escribe desde el botón flotante "Hablar con un humano". La usan recepción, manager y admin.

## Operación — cómo se usa

### Cómo llega un mensaje a esta pantalla

1. Cualquier usuario, en cualquier pantalla del sistema, da clic en el botón flotante (el ícono redondo en la esquina inferior derecha) y escribe su duda.
2. Esa conversación aparece aquí, en la lista de la izquierda, casi al instante — no necesitas recargar la página.
3. Junto al nombre de la persona ves desde qué pantalla escribió (por ejemplo "Pantalla de origen: /caja"), para que sepas de qué está hablando antes de leer el mensaje.

### Cómo encontrar las conversaciones que debes atender

1. Usa los botones de arriba para filtrar: **Escaladas**, **Abiertas**, **Cerradas**, **Todas**.
2. Por default ves **Escaladas** — son las que nadie ha tomado todavía. Revísalas primero.
3. Da clic sobre cualquier conversación de la lista para abrirla y leer los mensajes completos a la derecha.

### Cómo tomar una conversación

1. Abre la conversación.
2. Si nadie la ha tomado, verás el botón **Tomar** — da clic ahí.
3. Desde ese momento la conversación queda asignada a ti y pasa a estado "Abierta", para que tus compañeros sepan que ya alguien la está atendiendo.

### Cómo responder

1. Con la conversación abierta, escribe tu respuesta en el cuadro de texto de abajo.
2. Presiona **Enter** para enviar (Shift+Enter si quieres bajar de línea sin enviar).
3. Tu respuesta aparece de inmediato en la conversación, y la persona que preguntó la ve en su chat sin recargar nada.

### Cómo cerrar una conversación

1. Cuando ya resolviste la duda, da clic en **Cerrar**.
2. La conversación pasa a estado "Cerrada" y deja de aparecer en los filtros de Escaladas/Abiertas.
3. Si quieres volver a verla después, usa el filtro **Cerradas** o **Todas**.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** toda conversación nueva entra como "Escalada", no como "Abierta".
  **Por qué:** así nadie se queda sin respuesta — el filtro de Escaladas siempre muestra lo que aún no tiene dueño.
- **Lo que pasa:** una vez que cierras una conversación, ya no puedes escribir en ella desde esta pantalla.
  **Por qué:** una conversación cerrada se considera resuelta. Si la persona tiene una duda nueva, el sistema le abre una conversación distinta la próxima vez que escriba.
- **Lo que pasa:** solo admin, manager y recepción pueden entrar a esta pantalla.
  **Por qué:** es la bandeja de soporte interno, no algo que el resto del personal necesite ver.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No veo ninguna conversación nueva | Estás en el filtro "Escaladas" y no hay ninguna sin tomar | Revisa el filtro "Abiertas" o "Todas" — puede que ya esté tomada por otra persona |
| Quiero responder pero no aparece el cuadro de texto | La conversación ya está cerrada | Las conversaciones cerradas son solo de consulta; si la persona tiene una duda nueva, le aparecerá un chat nuevo a ella |
| Tomé una conversación por error | No hay botón para "soltarla" desde aquí | Avísale a la persona correcta para que la atienda, o cierras y la persona puede volver a escribir |
| El mensaje de la persona no dice de qué pantalla viene ("—") | No siempre se guarda esa información | Pregúntale directamente en el chat desde dónde te escribe |


## Implementación — para el siguiente dev/agente

- **Archivo(s) principal(es):** `src/pages/AyudaInterna.tsx` (bandeja de staff), `src/components/HelpChatWidget.tsx` (botón flotante que usa cualquier usuario para escribir)
- **Tablas Supabase involucradas:** `ayuda_chat_sesiones` (estado: `abierta` | `escalada` | `cerrada`; `atendido_por`, `ruta_origen`, `closed_at`), `ayuda_chat_mensajes` (rol: `usuario` | `asistente_ia` | `humano` | `sistema`; `autor_id`, `contenido`)
- **RPCs/edge functions:** `ayuda_chat_resolver_usuarios` (resuelve `user_id` → email/nombre para mostrar en la lista de sesiones; no hay RPC de IA conectada — el rol `asistente_ia` existe en el esquema pero no se usa en el flujo actual)
- **Realtime:** ambos componentes usan `supabase.channel(...).on("postgres_changes", ...)` — `AyudaInterna.tsx` escucha cambios en `ayuda_chat_sesiones` (lista) y en `ayuda_chat_mensajes` filtrado por `sesion_id` (conversación abierta); `HelpChatWidget.tsx` simétrico del lado del usuario.
- **Tomar/cerrar sesión:** son simples `UPDATE` directos desde el frontend sobre `ayuda_chat_sesiones` (`estado`, `atendido_por`, `closed_at`) — no hay RPC ni trigger de por medio.
- **Cómo agregar un campo nuevo:** migración `ALTER TABLE ayuda_chat_sesiones ADD COLUMN ...` (o `ayuda_chat_mensajes`) + actualizar las interfaces `Sesion`/`Mensaje` en ambos archivos + regenerar `types.ts` (`generate_typescript_types`).
- **Cómo agregar una regla de negocio nueva:** hoy toda la lógica de estados vive en el frontend (`tomarSesion`, `cerrarSesion`, `handleReply` en `AyudaInterna.tsx`). Si se necesita una regla que no se pueda saltar desde otra vía (ej. impedir reabrir una sesión cerrada), moverla a un RPC de Postgres en vez de dejarla en el cliente.

