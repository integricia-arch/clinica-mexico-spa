# 04 — Brief UI/UX: Guía Visual y de Interacción

---

## Estética General

**Tono:** Profesional médico pero accesible. No frío/hospitalario. Limpio, denso en información sin sentirse abrumador. Inspiración: Linear para densidad de info + shadcn/ui para componentes + toques de color para estados clínicos.

**Modo:** Dark mode como primario, light mode como alternativa (ya implementado, revisar inconsistencias).

---

## Paleta de Colores

| Rol | Color | Uso |
|---|---|---|
| Background principal | `#0D0D0D` / `#09090B` | Fondo app (dark) |
| Background secundario | `#18181B` | Cards, sidebar |
| Background terciario | `#27272A` | Inputs, hover states |
| Texto principal | `#FAFAFA` | Headings, body |
| Texto secundario | `#A1A1AA` | Labels, metadata |
| Borde | `#3F3F46` | Dividers, outlines |
| Primario (acción) | `#6366F1` (indigo) | Botones CTA, links activos |
| Éxito / confirmada | `#22C55E` (green-500) | Cita confirmada, enviado |
| Advertencia / pendiente | `#F59E0B` (amber-500) | Pendiente, por confirmar |
| Error / cancelada | `#EF4444` (red-500) | Cancelada, fallido |
| Escalada | `#F97316` (orange-500) | Badge inbox escalada |
| Neutro / liberada | `#71717A` (zinc-500) | Cita liberada, inactivo |

**Light mode:** Invertir a fondos blancos/grises, mismo sistema de colores semánticos.

---

## Tipografía

- **UI general:** Inter (sans-serif) — ya en Tailwind config
- **Código / IDs:** Geist Mono o JetBrains Mono
- **Tamaños:** Escala Tailwind estándar (text-sm para tablas, text-base para body, text-lg+ para headings)
- **Peso:** font-medium para labels, font-semibold para headings de sección

---

## Componentes shadcn/ui — Estilo

- **Radio de bordes:** `rounded-md` (8px) en cards/inputs, `rounded-lg` (12px) en modales, `rounded-full` en badges/avatars
- **Sombras:** Solo en modales/dropdowns (`shadow-lg`). Cards sin sombra en dark mode (usar border en su lugar).
- **Botones:**
  - CTA principal: `variant="default"` (indigo sólido)
  - Secundario: `variant="outline"`
  - Destructivo: `variant="destructive"` (rojo)
  - Ghost para acciones inline
- **Tablas:** Zebra striping sutil, hover highlight, sticky header en listas largas
- **Badges de status:** Colores semánticos del sistema de paleta de arriba

---

## Densidad de Información

- **Sidebar:** Colapsable. Con iconos siempre visible; etiquetas al expandir. Badge de notificación en /inbox.
- **Tablas:** Compactas (`py-2` no `py-4`). Paginación o scroll infinito según volumen.
- **Cards KPI (dashboard):** Número grande + label + tendencia. No más de 4 en una fila.
- **Formularios:** Máximo 2 columnas en desktop, 1 en móvil. Labels arriba del input, no placeholder-as-label.

---

## Responsive / Mobile

- **Breakpoints activos:**
  - Mobile: < 640px → layout 1 columna, nav pestañas inferiores
  - Tablet (md/lg): 640-1023px → sidebar colapsado como drawer, grids 2 col
  - Desktop (xl+): ≥ 1280px → sidebar expandido, grids 3-4 col

- **IMPORTANTE:** Usar `xl:grid-cols-*` para layouts de POS/Farmacia, NO `lg:grid-cols-*` (lg activa en tablet 1024px lo cual rompe en esas resoluciones — lección aprendida).

- **Agenda semanal:** scroll horizontal en móvil, columna única por doctor.
- **Tablas:** En móvil convertir a cards apiladas o scroll horizontal con columnas fijas.

---

## Patrones de Interacción

- **Feedback inmediato:** sonner toast en cada acción (success/error). Siempre visible sin bloquear UI.
- **Loading states:** skeleton loaders en tablas y cards (no spinners genéricos centrados).
- **Confirmaciones destructivas:** Modal con descripción de consecuencias + botón rojo. Nunca eliminar sin confirmar.
- **Formularios:** Validación en tiempo real con react-hook-form + zod. Highlight rojo + focus automático en campo con error (`useFieldErrors` hook existente — IDs deben ser `field-{nombre}`).
- **Animaciones:** framer-motion suave para aparición de modales/drawers (300ms, ease-out). No animaciones en hover de items de lista (demasiado noise).

---

## Apps de Referencia

- **Linear** — densidad de info, dark mode, sidebar colapsable
- **Vercel Dashboard** — tablas limpias, estados claros
- **shadcn/ui examples** — componentes base, consistencia

---

## Accesibilidad

- Contraste mínimo 4.5:1 para texto principal
- Foco visible en todos los elementos interactivos (no quitar outline)
- Labels semánticos en formularios (no solo placeholder)
- Errores descritos en texto, no solo por color
