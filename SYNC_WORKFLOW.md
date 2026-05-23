# Workflow de Sincronización Lovable ↔ Local

**Repo:** `github.com/integricia-arch/clinica-mexico-spa` (main)
**Carpeta local:** `C:\Users\pablo\clinica-mexico-spa`

---

## La regla de oro

> **Lovable auto-commitea cuando alguien usa su web UI. Si trabajas también local, SIEMPRE pull antes de empezar y push al terminar.**

No editar el mismo archivo simultáneamente en ambos lados. Si dudas, abre solo uno.

---

## Caso A: Sesión 100% en Lovable web (lo que vas a hacer ahora)

Tú solo abres lovable.dev y trabajas ahí. Lovable hace los commits automáticamente al repo.

**No necesitas tocar nada local.** Pero al final del día, si quieres tener una copia actualizada:

```powershell
cd C:\Users\pablo\clinica-mexico-spa
git fetch origin
git pull --rebase origin main
```

---

## Caso B: Sesión local con Claude Code

```powershell
# AL EMPEZAR — siempre
cd C:\Users\pablo\clinica-mexico-spa
git fetch origin
git status
# Si dice "Your branch is behind", hacer:
git pull --rebase origin main

# … trabajar …

# AL TERMINAR — siempre
git status
git diff --stat
git add <archivos-reales>
git commit -m "feat/fix/refactor(scope): descripción"
git push
```

**Si el push es rechazado** (Lovable commiteó mientras trabajabas):

```powershell
git stash --include-untracked   # solo si tienes cambios sin commit
git pull --rebase origin main
git stash pop                    # si stasheaste
# Resuelve conflictos si los hay (ver abajo)
git push
```

---

## Resolver conflictos de rebase

Si tras `git pull --rebase` git te dice "CONFLICT":

```powershell
# 1. Ver qué archivos están en conflicto
git status

# 2. Abre cada archivo en VSCode
# Busca los marcadores:
#   <<<<<<< HEAD
#   tu versión
#   =======
#   versión de Lovable
#   >>>>>>> commit-hash
# Decide cuál queda. Borra los marcadores.

# 3. Marca cada archivo como resuelto
git add ruta/al/archivo.tsx

# 4. Continúa el rebase
git rebase --continue

# 5. Repite hasta que termine. Luego:
git push
```

**Si te traba:** `git rebase --abort` te devuelve al estado previo sin perder tu commit local.

---

## Checklist antes de cada push importante

```powershell
# ¿Mi código compila?
npm run build

# ¿Estoy pusheando solo lo que quería?
git diff --stat --cached

# ¿Hay archivos en staging que NO deberían estar?
# (logs, .env, artefactos, .claude/, supabase/.temp/)
git status

# ¿Estoy en main?
git branch --show-current
```

---

## Convenciones de commit

Formato: `tipo(scope): descripción breve`

| Tipo | Cuándo |
|---|---|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `refactor` | Cambio de estructura sin cambiar comportamiento |
| `chore` | Tareas de mantenimiento, deps, configs |
| `docs` | Solo documentación |
| `style` | Cambios visuales sin lógica |

Ejemplos buenos:
- `feat(inbox): agregar input de envío para conversaciones escaladas`
- `fix(timezone): corregir slots calculados en UTC vs México`
- `refactor(reminders): unificar a recordatorios_cita`

---

## Archivos que NUNCA deben commitearse

Ya están en `.gitignore`:
- `.claude/settings.local.json`
- `supabase/.temp/`
- `AUDITORIA_*.txt`
- `auditar_*.ps1`
- `node_modules/`, `dist/`, `.env`

Si por accidente alguno entra al staging:
```powershell
git restore --staged <archivo>
```

---

## Si todo se descompone

Punto de seguridad: tienes el último push limpio en `a55ef42`.

```powershell
# Volver al último estado conocido sin perder el trabajo
git stash --include-untracked   # respalda lo que no quieres perder
git reset --hard origin/main    # vuelve al estado del remoto
# Trabajo respaldado en stash, puedes recuperar partes con `git stash pop`
```
