# Task 6 Report — Loyalty PWA Customer App

**Status:** DONE_WITH_CONCERNS
**Commit SHA:** a5b0cd8
**Branch:** worktree-agent-addad26fa62c56fce

---

## Files Created

| File | Description |
|------|-------------|
| `src/pwa/LoyaltyApp.tsx` | Root PWA component — login screen, route layout with AnimatePresence transitions |
| `src/pwa/hooks/useLoyaltyPWA.ts` | Data hook — loads config/member/movimientos, localStorage session, loginByContact, logout, updateMarketingConsent |
| `src/pwa/components/BottomNav.tsx` | Fixed bottom nav with motion whileTap micro-interactions on each tab |
| `src/pwa/pages/Monedero.tsx` | Virtual card + react-barcode + animated balance toggle + stagger-list movement history |
| `src/pwa/pages/Inicio.tsx` | Summary screen with animated hero card + "Ver mi Monedero" CTA |
| `src/pwa/pages/Promos.tsx` | Placeholder promotions screen |
| `src/pwa/pages/Cuenta.tsx` | Account settings — marketing consent Switch, legal links (LFPDPPP, ARCO), logout button |

## Files Modified

| File | Change |
|------|--------|
| `src/App.tsx` | Added import + public route /loyalty/:slug/* before ProtectedRoute catch-all |
| `package.json` | Added react-barcode@1.6.1 |
| `bun.lock` | Updated lockfile |

---

## Architecture

Built within `src/pwa/` inside the main SaaS app (not separate workspace). PWA runs at `/loyalty/:slug/*` as a public route. Task 6.5 (separate Vercel workspace) not in scope for this task.

---

## TypeScript

`bun run tsc --noEmit` — 0 errors.

---

## Motion / Design

- AnimatePresence mode="wait" on all route transitions (opacity + y)
- BottomNav tabs: whileTap scale:0.85 spring
- Monedero balance toggle: eye-icon flip via AnimatePresence
- Monedero movement list: listItemVariants stagger from design/motion.ts
- Login hero: scale + opacity spring entry animation
- Inicio card: cardVariants from design/motion.ts
- All motion imports from 'motion/react'

---

## Concerns

### C1 (MEDIUM): Worktree branch — needs merge
Branch is worktree-agent-addad26fa62c56fce. Orchestrator must cherry-pick a5b0cd8 into feat/loyalty-module-etapa1.

### C2 (HIGH): RLS not verified for anon key queries
loyalty_movimientos RLS must restrict cross-member reads. If only staff JWT policies exist, anon queries either fail silently or expose all rows. Verify/fix in Gate R6-C.

### C3 (HIGH): No rate limiting on loginByContact()
Phone/email lookup is enumerable without rate limiting. Address before production (Edge Function intermediary or Supabase rate limiting).

### C4 (LOW): Logout is localStorage-only
UUID remains valid server-side after logout. Acceptable for MVP.
