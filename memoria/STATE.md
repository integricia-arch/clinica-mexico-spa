# Estado del Proyecto — clinica-mexico-spa

## Fase actual
Producción activa — desarrollo iterativo de features de caja/farmacia

## Completado (Jul 3-4, 2026 — sesión 12/13 — Almacén catálogo unificado + fix OC/Compras — MERGEADO A MAIN)

### Plan Almacén catálogo unificado — COMPLETO ✅ Y MERGEADO (PR #15)
Chips "Bajo stock"/"Por caducar" + dropdown "Reportes y control" en `AlmacenTabs.tsx`,
buscador tolerante a acentos/typos (`busquedaTolerante.ts`), prop `quickFilter` en
`CatalogoMedicamentos.tsx`. 4/4 tasks, TDD. Detalle: `.superpowers/sdd/progress.md`,
plan en `docs/superpowers/plans/2026-07-03-almacen-catalogo-unificado.md` (`7d568fb`).

### Fix Compras/Almacén — COMPLETO ✅ Y MERGEADO (PR #16)
Reportado por el usuario: OC creada desde Almacén > Reorden no se veía bien en
Compras. Root cause real (systematic-debugging): `medicamentos.nombre_generico`
**no existe** como columna (la real es `nombre`, confirmado vía
`information_schema.columns`) — 9 archivos la usaban, fallando en silencio
(catch vacío / sin manejo de error): `OrdenesCompra.tsx` (items nunca cargaban,
"Cargando productos…" infinito), `RecepcionMercancia.tsx`, `ActasMerma.tsx`
(dropdowns vacíos), `ThreeWayMatchPanel.tsx`, `ReporteCOFEPRIS.tsx`,
`ReporteRotacionABC.tsx`, `useInventarioCiclico.ts`, `useRecepcionesMercancia.ts`,
`useOrdenesCompra.ts`. Corregido en los 9 (commit `d8c276e`).
Bug secundario también corregido: `PuntoReorden.tsx` generaba OCs con precio $0
(sin costo de referencia) y sin forma de editarlas después — ahora el diálogo
permite editar precio por producto y bloquea "Crear OC borrador" si falta precio
(commit `47ff715`). Se verificó y borró de prod una OC-0001 basura ($0, 32 items)
generada por este bug antes del fix.
Se revisaron las demás tablas de Compras/Almacén contra el schema real — sin más
drift de columnas.

### Merge a main — HECHO ✅
- PR #15 y #16 mergeados a `main` (admin merge, bypass de checks).
- **CI typecheck sigue roto en main, pero por errores PREEXISTENTES no relacionados**
  a estos cambios: `ExpedienteElectronico.tsx`, `VincularTelegram.tsx`,
  `configuracion/CaminoPaciente.tsx`, `configuracion/ConfiguracionCFDI.tsx`,
  `configuracion/ConfiguracionNotificaciones.tsx`, `pwa/hooks/useLoyaltyPWA.ts`
  — todos con queries a tablas/columnas no reconocidas por `types.ts` (mismo
  patrón de schema drift, pero en otro módulo). **No investigado a fondo por
  costo de sesión ($57+)** — queda como pendiente.
- Vercel deploy también falló (`multiple-function-regions`) — pinta a config de
  infra, no revisado.
- Branches remotos `feat/almacen-catalogo-unificado` y `fix/reorden-oc-precio-cero`
  ya borrados (merge con `--delete-branch`).

### CI typecheck roto — CERRADO ✅ (sesión 14)
`npx tsc --noEmit -p tsconfig.app.json` → 0 errores. `npm run build` → OK (solo
warnings preexistentes de chunk size / dynamic import, no bloqueantes).

- Regenerado `src/integrations/supabase/types.ts` vía `mcp__supabase__generate_typescript_types`
  → resolvió solo por esto: `VincularTelegram.tsx`, `configuracion/ConfiguracionCFDI.tsx`,
  `configuracion/ConfiguracionNotificaciones.tsx`, `configuracion/CaminoPaciente.tsx`
  (las 4 tablas sospechosas `staff_identidades_canal`, `staff_link_codes`,
  `antecedentes_clinicos`, `notification_rules` sí existían en DB, solo faltaban
  en el types.ts viejo).
- `ExpedienteElectronico.tsx`: bug real de código (no de types) — usaba
  `useAuth().activeClinicId`, pero ese campo vive en `useActiveClinic()`. Corregido
  el hook usado.
- Regenerar types **destapó errores nuevos** que antes quedaban ocultos por el
  types.ts viejo/laxo:
  - `pwa/hooks/useLoyaltyPWA.ts`: tenía cast anti-patrón `.from('loyalty_members' as never)`
    (prohibido explícitamente en este CLAUDE.md) — ahora que `loyalty_members` está
    bien tipada, el cast rompía. Se sacó el `as never`.
  - `features/enfermeria/EntregaTurno.tsx`: cast directo `Json[] as EntregaDB[]`
    en `pacientes_json`/`pendientes_json` (columnas jsonb genéricas) — TS exige pasar
    por `unknown` primero. Fix: `as unknown as EntregaDB[]`.
  - `features/lealtad/hooks/useLoyaltyMember.ts`: mismo patrón de cast directo sin
    `unknown` en `normalizeMember`, `registerSale`, `redeem` (3 sitios) — fix con
    `as unknown as X`.
  - `features/lealtad/LoyaltyMiembros.tsx`: 2 errores TS2554 (argument count) —
    `MemberDrawer` llamaba `useLoyaltyMember()` sin el arg `clinicId` requerido
    (fix: `useLoyaltyMember(null)`, `getMovimientos` no usa clinicId internamente);
    y `loadMembers` pasaba `searchMembers(q, activeClinicId)` con 2 args cuando
    `search(query)` solo toma 1 (clinicId ya viene cerrado del hook).

### Pendientes reales para próxima sesión
1. **Verificación manual en browser** de los fixes de Compras/Almacén (PR #15+#16,
   ya mergeados) — nunca se pudo hacer, login bloqueado por regla de seguridad.
   Usuario debe confirmar en `integrika.mx`.
2. Vercel `multiple-function-regions` — no investigado.
3. Commitear + pushear el fix de typecheck (types.ts regenerado + 5 archivos) —
   sesión 14 dejó cambios sin commitear, ver `git status`.

## Completado (Jul 3, 2026 — sesión 10 — Sentry DSN cerrado + spec Almacén catálogo unificado)

### Sentry DSN — CERRADO ✅ (pendiente #1 de sesión 9)
- [x] `VITE_SENTRY_DSN` seteado como GitHub secret por el usuario (`gh secret set`), verificado con `gh secret list`.
- [x] `VITE_SENTRY_DSN` agregado a `.env` local por el usuario vía `Read-Host -AsSecureString` (valor nunca expuesto en chat ni en historial). Duplicado detectado y limpiado (línea vieja sin comillas + línea nueva con comillas → quedó 1 sola línea).
- [x] Commit `f3f80ae` pusheado.

### Smoke test Almacén — CERRADO ✅ (pendiente #2 de sesión 9)
- [x] Usuario logueó manualmente en `integrika.mx/almacen` — confirmó que carga bien.

### Spec: Almacén — Catálogo unificado + buscador tolerante — ESCRITO, NO implementado
Usuario pidió (tras el smoke test) simplificar UX de Almacén: sacar "ruido"
de 9 pestañas en una fila, hacer Catálogo la vista prominente por default,
reducir clicks pa' tareas frecuentes, buscador que ignore acentos y tolere
typos.

- [x] Brainstorming completo (superpowers:brainstorming) + validación con frontend-design skill (aplicado como principios UX, NO paleta/tipografía nueva — es app interna con sistema Tailwind/shadcn ya establecido).
- [x] Confirmado: accesos a Almacén desde Caja/Farmacia YA están limpios (sesión 9) — sin acción.
- [x] Spec escrito y pusheado: `docs/superpowers/specs/2026-07-03-almacen-catalogo-unificado-design.md` (`216c0b9`).
  - Diseño: `AlmacenTabs.tsx` — Catálogo por default + 2 chips filtro rápido ("Bajo stock", "Por caducar", reusan cálculos ya existentes) + dropdown "Reportes y control" agrupando las 7 pestañas restantes (Faltantes, Conteos, COFEPRIS, ABC, Mermas, Reorden, Controlados).
  - `CatalogoMedicamentos.tsx`: prop nueva `quickFilter`, buscador normalizado (sin acentos, NFD) + tolerancia a 1 typo (Levenshtein liviano, palabras >4 letras) en archivo nuevo `src/features/almacen/lib/busquedaTolerante.ts`.
  - Ningún componente interno (FaltantesPanel, CaducidadesPanel, etc.) cambia lógica — solo el "chrome" de navegación.
- [ ] **Pendiente próxima sesión**: escribir el plan de implementación (`superpowers:writing-plans`, TDD, tests antes de código como pidió el usuario) a partir del spec ya aprobado, y ejecutarlo. Sesión cortada acá por costo ($51+, marcado crítico por el sistema) — spec está listo, solo falta plan + ejecución.

## Completado (Jul 3, 2026 — sesión 9 — pipeline visual Compras IMPLEMENTADO + mergeado + pusheado)

### Pipeline visual del ciclo de Compras + KPIs Inteligencia — COMPLETO ✅
Pedido del usuario: vista gráfica de en qué paso está cada trámite de compra
y quién es responsable de un atraso, + llevar esas métricas al módulo de
Inteligencia/BI como KPIs de operación.

- [x] Spec: `docs/superpowers/specs/2026-07-03-pipeline-visual-compras-design.md` (`a6d5d3e`)
- [x] Plan: `docs/superpowers/plans/2026-07-03-pipeline-visual-compras.md` (`671dbd6`)
- [x] Ejecutado vía `subagent-driven-development` en worktree `pipeline-visual-compras` (harness-owned, ya limpiado): 5 tasks, cada una con implementer + reviewer, todas Approved.
  - Task 1: `src/hooks/usePipelineCompras.ts` + tests (17 casos) — `8d70a9c`
  - Task 2: `src/features/compras/pipelineConstants.ts` — `e000997`
  - Task 3: kanban `PipelineCompras.tsx` + tab "Pipeline" en `ComprasTabs.tsx` — `4067eec`
  - Task 4: tab "Compras" en `BI.tsx` (ranking cuellos de botella por rol) — `1b4cb37`
  - Task 5: verificación final (86/86 tests, tsc limpio, build limpio)
- [x] **Bug real encontrado en review final del branch (Important, corregido)**: etapa `recepcion` medía días-en-etapa desde `aprobada_at` (aprobación de OC) en vez de `fecha_recepcion` — inflaba artificialmente el flag `atrasado` y sesgaba el ranking de cuellos de botella. Copy-paste error heredado del plan, no del implementer. Fix + test cobertura: `0204750`.
- [x] Merge fast-forward a `main` + push a `origin/main` — HEAD `2f7f826`.
- [x] Sin migración de BD nueva — todo se deriva client-side de `v_ciclo_compras`.
- Nota: "responsable" es un ROL (compras/gerencia/almacén/finanzas), no una persona — no existe campo de comprador asignado en BD. Documentado como limitación aceptada en el spec.

### Backlog UX — validado con research, NO implementado
Usuario preguntó si el kanban debería ser el único punto de entrada desde el
que se abren todas las ventanas (reemplazar tabs CRUD de Compras). Research
(Mursa/Zoobbe kanban-vs-list 2026, Pencil&Paper/Eleken navigation patterns):
forzar un solo entry point es anti-patrón (reduce agencia, mal en mobile,
mal pa' bulk-actions/búsqueda). Recomendación: NO reemplazar tabs — dejar
kanban como capa de monitoreo/triage (dialog de detalle ya es read-only) y
agregar botón "Ir a esta cotización/orden/factura" en el dialog que salte a
la tab CRUD correspondiente (patrón puente tipo Salesforce Path). Decisión
del usuario: **queda en backlog**, no se implementa esta sesión.

### Sentry logs estructurados — COMPLETO ✅
- [x] `src/instrument.ts`: `enableLogs: true` + `Sentry.consoleLoggingIntegration({ levels: ["log","warn","error"] })` — commiteado y pusheado (`2f7f826`)
- [x] `VITE_SENTRY_DSN` seteado como GitHub secret (`gh secret set`, usuario) — verificado con `gh secret list`.
- [x] `VITE_SENTRY_DSN` agregado a `.env` local (usuario, vía `Read-Host -AsSecureString` para no exponer el valor) — Sentry ya activo en dev local y CI.

## Completado (Jul 2, 2026 — sesión 7 — módulo Almacén implementado + gap trazabilidad Compras)

### Módulo Almacén — separado de Farmacia — MERGEADO + PUSHEADO ✅ (Jul 3, sesión 9)
- Spec: `docs/superpowers/specs/2026-07-02-modulo-almacen-separado-design.md`
- Plan: `docs/superpowers/plans/2026-07-02-modulo-almacen-separado.md`
- [x] 5 tasks ejecutadas vía subagent-driven-development en worktree `worktree-almacen-modulo`: scaffold 6/9 vistas + ruta/nav, extraer FaltantesPanel, CaducidadesPanel, CatalogoMedicamentos (la grande, con dialogs), quitar tab Inventario de `Farmacia.tsx` (1116→79 líneas)
- [x] Review final de branch completo: aprobado, 1 fix cosmético aplicado (header duplicado en tab Catálogo)
- [x] **Merge a main (Jul 3, sesión 9)**: merge real (no FF, main había divergido con pipeline compras) — `git merge-tree` confirmó 0 conflictos, 0 archivos solapados entre ambos branches. Merge commit + push a `origin/main` → `e74de31`.
- [x] Re-verificado post-merge sobre main: `tsc --noEmit` limpio, `npx vitest run` 86/86, `npm run build` limpio (solo warnings preexistentes de code-splitting no relacionados).
- [x] Branch `worktree-almacen-modulo` borrado (ya mergeado).
- [ ] **Pendiente**: carpeta `.claude/worktrees/almacen-modulo` no se pudo borrar (`git worktree remove` falló con "Invalid argument") — queda huérfana en disco, no bloquea nada, borrar a mano cuando se pueda (`git worktree prune` después de borrar la carpeta manualmente, o reintentar `git worktree remove --force` en sesión nueva).
- [x] **Smoke test visual — CERRADO (sesión 10)**: usuario logueó manualmente en `integrika.mx/almacen`, confirmó que carga bien. A partir de ese smoke test surgió pedido de UX (ver spec "Catálogo unificado" arriba, sesión 10).

### Sentry logging — ver sección arriba (sesión 9) — ya commiteado y pusheado

### Gap de trazabilidad Compras — RESUELTO (Jul 2, sesión 8, verificado)
Usuario reportó: "no está ligada la cotización a la orden de compra desde la solicitud hasta la recepción".

- [x] Mapa visual generado (artifact) confirmando: TODA la cadena Solicitud→Cotización→OC→Recepción→Factura/CxP→Pago está ligada por FK real.
- [x] **Verificación final**: las 3 migraciones `20260709000001/000002/000003_ciclo_compras_*` YA están aplicadas en remoto (confirmado con `mcp__supabase__list_migrations`).
- [x] **Nombres de columna confirmados sin mismatch**: `cotizaciones.solicitud_compra_id` y `cotizaciones.orden_compra_id` existen en BD (`information_schema.columns`) y coinciden exactamente con lo que ya usa el frontend (`src/hooks/useCotizaciones.ts`). La sospecha de mismatch (`solicitud_id` vs `solicitud_compra_id`) era falsa alarma — el fix ya había sido aplicado en `20260709000003_ciclo_compras_view_trigger_fixes.sql`.
- [x] `ordenes_compra.cotizacion_id` existe en BD (FK a `cotizaciones`), confirmado.
- [x] Vista `v_ciclo_compras` existe en remoto, confirmado.
- [x] **No requiere ningún cambio adicional de frontend ni migración nueva** — cadena completa ya ligada por FK real de punta a punta.

## Completado (Jul 2, 2026 — sesión 5 — cache Cloudflare + Supabase GitHub integration + scoping Almacén)

### Purge cache Cloudflare — RESUELTO (Jul 2, sesión 6)
- [x] Paso "Purge Cloudflare edge cache (index.html)" en `.github/workflows/deploy-cloudflare.yml`, commit `c42015a`, pusheado a main
- [x] Causa raíz real: `CLOUDFLARE_API_TOKEN` se usaba para 2 steps con permisos distintos (deploy=Workers Edit, purge=Cache Purge) — el token "clinica-mexico-spa build token" nunca guardó el permiso Cache Purge pese a 3 intentos de edición manual (confirmado en dashboard: solo tenía `Account.AI Search, Account.Connectivity Directory`)
- [x] Fix: separado en 2 secrets. `CLOUDFLARE_API_TOKEN` (rolled "Edit Cloudflare Workers") para deploy, `CLOUDFLARE_CACHE_PURGE_TOKEN` (token nuevo dedicado, solo Zone→Cache Purge→Purge) para el purge. Workflow editado (commit `e80f1fe`) para que el step de purge lea `CLOUDFLARE_CACHE_PURGE_TOKEN`
- [x] Verificado: run `28602521802` → `status=completed conclusion=success`
- Nota: token "Cloudflare Agent Token - 2026-07-02" (scopes Pages+Browser Rendering) NO se usa en ningún workflow/repo del org — se roleó sin querer durante esta sesión pero no afecta nada (confirmado con búsqueda en los 4 repos del org)

### Supabase ↔ GitHub integration — conectada, sin probar aún
- [x] Usuario conectó el repo `integricia-arch/clinica-mexico-spa` (branch `main`) en Supabase dashboard → Integrations → GitHub
- [x] Verificado: las 145 migraciones locales (`supabase/migrations/`) coinciden 1:1 con `list_migrations` remoto — DB al día, pero por `supabase db push --linked` manual en sesiones previas, NO por esta integración (recién conectada, nunca probada)
- [ ] **Pendiente**: probar con el próximo push a `main` que incluya un archivo nuevo en `supabase/migrations/` — confirmar en el dashboard de Supabase (Database → Migrations o log de la integración) que se aplica solo, sin correr `supabase db push` manual

### Módulo Almacén — separar de Caja/Farmacia (mismo patrón que Compras) — SOLO SCOPING, no iniciado
- Objetivo acordado con usuario: sacar el tab completo "Inventario" de `Farmacia.tsx` a módulo propio `/almacen`, igual que se hizo con Compras (`docs/superpowers/plans/2026-07-01-modulo-compras-separado-design.md`)
- **Hallazgo de alcance** (Jul 2, sesión 5): a diferencia de Compras (que ya eran componentes en archivos separados, solo `git mv`), el tab Inventario mezcla:
  - Ya son componentes propios en `src/features/farmacia/`: `InventarioCiclico.tsx` (conteos), `ReporteCOFEPRIS.tsx`, `ReporteRotacionABC.tsx`, mermas (`ActasMerma.tsx`)
  - **JSX inline dentro de `Farmacia.tsx`** (~líneas 429-953, sin extraer a componente): vistas `catalogo`, `faltantes`, `caducidades`, `reorden`, `controlados`
  - `inventarioView` state (línea 96) controla las 9 sub-vistas: `catalogo | faltantes | caducidades | conteos | cofepris | abc | mermas | reorden | controlados`
- **Trabajo real requerido**: extraer las 5 vistas inline a componentes propios en `src/features/almacen/` ANTES de poder armar la ruta `/almacen` — no es un simple `git mv` como Compras, es refactor real de ~500 líneas
- [ ] **Decisión del usuario (Jul 2)**: pausar por hoy dado el costo de sesión ya alto — retomar en sesión dedicada. Próximo paso concreto: escribir plan detallado (spec + plan como se hizo para Compras) antes de tocar código, luego ejecutar extracción componente por componente

## Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind + shadcn/ui
- **Backend**: Supabase (proyecto: `kyfkvdyxpvpiacyymldc`)
- **Deploy**: Cloudflare Workers (`https://clinica-mexico-spa.integric-ia.workers.dev`)
- **Dominio**: `https://integrika.mx`

## Completado (Jul 1, 2026 — 3ra recurrencia bundle roto post-deploy módulo Compras)

Tras push del módulo Compras separado (`0b6f166`), `integrika.mx` volvió a servir `index-BgkOAiyU.js` (mismo bundle roto de la "Causa raíz #2" de esta misma fecha) pese a GH Actions en verde. Confirma que el bug de propagación del Worker vía Action sigue sin causa raíz identificada — 2da recurrencia el mismo día.

- [x] Diagnóstico: `curl integrika.mx` mostraba `index-BgkOAiyU.js` en vez del bundle recién generado
- [x] Fix manual aplicado (mismo procedimiento documentado arriba): `npm run build:all` + `wrangler deploy` → bundle `index-BVlEO0rm.js`, Version ID `994b723c-fe40-4d49-9f3a-13dbbfeff589`
- [x] Verificado con `curl` cache-bust — usuario confirmó "ya carga bien"
- [x] **Sigue pendiente investigar causa raíz** del deploy-via-Action que no propaga (2 recurrencias mismo día) — comparar `wrangler deploy` output del log del Action vs. manual
- [x] Investigación iniciada Jul 1 sesión 3, no completada (costo crítico $287 forzó parar). Revisado `.github/workflows/deploy-cloudflare.yml`: build corre `npm run build:all` con env vars correctas, deploy usa `cloudflare/wrangler-action@v3` (`wranglerVersion: 4.96.0`), nada obviamente roto en el YAML.

### Causa raíz #3 (encontrada Jul 2, 2026 sesión 4) — cache de borde Cloudflare, NO fallo de propagación del Worker
- [x] `gh run view 28556217949 --log` (run del push `0b6f166`, módulo Compras): confirma que el Action SÍ subió bundle nuevo `index-66MjT1if.js` y quedó **100% live** — `Current Version ID: aed9cc91-5c36-491c-aeaf-a1406c039ed3` a las 00:10:51. El Worker nunca falló en propagar.
- [x] Chequeo de headers de `https://integrika.mx/` → `CF-Cache-Status: HIT` pese a `Cache-Control: public, max-age=0, must-revalidate`. Cloudflare está ignorando la directiva de no-cache del origen y sirviendo `index.html` cacheado en el borde — por eso se veía el bundle JS viejo (hash antiguo referenciado en el HTML stale) aunque el deploy real ya estuviera correcto.
- [x] `npx wrangler deployments list` confirma que el "fix manual" (`994b723c`, 00:11:35) fue apenas 44s después del deploy del Action — no arregló nada de propagación, coincidió con el vencimiento/purge natural del cache del borde.
- **Diagnóstico**: revisar en Cloudflare dashboard → Caching → Configuration si "Origin Cache Control" está desactivado (causa que CF ignore el `Cache-Control` del Worker y use su propio Edge TTL) — pendiente que el usuario lo verifique/active, o agregar Cache Rule de bypass para `/` e `/index.html`.
- **Fix aplicado**: paso "Purge Cloudflare edge cache (index.html)" agregado a `.github/workflows/deploy-cloudflare.yml` tras el deploy — purga `https://integrika.mx/` e `index.html` vía API de Cloudflare (endpoint `purge_cache` de la zona), implementado con `node -e` y `fetch()` (evita `curl` por bloqueo del hook de seguridad local).
- [ ] **Pendiente del usuario**: agregar secret `CLOUDFLARE_ZONE_ID` en GitHub (Settings → Secrets → Actions) — sin él el paso de purge falla. Zone ID visible en el dashboard de Cloudflare, tab overview del dominio `integrika.mx` (no es secreto, se guarda como secret por consistencia).
- [ ] Verificar en el próximo deploy real que el paso de purge corre sin error y que no vuelve a aparecer el bug del bundle viejo.

## Completado (Jul 1, 2026 — módulo Compras separado de Caja/Farmacia)

Spec: `docs/superpowers/specs/2026-07-01-modulo-compras-separado-design.md`
Plan: `docs/superpowers/plans/2026-07-01-modulo-compras-separado.md`

- [x] 18 componentes de compras + `ComprasNavContext.tsx` movidos de `src/features/farmacia/` → `src/features/compras/` (`git mv`, historial preservado)
- [x] `src/pages/Compras.tsx` nueva — wrapper delgado, carga medicamentos activos, renderiza `ComprasTabs`
- [x] `Farmacia.tsx` — quitado tab "Compras" + imports muertos; `PuntoReorden`/`MedicamentoProveedoresPanel` ahora importados desde `@/features/compras/`
- [x] Ruta `/compras` en `App.tsx` — mismos roles que `/farmacia` (`admin,nurse,receptionist,cajero`), **sin** `TurnoGuard` (compras es back-office, no depende de turno de caja abierto)
- [x] Sidebar (`AppLayout.tsx`): item propio "Compras" (ícono `ShoppingCart`), separado de "Caja" (`/farmacia`); no agregado a `FOCUS_ROUTES`
- [x] `npm run build` limpio + `npx vitest run` 8/8 archivos, 68/68 tests
- [x] Smoke test Chrome: `/compras` responde igual que rutas protegidas (redirige a `/login` sin sesión, sin errores de consola)
- [ ] Pendiente: click-through logueado (visual) del sidebar + tabs de compras cargando datos reales — no hecho esta sesión
- 7 commits en `main`: `a165b2b` (mover archivos) → `f0a4460`/`2ad7b4b` (fix commit-hygiene) → `b081cdf` (Compras.tsx) → `c11f50f` (limpiar Farmacia.tsx) → `5e04783` (ruta) → `7e70763` (nav) → `ab6fcfe` (ledger scratch)

## Completado (Jul 1, 2026 — fix deploy roto integrika.mx)

- [x] Causa raíz #1: `package-lock.json` desincronizado (`react-barcode`, `jsbarcode` faltantes) → `npm ci` fallaba en GitHub Actions → deploy servía build viejo con bug de env vars → sitio en blanco.
- [x] `npm install` local regeneró lock (+20 líneas) → commit `d859759`
- [x] Merge con fix paralelo de Lovable (`types.ts`, `9ceaf0b`) → push `384df45`
- [x] Secrets GitHub Actions verificados OK: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- [x] Run "Deploy to Cloudflare Workers" verde (28553759744, 1m29s)

### Causa raíz #2 (recurrencia misma tarde) — GH Actions verde pero Cloudflare servía bundle viejo <!-- /aprende 2026-07-01 -->
- Tras el fix de arriba, el deploy automático reportó **success** pero `integrika.mx` seguía sirviendo `index-BgkOAiyU.js` (bundle roto), no el `index-Dq2K1e0h.js` generado por ese mismo run. El GH Action Worker deploy no se propagó al Worker real (causa exacta no confirmada — sospecha de deploy no efectivo del step `wrangler deploy` vía Action, no cache de Cloudflare).
- **Fix aplicado**: deploy manual local —
  ```powershell
  cd C:\Users\pablo\clinica-mexico-spa
  npm run build:all
  wrangler deploy
  ```
  Bundle nuevo `index-qEwn6MAY.js` confirmado sirviendo (`curl https://integrika.mx/` con cache-bust). Usuario confirmó "ya carga bien".
- **Pendiente para próxima sesión**: investigar por qué el step de deploy del workflow GH Actions no propaga al Worker aunque el job reporte success — revisar `wrangler deploy` output dentro del log del Action (`gh run view <id> --log`) comparando Version ID desplegado vs. el manual.

## Completado (Jul 2, 2026 — sesión 2026-07-02 — 4 pendientes de CxP/proveedores)

- [x] `supabase db push --linked --include-all` — 2 migrations aplicadas: `ordenes_compra_requiere_anticipo` + `cxp_bi_proveedores` (tablas `cxp_alertas`, `historial_clabe_proveedor`, triggers duplicado/límite crédito, 4 views KPI)
- [x] CxP alertas UI: `src/hooks/useCxpAlertas.ts` (pendientes/críticas/resolver) + `AlertasCxpPanel.tsx` (lista resolvable) montado en `FacturasProveedor.tsx` + badge count destructive en TabsTrigger "cxp" de `ComprasTabs.tsx`
- [x] Form proveedores enriquecido: `clasificacion_abc` (A/B/C), `cuenta_clabe`, `banco_nombre`, `limite_credito_centavos`, `dias_credito`, `descuento_pronto_pago_pct`, `dias_pronto_pago` — agregados a `useProveedores.ts` (Proveedor/ProveedorInput/toRow/toProveedor/EMPTY_PROVEEDOR_INPUT) + sección "Crédito y pronto pago (CxP)" en dialog de `ajustes/sections/inventario.tsx`
- [x] XML CFDI en recepción: `RecepcionMercancia.tsx` — botón "Subir XML factura" por recepción crea factura_proveedor provisional (subtotal/iva/total=0, linked a recepcion_id+orden_id) vía `useFacturasProveedor.create()`, luego monta `CfdiUploadPanel` existente para 4-way match / alerta anti-robo (cantidad facturada > recibida). Montos reales se completan después vía "Registrar CFDI real" (flujo `confirmarProvisional` ya existente en tab CxP).
- [x] `tsc --noEmit` = 0 errores · `npm run build` limpio (solo warnings preexistentes de code-splitting)

### Pendiente / siguiente sesión
- [x] Commit + push de los 4 items de esta sesión — `731feba` + `e4a64e1`
- [x] Columna "ABC" en tabla de proveedores de `inventario.tsx` — badge circular junto a RFC — `815e373`
- [ ] Verificar visualmente en navegador el flujo recepción→XML→CxP (no probado en browser esta sesión, solo tsc+build)

## Completado (Jun 24, 2026 — Farmacia Fidelización Etapa 1 — PLAN COMPLETO ✅)

Branch: `feat/loyalty-module-etapa1` → mergeada a `main` `2b4ad85` ✅
Plan: `docs/superpowers/plans/2026-06-24-farmacia-fidelizacion-etapa1.md`
Spec: `docs/superpowers/specs/2026-06-24-farmacia-fidelizacion-design.md`
Build: ✅ 5.96s | Tests: 57/57 | tsc: 0 errores | Review final: APPROVED

### Entregables
- [x] 6 migraciones SQL (000001–000006): tablas + RLS + RPCs SECURITY DEFINER + índices + UPDATE consent RLS
- [x] Design system: Geist + motion.ts spring presets (Emil Kowalski) + NivelCard shimmer Diamante
- [x] Hooks: `useLoyaltyMember` (search, register, registerSale, redeem) + `useLoyaltyConfig`
- [x] LoyaltyPanel POS: búsqueda/afiliación/canje en checkout
- [x] ModalAfiliacion: 3 consentimientos LFPDPPP activos (Art. 8 y Art. 9) — no pre-chequeados
- [x] Admin: LoyaltyConfig (kill switch + umbrales) + LoyaltyMiembros (sortable + drawer historial)
- [x] PWA `src/pwa/`: Phone OTP Supabase, Monedero virtual, barcode, lazy-loaded
- [x] Vercel: `vercel.json` + `DEPLOY.md` + `loyalty-manifest.json` → `loyalty.integrika.mx`
- [x] Edge Function `loyalty-welcome` (Resend welcome email, JWT protegido)
- [x] Teléfono normalizado a E.164 (+52XXXXXXXXXX) en registro y RLS
- [x] UPDATE RLS policy para revocación consent marketing (LFPDPPP derecho ARCO)

### Deuda Etapa 2 — COMPLETA ✅ (Jun 28, 2026 — feat/loyalty-etapa2)
- [x] `loyaltyDescuento` descuenta del total POS — `totalConLealtad`, ticket, RPC (`7da2391`)
- [x] Links ARCO en PWA — `/privacidad` y `/arco` en LoyaltyApp (`3c17dde`)
- [x] `register_sale` idempotency guard por `pharmacy_sale_id` (`6f43ed1`)
- [x] PWA icon: `public/icons/loyalty-192.png` + 512px generados con sharp (`ee80431`)

### Pendiente antes de producción
- [x] `supabase db push --linked` — migraciones 000004–000006 aplicadas ✅
- [ ] Configurar Twilio en Supabase Auth dashboard (externo)
- [x] Merge `feat/loyalty-module-etapa1` → `main` ✅
- [ ] Deploy Vercel `loyalty.integrika.mx` — pendiente token Vercel

---

## Completado (Jun 21-24, 2026 — auditoría DB — PLAN COMPLETO ✅)

Plan: `docs/superpowers/plans/2026-06-21-db-audit-corrections.md`
Ledger: `.superpowers/sdd/progress.md`
22 commits en main, rama lista para `supabase db push --linked`

### Fase 0 — RLS crítico
- [x] Task 0.1: Fix RLS `almacen_alertas` — `clinic_members`→`clinic_memberships`. `1e675dd`
- [x] Task 0.2: RLS en `profiles` + REVOKE UPDATE/SELECT `supervisor_pin_hash`. `366d40a`, `28c542f`, `0e0feb1`

### Fase 1 — Seguridad
- [x] Task 1.1: OAuth tokens `doctor_calendars` → Supabase Vault (RPCs SECURITY DEFINER, multi-clinic key). `126ec0c`
- [x] Task 1.2: Audit 9 edge functions con `verify_jwt=false` → `docs/edge-functions-auth.md`. `ad676f5`

### Fase 2 — Integridad de datos
- [x] Task 2.1: FK `clinic_id` ON DELETE RESTRICT en 11 tablas financieras. `bc2b0a4`
- [x] Task 2.2: CASCADE→RESTRICT en expedientes/appointments/consentimientos→patients (NOM-004). `02f56ff`
- [x] Task 2.3: Sync flags duplicados medicamentos (OR semántico + CHECK constraint). Drop columns en `scripts/` pendiente frontend refactor. `7686170`
- [x] Task 2.4: DROP DEFAULT UUID hardcodeado de 4 tablas farmacia. `103a072`
- [x] Task 2.5: UNIQUE INDEX CONCURRENTLY `movimientos(clinic_id, folio)`. `b45f7e1`

### Fase 3 — Higiene
- [x] Task 3.1: 36 archivos `_tmp_` movidos de `migrations/` → `scripts/diagnostics/`. `3fa9ca5`

### Fase 4 — Concurrencia
- [x] Task 4.1: Tabla contadores atómica `recetas_folio_contadores` reemplaza MAX()+1. `d32a42b`
- [x] Task 4.2: Pre-lock `lotes_medicamento ORDER BY id` en `pharmacy_register_sale` (+ FEFO tie-breaker `id ASC`). `b0b547d`, `c46406a`, `0e0feb1`
- [x] Task 4.3: Eliminar fallback UUID clinic_id → RAISE EXCEPTION. `78420e3`

### Fase 5 — Performance
- [x] Task 5.1: 9 índices faltantes CONCURRENTLY (FKs, `has_role` compound, GIN trgm FAQ). `009870e`
- [x] Task 5.2: Drop 4 índices duplicados CONCURRENTLY. `a12d43d`

### Fase 6 — Ops
- [x] Task 6.1: pg_cron jobs (cleanup bot hourly, VACUUM weekly). `6e1ded1`, `0e0feb1`
- [x] Task 6.2: Trigger `updated_at` en `profiles`. `f2f1908`

### Revisión final (HIGH findings corregidos)
- [x] REVOKE ALL en `next_receta_folio()` → solo `service_role`. `0e0feb1`
- [x] `google-calendar.ts`: empty string Vault guard + rotación `refresh_token`. `70c6768`

### `supabase db push --linked` — APLICADO ✅ (2026-06-21)
15 migrations audit aplicadas. Fixes aplicados en proceso:
- `CREATE POLICY IF NOT EXISTS` → DROP+CREATE
- `ADD CONSTRAINT IF NOT EXISTS` → DO blocks
- `CONCURRENTLY` removido (incompatible Supabase CLI)
- `20260602` corto movido a scripts/ (formato incompatible CLI)

### Pendiente manual (NO aplicar sin verificación previa)
- [x] **`supabase/scripts/migrate_doctor_tokens_to_vault.sql`** — APLICADO 2026-06-21 (1 fila migrada a Vault)
- [x] **`supabase/scripts/drop_plaintext_oauth_tokens_MANUAL.sql`** — APLICADO 2026-06-21 (`access_token`/`refresh_token` eliminados)
- [x] **Frontend refactor** — APLICADO 2026-06-21. `requiere_receta`/`controlado` → `requires_prescription`/`is_controlled` en 5 archivos. `types.ts` regenerado.
- [x] **`supabase/scripts/drop_legacy_flags_MANUAL_after_frontend_refactor.sql`** — APLICADO 2026-06-21. Columnas `requiere_receta`, `controlado`, `domicilio_ciudad` eliminadas de producción.
- [x] **`cfdi-parse` auth** — APLICADO 2026-06-21. JWT validado via `supabase.auth.getUser()`. Deployed.

---

## Completado (Jun 2026)

### Farmacia POS
- [x] Punto de Venta con carrito, catálogo, escáner
- [x] Cobro efectivo / tarjeta / transferencia / mixto / pendiente
- [x] Mixto auto-calc: efectivo ↔ tarjeta se calculan solos
- [x] Ticket interno con desglose IVA correcto (proporcional al descuento global)
- [x] Overflow fix: ticket no se sale de viewport
- [x] `forceMount` en TabsContent "pos" → carrito persiste al cambiar tab

### Corte de Caja
- [x] `cortes` tabla con folio SEQUENCE (`cortes_folio_seq`)
- [x] Corte Z (cierre turno farmacia) con conteo ciego
- [x] Corte X (parcial sin cerrar) con folio X-xxxxxx
- [x] Egresos/Ingresos del fondo (`fondos_movimientos`)
- [x] UI completa en CajaTurno.tsx (historial, diff badges, etc.)
- [x] RPCs: `turno_corte_x`, `turno_close`, `turno_fondo_movimiento`
- [x] **Ciclo pharmacy shift completo**: `pharmacy_open_shift` idempotente + `turno_close` cierra shift (Jun 10)
- [x] **IVA persistido**: `pharmacy_register_sale` guarda `total_iva`, `base_imponible`, `iva_amount` (Jun 10)

### Responsive (Jun 10)
- [x] Sidebar: `useSidebarState` hook, xl breakpoints, desktop collapse
- [x] POS: grid xl:3-col / md:2-col, frecuentes acordeón, sticky cobro, touch targets
- [x] Facturación: columnas lg→xl para tablet

### Modo Foco + Flujo Guiado (Jun 10)
- [x] `AppLayout`: sidebar auto-oculto en `/caja*` y `/farmacia*`; ☰ siempre visible en focus routes
- [x] `ProtectedRoute`: role-home redirect — cajero→/caja, nurse→/farmacia, manager→/caja
- [x] `TurnoGuard`: state machine loading→no-turno→open→closing; provee `useTurno()` context
- [x] `TurnoOpenWizard`: wizard full-screen selecciona caja→fondo→confirmar (abre turno+pharmacy_shift)
- [x] `TurnoCloseWizard`: wizard full-screen conteo ciego→diff→supervisor override→Corte Z
- [x] `Caja.tsx`: badge turno activo + botón "Cerrar turno" vía `initiateClose()`
- [x] `App.tsx`: `/caja` y `/farmacia` envueltos en `TurnoGuard`
- [x] `LockScreen.tsx`: pantalla de bloqueo con verificación de contraseña
- [x] User dropdown: Bloquear / Cambiar usuario / Cerrar sesión
- [x] `Farmacia.tsx` renombrada a "Caja" en UI; tab "Cierre" con CajaTurno + CorteTurno
- [x] Fix carga infinita en cajero: `clinicLoading` guard en TurnoGuard + clinic_membership insertado

### Auditoría
- [x] Tab "Farmacia / Caja" en Auditoría con logs técnicos
- [x] `pos_error_logs` + `audit_logs` filtrados por farmacia/caja

### Auth / UX global
- [x] `TOKEN_REFRESHED` e `INITIAL_SESSION` ya NO hacen `setLoading(true)` → páginas no desmontan al renovar JWT
- [x] Layout 3 paneles POS: sticky + `max-h-[calc(100vh-6rem)]` en los 3 paneles
- [x] `beforeunload` warning cuando hay carrito activo

## Completado (Jun 12, 2026 — sesión 4)

### Feature: crear citas desde admin
- [x] `NuevaCitaDialog`: búsqueda paciente (autocomplete debounce), select médico, fecha/hora, duración (default 30 min), servicio opcional, motivo opcional
- [x] `Agenda.tsx`: botón "Nueva cita" conectado, pre-llena fecha del día
- [x] `Citas.tsx`: botón "Nueva cita" en header
- [x] PR #4 mergeado (`375e937`), deploy `f5b463b1`

## Completado (Jun 12, 2026 — sesión 3)

### Bug fix: pharmacy PIN override
- [x] Nueva RPC `pharmacy_close_shift_with_pin`: verifica PIN bcrypt, valida rol, delega a `pharmacy_close_shift`
- [x] `SupervisorAuthDialog` modo pharmacy PIN path: usa `pharmacy_close_shift_with_pin`
- [x] PR #3 mergeado (`a8b5c69`), deploy `c4615a64`

## Completado (Jun 12, 2026 — sesión 2)

### Bug fix: autorizado_by
- [x] `turno_close`: `p_supervisor_id uuid DEFAULT NULL`; `autorizado_by = COALESCE(p_supervisor_id, v_user)`
- [x] `pharmacy_close_shift`: mismo fix
- [x] `turno_close_with_pin`: pasa `p_supervisor_id` al delegar
- [x] `SupervisorAuthDialog`: password-fallback pasa `p_supervisor_id`; pharmacy mode llama `pharmacy_close_shift`
- [x] PR #2 mergeado a main (`5ef9d6c`), deploy versión `246bfb1f`

## Completado (Jun 12, 2026)

### DB local SQL Server — schema sync
- [x] `medicamentos`: agregadas `clinic_id`, `is_controlled`, `sale_type`, `requires_prescription`, `requires_retained_prescription`, `requires_special_prescription`, `allow_direct_sale`, `regulatory_notes`, `barcode`, `sku`, `codigo_interno`, `laboratorio`, `presentacion`, `registro_sanitario`, `tasa_iva`
- [x] `lotes_medicamento`: agregadas `clinic_id`, `fecha_entrada`, `costo_unitario`
- [x] `movimientos_inventario`: agregadas `clinic_id`, `reference_type`, `reference_id`
- [x] Sync limpio: 51/51 medicamentos, 51/51 lotes, 61/61 movimientos — 0 errores

### Git / Deploy
- [x] PR #1 creado y mergeado a `main` (squash commit `4179e9d`)
- [x] `git pull origin main` — local al día
- [x] Deploy Cloudflare Workers versión `3ca00e63`

## Completado (Jun 11, 2026)

### Arqueo de caja — todos los GAPs (A–F)
- [x] GAP-F: Devoluciones efectivo antes del conteo ciego — `fondos_movimientos` ILIKE 'Reembolso%'
- [x] GAP-E: Fondo siguiente turno vs efectivo depósito — columnas + RPC `corte_set_fondo`
- [x] GAP-D: Acta de arqueo imprimible — `printActaArqueo.ts`, HTML autocontenido, window.print()
- [x] GAP-B: Conciliación tarjeta vs TPV — columnas + RPCs, `PagoReconcile metodo="tarjeta"`
- [x] GAP-C: Conciliación transferencias/SPEI — columnas + RPCs genéricos `get_corte_pago_total`
- [x] GAP-A: Denominaciones billetes/monedas — `DenominacionCounter.tsx`, sin DB
- [x] GAP-G: Verificado NOT a bug (RPCs filtran estado='pagado'/'completed' correctamente)

### Columnas nuevas en `cortes`
`fondo_siguiente_turno`, `efectivo_deposito`, `tarjeta_tpv_declarado`, `tarjeta_tpv_diferencia`, `transferencia_declarado`, `transferencia_diferencia`

### Plan farmacia-caja-trazabilidad (10 tareas — todas completas)
- [x] Nav menu con grupos Clínica / Operaciones / Admin
- [x] Página Caja.tsx unificada (Turno + Corte tabs)
- [x] Farmacia: eliminado tab "Corte de Caja"
- [x] Stock badges en PrescriptionEditorModal (`stockMap`)
- [x] Lista recetas pendientes en SurtirReceta (`pendingRx`)
- [x] `almacen_alertas` tabla + insert al emitir receta + resolve al surtir
- [x] Sub-tab "Faltantes" en Farmacia Inventario
- [x] `SectionCaja` en Ajustes: campo `umbral_diferencia` + `fondo_minimo` persistidos en `clinic_settings/caja`

### Supervisor PIN (plan 2026-06-11-supervisor-pin.md — COMPLETO)
- [x] Migration `_tmp_supervisor_pin.sql`: `profiles.supervisor_pin_hash`, RPCs `set_supervisor_pin`, `get_clinic_supervisors`, `turno_close_with_pin`
- [x] Componente `SupervisorAuthDialog` — PIN numérico o contraseña fallback
- [x] `TurnoCloseWizard.tsx` — reemplazado bloque inline por `SupervisorAuthDialog`
- [x] `CajaTurno.tsx` — reemplazado bloque inline por `SupervisorAuthDialog`
- [x] `ShiftPanel.tsx` — reemplazado bloque inline por `SupervisorAuthDialog`
- [x] `AdminUsuarios.tsx` — rol `manager` agregado, PIN obligatorio en creación admin/manager, diálogo Set PIN
- [x] Build limpio (commits: 59b3b71, bd85856, + 4 más → cfa9fd7)

## Completado (Jun 12, 2026 — sesión 5)

### Módulo CFDI + Pagos — Fase 1 (fundación)
- [x] Investigación formal CFDI 4.0, PACs y pasarelas de pago → `memoria/proyectos/cfdi-facturacion-electronica.md`
- [x] Migration `cfdi_y_pagos_fase1`: 6 tablas nuevas con RLS:
  - `cfdi_config` — emisor, CSD, PAC por clínica (UNIQUE clinic_id)
  - `cfdi_receptores` — datos fiscales de pacientes (RFC, régimen, CP)
  - `cfdi_documentos` — CFDI timbrados (UUID SAT, XML, PDF path, estados)
  - `cfdi_conceptos` — líneas de cada CFDI
  - `payment_gateway_config` — Stripe/Conekta por clínica (UNIQUE clinic_id)
  - `payment_transactions` — cobros procesados (card, oxxo, spei)
- [x] `ConfiguracionCFDI.tsx` (`/configuracion/facturacion`): form emisor, CSD, PAC + test conexión
- [x] `ConfiguracionPagos.tsx` (`/configuracion/pagos`): Stripe + métodos + terminal física
- [x] `Configuracion.tsx`: tarjetas "Facturación y CFDI" y "Cobros y pagos digitales" con ruta activa
- [x] `App.tsx`: rutas `/configuracion/facturacion` y `/configuracion/pagos` registradas
- [x] Deploy exitoso: `f9c0f33f`
- PAC recomendado: **Facturama** (sandbox: apisandbox.facturama.mx, REST/JSON, HTTP Basic)
- Pasarela recomendada: **Stripe** (3.6% + $3 MXN IVA incluido, SDK TS, Terminal física)

## Completado (Jun 12, 2026 — sesión 6)

### Módulo CFDI — Fase 2 (emisión real)
- [x] Edge function `cfdi-timbrar` desplegada (v1, ACTIVE) — timbre CFDI 4.0 vía Facturama API v3
- [x] Edge function `cfdi-download` desplegada (v1, ACTIVE) — descarga XML/PDF desde PAC o caché BD
- [x] `TimbrarCFDIDialog.tsx` — diálogo completo: búsqueda receptor, conceptos dinámicos, cálculo IVA, submit al edge function
- [x] `Facturacion.tsx` reescrito — datos reales desde `cfdi_documentos`, tabla paginada, búsqueda, descarga XML/PDF, copy UUID, botón "Nueva factura CFDI"
- [x] Deploy frontend versión `4a47d623`

## Completado (Jun 12, 2026 — sesión 6 cont.)

### Módulo CFDI — Fase 3
- [x] Migration: bucket `csd-files` (privado, RLS admin), cols `csd_cer_path`/`csd_key_path` en `cfdi_config`
- [x] Edge function `cfdi-cancelar` (v1, ACTIVE) — DELETE Facturama, 4 motivos SAT, UUID sustituto motivo 01, audit log
- [x] `Facturacion.tsx`: dropdown "Cancelar CFDI" + dialog con motivo + campo sustituto condicional
- [x] `ConfiguracionCFDI.tsx`: upload real .cer/.key a `csd-files/{clinic_id}/`, indicador archivo subido
- [x] Deploy `0806a0f5`

## Completado (Jun 13, 2026 — sesión 7)

### CFDI — Fases 4 y 5 (sesión anterior, actualizado aquí)
- [x] Edge function `cfdi-rep` v1 ACTIVE — Complemento de Pagos 2.0 (tipo P)
- [x] `cfdi-timbrar` v2 — soporte `InformacionGlobal` para Factura Global
- [x] `RegistrarPagoREPDialog.tsx` — diálogo REP en Facturacion.tsx
- [x] `FacturaGlobalDialog.tsx` — XAXX010101000 + periodicidad SAT
- [x] `cfdi-cancelar` v1 ACTIVE — cancelación 4 motivos SAT
- [x] Merge `feat/pos-criticos-iva-devoluciones` → `origin/main` (`81f2bec`)

### Stripe completo
- [x] `stripe-payment-intent` v1 ACTIVE + `stripe-webhook` v1 ACTIVE
- [x] `StripePaymentModal.tsx` en DetalleCita
- [x] `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` en Supabase Secrets
- [x] `payment_gateway_config` con `pk_live_` de producción
- [x] Webhook registrado en Stripe Dashboard

### Stripe checkout pitch
- [x] `stripe-checkout` edge function v1 ACTIVE (verify_jwt: false)
- [x] Pitch.tsx: botones "Suscribirme" → Stripe Hosted Checkout
- [x] Precios server-side: Esencial $2,499 / Profesional $5,999 MXN/mes

### Stripe en POS farmacia
- [x] `PuntoDeVenta.tsx`: botón "Cobrar con Stripe" (visible cuando método=tarjeta)
- [x] `handleStripeSuccess` pre-llena breakdown.card con paymentIntentId
- [x] `submitSale(bdOverride)` acepta breakdown override para flujo Stripe
- [x] Deploy `86446746` en integrika.mx

## Completado (Jun 13, 2026 — sesión 8)

### Fixes críticos post-revisión (commit `55abbdd`, deploy `94264420`)
- [x] **stripe-payment-intent**: `client_secret` eliminado de columna `metadata` en BD
- [x] **stripe-webhook**: HMAC constant-time (bitwise XOR en lugar de `===`)
- [x] **cfdi-cancelar**: `encodeURIComponent` en `cfdi_sustitucion` y `pac_id_externo`
- [x] **cfdi-download**: validar `format` (solo xml/pdf); verificar `clinic_id` del usuario vs CFDI
- [x] **cfdi-timbrar**: capturar error de query de roles → 500 en lugar de denegar silenciosamente
- [x] **PuntoDeVenta**: `itemsDiscount` multiplicado por `quantity`; `blocked`→`blockReason` en catálogo
- [x] **Agenda**: `.limit(3)` eliminado en fetch de doctores
- [x] **Farmacia**: validar que cantidad salida no exceda existencia antes de update
- [x] **CajaTurno**: `cajaNombre` via `cajas.find(caja_id)` en lugar de `turno.caja_nombre` (inexistente)
- [x] **DetalleCita**: AlertDialog de confirmación antes de cancelar cita
- [x] **LockScreen**: rate limiting — bloqueo 30s tras 3 intentos fallidos
- [x] Revisión completa → `docs/mejoras-correcciones.md` generado
- [x] **useAuth + useActiveClinic**: roles scoped a clínica activa via `setClinicRoles()` + `clinic_memberships.role`
- [x] **Farmacia inventario**: RPC `increment_lote_existencia` (atómico) + migración aplicada

## Completado (Jun 13, 2026 — sesión 9)

### Fixes ALTOS + MEDIOS post-revisión

#### Fixes 🟠 ALTO — commit `de4bcf9`
- [x] **stripe-payment-intent**: cap 500,000 MXN por transacción
- [x] **cfdi-cancelar**: clinic_id desde clinic_memberships (no del body)
- [x] **cfdi-rep**: IVA desde cfdi_conceptos real; CP receptor requerido
- [x] **useAuth**: signOut limpia localStorage.activeClinicId
- [x] **App.tsx**: /cita/:id con ProtectedRoute y roles
- [x] **AppLayout**: conversaciones filtradas por clinic_id activo
- [x] **Farmacia h1**: "Caja" → "Farmacia"
- [x] **RecepcionDashboard**: actualización inmutable (map en lugar de forEach+mutation)
- [x] **CajaTurno**: DIFF_EXCEEDS_THRESHOLD parse con Number.isFinite
- [x] **PaymentCapture**: monto_recibido en modo mixto sincronizado
- [x] **Agenda**: loadAppointments con useCallback; realtime sin stale closure
- [x] **NuevaCitaDialog**: defaultDatetime en useEffect; timezone -06:00 en submit

#### Fixes 🟡 MEDIO — commits `689193e`, `10e68a6`, `67427e9`
- [x] **stripe-webhook**: log warning cuando count===0; metadata merge en payment_failed
- [x] **cfdi-timbrar**: env var validation explícita; cfdi_conceptos error handling
- [x] **cfdi-rep**: validación aritmética SAT (saldo_anterior - monto ≈ saldo_insoluto)
- [x] **Citas.tsx**: statusMeta() fallback para estados desconocidos (no crash)
- [x] **Citas.tsx**: rangos de fecha con offset -06:00 (CDMX timezone)
- [x] **Login.tsx**: post-login respeta location.state.from (redirect a ruta original)
- [x] **ProtectedRoute**: pasa state={{ from }} al redirect a /login
- [x] **ConfiguracionCFDI**: select excluye pac_contrasena/csd_contrasena del browser
- [x] **PacientesLista**: búsqueda server-side con ilike+debounce; limit 100; count exact
- [x] **Farmacia loadAlertas**: useCallback([filtroAlertas]); elimina eslint-disable con loop oculto
- [x] **TicketInterno**: style de impresión via useEffect+cleanup (no acumula en DOM)
- [x] **Expedientes**: doctors cargados en mount; nota enriquecida con doctor real; cache siempre refresca

### Fixes 🟢 BAJO completados — commits `9aec1f7`, `e0b1ead`
- [x] **NuevaCitaDialog**: setSearching(false) en early return (spinner infinito al borrar)
- [x] **Inbox**: CANAL_META fallback ?? { label: canal_id } (no crash si canal nuevo)
- [x] **Recetas**: STATUS_LABELS fallback muestra status real (no "Emitida" para desconocidos)
- [x] **TicketInterno**: llama onClose() si open=true pero data=null
- [x] **AdminUsuarios**: fetchUsers con try/catch+finally (loading no queda true)
- [x] **PrescriptionEditorModal**: siempre actualiza diagnosis (permite limpiar)
- [x] **ErrorBoundary**: muestra error.message + botones "Recargar" y "Reintentar"
- [x] **Facturacion**: VITE_SUPABASE_URL con .replace(/\/$/, "")
- [x] **cfdi-cancelar/download/rep/stripe-payment-intent**: (r: any) → (r: { role: string })
- [x] **useAuth**: setTimeout(0) → queueMicrotask (más predecible)
- [x] **useActiveClinic**: catch (e: any) → catch (e: unknown)
- [x] **AppLayout**: eliminar isDesktop sin resize listener (variable no usada)
- [x] **PuntoDeVenta**: folio slice(0,8) → slice(0,12) (menos colisiones)
- [x] **CajaTurno**: CorteRow + turno_id; cortesData as CorteRow[] (no any[])
- [x] **DetalleCita**: RecordatorioCita interface; recordatorios state tipado
- [x] **cfdi-timbrar**: console.error sin JSON.stringify(facData) completo

### ALTOS diferidos — TODOS RESUELTOS (Jun 14 sesión 13)
- [x] **ConfiguracionCFDI**: Vault ya implementado — `cfdi-set-credentials` edge function + `pac_secret_id` en `cfdi_config`
- [x] **AdminUsuarios**: doctors insert tiene `clinic_id`; `toggle_role`/`set_base_password_all` scope vía `clinic_memberships`
- [x] **CajaTurno:719**: `(supabase as any).from("cortes")` → `restSelect()` (misma API que audit log)
- [x] **restClient.ts**: archivo limpio, no tiene `(supabase as any)` — falso positivo
- [x] **stripe-payment-intent**: ambiente check `sk_live_`/`rk_live_` vs `config.ambiente` ya implementado

### BAJOs diferidos — TODOS RESUELTOS O CLASIFICADOS (Jun 14 sesión 13)
- [x] **Farmacia**: forceMount en TabsContent "pos" — trade-off consciente, no tocar
- [x] **PuntoDeVenta**: "pendiente" bloqueado para meds controlados (commit 44f2c5c)
- [x] **Expedientes**: query string literal en restSelect — inherente al REST client, aceptado
- [x] **DetalleCita**: (supabase as any) para recordatorios_cita → restSelect (commit 44f2c5c)
- [x] **CorteTurno**: selected stale → fallback a list[0] (commit fc4bf95)

## Pendiente / Próximo

### Revisión completa del proyecto — FINALIZADA ✅
- [x] Agente revisor → `docs/mejoras-correcciones.md` (sesión 8)
- [x] Fixes 🔴 CRÍTICO — todos resueltos (sesión 8)
- [x] Fixes 🟠 ALTO — todos resueltos (sesión 13)
- [x] Fixes 🟡 MEDIO — todos resueltos (sesiones 9+13)
- [x] Fixes 🟢 BAJO — todos resueltos o clasificados trade-off (sesiones 9+13)
- [x] Reconciliación turnos generales (sesión 13)

### CFDI
- [x] Notas de crédito (tipo E) — commit c3e24fc
- [x] Acuse receptor en cancelación — commit f731c53

### Completado (Jun 14 sesión 11)
- [x] `prescriptions` + `prescription_items` + `patient_checkout_events` en prod
- [x] RPC `generate_prescription_number_for_doctor`
- [x] BetterStack: flush inmediato en errores + startup ping → verificado ✓
- [x] Cloudflare WAF: `not MX → Managed Challenge` + Bot Fight Mode
- [x] GitHub Actions: Node 24 opt-in (deadline Jun 16)
- [x] Documento E-R: `memoria/proyectos/er-sistema.md`

### Completado (Jun 14 sesión 13)
- [x] **ALTOS diferidos**: todos 5 verificados/resueltos (ver sección arriba)
- [x] **CajaTurno**: `(supabase as any).from("cortes")` eliminado → `restSelect()` con PostgREST `in.(...)` syntax
- [x] **Reconciliación turnos generales**: `get_corte_pago_total` extendido para incluir `movimiento_pagos` (tarjeta/transferencia SAT codes) además de pharmacy sales — `PagoReconcile` ahora funciona para cajas no-farmacia

### Completado (Jun 14 sesión 12)
- [x] `monitoring_alerts` tabla en Supabase — almacena incidents de BetterStack
- [x] GET `/health` agregado a `cfdi-timbrar`, `cfdi-email`, `telegram-webhook` → devuelven 200
- [x] 4 monitores DOWN eliminados y recreados apuntando a endpoints que devuelven 200:
  - Supabase REST → `/rest/v1/profiles?limit=1&select=id` + anon key
  - cfdi-timbrar → GET /functions/v1/cfdi-timbrar → 200
  - cfdi-email → GET /functions/v1/cfdi-email → 200
  - telegram-webhook → GET /functions/v1/telegram-webhook → 200
- [x] **Los 6 monitores BetterStack ahora están UP** (commit `6a8f2d8`)

## Completado (Jun 15, 2026 — sesión 16)

### Investigación formal: Almacén, Compras y Proveedores
- [x] Investigación formal almacén/compras/proveedores → `memoria/proyectos/investigacion-almacen-compras-proveedores.md`
  - Fuentes: NIF C-4, LIVA Art. 2-A, COFEPRIS, COSO, IIA, Odoo, SAP B1, Lightspeed, Square, Shopify
  - Cubre: catálogo productos, lotes/caducidades, medicamentos controlados, OC, 3-way match, proveedores, CxP, retenciones, EFOS/EDOS
- [x] Comparativa sistema actual vs. mejores prácticas → `memoria/proyectos/gaps-almacen-compras-proveedores.md`
  - 24 gaps identificados (3 críticos, 10 altos, 11 medios/bajos)
  - Plan de 5 fases de mejora documentado

### Fix crítico: IVA medicamentos
- [x] Migration `fix_medicamentos_tasa_iva_default_zero`: 13 medicamentos corregidos 16%→0% (Paracetamol, Ibuprofeno, Omeprazol, etc.)
- [x] `ALTER TABLE medicamentos ALTER COLUMN tasa_iva SET DEFAULT 0.00` — nuevos productos ya no heredan 16%
- [x] `PuntoDeVenta.tsx`: fallback `?? 0.16` → `?? 0` en 3 lugares (totalIva, baseGravable, exento)
- [x] `tsc --noEmit` = 0 errores confirmado

## Completado (Jun 15, 2026 — sesión 17) — Módulo Almacén/Compras/Proveedores COMPLETO

### Proveedores — Fase 1 ✅
- [x] Migration `enrich_proveedores_fiscal_fields`: 12 columnas nuevas (`rfc`, `regimen_fiscal`, `domicilio_fiscal`, `clabe`, `banco`, `terminos_pago`, `plazo_entrega`, `requiere_cofepris`, `clasificacion`, `estatus_efos`, `ultima_verificacion_efos`, `notas`)
- [x] Migration `add_costo_unitario_to_lotes`: `costo_unitario_centavos`, `proveedor_id` FK en `lotes_medicamento`
- [x] `src/hooks/useProveedores.ts` reescrito: interfaces extendidas, `EMPTY_PROVEEDOR_INPUT`, `marcarEfos()`
- [x] `src/pages/ajustes/sections/inventario.tsx`: tabla con RFC/clasificación/EFOS badge; Dialog form expandido (datos básicos, fiscales SAT, bancarios, condiciones comerciales, EFOS/COFEPRIS)

### Módulo Órdenes de Compra — Fase 2 ✅
- [x] Migration `create_ordenes_compra_module`: 4 tablas con RLS + 9 índices + triggers updated_at
  - `ordenes_compra` (folio OC-XXXX, estatus borrador→confirmada→parcial→recibida→cancelada)
  - `ordenes_compra_items` (cantidad_pedida, cantidad_recibida, precio, tasa_iva, subtotal)
  - `recepciones_mercancia` (folio REC-XXXX, vinculada a OC opcional, FEFO)
  - `recepciones_items` (lote, caducidad, número_lote obligatorio, diferencia_nota)
- [x] `src/hooks/useOrdenesCompra.ts`: CRUD + calcTotales + nextFolio + confirmar/cancelar + getItems
- [x] `src/hooks/useRecepcionesMercancia.ts`: create (con auto-update OC estatus) + verificar + getItems
- [x] `src/features/farmacia/OrdenesCompra.tsx`: lista acordeón + dialog nueva OC (proveedor, entrega, líneas dinámicas, totales)
- [x] `src/features/farmacia/RecepcionMercancia.tsx`: lista + dialog vinculado a OC (pre-pobla items, FEFO warning, lote obligatorio, diferencia_nota)
- [x] Tab "Compras" en `Farmacia.tsx` con sub-tabs: Órdenes de Compra | Recepción | CxP

### CxP — Fase 3 ✅
- [x] Migration `create_facturas_proveedor_pagos`: tablas `facturas_proveedor` + `pagos_proveedor` con RLS
  - UUID SAT indexado, estatus pendiente→parcial→pagada, saldo_pendiente_centavos calculado
  - `pagos_proveedor`: fecha_pago, monto, método (transferencia/cheque/efectivo/otro), referencia
- [x] `src/hooks/useFacturasProveedor.ts`: create + registrarPago (actualiza saldo+estatus) + getPagos + pendientes/vencidas
- [x] `src/features/farmacia/FacturasProveedor.tsx`: lista con alertas vencidas, filtros, dialog factura (UUID SAT con regex) + dialog pago

### Inventario Cíclico — Fase 4 ✅
- [x] Migration `create_inventario_ciclico_module`: tablas `conteos_inventario` + `conteos_items` con RLS
  - `diferencia` columna generada: `existencia_contada - existencia_sistema`
  - Tipos: ciclico/completo/aleatorio/turno
- [x] `src/hooks/useInventarioCiclico.ts`: iniciarConteo (carga lotes sin mostrar sistema) + registrarConteo + cerrarConteo + getItems
- [x] `src/features/farmacia/InventarioCiclico.tsx`: vista conteo activo (conteo ciego row-by-row, diff en tiempo real) + historial conteos
- [x] Sub-view "Conteos" en tab Inventario de Farmacia.tsx

### Conteo ciego apertura turno ✅
- [x] Migration `add_apertura_conteo_to_turnos`: columnas `conteo_apertura`, `fondo_esperado`, `diferencia_apertura` GENERATED en `turnos`
- [x] `TurnoOpenWizard.tsx` reescrito: flow select-caja → **conteo (ciego)** → **diff vs Z anterior** → confirm
  - Lookup automático de `fondo_siguiente_turno` del último corte Z de la caja
  - Muestra diferencia (verde/amarillo/rojo), alerta si |diff| > $100
  - Guarda `conteo_apertura` + `fondo_esperado` en `turnos`

### Reportes ✅
- [x] `src/features/farmacia/ReporteCOFEPRIS.tsx`: Libro de Control psicotrópicos/estupefacientes
  - Existencias por lote con registro sanitario, lote, caducidad
  - Movimientos del período (entradas/salidas)
  - Export CSV + imprimir · Art. 240 LGS
- [x] `src/features/farmacia/ReporteRotacionABC.tsx`: Clasificación ABC por ingresos (70/90/100%)
  - Rotación anual, días stock, tendencia (↑↓ o sin movimiento)
  - Alerta productos Clase A con < 14 días de stock
  - Export CSV
- [x] Sub-views "COFEPRIS" y "ABC / Rotación" en tab Inventario de Farmacia.tsx

### Estado final Farmacia.tsx — tab Inventario
Sub-views: **Catálogo | Caducidades | Faltantes | Conteos | COFEPRIS | ABC / Rotación**

### Estado final Farmacia.tsx — tab Compras
Sub-tabs: **Órdenes de Compra | Recepción de Mercancía | Cuentas por Pagar**

### tsc --noEmit = 0 errores en toda la sesión ✅

## Completado (Jun 15, 2026 — sesión 18)

### Denominaciones en apertura ✅
- [x] `DenominacionCounter` wired en paso "conteo" de TurnoOpenWizard
- [x] Input manual limpia breakdown; contador de denominaciones auto-rellena monto
- [x] `denominaciones_apertura` JSON guardado en `turnos` al abrir (null si no se usó)

### Aging CxP ✅
- [x] `src/features/farmacia/ReporteAgingCxP.tsx`: reporte de vencimientos por proveedor
  - KPI cards: por vencer / vencido / total CxP / pagado (período)
  - Stacked bar visual con 5 buckets (corriente, 1–30d, 31–60d, 61–90d, >90d)
  - Tabla aging por proveedor con saldos por bucket + plazo pactado + días pago real
  - "Días pago real" = avg(fecha_pago - fecha_factura) desde `pagos_proveedor` join
  - Color coding: verde si días real ≤ plazo, rojo si excede
- [x] Sub-tab "Aging / Vencimientos" en tab Compras de Farmacia.tsx
- [x] `tsc --noEmit` = 0 errores

### Estado final Farmacia.tsx — tab Compras
Sub-tabs: **Órdenes de Compra | Recepción de Mercancía | Cuentas por Pagar | Aging / Vencimientos**

## Completado (Jun 15, 2026 — sesión 19)

### uso_interno + merma en movimientos_inventario ✅
- [x] Migration `add_uso_interno_merma_to_movimiento_tipo`: enum extendido
- [x] Farmacia.tsx: select movimiento incluye "Uso interno" y "Merma"
- [x] Títulos dialog y toast actualizados para ambos tipos

### Flujo aprobación OC ✅
- [x] Migration `add_oc_approval_flow`: columnas `aprobada_by`, `aprobada_at`, `rechazada_motivo` en `ordenes_compra`
- [x] `useOrdenesCompra`: `aprobar()` + `rechazar()` + `getUmbral()` desde `clinic_settings/compras`
  - `create()`: si total > umbral → estatus `pendiente_aprobacion`; si no → `borrador`
- [x] `OrdenesCompra.tsx`:
  - Badge `pendiente_aprobacion` (amarillo) y `rechazada` (rojo)
  - Alerta visual en OC pendiente con mensaje COSO
  - Botones "Aprobar" + "Rechazar" visibles solo para admin/manager
  - Dialog rechazo con campo motivo
- [x] Ajustes › Inventario › "Config. Compras": umbral configurable (MXN), upsert en `clinic_settings`
- [x] `tsc --noEmit` = 0 errores

## Completado (Jun 15, 2026 — sesión 20)

### Actas de Merma ✅
- [x] Migration `create_actas_merma_module`: tablas `actas_merma` + `actas_merma_items` con RLS
- [x] RPC `firmar_acta_merma`: verifica PIN bcrypt, checa rol admin/manager, firma acta, decrementa `lotes_medicamento.existencia`, inserta `movimientos_inventario` tipo=merma
- [x] `src/hooks/useActasMerma.ts`: create, solicitarFirma, firmar (RPC), rechazar, getItems
- [x] `src/features/farmacia/ActasMerma.tsx`: lista acordeón, dialog nueva acta (líneas dinámicas con lote/costo auto-fill), dialog firma PIN supervisor, dialog rechazo
- [x] Sub-view "Mermas" en tab Inventario de Farmacia.tsx
- [x] `tsc --noEmit` = 0 errores · commit `e37915a` · deploy `4bfe3ace`

### Estado final Farmacia.tsx — tab Inventario
Sub-views: **Catálogo | Caducidades | Faltantes | Conteos | COFEPRIS | ABC / Rotación | Mermas**

## Completado (Jun 15, 2026 — sesión 21)

### Dashboard de Compras ✅
- [x] `src/features/farmacia/DashboardCompras.tsx`
  - KPI cards: OC del mes, pend. aprobación, CxP vencido, total CxP pendiente
  - Alertas inline: OC sin aprobar + facturas que vencen en ≤7 días
  - Gráfica barras: evolución compras últimas 8 semanas
  - Top 5 proveedores por monto total (barras horizontales)
  - Breakdown OC por estatus + últimas 5 órdenes recientes
  - Tabla facturas vencidas con días mora
  - Recepciones del mes con estatus
- [x] "Dashboard" como tab por defecto en Compras (antes de OC)
- [x] `tsc --noEmit` = 0 errores · commit `5b018e8` · deploy `087e8cad`

### Estado final Farmacia.tsx — tab Compras
Sub-tabs: **Dashboard | Órdenes de Compra | Recepción de Mercancía | Cuentas por Pagar | Aging / Vencimientos**

## Completado (Jun 15, 2026 — sesión 22)

### Notificaciones CxP vencimiento ✅
- [x] Migration: `ultima_notificacion_vencimiento_at TIMESTAMPTZ` en `facturas_proveedor`
- [x] Edge function `notify-cxp-vencimiento` (verify_jwt=false):
  - Auth: `NOTIFY_CXP_CRON_SECRET` (cron) | service_role_key | admin/manager JWT
  - Busca facturas con saldo > 0 y vencimiento ≤ hoy+3d, no notificadas en 24h
  - Email via Resend a todos los admin/manager de la clínica
  - Telegram opcional via `clinic_settings` section=notifications, data.telegram_admin_chat_id
  - Cooldown 24h: actualiza `ultima_notificacion_vencimiento_at` al enviar
  - Health: GET → 200
- [x] pg_cron job id=3: `0 15 * * *` (9am CDMX UTC-6) — activo en prod
- [x] `NOTIFY_CXP_CRON_SECRET` seteado en Supabase Secrets
- [x] config.toml: verify_jwt=false para la función
- [x] commit `1e588c0` · deployed `notify-cxp-vencimiento` v1 ACTIVE

### Módulo Almacén/Compras/Proveedores — COMPLETO ✅
Todas las fases completadas. Sin pendientes.

## Completado (Jun 15, 2026 — sesión 23)

### Camino del Paciente — B + C ✅
- [x] **B — BillingForm**: botón "Ir a Caja" (navega `/caja`) + descripción actualizada
- [x] **B — PharmacyForm**: fetch `prescriptions` por `appointment_id` al montar; muestra número, diagnóstico y badge de estatus (Borrador/Activa/Surtida/Cancelada); botón "Ir a Farmacia" (navega `/farmacia`)
- [x] **C — Role enforcement en CaminoPaciente.tsx**:
  - `STEP_ROLES` map: 13 step_keys → roles permitidos (admin/manager en todos + roles especializados)
  - `canActOnStep(stepKey)` checa `roles[]` de `useAuth()`
  - Ícono `ShieldX` en step list sobre hitos activos donde el usuario no tiene permiso
  - Banner naranja en tab Acciones con roles requeridos cuando usuario no puede actuar
  - Botones Abrir/Completar/Bloquear deshabilitados cuando rol insuficiente
- [x] Build limpio (`tsc` 0 errores) · commit `689fb09` · deploy `cbdc09ca` · push `origin/main`
- [x] Site verificado: `integrika.mx` → 200 OK, bundle correcto, sin errores startup

## Completado (Jun 15, 2026 — sesión 24)

### Dashboard clínico — Panel financiero operativo ✅
- [x] `useFinancialDashboardData`: fetch paralelo de turnos activos + ventas por turno (pharmacy_sales) + alertas no-clínicas (actas merma, OC pendientes, CxP vencidas, faltantes farmacia)
- [x] `FinancialOperationsPanel`: cards turno activo (caja nombre, tiempo abierto, fondo, ventas turno), chips alerta clickeables con navigate, "Sin turno activo" con botón abrir, auto-refresh 2min
- [x] `AdminDashboard`: panel insertado entre KPI row y Kanban
- [x] commit `07c1241` · deploy `4fb6723e`

### Expediente clínico — Sync SOAP + Followup a BD real ✅
- [x] `consultationNoteSync.ts`: dos servicios:
  - `syncConsultationNote(appointmentId, patientId, soap)`: busca doctor_id en appointment, encuentra/crea expediente (patient+doctor), upsert en `notas_consulta` keyed por appointment_id (sin duplicados)
  - `syncFollowup(...)`: inserta en `post_consultation_followups`
- [x] `ConsultationForm`: al cerrar consulta → llama syncConsultationNote (non-blocking failure), toast "Nota persistida en expediente"
- [x] `FollowupForm`: syncFollowup al confirmar, fecha requerida con validación, checkbox "requiere nueva cita"
- [x] commit `0c11751` · deploy `e086195e` · push `689fb09..0c11751`

## Completado (Jun 15, 2026 — sesión 25)

### 3-Way Match OC + Recepción + Factura ✅
- [x] Migration `add_3way_match_to_facturas_proveedor`: columnas `match_status`, `match_oc_total_centavos`, `match_recepcion_total_centavos`, `match_diferencia_centavos`, `match_revisado_by/at`, `match_notas` con CHECK constraint en `facturas_proveedor`
- [x] Auto-update: facturas con `orden_id` existentes → `match_status = 'pendiente'`
- [x] `ThreeWayMatchPanel.tsx`: compara items OC vs recepción vs total factura
  - Tolerancia: 1% o $50 MXN (lo mayor)
  - Clasifica: ok / diferencia (1–10%) / disputa (>10%)
  - Tabla de líneas por medicamento (qty/precio OC vs recepción, diff qty)
  - Persiste resultado al verificar (match_status + totales en BD)
  - Gerente/admin puede aprobar disputas con notas
  - Si recepción no tiene `recepcion_id`, busca la más reciente por `orden_id`
- [x] `useFacturasProveedor.ts`: interfaz extendida con 5 campos match_*
- [x] `FacturasProveedor.tsx`: panel integrado en accordion expandido, antes de "Registrar pago"
- [x] commit `9f00caf` · deploy `73d75045`

## Completado (Jun 15, 2026 — sesión 26)

### Gap #17 — Punto de Reorden Automático ✅
- [x] Migration `add_stock_maximo_reorder_point`: `stock_maximo INTEGER DEFAULT 0` en `medicamentos`; backfill = stock_minimo*3 para registros con stock_minimo>0
- [x] `PuntoReorden.tsx`: panel de reorden con modelo min-max
  - Lista todos los medicamentos donde stock_actual < stock_minimo
  - Columnas: stock_actual / mínimo / máximo / a_pedir (editable)
  - `a_pedir` = stock_máximo − stock_actual (editable antes de generar OC)
  - Botón "Generar OC sugerida" → dialog proveedor + fecha → crea draft en Órdenes de Compra
  - Precio de referencia = costo_unitario del último lote (0 si sin historial, avisa al usuario)
  - Estado vacío si todos los productos están en stock
- [x] `Farmacia.tsx`: nuevo subview "Reorden" con badge contador (naranja) en nav inventario
- [x] `Farmacia.tsx`: campo "Stock máximo (reponer hasta)" en dialog edición de medicamentos
- [x] commit `0b2c656` · deploy `773f6e11`

## Completado (Jun 15, 2026 — sesión 27)

### Gap #11 — Devoluciones a Proveedor ✅
- [x] Migration `create_devoluciones_proveedor_module`:
  - `devolucion_proveedor` añadido a `movimiento_tipo` enum
  - `devoluciones_proveedor`: folio DEV-XXXX, proveedor_id, recepcion_id opcional, 6 motivos, 5 estatus, campos nota crédito, `inventario_revertido` flag
  - `devoluciones_items`: medicamento_id, lote_id, cantidad_devuelta, precio_unitario_centavos
  - RLS en ambas tablas
- [x] `useDevolucionesProveedor.ts`: create, enviar (decrementa lotes + inserta movimientos devolucion_proveedor), actualizarEstatus, registrarNotaCredito, getItems
- [x] `DevolucionesProveedor.tsx`: lista acordeón + dialog nueva devolución
  - Seleccionar recepción → pre-llena ítems (cantidad editable, validada vs cantidad_recibida)
  - Flujo estatus: Enviar → Aceptada/Rechazada → Nota de crédito
  - Tabla de ítems con subtotales en accordion
- [x] `Farmacia.tsx`: sub-tab "Devoluciones" en tab Compras
- [x] commit `48a3d65` · deploy `67ef3651`

## Completado (Jun 15, 2026 — sesión 28)

### Gap #14 — Evaluación de Proveedores ✅
- [x] `EvaluacionProveedores.tsx`: scorecard automático por proveedor
  - KPI entrega puntual (35%): avg días tardanza vs fecha_entrega_est OC
  - KPI exactitud cantidad (30%): sum(recibida)/sum(pedida) por OC→recepcion
  - KPI calidad/devolución (20%): inverso tasa devolucion (unidades devueltas / recibidas)
  - KPI exactitud precio (15%): facturas_proveedor con match_status ok/aprobado_gerente vs total con match
  - Rating A≥85% / B70–84% / C55–69% / D<55%
  - Filtro período 90d / 6m / 1a; botón refresh
  - Accordion por proveedor: barras score por dimensión + tabla ponderada breakdown
- [x] `Farmacia.tsx`: sub-tab "Evaluación" en Compras
- [x] commit `ba5096c` · deploy `b0cb1eb1`

### Investigaciones formales completadas ✅
- INV-A → `memoria/proyectos/investigacion-operativa-contable-compras.md` — 20 gaps priorizados NIF/COFEPRIS/COSO
- INV-B → `memoria/proyectos/investigacion-auto-abasto-proveedor-preferido.md` — schema completo + edge function + pg_cron
- INV-C → `memoria/proyectos/investigacion-cfdi-xml-4way-match-antirobo.md` — parser CFDI 4.0 + 4-way match + alertas anti-robo

### Fix IVA / push sesión 28
- [x] `fix: PuntoDeVenta tasa_iva fallback 0.16 -> 0` (commit `135e96b`)
- [x] Push origin/main completado: 9 commits `9f00caf..135e96b`

## Completado (Jun 15, 2026 — sesión 29)

### Gap #1 — CFDI duplicado ✅ (commit `1479d5f`)
- [x] Pre-check UUID SAT antes de INSERT en `useFacturasProveedor.create()`
- [x] Migration `add_unique_uuid_sat_facturas_proveedor`: UNIQUE INDEX parcial WHERE uuid_sat IS NOT NULL

### Gap #2 — Libro control psicotrópicos/estupefacientes ✅ (commit `24b177e`)
- [x] Migration: `tipo_control` en medicamentos + tablas `libro_control_controlados` + `libro_control_movimientos` con RLS
- [x] `useLibroControlControlados.ts`: createLibro, cerrarLibro, registrarEntrada, registrarSalida (valida saldo), firmarMovimiento
- [x] `LibroControlControlados.tsx`: accordion libros, dialogs entrada/salida, firma, badges COFEPRIS
- [x] `Farmacia.tsx`: nav "Controlados" + subview + campo tipo_control en form medicamentos

### Gap #3 — Solicitudes de Compra (SC) ✅ (commit `b6a8f49`)
- [x] Migration: tablas `solicitudes_compra` + `solicitudes_compra_items` + FK en `ordenes_compra`
- [x] `useSolicitudesCompra.ts`: create, enviar, aprobar, rechazar, marcarConvertida
- [x] `SolicitudesCompra.tsx`: flujo borrador→enviada→aprobada→convertida, aprobación role-gated
- [x] `Farmacia.tsx`: sub-tab "Solicitudes" antes de OC en tab Compras

### Gap #4 — CxP Provisional Devengada NIF C-19 ✅ (commit `bc324fe`)
- [x] Migration `add_provisional_accrual_to_facturas_proveedor`: estatus 'provisional' + `es_provisional` bool + índice parcial
- [x] `useFacturasProveedor.ts`: tipo `es_provisional`, estatus union incluye 'provisional', `confirmarProvisional()`, `provisionales` computed
- [x] `useRecepcionesMercancia.ts`: auto-crea accrual provisional al crear recepción con OC sin CFDI real
- [x] `FacturasProveedor.tsx`: badge amber, aviso NIF C-19, dialog "Registrar CFDI real"

### Gap #5 — Auto-abasto con proveedor preferido ✅ (commit `7d05952`)
- [x] Migration `create_medicamento_proveedores_autoabasto`: tablas `medicamento_proveedores` + `auto_reorden_log` + trigger `update_updated_at` + RPC `get_medicamentos_en_reorden` + RLS
- [x] `useMedicamentoProveedores.ts`: CRUD con precio pactado, mínimos, múltiplos, plazo, activo toggle
- [x] `MedicamentoProveedoresPanel.tsx`: UI hasta 5 proveedores con orden de preferencia (★ primario), vigencia precio, restricciones pedido
- [x] `Farmacia.tsx`: panel integrado en dialog edición de medicamento
- [x] Edge function `auto-reorder` v1 ACTIVE: agrupa por proveedor, cooldown 7d, umbral $5k, bloquea estupefacientes/psico I-II, borradores manuales psico III, email via Resend
- [x] pg_cron job id=4: `0 12 * * *` (06:00 CST) — activo en prod

### Gap #6 — Parser CFDI XML 4.0 + 4-way match anti-robo ✅ (commit `3edda1e`)
- [x] Migration `create_fp_cfdi_4way_match_antirobo`: tablas `fp_cfdi`, `fp_cfdi_lineas`, `medicamento_codigos_proveedor` + RLS
- [x] ALTER TABLE `facturas_proveedor`: `fp_cfdi_id`, `cfdi_parseado`, `tiene_alertas_criticas`, `match_alertas_count`
- [x] Edge fn `cfdi-parse` v1 ACTIVE: parse CFDI 4.0, aritmética, SAT SOAP, 3-nivel matching, 4-way match vs OC+Recepción
- [x] Alertas CRITICA/ALTA/MEDIA con detección anti-robo CANTIDAD_FACTURADA_MAYOR_RECIBIDA
- [x] `useFpCfdi.ts` + `CfdiUploadPanel.tsx`: drag-drop XML, tabla líneas coloreada, badge recomendación
- [x] `FacturasProveedor.tsx`: botón "Subir XML" inline por factura

## Completado (Jun 15, 2026 — sesión actual)

### Business Intelligence dashboard ✅ (commit `931ac2d`)
- [x] `src/hooks/useBI.ts`: 10 queries paralelas por período; citas timeline/origen/doctor, farmacia timeline, stock alertas, lotes por vencer, CxP, pacientes nuevos
- [x] `src/pages/BI.tsx`: 5 tabs (Resumen | Agenda | Farmacia | Inventario | Finanzas)
  - Resumen: 6 KPI cards con delta vs período anterior + gráficas citas y ventas por día + donut origen + bar doctores
  - Agenda: funnel confirmadas/canceladas/no-show + tabla rendimiento médicos
  - Farmacia: ventas diarias + transacciones diarias
  - Inventario: tabla stock bajo mínimo + lotes por vencer 30d con badge días
  - Finanzas: CxP pendiente vs vencido con barra visual
  - Selector período: Este mes / Mes anterior / 3 meses / Este año
  - Badge alert en tabs Inventario y Finanzas cuando hay datos críticos
- [x] Ruta `/inteligencia` (ProtectedRoute admin/manager) en `App.tsx`
- [x] Nav "Inteligencia BI" con ícono BarChart2 en sección Admin de `AppLayout.tsx`
- [x] `tsc --noEmit` = 0 errores

### Agenda mejorada ✅ (commit `329f954`)
- [x] Migration `add_agenda_bloqueos_recurrencia`: `doctor_bloqueos` tabla + columnas recurrencia en `appointments`
- [x] Edge function `confirmar-cita` v1 ACTIVE: cambia status + notifica vía Telegram al paciente
- [x] `Agenda.tsx` reescrito: vista semanal (columnas=días, filas=horas) + vista día (columnas=doctores)
  - Bloqueos visuales inline en grid; `BloqueoDialog` para crear bloqueos
  - Filtro por doctor; recurrencia badge ↻ en CitaCard
  - `cambiarStatus` usa edge fn con fallback directo a Supabase
- [x] `NuevaCitaDialog.tsx`: sección recurrencia (semanal/quincenal/mensual + fecha hasta) + `generarOcurrencias()` max 52
- [x] `supabase/config.toml`: `[functions.confirmar-cita] verify_jwt = false`

### Gaps INV-A — TODOS COMPLETOS ✅ (commit `1612ee6`)
- [x] **Auditoría log accesos**: tabla `audit_log` append-only + triggers en `proveedores`/`ordenes_compra`/`facturas_proveedor`; `AuditLogPanel.tsx` (solo admin/manager)
- [x] **Validación RFC vs SAT 69B**: `EvaluacionProveedores.tsx` muestra badge EFOS, advertencia deducibilidad, link SAT; query enriquecida con `rfc`/`estatus_efos`/`ultima_verificacion_efos`
- [x] **Bitácora temperatura cadena frío**: tabla `bitacora_temperatura` + trigger `fn_check_temp_rango` (auto-calcula `fuera_de_rango`); `BitacoraTemperaturaPanel.tsx` con tarjetas estado por zona + historial
- [x] **Comparativa cotizaciones multi-proveedor**: tablas `cotizaciones` + `cotizaciones_items`; `CotizacionesPanel.tsx` con comparativa agrupada por SC, estrella mejor precio, selección ganador
- [x] **Control presupuestal por categoría**: tabla `presupuesto_categorias` + vista `v_presupuesto_ejecucion`; `PresupuestoPanel.tsx` con barra de ejecución, alerta ≥80%, bloqueo visual a 100%
- [x] Farmacia.tsx: 4 tabs nuevos en Compras (Cotizaciones, Presupuesto, Temperatura, Auditoría)

## Completado (Jun 15, 2026 — sesión 30)

### Auto-reorder operacional ✅
- [x] `AUTO_REORDER_CRON_SECRET` configurado en Supabase Secrets (Dashboard)
- [x] Vault: `vault.create_secret('auto_reorder_cron_secret', ...)` → id `471b7c73-088a-4a02-8ae9-23e6c3421026`
- [x] pg_cron job id=4 actualizado: lee secret desde `vault.decrypted_secrets` en subquery (nunca en texto claro)
- [x] Fix schema drift `auto-reorder` v3: `clinics.active` → `clinics.status = 'active'` (v2 retornaba 500)
- [x] Edge function `auto-reorder` v3 ACTIVE — fix: `.eq("active", true)` → `.eq("status", "active")` (línea 166)
- **Pendiente**: correr test post-fix para confirmar 200 (query `net.http_post` → revisar `net._http_response`)

## Completado (Jun 18, 2026 — sesión actual)

### Sidebar — Admin simplificado ✅
- [x] `AppLayout.tsx`: eliminados Inteligencia BI, Ayuda interna, Usuarios, Auditoría del menú principal (eran 4 ítems de admin que no son operativos diarios)
- [x] Sección Admin del sidebar ahora tiene solo: **Configuración** como punto de entrada único
- [x] `Configuracion.tsx`: añadidos como tarjetas en grid (BarChart2, LifeBuoy, ShieldCheck) — Inteligencia BI, Ayuda interna, Auditoría — junto a "Usuarios y roles" ya existente
- [x] Imports limpiados en AppLayout.tsx (Heart preservado, era usado en línea 178)

### Bot Telegram — Spec + Plan completo ✅
- [x] Spec `docs/superpowers/specs/2026-06-18-bot-mejoras-horario-clinica-design.md` — 6 componentes (A-F):
  - A: Horario clínica configurable (clinic_settings section='horario')
  - B: 3-tier FAQ→Haiku→Sonnet (60-70% reducción tokens estimada)
  - C: manejarConsultaLibre con PADECIMIENTO_MAP + Haiku fallback
  - D: Learning pipeline via chat_registrar_pendiente
  - E: MemoriaPaciente estructurada (interface con preferencias, datos_clinicos, historial)
  - F: Especialidad doctor en label de slots
- [x] Proyecto 2 agregado al spec: Google Calendar bidireccional por doctor
  - Tabla `doctor_calendars` (tokens OAuth)
  - Edge fn `google-oauth-callback`
  - Módulo `google-calendar.ts` (getDoctorCalendar, getFreeBusy, createEvent, updateEvent, deleteEvent)
  - Integración en bot (slots filtrados por busy, cita→evento, cancelar→eliminar, reagendar→actualizar)
  - UI: columna "Google Calendar" en AdminUsuarios — doctor conecta su propio calendar al darlo de alta
- [x] Plan `docs/superpowers/plans/2026-06-18-bot-mejoras-horario-google-calendar.md` — 17 tasks detallados con código real
- [x] **Task 1 EJECUTADO**: Migration `20260626000000_horario_clinica_seed.sql` aplicada — clinic_settings section='horario' con días [1,2,3,4,5], apertura 09:00, cierre 18:00

## Completado (Jun 21, 2026 — sesión bot bugs 2)

### Bot Telegram — 3 bugs fixes + selección de día ✅ (commits `750b0ee`, `512e87c`, `6e33c9e`)

- [x] **Bug: "Cancelar" → "No tienes citas"** — `.not("status","in","(cancelada,cancelado,no_show)")` usaba valores inválidos del enum `appointment_status` → PostgreSQL error de cast silencioso → `data: null` → "No tienes citas". Fix: `(cancelada,liberada)`. Aplica a 3 lugares: `verMiCita`, `iniciarCancelacionCita`, `iniciarReagendarCita`.
- [x] **Bug: GCal link 8:30 AM → 2:30 PM en calendar** — `buildGCalLink` usaba `d.getHours()` (UTC en runtime Deno = 14) en vez de hora CDMX (8). Fix: `toLocaleString("sv-SE", { timeZone: "America/Mexico_City" })`.
- [x] **Bug: evento doctor en GCal a hora incorrecta** — `inicio.toISOString()` tiene sufijo Z → GCal API ignora `timeZone` field → evento a las 14:30 UTC. Fix: helper `toMexicoLocalISO()` convierte a local sin Z → GCal usa `timeZone: "America/Mexico_City"`.
- [x] **GCal errores silenciosos** — `createCalendarEvent` retornaba `null` sin throw → outer catch no se activaba → `gcal_last_error = null`. Fix: throw en `!resp.ok` para que el error llegue al campo `gcal_last_error`.
- [x] **Enum inválido en `listarHorariosDisponibles`** — filtro JS usaba mismos valores inválidos. Fix: `["cancelada","liberada"]`.
- [x] **Selección de día (Opción B)** — `enviarHorariosDeServicio` ahora muestra días disponibles (L-V, 14 días, 2 por fila). Tap en día → slots de ese día. `mostrarSlotsDia` función nueva. Callback `dia:` nuevo. `max_horarios=200` para tener todos los slots en sesión. `flow_step: "await_day_pick"` con re-display al escribir texto.
- [x] Push a GitHub origin/main — 3 commits sincronizados

## Completado (Jun 20, 2026 — sesión bot bugs)

### Bot Telegram — bugs menú doble + servicios vacíos + doble-booking ✅ (commit `e64ce37`)
- [x] `esSaludo()` siempre limpia sesión y retorna — sin caída al agente con sesión stale
- [x] `getServiciosConDoctorActivo()`: helper query 1-nivel `doctor_servicios→doctors` — reemplaza filtro PostgREST 2-niveles que devolvía vacío en prod (bug conocido: PostgREST solo soporta 1 nivel de `.eq()` nested)
- [x] `getCategoriasDisponibles()`, `enviarServiciosDeCategoria()`, `buscarServicios()` usan el helper
- [x] `limpiarTeclado()`: await (no fire-and-forget) — keyboard borrado antes de procesar callback
- [x] `processedCallbackIds` Set con TTL 30s — dedup por callback_query_id
- [x] `crearCitaDesdeSesion`: detecta error 23P01 → `slotTomado: true`
- [x] `wizardConfirm` / `confirmarReagendar`: ofrecen siguiente slot disponible en colisión concurrente
- [x] Migration `20260621000001`: `appointments_no_double_booking` EXCLUDE USING gist (btree_gist)
- [x] Verificado en prod: menú único (10:58), servicios reales (11:00), horarios (11:01) ✅
- [x] GCal IIFE → await: `createCalendarEvent`, `deleteCalendarEvent`, `updateCalendarEvent` ahora await dentro de `waitUntil` scope — commit `a112673`
- [x] Google Calendar API habilitada en GCP proyecto 545467181522
- [x] `google_event_id` verificado en DB + evento en calendario `joseshugy@gmail.com` ✅
- **Pendiente externo:** `VITE_GOOGLE_CLIENT_ID` en `.env` local y GitHub Actions secrets (botón "Conectar" GCal en AdminUsuarios)
- **Mejoras técnicas para próxima sesión:**
  - GCal catch vacío → `console.error` + campo `gcal_last_error` en appointments
  - Health check GCal al conectar en `google-oauth-callback`
  - RPC cleanup citas de prueba (`cancelar_citas_prueba`)

## Completado (Jun 21, 2026 — sesión M1 Dashboard datos reales)

### M1: Dashboard con datos reales ✅ (commits `81baa7a..866c8b1`)

Plan: `docs/superpowers/plans/2026-06-21-dashboard-datos-reales.md`
Spec: `docs/superpowers/specs/2026-06-21-dashboard-datos-reales-design.md`

- [x] **Task 1**: `src/hooks/useDashboardHoy.ts` creado — 5 queries paralelas (appointments hoy, pharmacy_sales, patients, audit_logs, almacen_alertas). Helpers puros exportados: `formatHora`, `formatNombrePaciente`, `formatNombreDoctor`, `mapStatusToLabel`, `mapAuditToTexto`, `tiempoRelativo`. `CONFIRMED_STATUSES` + `RESOLVED_STATUSES` para `citasSinConfirmar`. Fecha con `startOfDay()` UTC-safe.
- [x] **Task 2**: `src/pages/Dashboard.tsx` reescrito — DashboardSkeleton mientras carga, error state con mensaje genérico + refresh, fecha real en español, 4 StatCards con datos reales, agenda con empty state, actividad reciente con empty state, banner condicional `citasSinConfirmar > 0`. `ingresosHoy` dividido /100 en UI. Supabase errors chequeados por query individual.
- [x] 27 tests pasando · `tsc --noEmit` 0 errores · 6 commits · revisión final aprobada

**Deuda técnica menor anotada:**
- `formatHora` usa slice bytes (asume UTC stored) — si timestamps tienen offset no-UTC, hora incorrecta
- `startOfDay(new Date())` usa timezone browser, no timezone clínica — requiere `date-fns-tz` para fix preciso
- `tiempoRelativo` tests frágiles en CI en boundary cases (milisegundos)

---

## Completado (Jun 21, 2026 — verificación seguridad + auto-reorder)

- [x] **Auditoría seguridad `memoria/`**: limpia — sin credenciales en git. Emails de notificación solo en contexto de ejemplo. Credenciales críticas solo en `.env` + `.claude/` (gitignoreados) ✅
- [x] **`VITE_GOOGLE_CLIENT_ID`**: ya estaba en GH Actions desde Jun 21 16:12 — pendiente era falso ✅
- [x] **`auto-reorder` v3 post-fix**: `200 OK` via `net.http_post → net._http_response` · `ocs_creadas:0, errores:[]` — función operativa ✅

---

## Pendiente / Próximo

### ✅ Bot + Horario + Google Calendar — PLAN COMPLETO (Jun 20, 2026)
Plan: `docs/superpowers/plans/2026-06-18-bot-mejoras-horario-google-calendar.md`
Commit final: `66bf606` · Deploy Workers: `e58cf44d`

| Task | Estado | Descripción |
|------|--------|-------------|
| 1 | ✅ | DB migration horario clínica seed |
| 2 | ✅ | UI HorarioClinicaSection en Configuracion.tsx |
| 3 | ✅ | Bot: getClinicSchedule() + listarHorariosDisponibles refactor |
| 4 | ✅ | Bot: FAQ tier 1 (buscarFaqTelegram) |
| 5 | ✅ | Bot: Haiku intent classifier tier 2 |
| 6 | ✅ | Bot: manejarConsultaLibre + PADECIMIENTO_MAP |
| 7 | ✅ | Bot: learning pipeline (chat_registrar_pendiente tras Sonnet) |
| 8 | ✅ | Bot: MemoriaPaciente estructurada |
| 9 | ✅ | Bot: especialidad doctor en slots + system prompt |
| 10 | ✅ | Deploy Proyecto 1 |
| 11 | ✅ | DB: doctor_calendars + appointments.google_event_id |
| 12 | ✅ | Edge fn: google-oauth-callback |
| 13 | ✅ | Módulo: google-calendar.ts helper |
| 14 | ✅ | Bot: free/busy check en listarHorariosDisponibles |
| 15 | ✅ | Bot: crear/actualizar/eliminar eventos Google Calendar |
| 16 | ✅ | UI: panel Google Calendar en AdminUsuarios |
| 17 | ✅ | Deploy Proyecto 2 |

**Secrets configurados:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` en Supabase.
**Pendiente externo:** añadir `VITE_GOOGLE_CLIENT_ID` a `.env` local y GitHub Actions secrets para que el botón "Conectar" aparezca en AdminUsuarios.

### Asignación enfermera por cita (Jun 16)
- [x] Pantalla `/perfil/vincular-telegram` (`src/pages/VincularTelegram.tsx`) — genera código en `staff_link_codes`, instrucción `/vincular CODE`. Enlace en menú de usuario solo para rol `nurse`.
- [x] `types.ts` regenerado — tenía drift grande, le faltaban `staff_link_codes`, `staff_identidades_canal`, `entregas_turno`, `solicitudes_insumos` (las 4 ya estaban en prod, ninguna en types ni en frontend)
- [x] Migración `20260618000000_staff_link_codes.sql` agregada — cierra drift (tabla vivía en prod sin migración en git)
- [x] `tsc --noEmit` 0 errores, eslint limpio
- **Hallazgo importante**: `entregas_turno` (entrega de turno enfermería) y `solicitudes_insumos` (solicitud de insumos a farmacia) YA EXISTEN en prod (migración `20260617000000_enfermera_asignacion.sql`) pero **sin ninguna UI/frontend que las use** — cubren parte de Prioridad 3 (insumos) y Prioridad 5 (continuidad/turno) de la investigación. Construir UI sobre estas antes de diseñar tablas nuevas.
- Pendiente: commitear `NuevaCitaDialog.tsx` + `telegram-webhook/index.ts` + `notify-nurse-assignment/` + `VincularTelegram.tsx` + `App.tsx` + `AppLayout.tsx` + `types.ts` + 2 migraciones nuevas (confirmar con usuario antes de commitear)
- Ver investigación completa de perfil enfermería: `memoria/proyectos/investigacion-enfermeria-operativa.md`

### BI — mejoras fase 2 ✅ COMPLETO (Jun 28, 2026)
- [x] Top 10 productos farmacia por ingresos — `pharmacy_sale_items` join, ya implementado
- [x] Heatmap citas por hora del día / día de semana — `CitasHeatmap` en tab Agenda, ya implementado
- [x] Tasa retención → "Pac. frecuentes ≥2 citas/período" (ver /aprende 2026-06-28)
- [x] KPI bot IA: costo mensual por canal — `bot_usage_costs` filtrado por `organization_id=activeClinicId`, tabla breakdown en TabFinanzas

### Otras opciones
- [x] **Vista paciente enriquecida** — drawer con stats header (citas, recetas, gasto farmacia, última visita), doctor en citas, tab Notas clínicas (vía expedientes→notas_consulta). Deploy `7c05ac70` Jun 28.
- [x] **DischargeForm mejorado** — ya estaba completo (diagnóstico final, documentos, restricciones, próxima cita). Verificado Jun 28.

---

### ✅ Ciclo Compras — Fase 1 + Fase 5 COMPLETO (Jun 28, 2026)
Migration: `20260709000001_ciclo_compras_trazabilidad.sql` · Aplicada ✅

**Fase 1 — Trazabilidad BD:**
- [x] `ordenes_compra.cotizacion_id UUID` FK → `cotizaciones(id)` + índice
- [x] `facturas_proveedor.solicitud_id UUID` FK → `solicitudes_compra(id)` + índice
- [x] Vista `v_ciclo_compras`: SC → Cotización → OC → GR → Factura → Pago

**Fase 5 — COSO Segregación:**
- [x] RLS `coso_update_recepciones`: solo admin/manager confirman GR
- [x] RPC `confirmar_recepcion_mercancia(p_recepcion_id)` SECURITY DEFINER
- [x] RLS `coso_update_facturas_proveedor`: diferencia ≠0 requiere admin/manager
- [x] RPC `aprobar_diferencia_factura(p_factura_id, p_notas)` SECURITY DEFINER

**Pendiente (Fases 2, 3, 4, 6):**
- [ ] Fase 2: Triggers DB para eventos del ciclo
- [ ] Fase 3: UI workflow ciclo de compras
- [ ] Fase 4: KPI dashboard métricas compras
- [ ] Fase 6: Reportes auditoría ciclo compras

---

### Cola de investigación (próximas sesiones — requieren análisis antes de implementar)

#### INV-A: Validación operativa contable y administrativa
Investigar y validar el flujo completo (compras→recepción→factura→pago→inventario) contra:
- NIF C-4 (inventarios), NIF D-2 (costo de ventas), NIF C-19 (instrumentos financieros)
- COFEPRIS: Buenas Prácticas de Almacenamiento (BPA), cadena de custodia controlados
- SAP Business One módulo MM (Materials Management) como referencia de industria
- Odoo 17 módulo Purchase/Inventory
- Netsuite Purchase Orders flow
- QuickBooks Enterprise: purchase order → bill → payment cycle
- IIA (Institute of Internal Auditors): controles anti-fraude en compras
- COSO 2013: control interno en procesos de abastecimiento
Preguntas clave: ¿falta algún control? ¿segregación de funciones? ¿trazabilidad suficiente?

#### INV-B: Auto-abasto con proveedor preferido por artículo
Diseñar y validar:
- Tabla `medicamento_proveedor_preferido`: medicamento_id → proveedor_id + precio_pactado + plazo_entrega
- Agrupación de artículos por proveedor para OC eficiente (mínimo de compra, multiplos)
- Trigger automático cuando stock < stock_minimo → genera OC borrador → envía email al proveedor (edge function)
- Aprobación de OC antes de enviar (flujo existente) vs envío automático sin aprobación (riesgo)
- Integración con punto de reorden (gap #17 ya implementado)
Preguntas: ¿cuándo es seguro el auto-envío sin aprobación humana? ¿COFEPRIS tiene restricciones para controlados?

#### INV-D: Enfermería — validación de perfil y operación ✅ INVESTIGACIÓN COMPLETA (Jun 16)
Ver `memoria/proyectos/investigacion-enfermeria-operativa.md`. Hallazgos clave:
- `list_nurses()` solo trae `id, email` — sin cédula profesional, categoría, especialidad (NOM-019-SSA3-2013 lo exige)
- `TriageForm` solo signos vitales, sin nota de enfermería PAE/PLACE (NOM-004)
- Sin trazabilidad de insumos/instrumental por paciente (COFEPRIS, NOM-087, NOM-045)
- `discharge` step no incluye rol `nurse` en `closeRoles`
- `assigned_nurse_id` solo vive en `appointments` — no se propaga a `journey_instance_steps.assigned_to`, la enfermera se "pierde" tras el aviso inicial de Telegram
- No existe tabla de horario/turno de enfermera (sí existe `doctor_bloqueos` para médicos) — se puede asignar enfermera fuera de su horario real
**Investigación operativa de enfermería: CERRADA Jun 16.** Las 5 prioridades + los 2 estudios nuevos (quién asigna, panel notificaciones) están completos:
- P1 catálogo `nurses` + cédula/categoría — `a213cdf`
- P1b CRUD AdminUsuarios — `2b3e748`
- P2 nota PAE en TriageForm — `65150ae`
- P3 insumos con descuento FEFO — `ff9230b`
- P5 horario + continuidad en journey — `435d185`
- Reasignar enfermera + vista persistente (DetalleCita) — `f377cbb`
- Panel notificaciones por rol/evento — `c4e2a5d`

Pendiente no urgente: migrar `notify-cxp-vencimiento`/`notify-new-user` a `notification_rules` (mismo patrón ya probado). **Nuevos estudios agregados Jun 16** (planeación, no implementados): "¿quién asigna la enfermera?" (recomendación: híbrido recepción-asigna-por-default + doctor-reasigna-override) y "panel de configuración de notificaciones por rol/evento" (requiere decisión de negocio: ¿Telegram+email basta o se necesita SMS/WhatsApp real con costo recurrente?). Detalle completo en el archivo de investigación.

**Prioridad 1 — COMPLETADA (Jun 16):** tabla `nurses` creada (espejo `doctors`: nombre, apellidos, `categoria` enum licenciada/tecnica/auxiliar, cédula, horario_inicio/fin, activo, clinic_id) + `list_nurses()` RPC actualizado (LEFT JOIN, devuelve nombre/apellidos/categoria, fallback a email si la enfermera no tiene fila en `nurses` todavía) + selector en `NuevaCitaDialog.tsx` muestra "Lic./Téc./Aux. Nombre Apellidos" en vez de email crudo.

**Prioridad 1b — COMPLETADA (Jun 16):** tab "Enfermeras del registro" en `AdminUsuarios.tsx` (CRUD completo: crear/editar/eliminar/vincular/desvincular cuenta), espejo exacto del tab de médicos. Acciones `link_nurse_user`/`unlink_nurse_user` agregadas a edge function `admin-users` (deploy v14 ACTIVE). Validado: `tsc --noEmit` 0 errores, `npm run build` OK, `list_nurses()` probado en vivo simulando JWT admin. **No probado con click-through real en browser** (requeriría login manual).

#### INV-C: Lectura CFDI XML/PDF para validación 4-way (anti-robo/fraude)
Diseñar y validar:
- Parser XML CFDI 4.0 (SAT): extraer Conceptos → cantidad, valorUnitario, importe, descripcion
- Mapeo CFDI concepto → medicamento_id por descripcion/ClaveProdServ/NoIdentificacion
- Comparación automática: CFDI vs OC vs Recepción vs Factura interna (4-way match)
- Alertas si: precio CFDI ≠ precio OC (>tolerancia), cantidad CFDI > cantidad recibida
- Flujo: upload XML en FacturasProveedor → parse → auto-poblar campos → 3-way match mejorado
- PDF fallback: AWS Textract / Google Document AI para facturas sin CFDI (proveedores pequeños)
- Anti-robo: detectar si cantidad recibida < cantidad facturada (posible desvío)
Preguntas: ¿qué ClaveProdServ/SAT usa farmacia? ¿cómo mapear cuando descripción no coincide?

### Otras opciones
- **Agenda mejorada**: citas recurrentes, confirmación Telegram/SMS, bloqueos por doctor, vista semanal
- [x] **Vista paciente enriquecida** — completado Jun 28
- [x] **DischargeForm mejorado** — ya estaba completo, verificado Jun 28

## Completado (Jun 15, 2026 — sesión 15)

### ESLint warning cleanup — 0 errores TS mantenidos
- [x] Agentes paralelos limpiaron `no-explicit-any` en 19 archivos (páginas + hooks + features)
- [x] Fix TS errors introducidos por agentes en cleanup:
  - `usePatientClinicalSnapshot.ts`: `Record<string,unknown>` → interfaces concretas con index signature (`PatientRow`, `ExpedienteRow`, `NotaRow`, `RecetaRow`) — consumers `DoctorActionPanel` y `PatientClinicalContext` compilan sin errores
  - `useJourneyInstance.ts:89`: quitar tipo explícito en forEach param, cast `data_json as Record<string,unknown>`
  - `NotaCreditoDialog.tsx` / `TimbrarCFDIDialog.tsx`: revertir `as unknown as "appointments"` (causaba error de columna `rfc`) → `(supabase as any)` con `eslint-disable` scoped
- [x] `telegram-webhook/index.ts`: `let` → `const` (prefer-const)
- [x] `tsc --noEmit` = **0 errores** confirmado
- [x] Commit `4026d2a` pusheado a main

## Completado (Jun 15, 2026 — sesión 14)

### Infraestructura build: 0 vulnerabilidades npm, Vite 8
- [x] `framer-motion` + `motion` instalados
- [x] Upgrade: `vite@^8.0.16`, `vitest@^4.1.8`, `lovable-tagger@^1.3.0`
- [x] Switch `@vitejs/plugin-react-swc` → `@vitejs/plugin-react@^6.0.2` (mejor perf, sin plugins SWC)
- [x] **0 vulnerabilidades npm** (de 18 iniciales)
- [x] Dependabot activado: `.github/dependabot.yml` — actualizaciones semanales lunes 9am CDMX
- [x] CI `--legacy-peer-deps` en ambos workflows
- [x] Audit CI: `npm audit --audit-level=high --omit=dev` en typecheck workflow

### Seguridad producción
- [x] `public/_headers` — 6 headers de seguridad (HSTS, CSP, X-Frame, etc.) en Cloudflare
- [x] CSP iterado sin violaciones: Umami, Cloudflare Insights, Google Fonts, blob workers
- [x] Headers verificados en producción `integrika.mx` ✓

### Schema drift — 0 errores TypeScript
- [x] `is_clinic_staff(uuid)` + `is_global_admin(uuid)` creados en prod DB
- [x] `clinic_id` columna añadida a todas las tablas principales (patients, doctors, servicios, appointments, prescriptions, etc.) — backfill con default clinic `a63a7f60`
- [x] `doctors.operational_status` + `operational_status_reason` + `operational_status_until` añadidos
- [x] `doctors.user_id` cambiado a nullable (admin puede crear doctores sin cuenta de usuario)
- [x] `post_consultation_followups` tabla creada con RLS completo
- [x] `doctor_contact_attempts` actualizado: +`channel`, `clinic_id`, `contacted_by`
- [x] `doctor_operational_status` enum + `doctor_contact_channel` + `doctor_contact_result` enums creados
- [x] `audit_action` enum extendido: `doctor_contact_attempt_created`, `doctor_confirmo_por_llamada`, `doctor_rechazo_por_llamada`, `doctor_no_contesto`, `doctor_status_changed`, `paciente_creado_inbox`, `paciente_vinculado_inbox`, `conv_cerrada`, `cita_desde_inbox`, `doctor_unavailable_override`
- [x] 3 RPCs creados: `get_prescription_audit`, `pharmacy_recompute_prescription_status`, `multiclinic_diagnostics`
- [x] `types.ts` regenerado desde prod DB
- [x] Code fixes: `DetalleCita.RecordatorioCita.tipo`, `prescriptionService` cast, `useDoctores/AdminUsuarios` insert cast, `PuntoDeVenta` Json cast, `Auditoria` comparación, `Facturacion` cast
- [x] **`tsc --noEmit` = 0 errores** → CI typecheck verde ✓
- [x] ESLint: pre-existing `any`/`prefer-const` demotados a `warn` → **CI lint verde ✓**
- [x] Deploy Cloudflare Workers: **success** — `integrika.mx` operativa ✓

### Bugs conocidos
- (ninguno activo)

## Completado (Jun 16, 2026 — sesión 31)

### Fix crítico: notificación admin de usuarios nuevos no funcionaba ✅
- [x] **Root cause real**: edge function `notify-new-user` validaba `Authorization` contra `SUPABASE_SERVICE_ROLE_KEY`, pero el trigger DB (`public.notify_new_user_signup()`) manda el secreto guardado en `vault.notify_new_user_secret` (un UUID, no el service role key) — siempre rechazaba con 401 "no autorizado". Ningún usuario nuevo notificó jamás a un admin.
- [x] Fix: nuevo Supabase Secret `NOTIFY_SHARED_SECRET` (mismo valor que `vault.notify_new_user_secret`), edge function ahora compara contra ese
- [x] Bug secundario encontrado tras el primero: `/auth/v1/admin/users?per_page=1000` devolvía 500 "Database error finding users" → reemplazado por lookup individual `/auth/v1/admin/users/{id}` por cada admin (más robusto, evita el bug de listado masivo)
- [x] Debug info agregado a la respuesta JSON (`debug: {...}`) porque `get_logs` de edge functions NO muestra `console.log`/`console.warn` internos, solo logs de acceso HTTP — truco útil: invocar función manualmente vía `net.http_post` desde SQL y leer `net._http_response.content`
- [x] Verificado extremo a extremo: test manual → `{"ok":true,"notified":1,"hasResendKey":true}` → email confirmado recibido en `integric.ia@gmail.com`
- [x] Notificación real disparada manualmente para los 2 usuarios que quedaron atascados sin notificar: `puntoabarrotespv@gmail.com`, `pablorios.vsn@gmail.com`
- [x] Deploy `notify-new-user` v7 ACTIVE · commit `437ecb9`

### Aprendizaje permanente
- `mcp__supabase__get_logs(service: "edge-function")` solo da logs de acceso (method/status/url/tiempo), nunca el `console.*` interno de la función. Para depurar lógica interna: hacer que la función regrese el debug en el JSON de respuesta y probar con `net.http_post` manual desde SQL + leer `net._http_response`.
- Cuando un trigger DB y una edge function comparten un "secreto", verificar que AMBOS lados usen el mismo valor real — no asumir que el secreto del vault y el service role key son intercambiables.

## Completado (Jun 16, 2026 — cuenta QA + verificación en browser)

### Verificación real en browser de todas las features de enfermería de hoy
- Levanté dev server + `agent-browser` (CDP) — login, AdminUsuarios (tab Enfermeras: crear/eliminar real), Farmacia (tab Insumos: solicitar+aprobar real con descuento FEFO confirmado en DB), Configuración/Notificaciones (toggle real confirmado en DB) — todo PASS, sin errores de consola
- Hallazgo (no bug, mi error de automatización): clicks en opciones de Radix `Select` vía CDP no disparan `onValueChange` — usar teclado (`ArrowDown`+`Enter`) en su lugar
- Hallazgo real (pre-existente, no de hoy): wizard de apertura de turno en Farmacia muestra "Caja: {nombre del cajero}" en vez del nombre real de la caja — pendiente investigar, no es de mis cambios

### Cuenta de pruebas QA permanente
- Creada `qa.pruebas@clinica-mexico-spa.test` (rol admin, acceso a todos los módulos), credenciales en `.claude/project-context.md` (gitignoreado, nunca en STATE.md)
- **Deshabilitada por defecto** vía `banned_until` (Supabase Auth ban, no borra la cuenta) — admin debe habilitar antes de cada sesión de pruebas y deshabilitar al terminar
- Nueva acción `toggle_ban` en edge function `admin-users` (v15) + botón 🔒/🔓 en tab "Cuentas de usuario" de AdminUsuarios — toggle real sin tocar SQL, probado en vivo con cuenta desechable separada (creada y borrada solo para esa prueba)
- `admin_list_auth_users()` RPC actualizado para exponer `banned_until`
- Gotcha real encontrado al crear el usuario por SQL directo: columnas de tokens (`confirmation_token`, etc.) no pueden ser NULL — GoTrue falla con "Database error querying schema" si lo son. Deben ser `''` explícito.

## Completado (Jun 17, 2026 — notification_rules + .env local file server)

### Migración notify-cxp-vencimiento / notify-new-user → notification_rules ✅
- [x] `notify-cxp-vencimiento` v6 ACTIVE: `getEnabledChannels(clinic_id, event_type)` consulta `notification_rules` antes de enviar email/telegram por clínica
- [x] `notify-new-user` v9 ACTIVE: check REST `notification_rules?event_type=usuario_nuevo&channel=email&enabled=true` antes de enviar; si no hay regla activa, retorna `{reason:"notification_rule disabled"}`
- [x] Admin puede controlar ambas notificaciones desde `/configuracion/notificaciones` (panel ya existente)

### `.env` local file server ✅
- [x] `VITE_LOCAL_FILE_SERVER=http://localhost:3001`
- [x] `VITE_LOCAL_FILE_SERVER_KEY=clinica-local-2024`
- (.env gitignoreado — no se commitea)

## Completado (Jun 17, 2026 — Chat IA 3-tier FAQ + cerrar consulta + inactividad)

### Chat IA — cerrar sesión + auto-cierre 5 min ✅
- [x] `HelpChatWidget.tsx`: botón `LogOut` en header → cierra sesión manual (`estado='cerrada'`)
- [x] Timer 5 min inactividad (`inactivityRef`): si sin respuesta → mensaje de despedida → `estado='cerrada'`
- [x] Reset timer en cada mensaje enviado/recibido (incluyendo realtime IA)
- [x] Limpia timer cuando sesión pasa a `escalada` o `cerrada` (via realtime UPDATE)
- [x] Estado `cerrada` en widget: banner "Consulta cerrada" + botón "Iniciar nueva consulta"
- [x] Input y botón enviar ocultos cuando sesión cerrada
- [x] Aprendizaje: ya estaba funcionando vía `chat_registrar_pendiente` en edge function v7 (cada respuesta Claude se guarda automáticamente)

### Chat IA — sistema FAQ 3 tiers + roles/módulo ✅
- [x] Migration `20260617000001`: DEFAULT `estado='abierta'` (era 'escalada')
- [x] Migration `20260617000002`: tablas `faq_items` + `chat_preguntas_pendientes` + RPCs
- [x] Edge function `help-chat-ai` v7: Tier 0 (saludo) → Tier 1 (FAQ DB) → Tier 2 (Claude Haiku) → Tier 3 (humano)
- [x] `faq_buscar` RPC filtra por `p_rol` y `p_ruta` (roles array + ruta exacta/prefijo)
- [x] `HelpChatWidget.tsx` envía `clinic_id` + `user_role: roles[0]`
- [x] `AyudaInterna.tsx`: tab "Base de conocimiento" (FAQ activos + Para revisar candidatos con badge)
- [x] Skill `~/.claude/skills/clinica-faq-bot/SKILL.md` — gestión FAQ desde Claude Code
- [x] 25 FAQs semilla con triggers naturales (no comandos de máquina)

## Completado (Jun 17, 2026 — Flujo completo tab + security fix)

### Tab "Flujo completo" en CaminoPaciente ✅
- [x] `FlujoPacientePanel` component: 7 etapas del flujo operativo (desde `memoria/proyectos/flujo1-camino-paciente-completo.md`)
- [x] Cada etapa: número badge coloreado + nombre + sub-pasos
- [x] Sección objetivos del sistema (7 puntos)
- [x] Sección preguntas abiertas (CSF por chat, digitalización estudios)
- [x] Sin imports nuevos — usa `ListChecks` y `ShieldCheck` ya importados
- [x] Tab "Flujo completo" agregado al TabsList en `/configuracion/camino-paciente`
- [x] commit `8968f94`

### Fix seguridad: v_presupuesto_ejecucion SECURITY DEFINER ✅
- [x] Vista `public.v_presupuesto_ejecucion` tenía `SECURITY DEFINER` (alerta crítica Supabase Advisors)
- [x] Recreada con `WITH (security_invoker = on)` — ahora respeta RLS del usuario que consulta
- [x] Migration aplicada via MCP: `fix_v_presupuesto_ejecucion_security_invoker`
- [x] Verificado: `reloptions=[security_invoker=on]` en `pg_class`

## Completado (Jun 17, 2026 — Chat IA verificado + archivos locales)

### Chat IA (help-chat-ai) — VERIFICADO FUNCIONANDO ✅
- Edge function v5 ACTIVE, `verify_jwt=true`
- Prueba real via endpoint temporal `GET /ping-ia` confirmó: Claude Haiku responde, `ANTHROPIC_API_KEY` configurada (`sk-ant-...`)
- Endpoint de prueba eliminado — producción limpia, solo acepta JWT válidos
- QA user `qa.pruebas@clinica-mexico-spa.test` re-deshabilitado: `banned_until=2126-06-17`

### Servidor local de archivos (`scripts/local-file-server.cjs`) ✅
- Cero dependencias externas para core (http/fs/path/os)
- Sharp opcional: imágenes → WebP quality 82, ~35-60% menos peso
- PUT `/upload/:nombre` → guarda en `~/Clinica/Estudios`, retorna URL local
- GET `/files/:nombre` → sirve inline (PDF/imágenes) o como descarga
- `StudyResultDrawer.tsx` usa el servidor para adjuntar estudios a pacientes
- Ejecutar: `node scripts/local-file-server.cjs`
- Migración futura: Cloudflare R2 (sin egress fees, 10GB free)

## Completado (Jun 16, 2026 — captcha en prod + resync BD local + push)

### Captcha Turnstile en producción — verificado funcionando
- Site key + secret key configurados (Cloudflare Turnstile + Supabase Auth dashboard)
- GitHub Actions secret `VITE_TURNSTILE_SITE_KEY` agregado vía `gh secret set`
- Gotcha real: widget requiere hostnames explícitos en Cloudflare (`localhost`, `integrika.mx`) — error `110200` si falta, tarda ~1-2 min en propagar tras agregarlo
- Confirmado en vivo: widget bloquea automatización CDP (`agent-browser`, error `600010`) — comportamiento esperado, prueba real la hizo el usuario en producción y confirmó que funciona

### BD local SQL Server (`PABLO\LUCCA`, base `integrika`) — resync completo de esquema
- Estaba congelada desde 12 jun con solo 31 tablas; prod tiene 113
- Generé DDL T-SQL automático desde `information_schema` de Supabase (mapeo de tipos: uuid→UNIQUEIDENTIFIER, jsonb→NVARCHAR(MAX), enums→NVARCHAR(50) sin CHECK, timestamptz→DATETIMEOFFSET) — sin FKs (mirror estructural, no enforcement)
- 82 tablas nuevas creadas, **113/113 ahora** — incluye camino del paciente completo, farmacia/POS, caja/turnos, CFDI, almacén/compras, enfermería, notificaciones
- Datos de las 31 tablas viejas verificados intactos post-resync (medicamentos=51, etc.)
- **Solo esquema, sin copiar datos** de las 82 tablas nuevas — eso sería el siguiente paso si se necesita

### Git — 11 commits pusheados a origin/main
- Disparó deploy automático (GitHub Actions / Lovable sync)

## Completado (Jun 16, 2026 — resync completo BD local + backups)

### BD local SQL Server — resync de DATOS (no solo esquema)
- Detecté drift adicional: 31 tablas viejas (de antes del 12 jun) tenían **47 columnas faltantes** vs prod (ej. `clinic_id` en casi todas, `assigned_nurse_id` en appointments, columnas de proveedores/medicamentos nuevas) — agregadas con `ALTER TABLE`
- Eliminé **todas las FK constraints** locales (40 constraints) — eran de la creación manual original, bloqueaban los DELETE; consistente con el diseño sin-FK ya usado en las 82 tablas nuevas (mirror estructural puro, sin enforcement)
- Borré y recargué **41 tablas con datos reales** desde prod (942 filas) vía una sola query UNION en Supabase + generación de INSERT tipados (uuid, jsonb, booleanos, timestamps mapeados correctamente)
- Verificado: conteos finales coinciden exacto con prod (mensajes=466, medicamentos=51, appointments=16, etc.)
- Las tablas con 0 filas en prod también se vaciaron localmente (por si tenían data vieja de seeds anteriores)

### Backup de código — 2 mecanismos
1. **Git bundle** (resguardo real, recomendado): `C:\Users\pablo\Backups\clinica-mexico-spa\clinica-mexico-spa-YYYYMMDD-HHMMSS.bundle` — incluye TODO el historial (todas las ramas, stash, worktrees), verificado con `git bundle verify`. Restaurable 100% offline con `git clone archivo.bundle`.
2. **Tabla SQL `project_files_backup`** (en `integrika`, consultable): `file_path`, `content` (texto) o `content_binary` (binarios), `size_bytes`, `commit_hash`, `snapshot_at`. 492/492 archivos del repo cargados (snapshot del estado actual, sin historial — no sustituye git).
- Gotcha real: `sqlcmd` en modo texto interpreta líneas como `GO` **dentro del contenido de archivos** como comandos de batch, rompiendo la carga a mitad — no usar sqlcmd con SQL generado como texto plano para contenido arbitrario. Usar ADO.NET (`System.Data.SqlClient`) con parámetros tipados (`SqlParameter`) — inmune a esto, sin necesidad de escapar nada.
- Estos son snapshots puntuales, no automatizados — repetir manualmente cuando se quiera refrescar.

## Completado (Jun 16, 2026 — manuales de usuario + chat de ayuda + portal Docusaurus)

### Manuales in-app
- `ManualButton.tsx` — botón "?" en header de toda la app, resuelve manual por ruta vs `manual_paginas`, corta en "## Implementación" antes de mostrar al usuario final
- Tablas `manual_paginas` (18 filas) + `manual_consultas` (auditoría)
- **18/18 manuales** en `docs/manual-usuario/` — uno por pantalla real, tono "tú"/cajero, sección técnica oculta del usuario final, escritos verificando cada .tsx real (no inventados)

### Chat de ayuda ("hablar con humano")
- `HelpChatWidget.tsx` (botón flotante, cualquier usuario) + `AyudaInterna.tsx` (`/ayuda-interna`, staff: tomar/responder/cerrar sesiones)
- Tablas `ayuda_chat_sesiones`/`ayuda_chat_mensajes` + RPC `ayuda_chat_resolver_usuarios`
- IA (Ollama) pospuesta a propósito — Cloudflare Workers/Supabase Edge no pueden hostear un modelo persistente

### Portal público Docusaurus
- `manual-site/` → `integrika.mx/manual` (mismo Worker, sin proyecto Cloudflare extra)
- `npm run build:all` = vite build + Docusaurus build + copia a `dist/manual/`
- Branding propio derivado del teal de la app (skill `frontend-design`)

### Fixes de seguridad/proceso encontrados en el camino
- `public.profiles.supervisor_pin_hash` sin RLS (hash de PIN expuesto a cualquiera con anon key) → RLS habilitado, solo admin
- `.gitignore` excluía `memoria/` completo sin justificación → removida, 22 archivos subidos a git (sin secretos reales, verificado)

### ~~Pendiente inmediato~~ — RESUELTO (verificado Jun 22)
- ~~Commit + push manuales/chat/Docusaurus~~ — YA COMMITIDO en `c836bfc` (55 archivos, ManualButton.tsx, copy-manual-build.cjs, portal Docusaurus, chat ayuda). Nota era falso positivo.

## Completado (Jun 22, 2026 — /pitch fix + rediseño Pro Max)

### /pitch — arreglada + actualizada + Huashu Design ✅

- [x] Root cause blank page: Lottie import (`eval` interno) bloqueado por CSP Cloudflare — eliminado
- [x] `src/pages/Pitch.tsx` reescrito completo (863 → nueva versión sin Lottie):
  - Marca corregida: IntegriKa (era "ClínicaMX")
  - 9+ módulos reales: CFDI 4.0, Almacén 3-Way Match, BI, Google Calendar, Multi-clínica, Stripe
  - Dashboard mockup CSS puro (sin Lottie)
  - Tabla competitiva vs Huli / Mi-Consultorio / Medesk con checkmarks
  - ROI calculado: +$13,601 MXN/mes neto vs plan Profesional
  - Pricing 4 tiers: Básico $999 / Esencial $2,499 / Profesional $5,999 / Empresarial
  - FAQ con acordeón, scroll progress bar, animated counters
- [x] Huashu Design prototype: https://claude.ai/design/p/2637bc2e-e557-47fe-ba6d-4cd2b7f77ec1?file=pitch.dc.html
  - Diseño Pro Max: hero dark #0B1829 + bot Telegram animado (conversación real en loop)
  - Tipografía: Syne (display) + Plus Jakarta Sans (body) + DM Mono (datos)
- [x] Build `npm run build:all` limpio (3.38s) · deploy `a84c7cac` a integrika.mx/pitch ✅

## Completado (Jun 22, 2026 — schema drift 25 archivos)

### Schema drift post-limpieza types.ts — 0 errores TypeScript ✅ (commits `13031da`, `765d246`)

Causa raíz: `types.ts` estaba corrompido (Supabase CLI inyectaba stdout). Al repararlo, el anti-patrón `as never) as ReturnType<typeof supabase.from>` rompió porque TypeScript lo resolvía a la primera vista en el archivo (`v_presupuesto_ejecucion`), haciendo que TODAS las columnas fallaran.

- [x] **4 errores simples** (commit `13031da`): `status: "confirmada" as const`, `activeClinic?.id`, `tipo: "primera_vez"`, `.eq("clinic_id", activeClinic.id)` (4 archivos)
- [x] **21 archivos restantes** (commit `765d246`):
  - `useAuditLog.ts`, `useBitacoraTemperatura.ts`, `useCotizaciones.ts`, `usePresupuesto.ts`: eliminado cast roto, tablas en types.ts — acceso directo
  - `Agenda.tsx`: cast roto en `doctor_bloqueos`
  - `CotizacionesPanel.tsx`: cast roto + `title=` → `aria-label=` (Lucide v3 eliminó prop) + `descripcion` → `motivo` en `solicitudes_compra`
  - `PacientesLista.tsx`: `motivo` → `motivo_consulta`, `numero_receta` → `prescription_number`, `diagnostico` → `diagnosis`; tipos locales `Appointment`/`Prescription` actualizados; JSX sincronizado
  - `useDashboardHoy.ts`: `apellido_paterno` → `apellidos` (x3 usos)
  - `ReporteCOFEPRIS.tsx`, `ReporteRotacionABC.tsx`: `activeClinic?.nombre` → `activeClinic?.name` (ClinicLite usa `name`)
  - `useBI.ts`: `c.status === "no_show"` → `(c.status as string) === "no_show"` (no en enum)
  - `ConfiguracionPagos.tsx`: `"payment_gateway_config" as unknown as "appointments"` → `as any` (tabla sí está en types.ts)
  - `Expedientes.tsx`: `tipo` cast correcto; 7 usos `as never` → `untypedTable("expediente_permissions")` (tabla no en types.ts); importado `untypedTable`
  - `Auditoria.tsx`: casts incorrectos `pos_error_logs`/`audit_logs` eliminados (tablas en types.ts); `datos_nuevos.folio_corte` → `String(...)` para ReactNode
  - `DetalleCita.tsx`: importado `Json` desde types.ts; `as unknown as Record<string,unknown>` → `as unknown as Json` en RPC args
  - `CaminoPaciente.tsx`: callbacks `.map()` `Record<string,unknown>` → `any`; `config_json` cast a `Json`
  - `EvaluacionProveedores.tsx`: cast enriquecido con campos reales de `proveedores` (rfc, estatus_efos, etc.)
  - `AdminDashboard.tsx`: casts ad-hoc `doctorsList`/`roomsList` para tipos inferidos por Supabase
  - `DashboardCompras.tsx`: `r.folio` → `r.folio_recepcion`
  - `OrdenesCompra.tsx`: estado `expandedItems` tipado como `OrdenCompraItem[]` (no `ItemInput[]`); import corregido
  - `ThreeWayMatchPanel.tsx`: `RecItem` + campo `medicamentos` opcional
  - `useDoctorQueue.ts`: `JourneyRow.appointment_id` → `string | null`; `snapshot_json` → `Json | null`
  - `RecepcionDashboard.tsx`: cast `(convRes.data ?? []) as any[]` para evitar mismatch tipo inferido
  - `Farmacia.tsx`: `medicamentoId={editMed}` → `medicamentoId={editMed.id}`
  - `ConfiguracionCFDI.tsx`: eliminado `as any` innecesario (tabla en types.ts)
- [x] `tsc -p tsconfig.app.json --noEmit` = **0 errores**
- [x] CI Quality checks ✅ · Deploy Cloudflare Workers ✅ · commit `765d246`

## Completado (Jun 22, 2026 — /aprende + blindaje legal LFPDPPP)

### /aprende — 7 lecciones capturadas ✅
- Lecciones escritas en `~/.claude/projects/C--Users-pablo-clinica-mexico-spa/memory/`:
  - `lesson_supabase-as-never-return-type-rompe.md` — anti-patrón `as never + ReturnType` rompe al reparar types.ts
  - `lesson_supabase-from-as-unknown-string-inutil.md` — cast en argumento no bypasea tipo; solo `untypedTable()` funciona
  - `lesson_cliniclite-name-no-nombre.md` — ClinicLite usa `.name`, no `.nombre`
  - `lesson_ordencompra-item-vs-input-confusion.md` — estado DB usa `OrdenCompraItem`, no `OrdenCompraItemInput`
  - `lesson_lucide-v3-title-prop-eliminada.md` — usar `aria-label`, no `title`
  - `lesson_state-md-nota-commit-pendiente-falso-positivo.md` — verificar con `git log` antes de re-commitear
- Project-doc: sección "Schema Drift — Mapeo de columnas reales" añadida a `CLAUDE.md` + `AGENTS.md` creado
- MEMORY.md actualizado con las 6 lecciones nuevas

### Blindaje legal básico LFPDPPP ✅ (commit `ad72e3a`)

Análisis: el checklist de EE.UU. (FTC/CCPA/DMCA) fue adaptado al marco mexicano real.
- **Crítico**: LFPDPPP — datos de salud son "datos sensibles", requieren consentimiento explícito + Aviso de Privacidad formal
- **Medio**: ToS con cláusula de arbitraje (Código de Comercio MX) — pendiente abogado
- **Bajo**: Claims IA bajo LFPC Art. 32; DMCA/LFDA (riesgo bajo para este tipo de contenido)

Documentos creados:
- `docs/legal-blindaje.md` — análisis LFPDPPP vs marco EE.UU., prioridades por urgencia
- `docs/legal-plan-implementacion.md` — plan de trabajo técnico + legal, cronograma 6 semanas

Técnico implementado (sin abogado):
- `src/pages/AvisoPrivacidad.tsx` — página `/aviso-privacidad` pública (placeholder con banners "pendiente revisión legal")
- `src/pages/TerminosServicio.tsx` — página `/terminos` pública (placeholder)
- `src/App.tsx` — rutas `/aviso-privacidad` y `/terminos` agregadas (públicas, sin ProtectedRoute)
- `src/components/PacienteModal.tsx` — checkbox consentimiento obligatorio en nuevo registro; deshabilita botón hasta marcar; guarda `consentimiento_privacidad_at` + `consentimiento_privacidad_version: "1.0"` en insert
- `supabase/migrations/20260622100001_patients_consentimiento_privacidad.sql` — columnas `consentimiento_privacidad_at` y `consentimiento_privacidad_version` en `patients`
- `supabase/functions/telegram-webhook/index.ts` — saludo actualizado: "asistente virtual con IA" + disclaimer "no sustituye criterio médico"
- `AGENTS.md` — creado con mapeo columnas DB reales + anti-patrón Supabase prohibido
- `CLAUDE.md` — sección "Schema Drift — Mapeo de columnas reales" + regla anti-patrón `as never`

### Revisión avisos privacidad competidores + skill legal-mx ✅ (commit `f413dca`)

Investigación: Doctoralia Terapia MX, Laboratorio del Chopo, nueva LFPDPPP 2025.
Hallazgo crítico: **INAI disuelto 21-mar-2025 → SAyBG** (Secretaría de Anticorrupción y Buen Gobierno).
Nueva ley exige: especificar cuáles datos, finalidades necesarias vs voluntarias, sección IA/decisiones automatizadas.

- `~/.claude/skills/legal-mx/SKILL.md` — skill creado: LFPDPPP 2025, aviso privacidad, ToS, datos salud, IA
- `src/pages/AvisoPrivacidad.tsx` — actualizado LFPDPPP 2025: SAyBG, sección decisiones automatizadas/IA, finalidades necesarias vs voluntarias, Anthropic como encargado, plazos ARCO exactos
- `src/pages/Login.tsx` — links "Aviso de Privacidad · Términos de Servicio" en pie de página
- `src/components/AppLayout.tsx` — links "Privacidad · Términos" en footer del sidebar
- `docs/legal-blindaje.md` — tabla alerta cambios LFPDPPP 2025, SAyBG como autoridad actual

### Migración consentimiento + types.ts ✅ (commit `3b25c2e`)

- Renombrado `20260622100001` → `20260622100002` (conflicto con `doctor_calendars_vault`)
- `20260622100002_patients_consentimiento_privacidad.sql` aplicado en prod vía `--include-all`
- `types.ts` regenerado: `consentimiento_privacidad_at` y `consentimiento_privacidad_version` tipados
- `PacienteModal.tsx`: `as any` eliminado — insert tipado limpio
- `tsc --noEmit` = 0 errores

### Investigación artículos legales exactos + análisis casos INAI ✅

Fuentes consultadas: casos reales INAI 2020-2024, LFPDPPP DOF 20-mar-2025, LGS reforma 2026, NOM-004/NOM-024.

`docs/legal-articulos.md` creado — referencia interna con:
- Art. 3 fracción VI: datos sensibles de salud (lista abierta)
- Arts. 15-16: aviso de privacidad (elementos exactos obligatorios)
- Art. 9: consentimiento expreso + escrito para datos sensibles
- Arts. 21-34: derechos ARCO (20 días hábiles respuesta, 15 días implementación)
- Arts. 58-65: sanciones (hasta 640,000 UMAs para datos sensibles ≈ $69.5M MXN)
- NOM-004: retención 5 años adultos, 25 años menores
- LGS Arts. 71 Bis/Ter/Quater: expediente electrónico obligatorio 2026

**Patrones de pérdida en casos reales INAI:**
1. Hospital negó expediente → multa $4.6M pesos por no responder solicitud ARCO
2. Clínica reveló análisis clínicos sin consentimiento → sin aviso de privacidad
3. Médico compartió diagnóstico mental → no pudo probar que paciente vio el aviso
- Defensa "uso personal sin fines comerciales" → nunca funciona
- Defensa "no soy sujeto regulado" → nunca funciona
- Sector salud = 35% de todas las multas INAI (2° lugar tras financiero)

### Proceso ARCO + snapshot aviso ✅ (commit `4f273ef`)

Basado en casos reales: hospital perdió $4.6M por no responder solicitud. No responder = infracción automática.

**BD (migración `20260622150000`):**
- `privacy_notice_versions` — versión + hash inmutable; prueba legal de qué texto aceptó cada paciente
- `arco_requests` — folio, deadline 28 días (~20 hábiles), status workflow, RLS anon INSERT

**Edge function `arco-request`:** valida → inserta → notifica admin Telegram (telegram_admin_chat_id)

**Frontend:**
- `/solicitud-arco` — formulario público, éxito con folio + plazo legal visible
- `/admin/arco` — KPIs urgencia, alerta roja si hay solicitudes vencidas, modal gestión
- `AvisoPrivacidad.tsx` — link al formulario + bloque versión/hash visible para titulares
- Login footer + sidebar: link "Derechos ARCO"

**Pendiente (requiere abogado/acción externa):**
- Texto real del Aviso de Privacidad LFPDPPP → actualizar hash en `privacy_notice_versions` y aviso
- Términos de Servicio con cláusula de arbitraje (Código de Comercio Arts. 1415-1463)
- Addendum B2B con clínicas — deslinde responsabilidad datos de salud
- DPA (Data Processing Agreement) con Supabase Inc.
- Designar oficial de protección de datos (LFPDPPP Art. 29)
- Política retención/eliminación 5 años NOM-004

**Estado técnico LFPDPPP — completo sin abogado:**
✅ Aviso publicado (borrador) · ✅ Links visibles · ✅ Consentimiento + timestamp en BD
✅ Sección IA/decisiones automatizadas · ✅ SAyBG (no INAI) · ✅ Finalidades necesarias/voluntarias
✅ Anthropic declarado · ✅ Log auditoría · ✅ RLS · ✅ HTTPS + Vault · ✅ Proceso ARCO operativo
✅ Snapshot versión aviso en BD · ✅ Alerta vencimiento ARCO en admin

---

## Completado (Jun 28, 2026 — fixes farmacia + módulo enfermería UI)

### Fixes críticos pharmacy_register_sale ✅

Rama `feat/loyalty-etapa2` mergeada a `main` y desplegada tras resolver 3 bugs:
- [x] **`v_item` ambigüedad PL/pgSQL** — alias `_elem` en bloque PERFORM (`20260628000002`)
- [x] **`movimientos_inventario.created_by`** — INSERT usaba columna `user_id` (no existe); fix: `created_by` (`20260628000003`)
- [x] **loyalty_members RLS** — policy `pwa_auth_read` usaba `auth.users` directamente → `permission denied`; fix: claims JWT `auth.jwt()->'app_metadata'`
- [x] Merge `feat/loyalty-etapa2` → `main` (tests 63/63) · push · deploy Workers `a6a40119`
- Usuario confirmó: "ya quedo el cobro y la afiliación" ✅

### Módulo Enfermería UI ✅ (commits `c463343..5e24c36`)

Plan: `docs/superpowers/plans/2026-06-28-enfermeria-insumos-entrega-turno.md`
Spec: `docs/superpowers/specs/2026-06-28-enfermeria-insumos-entrega-turno-design.md`
Deploy Workers: `30a3a2d0` · `integrika.mx/enfermeria` operativo ✅

- [x] **Task 1** — `src/features/enfermeria/entregaTurnoHelpers.ts` — interfaces `PacienteRow`/`PendienteRow` + 4 helpers puros; `src/test/enfermeria/entrega-turno.test.ts` — 5/5 tests TDD (RED→GREEN). Commit `c463343`
- [x] **Task 2** — `src/features/enfermeria/EntregaTurno.tsx` — componente React completo: Dialog (crear), tabla 30 registros, Sheet (detalle + cerrar turno). Filas dinámicas pacientes/pendientes. `list_nurses()` RPC + `rooms` selector. Commit `db1ab60`
- [x] **Task 3** — `src/pages/Enfermeria.tsx` (2 tabs) + ruta `/enfermeria` + nav item Stethoscope. Commit `23df897`
- [x] **Post-review fixes** — guard `getUser()` auth error, `clinic_id` filter en `fetchEntregas`, rooms error handling, `turno as string` cast removido. Commit `5e24c36`
- tsc 0 errores · vitest 68/68 · build limpio · revisión final APPROVED

### Notas técnicas

- `wrangler.jsonc` estaba en git (`15a1e75`) — `wrangler deploy` usa Workers assets (no Pages)
- Proyecto Pages `clinica-mexico-spa` creado hoy (era nuevo) — dominio oficial sigue siendo Workers
- `integrika.mx` = Custom domain en Cloudflare apuntando al Worker `clinica-mexico-spa`

## Completado (Jun 28, 2026 — Expediente Electrónico NOM-004 + Vista Paciente Enriquecida)

### Vista paciente enriquecida ✅ (deploy `7c05ac70`)
- [x] `PacienteHistorialDrawer` en `PacientesLista.tsx`: stats header (total citas, recetas, gasto farmacia completada, última visita)
- [x] Doctor name en tab Citas (PostgREST embedded `doctors(nombre,apellidos)`)
- [x] Tab "Notas" — notas clínicas SOAP vía `expedientes→notas_consulta` (2-step query)
- [x] 5 queries en Promise.all único (antes eran 4 separadas); link "Expediente completo" → `/expediente/:patientId`

### Expediente Electrónico NOM-004-SSA3-2012 ✅ (deploy `7c05ac70`)
- [x] Tabla `antecedentes_clinicos` en Supabase con RLS (`has_role` admin/doctor/nurse):
  - Heredofamiliares (8 condiciones + notas)
  - No patológicos (tabaquismo, alcoholismo, drogas, actividad física, escolaridad, ocupación, estado civil)
  - Patológicos (enfermedades, cirugías, hospitalizaciones, fracturas, transfusiones, inmunizaciones)
  - Gineco-obstétricos (menarca, IVSA, FUM/FUP, G/P/C/A, método AC, papanicolaou, mastografía)
  - UNIQUE(patient_id), trigger `updated_at`
- [x] `src/pages/ExpedienteElectronico.tsx` — página `/expediente/:patientId`:
  - 7 secciones NOM-004: Identificación, Heredofamiliares, No patológicos, Patológicos, Gineco-obstétricos, Notas SOAP, Prescripciones
  - Form editable antecedentes con upsert automático (botón "Guardar antecedentes")
  - Sección Gineco-Obstétricos solo visible si `sexo = 'F'` o null
  - Botón "Imprimir" (`window.print()`) con `@media print` + pie de página firmas/sello
  - Layout dual: UI editable en pantalla / vista compacta al imprimir
  - Toolbar sticky con botones Regresar / Guardar / Imprimir
- [x] Ruta `/expediente/:patientId` en `App.tsx` (roles: admin, doctor, nurse)
- [x] `types.ts` regenerado desde Supabase prod

---

## Completado (Jul 1, 2026 — ciclo compras nav + code review + CxP BI)

### Botones navegación ciclo compras ✅
- [x] SC "Cotizar →" → `navigateTo("cotizaciones")`, CotizacionesPanel pre-selecciona SC
- [x] Cotizaciones "Generar OC →" → `navigateTo("oc")`, OrdenesCompra pre-rellena proveedor
- [x] OC "Registrar recepción →" → `navigateTo("recepcion")`, RecepcionMercancia pre-selecciona (solo confirmada/parcial)
- [x] FacturasProveedor gate: pago bloqueado hasta `recepcion_estatus = 'verificada'`, salvo `requiere_anticipo`
- [x] Migration: `ordenes_compra.requiere_anticipo boolean DEFAULT false`

### Code review HIGH — 8 findings CONFIRMED, todos fixed ✅
1. Tab names `"ordenes"`→`"oc"`, `"recepciones"`→`"recepcion"` (botones de nav completamente rotos)
2. `clearCtx()` incondicional → solo en éxito fetch
3. Sin `.catch()` en fetch cotizacion → preserva ctx en fallo red
4. `ocFetched.current.add(id)` antes de resolver → movido a callback success
5. Swallowed error FacturasProveedor → no marca como fetched si error
6. `handleOCSelect` en OC no-recibible → guard estatus añadido
7. `ctxApplied` refs redundantes eliminados (CotizacionesPanel, RecepcionMercancia)
8. `grOk = !!f.recepcion_id` → `f.recepcion_estatus === 'verificada'`
9. `as never` casts → `untypedTable()` en FacturasProveedor + OrdenesCompra
10. `useFacturasProveedor`: join GR estatus + campo `recepcion_estatus`

### CxP BI — Inteligencia de Negocios con Proveedores ✅
Migration `20260701130000_cxp_bi_proveedores.sql` (PENDIENTE: `supabase db push --linked --include-all`):
- `proveedores`: +8 cols BI (clasificacion_abc, rfc_verificado, clabe, limite_credito, dias_credito, descuento_pronto_pago_pct, dias_pronto_pago)
- `historial_clabe_proveedor` tabla + RLS (control dual COSO)
- `cxp_alertas` tabla + RLS + triggers anti-duplicado UUID SAT + límite crédito
- 4 views: `kpi_dpo_proveedor`, `concentracion_proveedores`, `kpi_descuento_pronto_pago`, `resumen_alertas_cxp`

**Pendiente siguiente sesión:**
- [ ] `supabase db push --linked --include-all` (2 migrations pendientes)
- [ ] Hook `useCxpAlertas` + UI badge + lista resolvable en tab CxP
- [ ] Populate `fecha_limite_pronto_pago` al crear factura
- [ ] UI enriquecer form proveedores (clasificación, CLABE, límite, descuento)

---

## ⏸ PENDIENTE 1 — punto de pausa (Jun 28, 2026)

> Se regresa aquí después de skills/revisiones de seguridad al proyecto.

### Externos / Legales (requieren acción fuera del código)
- [ ] **Twilio** — configurar en Supabase Auth dashboard (prerequisito OTP SMS producción)
- [ ] **Aviso de Privacidad** — texto real con abogado (hoy es placeholder LFPDPPP)
- [ ] **Términos de Servicio** — cláusula de arbitraje (Código de Comercio Arts. 1415-1463)
- [ ] **DPA con Supabase Inc.** — Data Processing Agreement
- [ ] **Oficial protección de datos** — designar (LFPDPPP Art. 29)

### Features pendientes (código — para siguiente sesión)
- [ ] **BI fase 2** — top 10 productos farmacia por ingresos, heatmap citas por hora/día, tasa retención pacientes (% regresan < 90d)
- [ ] **Vista paciente enriquecida** — historial completo (citas, recetas, pagos, caminos) en PacientesLista
- [ ] **DischargeForm mejorado** — diagnóstico final, documentos entregados en alta
- [ ] **Bot GCal** — `VITE_GOOGLE_CLIENT_ID` pendiente en `.env` local (botón "Conectar" en AdminUsuarios)
- [ ] **notify-cxp/notify-new-user** → `notification_rules` (patrón ya existe, migración pendiente — LOW priority)
- [x] **Wizard apertura turno** — fix: acta arqueo ahora usa `full_name ?? email` para cajero (97a5a8b, 2026-06-28)

---

## Reglas críticas
- SQL con `$function$` → SIEMPRE escribir `_tmp_*.sql` y usar `--file`
- Secrets: env-only, nunca en código
- `patients.sexo` CHECK: solo `'M'`, `'F'`, `'Otro'`
- `patients` no tiene `domicilio_ciudad` → usar `municipio`
- `verify_jwt = false` en telegram-webhook
- Crear usuarios auth.users por SQL: columnas `*_token` deben ser `''`, nunca NULL (GoTrue rompe)
- `banned_until` (timestamp futuro) = forma de deshabilitar cuenta sin eliminarla; `null` = habilitada
- Comentarios HTML (`<!-- -->`) en `.md` rompen build MDX/Docusaurus — usar cursiva `_texto_`
- Antes de declarar un backup "completo": `git ls-files <carpeta>` vs `find <carpeta> -type f` — `.gitignore` puede contradecir la documentación en silencio

## Archivos clave
- `src/features/farmacia/PuntoDeVenta.tsx` — POS principal
- `src/features/farmacia/PaymentCapture.tsx` — captura de pagos
- `src/features/farmacia/TicketInterno.tsx` — ticket con IVA
- `src/pages/CajaTurno.tsx` — turnos generales con cortes X/Z
- `src/pages/Auditoria.tsx` — logs con tab Farmacia/Caja
- `src/hooks/useAuth.tsx` — auth con TOKEN_REFRESHED fix
- `supabase/migrations/_tmp_fix_turno_close_fallback.sql` — turno_close fallback pharmacy shift
- `supabase/migrations/_tmp_fix_pharmacy_iva.sql` — IVA en pharmacy_register_sale
- `supabase/migrations/_tmp_fix_pharmacy_shift_lifecycle.sql` — ciclo completo open/close shifts
