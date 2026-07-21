# Análisis Integral — IntegriKa / clinica-mexico-spa (2026-07-21)

Alcance: fortalezas, mejoras, faltantes en UX, seguridad, escalabilidad + validación de modelo de negocio, marketing, precios y paquetes. Cada tarea trae modelo asignado e indicaciones de cierre.

Convención de modelos:
- **Haiku 4.5** — tareas mecánicas, copy, fixes chicos de UI, docs. Barato, rápido.
- **Sonnet** — desarrollo principal: features, tests, refactors acotados.
- **Opus 4.8** — arquitectura, debugging complejo, auditorías de seguridad profundas.
- **Fable 5** — solo planeación transversal, decisiones de negocio, sesiones que mezclan varios dominios. NO usarlo para ejecutar tareas ya especificadas (lección: sesión de $650).

---

## 1. FORTALEZAS (no tocar, capitalizar)

1. **Multi-tenant real con RLS auditada.** `clinic_memberships`, checklist SECURITY DEFINER obligatorio, advisors corridos por hábito. Pocas plataformas MX chicas tienen esto.
2. **Cobertura funcional enorme para el precio**: agenda, EHR NOM-004, farmacia FEFO, POS + corte ciego, compras 3-Way Match, CFDI nativo (timbrar/cancelar/REP/acuse), contabilidad partida doble NIF con IVA, BI, lealtad PWA, bot Telegram + WhatsApp, manuales Docusaurus, ARCO/LFPDPPP. Es el diferenciador competitivo real vs Huli/Medesk.
3. **Módulo contable cerrado y citado contra norma** (NIF/LISR/LIVA, memoria técnica §12). Vendible a contadores como feature seria.
4. **SaaS billing operativo**: Stripe Checkout, webhook verificado, grace period + lock cron, panel de tenants, catálogo de módulos.
5. **Memoria/proceso de ingeniería**: STATE.md, learnings, migraciones idempotentes, protocolo Lovable, runbooks (rotación service role, MFA recovery). Reduce costo de cada sesión futura.
6. **Cumplimiento legal MX ya encaminado**: LFPDPPP opt-in activo, ARCO, aviso de privacidad, PHI access log, libro de controlados.

---

## 2. SEGURIDAD

### Estado
Base sólida (RLS, SECURITY DEFINER con search_path, vault inline, MFA, captcha Turnstile, 9 funciones verify_jwt=false todas con auth alterna documentada). Bugs de bypass service_role (`crear_poliza`, `update_journey_progress`) ya corregidos.

### Tareas

**S1. Auditoría de rate limiting en Edge Functions — Opus 4.8**
- Problema: no hay evidencia de rate limit en `create-tenant`, `verify-tenant-code`, `arco-request`, `help-chat-ai`, `stripe-payment-intent`. Endpoints públicos = abuso/costo.
- Acciones: (1) inventariar las 41 functions y clasificar expuestas sin límite; (2) implementar contador por IP/identidad en tabla `rate_limits` o KV de Cloudflare para las 5-6 críticas; (3) test negativo (burst 20 req → 429).
- Cierre: tabla en `docs/edge-functions-auth.md` con columna "rate limit", advisors limpio, test pasa.

**S2. Warnings preexistentes de advisors ("authenticated puede ejecutar RPC", GraphQL visibility) — Sonnet**
- Acciones: correr `get_advisors(security)`, listar cada warning, decidir por RPC: REVOKE de `authenticated` si solo la llaman otras RPCs/service_role, o documentar por qué queda. Deshabilitar GraphQL si no se usa (`pg_graphql`).
- Cierre: advisors sin warnings o cada uno con comentario SQL justificándolo.

**S3. Dependencias y supply chain — Haiku 4.5**
- Acciones: `npm audit`, `npm ls framer-motion` (regla: 1 copia), revisar Dependabot config activa, actualizar criticals.
- Cierre: 0 criticals, PR de bumps mergeado.

**S4. Pen-test ligero del flujo tenant onboarding — Opus 4.8**
- `create-tenant` + `verify-tenant-code` + provisioning queue es la superficie nueva más sensible (crea clínicas y usuarios). Probar: replay de código de verificación, race de doble provisión, email spoofing en `platform_staff_pending` (¿cualquiera puede insertarse? verificar policy).
- Cierre: reporte corto en memoria + fixes aplicados + advisors limpio.

**S5. Riesgo residual Optimus (repo terceros sin fix) — sin acción de código.** Solo vigilar; ya documentado en STATE.md.

---

## 3. UX / EXPERIENCIA DE USUARIO

### Estado
App funcional pero desktop-first; landing /pitch ya auditada (a11y, reduced-motion, contraste). Manuales 29 pantallas. Fricción conocida en tablet (farmacia/POS) y en ayuda humana.

### Tareas

**U1. Plan farmacia responsive (11 tasks, NO ejecutado desde jun-09) — Sonnet**
- Plan ya escrito: `docs/superpowers/plans/2026-06-09-farmacia-responsive.md`. Empezar Task 1 (`useIsTablet`), cambiar `lg:`→`xl:` en AppLayout (4 lugares) y POS grid.
- Cierre: los 11 tasks con check, probado en viewport 768-1279px, merge a main, deploy.

**U2. UI de chat de ayuda "hablar con humano" — Sonnet**
- Tablas `ayuda_chat_sesiones`/`ayuda_chat_mensajes` existen; falta UI de operador (bandeja para staff) y polish del widget. Sin IA por ahora (decisión pospuesta, respetar).
- Cierre: staff puede responder desde Inbox/AyudaInterna, realtime o polling, mensaje de horario cuando nadie atiende.

**U3. Deep-links `:id` para cita/venta/compra — Sonnet (diseño con Opus si crece)**
- Hoy solo `?highlight=` sobre listas. Suficiente v1, pero rompe compartir URL y limita notificaciones. Evaluar rutas `/citas/:id` reutilizando `DetalleCita`.
- Cierre: al menos cita individual con ruta propia; `?highlight=` se mantiene como fallback.

**U4. Onboarding de primer uso por rol — Sonnet + copy Haiku 4.5**
- Falta: primer login de admin de clínica nueva cae en dashboard vacío. Checklist guiado (dar de alta doctor → servicio → horario → primera cita) subiría activación (métrica SaaS clave).
- Cierre: componente checklist persistente por clínica, oculto al completar 100%.

**U5. Accesibilidad app interna (no solo /pitch) — Haiku 4.5**
- Acciones: pasar axe/lighthouse a Dashboard, Citas, POS, Login; corregir labels, focus traps en dialogs Radix (mayormente gratis), contraste de badges.
- Cierre: 0 errores críticos axe en 5 pantallas top.

**U6. Estados vacíos y errores amigables — Haiku 4.5**
- Barrido de pantallas con tablas vacías sin CTA. Usar `useFieldErrors` ya existente en formularios que no lo tengan.
- Cierre: cada lista principal con empty-state + acción.

---

## 4. ESCALABILIDAD / DEUDA TÉCNICA

### Estado
Stack sano (Vite + Cloudflare Workers + Supabase escala bien para cientos de clínicas). Riesgos: archivos gigantes, cobertura de tests baja, drift de migraciones recurrente.

### Tareas

**E1. Cobertura de tests — Sonnet (sostenido, varias sesiones cortas)**
- Hoy: vitest + playwright instalados, pocos tests (ivaRules, AdminTenants). Regla del repo pide 80% — lejos.
- Prioridad de cobertura (no todo): (1) RPCs contables vía pgTAP o tests de integración SQL (`crear_poliza`, `cierre_mensual`, `kpis_dashboard`); (2) flujos POS/corte ciego; (3) E2E Playwright: login→cita→cobro→corte (el ciclo que ya se validó a mano con PRUEBA-E2E, automatizarlo).
- Cierre: CI corre `vitest run` + 1 suite E2E smoke en GitHub Actions; PR falla si rompe.

**E2. Partir archivos gigantes — Haiku 4.5 (mecánico) con revisión Sonnet**
- `Pitch.tsx` >1,400 líneas, probable `Citas.tsx`/`Farmacia.tsx` similares. Regla repo: máx 800.
- Acciones: `wc -l src/pages/*.tsx`, extraer secciones a componentes sin cambiar lógica, `tsc --noEmit` + build tras cada uno. OJO lección: exports named vs default.
- Cierre: ningún archivo >800 líneas en src/pages.

**E3. Code-splitting / lazy routes — Sonnet**
- App carga todos los módulos en un bundle (Pitch no lazy fue causa del bug motion). `React.lazy` por ruta pesada (Contabilidad, BI, Farmacia, Pitch).
- Cierre: `vite build` muestra chunks por ruta, bundle inicial <40% del actual, smoke E2E pasa.

**E4. Drift de migraciones Lovable↔CLI — Sonnet (proceso, no código)**
- Ya pasó 2 veces (~25 migraciones sin commitear). Acción: script `scripts/check-migration-drift.ps1` que corra `supabase migration list --linked` y falle si hay remotas sin archivo; correrlo en session-sync y en CI semanal.
- Cierre: script en repo + paso agregado a SKILL session-sync.

**E5. Índices y performance BD — Sonnet con skill supabase-postgres-best-practices**
- Acciones: `get_advisors(performance)`, EXPLAIN de queries top (listas de citas por clínica+fecha, kpis_dashboard, balanza), índices compuestos `(clinic_id, fecha)` donde falten.
- Cierre: advisors performance limpio o justificado; queries top <100ms en datos reales.

**E6. Activos fijos + depreciación — Sonnet (BLOQUEADO por humano)**
- Investigado, no construido. Bloqueo: confirmar tasa fiscal de equipo médico con el contador (acción de Pablo, no de modelo). Cuentas 131/606 ya existen.
- Cierre: no arrancar hasta tener tasa; luego plan en memoria técnica §11.

---

## 5. MODELO DE NEGOCIO — validación

### Lo que está bien
- **Pricing 3 tiers ($999 / $2,499 / $5,999 MXN/mes)** con ancla "menos que una secretaria" — narrativa correcta para el segmento (clínica chica-mediana MX).
- Comparativa vs stack fragmentado ($2,280–2,630/mes en herramientas sueltas) — argumento sólido, el bundle a $2,499 es competitivo.
- ROI calculator interactivo con WhatsApp CTA — buen mecanismo de captura.
- Cobro recurrente + grace period + lock ya operativos = puede cobrar desde hoy.

### Riesgos / inconsistencias

**N1. ⚠️ Testimonios en /pitch parecen ficticios — Fable 5 decide, Haiku 4.5 ejecuta**
Quotes con cifras específicas ("detectó diferencia de $3,200 el primer mes"). Si no son clientes reales, es riesgo legal/reputacional (publicidad engañosa, PROFECO). Acción: Pablo confirma origen; si son ilustrativos → reetiquetar como "escenarios ilustrativos" o sustituir por resultados del piloto real. Cierre: /pitch sin claims no sustentables.

**N2. Doble esquema de precios: tiers vs `catalogo_modulos` por módulo — Fable 5 (decisión), Sonnet (implementación)**
La BD soporta precio por módulo (`precio_centavos` en catálogo) pero el pitch vende "9 módulos, un solo precio". Decidir UNA de dos:
- (a) Tiers puros: catálogo de módulos queda como feature-flag interno sin precio (poner precio_centavos=0 y ocultarlo de UI de venta), o
- (b) Tiers + add-ons: 2-3 módulos premium como add-on (p.ej. CFDI timbrado por volumen, WhatsApp, Contabilidad avanzada) — sube ARPU sin romper la promesa.
Recomendación: (b), con Esencial = todo lo operativo y add-ons solo en lo que tiene costo variable real (timbres CFDI, mensajes WhatsApp).
- Cierre: decisión escrita en memoria + panel AdminTenants refleja el esquema + pitch actualizado.

**N3. Unit economics sin documentar — Fable 5 (una sesión corta)**
Falta: costo variable por clínica (Supabase, Cloudflare, Stripe 3.6%+$3, timbres PAC, WhatsApp/Twilio, Telegram gratis) vs ARPU por tier. Calcular margen bruto por plan y break-even de clínicas. Sin esto no se puede validar $999 (probable margen negativo si usa CFDI+WhatsApp intensivo).
- Cierre: tabla de unit economics en `memoria/proyectos/` con umbral de uso donde $999 pierde dinero → alimenta N2.

**N4. Plan $999: definir qué NO incluye — Fable 5**
Hoy el pitch detalla Esencial ($2,499); el tier de entrada necesita límites claros (1 doctor, sin CFDI, sin WhatsApp, X citas/mes) para funcionar como gancho sin canibalizar. Cierre: matriz de features por tier publicada en /pitch y aplicada vía `clinic_has_modulo_access`.

**N5. Facturación del propio SaaS**: verificar que IntegriKa emite CFDI a sus clientes por la suscripción (obligatorio B2B MX). Si no: usar el propio módulo CFDI o Stripe Tax/facturación manual v1. — Sonnet tras decisión.

---

## 6. MARKETING — opciones priorizadas

**M1. Casos de estudio del piloto real — Haiku 4.5 (redacción) tras datos de Pablo**
Prioridad #1: un caso real con números verificables reemplaza a los testimonios dudosos (N1). Formato: problema → implementación → 3 métricas (no-shows, diferencia de caja, horas admin ahorradas).

**M2. SEO local + contenido — Haiku 4.5 producción, Sonnet setup técnico**
- Setup: sitemap, schema.org (`SoftwareApplication` + `Offer` por plan), meta/OG en /pitch — usar skill claude-seo-ai:audit primero.
- Contenido: 6-8 artículos long-tail en manual-site o blog: "software para clínica en México", "corte de caja farmacia", "CFDI 4.0 consultorio", "expediente clínico NOM-004". Competencia débil en español para estos términos.

**M3. Pipeline videos (plan ya existe en memoria: "Pipeline Videos Marketing IntegriKa") — retomar con Haiku 4.5 para guiones**
Demos de 60-90s por módulo (farmacia FEFO, corte ciego, bot nocturno). ElevenLabs ya configurado según memoria.

**M4. Canal de venta directa — Pablo (humano), soporte Fable 5 para materiales**
Segmento no compra por ads: venta consultiva a dueños de clínica/farmacia. Materiales: one-pager PDF por vertical (clínica GP, spa/estética, farmacia con consultorio), demo con `seed-demo-data` ya existente. WhatsApp del ROI calculator como pipeline de leads → registrar en tabla simple `leads` (Sonnet, 1 hora).

**M5. Programa de referidos entre clínicas — posponer.** Hasta tener ≥10 clientes pagando. No construir aún (YAGNI).

---

## 7. ORDEN DE EJECUCIÓN RECOMENDADO

Regla operativa: **una tarea = una sesión corta**, cortar al primer aviso de costo crítico (lección sesión $650).

| # | Tarea | Modelo | Sesión estimada |
|---|-------|--------|-----------------|
| 1 | N1 testimonios /pitch (riesgo legal) | Fable decide / Haiku edita | corta |
| 2 | S4 pen-test onboarding tenants | Opus 4.8 | media |
| 3 | S1 rate limiting | Opus 4.8 diseño, Sonnet implementa | media |
| 4 | N3 unit economics + N2 decisión pricing + N4 matriz tiers | Fable 5 | 1 sesión negocio |
| 5 | E1 tests CI (smoke E2E + RPCs contables) | Sonnet | 2-3 cortas |
| 6 | U1 farmacia responsive (plan listo) | Sonnet | 2 cortas |
| 7 | U4 onboarding primer uso | Sonnet | media |
| 8 | E3 code-splitting + E2 partir archivos | Sonnet / Haiku | 2 cortas |
| 9 | M2 SEO + M1 caso de estudio | Sonnet setup / Haiku copy | 2 cortas |
| 10 | S2 warnings advisors + S3 deps | Sonnet / Haiku | corta |
| 11 | U2 chat ayuda humano | Sonnet | media |
| 12 | E4 script drift migraciones | Sonnet | corta |
| 13 | U3 deep-links, U5 a11y, U6 empty states | Sonnet / Haiku | cortas |
| 14 | E5 índices BD | Sonnet | corta |
| 15 | E6 activos fijos | BLOQUEADO (contador) | — |

Bloqueos humanos (Pablo): confirmar testimonios (N1), tasa depreciación (E6), datos del piloto (M1), decisión final pricing (N2/N4).
