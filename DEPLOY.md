# Deployment Guide — Vercel + Cloudflare

## Architecture Overview

The application is deployed across two platforms:

- **Main SaaS (`integrika.mx`)**: Cloudflare Workers + Cloudflare Pages
- **Loyalty PWA (`loyalty.integrika.mx`)**: Vercel (Node.js edge runtime)

The loyalty PWA (`src/pwa/`) is embedded within the main Vite application at `src/pwa/`. Both are served from the same build output, but Vercel routes traffic based on the domain.

## Vercel Deployment (Loyalty PWA)

### Prerequisites

- Vercel account with access to the project
- Supabase project credentials (anon key only)
- Domain `loyalty.integrika.mx` configured in your DNS provider

### Configuration

The deployment is configured via `vercel.json` at the project root:

```json
{
  "buildCommand": "bun run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Environment Variables

Set the following environment variables in the Vercel dashboard:
**Settings → Environment Variables → Production**

| Variable | Value | Source |
|----------|-------|--------|
| `VITE_SUPABASE_URL` | `https://kyfkvdyxpvpiacyymldc.supabase.co` | Supabase Dashboard |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key | Supabase Dashboard → Settings → API Keys |

**CRITICAL**: Only use the **anon key** (public), never the service role key.

### Domain Setup

Configure the custom domain `loyalty.integrika.mx` in Vercel:

1. In Vercel dashboard: **Settings → Domains → Add → loyalty.integrika.mx**
2. Vercel will provide a CNAME target (typically `cname.vercel-dns.com`)
3. In your DNS provider (GoDaddy, etc.), add:

```
CNAME    loyalty    cname.vercel-dns.com
```

Wait for DNS propagation (5-10 minutes).

### Deployment Steps

#### Initial Deployment

```bash
cd C:\Users\pablo\clinica-mexico-spa
bun run build
vercel --prod
```

Follow the CLI prompts to link to the Vercel project.

#### Continuous Deployment

Push to the `feat/loyalty-module-etapa1` branch:

```bash
git add .
git commit -m "feat: loyalty PWA updates"
git push origin feat/loyalty-module-etapa1
```

Vercel will automatically build and deploy preview environments. Merge to `main` for production deployment.

### Build Output

The build creates:
- `dist/index.html` — main app entry point
- `dist/loyalty-manifest.json` — PWA web manifest
- `dist/icons/loyalty-192.png` — PWA icon (192x192)
- `dist/assets/*` — bundled JS/CSS with long cache headers

### Cache Headers

Static assets are cached indefinitely:
- `/assets/*` — `max-age=31536000, immutable`
- `/icons/*` — `max-age=31536000, immutable`

The main `index.html` is never cached to ensure users get the latest app version.

### Security Headers

The following headers are set on all responses:

- `X-Frame-Options: DENY` — prevent clickjacking
- `X-Content-Type-Options: nosniff` — prevent MIME type sniffing
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — restrict sensitive APIs

### Analytics

Optional: Enable Vercel Analytics for PWA performance monitoring:

```bash
bun add @vercel/analytics
```

Import in `src/pwa/LoyaltyApp.tsx`:

```tsx
import { Analytics } from '@vercel/analytics/react'

export function LoyaltyApp() {
  return (
    <>
      <AppContent />
      <Analytics />
    </>
  )
}
```

## Monitoring & Troubleshooting

### Check Deployment Status

```bash
vercel projects list
vercel deployments --prod
```

### View Logs

```bash
vercel logs --prod --tail
```

### Test PWA Install

1. Navigate to `https://loyalty.integrika.mx`
2. Open DevTools → Application → Manifest
3. Verify manifest.json loads correctly
4. Install app button should appear on mobile

### Common Issues

**Issue**: "VITE_SUPABASE_URL is not defined"
- **Solution**: Verify environment variables are set in Vercel dashboard. Redeploy.

**Issue**: "404 on /loyalty-manifest.json"
- **Solution**: Ensure `public/loyalty-manifest.json` exists and is served. Check `vercel.json` routes.

**Issue**: "Domain not resolving"
- **Solution**: Wait for DNS propagation (up to 10 minutes). Verify CNAME record is correct.

## Cloudflare Workers (Main SaaS)

The main `integrika.mx` deployment uses Cloudflare Workers:

```bash
wrangler deploy
```

Configuration: `wrangler.toml`

See `CLAUDE.md` for Lovable security fixes and secret management.

## Updating Dependencies

Both deployments use the same `package.json`. To update:

```bash
bun install
bun run build:all
git add bun.lock bun.lockb
git commit -m "chore: update dependencies"
git push origin feat/loyalty-module-etapa1
```

Vercel will automatically rebuild on push.
