# Handoff para Fable 5 — N3 unit economics + N2 pricing + N4 matriz tiers

Preparado por Sonnet 2026-07-21, sin ejecutar decisión (regla: Fable no ejecuta, decide).

## Pricing actual real (verificado en `src/pages/Pitch.tsx:175-243`)

| Tier | Precio | checkoutPlan (Stripe) | Límite doctores | Incluye |
|------|--------|------------------------|------------------|---------|
| Básico | $999 MXN/mes | `null` — **sin checkout, solo mailto** | 1 | Bot Telegram, agenda+recordatorios, expediente básico, soporte correo |
| Esencial | $2,499 MXN/mes | `"esencial"` | 2-5 | + Farmacia POS/corte caja, expediente NOM-004 completo, Google Calendar sync, soporte prioritario |
| Profesional | $5,999 MXN/mes | `"profesional"` | hasta 15 | + CFDI 4.0, Stripe pagos, Almacén 3-Way Match, BI, multi-clínica, onboarding asistido |
| Empresarial | "A medida" | `null` — solo mailto | ilimitado | + SLA, capacitación in situ, integraciones custom |

`supabase/functions/stripe-checkout/index.ts` (`PLANS` const) solo tiene `esencial` y
`profesional` — coincide con lo de arriba. Básico y Empresarial son venta manual/consultiva.

## N4 — ya NO está abierto como se pensó

El análisis original (2026-07-21 temprano) asumía que faltaba definir qué excluye Básico.
**Ya está definido en el copy** (tabla arriba) y **ya hay enforcement real en RLS**, no solo
marketing: `clinic_has_modulo_access()` + 5 migraciones de gating
(`20260709194627_clinic_has_modulo_access.sql`,
`20260709200000_clinic_has_modulo_access_tenant_check.sql`,
`20260710120000_rls_modulo_gating.sql`,
`20260710121000_fix_clinic_has_modulo_access_trialing.sql`,
`20260710130000_rls_medicamentos_write_gate.sql`).

Lo que SÍ falta de N4: confirmar que el enforcement cubre TODOS los módulos premium listados
(ej. ¿Farmacia/CFDI/BI realmente bloqueados para Básico via RLS, o solo vía UI?) — auditoría
rápida, no diseño desde cero.

## N2 — esquema de precios

`catalogo_modulos` (migración `20260708120100_catalogo_modulos_schema.sql`) tiene columna
`precio_centavos integer NOT NULL DEFAULT 0` + `stripe_price_id`. Confirmar en BD si algún
módulo ya tiene `precio_centavos > 0` (add-on activo) o si todos están en 0 (tiers puros de
facto, aunque el schema soporte add-ons). Query sugerida para la sesión de Fable:
```sql
SELECT nombre, precio_centavos, stripe_price_id, activo FROM catalogo_modulos ORDER BY precio_centavos DESC;
```
Con ese resultado, Fable decide (a) tiers puros — dejar todo en 0 y ocultar de UI de venta,
o (b) tiers + add-ons — poner precio real a 1-3 módulos con costo variable alto (CFDI
timbrado, WhatsApp).

## N3 — unit economics: costos NO están en código, son de proveedores externos

No hay constantes de costo hardcodeadas en el repo (correcto — viven en dashboards de
proveedor, no en código). Fable necesita que Pablo aporte o confirme:

- **Supabase**: plan actual (Free/Pro/Team), costo mensual base + overage por proyecto/tenant.
- **Cloudflare Workers**: plan (Free/Paid $5/mes) + overage de requests.
- **Stripe**: 3.6% + $3 MXN por transacción exitosa (tarifa México estándar Stripe — confirmar
  si Pablo tiene tarifa negociada distinta).
- **Facturama (PAC de CFDI)**: `cfg.pac_ambiente` en `cfdi_config` distingue sandbox/producción
  — el costo por timbre depende del plan Facturama contratado (típicamente por paquete de
  timbres, no por evento). Confirmar plan actual.
- **WhatsApp/Twilio**: revisar si ya está integrado en prod o solo Telegram (bot Telegram es
  gratis vía Bot API). `WhatsappAlertas.tsx` existe en `src/pages/` — confirmar si usa Twilio
  y su tarifa por mensaje.
- **Telegram**: gratis (Bot API sin costo).

Con esos 5 números + el ARPU de cada tier (tabla arriba), Fable puede calcular margen bruto
por plan y el umbral de uso (timbres/mes, mensajes WhatsApp/mes) donde Básico ($999) se
vuelve negativo.

## Entregable esperado de la sesión Fable

1. Tabla de unit economics (costo variable estimado vs ARPU) por tier, en
   `memoria/proyectos/` (nuevo doc o append aquí).
2. Decisión N2 escrita (tiers puros vs add-ons) con justificación.
3. Confirmación/ajuste de N4 (matriz ya existe — solo auditar gaps de enforcement).
4. Lista de acciones concretas para Sonnet si algo requiere código (ej. poner precio a un
   módulo, ajustar RLS gating faltante, actualizar copy de Pitch.tsx).

**No ejecutar código en la sesión de Fable** — solo decisión + doc. Implementación pasa a
Sonnet después.
