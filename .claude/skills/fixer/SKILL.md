---
name: fixer
description: Use when fixing any bug, failing test, error, regression, or "no funciona" report in clinica-mexico-spa — before proposing or writing any fix. Also use when another session, model, or person claims something is already fixed ("ya quedó", "ya está arreglado") and you need to verify it. Triggers - bug report, test rojo, pantalla en blanco, bot de Telegram muerto, Edge Function que no responde, deploy que no se refleja en integrika.mx.
---

# Fixer — cómo se arregla un bug en ESTE proyecto

Flujo obligatorio, en orden. Ningún paso se salta.

## 1. Reproducir primero

Haz que el bug falle frente a ti ANTES de tocar código. Si no puedes reproducirlo,
todavía no entiendes el bug — sigue investigando, no "arregles" a ciegas.

Cómo reproducir según el tipo de bug:

| Tipo de bug | Comando de reproducción |
|---|---|
| Test que falla | `npx vitest run <ruta/al/archivo.test.ts>` — el archivo exacto, no toda la suite |
| Bug de UI local | `npm run dev` y navegar al flujo (requiere `.env` con las 3 vars `VITE_SUPABASE_*` — ver `.claude/project-context.md`) |
| Bug solo en producción (pantalla en blanco, /pitch, etc.) | `npm run build:all && npm run preview` — hay bugs que SOLO aparecen en build minificado (`vite dev` no los muestra, ej. doble copia de framer-motion) |
| Error de tipos | `npx tsc -p tsconfig.app.json --noEmit` (mismo comando que CI) |
| Edge Function | Invocarla de verdad: desde SQL con `net.http_post(...)` y leer `net._http_response` (columnas `status_code`, `content` — NO `status`), o `mcp__supabase__get_logs` |
| Bot de Telegram | Mandar el mensaje real al bot y ver `mcp__supabase__get_logs` del proyecto `kyfkvdyxpvpiacyymldc` |

## 2. Causa raíz, no síntoma

Pregunta "¿por qué?" hacia atrás hasta llegar al código que DECIDE, no al que muestra
el error. El stack trace apunta donde explotó, no donde se rompió.

Antes de editar, grep de todos los llamadores de la función que vas a tocar
(`Grep` sobre `src/` y `supabase/functions/`). El fix va donde todos los caminos
convergen, no en el camino que menciona el reporte.

Trampas conocidas de este proyecto (revisar CLAUDE.md completo, pero las que más
disfrazan la causa raíz):

- Edge Functions: `console.log` NO aparece en ningún log del Dashboard. Un `catch {}`
  vacío o un `(async()=>{})()` fire-and-forget se ve como "no pasa nada" — Deno mata
  el trabajo al retornar el handler. Buscar esos patrones antes de culpar a otra cosa.
- PostgREST: filtros embedded de 2 niveles devuelven `[]` vacío SIN error.
- Telegram: Markdown malformado en valores dinámicos silencia al bot sin error visible.
  Siempre `telegramSendMessage()` (reintenta como texto plano).
- Schema drift: columnas asumidas con nombre incorrecto (`apellidos`, `motivo_consulta`,
  `prescription_number`...) — verificar contra `src/integrations/supabase/types.ts`.
- Site en blanco tras merge de Lovable = casi siempre secrets `VITE_*` faltantes en
  GitHub Actions, no código. Ver "Lovable Security Fix Protocol" en CLAUDE.md.
- Tests de páginas: todo componente que usa `useNavigate()`/`useLocation()` debe
  renderizarse envuelto en `<MemoryRouter>`. Error
  `useNavigate() may be used only in the context of a <Router>` = wrapper faltante
  en el TEST, no bug del componente.
- `getByPlaceholderText`/`getByText` que no encuentra un elemento suele ser drift
  test↔componente (el componente cambió y el test quedó viejo, ej. campo "Código
  único" eliminado del wizard de AdminTenants, Jul 2026). Verificar los
  placeholders/textos ACTUALES en el componente antes de asumir bug de UI.
- Regresión de animaciones/pantalla en blanco: `npm ls framer-motion` debe mostrar
  UNA sola copia (la interna de `motion`). Dos copias = bug solo-minificado.

## 3. Arreglo mínimo

El diff más corto que corrige la causa raíz. Sin refactors oportunistas, sin
"ya que estamos aquí". Si viste algo más roto, repórtalo aparte — no lo mezcles
en el mismo cambio.

## 4. Probar con evidencia

"Debería funcionar" está PROHIBIDO. Correr el caso exacto que fallaba en el paso 1
y pegar el output real en el reporte:

```powershell
# El caso que fallaba (mismo comando del paso 1):
npx vitest run src/pages/AdminTenants.test.tsx

# Salud general del proyecto (los 3, mismo criterio que CI "Quality checks"):
npx tsc -p tsconfig.app.json --noEmit
npm run lint
npm run test
```

Verificación por capa cuando el bug no es de tests:

- **Producción web**: después del deploy, abrir `https://integrika.mx` de verdad.
  Logs del Worker: `wrangler tail clinica-mexico-spa --format pretty`.
  Errores de browser en prod: Sentry + BetterStack.
- **CI**: `gh run list --repo integricia-arch/clinica-mexico-spa --limit 5` y
  confirmar `success` en "Quality checks" y "Deploy to Cloudflare Workers".
- **Edge Functions**: cambio desplegado (`supabase functions deploy <nombre>`) Y
  commiteado — git debe espejear lo desplegado. Re-invocar y ver respuesta real.
- **Migraciones**: `supabase db push --linked` (SQL complejo siempre via
  `--file _tmp_*.sql`, nunca inline) y después
  `mcp__supabase__get_advisors(type="security")`.

## 5. Regla contra el "ya quedó"

Si otro modelo, una sesión anterior, un STATE.md o una persona dice que algo "ya está
arreglado": pedir/buscar la evidencia (output del comando, run de CI en verde, fila en
la DB). Sin output que lo demuestre, se trata como NO arreglado y se vuelve al paso 1.
Un commit con mensaje `fix:` no es evidencia; el comando corriendo en verde sí.

## 6. Reporte fiel

- Si la prueba pasa: pegar el output que lo demuestra.
- Si la prueba falla: decirlo con el output COMPLETO del error, sin suavizar.
  "Casi pasa", "falla por otra cosa no relacionada" — eso también se reporta.
- Actualizar `memoria/STATE.md` y `memoria/diario/YYYY-MM-DD.md` antes de cerrar
  (regla del proyecto, ver CLAUDE.md).

## Excusas que invalidan el trabajo

| Excusa | Realidad |
|---|---|
| "Es un cambio trivial, no necesita test" | `npx vitest run <archivo>` tarda segundos. Córrelo. |
| "El test pasaba en mi cabeza / debería pasar" | Prohibido. Output o no está arreglado. |
| "La sesión anterior dijo que ya quedó" | Sin output, no quedó. Paso 5. |
| "No puedo reproducirlo pero ya sé qué es" | No lo entiendes todavía. Paso 1. |
| "Aprovecho para limpiar este código de paso" | Refactor oportunista. Diff mínimo. Paso 3. |
| "vite dev funciona, con eso basta" | Hay bugs solo-de-build-minificado en este proyecto. `build:all` + preview. |
