# Enfermería — Solicitudes de Insumos + Entrega de Turno

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Página `/enfermeria` con dos flujos: solicitudes de insumos a farmacia (enfermera crea, admin/manager aprueba) y entrega de turno de enfermería (registro estructurado de handoff entre turnos).

**Architecture:** Nueva página `src/pages/Enfermeria.tsx` con dos tabs. Reutiliza `SolicitudesInsumos` existente sin modificaciones. Añade `EntregaTurno.tsx` nuevo. Queries inline, sin hooks dedicados. Patrón consistente con componentes existentes en el proyecto.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Supabase (PostgREST directo). Tablas `solicitudes_insumos` y `entregas_turno` ya existen en producción con RLS.

## Global Constraints

- `tsc --noEmit` debe pasar con 0 errores al terminar
- No usar `as never` ni `as ReturnType<typeof supabase.from>` — ambos rompen cuando types.ts cambia. Usar `as any` con eslint-disable scoped si la tabla no está en types.ts, o acceso directo si sí está
- `entregas_turno` y `solicitudes_insumos` SÍ están en types.ts — acceso directo sin cast
- Inmutabilidad: spread operator para updates de estado, nunca mutar arrays/objetos directamente
- No `console.log` en producción
- Roles para `/enfermeria`: `nurse`, `admin`, `manager`
- Nav item solo visible si el usuario tiene alguno de esos roles
- `SolicitudesInsumos.tsx` existente NO se modifica — se reutiliza sin cambios
- `rooms.nombre` es el campo de nombre de sala; `rooms.activo = true` para filtrar activas
- `list_nurses()` RPC devuelve `{ user_id, nombre, apellidos, categoria }` — usar para selector enfermera que recibe

---

## Sección 1 — Routing y Navegación

### `src/App.tsx`
Agregar ruta:
```tsx
<Route path="/enfermeria" element={
  <ProtectedRoute allowedRoles={["admin", "manager", "nurse"]}>
    <Enfermeria />
  </ProtectedRoute>
} />
```
Importar `Enfermeria` lazy: `const Enfermeria = lazy(() => import("@/pages/Enfermeria"))`.

### `src/components/AppLayout.tsx`
Agregar ítem en sección "Operaciones" después de "Caja":
```ts
{ to: "/enfermeria", icon: Stethoscope, label: "Enfermería", roles: ["admin", "manager", "nurse"] }
```
Importar `Stethoscope` desde `lucide-react`.

---

## Sección 2 — Página Enfermeria

### `src/pages/Enfermeria.tsx`
Página con dos tabs usando shadcn `Tabs`.

```tsx
<Tabs defaultValue="insumos">
  <TabsList>
    <TabsTrigger value="insumos">Solicitudes de Insumos</TabsTrigger>
    <TabsTrigger value="turno">Entrega de Turno</TabsTrigger>
  </TabsList>
  <TabsContent value="insumos" forceMount>
    <SolicitudesInsumos medicamentos={medicamentos} />
  </TabsContent>
  <TabsContent value="turno">
    <EntregaTurno />
  </TabsContent>
</Tabs>
```

La página carga `medicamentos` (id, nombre, activo=true) para pasarlos a `SolicitudesInsumos`, igual que `Farmacia.tsx`. Sin TurnoGuard — enfermería no requiere turno de caja.

---

## Sección 3 — Componente EntregaTurno

### `src/features/enfermeria/EntregaTurno.tsx`

**Estado interno:**
```ts
interface PacienteRow   { nombre: string; estado: "estable" | "pendiente" | "urgente"; observacion: string }
interface PendienteRow  { descripcion: string; prioridad: "alta" | "media" | "baja" }
interface EntregaDB {
  id: string
  sala: string
  turno: "matutino" | "vespertino" | "nocturno"
  fecha: string
  enfermera_entrega: string | null
  enfermera_recibe: string | null
  resumen: string | null
  pacientes_json: PacienteRow[]
  pendientes_json: PendienteRow[]
  created_at: string
  closed_at: string | null
}
```

**Layout:**
1. Botón "Nueva entrega de turno" (abre Dialog)
2. Tabla/lista de entregas recientes (últimas 30, order by created_at DESC)

**Tabla columnas:** Fecha | Sala | Turno | Pacientes | Pendientes | Estado (abierta/cerrada) | Acciones (ver detalle)

**Dialog — nueva entrega:**
- Sala: `<Select>` con opciones de `rooms` (query al montar, filtro `activo=true`, mostrar `nombre`)
- Turno: `<Select>` con opciones matutino / vespertino / nocturno
- Fecha: `<Input type="date">` default today
- Enfermera que recibe: `<Select>` con opciones de `list_nurses()` RPC, mostrar `nombre apellidos (categoria)`
- Resumen: `<Textarea>` placeholder "Resumen general del turno"
- **Sección Pacientes** (filas dinámicas):
  - Botón "Agregar paciente"
  - Por fila: Input nombre + Select estado (estable/pendiente/urgente) + Input observación + botón eliminar
- **Sección Pendientes** (filas dinámicas):
  - Botón "Agregar pendiente"
  - Por fila: Input descripción + Select prioridad (alta/media/baja) + botón eliminar
- Botón "Guardar entrega"

**Submit:** INSERT directo a `entregas_turno` con `pacientes_json` y `pendientes_json` como arrays JSON. `enfermera_entrega = auth.uid()` (quien está logueado). `clinic_id = activeClinicId`.

**Ver detalle:** Sheet/Dialog de solo lectura al hacer click en fila. Muestra todos los campos incluyendo las listas de pacientes y pendientes.

**Cerrar entrega:** botón "Cerrar turno" en detalle — UPDATE `closed_at = now()`. Solo visible si `closed_at IS NULL`.

---

## Sección 4 — Validaciones y Error Handling

- Sala requerida; turno requerido — validar antes de submit, toast.error si falta
- Si `list_nurses()` falla, mostrar select vacío con toast.warning (no bloquear el flujo)
- Si rooms query falla, permitir escribir sala libremente (fallback a text input)
- Errores de INSERT: `toast.error(error.message)` con botón copiar (patrón existente vía `toast` de `@/lib/toast`)
- Loading state en botón Guardar con `Loader2` spinner

---

## Sección 5 — Tests

### `src/test/enfermeria/entrega-turno.test.ts`
```ts
describe("EntregaTurno helpers", () => {
  it("pacientes vacíos produce array JSON vacío", ...)
  it("pendientes con prioridad alta se serializan correctamente", ...)
  it("estado estable/pendiente/urgente son los únicos valores válidos", ...)
})
```

Exportar funciones puras de serialización desde el componente para que sean testeables:
```ts
export function serializePacientes(rows: PacienteRow[]): PacienteRow[] { return rows }
export function serializePendientes(rows: PendienteRow[]): PendienteRow[] { return rows }
```

---

## Archivos a crear/modificar

| Acción | Archivo |
|--------|---------|
| Crear | `src/pages/Enfermeria.tsx` |
| Crear | `src/features/enfermeria/EntregaTurno.tsx` |
| Crear | `src/test/enfermeria/entrega-turno.test.ts` |
| Modificar | `src/App.tsx` — ruta `/enfermeria` |
| Modificar | `src/components/AppLayout.tsx` — nav item |

`SolicitudesInsumos.tsx` y su RPC: **sin cambios**.
