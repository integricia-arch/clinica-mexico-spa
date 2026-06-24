# Task 1 — Loyalty Module DB Migrations: Fix Report

**Branch:** `feat/loyalty-module-etapa1`  
**Date:** 2026-06-24  
**Status:** DONE — All 5 fixes applied

---

## Original Migration

`supabase/migrations/20260624000001_loyalty_tables.sql` — created 6 tables for the loyalty fidelización module:

| Table | Purpose |
|-------|---------|
| `loyalty_config` | Per-clinic program configuration (name, slug, thresholds, multipliers) |
| `loyalty_members` | Loyalty program members with consent tracking (LFPDPPP) |
| `loyalty_planes` | Loyalty plans (frequent buyer, bonus points, direct discount) |
| `loyalty_movimientos` | Append-only points ledger |
| `loyalty_planes_progreso` | Member progress tracking per plan |
| `loyalty_campanas` | Marketing campaigns and newsletters |

Original migration also included indexes, `fn_set_updated_at` trigger, RLS on all 6 tables, and staff policies.

---

## Fixes Applied

### FIX 1 [HIGH]: Separated `permite_publicidad` into `000003` migration

**Problem:** `ALTER TABLE medicamentos ADD COLUMN IF NOT EXISTS permite_publicidad` belonged in a dedicated migration, not mixed into the loyalty tables creation file.

**Action:**
- Removed the `ALTER TABLE medicamentos` + `UPDATE medicamentos` block from `000001`
- Created `supabase/migrations/20260624000003_medicamentos_permite_publicidad.sql` with the column addition and OTC backfill
- Legal rationale preserved: COFEPRIS Art. 307 LGS — controlled/prescription drugs cannot be advertised

### FIX 2 [HIGH]: Added anon RLS policies for PWA (loyalty.integrika.mx)

**Problem:** The PWA at `loyalty.integrika.mx` uses `@supabase/supabase-js` with the Supabase anon key. Without anon SELECT policies, all PWA queries to `loyalty_members`, `loyalty_config`, and `loyalty_movimientos` would return empty sets (RLS blocks anon by default).

**Policies added:**
- `loyalty_members_pwa_read` — anon can SELECT members WHERE `activo = true`
- `loyalty_config_pwa_read` — anon can SELECT config WHERE `programa_activo = true`  
- `loyalty_mov_pwa_read` — anon can SELECT movements (filtered by `member_id` in app query)

Note: anon only gets SELECT. INSERT/UPDATE/DELETE still require `authenticated` role.

### FIX 3 [MEDIUM]: Added `updated_at` trigger to `loyalty_config`

**Problem:** `loyalty_config` has an `actualizado_at` column but no trigger to auto-update it on `UPDATE`. The existing `fn_set_updated_at()` sets `NEW.updated_at`, which does NOT match `loyalty_config`'s column name.

**Action:** Created `fn_set_actualizado_at()` that sets `NEW.actualizado_at = now()`, and trigger `trg_loyalty_config_actualizado_at` on `loyalty_config`.

### FIX 4 [MEDIUM]: Restricted `loyalty_planes_progreso` RLS to specific roles

**Problem:** Original `loyalty_progreso_staff` policy used `FOR ALL`, giving any clinic member full write access to progress records. This allowed any staff role (including read-only roles) to insert/modify/delete plan progress.

**Replacement (3 separate policies):**
- `loyalty_progreso_read` — any clinic member can SELECT (POS needs to display plan progress)
- `loyalty_progreso_write` — only `admin`, `manager`, `cajero` can INSERT
- `loyalty_progreso_delete` — only `admin`, `manager` can DELETE

Note: No UPDATE policy — progress records should be immutable once set (completions are recorded via new rows or the `completado_at`/`recompensa_entregada` flags on the existing row via the write policy).

### FIX 5 [LOW]: Added missing index on `loyalty_campanas(clinic_id)`

**Problem:** All queries to `loyalty_campanas` filter by `clinic_id` (the primary access pattern for multi-tenant queries and RLS evaluation), but no index existed.

**Action:** Added `CREATE INDEX idx_loyalty_campanas_clinic ON loyalty_campanas(clinic_id);`

---

## Files Modified

| File | Change |
|------|--------|
| `supabase/migrations/20260624000001_loyalty_tables.sql` | FIX 1 (remove permite_publicidad), FIX 2 (anon policies), FIX 3 (actualizado_at trigger), FIX 4 (progreso role-split), FIX 5 (campanas index) |
| `supabase/migrations/20260624000003_medicamentos_permite_publicidad.sql` | NEW — separated permite_publicidad migration |

---

## Deployment

Run:
```bash
supabase db push --linked --include-all
```

Then verify:
```bash
supabase db query --linked "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'loyalty%' ORDER BY table_name;"
```

Expected tables: `loyalty_campanas`, `loyalty_config`, `loyalty_members`, `loyalty_movimientos`, `loyalty_planes`, `loyalty_planes_progreso`
