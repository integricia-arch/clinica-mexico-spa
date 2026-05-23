# Prompt Lovable #1 — Completar Inbox (máxima prioridad)

> **Pegar este prompt entero en Lovable. Es self-contained.**

---

## Contexto

La página `src/pages/Inbox.tsx` muestra conversaciones de Telegram entre pacientes y el bot. Ya tiene el 80%: split-panel (lista + chat), tabs por status, realtime de mensajes, botón "Cerrar conversación".

Falta lo último para que **recepción pueda responder al paciente** cuando el bot escala.

## Edge Function ya deployada

`enviar-mensaje-humano` existe en Supabase con esta firma:

```ts
// Llamada desde el frontend:
await supabase.functions.invoke("enviar-mensaje-humano", {
  body: { conversacion_id: string, mensaje: string }
});
// Inserta en tabla mensajes con raw_payload: { sent_by_human: true }
// y despacha al paciente vía Telegram API.
```

## Tareas (8 cambios en `src/pages/Inbox.tsx` + 1 en `src/components/AppLayout.tsx`)

### 1. Input de envío al fondo del panel derecho
Solo visible cuando `selected?.status === "escalada"`. Componentes:
- `<Textarea>` controlado con `useState<string>("")`
- `<Button>` "Enviar" — deshabilitado si texto vacío o `loading=true`
- Enter envía, Shift+Enter inserta salto de línea
- Limpia el textarea tras envío exitoso

### 2. Lógica de envío
```ts
const handleSend = async () => {
  if (!selected || !mensaje.trim()) return;
  setLoading(true);
  const { error } = await supabase.functions.invoke("enviar-mensaje-humano", {
    body: { conversacion_id: selected.id, mensaje: mensaje.trim() }
  });
  setLoading(false);
  if (error) {
    toast.error("Error al enviar: " + error.message);
  } else {
    setMensaje("");
    toast.success("Mensaje enviado");
  }
};
```
El realtime existente ya recoge el INSERT en `mensajes` — no hace falta refetch manual.

### 3. Burbujas verdes para mensajes humanos
En el render de mensajes, si `mensaje.raw_payload?.sent_by_human === true`:
- Burbuja con `bg-green-100 dark:bg-green-900/30` y border `border-green-300`
- Etiqueta pequeña arriba: "Recepción" (text-xs, color verde)
- Alineada a la derecha (igual que assistant)

Las burbujas existentes:
- `role === "user"` → izquierda, gris
- `role === "assistant"` y NO sent_by_human → derecha, azul/primary
- `role === "assistant"` y sent_by_human → derecha, verde + etiqueta

### 4. Filtro default = "escalada"
Cambiar el estado inicial del filtro de tabs de `"todas"` a `"escalada"`. Es lo que recepción quiere ver primero al abrir.

### 5. Búsqueda por nombre de paciente
Arriba de los tabs, agregar `<Input placeholder="Buscar paciente..." />` con `useState` para `searchQuery`. Filtra la lista de conversaciones por `conversacion.paciente_nombre.toLowerCase().includes(searchQuery.toLowerCase())`. Si no tienes el nombre en el objeto conversación, joinea con `identidades_canal` → `patients` en el query inicial.

### 6. Badge numérico en sidebar
En `src/components/AppLayout.tsx`, en el `NavLink` de `/inbox`:
- Query: `select count from conversaciones where status='escalada'`
- Suscríbete a UPDATE en `conversaciones` para refrescar el contador
- Mostrar badge rojo si count > 0 (usa el componente `<Badge variant="destructive">`)
- Si count = 0, no mostrar nada

### 7. Link al perfil del paciente
En el header del panel derecho (donde dice el nombre de la conversación seleccionada), agregar un `<Link>` al perfil: `/pacientes/{patient_id}` o el path equivalente que tengas. Usa el ícono `<User2 className="w-4 h-4" />` de lucide.

### 8. Empty state mejorado
Cuando no hay conversaciones en el tab activo, en vez de espacio en blanco mostrar:
- Ícono `<MessageSquare>` grande, gris
- Texto "No hay conversaciones {filtro}"
- Subtexto en text-muted-foreground

## Restricciones

- **No agregar librerías nuevas.** Reusa shadcn/ui (Textarea, Button, Input, Badge), lucide-react, sonner.
- **No tocar archivos fuera de** `src/pages/Inbox.tsx` y `src/components/AppLayout.tsx`.
- **Mantén la estructura de tipos existente.** Si necesitas tipar `raw_payload`, hazlo en línea: `(mensaje.raw_payload as { sent_by_human?: boolean })?.sent_by_human`.
- **`npm run build` debe pasar** sin errores TypeScript al final.

## Validación

Al terminar, confirma que:
1. El input solo aparece en conversaciones escaladas.
2. Enviar mensaje genera burbuja verde + llega a Telegram (puede probarse después).
3. El badge del sidebar refleja conversaciones escaladas.
4. Búsqueda filtra la lista en vivo.
5. Default al cargar `/inbox` muestra escaladas primero.
6. Build pasa.
