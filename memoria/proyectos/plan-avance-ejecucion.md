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
| 4 | N3 unit economics + N2 pricing + N4 matriz tiers | Fable 5 | ✅ HECHO (2026-07-21) — commit `e1728fe` |
| 5 | E1 tests CI (smoke E2E + RPCs contables) | Sonnet | 🟡 PARCIAL (2026-07-21, decimotercera parte) — extraído `polizaValidation.ts` (calcularTotales/polizaCuadra/lineasValidas/construirPartidas) de `NuevaPolizaDialog.tsx`, 9 tests nuevos cubren la regla dura de `crear_poliza()` (Σdebe=Σhaber, redondeo a centavos). Suite completa 160/160 verde. Límite real: `contab_generar_poliza_evento` es función SQL pura invocada solo desde triggers/otras RPCs, sin lógica cliente que extraer — probarla de verdad requiere harness DB (pgTAP o Supabase local en CI), que este repo no tiene. Falta también smoke E2E. No cerrar como HECHO sin decidir si vale la pena montar ese harness |
| 6 | U1 farmacia responsive (plan listo) | Sonnet | ✅ HECHO — ya estaba implementado en sesión previa (commits 48035ba, 5080680), las 11 tasks del plan estaban [x]. Verificado por grep 2026-07-21 (octava parte) |
| 7 | U4 onboarding primer uso | Sonnet | ✅ HECHO (2026-07-21) — checklist derivado de datos reales (doctors/servicios/appointments), commit e85f3cc, pusheado (deploy auto vía GitHub Actions) |
| 8 | E3 code-splitting + E2 partir archivos | Sonnet / Haiku | 🟡 CASI CERRADO (2026-07-21, novena parte) — E3 HECHO: todas las rutas lazy-loaded, bundle inicial 3.38MB→676KB (commit bd3a2ed). E2 HECHO en CaminoPaciente (1148→253, dac30ba), CajaTurno (971→271, bb8213b), BI (954→148, 214a0da), Expedientes (934→514, 1fb1969), Pitch (1387→723, 0dd610e). Solo pendiente: AdminUsuarios.tsx (2037, saltado a propósito — componente monolítico sensible, requiere sesión dedicada) |
| 9 | M2 SEO + M1 caso de estudio | Sonnet setup / Haiku copy | ✅ YA HECHO (verificado 2026-07-21, décima parte) — M1 caso de estudio commit 40b0eaf. M2 setup: `robots.txt`+`sitemap.xml` en `public/`, meta description/canonical/og:title en `index.html`, JSON-LD `Organization`+`SoftwareApplication`+`Offer`. M2 contenido: 6 artículos long-tail reales en `manual-site/blog/` (software para clínica México, corte de caja farmacia, CFDI 4.0, expediente NOM-004, bot Telegram/WhatsApp, multi-clínica) — listados en sitemap. Plan decía "pendiente" — desactualizado |
| 10 | S2 warnings advisors + S3 deps | Sonnet / Haiku | ✅ HECHO (2026-07-21) — S3: `npm audit fix` (brace-expansion + js-yaml, 2 high→0). S2: 3 fixes triviales en prod vía `apply_migration` (duplicate_index en notas_consulta, profiles dedup 4→3 policies, auth_rls_initplan en `multiclinic_access_restrictive` ×17 tablas). Verificado con advisors post-fix. Pendiente NO trivial (fuera de esta sesión): auditar 106 SECURITY DEFINER que tocan dinero contra la regla del CLAUDE.md, leaked password protection (toggle dashboard), pg_net fuera de public, resto de auth_rls_initplan/multiple_permissive_policies |
| 11 | U2 chat ayuda humano | Sonnet | ✅ YA HECHO (verificado 2026-07-21, décima parte) — `HelpChatWidget.tsx` (usuario, montado global en AppLayout) + `AyudaInterna.tsx` en `/ayuda-interna` (staff: sesiones tomar/cerrar/responder + FAQ) + edge function `help-chat-ai` (3 tiers IA, auto-escalada por keyword/max-msgs/error, rate-limited). Plan y CLAUDE.md decían "pendiente"/"UI pendiente" — desactualizados, no había trabajo real que hacer |
| 12 | E4 script drift migraciones | Sonnet | ✅ HECHO (2026-07-21) — `scripts/check-migration-drift.ps1` (parsea `supabase migration list --linked`, exit 1 si hay remoto sin local), agregado a session-sync SKILL paso 1b. Probado contra estado real: detecta 18 drift (17 conocidas + `20260722005346` de la migración S2 de hoy vía MCP `apply_migration` — confirma que el MCP también genera drift, no solo Lovable) |
| 13 | U3 deep-links, U5 a11y, U6 empty states | Sonnet / Haiku | ✅ HECHO (2026-07-22) — U3 ya estaba (ruta `/cita/:id` real, `?highlight=` fallback), verificado sin cambios. U5: labels asociados a inputs de filtro en Citas.tsx, fila de tabla navegable por teclado (tabIndex/role=button/onKeyDown), aria-pressed en toggles de status, aria-label en botones icon-only del carrito POS (PuntoDeVenta.tsx) y buscador (DashboardFilters.tsx). U6: CTA en empty-states de Citas ("Nueva cita") y AdminDashboard (médicos/consultorios → /ajustes). Commit 23d0d60 |
| 14 | E5 índices BD | Sonnet | ✅ HECHO (2026-07-21) — 167 FK sin índice (`get_advisors performance`) resueltas en una migración (`20260722010000_e5_fk_indexes.sql`, `CREATE INDEX IF NOT EXISTS`). Aplicada vía `apply_migration` MCP (CLI bloqueado por drift ya conocido de E4). Verificado: advisors post-fix devuelve 0 `unindexed_foreign_keys`. También quedó mapeado el hallazgo de 121 índices sin uso — no se dropean a ciegas (features recientes sin tráfico real todavía) |
| 15 | E6 activos fijos — tasas depreciación | Sonnet | ✅ HECHO (2026-07-21) — investigación LISR Art. 34 (mobiliario/equipo 10%, cómputo 30%, equipo médico sin fracción explícita → 10% residual documentado). Catálogo editable `activos_fijos_tasas` (migración `20260722030000`), UI en tab Activos Fijos con fuente visible, solo admin edita, `registrar_activo_fijo()` congela snapshot al alta. Ya no bloqueado — ajustable sin migración si el contador confirma otra fracción para equipo médico |
| 16 | White-label multi-clínica: `logo_url`+`nombre` en `clinics`, wired en header/sidebar/PDFs/CFDI (reemplaza `Logo.tsx` hardcoded) | Sonnet | pendiente (media — tocar recibos y CFDI, requiere sesión dedicada) |

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
