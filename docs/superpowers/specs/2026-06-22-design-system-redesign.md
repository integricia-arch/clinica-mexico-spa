# Design System Redesign — IntegriClinica
**Date:** 2026-06-22  
**Approach:** Opción B — Premium clínico indigo + superficie slate  
**Scope:** Reskin completo (misma arquitectura, nueva piel). No cambia lógica de negocio.  
**Skills aplicadas:** frontend-design, ui-ux-pro-max, emil-design-eng, web-design-guidelines (Vercel)

---

## Decisiones de diseño

### Dirección visual
Premium clínico moderno con identidad propia. Referentes: Linear, Vercel Dashboard, Retool — aplicados al dominio médico.

**Paleta signature:** Sidebar `#0B1120` (azul-negro, no zinc negro), primary indigo `#6366F1`, superficies con blue-slate tinting (`hsl(228 20% 98%)`). El tinting diferencia el sistema de cualquier template ShadcnUI estándar.

**Riesgo audaz (único):** Icon container en StatCards con indigo gradient pill + soft glow. El resto del sistema permanece disciplinado alrededor de ese momento.

---

## Sección 1 — Design Tokens (`src/index.css`)

### Fuentes
```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;450;500;600;700&display=swap');

--font-display: 'Plus Jakarta Sans', system-ui, sans-serif;
--font-body:    'Inter', system-ui, sans-serif;  /* DM Sans → Inter */
```

### Variables CSS completas
```css
:root {
  /* Superficies — blue-slate tinting */
  --background:          228 20% 98%;
  --foreground:          228 47% 10%;
  --card:                228 25% 99.5%;
  --card-foreground:     228 47% 10%;
  --popover:             0 0% 100%;
  --popover-foreground:  228 47% 10%;

  /* Primary — Indigo #6366F1 */
  --primary:             239 84% 62%;
  --primary-foreground:  0 0% 100%;

  /* Secondary / accent */
  --secondary:           239 40% 94%;
  --secondary-foreground: 228 30% 20%;
  --accent:              239 60% 96%;
  --accent-foreground:   239 84% 40%;
  --muted:               228 18% 95%;
  --muted-foreground:    228 12% 50%;

  /* Semantic */
  --destructive:         0 72% 55%;
  --destructive-foreground: 0 0% 100%;
  --success:             152 60% 42%;
  --success-foreground:  0 0% 100%;
  --warning:             38 92% 50%;
  --warning-foreground:  38 90% 15%;
  --info:                239 84% 62%;
  --info-foreground:     0 0% 100%;

  /* Borders / inputs */
  --border: 228 20% 91%;
  --input:  228 20% 91%;
  --ring:   239 84% 62%;
  --radius: 0.5rem;

  /* Sidebar — #0B1120 blue-black */
  --sidebar-background:          222 47% 7%;
  --sidebar-foreground:          220 20% 68%;
  --sidebar-primary:             239 75% 72%;
  --sidebar-primary-foreground:  0 0% 100%;
  --sidebar-accent:              222 35% 13%;
  --sidebar-accent-foreground:   220 20% 92%;
  --sidebar-border:              222 35% 14%;
  --sidebar-ring:                239 75% 72%;

  /* Shadows — Apple multi-layer con specular highlight */
  --shadow-card:
    0 1px 2px hsl(222 47% 7% / 0.05),
    0 4px 16px hsl(222 47% 7% / 0.04),
    inset 0 0.5px 0 hsl(0 0% 100% / 0.85),
    inset 0 0 0 1px hsl(228 20% 91%);

  --shadow-elevated:
    0 8px 32px hsl(222 47% 7% / 0.12),
    0 2px 8px hsl(222 47% 7% / 0.06),
    inset 0 0.5px 0 hsl(0 0% 100% / 0.90),
    inset 0 0 0 1px hsl(228 22% 88%);

  --shadow-focus:
    0 0 0 2px hsl(228 20% 98%),
    0 0 0 4px hsl(239 84% 62% / 0.35);

  /* Easings Emil × Apple (cubic-bezier(0.16,1,0.3,1) = iOS expo-out) */
  --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);

  /* Gradients */
  --gradient-primary: linear-gradient(135deg, hsl(239 84% 62%), hsl(239 84% 48%));
  --gradient-header:  linear-gradient(135deg, hsl(222 47% 7%), hsl(222 35% 13%));
}
```

### Keyframes + utilities nuevas
```css
@keyframes card-enter {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fade-up {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* StatCard stagger */
.stat-card-1 { animation: card-enter 280ms cubic-bezier(0.16,1,0.3,1) 0ms   both; }
.stat-card-2 { animation: card-enter 280ms cubic-bezier(0.16,1,0.3,1) 60ms  both; }
.stat-card-3 { animation: card-enter 280ms cubic-bezier(0.16,1,0.3,1) 120ms both; }
.stat-card-4 { animation: card-enter 280ms cubic-bezier(0.16,1,0.3,1) 180ms both; }

/* Login form stagger */
.form-field-1 { animation: fade-up 280ms cubic-bezier(0.16,1,0.3,1) 80ms  both; }
.form-field-2 { animation: fade-up 280ms cubic-bezier(0.16,1,0.3,1) 140ms both; }
.form-field-3 { animation: fade-up 280ms cubic-bezier(0.16,1,0.3,1) 200ms both; }
.form-field-4 { animation: fade-up 280ms cubic-bezier(0.16,1,0.3,1) 260ms both; }

@media (prefers-reduced-motion: reduce) {
  .stat-card-1,.stat-card-2,.stat-card-3,.stat-card-4,
  .form-field-1,.form-field-2,.form-field-3,.form-field-4 {
    animation: none;
  }
}

/* Apple two-ring focus override */
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px hsl(228 20% 98%),
    0 0 0 4px hsl(239 84% 62% / 0.35);
}

/* Apple squircle — Chrome 139+ progressive enhancement */
@supports (corner-shape: squircle) {
  .card, button, input, textarea,
  [data-radix-popper-content-wrapper] > * {
    corner-shape: squircle;
  }
}
```

---

## Sección 2 — AppLayout (`src/components/AppLayout.tsx`)

### Sidebar

**Logo area:**
- Icon: `rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-[0_4px_16px_hsl(239_84%_62%/0.30)]`
- Nombre: `font-semibold tracking-tight text-white/90`
- Subtítulo: `text-[10px] tracking-wide text-white/40`

**Section labels** — línea + texto + línea (Linear style):
```tsx
<div className="flex items-center gap-2 px-3 pt-5 pb-1">
  <div className="h-px flex-1 bg-white/[0.06]" />
  <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/30">
    {item.section}
  </span>
  <div className="h-px flex-1 bg-white/[0.06]" />
</div>
```

**Nav items activos** — Liquid Glass micro:
```
bg-indigo-500/15 text-indigo-300
shadow-[inset_0_0.5px_0_rgba(255,255,255,0.08),inset_0_-0.5px_0_rgba(0,0,0,0.10)]
backdrop-filter: blur(8px)
```
Indicador izquierda: `absolute left-0 h-4 w-[3px] rounded-r-full bg-indigo-400`

**Nav items inactivos:**
```
text-white/50 hover:bg-white/[0.05] hover:text-white/80
transition: background 150ms, color 150ms — cubic-bezier(0.16,1,0.3,1)
```
**Regla Emil:** NO translate/transform en nav items (uso frecuente → sin animación de posición).

**Sidebar transition** (collapse/open):
```
transition-[width]: 250ms cubic-bezier(0.16,1,0.3,1)
Mobile slide: transition-transform 300ms cubic-bezier(0.32,0.72,0,1)
```

**User footer:**
- Avatar: `bg-indigo-500/20 text-indigo-300 ring-1 ring-inset ring-indigo-500/30`
- Email: `text-white/70 font-medium`
- Rol: `text-white/35`
- LogOut: `text-white/25 hover:text-red-400/70`

### Header
```
bg-[hsl(228_25%_99.5%/0.82)]
backdrop-filter: blur(16px) saturate(1.6)
border-b border-[hsl(228_20%_91%)]
shadow-[0_1px_0_hsl(228_20%_91%)]
```

**Bell badge:** `h-1.5 w-1.5 bg-red-400 ring-2 ring-white animate-pulse`

**Avatar dropdown trigger:** `bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-200`

---

## Sección 3 — StatCard + Dashboard

### StatCard (`src/components/StatCard.tsx`)

**Shell:**
```
rounded-xl bg-card p-5
shadow: 0 1px 2px hsl(222 47% 7%/0.05), 0 4px 16px hsl(222 47% 7%/0.04),
        inset 0 0.5px 0 hsl(0 0%  100%/0.85), inset 0 0 0 1px hsl(228 20% 91%)
hover: -translate-y-[2px] + shadow-elevated
hover transition: 200ms cubic-bezier(0.16,1,0.3,1)
active: scale(0.99) translate-y-0
```

**Icon container** (firma visual):
```
h-9 w-9 rounded-lg
bg-gradient-to-br from-indigo-500/14 to-indigo-500/7
border border-indigo-500/14
text-indigo-500
shadow-[0_2px_8px_hsl(239_84%_62%/0.10)]
group-hover:shadow-[0_4px_12px_hsl(239_84%_62%/0.18)]
```

**Value:** `font-variant-numeric: tabular-nums; tracking-tight`

**Change:** dot indicator (`h-1.5 w-1.5 rounded-full`) + texto

**Stagger:** prop `index: 0-3` → clase `stat-card-{index+1}`

### Dashboard (`src/pages/Dashboard.tsx`)

**Header** (jerarquía invertida, Linear/Notion style):
```tsx
<p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-muted-foreground/60">
  {fechaCapital}
</p>
<h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
  Panel principal
</h1>
```

**Tabla agenda:**
- Row hover: `bg-indigo-50/40`
- Hora: `text-xs font-semibold text-indigo-500/60 font-variant-numeric:tabular-nums`
- Status badges: `rounded-md` + `ring-1 ring-inset` (no `rounded-full` + `border`)

**Estado colors** (ring-inset pattern):
```
Confirmada:  bg-emerald-50 text-emerald-700 ring-emerald-600/20
Pendiente:   bg-amber-50   text-amber-700   ring-amber-600/20
Recordatorio: bg-indigo-50 text-indigo-700  ring-indigo-600/20
Solicitada:  bg-zinc-100   text-zinc-600    ring-zinc-500/20
Cancelada:   bg-red-50     text-red-700     ring-red-600/20
```

**Warning banner:** `ring-1 ring-inset ring-amber-400/25 bg-amber-50/60`

---

## Sección 4 — Login (`src/pages/Login.tsx`)

**Background** (firma: página iluminada desde logo):
```css
background: radial-gradient(ellipse 70% 45% at 50% -5%,
  hsl(239 84% 62% / 0.07) 0%, transparent 70%),
  hsl(228, 20%, 98%);
```

**Logo halo** (riesgo audaz del Login):
```
rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700
shadow-[0_8px_32px_hsl(239_84%_62%/0.35),0_2px_8px_hsl(239_84%_62%/0.20)]
```

**Card:**
```
rounded-xl bg-card p-6
shadow: 0 4px 24px hsl(222 47%  7%/0.09), 0 1px 4px hsl(222 47% 7%/0.05),
        inset 0 0.5px 0 hsl(0 0% 100%/0.90), inset 0 0 0 1px hsl(228 20% 90%)
```

**Google button:**
```
bg-white border-[hsl(228_20%_89%)]
shadow-[0_1px_2px_hsl(222_47%_7%/0.06),inset_0_0.5px_0_rgba(255,255,255,0.90)]
hover: bg-[hsl(228_20%_97%)] -translate-y-px + shadow lift
active: scale(0.98)
transition: 150ms cubic-bezier(0.16,1,0.3,1)
```

**Submit button:**
```
bg-gradient-to-b from-indigo-500 to-indigo-600
shadow-[0_2px_8px_hsl(239_84%_62%/0.32),inset_0_0.5px_0_rgba(255,255,255,0.18)]
hover: to-indigo-700 + shadow-elevated indigo
active: scale(0.97)
transition: 100ms cubic-bezier(0.16,1,0.3,1)
```

**Inputs:** `focus-visible:ring-0 focus-visible:ring-offset-0` (two-ring viene de index.css global)

**Form stagger:** clases `form-field-1` a `form-field-4` (80–260ms delays)

---

## Archivos a modificar

| Archivo | Cambios |
|---|---|
| `src/index.css` | Variables CSS completas, keyframes, focus override, squircle |
| `src/components/AppLayout.tsx` | Sidebar shell, nav items, header glass, user footer |
| `src/components/StatCard.tsx` | Card shell, icon gradient, value tabular, change dot, index prop |
| `src/pages/Dashboard.tsx` | Header jerarquía, estadoColor ring-inset, warning banner, stagger |
| `src/pages/Login.tsx` | Background glow, logo halo, card shadow, buttons, inputs, stagger |

**NO se modifican:** hooks, servicios, rutas, lógica de negocio, Supabase, tipos.

---

## Principios aplicados

| Principio | Origen | Aplicación |
|---|---|---|
| Gasta la audacia en un lugar | frontend-design | Icon gradient pill en StatCard, logo halo en Login |
| Unseen details compound | Emil Kowalski | Specular `inset 0 0.5px 0 white/85%` en cada card |
| Animaciones por frecuencia | Emil framework | Nav: solo fade. Modals/Login: spring+stagger |
| `cubic-bezier(0.16,1,0.3,1)` | iOS expo-out (UI/UX Pro Max + Emil) | Todas las transiciones UI |
| `scale(0.97)` en press | Emil | Todos los botones interactivos |
| Apple two-ring focus | Apple HIG | Inputs globales via CSS |
| Hairline via shadow inset | Apple Glass | Cards sin `border` prop |
| `font-variant-numeric: tabular-nums` | Emil/UX Pro Max | Todos los valores numéricos |
| `corner-shape: squircle` progressive | Chrome 139+ | Cards, buttons, inputs |
| `prefers-reduced-motion` | WCAG + Apple | Todos los keyframes |

---

## Restricciones

- Sin cambios a componentes `ui/` (ShadcnUI base) excepto override de focus en `index.css`
- Sin nuevas dependencias npm
- Sin cambios a lógica, hooks, ni servicios
- Tailwind classes arbitrarias (`[]`) usadas donde CSS variables no alcanzan
