# N2/N3/N4 — Unit economics + decisión pricing (Fable 5, 2026-07-21)

Continuación de `N2-N3-N4-pricing-handoff.md`. Solo decisión + doc; implementación → Sonnet.

## Hallazgo que cambia el planteo de N2

`catalogo_modulos` en prod **NO está en ceros**. Los 5 módulos ya tienen precio y
`stripe_price_id` activos:

| Módulo (slug) | Precio/mes | stripe_price_id |
|---|---|---|
| POS / Farmacia (`pos_farmacia`) | $3,149 | price_1TrJta… |
| Facturación CFDI (`facturacion_cfdi`) | $2,449 | price_1TrJux… |
| Agenda (`agenda`) | $1,749 | price_1TrJsx… |
| Almacén (`almacen`) | $1,599 | price_1TrRpG… |
| Compras (`compras`) | $1,499 | price_1TrJuX… |

Suma à la carte: **$10,445 MXN/mes** vs Profesional $5,999 → el bundle da ~43% de
descuento implícito. Coherente como ancla de precio.

## N3 — Costos externos (asunciones = precio de lista, confirmar solo si hay tarifa negociada)

| Proveedor | Supuesto | MXN/mes aprox (FX 19) | Nota |
|---|---|---|---|
| Supabase | Pro, US$25/mes/proyecto | ~$475 | Fijo, compartido entre las 5 clínicas |
| Cloudflare Workers | Paid, US$5/mes | ~$95 | Fijo, compartido |
| Stripe MX | 3.6% + $3 MXN + IVA por cargo | variable | Solo tiers con checkout (Esencial/Profesional) |
| PAC de timbrado | ~$1 MXN/timbre (lista típica API) | $0 hoy | **SIN CONTRATAR (confirmado Pablo 2026-07-21).** El código apunta a Facturama (`cfdi_config.pac_ambiente` sandbox/prod) pero no hay cuenta de producción con timbres. CFDI en Profesional NO es vendible hasta contratar PAC |
| WhatsApp | Meta Cloud API directo (NO Twilio — verificado `whatsapp-webhook/index.ts:35`, `graph.facebook.com`) | **$0 hoy** | Código y schema desplegados, pero 0 de 5 clínicas con `whatsapp_phone_number_id` → no operativo en prod. Cuando active: ~US$0.02–0.045/msg template (~$0.40–0.85 MXN) |
| Telegram | Bot API | $0 | Gratis |

Infra fija total ≈ **$570 MXN/mes** para toda la plataforma (~$114/clínica con 5 tenants;
cae con cada tenant nuevo).

## N3 — Unit economics por tier

| Tier | ARPU | Stripe fee | Costo variable | Infra prorrateada | Margen bruto | % |
|---|---|---|---|---|---|---|
| Básico | $999 | $0 (venta manual) | ~$0 (Telegram gratis) | ~$114 | ~$885 | ~89% |
| Esencial | $2,499 | ~$93 | ~$0 | ~$114 | ~$2,292 | ~92% |
| Profesional | $5,999 | ~$219 | timbres: ~$1 × N | ~$114 | ~$5,666 − N | ~94% − timbres |
| Empresarial | a medida | — | — | — | — | fijar piso ≥ Profesional |

**Umbrales de quiebre:**
- Profesional se vuelve negativo hasta ~5,600 timbres/mes a $1/timbre — irreal para una
  clínica de ≤15 doctores (una clínica típica hace cientos, no miles). **CFDI no amenaza margen.**
- Básico con WhatsApp futuro: a ~$0.60/msg, quiebra a ~1,650 msgs/mes. Recordatorios
  (2-3 por cita) × ~200 citas/mes = ~600 msgs → ~$360, come 36% del ARPU de $999.
  **Regla: cuando WhatsApp se active, NO incluirlo en Básico, o cap de 300 msgs/mes.**

Conclusión N3: márgenes ~90% en todos los tiers hoy. El único costo variable con
capacidad real de erosionar margen es WhatsApp (aún inactivo). Stripe y timbres son ruido.

## N2 — Decisión: híbrido (tiers como oferta principal + add-ons como palanca de venta asistida)

Los add-ons ya existen de facto (precios + stripe_price_ids en prod). Revertir a "tiers
puros" implicaría desactivar trabajo hecho sin beneficio. Decisión:

1. **Tiers siguen siendo la única oferta self-serve** (Pitch.tsx no cambia estructura).
2. **Add-ons quedan como venta asistida** (Empresarial/upsell puntual: ej. Esencial +
   `facturacion_cfdi` a $2,449 = $4,948, escalón intermedio antes de Profesional $5,999).
   No exponer en UI pública — evita canibalizar Profesional y evita mantener otra matriz
   de checkout.
3. `catalogo_modulos` se queda como está (precios sirven de ancla y de tarifa para venta
   asistida).

## N4 — Auditoría de enforcement (matriz confirmada CON gaps)

RLS gateado vía `clinic_has_modulo_access()`: `farmacia`, `pos_farmacia`, `almacen`,
`compras`, `facturacion_cfdi` (tablas). ✅ 4 de 5 módulos del catálogo.

**Gaps encontrados:**

| # | Gap | Severidad | Acción |
|---|---|---|---|
| 1 | `cfdi-timbrar` Edge Function NO valida `clinic_has_modulo_access` — corre con service role (bypassa RLS). Clínica Básico que llame la función directo puede timbrar. | Alta | Sonnet: check de módulo al inicio del handler |
| 2 | BI: solo gating de UI, sin gate en RLS/RPC (`kpis_dashboard` sin check de módulo en migraciones de gating). | Media | Sonnet: check en RPC `kpis_dashboard` (o aceptar como feature "soft" y documentarlo) |
| 3 | `agenda` tiene precio $1,749 en catálogo pero CERO gates en RLS — funciona como core para todos. Incoherencia catálogo vs enforcement. | Baja | Decidir: si agenda es core (lo es — Básico la incluye), es solo tarifa de venta asistida; documentar en catálogo, no gatear |
| 4 | Google Calendar sync, Stripe pagos, multi-clínica: features de tier sin enforcement técnico (solo UI). | Baja | Aceptado — costo de bypass bajo, no bloquear |

## Acciones para Sonnet (priorizadas)

1. **`cfdi-timbrar`: agregar validación `clinic_has_modulo_access(clinic_id, 'facturacion_cfdi')`** antes de timbrar (gap #1).
2. Gate en RPC `kpis_dashboard` para módulo BI, o nota de aceptación de riesgo (gap #2).
3. Comentario/columna en `catalogo_modulos` marcando `agenda` como core-incluido (gap #3, cosmético).
4. Sin cambios en Pitch.tsx ni en precios de catálogo.

## Escenario de escalamiento (confirmado por Pablo 2026-07-21): Supabase Pro + WhatsApp activo + n8n

Supuestos de precios de lista (FX 19 MXN/USD):

| Componente | 5 clínicas (hoy) | 20 clínicas | 50 clínicas |
|---|---|---|---|
| Supabase Pro (base + compute/storage) | US$25 | ~US$35 | ~US$85 (upgrade compute + storage overage) |
| Cloudflare Workers Paid | US$5 | US$5 | US$5 (10M req incluidos, sobra) |
| n8n | US$10 (self-host VPS) o US$26 (Cloud Starter, 2.5k ejec/mes) | US$26–60 (Cloud Pro si >2.5k ejec) | ~US$60 (Cloud Pro) |
| **Fijo total** | ~US$40–56 (~$760–1,065 MXN) | ~US$66–100 (~$1,255–1,900) | ~US$150 (~$2,850) |
| **Fijo por clínica** | ~$150–215 MXN | ~$65–95 MXN | ~$57 MXN |

El fijo por clínica **baja** al escalar — la infraestructura no es el problema.

### WhatsApp activo — el único costo variable relevante

Meta Cloud API México, template **utility** (recordatorios): ~US$0.02/msg ≈ **$0.40 MXN**.
Marketing template: ~US$0.044 ≈ $0.85 — NO usar para recordatorios, duplica costo.

Clínica típica: ~200 citas/mes × 3 mensajes (confirmación + recordatorio 24h + recordatorio 2h)
= **600 msgs ≈ $240 MXN/mes por clínica**.

### Márgenes por tier a escala (20 clínicas, WhatsApp activo, n8n Cloud)

| Tier | ARPU | Stripe | WhatsApp | Timbres | Infra | Margen | % |
|---|---|---|---|---|---|---|---|
| Básico (sin WA) | $999 | $0 | $0 | $0 | ~$80 | ~$919 | 92% |
| Básico (si incluyera WA) | $999 | $0 | −$240 | $0 | ~$80 | ~$679 | 68% |
| Esencial (con WA) | $2,499 | −$93 | −$240 | $0 | ~$80 | ~$2,086 | 83% |
| Profesional (con WA) | $5,999 | −$219 | −$240 | ~−$300 | ~$80 | ~$5,160 | 86% |

### Decisiones de pricing derivadas (futuro próximo)

1. **WhatsApp entra desde Esencial, no en Básico.** Básico conserva Telegram (gratis).
   Alternativa: add-on "WhatsApp" ~$499/mes con cap 800 msgs (margen ~52% sobre el add-on)
   — encaja con la decisión N2 de venta asistida.
2. **Cap de mensajes por tier obligatorio** (Esencial 800/mes, Profesional 2,000/mes) —
   sin cap, una clínica de alto volumen (500+ citas) puede duplicar el costo variable.
   Enforcement: contador en tabla + corte en Edge Function de envío (acción Sonnet cuando
   WhatsApp se active).
3. **Solo templates utility** para flujos transaccionales. Marketing templates = feature
   de add-on futuro (campañas), nunca incluido en tier.
4. **Precios actuales NO necesitan subir por costos** — margen ≥83% en todos los
   escenarios. Cualquier ajuste de precio futuro es por valor, no por costo.

### Validaciones técnicas antes de escalar (checklist futuro próximo)

- [ ] **Supabase Pro multi-tenant en un solo proyecto aguanta hasta ~50 clínicas**, pero
  vigilar: conexiones (usar pooler/transaction mode ya), tamaño DB (8 GB incluidos en Pro),
  compute (Small incluido; upgrade a Medium ~US$60 si CPU sostenido >70%). Métrica de
  disparo: dashboard Supabase → Reports → Database.
- [ ] **n8n: decidir Cloud vs self-host.** Self-host necesita VM persistente (mismo
  límite ya documentado para Ollama — Workers/Edge Functions no corren procesos
  persistentes). Cloud Starter US$26 evita ops; self-host US$10 si ya hay VPS.
- [ ] **WhatsApp Business: verificación de negocio Meta** por clínica (o número central
  de plataforma) — proceso manual, semanas. Empezar trámite antes de vender la feature.
- [ ] **Contratar PAC (bloqueante para vender CFDI/Profesional).** Hoy NO hay proveedor
  de timbres en producción — solo integración de código contra Facturama en sandbox.
  Opciones típicas (precios de lista, verificar al contratar): Facturama API (paquetes
  desde ~$0.50–1.50/timbre según volumen), SW Sapien/Smarter Web, Finkok. Criterio:
  API REST compatible con la integración ya escrita (Facturama = cero retrabajo).
  A escala (50 clínicas × ~300 timbres = 15,000/mes) negociar paquete anual — unitario
  cae bien abajo de $1.
- [ ] **Rate limiting S1 ya cubre las funciones abusables** — al activar WhatsApp, la
  función de envío entra a la misma lista (nueva función = nuevo límite).

## Pendiente de Pablo (único dato faltante)

- ~~Confirmar paquete Facturama~~ → resuelto 2026-07-21: **no hay PAC contratado**.
  Nueva acción: elegir y contratar PAC antes de vender CFDI (ver checklist arriba).
- Plan Supabase: hoy puede ser Free; **Pro confirmado como plan al escalar** (Pablo
  2026-07-21). Márgenes calculados con Pro — si hoy es Free, margen actual es mayor.
- n8n: decidir Cloud (~US$26/mes) vs self-host (~US$10 VPS) cuando entre a producción.
