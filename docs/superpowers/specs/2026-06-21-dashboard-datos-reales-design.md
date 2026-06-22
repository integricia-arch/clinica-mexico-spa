# Dashboard con datos reales — Spec

**Fecha:** 2026-06-21  
**Scope:** Reemplazar datos hardcodeados en `src/pages/Dashboard.tsx` con queries reales a Supabase  
**Archivos afectados:** 2 (crear 1, modificar 1)

---

## Problema

`Dashboard.tsx` muestra arrays estáticos con datos falsos:
- 6 citas ficticias con nombres inventados
- KPIs con valores fijos (`24 citas`, `1,847 pacientes`, `$38,420 MXN`, `14 min`)
- 5 eventos de actividad reciente inventados
- Fecha fija `"Lunes 30 de marzo, 2026"`
- Banner con `"3 pacientes"` hardcodeado

Un administrador que abre el dashboard ve información que no corresponde a su clínica.

---

## Solución

Crear `useDashboardHoy` hook + actualizar `Dashboard.tsx` para consumirlo.

---

## Hook: `src/hooks/useDashboardHoy.ts`

### Interface de retorno

```typescript
interface DashboardHoyData {
  loading: boolean;
  error: string | null;
  totalCitasHoy: number;
  citasHoy: CitaHoy[];
  ingresosHoy: number;       // centavos → dividir /100 al mostrar
  totalPacientes: number;
  alertasPendientes: number; // almacen_alertas status='pending'
  citasSinConfirmar: number; // citas hoy con status no confirmado
  actividadReciente: ActividadItem[];
  refresh: () => void;
}

interface CitaHoy {
  id: string;
  hora: string;              // "HH:mm" extraído de fecha_inicio
  paciente: string;          // "Nombre Apellido"
  medico: string;            // "Dr(a). Nombre Apellidos"
  tipo: string;              // tipo_consulta o "Consulta"
  estado: string;            // status mapeado a label legible
}

interface ActividadItem {
  texto: string;
  tiempo: string;            // "Hace X min/h"
  created_at: string;
}
```

### Queries (Promise.all de 5)

```sql
-- 1. Citas de hoy con join a patients y doctors
SELECT id, fecha_inicio, status, tipo_consulta,
       patients(nombre, apellido_paterno),
       doctors(nombre, apellidos)
FROM appointments
WHERE fecha_inicio::date = CURRENT_DATE AND clinic_id = $1
ORDER BY fecha_inicio ASC

-- 2. Ingresos del día
SELECT SUM(total) FROM pharmacy_sales
WHERE created_at::date = CURRENT_DATE AND clinic_id = $1 AND status = 'completed'

-- 3. Total pacientes activos
SELECT COUNT(*) FROM patients WHERE activo = true

-- 4. Actividad reciente (audit_logs hoy)
SELECT id, created_at, accion, tabla, datos_nuevos
FROM audit_logs
WHERE created_at::date = CURRENT_DATE AND clinic_id = $1
ORDER BY created_at DESC LIMIT 10

-- 5. Alertas stock pendientes
SELECT COUNT(*) FROM almacen_alertas
WHERE status = 'pending' AND clinic_id = $1
```

### Mapeo status → label

```
confirmada             → "Confirmada"
confirmada_paciente    → "Confirmada por paciente"
confirmada_medico      → "Confirmada por médico"
pendiente_confirmacion → "Pendiente de confirmación"
recordatorio_enviado   → "Recordatorio enviado"
solicitada             → "Solicitada"
cancelada              → "Cancelada"
no_show                → "No se presentó"
en_consulta            → "En consulta"
completada             → "Completada"
```

### Mapeo audit_log → texto actividad

```
accion=crear + tabla=patients         → "Nuevo paciente registrado: {datos_nuevos.nombre}"
accion=crear + tabla=appointments     → "Cita agendada"
accion=actualizar + tabla=appointments → "Cita actualizada"
accion=crear + tabla=pharmacy_sales   → "Venta registrada en farmacia"
accion=crear + tabla=notas_consulta   → "Nota clínica registrada"
accion=crear + tabla=expedientes      → "Expediente creado"
default                               → "{ACCION_LABEL[accion]} en {TABLA_LABEL[tabla]}"
```

### Cálculo "hace X tiempo"

```typescript
function tiempoRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Hace un momento";
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `Hace ${hrs} h`;
}
```

---

## Cambios en `src/pages/Dashboard.tsx`

### KPI cards

| Antes | Después |
|---|---|
| `"24"` | `String(data.totalCitasHoy)` |
| `"1,847 pacientes"` | `data.totalPacientes.toLocaleString("es-MX")` |
| `"$38,420 MXN"` | `new Intl.NumberFormat("es-MX", {style:"currency",currency:"MXN"}).format(data.ingresosHoy / 100)` |
| Clock "14 min" espera | AlertCircle `data.alertasPendientes` alertas stock (KPI cambia semánticamente) |

> Nota: "espera promedio" se elimina porque requiere `check_in_at` que no existe en `appointments`. Se reemplaza con "Alertas de stock" que es dato real disponible y operacionalmente relevante.

### Agenda de hoy

Reemplazar `citasHoy.map(...)` → `data.citasHoy.map(...)`.  
La estructura del JSX no cambia — mismos campos `hora`, `paciente`, `medico`, `tipo`, `estado`.

### Actividad reciente

Reemplazar `actividadReciente.map(...)` → `data.actividadReciente.map(...)`.  
Misma estructura JSX.

### Fecha en header

```typescript
// Antes:
"Resumen de operaciones — Lunes 30 de marzo, 2026"

// Después:
`Resumen de operaciones — ${format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}`
```

### Banner de alertas

```typescript
// Antes: hardcoded "3 pacientes no han confirmado"
// Después:
data.citasSinConfirmar > 0
  ? `${data.citasSinConfirmar} cita(s) pendientes de confirmar para hoy.`
  : null  // si 0, no mostrar banner
```

### Loading state

```tsx
if (data.loading) return <DashboardSkeleton />;
```

`DashboardSkeleton`: 4 `<Skeleton className="h-24 rounded-xl" />` en grid 4 cols + 2 bloques debajo.

---

## Lo que NO cambia

- Estructura visual del layout (grid, clases Tailwind)
- Componente `StatCard` — misma API
- `estadoColor` map — se mantiene igual
- El diseño responsive

---

## Edge cases

- `activeClinicId = null` → retornar estado vacío (loading=false, arrays vacíos, valores en 0)
- Pharmacy_sales sin datos → mostrar `$0.00 MXN`
- Sin citas hoy → lista vacía con mensaje "Sin citas programadas para hoy"
- Sin audit_logs hoy → actividad reciente vacía con mensaje "Sin actividad reciente"
- Error Supabase → mostrar `error` state con botón "Reintentar"

---

## No incluido en este scope

- Tiempo de espera promedio (requiere `check_in_at` en `appointments` — feature separada)
- Alertas de estudios pendientes (requiere módulo Estudios — M2)
- Real-time subscriptions (Postgres changes) — se puede agregar en iteración futura
- Filtros por fecha o rango — dashboard siempre muestra "hoy"
