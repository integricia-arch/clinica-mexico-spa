# 02 — TRD: Documento de Requisitos Técnicos

---

## Frontend

- **Framework:** Vite + React 18 + TypeScript
- **Estilos:** TailwindCSS v3 + shadcn/ui (Radix UI base)
- **Router:** react-router-dom v6
- **Data fetching:** @tanstack/react-query v5
- **Formularios:** react-hook-form + zod
- **Animaciones:** framer-motion
- **Fechas:** date-fns
- **Iconos:** lucide-react
- **Notificaciones:** sonner
- **Cliente DB:** supabase-js v2
- **Dev:** Lovable (web UI → auto-commit al repo)

## Backend

- **Plataforma:** Supabase
- **DB:** PostgreSQL (vía Supabase)
- **Edge Functions:** Deno (TypeScript)
- **Jobs:** pg_cron + pg_net (dentro de Postgres)
- **Realtime:** Supabase Realtime (websockets para inbox)

## Auth

- **Proveedor:** Supabase Auth
- **Métodos:** Email/password + Google OAuth (pendiente)
- **Roles:** `admin`, `receptionist`, `doctor`, `nurse`, `patient` (enum `app_role`)
- **RLS:** Row Level Security activo en todas las tablas
- **Webhook Telegram:** sin JWT, auth con `WEBHOOK_SECRET` propio (header `x-telegram-bot-api-secret-token`)
- **`enviar-mensaje-humano`:** CON JWT (llamado desde frontend autenticado)

## Bot / IA

- **Modelo:** `claude-sonnet-4-6` (Anthropic)
- **Tool use:** Claude decide cuándo consultar disponibilidad, cuándo agendar, cuándo escalar
- **Canal:** Telegram Bot API
- **Timezone:** México fijo `-06:00` (sin DST desde 2022)

## Hosting / Despliegue

- **Frontend:** Lovable (hosting propio) → repo GitHub auto-sync
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **Repo:** `github.com/integricia-arch/clinica-mexico-spa` (branch `main`)
- **Local:** `C:\Users\pablo\clinica-mexico-spa`

## APIs y Servicios de Terceros

| Servicio | Propósito | Tier |
|---|---|---|
| Telegram Bot API | Canal de comunicación paciente↔bot | Gratis |
| Anthropic Claude | LLM del bot (tool use) | Pago por token |
| Supabase | DB + Auth + Edge Functions + Storage | Free tier / Pro |
| Lovable | Dev environment + hosting frontend | Pago |

## Estructura de Carpetas

```
clinica-mexico-spa/
├── src/
│   ├── components/     # Componentes reutilizables (shadcn + custom)
│   ├── pages/          # Una por ruta: Dashboard, Agenda, Pacientes...
│   ├── hooks/          # Custom hooks (useFieldErrors, useSidebarState...)
│   ├── lib/            # supabase.ts, utils.ts
│   ├── types/          # TypeScript types / interfaces
│   └── integrations/   # supabase/ (types auto-generados)
├── supabase/
│   ├── functions/      # Edge Functions (Deno)
│   └── migrations/     # SQL versionado
└── docs/               # Estos 6 documentos
```

## Variables de Entorno (Edge Secrets en Supabase)

```
TELEGRAM_BOT_TOKEN       # De @BotFather
ANTHROPIC_API_KEY        # console.anthropic.com
WEBHOOK_SECRET           # String aleatorio, verificación Telegram→webhook
SUPABASE_URL             # Auto en Edge Functions
SUPABASE_SERVICE_ROLE_KEY # Auto en Edge Functions
```

## Convenciones

- **Nombres de archivos:** PascalCase para componentes, camelCase para hooks/utils
- **Imports:** relativos dentro de `src/`, no path aliases complejos
- **Commits:** conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`)
- **No:** console.log en producción, mutación directa de estado, secrets hardcodeados

## Restricciones

- Debe funcionar bien en móvil (responsive, no app nativa)
- Debe funcionar sin conexión parcial (React Query cache)
- Timezone México siempre `-06:00` (no usar `America/Mexico_City` con DST)
- NUNCA editar el mismo archivo en Lovable web y local simultáneamente
- Edge Functions: siempre `await` en operaciones async, nunca IIFE fire-and-forget sin `EdgeRuntime.waitUntil`
