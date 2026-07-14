---
name: session-sync
description: Use when starting or ending a work session on clinica-mexico-spa, to keep memoria/STATE.md, git commits, and graphify-out in sync without re-exploring the repo from scratch.
---

# session-sync

## Al iniciar sesión (2 reads, nada más)
1. Read `memoria/STATE.md`
2. Read la nota más reciente en `memoria/diario/`

No correr `git status`, `graphify query` ni explorar código todavía — STATE.md ya dice qué falta. Si algo en STATE.md contradice lo que se descubre después, arreglar STATE.md, no ignorarlo.

## Al cerrar sesión (checklist, en este orden)
1. `git status` — ¿hay cambios sin commitear que STATE.md no menciona? Decidir commit u omitir explícitamente.
2. `git log origin/main..HEAD --oneline` — ¿hay commits locales sin push? Confirmar con Pablo antes de pushear (dispara deploy Cloudflare vía GitHub Actions).
3. Si se tocó código: `graphify update .` (AST-only, sin costo de API) para que `graphify-out/` no quede desincronizado.
4. Actualizar `memoria/STATE.md`: mover completados a su sección, dejar solo pendientes reales. No dejar pendientes ya resueltos (pasó en sesión 41: push y `docs/app` ya resueltos pero STATE.md seguía diciendo "pendiente").
5. Commitear `memoria/STATE.md` + `CLAUDE.md` si cambiaron.

## Red flags — señal de desincronización
- STATE.md dice "pendiente" algo que `git log` ya muestra resuelto.
- `graphify-out/graph.json` más viejo que el último commit que tocó `src/`.
- Commits locales sin push por más de una sesión sin motivo documentado en STATE.md.

## No hacer
- No correr `graphify query`/`explain` al iniciar sesión "para revisar" — cuesta tokens y STATE.md + diario ya traen el contexto necesario.
- No dejar `graphify-out/cache/` fuera de `.gitignore` — ver commit `1363eb6` (298k líneas de cache coladas por accidente, revertido con `git reset --soft`).
