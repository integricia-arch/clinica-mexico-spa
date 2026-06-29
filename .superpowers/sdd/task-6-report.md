# Task 6: Edge Function `loyalty-arco-request`

**Status:** COMPLETE

**Commit:** e70cd7ad310acf3fff842e35231ecec6ee0da503

**Summary:** Created Deno edge function `loyalty-arco-request` that receives ARCO form submissions from the PWA, validates required fields, sanitizes HTML, and sends via Resend API to integric.ia@gmail.com. Function includes `verify_jwt = true` config entry per Supabase authentication design.

**Files created:**
- `supabase/functions/loyalty-arco-request/index.ts`

**Files modified:**
- `supabase/config.toml` — added `[functions.loyalty-arco-request]` with `verify_jwt = true`

**Verification:**
- TypeScript compilation: PASS (no errors)
- Test suite: 6 files, 57 tests all PASS
- Commit message follows conventional format: `feat:`
