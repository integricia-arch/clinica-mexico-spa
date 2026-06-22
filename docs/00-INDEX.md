# ClínicaMX SaaS — Documentos de Proyecto

> Fuente de verdad para agentes IA. Leer antes de codear.

| # | Doc | Contenido | Leer cuando... |
|---|---|---|---|
| 01 | [PRD](./01-PRD.md) | Qué construimos, para quién, funcionalidades | Duda sobre alcance o prioridades |
| 02 | [TRD](./02-TRD.md) | Stack, libs, convenciones, restricciones técnicas | Elegir tecnología o patrón |
| 03 | [App Flow](./03-APP-FLOW.md) | Rutas, navegación, recorridos, estados | Trabajar en una pantalla nueva o flujo |
| 04 | [UI/UX Brief](./04-UI-UX-BRIEF.md) | Colores, tipografía, componentes, responsive | Diseñar o modificar UI |
| 05 | [Backend Schema](./05-BACKEND-SCHEMA.md) | Tablas, RLS, Edge Functions, ADRs | Tocar DB, auth o APIs |
| 06 | [Implementation Plan](./06-IMPLEMENTATION-PLAN.md) | Fases, tareas pendientes, criterios de completitud | Planear qué hacer en la sesión |

---

## TL;DR del proyecto

**ClínicaMX** = SaaS para clínicas médicas en México.

- Pacientes agendan por **Telegram** con bot IA (Claude Sonnet 4.6)
- Recepción gestiona desde **dashboard web** (React/Vite/shadcn + Supabase)
- Recordatorios automáticos T-24h y T-2h vía pg_cron
- Stack: Vite + React 18 + TS + Tailwind + shadcn | Supabase (Postgres + Edge Functions Deno)
- Repo: `github.com/integricia-arch/clinica-mexico-spa` (main)
- Local: `C:\Users\pablo\clinica-mexico-spa`

## Estado actual

- Backend: ✅ 100% operativo
- Frontend: 🔶 ~70% — pendiente inbox completo + /recordatorios + polish mobile
- Próximo: Fase A (Inbox) → Fase B (/recordatorios) → Fase F (Edge Functions al repo)
