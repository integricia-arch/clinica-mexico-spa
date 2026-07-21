# Plan de avance — ejecución del Análisis Integral (Fable, 2026-07-21)

Doc de seguimiento del plan en [[analisis-integral-2026-07-21]]. Marca aquí el avance.
Regla operativa: **una tarea = una sesión corta**, cortar al primer aviso de costo crítico.

Convención modelos: **Haiku 4.5** mecánico/copy · **Sonnet** dev principal ·
**Opus 4.8** arquitectura/seguridad · **Fable 5** solo planeación/negocio transversal.

## Orden de ejecución + estado

| # | Tarea | Modelo | Estado |
|---|-------|--------|--------|
| 1 | N1 testimonios /pitch (riesgo legal) | Fable decide / Haiku edita | ✅ HECHO (2026-07-21) — testimonios → "escenarios ilustrativos", commits 93f47a1 + af04fba |
| 2 | S4 pen-test onboarding tenants | Opus 4.8 | ✅ HECHO (2026-07-21) — H1 capa 1+2 (RLS clinics scopeada) + H2 (provision-queue por clínica). Verificado en browser. Commits e328dfd, 02f103b, 5b6caee |
| 3 | S1 rate limiting Edge Functions | Opus 4.8 diseño, Sonnet implementa | ✅ HECHO (2026-07-21) — tabla `rate_limits` + RPC `check_rate_limit` (migración 20260721233000 + revoke anon/authenticated 20260721233500), helper `_shared/rateLimit.ts`, 5 functions cableadas (arco-request 3/h·IP, stripe-checkout 10/h·IP, help-chat-ai 30/h·user, cfdi-timbrar 60/h·user, stripe-payment-intent 20/h·user). Deploy vía CLI. Test burst real en prod: 4ª request → 429 confirmado (filas de prueba + bucket limpiados después). Advisors security limpio (solo INFO rls_enabled_no_policy esperado). Doc actualizado en `docs/edge-functions-auth.md` |
| **4** | **N3 unit economics + N2 pricing + N4 matriz tiers** | **Fable 5** | **⬅️ SIGUIENTE — handoff listo en `N2-N3-N4-pricing-handoff.md`** |
| 5 | E1 tests CI (smoke E2E + RPCs contables) | Sonnet | pendiente (2-3 cortas) |
| 6 | U1 farmacia responsive (plan listo) | Sonnet | pendiente (2 cortas) |
| 7 | U4 onboarding primer uso | Sonnet | pendiente (media) |
| 8 | E3 code-splitting + E2 partir archivos | Sonnet / Haiku | pendiente (2 cortas) |
| 9 | M2 SEO + M1 caso de estudio | Sonnet setup / Haiku copy | pendiente (2 cortas) |
| 10 | S2 warnings advisors + S3 deps | Sonnet / Haiku | pendiente (corta) |
| 11 | U2 chat ayuda humano | Sonnet | pendiente (media) |
| 12 | E4 script drift migraciones | Sonnet | pendiente (corta) |
| 13 | U3 deep-links, U5 a11y, U6 empty states | Sonnet / Haiku | pendiente (cortas) |
| 14 | E5 índices BD | Sonnet | pendiente (corta) |
| 15 | E6 activos fijos | BLOQUEADO (contador) | ⛔ esperar tasa fiscal de Pablo |

## Bloqueos humanos (Pablo)
- N1 testimonios → resuelto (ilustrativos).
- E6 tasa depreciación equipo médico → confirmar con contador.
- M1 datos del piloto real → para caso de estudio.
- N2/N4 decisión final pricing → sesión de negocio (#4).

## Detalle tarea #3 (siguiente) — S1 rate limiting · Opus 4.8

Problema: sin rate limit en `create-tenant`, `verify-tenant-code`, `arco-request`,
`help-chat-ai`, `stripe-payment-intent`. Endpoints públicos = abuso/costo.

Acciones:
1. Inventariar las ~41 functions, clasificar expuestas sin límite.
2. Contador por IP/identidad (tabla `rate_limits` o KV Cloudflare) en las 5-6 críticas.
3. Test negativo: burst 20 req → 429.

Cierre: columna "rate limit" en `docs/edge-functions-auth.md`, advisors limpio, test pasa.

Indicación al arrancar #3:
> Sigo con clinica-mexico-spa (Supabase ref kyfkvdyxpvpiacyymldc — valida MCP antes de
> tocar). Tarea S1 (rate limiting) del plan `plan-avance-ejecucion.md`. Diseño con Opus,
> implementación con Sonnet. Empieza inventariando las functions expuestas sin límite.
