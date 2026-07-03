# Almacén — Catálogo unificado + buscador tolerante — Design

## Contexto

Módulo Almacén (`/almacen`, separado de Caja en sesión 9) tiene 9 pestañas en
una sola fila (`AlmacenTabs.tsx`): Catálogo, Caducidades, Faltantes, Conteos,
COFEPRIS, ABC/Rotación, Mermas, Reorden, Controlados. Usuario final reportó:

1. La pestaña "Catálogo" (con el listado de medicamentos) se pierde entre las
   otras 8 — no es evidente que es la vista principal.
2. Tareas de uso diario (ver catálogo, ver bajo stock, ver por caducar)
   requieren saltar de pestaña en pestaña.
3. El buscador de `CatalogoMedicamentos.tsx` es `.toLowerCase().includes()`
   — no ignora acentos ("acetaminofen" no encuentra "Acetaminofén") ni
   tolera errores de tipeo.

Confirmado en esta sesión: los accesos a Almacén desde Caja/Farmacia ya
están limpios (sesión 9), no requiere cambio.

## Objetivo

Reducir a 0 clicks de pestaña las 3 tareas más frecuentes (ver catálogo,
filtrar bajo stock, filtrar por caducar), y mover las 7 tareas de baja
frecuencia (reportes/control regulatorio) a un dropdown secundario que no
compita visualmente. Buscador tolerante a acentos y a 1 error de tipeo.

## Alcance

Solo cambia el "chrome" de navegación de `AlmacenTabs.tsx` y la función de
búsqueda de `CatalogoMedicamentos.tsx`. **Ningún componente interno cambia
su lógica de datos** (`FaltantesPanel`, `CaducidadesPanel`,
`InventarioCiclico`, `ReporteCOFEPRIS`, `ReporteRotacionABC`, `ActasMerma`,
`PuntoReorden`, `LibroControlControlados` quedan intactos — solo cambia
cómo se accede a ellos).

## Diseño

### 1. Navegación — `AlmacenTabs.tsx`

- Vista por default: `catalogo`, sin cambios de estado inicial.
- Reemplazar la fila de 9 botones por:
  - **Fila principal** (siempre visible): título "Almacén" + buscador (ya
    vive dentro de `CatalogoMedicamentos`, no se mueve) + 2 chips de filtro
    rápido junto al buscador: **"Bajo stock"** y **"Por caducar"**, cada
    uno con badge de conteo (reusa `bajosStock.length` y
    `proxCaducidad.length`, ya calculados en `AlmacenTabs.tsx:32,36` — cero
    queries nuevas). Click en un chip aplica el filtro sobre el mismo grid
    de catálogo (no cambia de `view`, pasa un prop `quickFilter` a
    `CatalogoMedicamentos`).
  - **Dropdown "Reportes y control"** (shadcn `DropdownMenu`, patrón ya
    usado en el proyecto — ver `ComprasTabs.tsx` para referencia de
    imports): agrupa Faltantes (bitácora `almacen_alertas`), Conteos,
    COFEPRIS, ABC/Rotación, Mermas, Reorden, Controlados. Seleccionar un
    ítem cambia `view` igual que antes (mismo estado, misma lógica de
    render condicional al final del archivo) — solo cambia el control de
    UI que lo dispara.
  - Badges de alerta que hoy están en los botones de Caducidades/Reorden se
    trasladan: Caducidades → chip "Por caducar" (fila principal); Reorden
    → badge en el ítem del dropdown (se mantiene visible sin abrir el
    dropdown solo si hay convención existente de badge-on-trigger; si no,
    aceptar que el conteo de bajo stock ya se ve en el chip "Bajo stock" de
    la fila principal — Reorden es la acción de generar OC a partir de eso,
    no necesita badge duplicado).

### 2. `CatalogoMedicamentos.tsx` — prop `quickFilter`

- Nueva prop opcional `quickFilter?: "bajo_stock" | "por_caducar" | null`
  pasada desde `AlmacenTabs`.
- El filtro existente (línea 89, `filtered = medicamentos.filter(...)`) se
  extiende: si `quickFilter === "bajo_stock"`, además exige
  `stockTotal(m.id) < m.stock_minimo`; si `"por_caducar"`, exige que el
  medicamento tenga al menos un lote en `lotes` con `fecha_caducidad` ≤90
  días y `existencia > 0` (misma condición que `proxCaducidad` en
  `AlmacenTabs.tsx:36`, reescrita localmente o recibida como prop —
  decisión de implementación, no de diseño).
- Los chips activos se muestran con estado visual (igual patrón que los
  botones actuales: `bg-primary text-primary-foreground` vs
  `text-muted-foreground hover:bg-muted`).

### 3. Buscador tolerante — `CatalogoMedicamentos.tsx`

- Función pura nueva `normalizarTexto(s: string): string` —
  `s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()`.
  Se aplica tanto al valor del input (`search`) como a cada campo
  comparado (nombre, código de barras, SKU, laboratorio, principio activo)
  antes del `.includes()` existente (línea 101).
- Tolerancia a 1 error de tipeo: función pura `distanciaLevenshtein(a, b,
  maxDist = 1): boolean` — early-exit en cuanto se supera `maxDist` (no
  hace falta la distancia exacta, solo saber si es ≤1). Se aplica **por
  palabra** del término de búsqueda contra **por palabra** del campo
  comparado, solo para palabras de más de 4 caracteres (evita falsos
  positivos en términos cortos tipo "IVA", "500 mg"). Un match por
  Levenshtein-1 cuenta igual que un `includes()` exitoso.
- Ambas funciones van en un archivo nuevo
  `src/features/almacen/lib/busquedaTolerante.ts` (mantiene
  `CatalogoMedicamentos.tsx` enfocado, sigue la convención de "muchos
  archivos chicos" del proyecto) con export de las 2 funciones puras.

## Testing

- `busquedaTolerante.test.ts` (nuevo): casos para `normalizarTexto`
  (acentos comunes del español: á é í ó ú ñ — ñ NO se debe quitar, es letra
  propia, no diacrítico compuesto — verificar que la regex NFD no la
  afecta) y `distanciaLevenshtein` (0, 1, 2 errores; palabras cortas
  excluidas; casos límite: strings vacíos, mayúsculas).
- Test de integración liviano en `CatalogoMedicamentos` (si existe
  suite existente para este componente, extenderla; si no, no crear una
  nueva solo para esto — cubrir la lógica pura alcanza).
- Chips `quickFilter`: verificar que "Bajo stock" y "Por caducar" filtran
  el mismo array ya usado por los badges existentes (no requiere mock de
  Supabase adicional, los datos ya llegan por props).

## Fuera de alcance

- No se toca la estructura de datos de `almacen_alertas`, `medicamentos`
  ni `lotes_medicamento`.
- No se fusiona `FaltantesPanel` (bitácora, tabla propia con estado
  pending/resolved/external) dentro del catálogo — es un log de eventos,
  conceptualmente distinto a "stock bajo ahora mismo"; queda accesible
  vía dropdown.
- No se rediseña paleta/tipografía — se sigue el sistema Tailwind/shadcn
  ya en uso en el resto de la app.
