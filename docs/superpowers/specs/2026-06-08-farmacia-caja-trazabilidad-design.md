# Farmacia · Caja · Trazabilidad — Diseño

**Fecha:** 2026-06-08  
**Proyecto:** clinica-mexico-spa  
**Enfoque:** Incremental (3 fases independientes y entregables)

---

## Contexto y problema

El sistema tiene dos módulos de caja paralelos (`turnos` + `pharmacy_cash_shifts`) que se vinculan automáticamente pero son confusos para el operador. El menú mezcla módulos operativos con administrativos sin agrupación. La trazabilidad receta → farmacia → inventario está incompleta: no hay lista de recetas pendientes visible en farmacia, ni bitácora de faltantes, aunque el selector de catálogo en la receta ya existe parcialmente.

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|---|---|---|
| Organización menú | Opción C: grupos + módulo Caja unificado | Elimina confusión de 2 turnos; cajero tiene módulo propio claro |
| Caja | Solo operativo (turno + corte) | Config de cajas queda en Configuración (admin) |
| Medicamento sin stock | Badge rojo informativo, no bloquea emisión | Paciente puede comprar fuera; doctor solo se informa |
| Medicamento sin catálogo | Badge rojo "sin ligar a inventario" | No se obliga, pero se visibiliza la brecha |
| Lista pendientes farmacia | Sí, encima del scanner existente | Paciente llega con receta ya emitida; farmacéutico la busca rápido |
| Bitácora faltantes | Tabla `almacen_alertas` nueva | Trazabilidad consolidada por medicamento; resolución explícita |

---

## Fase 1 — Menú y módulo Caja unificado

### Menú lateral (`AppLayout.tsx`)

Grupos con separadores visuales:

```
[Clínica]
  Panel principal    /              admin, receptionist, doctor, nurse
  Recepción          /recepcion     admin, receptionist
  Pacientes          /pacientes     admin, receptionist, doctor, nurse
  Agenda             /agenda        admin, receptionist, doctor, nurse
  Nueva cita         /nueva-cita    admin, receptionist
  Panel Doctor       /doctor        admin, doctor
  Expedientes        /expedientes   admin, doctor, nurse
  Recetas            /recetas       admin, doctor, nurse
  Citas              /citas         admin, receptionist, doctor, nurse
  Recordatorios      /recordatorios admin, receptionist, doctor

[Operaciones]
  Farmacia           /farmacia      admin, nurse, receptionist
  Caja               /caja          admin, manager, cajero, receptionist

[Admin]
  Facturación        /facturacion   admin, receptionist
  Conversaciones     /inbox         admin, receptionist, doctor, nurse
  Auditoría          /auditoria     admin
  Configuración      /configuracion admin, doctor
```

`Caja · Configuración` y `Caja · Turno` desaparecen del menú.

### Nueva página `/caja` (`src/pages/Caja.tsx`)

Tabs:
- **Turno** — contenido actual de `CajaTurno.tsx` (abrir/cerrar turno, fondo apertura, notas, historial de enlace con pharmacy shift)
- **Corte** — contenido actual de `src/features/farmacia/CorteCaja.tsx`

Roles con acceso: `admin`, `manager`, `cajero`, `receptionist`.

### `Configuracion.tsx`

Agregar tab **Cajas** con el contenido actual de `CajaConfiguracion.tsx`.  
Ruta `/configuracion/caja` redirige a `/configuracion` (o queda como alias).

### `Farmacia.tsx`

Eliminar tab **Corte de Caja** del `TabsList`. El `CorteCaja` feature se usa en `/caja` únicamente.  
Tabs restantes: Punto de venta · Surtir receta · Venta directa · Inventario.

### Rutas (`App.tsx`)

```
/caja                → Caja (nueva página)
/configuracion       → Configuracion (con tab Cajas)
/configuracion/caja  → redirect a /configuracion (alias)
```

---

## Fase 2 — Stock check en receta + lista pendientes en farmacia

### 2A — Indicador de stock en `PrescriptionEditorModal.tsx`

**Estado nuevo:**
```typescript
const [stockMap, setStockMap] = useState<Record<string, number>>({});
```

**En `pickMedicamento(id)`** — después de actualizar el draft:
```typescript
const { data } = await supabase
  .from("lotes_medicamento")
  .select("existencia")
  .eq("medicamento_id", id)
  .gt("existencia", 0)
  .gte("fecha_caducidad", today);
const total = (data ?? []).reduce((s, l) => s + l.existencia, 0);
setStockMap(prev => ({ ...prev, [id]: total }));
```

**En la lista de items ya agregados** — badge por item:
- `item.medication_id && stockMap[id] >= item.quantity` → `🟢 {n} en stock`
- `item.medication_id && stockMap[id] < item.quantity` → `🔴 solo {n} disponibles`
- `!item.medication_id` → `🔴 sin ligar a inventario`

Info solo. No bloquea `handleAddItem` ni `handleIssue`.

**Scope:** solo `PrescriptionEditorModal.tsx`, ~35 líneas.

### 2B — Lista de recetas pendientes en `SurtirReceta.tsx`

Nueva sección colapsable encima del form del scanner:

```
"Recetas pendientes ({count})"  [colapsar/expandir]
  query: prescriptions WHERE status IN ('issued','partially_dispensed')
         AND clinic_id = activeClinicId
         ORDER BY issue_date DESC LIMIT 30
  JOIN: patients (nombre, apellidos)

  Columnas: Folio | Paciente | Fecha | Estado | [Surtir →]
  Click "Surtir" → loadPrescription(rx.prescription_number ?? rx.id)
```

Scanner QR existente queda intacto debajo. Los dos flujos coexisten.

**Scope:** `SurtirReceta.tsx`, ~60 líneas nuevas.

---

## Fase 3 — Bitácora de faltantes

### 3A — Migración SQL

```sql
CREATE TABLE almacen_alertas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           uuid REFERENCES clinics(id),
  tipo                text NOT NULL
                        CHECK (tipo IN ('faltante_receta', 'stock_minimo')),
  medicamento_id      uuid REFERENCES medicamentos(id),
  generic_name        text,            -- fallback si medication_id es null
  quantity_needed     int NOT NULL,
  quantity_available  int NOT NULL DEFAULT 0,
  prescription_id     uuid REFERENCES prescriptions(id),
  prescription_item_id uuid REFERENCES prescription_items(id),
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'resolved', 'external')),
  resolved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON almacen_alertas (clinic_id, status, created_at DESC);
CREATE INDEX ON almacen_alertas (medicamento_id, status);
```

RLS: mismas políticas que `movimientos_inventario` (admin/nurse ven todo; cajero sin acceso).

### 3B — Lógica al emitir receta (`prescriptionService.ts`)

En `issuePrescription()`, después de `UPDATE prescriptions SET status='issued'`:

```typescript
const today = new Date().toISOString().slice(0, 10);
for (const item of prescriptionItems) {
  let stockActual = 0;
  if (item.medication_id) {
    const { data } = await supabase
      .from("lotes_medicamento")
      .select("existencia")
      .eq("medicamento_id", item.medication_id)
      .gt("existencia", 0)
      .gte("fecha_caducidad", today);
    stockActual = (data ?? []).reduce((s, l) => s + l.existencia, 0);
  }
  const needed = Number(item.quantity ?? 0);
  if (needed > 0 && stockActual < needed) {
    await supabase.from("almacen_alertas").insert({
      clinic_id: prescription.clinic_id,
      tipo: "faltante_receta",
      medicamento_id: item.medication_id ?? null,
      generic_name: item.medication_id ? null : item.generic_name,
      quantity_needed: needed,
      quantity_available: stockActual,
      prescription_id: prescription.id,
      prescription_item_id: item.id,
    });
  }
}
```

Inserción best-effort (no lanza error si falla — no bloquea la emisión).

### 3C — Resolución al surtir (`SurtirReceta.tsx`)

En `confirmDispense()`, después del surtido exitoso:

```typescript
const surtidosItemIds = dispensable.map(d => d.item.id);
await supabase
  .from("almacen_alertas")
  .update({ status: "resolved", resolved_at: new Date().toISOString() })
  .in("prescription_item_id", surtidosItemIds)
  .eq("status", "pending");
```

Items que no se surtieron completamente quedan `pending` para la bitácora.

### 3D — Sub-tab "Faltantes" en `Farmacia.tsx` › tab Inventario

Nueva vista dentro del tab Inventario (selector de sub-vista: Catálogo | Movimientos | **Faltantes**):

```
Tabla agrupada por medicamento_id / generic_name:
  Medicamento | Recetas pendientes | Qty solicitada | Stock actual | Diferencia

  Por fila: botones
    "Externo" → status='external' (paciente lo consiguió fuera)
    "Recibido" → status='resolved' (entró al almacén; el stock ya se actualiza por entrada)

Filtro por status: Pendientes | Externos | Resueltos
```

---

## Roles finales

| Módulo | Roles |
|---|---|
| `/farmacia` | admin, nurse, receptionist |
| `/caja` | admin, manager, cajero, receptionist |
| `/configuracion` (tab Cajas) | admin, manager |
| `/recetas` | admin, doctor, nurse |
| Stock check en receta | doctor (solo UI, sin ruta nueva) |

---

## Archivos modificados por fase

### Fase 1
- `src/components/AppLayout.tsx` — NAV_ITEMS con grupos, nueva ruta /caja
- `src/pages/Caja.tsx` — nueva página (Turno + Corte tabs)
- `src/pages/Configuracion.tsx` — agregar tab Cajas
- `src/pages/Farmacia.tsx` — eliminar tab Corte de Caja
- `src/App.tsx` — nueva ruta /caja, alias /configuracion/caja

### Fase 2
- `src/features/recetas/components/PrescriptionEditorModal.tsx` — stockMap + badges
- `src/features/farmacia/SurtirReceta.tsx` — lista pendientes colapsable

### Fase 3
- `supabase/migrations/YYYYMMDDHHMMSS_almacen_alertas.sql` — nueva tabla
- `src/features/camino-paciente/services/prescriptionService.ts` — insertar alertas al issue
- `src/features/farmacia/SurtirReceta.tsx` — resolver alertas al surtir
- `src/pages/Farmacia.tsx` — sub-tab Faltantes en Inventario

---

## Lo que NO cambia

- Lógica de vinculación `turnos` ↔ `pharmacy_cash_shifts` (ya funciona con trigger DB)
- Rutas existentes de farmacia, recetas, agenda, pacientes
- Schema de `prescriptions`, `prescription_items`, `pharmacy_sales`, `movimientos_inventario`
- Flujo de scanner QR en SurtirReceta
