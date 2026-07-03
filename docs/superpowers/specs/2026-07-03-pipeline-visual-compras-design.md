# Pipeline visual del ciclo de Compras + KPIs en Inteligencia — Design

**Fecha:** 2026-07-03
**Estado:** Aprobado por usuario (brainstorming session)

## Contexto

El ciclo de compras (Solicitud → Cotización → Orden de Compra → Recepción →
Factura → Pago) ya está completamente ligado por FK en base de datos
(`v_ciclo_compras`, migraciones `20260709000001/2/3`) y ya existe un hook
(`useCicloCompras`) que calcula lead times agregados (SC→OC, OC→GR) y los
muestra en `DashboardCompras.tsx`.

Lo que falta, y es el objetivo de este spec:

1. Una **vista visual por trámite individual** que muestre en qué paso está
   cada solicitud de compra ahora mismo, y quién es responsable de que avance
   (o de que esté atrasado).
2. Extender esas métricas al módulo de **Inteligencia/BI** como KPIs de
   operación (no solo agregados de tiempo, también cuellos de botella por
   responsable).

No se requiere ninguna migración de base de datos nueva — todos los campos
necesarios (`aprobada_by`, `recibido_por`, `match_revisado_by`, fechas de cada
etapa) ya existen en `v_ciclo_compras`.

## Alcance

Un solo spec, implementación en 2 fases dentro del mismo plan:
- **Fase A**: Pipeline visual (kanban + drawer de detalle) en el módulo Compras.
- **Fase B**: KPIs de ciclo de compras en Inteligencia/BI.

## Arquitectura

### Nuevo hook: `usePipelineCompras`

Ubicación: `src/hooks/usePipelineCompras.ts`

Consume `useCicloCompras` (no lo reemplaza) y agrega, por cada `CicloRow`:

```typescript
type EtapaPipeline =
  | "solicitud"      // sin cotización aún
  | "cotizacion"     // cotización existe, sin OC
  | "orden_compra"   // OC existe, no recibida
  | "recepcion"      // recibida, sin factura
  | "factura"        // factura existe, sin pago completo
  | "pago"           // pagado — ciclo completo

type RolResponsable = "compras" | "gerencia" | "almacen" | "finanzas";

interface PipelineItem extends CicloRow {
  etapa: EtapaPipeline;
  diasEnEtapa: number;
  responsable: RolResponsable;
  atrasado: boolean;
}
```

**Lógica de `etapa`** (determinística, por el campo más avanzado no-nulo):
1. `pago_id != null` → `"pago"`
2. si no, `factura_id != null` → `"factura"`
3. si no, `recepcion_id != null` → `"recepcion"`
4. si no, `orden_id != null` → `"orden_compra"`
5. si no, `cotizacion_id != null` → `"cotizacion"`
6. si no → `"solicitud"`

**Lógica de `responsable`** (por rol, no por persona — no existe campo de
comprador asignado en BD):
- `"solicitud"` / `"cotizacion"` → `"compras"` (falta convertir a OC o
  seleccionar cotización)
- `"orden_compra"` con `estatus_orden === "pendiente_aprobacion"` →
  `"gerencia"`
- `"orden_compra"` confirmada/parcial, esperando recepción → `"almacen"`
- `"recepcion"` con `estatus_recepcion !== "confirmada"` → `"almacen"`
- `"factura"` con `match_status` en diferencia sin aprobar → `"gerencia"`
- `"factura"` con match ok, esperando pago → `"finanzas"`
- `"pago"` → sin responsable (ciclo cerrado)

**Lógica de `diasEnEtapa`**: `hoy - fecha_del_último_evento_registrado`
(ej. si etapa=`"orden_compra"`, es `hoy - aprobada_at`; si etapa=`"solicitud"`,
es `hoy - fecha_solicitud`).

**Lógica de `atrasado`**: umbrales fijos por etapa (constantes en el mismo
archivo, no configurables por clínica en esta fase):

```typescript
const UMBRAL_DIAS: Record<EtapaPipeline, number> = {
  solicitud: 2,
  cotizacion: 3,
  orden_compra: 5,
  recepcion: 2,
  factura: 7,
  pago: Infinity, // nunca atrasado, ciclo cerrado
};
```

`atrasado = diasEnEtapa > UMBRAL_DIAS[etapa]`.

### Componente A: Pipeline visual (kanban)

Ubicación: `src/features/compras/PipelineCompras.tsx`, nueva tab "Pipeline" en
`ComprasTabs.tsx` (después de "Dashboard").

- 6 columnas (una por `EtapaPipeline`, excepto agrupar "pago" en columna final
  "Completado" con contador colapsado — no interesa ver ciclos cerrados en el
  board activo, solo un contador con link a exportar CSV existente).
- Tarjeta por item: folio de solicitud, proveedor, monto (según etapa: total
  de cotización/orden/factura, el que aplique), badge de "días en etapa" (rojo
  si `atrasado`), badge de color por `responsable` (mismo mapeo de color en
  las 3 vistas: compras=índigo, gerencia=ámbar, almacén=teal, finanzas=violeta).
- Click en tarjeta → `Drawer` (shadcn) con **stepper vertical** de las 6
  etapas: fecha + quién actuó (o "pendiente") en cada una. Mismo color de rol
  que la tarjeta del kanban.
- Filtros arriba: buscar por folio, filtro por proveedor, checkbox "ocultar
  completados" (default: ON).
- Reutiliza `ESTATUS_COLOR`/`ESTATUS_LABEL` de `DashboardCompras.tsx` donde
  aplique (extraerlos a un archivo compartido `src/features/compras/estatus.ts`
  si se duplican — evaluar en implementación).

### Componente B: KPIs en Inteligencia/BI

Ubicación: nueva sección dentro de la página de Inteligencia (`src/pages/*bi*`
o donde viva `useBI` actualmente — confirmar en plan).

- Extiende `useCicloCompras` (o crea `usePipelineStats` sobre
  `usePipelineCompras`) con:
  - Lead time promedio de los 5 tramos completos (Solicitud→Cotización,
    Cotización→OC, OC→Recepción, Recepción→Factura, Factura→Pago) — hoy solo
    existen 2.
  - **Ranking de cuellos de botella**: conteo de items `atrasado=true` en el
    board activo, agrupado por `responsable` — responde "quién está
    frenando más trámites ahora mismo" a nivel operación.
- Estilo visual: seguir patrones existentes de `DashboardCompras.tsx` (cards
  `rounded-xl border bg-card`) y las guías de la skill `dataviz` para
  paleta/barras si se agrega un gráfico de barras del ranking.

## Data flow

```
v_ciclo_compras (vista SQL, ya existe)
  → useCicloCompras (ya existe, sin cambios)
    → usePipelineCompras (nuevo — deriva etapa/responsable/atrasado en cliente)
      → PipelineCompras.tsx (kanban + drawer)
      → sección KPIs en Inteligencia (ranking + lead times de 5 tramos)
```

Sin nuevas queries a Supabase — todo se deriva client-side de datos que
`useCicloCompras` ya trae. Sin cambios de RLS/permisos (misma vista, mismo
scope por `clinic_id`).

## Manejo de errores

`usePipelineCompras` no introduce nuevas fuentes de error — hereda
`loading`/`error` de `useCicloCompras` tal cual. Si `rows` está vacío, el
kanban muestra estado vacío por columna ("Sin trámites en esta etapa"), no
error.

## Responsable — limitación conocida (aceptada por usuario)

El "responsable" es un **rol**, no una persona específica, porque no existe
en el esquema un campo de comprador/analista asignado. Si en el futuro se
agrega asignación real (ej. `ordenes_compra.asignado_a`), este mismo hook es
el punto de extensión — cambiar `RolResponsable` por persona real sin tocar
el resto de los componentes (kanban/drawer/BI ya consumen `responsable` como
valor opaco).

## Testing

- Hook `usePipelineCompras`: tests unitarios de la lógica de `etapa` /
  `responsable` / `atrasado` con filas sintéticas de `CicloRow` cubriendo cada
  rama (sin cotización, con cotización sin OC, OC pendiente aprobación, OC
  confirmada sin recibir, recepción sin confirmar, factura con diferencia,
  factura ok esperando pago, ciclo completo).
- `tsc --noEmit` + `npm run build` limpios (estándar del proyecto).
- Smoke visual: navegar a tab Pipeline, confirmar que carga sin errores de
  consola con datos reales de la clínica activa.

## Fuera de alcance (explícito)

- Umbrales de "atrasado" configurables por clínica (queda como mejora futura,
  mismo patrón que `umbral_diferencia` en Ajustes).
- Asignación de comprador/responsable por persona (requiere campo nuevo en
  BD — fuera de este spec).
- Notificaciones/alertas push cuando un trámite se atrasa (posible extensión
  de `notification_rules` existente, no en este spec).
