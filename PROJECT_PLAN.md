# ClínicaMX SaaS — Plan Maestro de Proyecto

> **Documento vivo.** Actualizar al final de cada sesión importante.
> **Owner:** Pablo · **Stack:** Lovable + Supabase + Telegram

---

## 1. Estado actual del sistema

### Backend (Supabase) — 100% operativo

| Componente | Estado | Notas |
|---|---|---|
| `telegram-webhook` (Edge Function v6) | ✅ Deployada | Bot atiende Telegram, agenda citas, escala a humano |
| `enviar-recordatorios` (Edge Function v2) | ✅ Deployada | Despacha vía Telegram, lee de `recordatorios_cita` |
| `enviar-mensaje-humano` (Edge Function) | ✅ Deployada | Para que recepción responda al paciente desde dashboard |
| pg_cron `enviar-recordatorios-5min` | ✅ Activo | Procesa pendientes cada 5 min |
| Schema BD | ✅ Unificado | Solo `recordatorios_cita`; `reminders` eliminada |

### Frontend (Lovable repo) — ~70% completo

Rutas activas:
- `/` AdminDashboard
- `/pacientes` PacientesLista
- `/agenda` AgendaMedico (vista semanal)
- `/nueva-cita` NuevaCita
- `/cita/:id` DetalleCita ← **refactorizado a `recordatorios_cita`**
- `/recepcion` RecepcionDashboard
- `/facturacion` Facturacion
- `/expedientes` Expedientes
- `/farmacia` Farmacia
- `/configuracion` Configuracion
- `/auditoria` Auditoria
- `/inbox` Inbox ← **80% — falta input de envío + filtro escaladas por default**

Páginas pendientes (priorizadas):
- `/recordatorios` — vista comprehensiva (alta prioridad)
- Polish mobile/dark mode/empty states (media)
- `/citas` consolidada (baja, redundante con `/agenda` y `/recepcion`)

### Sincronización
- Repo: `github.com/integricia-arch/clinica-mexico-spa` (branch `main`)
- Último commit local pusheado: `a55ef42` (refactor reminders → recordatorios_cita)
- Lovable auto-commitea cuando se usa su web UI
- Edge Functions todavía fuera del repo (`C:\Users\pablo\supabase\functions\`) — **pendiente mover dentro**

---

## 2. Arquitectura general

```
                    ┌────────────────────┐
                    │   Pacientes        │
                    │   (Telegram)       │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │  telegram-webhook  │
                    │  (Edge Function)   │
                    │  • Agendar cita    │
                    │  • Escalar humano  │
                    └─────────┬──────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
       ┌─────────┐    ┌──────────────┐   ┌─────────────────┐
       │appoint- │    │ recordatorios│   │ conversaciones  │
       │ ments   │    │ _cita        │   │ + mensajes      │
       └────┬────┘    └──────┬───────┘   └────────┬────────┘
            │                │                    │
            │         ┌──────▼────────┐           │
            │         │ pg_cron (5min)│           │
            │         └──────┬────────┘           │
            │                │                    │
            │         ┌──────▼─────────┐          │
            │         │enviar-record-  │          │
            │         │ atorios        │──────────┼────► Telegram API
            │         └────────────────┘          │
            │                                     │
            ▼                                     ▼
       ┌────────────────────────────────────────────┐
       │    Frontend Lovable (Dashboard)            │
       │  /agenda  /recepcion  /inbox  /cita/:id    │
       │  /pacientes  /recordatorios (pendiente)    │
       └─────────────────────┬──────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ enviar-mensaje-humano│
                  │   (recepción ──► paciente)
                  └──────────────────────┘
```

---

## 3. Stack tecnológico

**Frontend:** Vite, React 18, TypeScript, TailwindCSS v3, shadcn/ui, react-router-dom v6, @tanstack/react-query v5, supabase-js v2, react-hook-form + zod, date-fns, framer-motion, lucide-react, sonner.

**Backend:** Supabase (PostgreSQL + Edge Functions Deno), pg_cron, pg_net.

**Bot:** Anthropic Claude Sonnet 4.6 (model `claude-sonnet-4-6`) con tool use.

**Integraciones:** Telegram Bot API.

---

## 4. Roadmap a demo estable

### Fase A — Funcionalidad core (donde estamos)
- [x] Bot Telegram agenda citas
- [x] Recordatorios automáticos T-24h y T-2h
- [x] Schema unificado (recordatorios_cita)
- [x] DetalleCita.tsx refactorizado
- [ ] Inbox: input de envío + filtro escaladas + badge sidebar
- [ ] Página /recordatorios

### Fase B — Polish para demo
- [ ] Mobile responsive
- [ ] Empty states
- [ ] Skeleton loaders
- [ ] Dark mode revisado
- [ ] Animaciones suaves (framer-motion)

### Fase C — Producción
- [ ] Mover Edge Functions al repo
- [ ] Migrations versionadas con `supabase db pull`
- [ ] CLAUDE.md para futuras sesiones de Claude Code
- [ ] Tests end-to-end (Playwright o similar)
- [ ] CI/CD para deploy automático de Edge Functions desde GitHub Actions

---

## 5. Workflow de sincronización

**Ver `SYNC_WORKFLOW.md` para detalle.** Resumen:

- Trabajo en **Lovable web** → Lovable maneja git
- Trabajo en **Claude Code local** → pull antes, commit+push después
- **NUNCA** editar el mismo archivo en ambos lados simultáneamente
- Lovable se demora 30-60s en reflejar pushes externos

---

## 6. Decisiones técnicas registradas

### ADR-001: Unificación de tablas de recordatorios → `recordatorios_cita`
**Fecha:** 2026-05-20
**Decisión:** Mantener `recordatorios_cita` (con FK a `identidades_canal` para soportar multi-canal vía relación), eliminar `reminders`.
**Razón:** `recordatorios_cita` tiene mejor modelo de datos (identidad explícita por canal). El sistema end-to-end ya funciona sobre esta tabla. `reminders` era un schema preliminar no conectado a despacho real.

### ADR-002: Timezone México fijo en `-06:00`
**Fecha:** 2026-05-20
**Decisión:** Hardcodear offset `-06:00` en `telegram-webhook` para slots y formato.
**Razón:** México no usa DST desde 2022. Offset fijo simplifica el código vs. usar zona horaria nombrada.

### ADR-003: `--no-verify-jwt` en webhook de Telegram
**Fecha:** 2026-05-19
**Decisión:** Edge Function de webhook deployada sin verificación JWT, auth vía `WEBHOOK_SECRET` propio.
**Razón:** Telegram no envía Bearer JWT. La auth se hace a nivel aplicación con `x-telegram-bot-api-secret-token`.

### ADR-004: `enviar-mensaje-humano` CON JWT
**Fecha:** 2026-05-20
**Decisión:** Esta sí verifica JWT del usuario logueado.
**Razón:** Se llama desde el frontend autenticado. Sin JWT, cualquiera podría suplantar a recepción.

---

## 7. Secrets requeridos (Supabase Edge Secrets)

| Secret | Para qué | Notas |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | API de Telegram | Obtener de @BotFather |
| `ANTHROPIC_API_KEY` | LLM del bot | console.anthropic.com |
| `WEBHOOK_SECRET` | Auth Telegram → webhook | Genera string aleatorio |
| `CRON_SECRET` | Auth cron → procesador | Opcional, no usado actualmente |
| `SUPABASE_URL` | Cliente JS | Se setea solo |
| `SUPABASE_SERVICE_ROLE_KEY` | Cliente JS con privilegios | Se setea solo |

---

## 8. Glosario

| Término | Definición |
|---|---|
| `identidad_canal` | Una "identidad" del paciente en un canal específico (Telegram chat_id, WhatsApp number, etc.). Un paciente puede tener múltiples. |
| `conversación` | Hilo de mensajes entre paciente y bot. Tiene status: activa, escalada, cerrada. |
| Escalada | Cuando el bot transfiere control a recepción (humano). |
| Recordatorio T-24h | Mensaje automático 24 horas antes de la cita. |
| Recordatorio T-2h | Mensaje automático 2 horas antes de la cita. |
| Recordatorio manual | Creado por recepción desde DetalleCita.tsx. Tipo libre. |
