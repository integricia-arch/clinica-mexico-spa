# Design System Reskin — Premium Clínico Indigo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the teal/zinc design system with a premium indigo + blue-slate skin across 5 files, with Apple-style shadows, Emil Kowalski animations, and zero changes to business logic.

**Architecture:** Pure visual reskin — CSS variables in `index.css` propagate token changes through the ShadcnUI `hsl(var(--token))` system automatically. Component files only change class names and inline styles; no hooks, services, or types are touched.

**Tech Stack:** React + TypeScript + Vite + Tailwind CSS v3 (JIT) + ShadcnUI

## Global Constraints

- No changes to hooks, services, Supabase queries, routing, or type definitions
- No new npm dependencies
- No changes to `src/components/ui/` files (ShadcnUI base) — only global CSS overrides in `index.css`
- Tailwind JIT active — arbitrary values like `bg-indigo-500/14` and `shadow-[...]` compile correctly
- `font-display` Tailwind class already works — `tailwind.config.ts` maps it to `Plus Jakarta Sans`
- All keyframe animation classes must respect `prefers-reduced-motion`
- `--border` CSS variable change (teal→indigo-slate) propagates to `* { @apply border-border }` — affects ALL borders in the app; this is intentional

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/index.css` | Modify | CSS variables (entire :root), font import, new keyframes, focus override, squircle |
| `tailwind.config.ts` | Modify | `fontFamily.body`: DM Sans → Inter |
| `src/components/StatCard.tsx` | Modify | Card shell (Apple shadow), icon container (indigo gradient pill), value (tabular-nums), change dot indicator, `index` prop for stagger |
| `src/pages/Dashboard.tsx` | Modify | Header hierarchy, `estadoColor` ring-inset pattern, card shells, table row styles, warning banner, StatCard `index` props |
| `src/components/AppLayout.tsx` | Modify | Sidebar logo, section labels (Linear hairline), nav active (liquid glass + indicator), nav inactive (new transition), user footer, header glass |
| `src/pages/Login.tsx` | Modify | Background glow, logo halo, card shell, Google button (lifted), submit button (gradient+press), input focus override, form stagger |

---

## Task 1: Design Tokens — `src/index.css` + `tailwind.config.ts`

Foundation for all subsequent tasks. All component class changes depend on these variables existing first.

**Files:**
- Modify: `src/index.css`
- Modify: `tailwind.config.ts`

**Interfaces:**
- Produces: `--background`, `--foreground`, `--primary`, `--card`, `--sidebar-*`, `--shadow-card`, `--shadow-elevated`, `--ease-out`, `--font-body`, `--font-display`, keyframe classes `.stat-card-1..4`, `.form-field-1..4`

---

- [ ] **Step 1: Verify current state — TypeScript check passes before changes**

```bash
cd C:\Users\pablo\clinica-mexico-spa
npx tsc --noEmit
```

Expected: 0 errors (or same pre-existing errors — record the count).

---

- [ ] **Step 2: Replace `src/index.css` completely**

Write the following as the full content of `src/index.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Surfaces — blue-slate tinting (not neutral zinc) */
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

    /* Sidebar — #0B1120 blue-black (NOT zinc dark) */
    --sidebar-background:          222 47% 7%;
    --sidebar-foreground:          220 20% 68%;
    --sidebar-primary:             239 75% 72%;
    --sidebar-primary-foreground:  0 0% 100%;
    --sidebar-accent:              222 35% 13%;
    --sidebar-accent-foreground:   220 20% 92%;
    --sidebar-border:              222 35% 14%;
    --sidebar-ring:                239 75% 72%;

    /* Shadows — Apple multi-layer with specular highlight */
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

    /* Easings — Emil Kowalski × Apple iOS expo-out */
    --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
    --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);

    /* Gradients */
    --gradient-primary: linear-gradient(135deg, hsl(239 84% 62%), hsl(239 84% 48%));
    --gradient-header:  linear-gradient(135deg, hsl(222 47% 7%), hsl(222 35% 13%));

    --font-display: 'Plus Jakarta Sans', system-ui, sans-serif;
    --font-body:    'Inter', system-ui, sans-serif;
  }

  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-family: var(--font-body);
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-display);
  }

  /* Apple two-ring focus — overrides ShadcnUI default teal ring */
  input:focus-visible,
  textarea:focus-visible,
  select:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 2px hsl(228 20% 98%),
      0 0 0 4px hsl(239 84% 62% / 0.35);
  }
}

@layer utilities {
  .text-display {
    font-family: var(--font-display);
  }
  .shadow-card {
    box-shadow: var(--shadow-card);
  }
  .shadow-elevated {
    box-shadow: var(--shadow-elevated);
  }
  .gradient-primary {
    background: var(--gradient-primary);
  }
}

/* ── Keyframes ───────────────────────────────────────────────────────────── */

@keyframes card-enter {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fade-up {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* StatCard mount stagger — 60ms between cards (Emil: 30-50ms) */
.stat-card-1 { animation: card-enter 280ms cubic-bezier(0.16,1,0.3,1) 0ms   both; }
.stat-card-2 { animation: card-enter 280ms cubic-bezier(0.16,1,0.3,1) 60ms  both; }
.stat-card-3 { animation: card-enter 280ms cubic-bezier(0.16,1,0.3,1) 120ms both; }
.stat-card-4 { animation: card-enter 280ms cubic-bezier(0.16,1,0.3,1) 180ms both; }

/* Login form field stagger */
.form-field-1 { animation: fade-up 280ms cubic-bezier(0.16,1,0.3,1) 80ms  both; }
.form-field-2 { animation: fade-up 280ms cubic-bezier(0.16,1,0.3,1) 140ms both; }
.form-field-3 { animation: fade-up 280ms cubic-bezier(0.16,1,0.3,1) 200ms both; }
.form-field-4 { animation: fade-up 280ms cubic-bezier(0.16,1,0.3,1) 260ms both; }

@media (prefers-reduced-motion: reduce) {
  .stat-card-1, .stat-card-2, .stat-card-3, .stat-card-4,
  .form-field-1, .form-field-2, .form-field-3, .form-field-4 {
    animation: none;
  }
}

/* Apple squircle corners — Chrome 139+ only, progressive enhancement */
@supports (corner-shape: squircle) {
  .card, button, input, textarea,
  [data-radix-popper-content-wrapper] > * {
    corner-shape: squircle;
  }
}
```

---

- [ ] **Step 3: Update `tailwind.config.ts` — change body font from DM Sans to Inter**

In `tailwind.config.ts`, find and replace line 16:

```ts
// Before:
body: ["'DM Sans'", "system-ui", "sans-serif"],

// After:
body: ["'Inter'", "system-ui", "sans-serif"],
```

---

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: same error count as Step 1 (CSS changes don't affect TypeScript).

---

- [ ] **Step 5: Start dev server and verify visually**

```bash
npm run dev
```

Open `http://localhost:5173`. Check:
- Background is blue-slate tinted (not pure white, not gray)
- Sidebar is deep blue-black (`#0B1120` tone, not zinc)
- Primary buttons are indigo `#6366F1` (not teal)
- Input focus shows two-ring indigo glow

---

- [ ] **Step 6: Commit**

```bash
git add src/index.css tailwind.config.ts
git commit -m "feat: replace design tokens with indigo+slate system (Apple shadows, Inter font)"
```

---

## Task 2: StatCard Reskin

Adds Apple card shell with specular highlight, indigo gradient icon pill (the signature visual element of the system), tabular-nums value, dot change indicator, and stagger animation support via `index` prop.

**Files:**
- Modify: `src/components/StatCard.tsx`

**Interfaces:**
- Consumes: CSS classes `.stat-card-1` through `.stat-card-4` from Task 1
- Produces: `StatCard` component with new optional prop `index?: number` (default `0`)

---

- [ ] **Step 1: Replace `src/components/StatCard.tsx` completely**

```tsx
import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  variant?: "default" | "warning" | "destructive" | "success";
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  index?: number;
}

export default function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  index = 0,
}: StatCardProps) {
  const changeColor =
    changeType === "positive"
      ? "text-success"
      : changeType === "negative"
      ? "text-destructive"
      : "text-muted-foreground";

  const dotColor =
    changeType === "positive"
      ? "bg-emerald-500"
      : changeType === "negative"
      ? "bg-red-400"
      : "";

  const staggerClass = `stat-card-${Math.min(index + 1, 4)}`;

  return (
    <div
      className={[
        "group relative rounded-xl bg-card p-5 cursor-default",
        staggerClass,
        "shadow-[0_1px_2px_hsl(222_47%_7%/0.05),0_4px_16px_hsl(222_47%_7%/0.04),inset_0_0.5px_0_hsl(0_0%_100%/0.85),inset_0_0_0_1px_hsl(228_20%_91%)]",
        "transition-[transform,box-shadow] duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
        "hover:-translate-y-[2px]",
        "hover:shadow-[0_4px_24px_hsl(222_47%_7%/0.10),0_8px_40px_hsl(222_47%_7%/0.06),inset_0_0.5px_0_hsl(0_0%_100%/0.90),inset_0_0_0_1px_hsl(228_20%_88%)]",
        "active:scale-[0.99] active:translate-y-0",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            "bg-gradient-to-br from-indigo-500/14 to-indigo-500/7",
            "border border-indigo-500/[0.14]",
            "text-indigo-500",
            "shadow-[0_2px_8px_hsl(239_84%_62%/0.10)]",
            "transition-shadow duration-200",
            "group-hover:shadow-[0_4px_12px_hsl(239_84%_62%/0.18)]",
          ].join(" ")}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-foreground [font-variant-numeric:tabular-nums] tracking-tight">
        {value}
      </p>
      {change && (
        <p className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium ${changeColor}`}>
          {changeType !== "neutral" && dotColor && (
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
          )}
          {change}
        </p>
      )}
    </div>
  );
}
```

---

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 new errors. The `index` prop is optional with a default — no callers need updating yet.

---

- [ ] **Step 3: Visual verify**

With dev server running at `http://localhost:5173`, navigate to the Dashboard. Check:
- Each StatCard has a subtle Apple shadow (no `border` line, shadow hairline instead)
- Icon container is an indigo gradient pill (not flat `bg-primary/10`)
- Hovering a card lifts it `-2px` smoothly
- Pressing a card scales to `0.99`
- Cards stagger-enter on page load (all 4 animate from bottom, spaced 60ms apart)

---

- [ ] **Step 4: Commit**

```bash
git add src/components/StatCard.tsx
git commit -m "feat: reskin StatCard — Apple shadow, indigo icon pill, tabular-nums, stagger prop"
```

---

## Task 3: Dashboard Reskin

Updates the page header hierarchy, `estadoColor` to ring-inset badges, card shells for Agenda and Actividad panels, appointment row styles, and warning banner. Also wires `index` props on StatCard calls.

**Files:**
- Modify: `src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `StatCard` with `index?: number` prop from Task 2; CSS variables from Task 1

---

- [ ] **Step 1: Update `estadoColor` map — replace the top section of Dashboard.tsx**

Replace lines 10–20 (the entire `estadoColor` object):

```tsx
const estadoColor: Record<string, string> = {
  "Confirmada":              "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  "Confirmada por paciente": "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  "Confirmada por médico":   "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  "Pendiente de formulario": "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  "Recordatorio enviado":    "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20",
  "Solicitada":              "bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-500/20",
  "Cancelada":               "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  "Tentativa":               "bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-500/20",
  "Liberada":                "bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-500/20",
};
```

---

- [ ] **Step 2: Update the Dashboard header — inverted hierarchy**

Replace the `{/* Header */}` block (lines 82–88 in the original):

```tsx
{/* Header */}
<div>
  <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-muted-foreground/60">
    {fechaCapital}
  </p>
  <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
    Panel principal
  </h1>
</div>
```

---

- [ ] **Step 3: Add `index` props to the 4 StatCard calls**

Replace the `{/* Stats */}` grid block (lines 91–120 in the original):

```tsx
{/* Stats */}
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard
    index={0}
    icon={CalendarDays}
    title="Citas hoy"
    value={String(data.totalCitasHoy)}
    change={data.totalCitasHoy === 0 ? "Sin citas programadas" : `${data.citasSinConfirmar} sin confirmar`}
    changeType={data.citasSinConfirmar > 0 ? "negative" : "positive"}
  />
  <StatCard
    index={1}
    icon={Users}
    title="Pacientes activos"
    value={data.totalPacientes.toLocaleString("es-MX")}
    change="Total registrados activos"
    changeType="neutral"
  />
  <StatCard
    index={2}
    icon={Receipt}
    title="Ingresos del día"
    value={formatIngresosHoy(data.ingresosHoy)}
    change="Ventas farmacia completadas hoy"
    changeType={data.ingresosHoy > 0 ? "positive" : "neutral"}
  />
  <StatCard
    index={3}
    icon={AlertCircle}
    title="Alertas de stock"
    value={String(data.alertasPendientes)}
    change={data.alertasPendientes === 0 ? "Sin alertas pendientes" : "Requieren atención"}
    changeType={data.alertasPendientes > 0 ? "negative" : "positive"}
  />
</div>
```

---

- [ ] **Step 4: Update the two card shells and appointment row styles**

Replace the entire `<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">` section (lines 122–186 in the original) with:

```tsx
<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
  {/* Agenda del día */}
  <div className="lg:col-span-2 rounded-xl bg-card shadow-[0_1px_2px_hsl(222_47%_7%/0.05),0_4px_16px_hsl(222_47%_7%/0.04),inset_0_0.5px_0_hsl(0_0%_100%/0.85),inset_0_0_0_1px_hsl(228_20%_91%)]">
    <div className="flex items-center justify-between border-b border-border px-5 py-4">
      <h2 className="font-display font-semibold text-card-foreground">Agenda de hoy</h2>
      <span className="text-xs font-medium text-muted-foreground">
        {data.totalCitasHoy} {data.totalCitasHoy === 1 ? "cita programada" : "citas programadas"}
      </span>
    </div>
    {data.citasHoy.length === 0 ? (
      <div className="px-5 py-8 text-center text-sm text-muted-foreground">
        Sin citas programadas para hoy
      </div>
    ) : (
      <div className="divide-y divide-border">
        {data.citasHoy.map((cita) => (
          <div
            key={cita.id}
            className="flex items-center gap-4 px-5 py-3.5 hover:bg-indigo-50/40 transition-colors duration-100"
          >
            <span className="w-12 shrink-0 text-xs font-semibold text-indigo-500/60 [font-variant-numeric:tabular-nums]">
              {cita.hora}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-card-foreground">
                {cita.paciente}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {cita.medico} · {cita.tipo}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium [font-variant-numeric:tabular-nums] ${
                estadoColor[cita.estado] ?? "bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-500/20"
              }`}
            >
              {cita.estado}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>

  {/* Actividad reciente */}
  <div className="rounded-xl bg-card shadow-[0_1px_2px_hsl(222_47%_7%/0.05),0_4px_16px_hsl(222_47%_7%/0.04),inset_0_0.5px_0_hsl(0_0%_100%/0.85),inset_0_0_0_1px_hsl(228_20%_91%)]">
    <div className="border-b border-border px-5 py-4">
      <h2 className="font-display font-semibold text-card-foreground">Actividad reciente</h2>
    </div>
    {data.actividadReciente.length === 0 ? (
      <div className="px-5 py-8 text-center text-sm text-muted-foreground">
        Sin actividad registrada hoy
      </div>
    ) : (
      <div className="divide-y divide-border">
        {data.actividadReciente.map((item) => (
          <div key={item.id} className="px-5 py-3.5">
            <p className="text-sm text-card-foreground leading-snug">{item.texto}</p>
            <p className="mt-1 text-xs text-muted-foreground [font-variant-numeric:tabular-nums]">{item.tiempo}</p>
          </div>
        ))}
      </div>
    )}
  </div>
</div>
```

---

- [ ] **Step 5: Update the warning banner**

Replace the `{/* Banner alertas pendientes */}` block (lines 189–202 in the original):

```tsx
{/* Banner alertas pendientes */}
{data.citasSinConfirmar > 0 && (
  <div className="rounded-xl ring-1 ring-inset ring-amber-400/25 bg-amber-50/60 p-4 flex items-start gap-3">
    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
    <div>
      <p className="text-sm font-medium text-foreground">Recordatorios pendientes</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {data.citasSinConfirmar}{" "}
        {data.citasSinConfirmar === 1 ? "cita no ha" : "citas no han"} sido{" "}
        {data.citasSinConfirmar === 1 ? "confirmada" : "confirmadas"} para hoy.
        Se recomienda contactar a {data.citasSinConfirmar === 1 ? "al paciente" : "los pacientes"} por teléfono.
      </p>
    </div>
  </div>
)}
```

---

- [ ] **Step 6: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 new errors.

---

- [ ] **Step 7: Visual verify**

Navigate to Dashboard. Check:
- Page header: small date label above, large title below (not the reverse)
- StatCards stagger in on load (card 1 first, card 4 last, 60ms between)
- Status badges: `rounded-md` with ring-inset (no `rounded-full` with flat background)
  - Confirmed = emerald; Pending = amber; Reminder = indigo; Cancelled = red
- Hora column: smaller text, indigo-tinted, tabular
- Row hover: indigo wash (not gray muted)
- Warning banner: amber ring-inset (not border)
- Both panel cards: Apple shadow hairline (no border line)

---

- [ ] **Step 8: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: reskin Dashboard — inverted header, ring-inset badges, Apple card shadows, indigo table rows"
```

---

## Task 4: AppLayout Reskin

Updates sidebar logo (indigo gradient halo), section labels (Linear hairline style), nav active state (liquid glass + left indicator bar), nav inactive transitions, user footer, and header glass effect.

**Files:**
- Modify: `src/components/AppLayout.tsx`

**Interfaces:**
- Consumes: CSS variables from Task 1 (`--sidebar-*` tokens, `--ease-drawer`)
- Produces: No new exports — same `AppLayout` default export, same props

---

- [ ] **Step 1: Update sidebar logo area (lines 177–194 in original)**

Replace the logo `<div>` block inside the `<aside>` (the `{/* Logo */}` section):

```tsx
{/* Logo */}
<div className={`flex h-16 items-center border-b border-sidebar-border shrink-0 ${isCollapsed ? "justify-center px-3" : "gap-2.5 px-5"}`}>
  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-[0_4px_16px_hsl(239_84%_62%/0.30)]">
    <Heart className="h-5 w-5 text-white" />
  </div>
  {!isCollapsed && (
    <div className="min-w-0">
      <span className="font-display font-semibold text-sm tracking-tight text-white/90">ClínicaMX</span>
      <span className="block text-[10px] tracking-wide text-white/40">Operaciones Clínicas</span>
    </div>
  )}
  {/* Mobile close button */}
  <button
    onClick={closeSidebar}
    className={`ml-auto text-sidebar-foreground hover:text-sidebar-accent-foreground xl:hidden ${isCollapsed ? "hidden" : ""}`}
  >
    <X className="h-5 w-5" />
  </button>
</div>
```

---

- [ ] **Step 2: Update section labels — Linear hairline style (lines 212–219 in original)**

Replace the two `showSection` conditionals inside the nav map:

```tsx
{showSection && !isCollapsed && (
  <div className="flex items-center gap-2 px-3 pt-5 pb-1">
    <div className="h-px flex-1 bg-white/[0.06]" />
    <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/30">
      {item.section}
    </span>
    <div className="h-px flex-1 bg-white/[0.06]" />
  </div>
)}
{showSection && isCollapsed && (
  <div className="mx-2 my-3 border-t border-sidebar-border/40" />
)}
```

---

- [ ] **Step 3: Update nav item active/inactive classes + add left indicator (lines 220–249 in original)**

Replace the entire `<NavLink>` element (keep all logic, only change class names and add indicator child):

```tsx
<NavLink
  to={item.to}
  onClick={closeSidebar}
  title={isCollapsed ? item.label : undefined}
  className={`
    relative flex items-center gap-3 rounded-lg text-sm font-medium overflow-hidden
    ${isCollapsed ? "justify-center px-0 py-2.5 mx-1" : "px-3 py-2.5"}
    ${isActive
      ? "bg-indigo-500/15 text-indigo-300 shadow-[inset_0_0.5px_0_rgba(255,255,255,0.08),inset_0_-0.5px_0_rgba(0,0,0,0.10)] backdrop-blur-[8px]"
      : "text-white/50 hover:bg-white/[0.05] hover:text-white/80 transition-[background-color,color] duration-150 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
    }
  `}
>
  {isActive && !isCollapsed && (
    <span className="absolute left-0 h-4 w-[3px] rounded-r-full bg-indigo-400" />
  )}
  <item.icon className="h-[18px] w-[18px] shrink-0" />
  {!isCollapsed && (
    <>
      <span className="flex-1 truncate">{item.label}</span>
      {showBadge && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 text-[10px] font-bold rounded-full bg-red-500 text-white px-1.5">
          {badgeCount}
        </span>
      )}
    </>
  )}
  {isCollapsed && showBadge && (
    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
  )}
</NavLink>
```

---

- [ ] **Step 4: Update sidebar `<aside>` transition (line 168–175 in original)**

Replace the `<aside>` opening tag's className:

```tsx
<aside
  className={`
    fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar
    transition-all duration-[280ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]
    ${sidebarWidth}
    xl:translate-x-0
    ${sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}
  `}
>
```

---

- [ ] **Step 5: Update user footer — avatar, email, role, logout (lines 268–289 in original)**

Replace the `{/* User info */}` div:

```tsx
{/* User info */}
<div className={`p-3 ${isCollapsed ? "flex justify-center" : "flex items-center gap-3"}`}>
  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300 ring-1 ring-inset ring-indigo-500/30 text-sm font-semibold">
    {initials}
  </div>
  {!isCollapsed && (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white/70">
          {user?.email?.split("@")[0] || "Usuario"}
        </p>
        <p className="truncate text-xs text-white/35">{roleLabel}</p>
      </div>
      <button
        onClick={handleSignOut}
        className="text-white/25 hover:text-red-400/70 transition-colors duration-150"
        title="Cerrar sesión"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </>
  )}
</div>
```

---

- [ ] **Step 6: Update header — glass effect, bell badge, avatar trigger (lines 296–368 in original)**

Replace the `<header>` opening tag and its two inner sections:

```tsx
<header className="flex h-14 items-center justify-between border-b border-[hsl(228_20%_91%)] bg-[hsl(228_25%_99.5%/0.82)] backdrop-blur-[16px] backdrop-saturate-[1.6] shadow-[0_1px_0_hsl(228_20%_91%)] px-4 shrink-0">
  <div className="flex items-center gap-2">
    {/* Mobile/tablet hamburger */}
    {!isFocusRoute && (
      <button
        onClick={openDrawer}
        className="flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors xl:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
    )}
    {/* Focus route: always show hamburger */}
    {isFocusRoute && (
      <button
        onClick={openDrawer}
        className="flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>
    )}
  </div>

  <div className="flex items-center gap-2">
    <ManualButton />
    <button className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
      <Bell className="h-[18px] w-[18px]" />
      <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-400 ring-2 ring-white animate-pulse" />
    </button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors cursor-pointer outline-none">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-200 text-xs font-semibold">
            {initials}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium leading-tight">{user?.email?.split("@")[0]}</p>
            <p className="text-xs text-muted-foreground leading-tight">{roleLabel}</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-foreground truncate">{user?.email}</p>
          <p className="text-xs text-muted-foreground">{roleLabel}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLock} className="gap-2 cursor-pointer">
          <Lock className="h-4 w-4" />
          Bloquear pantalla
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSwitchUser} className="gap-2 cursor-pointer">
          <UserRound className="h-4 w-4" />
          Cambiar de usuario
        </DropdownMenuItem>
        {roles.includes("nurse") && (
          <DropdownMenuItem onClick={() => navigate("/perfil/vincular-telegram")} className="gap-2 cursor-pointer">
            <Send className="h-4 w-4" />
            Vincular Telegram
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</header>
```

---

- [ ] **Step 7: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 new errors.

---

- [ ] **Step 8: Visual verify**

Navigate through the app. Check:
- Sidebar logo: indigo gradient pill icon with indigo glow (not teal gradient)
- Section labels: hairline + small text + hairline (not plain uppercase label)
- Active nav item: indigo-tinted background + left `3px` vertical indicator bar
- Inactive nav items: `text-white/50` (not `text-sidebar-foreground`)
- Hovering inactive item: background appears, text brightens — smooth 150ms
- User footer avatar: indigo ring instead of `bg-sidebar-accent`
- Email: `text-white/70` (slightly dimmer than before)
- Logout icon: very dim, turns red-ish on hover
- Header: glass blur effect visible (page content should be slightly visible through header when scrolled)
- Bell dot: smaller (`h-1.5 w-1.5`), red-400, pulsing
- Avatar chip in header: indigo-50 bg with indigo text

---

- [ ] **Step 9: Commit**

```bash
git add src/components/AppLayout.tsx
git commit -m "feat: reskin AppLayout — indigo sidebar, Linear section labels, liquid glass nav active, glass header"
```

---

## Task 5: Login Reskin

Updates the login page background (radial glow), logo (indigo halo), card shell (Apple shadow), Google button (lifted card), submit button (gradient + press), input focus, and adds form field stagger animations.

**Files:**
- Modify: `src/pages/Login.tsx`

**Interfaces:**
- Consumes: `.form-field-1` through `.form-field-4` CSS classes from Task 1
- Produces: No new exports — same `Login` default export, same props

---

- [ ] **Step 1: Update outer wrapper — background radial glow**

Replace line 142:
```tsx
// Before:
<div className="flex min-h-screen items-center justify-center bg-background p-4">

// After:
<div
  className="flex min-h-screen items-center justify-center p-4"
  style={{
    background: "radial-gradient(ellipse 70% 45% at 50% -5%, hsl(239 84% 62% / 0.07) 0%, transparent 70%), hsl(228, 20%, 98%)",
  }}
>
```

---

- [ ] **Step 2: Update logo — indigo gradient halo**

Replace lines 146–147:
```tsx
// Before:
<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-elevated">
  <Heart className="h-7 w-7 text-primary-foreground" />
</div>

// After:
<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-[0_8px_32px_hsl(239_84%_62%/0.35),0_2px_8px_hsl(239_84%_62%/0.20)]">
  <Heart className="h-7 w-7 text-white" />
</div>
```

---

- [ ] **Step 3: Update card shell — Apple shadow, no border**

Replace line 153:
```tsx
// Before:
<div className="rounded-xl border border-border bg-card p-6 shadow-card">

// After:
<div className="rounded-xl bg-card p-6 shadow-[0_4px_24px_hsl(222_47%_7%/0.09),0_1px_4px_hsl(222_47%_7%/0.05),inset_0_0.5px_0_hsl(0_0%_100%/0.90),inset_0_0_0_1px_hsl(228_20%_90%)]">
```

---

- [ ] **Step 4: Add form field stagger wrappers + update Google button + update inputs**

Replace the entire `{view !== "forgot" && (...)}` block (lines 185–278):

```tsx
{/* LOGIN / SIGNUP */}
{view !== "forgot" && (
  <>
    <div className="form-field-1">
      <h2 className="font-display text-lg font-semibold text-card-foreground mb-6">
        {view === "signup" ? "Crear cuenta" : "Iniciar sesión"}
      </h2>

      <Button
        type="button"
        variant="outline"
        className="w-full mb-4 h-10 gap-2.5 font-medium text-sm text-foreground bg-white border-[hsl(228_20%_89%)] shadow-[0_1px_2px_hsl(222_47%_7%/0.06),inset_0_0.5px_0_rgba(255,255,255,0.90)] hover:bg-[hsl(228_20%_97%)] hover:-translate-y-px hover:shadow-[0_4px_12px_hsl(222_47%_7%/0.08),0_1px_3px_hsl(222_47%_7%/0.05),inset_0_0.5px_0_rgba(255,255,255,0.90)] active:scale-[0.98] active:translate-y-0 transition-[transform,box-shadow,background-color] duration-150 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
        onClick={handleGoogle}
        disabled={loading}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
        </svg>
        Continuar con Google
      </Button>
    </div>

    <div className="form-field-2 relative mb-4">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-card px-2 text-muted-foreground">o con correo</span>
      </div>
    </div>

    <form onSubmit={handleLoginSignup}>
      <div className="form-field-3 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            type="email"
            placeholder="doctor@clinica.mx"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            {view === "login" && (
              <button
                type="button"
                onClick={() => setView("forgot")}
                className="text-xs text-primary hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {view === "signup" && <PasswordStrengthMeter password={password} />}
        </div>
        {TURNSTILE_SITE_KEY && (
          <Turnstile
            ref={turnstileRef}
            siteKey={TURNSTILE_SITE_KEY}
            onSuccess={setCaptchaToken}
            onExpire={() => setCaptchaToken(null)}
            onError={() => setCaptchaToken(null)}
            options={{ size: "flexible" }}
          />
        )}
      </div>

      <div className="form-field-4 mt-4">
        <Button
          type="submit"
          className="w-full h-10 font-semibold text-sm bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-700 border-0 shadow-[0_2px_8px_hsl(239_84%_62%/0.32),0_1px_3px_hsl(239_84%_62%/0.20),inset_0_0.5px_0_rgba(255,255,255,0.18)] hover:shadow-[0_4px_16px_hsl(239_84%_62%/0.40),0_2px_6px_hsl(239_84%_62%/0.25),inset_0_0.5px_0_rgba(255,255,255,0.18)] active:scale-[0.97] transition-[transform,box-shadow,background] duration-100 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
          disabled={loading || (!!TURNSTILE_SITE_KEY && !captchaToken)}
        >
          <LogIn className="mr-2 h-4 w-4" />
          {loading ? "Procesando..." : view === "signup" ? "Registrarse" : "Entrar"}
        </Button>
      </div>
    </form>

    <div className="mt-4 text-center">
      <button
        type="button"
        onClick={() => setView(view === "signup" ? "login" : "signup")}
        className="text-sm text-primary hover:underline"
      >
        {view === "signup" ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate"}
      </button>
    </div>
  </>
)}
```

---

- [ ] **Step 5: Update the forgot password form inputs**

In the `{view === "forgot" && (...)}` block, add `className="focus-visible:ring-0 focus-visible:ring-offset-0"` to the email Input:

```tsx
<Input
  id="email-forgot"
  type="email"
  placeholder="doctor@clinica.mx"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  required
  className="focus-visible:ring-0 focus-visible:ring-offset-0"
/>
```

---

- [ ] **Step 6: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 new errors.

---

- [ ] **Step 7: Visual verify**

Navigate to `http://localhost:5173/login`. Check:
- Background: very subtle indigo glow at top-center — barely visible, not obvious
- Logo: indigo gradient square with visible indigo glow shadow below it
- Card: no visible border line — hairline via inset shadow only
- Google button: white with subtle shadow. Hovering: lifts 1px + shadow deepens. Pressing: scales 0.98
- Submit button: indigo gradient (not flat color). Pressing: scales 0.97
- Input fields: focus shows Apple two-ring (white gap + indigo outer) instead of teal outline
- Page load: title + Google button fades up first (80ms), divider second (140ms), form (200ms), submit (260ms)

---

- [ ] **Step 8: Build check — ensure production build passes**

```bash
npm run build
```

Expected: build completes without errors. (Does not deploy — only verifies no compilation issues.)

---

- [ ] **Step 9: Commit**

```bash
git add src/pages/Login.tsx
git commit -m "feat: reskin Login — radial glow bg, indigo logo halo, Apple card, gradient submit, form stagger"
```

---

## Post-Implementation Checklist

- [ ] All 5 files committed (verify with `git log --oneline -5`)
- [ ] `npx tsc --noEmit` passes cleanly
- [ ] `npm run build` passes
- [ ] Visual QA across all 4 screens: Login, Dashboard, AppLayout (any page), StatCards
- [ ] Sidebar collapse/expand animation still works (desktop)
- [ ] Sidebar mobile drawer still works (resize browser to mobile width)
- [ ] `prefers-reduced-motion` test: in browser DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce" → StatCards should appear without animation
- [ ] Deploy: `npm run build:all && wrangler deploy` (optional — only if ready to push to prod)

---

## Self-Review

**Spec coverage:**
- ✅ Section 1 tokens: Task 1 (index.css variables, keyframes, focus, squircle, Inter font)
- ✅ Section 2 AppLayout: Task 4 (sidebar logo, labels, nav states, header glass)
- ✅ Section 3 StatCard + Dashboard: Tasks 2+3 (icon pill, tabular-nums, stagger, header hierarchy, estadoColor, table)
- ✅ Section 4 Login: Task 5 (background glow, logo halo, card, buttons, stagger)
- ✅ tailwind.config.ts body font: Task 1 Step 3

**Placeholder scan:** None found — all steps contain exact code.

**Type consistency:**
- `StatCard.index?: number` added in Task 2, consumed as `index={0..3}` in Task 3 ✅
- Stagger class names `.stat-card-1..4` defined in Task 1, generated in Task 2 via template string ✅
- `.form-field-1..4` defined in Task 1, applied directly as className in Task 5 ✅
