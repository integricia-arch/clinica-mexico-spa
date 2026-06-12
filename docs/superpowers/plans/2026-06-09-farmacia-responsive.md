# Farmacia Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the farmacia module fully usable on tablet (768–1279px) and desktop (≥1280px) without breaking existing functionality.

**Architecture:** Surgical Tailwind breakpoint changes (`lg:` → `xl:` where needed), shadcn Sheet for sidebar drawer on tablet, frecuentes accordion on tablet, sticky cobro panel, touch target upgrades. Zero logic changes.

**Tech Stack:** React 18, TypeScript, Tailwind CSS (xl=1280px, lg=1024px, md=768px), shadcn/ui (Sheet, Collapsible), localStorage for sidebar state.

**Spec:** `docs/superpowers/specs/2026-06-09-farmacia-responsive-design.md`

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/hooks/use-mobile.tsx` | Modify | Add `useIsTablet()` |
| `src/hooks/useSidebarState.ts` | Create | Sidebar open/collapsed state |
| `src/components/AppLayout.tsx` | Modify | `lg:` → `xl:` breakpoints, collapse mode |
| `src/features/farmacia/PuntoDeVenta.tsx` | Modify | Grid xl:3-col/md:2-col, accordion, sticky cobro, touch targets, header, typography, stock badges |
| `src/features/farmacia/PaymentCapture.tsx` | Modify | `h-9` → `h-11` on all inputs/selects |

---

## Task 1: Add `useIsTablet` hook

**Files:**
- Modify: `src/hooks/use-mobile.tsx`

- [ ] **Step 1: Add `useIsTablet` to existing hook file**

Open `src/hooks/use-mobile.tsx`. The file currently exports only `useIsMobile`. Add `useIsTablet` below it:

```typescript
import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const TABLET_MAX_BREAKPOINT = 1280;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setIsTablet(w >= MOBILE_BREAKPOINT && w < TABLET_MAX_BREAKPOINT);
    };
    const mql = window.matchMedia(
      `(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_MAX_BREAKPOINT - 1}px)`
    );
    mql.addEventListener("change", check);
    check();
    return () => mql.removeEventListener("change", check);
  }, []);

  return !!isTablet;
}
```

- [ ] **Step 2: Verify build**

```bash
cd ~/clinica-mexico-spa && npm run build 2>&1 | grep -E "error|Error|✓"
```
Expected: `✓ built in` with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
cd ~/clinica-mexico-spa && git add src/hooks/use-mobile.tsx && git commit -m "feat: add useIsTablet hook for responsive sidebar"
```

---

## Task 2: Create `useSidebarState` hook

**Files:**
- Create: `src/hooks/useSidebarState.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useCallback, useEffect, useState } from "react";
import { useIsTablet } from "./use-mobile";

const STORAGE_KEY = "sidebar-collapsed";

export function useSidebarState() {
  const isTablet = useIsTablet();

  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  // Close drawer when switching to desktop
  useEffect(() => {
    if (!isTablet) setIsOpen(false);
  }, [isTablet]);

  const toggle = useCallback(() => {
    if (isTablet) {
      setIsOpen((v) => !v);
    } else {
      setIsCollapsed((v) => {
        const next = !v;
        try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
        return next;
      });
    }
  }, [isTablet]);

  const close = useCallback(() => setIsOpen(false), []);

  return { isOpen, isCollapsed, toggle, close, isTablet };
}
```

- [ ] **Step 2: Verify build**

```bash
cd ~/clinica-mexico-spa && npm run build 2>&1 | grep -E "error|Error|✓"
```
Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

```bash
cd ~/clinica-mexico-spa && git add src/hooks/useSidebarState.ts && git commit -m "feat: add useSidebarState hook with tablet/desktop logic"
```

---

## Task 3: Fix AppLayout sidebar breakpoints + collapse mode

**Files:**
- Modify: `src/components/AppLayout.tsx`

This task changes `lg:` → `xl:` on all sidebar-related classes AND adds desktop collapse mode.

- [ ] **Step 1: Update imports in AppLayout.tsx**

Find the import block at the top of `src/components/AppLayout.tsx`. Add `ChevronLeft` and `PanelLeft` to the lucide import, and add the Sheet import and useSidebarState:

```typescript
import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, CalendarDays, Receipt, FileText,
  Pill, Settings, Menu, X, Heart, Bell, ChevronDown, LogOut,
  CalendarPlus, Headset, ShieldCheck, Inbox as InboxIcon,
  MessageCircle, BellRing, ClipboardList, UserCog, Stethoscope,
  CreditCard, ChevronLeft, PanelLeft,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSidebarState } from "@/hooks/useSidebarState";
```

- [ ] **Step 2: Replace state and use new hook**

Find and remove this line in `AppLayout`:
```typescript
const [sidebarOpen, setSidebarOpen] = useState(false);
```

Replace with:
```typescript
const { isOpen: sidebarOpen, isCollapsed, toggle: toggleSidebar, close: closeSidebar, isTablet } = useSidebarState();
```

- [ ] **Step 3: Replace the overlay div**

Find:
```tsx
{sidebarOpen && (
  <div
    className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
    onClick={() => setSidebarOpen(false)}
  />
)}
```

Replace with:
```tsx
{sidebarOpen && isTablet && (
  <div
    className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm xl:hidden"
    onClick={closeSidebar}
  />
)}
```

- [ ] **Step 4: Replace the `<aside>` element**

Find the entire `<aside>` opening tag:
```tsx
<aside
  className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar transition-transform duration-300 lg:relative lg:translate-x-0 ${
    sidebarOpen ? "translate-x-0" : "-translate-x-full"
  }`}
>
```

Replace with:
```tsx
<aside
  className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar transition-all duration-300 xl:relative xl:translate-x-0 ${
    isCollapsed ? "w-16" : "w-64"
  } ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
>
```

- [ ] **Step 5: Update the X close button inside sidebar**

Find:
```tsx
<button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-sidebar-foreground hover:text-sidebar-accent-foreground">
  <X className="h-5 w-5" />
</button>
```

Replace with:
```tsx
<button onClick={closeSidebar} className="ml-auto xl:hidden text-sidebar-foreground hover:text-sidebar-accent-foreground">
  <X className="h-5 w-5" />
</button>
```

- [ ] **Step 6: Update nav item labels (hide when collapsed)**

Find the NavLink className line inside the nav:
```tsx
<NavLink
  to={item.to}
  onClick={() => setSidebarOpen(false)}
  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-sidebar-accent text-sidebar-primary"
      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
  }`}
>
  <item.icon className="h-[18px] w-[18px]" />
  <span className="flex-1">{item.label}</span>
  {showBadge && (
    <span className="inline-flex items-center justify-center min-w-[20px] h-5 text-[10px] font-bold rounded-full bg-red-500 text-white px-1.5">
      {escaladasCount}
    </span>
  )}
</NavLink>
```

Replace with:
```tsx
<NavLink
  to={item.to}
  onClick={closeSidebar}
  title={isCollapsed ? item.label : undefined}
  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    isCollapsed ? "justify-center px-0" : ""
  } ${
    isActive
      ? "bg-sidebar-accent text-sidebar-primary"
      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
  }`}
>
  <item.icon className="h-[18px] w-[18px] shrink-0" />
  {!isCollapsed && <span className="flex-1">{item.label}</span>}
  {!isCollapsed && showBadge && (
    <span className="inline-flex items-center justify-center min-w-[20px] h-5 text-[10px] font-bold rounded-full bg-red-500 text-white px-1.5">
      {escaladasCount}
    </span>
  )}
</NavLink>
```

- [ ] **Step 7: Update section labels (hide when collapsed)**

Find the section label paragraph:
```tsx
<p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
  {item.section}
</p>
```

Replace with:
```tsx
{!isCollapsed && (
  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
    {item.section}
  </p>
)}
```

- [ ] **Step 8: Update sidebar footer (hide text when collapsed)**

Find the footer div inside the sidebar:
```tsx
<div className="border-t border-sidebar-border p-4">
  <div className="flex items-center gap-3">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-primary text-sm font-semibold">
      {initials}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
        {user?.email || "Usuario"}
      </p>
      <p className="truncate text-xs text-sidebar-foreground/60">{roleLabel}</p>
    </div>
    <button
      onClick={() => { signOut(); navigate("/login"); }}
      className="text-sidebar-foreground hover:text-sidebar-accent-foreground"
      title="Cerrar sesión"
    >
      <LogOut className="h-4 w-4" />
    </button>
  </div>
</div>
```

Replace with:
```tsx
<div className="border-t border-sidebar-border p-4">
  <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center flex-col gap-1" : ""}`}>
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-primary text-sm font-semibold">
      {initials}
    </div>
    {!isCollapsed && (
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
          {user?.email || "Usuario"}
        </p>
        <p className="truncate text-xs text-sidebar-foreground/60">{roleLabel}</p>
      </div>
    )}
    {!isCollapsed && (
      <button
        onClick={() => { signOut(); navigate("/login"); }}
        className="text-sidebar-foreground hover:text-sidebar-accent-foreground"
        title="Cerrar sesión"
      >
        <LogOut className="h-4 w-4" />
      </button>
    )}
  </div>
  {/* Collapse toggle — desktop only */}
  <button
    onClick={toggleSidebar}
    className="mt-3 hidden xl:flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
    title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
  >
    <ChevronLeft className={`h-4 w-4 transition-transform ${isCollapsed ? "rotate-180" : ""}`} />
    {!isCollapsed && <span>Colapsar</span>}
  </button>
</div>
```

- [ ] **Step 9: Fix hamburger button in main header**

Find:
```tsx
<button onClick={() => setSidebarOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground">
  <Menu className="h-5 w-5" />
</button>
<div className="hidden lg:block" />
```

Replace with:
```tsx
<button onClick={toggleSidebar} className="xl:hidden text-muted-foreground hover:text-foreground">
  <Menu className="h-5 w-5" />
</button>
<div className="hidden xl:block" />
```

- [ ] **Step 10: Verify build**

```bash
cd ~/clinica-mexico-spa && npm run build 2>&1 | grep -E "error TS|Error|✓ built"
```
Expected: `✓ built in` — zero TypeScript errors.

- [ ] **Step 11: Commit**

```bash
cd ~/clinica-mexico-spa && git add src/components/AppLayout.tsx && git commit -m "feat: sidebar responsive — xl breakpoint + desktop collapse toggle"
```

---

## Task 4: POS grid breakpoints (xl:3-col, md:2-col) + hide frecuentes column

**Files:**
- Modify: `src/features/farmacia/PuntoDeVenta.tsx`

- [ ] **Step 1: Fix POS 3-column grid**

Find:
```tsx
<div className="grid gap-4 lg:grid-cols-[220px_1fr_360px] items-start">
```

Replace with:
```tsx
<div className="grid gap-4 xl:grid-cols-[220px_1fr_360px] md:grid-cols-[1fr_360px] items-start">
```

- [ ] **Step 2: Hide frecuentes left column on tablet**

Find the opening tag of the frecuentes/catálogo left column (directly inside the 3-col grid):
```tsx
<div className="space-y-2 sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
  {viewMode === "scanner" ? (
    <>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Frecuentes</h3>
```

Replace the opening tag only:
```tsx
<div className="hidden xl:block space-y-2 sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
  {viewMode === "scanner" ? (
    <>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Frecuentes</h3>
```

- [ ] **Step 3: Verify build**

```bash
cd ~/clinica-mexico-spa && npm run build 2>&1 | grep -E "error TS|Error|✓ built"
```
Expected: `✓ built in` with no errors.

- [ ] **Step 4: Commit**

```bash
cd ~/clinica-mexico-spa && git add src/features/farmacia/PuntoDeVenta.tsx && git commit -m "feat: POS grid xl:3-col md:2-col, hide frecuentes column on tablet"
```

---

## Task 5: Frecuentes accordion for tablet

**Files:**
- Modify: `src/features/farmacia/PuntoDeVenta.tsx`

This adds a `<details>` accordion with frecuentes visible only on tablet (xl:hidden), placed between the view-mode toggle and the scanner/catalog section.

- [ ] **Step 1: Find the scanner section start**

Locate this block (it appears after the view-mode toggle buttons and before the scanner form):

```tsx
{/* Sin turno → solo se permite abrir turno; el resto del POS se oculta */}
{!shiftLoading && !shift && (
  <OpenShiftCard onOpened={(s) => setShift(s)} />
)}
{shift && (<>
{/* Scanner (modo escáner) */}
{viewMode === "scanner" && (
  <form onSubmit={onScanSubmit} className="flex gap-2">
```

- [ ] **Step 2: Insert frecuentes accordion after `{shift && (<>`**

Add the following block immediately after `{shift && (<>` and before the scanner form:

```tsx
{/* Frecuentes accordion — visible only on tablet (hidden on desktop where left column shows) */}
{viewMode === "scanner" && frecuentes.length > 0 && (
  <details className="xl:hidden rounded-lg border border-border bg-card overflow-hidden">
    <summary className="flex items-center justify-between px-3 py-2.5 cursor-pointer select-none text-sm font-semibold text-foreground hover:bg-accent transition-colors">
      <span>Frecuentes</span>
      <span className="text-xs text-muted-foreground font-normal">{frecuentes.length} productos</span>
    </summary>
    <div className="grid grid-cols-2 gap-1.5 p-2 border-t border-border">
      {frecuentes.map((m) => {
        const blocked = !!blockReasonForDirectSale(m);
        return (
          <button
            key={m.id}
            type="button"
            disabled={blocked}
            onClick={() => addToCart(m)}
            className="text-left rounded-md border border-border bg-background px-3 py-3 min-h-[64px] hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <p className="text-sm font-medium truncate leading-tight">{m.nombre}</p>
            <p className="text-xs text-muted-foreground flex justify-between mt-1">
              <span>{formatMXN(m.precio_unitario)}</span>
              <span>Stock {stockOf(m.id)}</span>
            </p>
          </button>
        );
      })}
    </div>
  </details>
)}
```

- [ ] **Step 3: Verify build**

```bash
cd ~/clinica-mexico-spa && npm run build 2>&1 | grep -E "error TS|Error|✓ built"
```
Expected: `✓ built in` with no errors.

- [ ] **Step 4: Commit**

```bash
cd ~/clinica-mexico-spa && git add src/features/farmacia/PuntoDeVenta.tsx && git commit -m "feat: frecuentes accordion for tablet POS view"
```

---

## Task 6: Cobro panel sticky — Cobrar button always visible

**Files:**
- Modify: `src/features/farmacia/PuntoDeVenta.tsx`

The Cobro panel needs to be a flex column so the bottom section (totals + buttons + cobrar) sticks to the bottom regardless of scroll.

- [ ] **Step 1: Restructure the Cobro outer div**

Find the Cobro panel opening div:
```tsx
<div className="rounded-xl border border-border bg-card p-3 shadow-sm space-y-3 self-start sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
  <h3 className="font-semibold">Cobro</h3>
```

Replace with:
```tsx
<div className="rounded-xl border border-border bg-card shadow-sm self-start sticky top-4 max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
  <div className="p-3 border-b border-border">
    <h3 className="font-semibold">Cobro</h3>
  </div>
  <div className="flex-1 overflow-y-auto p-3 space-y-3">
```

- [ ] **Step 2: Find the end of scrollable content (before buttons)**

Find the two suspend/cancel buttons + cobrar button section at the bottom of the Cobro panel:

```tsx
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12" onClick={suspendSale} disabled={cart.length === 0}>
              <PauseCircle className="h-4 w-4 mr-1" />Suspender
            </Button>
            <Button variant="outline" className="h-12 text-destructive border-destructive/40" onClick={cancelSale} disabled={cart.length === 0}>
              <XCircle className="h-4 w-4 mr-1" />Cancelar
            </Button>
          </div>

          <Button
            className="w-full h-14 text-base"
            disabled={cart.length === 0 || submitting || !perms.canPosSell}
            onClick={handleCobrar}
          >
            <Receipt className="h-5 w-5 mr-2" />
            {submitting ? "Registrando…" : `Cobrar ${formatMXN(total)}`}
          </Button>
        </div>
```

Replace with:
```tsx
  </div>{/* end scrollable content */}
  <div className="p-3 border-t border-border space-y-2 bg-card">
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" className="h-12" onClick={suspendSale} disabled={cart.length === 0}>
        <PauseCircle className="h-4 w-4 mr-1" />Suspender
      </Button>
      <Button variant="outline" className="h-12 text-destructive border-destructive/40" onClick={cancelSale} disabled={cart.length === 0}>
        <XCircle className="h-4 w-4 mr-1" />Cancelar
      </Button>
    </div>
    <Button
      className="w-full h-14 text-base font-semibold"
      disabled={cart.length === 0 || submitting || !perms.canPosSell}
      onClick={handleCobrar}
    >
      <Receipt className="h-5 w-5 mr-2" />
      {submitting ? "Registrando…" : `Cobrar ${formatMXN(total)}`}
    </Button>
  </div>
</div>
```

- [ ] **Step 3: Verify build**

```bash
cd ~/clinica-mexico-spa && npm run build 2>&1 | grep -E "error TS|Error|✓ built"
```
Expected: `✓ built in` — if there are JSX nesting errors, check that `</div>` counts match.

- [ ] **Step 4: Commit**

```bash
cd ~/clinica-mexico-spa && git add src/features/farmacia/PuntoDeVenta.tsx && git commit -m "feat: cobro panel sticky — cobrar button always visible on tablet"
```

---

## Task 7: Turno header bar responsive

**Files:**
- Modify: `src/features/farmacia/PuntoDeVenta.tsx`

On tablet (<xl), hide clínica and hora from the topbar — only show cajero name and turno badge.

- [ ] **Step 1: Update the topbar spans**

Find the topbar section:
```tsx
<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
  <div className="flex items-center gap-4 text-sm">
    <span className="flex items-center gap-1.5"><UserIcon className="h-4 w-4 text-muted-foreground" /><strong>{cajeroLabel}</strong></span>
    <span className="flex items-center gap-1.5 text-muted-foreground"><Building2 className="h-4 w-4" />{activeClinic?.name ?? "—"}</span>
    <span className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-4 w-4" />{format(now, "dd/MM/yyyy HH:mm", { locale: es })}</span>
  </div>
  <ShiftBadge shift={shift} />
</div>
```

Replace with:
```tsx
<div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
  <div className="flex items-center gap-3 text-sm min-w-0">
    <span className="flex items-center gap-1.5 shrink-0"><UserIcon className="h-4 w-4 text-muted-foreground" /><strong className="truncate max-w-[120px] xl:max-w-none">{cajeroLabel}</strong></span>
    <span className="hidden xl:flex items-center gap-1.5 text-muted-foreground"><Building2 className="h-4 w-4 shrink-0" />{activeClinic?.name ?? "—"}</span>
    <span className="hidden xl:flex items-center gap-1.5 text-muted-foreground"><Clock className="h-4 w-4 shrink-0" />{format(now, "dd/MM/yyyy HH:mm", { locale: es })}</span>
  </div>
  <ShiftBadge shift={shift} />
</div>
```

- [ ] **Step 2: Verify build**

```bash
cd ~/clinica-mexico-spa && npm run build 2>&1 | grep -E "error TS|Error|✓ built"
```

- [ ] **Step 3: Commit**

```bash
cd ~/clinica-mexico-spa && git add src/features/farmacia/PuntoDeVenta.tsx && git commit -m "feat: turno header bar responsive — compact on tablet"
```

---

## Task 8: Touch targets — cart, view mode tabs, frecuentes buttons

**Files:**
- Modify: `src/features/farmacia/PuntoDeVenta.tsx`

- [ ] **Step 1: Enlarge view mode toggle buttons**

Find:
```tsx
<button
  type="button"
  onClick={() => setViewMode("scanner")}
  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
    viewMode === "scanner" ? "bg-background shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
  }`}
>
  <ScanLine className="h-4 w-4" />Escáner
</button>
<button
  type="button"
  onClick={() => setViewMode("catalogo")}
  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
    viewMode === "catalogo" ? "bg-background shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
  }`}
>
  <LayoutGrid className="h-4 w-4" />Catálogo
</button>
```

Replace with:
```tsx
<button
  type="button"
  onClick={() => setViewMode("scanner")}
  className={`flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] text-sm rounded-md transition-colors ${
    viewMode === "scanner" ? "bg-background shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
  }`}
>
  <ScanLine className="h-4 w-4" />Escáner
</button>
<button
  type="button"
  onClick={() => setViewMode("catalogo")}
  className={`flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] text-sm rounded-md transition-colors ${
    viewMode === "catalogo" ? "bg-background shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
  }`}
>
  <LayoutGrid className="h-4 w-4" />Catálogo
</button>
```

- [ ] **Step 2: Enlarge frecuentes product buttons (desktop left column)**

Find in the frecuentes section inside the left column (inside `hidden xl:block`):
```tsx
className="w-full text-left rounded-md border border-border bg-card px-3 py-2 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
```

Replace with:
```tsx
className="w-full text-left rounded-md border border-border bg-card px-3 py-3 min-h-[52px] hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
```

- [ ] **Step 3: Enlarge cart qty +/− buttons**

Find both cart quantity buttons:
```tsx
<Button size="icon" variant="outline" className="h-9 w-9" onClick={() => updateQty(i, -1)}>
  <Minus className="h-4 w-4" />
</Button>
```
and
```tsx
<Button size="icon" variant="outline" className="h-9 w-9" onClick={() => updateQty(i, 1)}>
  <Plus className="h-4 w-4" />
</Button>
```

Replace both `className="h-9 w-9"` with `className="h-10 w-10"`.

- [ ] **Step 4: Enlarge cart item rows min-height**

Find the cart item row div:
```tsx
<div key={i} className="py-3 grid grid-cols-[1fr_auto] gap-2 items-start">
```

Replace with:
```tsx
<div key={i} className="py-3 min-h-[56px] grid grid-cols-[1fr_auto] gap-2 items-start">
```

- [ ] **Step 5: Verify build**

```bash
cd ~/clinica-mexico-spa && npm run build 2>&1 | grep -E "error TS|Error|✓ built"
```

- [ ] **Step 6: Commit**

```bash
cd ~/clinica-mexico-spa && git add src/features/farmacia/PuntoDeVenta.tsx && git commit -m "feat: touch targets — cart qty, view mode tabs, frecuentes buttons"
```

---

## Task 9: PaymentCapture touch targets

**Files:**
- Modify: `src/features/farmacia/PaymentCapture.tsx`

All inputs and selects use `h-9` (36px). Minimum for tablet is `h-11` (44px).

- [ ] **Step 1: Replace all `h-9` with `h-11` in PaymentCapture.tsx**

```bash
cd ~/clinica-mexico-spa && sed -i 's/className="h-9"/className="h-11"/g' src/features/farmacia/PaymentCapture.tsx && sed -i 's/className="h-9 /className="h-11 /g' src/features/farmacia/PaymentCapture.tsx
```

- [ ] **Step 2: Verify no regressions**

```bash
cd ~/clinica-mexico-spa && grep -n "h-9\|h-11" src/features/farmacia/PaymentCapture.tsx | head -20
```
Expected: all `h-9` replaced with `h-11`.

- [ ] **Step 3: Verify build**

```bash
cd ~/clinica-mexico-spa && npm run build 2>&1 | grep -E "error TS|Error|✓ built"
```

- [ ] **Step 4: Commit**

```bash
cd ~/clinica-mexico-spa && git add src/features/farmacia/PaymentCapture.tsx && git commit -m "feat: PaymentCapture h-9→h-11 touch targets for tablet"
```

---

## Task 10: Stock badge color coding + typography scale

**Files:**
- Modify: `src/features/farmacia/PuntoDeVenta.tsx`

- [ ] **Step 1: Update catalog product buttons — typography and stock badge**

Find the catalog button in the catalog view (inside `catalogFiltered.map`):
```tsx
<button
  key={m.id}
  type="button"
  disabled={blocked || stock === 0}
  onClick={() => addToCart(m)}
  className="w-full text-left rounded-md border border-border bg-card px-3 py-2 hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
>
  <p className="text-sm font-medium truncate">{m.nombre}</p>
  <p className="text-[10px] text-muted-foreground">{m.categoria}</p>
  <p className="text-[11px] text-muted-foreground flex justify-between">
    <span>{formatMXN(m.precio_unitario)}</span>
    <span className={stock === 0 ? "text-destructive" : ""}>Stock {stock}</span>
  </p>
  {blocked && <p className="text-[10px] text-destructive">Requiere receta</p>}
</button>
```

Replace with:
```tsx
<button
  key={m.id}
  type="button"
  disabled={blocked || stock === 0}
  onClick={() => addToCart(m)}
  className="w-full text-left rounded-md border border-border bg-card px-3 py-3 min-h-[72px] hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
>
  <p className="text-base font-medium truncate leading-tight">{m.nombre}</p>
  <p className="text-xs text-muted-foreground">{m.categoria}</p>
  <div className="flex items-center justify-between mt-1 gap-1 flex-wrap">
    <span className="text-sm font-semibold text-primary">{formatMXN(m.precio_unitario)}</span>
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
      stock === 0
        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
        : stock <= 5
        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
        : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    }`}>Stock {stock}</span>
  </div>
  {blocked && <p className="text-xs text-destructive mt-0.5">Requiere receta</p>}
</button>
```

- [ ] **Step 2: Update frecuentes product buttons typography (desktop column)**

Find inside the frecuentes left column (inside `hidden xl:block`):
```tsx
<p className="text-sm font-medium truncate">{m.nombre}</p>
<p className="text-[11px] text-muted-foreground flex justify-between">
  <span>{formatMXN(m.precio_unitario)}</span>
  <span>Stock {stockOf(m.id)}</span>
</p>
```

Replace with:
```tsx
<p className="text-base font-medium truncate leading-tight">{m.nombre}</p>
<div className="flex items-center justify-between mt-0.5 gap-1">
  <span className="text-sm text-muted-foreground">{formatMXN(m.precio_unitario)}</span>
  <span className={`text-xs px-1 py-0.5 rounded font-medium ${
    stockOf(m.id) === 0
      ? "bg-red-100 text-red-800"
      : stockOf(m.id) <= 5
      ? "bg-yellow-100 text-yellow-800"
      : "bg-green-100 text-green-800"
  }`}>Stock {stockOf(m.id)}</span>
</div>
```

- [ ] **Step 3: Verify build**

```bash
cd ~/clinica-mexico-spa && npm run build 2>&1 | grep -E "error TS|Error|✓ built"
```

- [ ] **Step 4: Commit**

```bash
cd ~/clinica-mexico-spa && git add src/features/farmacia/PuntoDeVenta.tsx && git commit -m "feat: stock badges color-coded + typography scale on product cards"
```

---

## Task 11: Final verification + deploy

- [ ] **Step 1: Full build**

```bash
cd ~/clinica-mexico-spa && npm run build 2>&1 | tail -10
```
Expected: `✓ built in` with 0 TypeScript errors.

- [ ] **Step 2: Visual verification desktop — open local preview**

```bash
cd ~/clinica-mexico-spa && npx wrangler pages dev dist --port 4173 &
```
Check at `http://localhost:4173/farmacia`:
- Sidebar shows at 255px, collapse toggle `⟨` visible at bottom
- POS shows 3 columns
- Stock badges green/yellow/red visible
- Cobrar button fully visible without scroll

- [ ] **Step 3: Visual verification tablet — resize browser to 1024px**

Resize browser DevTools to 1024px width. Check:
- Sidebar hidden, hamburger `☰` visible in top-left header
- POS shows 2 columns (frecuentes column hidden)
- Frecuentes accordion visible above scanner, collapsed by default
- Cobrar button pinned to bottom of cobro panel
- Topbar shows only cajero + turno badge

- [ ] **Step 4: Visual verification tablet portrait — resize to 768px**

Check:
- Same 2-column layout still works
- All touch targets visually large enough
- Cobro panel scrollable, cobrar button always visible

- [ ] **Step 5: Deploy to production**

```bash
cd ~/clinica-mexico-spa && wrangler deploy
```

- [ ] **Step 6: Final commit if any fixes applied**

```bash
cd ~/clinica-mexico-spa && git add -p && git commit -m "fix: farmacia responsive final adjustments"
```

---

## Success Criteria Checklist

- [ ] Tablet (768px, 1024px) POS renders as 2-column usable layout
- [ ] Sidebar accessible via hamburger drawer on tablet
- [ ] Sidebar collapse toggle works on desktop (persists in localStorage)
- [ ] Desktop 3-column layout unchanged
- [ ] All interactive elements ≥44px touch target
- [ ] Cobrar button always visible without scroll on tablet
- [ ] Frecuentes accessible via accordion on tablet
- [ ] Stock badges color-coded (verde/amarillo/rojo)
- [ ] TypeScript build passes with 0 errors
- [ ] No regressions in desktop POS flow
