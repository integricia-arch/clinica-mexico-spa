# Prompt Lovable #2 — Página /recordatorios

> **Crea una página comprehensiva para que recepción vea TODOS los recordatorios del sistema.**

---

## Contexto

Hoy los recordatorios se ven solo dentro de `/cita/:id` (DetalleCita.tsx). Necesitamos una vista global con filtros, búsqueda y acción de reintento.

## Tabla a consumir: `recordatorios_cita`

Columnas relevantes:
```
id (uuid)
appointment_id (uuid)  → join a appointments
identidad_canal_id (uuid) → join a identidades_canal
programado_para (timestamptz)
status (text: 'pendiente' | 'enviado' | 'fallido' | 'cancelado')
tipo (text: 'T-24h' | 'T-2h' | 'manual')
enviado_at (timestamptz | null)
ultimo_error (text | null)
mensaje (text | null)
intentos (int)
created_at (timestamptz)
```

Joins necesarios:
- `appointments(scheduled_for, patient_id, doctor_id, servicio_id)`
- `appointments.patients(full_name)`
- `appointments.doctors(full_name)` (si existe)
- `appointments.servicios(name)`
- `identidades_canal(canal_id, display_name)`

## Archivos a crear/tocar

1. **Nuevo:** `src/pages/Recordatorios.tsx`
2. **Editar:** `src/App.tsx` — registrar ruta `/recordatorios` con `<ProtectedRoute>` (rol admin o receptionist)
3. **Editar:** `src/components/AppLayout.tsx` — agregar item en sidebar con ícono `<Bell>` de lucide, después de `/inbox`

## Estructura de `Recordatorios.tsx`

### Layout
- Header con título "Recordatorios" + descripción "Gestión de recordatorios automáticos y manuales"
- Card con filtros (collapsible en mobile)
- Card con tabla principal

### Filtros (arriba de la tabla)
- **Status:** multiselect con chips — pendiente / enviado / fallido / cancelado
- **Tipo:** multiselect — T-24h / T-2h / manual
- **Rango de fecha:** dos `<Input type="date">` "Desde" / "Hasta" sobre `programado_para`
- **Búsqueda:** `<Input>` por nombre de paciente
- Botón "Limpiar filtros"

Persistir filtros en URL search params (`useSearchParams` de react-router) para que el reload mantenga el estado.

### Tabla (shadcn `<Table>`)

| Columna | Render |
|---|---|
| Paciente | `appointments.patients.full_name` |
| Cita | fecha+hora de `appointments.scheduled_for` en es-MX |
| Servicio | `appointments.servicios.name` o `—` |
| Canal | `identidades_canal.display_name ?? canal_id` |
| Tipo | `<Badge>` con color: T-24h=naranja, T-2h=amarillo, manual=gris |
| Programado para | fecha+hora en es-MX |
| Status | `<Badge>` con color: pendiente=amarillo, enviado=verde, fallido=rojo, cancelado=gris. Si `fallido`, `<Tooltip>` con `ultimo_error` |
| Acciones | Si `fallido` → botón "Reintentar". Si `pendiente` → botón "Cancelar". Resto sin acciones. |

Default order: `programado_para ASC`, status `pendiente` primero.

Paginación: 50 por página con `useState` para `page`. Botones "Anterior" / "Siguiente" abajo.

### Acción "Reintentar"
```ts
const reintentar = async (id: string) => {
  const { error } = await supabase
    .from("recordatorios_cita")
    .update({ status: "pendiente", intentos: 0, ultimo_error: null })
    .eq("id", id);
  if (error) toast.error("Error: " + error.message);
  else toast.success("Marcado para reintento. El cron lo procesará en máx 5 min.");
};
```

### Acción "Cancelar"
```ts
const cancelar = async (id: string) => {
  if (!confirm("¿Cancelar este recordatorio?")) return;
  const { error } = await supabase
    .from("recordatorios_cita")
    .update({ status: "cancelado" })
    .eq("id", id);
  // toast similar
};
```

### Realtime
```ts
useEffect(() => {
  const channel = supabase
    .channel("recordatorios-changes")
    .on("postgres_changes",
      { event: "*", schema: "public", table: "recordatorios_cita" },
      () => refetch())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, []);
```

### Empty state
Si no hay recordatorios (filtros aplicados o no):
- Ícono `<Bell>` grande en gris
- Texto "Sin recordatorios" / "Sin resultados para estos filtros"

### Skeleton loader
Mientras carga, mostrar 5 filas de skeleton (`<Skeleton>` de shadcn) en lugar de "Cargando...".

## Permisos

Usa el patrón existente. Solo admin y receptionist pueden ver esta ruta:

```tsx
<Route path="/recordatorios" element={
  <ProtectedRoute allowedRoles={["admin", "receptionist"]}>
    <Recordatorios />
  </ProtectedRoute>
} />
```

Si tu `ProtectedRoute` usa otra firma, adapta.

## Restricciones

- No agregar librerías nuevas. Solo lo que ya hay: shadcn/ui, react-query, supabase-js, date-fns, lucide-react, sonner.
- Usa `useQuery` de `@tanstack/react-query` para el fetch principal (con `queryKey` que incluya los filtros).
- Audit log: cada acción (reintentar/cancelar) inserta en `audit_logs` con `_tabla: "recordatorios_cita"`. Usa el mismo patrón que `DetalleCita.tsx`.
- `npm run build` debe pasar sin errores.

## Validación

1. Navegar a `/recordatorios` carga lista sin errores.
2. Filtros funcionan y persisten en URL.
3. Botón "Reintentar" en un fallido cambia su status a pendiente.
4. El item del sidebar aparece con ícono Bell.
5. Build verde.
