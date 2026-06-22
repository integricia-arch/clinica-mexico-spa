# 06 — Plan de Implementación

**Estado actual:** Backend 100% operativo. Frontend ~70% completo.  
Este plan cubre el camino desde hoy hasta demo estable → producción.

---

## Fase A — Inbox (Prioridad ALTA, ~2-3 sesiones)

**Objetivo:** Inbox funcional al 100% para que recepción pueda atender escaladas.

### Tareas
- [ ] A1: Input de envío en `/inbox` — textarea + botón enviar → llama `enviar-mensaje-humano`
- [ ] A2: Filtro "escaladas" activo por default en `/inbox`
- [ ] A3: Badge en sidebar cuando hay conversaciones escaladas sin resolver
- [ ] A4: Marcar conversación como resuelta (status = 'cerrada')
- [ ] A5: Realtime updates en inbox (Supabase Realtime suscripción)

**Criterio de completitud:** Recepcionista puede ver conversación escalada → responder → marcar resuelta, sin salir del dashboard.

---

## Fase B — Página /recordatorios (Prioridad ALTA, ~1 sesión)

**Objetivo:** Vista comprehensiva de todos los recordatorios del sistema.

### Tareas
- [ ] B1: Ruta `/recordatorios` + componente base
- [ ] B2: Tabla con filtros: status (pendiente/enviado/fallido), tipo (T-24h/T-2h/manual), fecha
- [ ] B3: Acción reintentar en recordatorios fallidos
- [ ] B4: Link a detalle de cita desde cada recordatorio
- [ ] B5: Agregar `/recordatorios` al sidebar

**Criterio:** Admin puede ver qué recordatorios fallaron y reintentarlos.

---

## Fase C — Polish Mobile/Responsive (Prioridad MEDIA, ~2 sesiones)

**Objetivo:** App usable en móvil (recepción usa iPhone durante el día).

### Tareas
- [ ] C1: Auditar todas las rutas a 375px, 768px, 1024px (screenshots con agent-browser)
- [ ] C2: Corregir POS/Farmacia — cambiar `lg:grid-cols-*` → `xl:grid-cols-*`
- [ ] C3: Nav pestañas inferiores en móvil (rutas: /, /agenda, /inbox, /pacientes)
- [ ] C4: Tablas → cards apiladas en móvil para /pacientes, /expedientes, /recordatorios
- [ ] C5: Formularios — 1 columna en móvil, labels encima de inputs
- [ ] C6: Agenda semanal — scroll horizontal en móvil

**Criterio:** Las 5 rutas principales se ven y funcionan en iPhone 13.

---

## Fase D — Empty States y Skeleton Loaders (Prioridad MEDIA, ~1 sesión)

### Tareas
- [ ] D1: Skeleton en cada tabla/lista mientras carga React Query
- [ ] D2: Empty state en /agenda, /pacientes, /inbox, /recordatorios, /farmacia
- [ ] D3: Error boundary para fallo de conexión a Supabase

**Criterio:** App nunca muestra pantalla en blanco ni loader genérico.

---

## Fase E — Dark Mode Revisado (Prioridad MEDIA, ~1 sesión)

### Tareas
- [ ] E1: Auditar inconsistencias de color dark/light en cada ruta
- [ ] E2: Unificar según paleta del Brief UI/UX (doc 04)
- [ ] E3: Toggle dark/light en /configuracion

---

## Fase F — Edge Functions al Repo (Prioridad ALTA para producción)

**Por qué:** Las Edge Functions están en `C:\Users\pablo\supabase\functions\` fuera del repo. Imposible versionarlas, imposible CI/CD.

### Tareas
- [ ] F1: Mover functions a `clinica-mexico-spa/supabase/functions/`
- [ ] F2: Verificar `supabase/config.toml` incluye las funciones
- [ ] F3: `git add supabase/functions/` → commit → push
- [ ] F4: Verificar que Supabase puede deployar desde el repo (no romper deploy existente)

**Criterio:** `git clone + supabase functions deploy` reproduce el entorno completo.

---

## Fase G — Migrations Versionadas (Prioridad ALTA para producción)

### Tareas
- [ ] G1: `supabase db pull` para capturar schema actual si hay drift
- [ ] G2: Verificar que todas las migrations en `supabase/migrations/` reflejan la DB real
- [ ] G3: Documentar qué migrations son de Lovable (nombre raro) vs. manuales
- [ ] G4: Agregar `supabase/migrations/` a checklist de PR

**Criterio:** `supabase db push` sobre DB vacía reproduce el schema completo.

---

## Fase H — CLAUDE.md para Futuras Sesiones

### Tareas
- [ ] H1: Crear `clinica-mexico-spa/CLAUDE.md` con:
  - Stack resumido (copiar TRD)
  - ADRs críticos (timezone, webhook auth)
  - Lecciones aprendidas (de MEMORY.md)
  - Workflow git (copiar SYNC_WORKFLOW.md resumen)
  - Comandos frecuentes (build, deploy functions)

**Criterio:** Nueva sesión de Claude Code arranca con contexto completo sin leer PROJECT_PLAN.md completo.

---

## Fase I — Tests E2E (Prioridad MEDIA/ALTA)

### Tareas
- [ ] I1: Instalar Playwright
- [ ] I2: Test: flujo de login
- [ ] I3: Test: crear cita manual (happy path)
- [ ] I4: Test: inbox — ver conversación escalada
- [ ] I5: Test: farmacia — registrar venta

**Criterio:** `npx playwright test` verde en todos los flujos críticos.

---

## Fase J — CI/CD GitHub Actions (Prioridad BAJA para demo, ALTA para producción)

### Tareas
- [ ] J1: Workflow `deploy-functions.yml` — on push to main → `supabase functions deploy`
- [ ] J2: Workflow `lint-and-type-check.yml` — tsc + eslint en PRs
- [ ] J3: Secretos GitHub: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID

---

## Fase K — Producción Hardening

### Tareas
- [ ] K1: Rate limiting en Edge Functions (prevenir spam al bot)
- [ ] K2: Revisar RLS de todas las tablas con security-reviewer
- [ ] K3: Audit log activo en operaciones críticas (cancelar cita, corte caja)
- [ ] K4: Dominio propio + SSL
- [ ] K5: Monitoring de Edge Functions (Supabase dashboard + alertas)

---

## Prioridad Actual (próxima sesión)

```
1. Fase A — Inbox completo (impacto inmediato en demo)
2. Fase B — /recordatorios (complementa A)
3. Fase F — Edge Functions al repo (antes de producción)
```

---

## Criterio de "Demo Estable"

- [ ] Bot Telegram agenda citas de principio a fin
- [ ] Recordatorios T-24h y T-2h funcionan
- [ ] Recepción puede responder desde inbox
- [ ] /agenda, /pacientes, /recepcion funcionan en desktop
- [ ] Farmacia: venta básica + corte de caja
- [ ] Sin pantallas en blanco ni errores JS en consola
- [ ] Funciona en iPhone (al menos las 3 rutas más usadas)

## Criterio de "Producción"

Todo lo anterior + Fases F, G, H, I, J, K completas.
