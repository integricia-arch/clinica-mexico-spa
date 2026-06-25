# Farmacia Fidelización — Etapa 2 Design Doc

**Fecha:** 2026-06-25  
**Branch objetivo:** `feat/loyalty-etapa2`  
**Spec Etapa 1:** `docs/superpowers/specs/2026-06-24-farmacia-fidelizacion-design.md`

## Contexto

Etapa 1 mergeada a main (`2b4ad85`). 57 tests pasando, build limpio, deploy en `loyalty.integrika.mx`.

Etapa 2 lleva el módulo a **producción completa**: descuento real en POS, idempotencia en RPC, páginas ARCO en PWA, e ícono PWA definitivo.

---

## Ítem 1 — Descuento lealtad en POS (Opción A)

### Problema
`loyaltyDescuento` existe en state (`PuntoDeVenta.tsx:194`) pero nunca se resta del `total` calculado. El cajero ve el descuento confirmado pero cobra el monto completo.

### Solución

**Migración SQL** (`20260625000007_loyalty_discount_column.sql`):
```sql
ALTER TABLE pharmacy_sales
  ADD COLUMN IF NOT EXISTS loyalty_discount numeric NOT NULL DEFAULT 0;
```

**`pharmacy_register_sale` RPC** — agregar en `p_payload`:
- Leer `loyalty_discount` del JSON (default 0)
- Persistirlo en `pharmacy_sales.loyalty_discount` en el INSERT

**`PuntoDeVenta.tsx`** — cambios mínimos y focalizados:
```ts
// Nueva derivación después de línea 432
const totalConLealtad = Math.max(0, total - loyaltyDescuento)
```

Reemplazar `total` por `totalConLealtad` en:
1. `validatePayment(payment, totalConLealtad, bd)` — línea 485
2. `useEffect` de breakdown (sincroniza montos de pago) — líneas 456-462
3. Payload de `submitSale`: agrega `loyalty_discount: loyaltyDescuento`, y el campo `total` implícito que calcula la RPC usa el subtotal de items (no cambia en RPC)
4. UI de cobro: mostrar `totalConLealtad` como monto a cobrar
5. Ticket: línea "Descuento lealtad: -$X.XX" cuando `loyaltyDescuento > 0`

**Invariante:** `loyaltyDescuento` se resetea a 0 en `clearCart` (igual que `loyaltyMemberId`).

### Trazabilidad
- `pharmacy_sales.discount` = descuento manual manager (sin cambio)
- `pharmacy_sales.loyalty_discount` = descuento por puntos canjeados
- `loyalty_movimientos` registra el canje con `tipo = 'canje'` (ya existente)
- Ticket imprimible muestra ambos descuentos por separado

---

## Ítem 2 — Idempotency guard en `loyalty_register_sale`

### Problema
Si `submitSale` se llama dos veces (retry de red, doble-click), `loyalty_register_sale` acumula puntos dos veces por la misma `pharmacy_sale_id`.

### Solución

**Migración** (`20260625000008_loyalty_register_sale_idempotent.sql`) — nuevo `CREATE OR REPLACE FUNCTION`:

```sql
-- Al inicio del BEGIN, antes de cualquier otro SELECT:
IF EXISTS (
  SELECT 1 FROM loyalty_movimientos
   WHERE pharmacy_sale_id = p_sale_id
     AND tipo = 'acumulacion'
) THEN
  SELECT puntos_disponibles, nivel
    INTO v_saldo_nuevo, v_nivel_nuevo
    FROM loyalty_members WHERE id = p_member_id;
  RETURN json_build_object(
    'ok', true,
    'puntos_ganados', 0,
    'saldo_nuevo', v_saldo_nuevo,
    'nivel', v_nivel_nuevo,
    'idempotent', true
  );
END IF;
```

Sin cambios en frontend. Guard 100% en RPC. Re-aplicar la migración es seguro (`CREATE OR REPLACE`).

---

## Ítem 3 — SMS Twilio (configuración manual)

**No hay código.** Prerequisito de producción que requiere acceso al Supabase dashboard.

Pasos:
1. Supabase dashboard → Authentication → Providers → Phone
2. Enable → seleccionar Twilio
3. Ingresar: `Account SID`, `Auth Token`, `Messaging Service SID`
4. Guardar

Sin esta configuración, OTP funciona por email (graceful degrade). La PWA no rompe.

El `signInWithOtp({ phone })` en `useLoyaltyPWA.ts` ya es correcto — Supabase enruta automáticamente.

---

## Ítem 4 — Páginas ARCO en PWA

### Rutas nuevas en `LoyaltyApp.tsx`
```tsx
<Route path="/aviso-privacidad" element={<PrivacidadPage />} />
<Route path="/solicitud-arco" element={<ArcoPage />} />
```

Los links en `Cuenta.tsx:55-57` ya apuntan a estas rutas — funcionan sin cambio.

### `src/pwa/pages/PrivacidadPage.tsx`
- Texto legal LFPDPPP: responsable de datos, finalidades (acumulación de puntos, marketing con consent), transferencias (ninguna sin consentimiento), derechos ARCO, contacto (`integric.ia@gmail.com`)
- Back button → navega a `/cuenta`
- Diseño consistente con el resto de la PWA (Geist + teal brand)

### `src/pwa/pages/ArcoPage.tsx`
- Formulario: nombre (texto), identificador (email o teléfono), tipo de derecho (select: Acceso / Rectificación / Cancelación / Oposición), descripción (textarea)
- Validación client-side: todos los campos requeridos
- Submit → `supabase.functions.invoke('loyalty-arco-request', { body: formData })`
- Edge Function `loyalty-arco-request`:
  - `verify_jwt = false` con validación de campo `honeypot` anti-spam
  - Envía email a `integric.ia@gmail.com` via Resend con los datos del formulario
  - No guarda en DB (solicitudes gestionadas manualmente por correo)
- Estado post-submit: mensaje de confirmación "Solicitud recibida — responderemos en 20 días hábiles (LFPDPPP Art. 24)"

### Seguridad Edge Function
- Rate limit implícito de Supabase (no requiere implementación extra)
- Honeypot field oculto: si viene lleno → responder 200 sin enviar email (anti-bot)
- No exponer detalles internos en respuesta de error

---

## Ítem 5 — PWA Icon

### Problema
`public/icons/loyalty-192.png` es placeholder teal sin contenido visual identificable.

### Solución
Script `scripts/generate-loyalty-icon.mjs` (ESM):
- Dependencia: `@resvg/resvg-js` (renderiza SVG → PNG sin canvas nativo)
- Genera SVG con:
  - Fondo `#0f766e` (loyalty brand teal)
  - Ícono de monedero (Lucide `wallet` path simplificado) en blanco centrado
  - Radio de borde redondeado (estilo app icon moderno)
- Output: `public/icons/loyalty-192.png` (192×192) y `public/icons/loyalty-512.png` (512×512)
- Se ejecuta una vez: `node scripts/generate-loyalty-icon.mjs`
- Los archivos generados se commitean (no se regeneran en build)

`loyalty-manifest.json` ya referencia ambos tamaños — no requiere cambio.

---

## Tests

- **Ítem 1:** tests unitarios `loyalty-discount-pos.test.ts` — validar que `totalConLealtad` es correcto con distintos valores de `loyaltyDescuento`, incluyendo descuento mayor al total (debe ser 0)
- **Ítem 2:** test SQL o integration test — llamar `loyalty_register_sale` dos veces con mismo `p_sale_id`, verificar que `loyalty_movimientos` solo tiene 1 fila de acumulación y segunda llamada retorna `idempotent: true`
- **Ítems 3,4,5:** no requieren tests automatizados (config manual, páginas estáticas, asset binario)

---

## Orden de implementación

1. Migración `loyalty_discount` column
2. RPC `pharmacy_register_sale` actualizada (agrega `loyalty_discount`)
3. RPC `loyalty_register_sale` con idempotency guard
4. `PuntoDeVenta.tsx` — integrar `totalConLealtad`
5. `PrivacidadPage.tsx` + `ArcoPage.tsx` + rutas en `LoyaltyApp.tsx`
6. Edge Function `loyalty-arco-request`
7. Script ícono PWA → generar y commitear PNGs
8. Tests
9. `supabase db push --linked --include-all`
10. Build + deploy Cloudflare Workers

---

## Archivos afectados

| Archivo | Tipo de cambio |
|---------|---------------|
| `supabase/migrations/20260625000007_loyalty_discount_column.sql` | nuevo |
| `supabase/migrations/20260625000008_loyalty_register_sale_idempotent.sql` | nuevo |
| `supabase/functions/loyalty-arco-request/index.ts` | nuevo |
| `src/features/farmacia/PuntoDeVenta.tsx` | modificar |
| `src/pwa/LoyaltyApp.tsx` | modificar (rutas) |
| `src/pwa/pages/PrivacidadPage.tsx` | nuevo |
| `src/pwa/pages/ArcoPage.tsx` | nuevo |
| `scripts/generate-loyalty-icon.mjs` | nuevo |
| `public/icons/loyalty-192.png` | regenerar |
| `public/icons/loyalty-512.png` | nuevo |
| `src/test/lealtad/loyalty-discount-pos.test.ts` | nuevo |
