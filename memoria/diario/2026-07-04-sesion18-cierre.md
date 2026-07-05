# Sesión 18 (continuación) — cierre de auditoría de seguridad Supabase

**Fecha:** 2026-07-04

Continuación de la sesión 18 (que había cerrado 6 hallazgos críticos/altos y
dejado el backlog P1/P2/P3 documentado en
[[seguridad-auditoria-supabase-2026-07-04]]). El usuario pidió cerrar todo el
backlog en esta continuación.

## Resumen

- **P1** (26 funciones `SECURITY DEFINER`+`anon` sin check): cerrado. Ver
  detalle en STATE.md sección "sesión 18". Un hallazgo (`cancelar_citas_prueba`)
  resultó más grave de lo que sugería el nombre — cancelaba citas reales, no
  solo de prueba — se confirmó con el usuario antes de revocarla.
- **P2** (19 policies RLS "always true"): cerrado. Bloque grande de tablas
  `journey_*` resuelto con una sola función helper reusable
  (`user_can_access_journey_instance`).
- **P3** (extensiones en `public`): 3 de 4 movidas a `extensions`. `pg_net` no
  es relocatable en Supabase (limitación de plataforma, documentado).

## Bugs propios encontrados y corregidos en el camino

1. Precedencia SQL (`AND ... OR` sin paréntesis) en el primer intento de fix
   de `get_medicamentos_en_reorden` — se detectó antes de cerrar el hallazgo,
   se corrigió con una segunda migración.
2. `SET search_path TO 'public, extensions'` con comillas simples alrededor de
   ambos schemas crea un solo nombre de schema literal con coma adentro, no
   dos schemas — rompía `faq_buscar()` (`relation "faq_items" does not exist`).
   Sintaxis correcta: sin comillas, `SET search_path TO public, extensions`.
   Ambos se detectaron con verificación activa (correr la función después del
   fix), no se dieron por buenos a ciegas.

## Decisiones del usuario (vía AskUserQuestion)

- `cancelar_citas_prueba`: revocar de anon/authenticated/public ya.
- Grupo "diseño intencional" (bot FAQ, jobs sin auth): no tocar esta sesión.

## Verificación final

`get_advisors(security)` corrido al final: 0 `rls_policy_always_true` fuera de
los 2 casos confirmados como intencionales (`arco_requests`, `pos_error_logs`);
`extension_in_public` solo reporta `pg_net` (esperado).

## Pendiente real (no de este backlog)

- Toggle "leaked password protection" en dashboard de Supabase — acción manual
  del usuario, no scriptable.
