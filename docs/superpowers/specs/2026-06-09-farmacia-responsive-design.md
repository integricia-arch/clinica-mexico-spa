# Farmacia Responsive Design — Spec

**Date:** 2026-06-09  
**Scope:** `src/features/farmacia/` + `src/components/AppLayout.tsx`  
**Targets:** Tablet (768–1279px landscape/portrait) + Desktop (≥1280px)  
**Approach:** A + elements of B — surgical breakpoint fixes + tablet-native POS polish

---

## 1. Problem Statement

The farmacia module is unusable on tablet:
- Sidebar (255px) consumes 25–68% of screen width with no collapse
- POS 3-column layout has no tablet breakpoint — columns are ~120px wide at 1024px
- Touch targets below 44px WCAG minimum
- Header turno bar overflows on tablet portrait
- Cobro button not always visible without scrolling

---

## 2. Sidebar Responsive (AppLayout.tsx)

### Desktop ≥1280px (xl+)
- Sidebar stays at 255px (current behavior)
- Add collapse toggle button `⟨` at bottom of sidebar
- Collapsed state: 64px wide, icon-only labels hidden
- Persist state in `localStorage` key `sidebar-collapsed`
- Tailwind: `hidden xl:flex` on sidebar static wrapper

### Tablet 768–1279px (md to lg)
- Sidebar hidden by default
- Hamburger button `☰` appears in top-left of main content area header
- Opens shadcn `Sheet` (side="left") as overlay drawer
- Closes on: outside click, navigation, Escape key
- No persistent state — always starts closed on tablet
- Tailwind: `xl:hidden` on Sheet trigger button

### Implementation
- Extend `src/hooks/use-mobile.tsx` — add `useIsTablet()`:
  ```ts
  export function useIsTablet() {
    // true when 768px ≤ width < 1280px
  }
  ```
  Uses same `matchMedia` pattern as existing `useIsMobile()`.
- New hook `useSidebarState()` in `src/hooks/useSidebarState.ts`
  - Returns: `{ isOpen, isCollapsed, toggle, close, isTablet }`
  - Derives `isTablet` from `useIsTablet()`
  - `isCollapsed` persists in `localStorage('sidebar-collapsed')`
- `AppLayout.tsx`: replace static sidebar with conditional Sheet/collapsed render
- Sidebar content component extracted to `SidebarContent.tsx` (shared between Sheet and static)

---

## 3. POS Grid Layout (PuntoDeVenta.tsx)

### Breakpoint grid

Tailwind defaults: `md`=768px, `lg`=1024px, `xl`=1280px.

```
grid gap-4
  xl:grid-cols-[220px_1fr_360px]   ← desktop ≥1280px: 3 cols (change lg→xl)
  md:grid-cols-[1fr_360px]          ← tablet 768–1279px: 2 cols (new)
  grid-cols-1                       ← fallback single col
```

### Frecuentes column on tablet
- Hidden via `hidden xl:block` on the frecuentes column wrapper
- On tablet: frecuentes items become a collapsible accordion `<details>` section above the product search/catalog
- Label: "Frecuentes ▾" — collapsed by default, expands inline
- Same data, same click handler — no logic change

### Catalog mode on tablet
- Grid view: `grid-cols-2` product cards instead of list
- Cards: `min-h-[80px] p-3`, name `text-base font-medium`, price `text-sm font-semibold text-primary`, stock badge color-coded
- List view: unchanged behavior, responsive adjustments only

### Stock badge color coding
```
stock > stockMinimo * 2  → green  (bg-green-100 text-green-800)
stock > 0 && ≤ stockMinimo * 2 → yellow (bg-yellow-100 text-yellow-800)
stock === 0              → red    (bg-red-100 text-red-800)
```

---

## 4. Carrito + Cobro Panel

### Sticky layout (tablet)
- Panel: `sticky top-0 max-h-[calc(100vh-4rem)] overflow-y-auto flex flex-col`
- Cart items section: `flex-1 overflow-y-auto`
- Totals + cobrar button: `sticky bottom-0 bg-card border-t border-border pt-3`
- "Cobrar $X.XX" button: `h-14 w-full text-base font-semibold` — always visible

### Cart item rows
- Min height: `min-h-14` for comfortable thumb tap
- Quantity +/− buttons: `h-10 w-10` with `rounded-full`
- Item name: `text-sm font-medium` (unchanged)
- Unit price: `text-xs text-muted-foreground`

### Payment methods (PaymentCapture.tsx)
- Method buttons: `min-h-12` minimum
- Amount inputs: `h-12` for easy tablet entry

---

## 5. Turno Header Bar (PuntoDeVenta.tsx)

### Desktop (current, preserved)
```
[👤 usuario] [🏢 clínica] [🕐 hora]  ──────  [🔒 Turno D484C4 · $100]
```

### Tablet <1280px
```
[☰ menu]  [🔒 Turno D484C4 · $100]  ──  [👤 IN ▾]
```
- Show only: hamburger (if tablet), turno badge, user avatar with dropdown
- Dropdown expands: clínica name, fecha/hora, full email
- Implementation: `hidden xl:flex` on clínica/hora spans, `xl:hidden` on hamburger button

---

## 6. Touch Targets & Typography

### Global rules (applied via Tailwind)
| Element | Current | Target |
|---|---|---|
| Frecuentes product button | `py-2` | `py-3 min-h-11` |
| Cart qty +/− | `h-6 w-6` | `h-10 w-10` |
| Payment method buttons | `h-9` | `min-h-12` |
| Tab buttons (PdV/Receta/Inv) | `py-1.5` | `py-2.5 min-h-11` |
| Product card click area | variable | `min-h-[80px]` |

### Typography scale changes
| Context | Current | New |
|---|---|---|
| Product name in cards/list | `text-sm` | `text-base` |
| Price in catalog | `text-xs` | `text-sm` |
| Cart item name | `text-sm` | `text-sm` (keep) |
| Cobrar button | `text-sm` | `text-base font-semibold` |

---

## 7. Files Changed

| File | Changes |
|---|---|
| `src/hooks/useSidebarState.ts` | New hook — sidebar open/collapsed state |
| `src/components/AppLayout.tsx` | Sidebar → Sheet on tablet, collapse on desktop |
| `src/components/SidebarContent.tsx` | Extract sidebar nav (new file, shared) |
| `src/features/farmacia/PuntoDeVenta.tsx` | Grid breakpoints, frecuentes accordion, header bar, touch targets |
| `src/features/farmacia/PaymentCapture.tsx` | Button/input min heights |

---

## 8. Out of Scope

- Mobile (<768px) — not a target device per requirements
- SurtirReceta, LibroControl, CorteCaja responsive — separate task
- Figma MCP / design token system — future iteration
- Dark mode changes — not requested
- Animation/transitions beyond existing Tailwind utilities

---

## 9. Success Criteria

- [ ] Tablet (768px, 1024px) renders POS as 2-column usable layout
- [ ] Sidebar accessible via hamburger drawer on tablet
- [ ] Desktop behavior unchanged
- [ ] All interactive elements ≥44px touch target
- [ ] Cobrar button always visible without scroll on tablet
- [ ] Frecuentes accessible via accordion on tablet
- [ ] Stock badges color-coded in catalog
- [ ] TypeScript build passes with 0 errors
- [ ] No regressions in desktop POS flow
