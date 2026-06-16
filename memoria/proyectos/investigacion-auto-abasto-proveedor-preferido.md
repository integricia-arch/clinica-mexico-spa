# Investigación: Sistema de Auto-Abasto con Proveedor Preferido por Artículo

**Proyecto:** integrika.mx — Clínica México SPA  
**Fecha:** 2026-06-15  
**Autor:** Investigación técnica generada con asistencia de IA  
**Alcance:** Diseño e implementación de auto-reorden con asignación de proveedor preferido por medicamento

---

## 1. Contexto del Sistema Actual

El sistema integrika.mx ya cuenta con:

- Tabla `medicamentos` con columnas `stock_minimo` y `stock_maximo`
- Punto de reorden funcional: detecta `stock_actual < stock_minimo`
- Órdenes de compra con flujo: `borrador → pendiente_aprobacion → confirmada`
- Hook `useOrdenesCompra.create()` disponible en el frontend
- Edge Functions de Supabase activas
- Email transaccional via Resend (ya configurado para CxP)
- Tabla `proveedores` con `proveedor_id`, datos fiscales, CLABE, `terminos_pago`

Lo que **falta** es la capa de inteligencia que asigna proveedores a artículos, agrupa reórdenes eficientemente y genera/envía OCs automáticamente.

---

## 2. Modelo de Datos: Proveedor Preferido por Artículo

### 2.1 Referentes de la Industria

**Odoo (vendor pricelist):**  
Odoo implementa la relación producto↔proveedor en la tabla `product.supplierinfo`. Cada registro almacena: proveedor, precio pactado, cantidad mínima, tiempo de entrega y secuencia de preferencia. Cuando se dispara una regla de reorden (`reordering rule`), Odoo selecciona automáticamente el primer proveedor de la lista cuya cantidad mínima sea satisfecha por el lote a ordenar. Si hay múltiples proveedores, la secuencia determina la prioridad. El campo `delay` (días de entrega) influye en el cálculo de la fecha esperada de recepción.

**SAP Business One (preferred vendor):**  
En el `Item Master Data`, la pestaña `Purchasing Data` permite asignar hasta N proveedores preferidos por artículo (campos `Preferred Vendor` con botón multi-selección). Cuando el `Procurement Wizard` o el `MRP` genera una recomendación, SAP B1 usa automáticamente el proveedor preferido primario para poblar el `Purchase Order`. El registro de proveedor en el ítem incluye: código de proveedor, número de catálogo del proveedor, precio unitario acordado y unidad de medida de compra.

**Conclusión de referentes:** el modelo de tabla de "lista de precios de proveedor por artículo" (vendor pricelist / supplier pricelist) es el estándar en la industria. Permite múltiples proveedores por artículo con una jerarquía clara.

---

### 2.2 Schema SQL: `medicamento_proveedores`

```sql
-- ============================================================
-- TABLA PRINCIPAL: proveedor preferido por artículo
-- ============================================================
CREATE TABLE medicamento_proveedores (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    medicamento_id      UUID NOT NULL REFERENCES medicamentos(id) ON DELETE CASCADE,
    proveedor_id        UUID NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,

    -- Jerarquía: 1 = primario, 2 = secundario, 3 = terciario
    proveedor_orden     SMALLINT NOT NULL DEFAULT 1 CHECK (proveedor_orden BETWEEN 1 AND 5),

    -- Precios y condiciones pactadas
    precio_pactado      NUMERIC(12, 4) NOT NULL CHECK (precio_pactado > 0),
    moneda              CHAR(3) NOT NULL DEFAULT 'MXN',
    precio_vigente_desde DATE NOT NULL DEFAULT CURRENT_DATE,
    precio_vigente_hasta DATE,                              -- NULL = sin vencimiento

    -- Restricciones de pedido
    minimo_pedido       NUMERIC(10, 2) NOT NULL DEFAULT 1,  -- en unidades del medicamento
    multiplo_pedido     NUMERIC(10, 2) NOT NULL DEFAULT 1,  -- ej: solo múltiplos de 12
    maximo_pedido       NUMERIC(10, 2),                     -- NULL = sin límite

    -- Logística
    plazo_entrega_dias  SMALLINT NOT NULL DEFAULT 3,        -- días hábiles
    codigo_proveedor    VARCHAR(100),                       -- SKU del medicamento en catálogo del proveedor
    iva_aplica          BOOLEAN NOT NULL DEFAULT TRUE,

    -- Control
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    notas               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    -- Un proveedor no puede estar dos veces con el mismo orden para el mismo medicamento
    UNIQUE (medicamento_id, proveedor_id),
    UNIQUE (medicamento_id, proveedor_orden)
);

-- Índices de consulta frecuente
CREATE INDEX idx_med_prov_medicamento ON medicamento_proveedores(medicamento_id);
CREATE INDEX idx_med_prov_proveedor   ON medicamento_proveedores(proveedor_id);
CREATE INDEX idx_med_prov_activo      ON medicamento_proveedores(medicamento_id, activo, proveedor_orden);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_med_prov_updated_at
BEFORE UPDATE ON medicamento_proveedores
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLA DE HISTORIAL: precios históricos para auditoría
-- ============================================================
CREATE TABLE medicamento_proveedores_historial (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    medicamento_proveedor_id UUID NOT NULL REFERENCES medicamento_proveedores(id),
    precio_anterior         NUMERIC(12, 4),
    precio_nuevo            NUMERIC(12, 4),
    cambiado_por            UUID REFERENCES auth.users(id),
    cambiado_en             TIMESTAMPTZ DEFAULT NOW(),
    motivo                  TEXT
);

-- ============================================================
-- TABLA DE COOLDOWN: evitar duplicación de OC automáticas
-- ============================================================
CREATE TABLE auto_reorden_log (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    medicamento_id      UUID NOT NULL REFERENCES medicamentos(id),
    proveedor_id        UUID NOT NULL REFERENCES proveedores(id),
    orden_compra_id     UUID REFERENCES ordenes_compra(id),
    ejecutado_en        TIMESTAMPTZ DEFAULT NOW(),
    estado              VARCHAR(50) NOT NULL DEFAULT 'generada',
    -- 'generada' | 'enviada' | 'error' | 'cancelada'
    error_mensaje       TEXT,

    -- Cooldown: no generar nueva OC al mismo proveedor para el mismo medicamento
    -- en menos de N días
    UNIQUE (medicamento_id, proveedor_id, ejecutado_en)
);

CREATE INDEX idx_auto_reorden_med_prov ON auto_reorden_log(medicamento_id, proveedor_id, ejecutado_en DESC);
```

---

### 2.3 Manejo de Múltiples Proveedores por Artículo

La lógica de selección sigue esta jerarquía:

1. **Proveedor primario** (`proveedor_orden = 1`): se usa cuando la cantidad a ordenar cumple el `minimo_pedido`
2. **Proveedor secundario** (`proveedor_orden = 2`): se usa cuando el primario no está disponible o está en cooldown
3. **Sin proveedor configurado**: la OC se crea en estado `borrador` sin proveedor, y se notifica a CxP para completarla manualmente

La selección debe respetar:
- `activo = TRUE`
- Precio con vigencia actual: `precio_vigente_desde <= NOW() AND (precio_vigente_hasta IS NULL OR precio_vigente_hasta >= NOW())`
- Cantidad calculada debe satisfacer `minimo_pedido` y redondearse al `multiplo_pedido`

---

## 3. Agrupación de Artículos para OC Eficiente

### 3.1 El Problema de N OCs para el Mismo Proveedor

Sin agrupación, si 15 medicamentos de "Nadro S.A." llegan a reorden el mismo día, el sistema generaría 15 OCs separadas. Esto genera:
- 15 correos al mismo proveedor
- 15 facturas en lugar de 1
- Pérdida de descuentos por volumen
- Carga administrativa innecesaria en CxP

### 3.2 Estrategia de Agrupación

**Regla principal:** una OC por proveedor por ciclo de ejecución del proceso de auto-reorden.

El ciclo puede ser diario (recomendado para farmacias/clínicas pequeñas) o cada 6-12 horas en establecimientos de mayor volumen.

**Pseudológica de agrupación:**

```
medicamentos_en_reorden = SELECT todos los medicamentos donde stock_actual < stock_minimo
  AND tiene medicamento_proveedor configurado
  AND NO existe OC activa (borrador/pendiente) para ese medicamento en los últimos N días (cooldown)

agrupar por proveedor_primario:
  Para cada proveedor_id:
    crear UNA sola ordenes_compra con todas las líneas de ese proveedor
```

### 3.3 Economic Order Quantity (EOQ) en Farmacia Pequeña

La **EOQ** es la cantidad óptima de pedido que minimiza el costo total de inventario (costo de emisión de pedido + costo de almacenamiento).

**Fórmula:**

```
EOQ = sqrt( (2 × D × S) / H )

Donde:
  D = demanda anual en unidades
  S = costo por emisión de pedido (MXN)
  H = costo de mantener 1 unidad por año (MXN)
```

**Aplicación práctica para clínica pequeña:**

Para una farmacia/clínica de baja rotación, la EOQ tiene limitaciones prácticas importantes:
- Muchos medicamentos tienen caducidad corta (no conviene acumular)
- Los proveedores tienen mínimos de pedido que pueden superar la EOQ
- El `stock_maximo` ya actúa como techo natural de la EOQ

**Recomendación práctica:** usar `stock_maximo - stock_actual` como cantidad a pedir (reposición hasta el máximo), ajustada al `multiplo_pedido` del proveedor. Reservar EOQ para los top-20 medicamentos de mayor rotación donde el cálculo justifique el esfuerzo.

### 3.4 Cuándo Agrupar vs OC Individual

| Situación | Estrategia |
|-----------|-----------|
| Múltiples medicamentos del mismo proveedor en reorden | Una sola OC agrupada |
| Medicamento urgente (stock = 0) | OC individual inmediata |
| Proveedor con mínimo de pedido por monto total | Agrupar para alcanzar el mínimo |
| Medicamento controlado (estupefaciente/psicotrópico) | OC separada, flujo manual con QFB |
| Proveedor sin email configurado | Solo crear OC en borrador, notificar CxP |

---

## 4. Auto-Generación y Envío de OC por Email

### 4.1 Referentes SaaS con Auto-Reorder

| Sistema | Capacidad Auto-Reorder | Email a Proveedor |
|---------|----------------------|-------------------|
| **Odoo** | Reglas de reorden (min/max), genera RFQ automáticamente, envío de email vía módulo de compras | Sí, configurable |
| **Cin7 (DEAR)** | Auto-reorder rules con proveedor preferido, generación de PO automática | Sí, con plantilla |
| **Brightpearl** | Demand planning con reorder automático basado en velocidad de venta | Sí |
| **NetSuite** | Reorder points con SuiteFlow para aprobación configurable | Sí, con workflow |
| **TradeGecko (ahora QuickBooks Commerce)** | Reorder automático con alertas de stock | Limitado |

**Patrón común en todos:** crean la OC en estado "pendiente de aprobación" y opcionalmente la envían al proveedor si la aprobación es automática para montos bajo un umbral.

### 4.2 Contenido del Email de OC al Proveedor

El email de OC farmacéutica debe incluir:

**Asunto:** `OC-[NUMERO] | [NOMBRE_CLINICA] | Orden de Compra - [FECHA]`

**Cuerpo (HTML):**
- Logo y datos fiscales del comprador (clínica/farmacia)
- Número de OC con folio consecutivo
- Fecha de emisión y fecha estimada de entrega requerida
- Datos del proveedor (nombre, RFC)
- Tabla de líneas: clave, descripción, unidad, cantidad, precio unitario, subtotal
- Subtotal, IVA (16%), Total
- Condiciones de pago y entrega
- Instrucciones de entrega (dirección, horario, contacto)
- Datos bancarios para confirmación de factura
- Firma electrónica o nombre del responsable de compras

### 4.3 Template Email OC en Español para Proveedor Farmacéutico

```html
<!-- supabase/functions/auto-reorder/templates/oc-proveedor.html -->
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Orden de Compra - {{numero_oc}}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #333; font-size: 13px; }
    .header { background: #1a5276; color: white; padding: 20px; }
    .header h1 { margin: 0; font-size: 18px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #2e86c1; color: white; padding: 8px; text-align: left; }
    td { padding: 8px; border-bottom: 1px solid #ddd; }
    .total-row { font-weight: bold; background: #f0f0f0; }
    .footer { background: #f5f5f5; padding: 15px; font-size: 11px; color: #666; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>ORDEN DE COMPRA No. {{numero_oc}}</h1>
    <p>{{nombre_clinica}} | RFC: {{rfc_clinica}}</p>
    <p>{{direccion_clinica}}</p>
  </div>

  <div class="info-grid">
    <div>
      <h3>Proveedor:</h3>
      <p><strong>{{nombre_proveedor}}</strong><br>
      RFC: {{rfc_proveedor}}<br>
      Attn: Depto. de Ventas</p>
    </div>
    <div>
      <h3>Detalles de la Orden:</h3>
      <p>Fecha de emisión: <strong>{{fecha_emision}}</strong><br>
      Entrega requerida: <strong>{{fecha_entrega_requerida}}</strong><br>
      Condiciones de pago: {{terminos_pago}}<br>
      Lugar de entrega: {{direccion_entrega}}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Clave</th>
        <th>Descripción del Medicamento</th>
        <th>Presentación</th>
        <th>Cantidad</th>
        <th>Precio Unit. (MXN)</th>
        <th>Subtotal (MXN)</th>
      </tr>
    </thead>
    <tbody>
      {{#lineas}}
      <tr>
        <td>{{numero_linea}}</td>
        <td>{{codigo_proveedor}}</td>
        <td>{{nombre_medicamento}}</td>
        <td>{{presentacion}}</td>
        <td>{{cantidad}}</td>
        <td>${{precio_unitario}}</td>
        <td>${{subtotal}}</td>
      </tr>
      {{/lineas}}
      <tr class="total-row">
        <td colspan="6" style="text-align:right;">Subtotal:</td>
        <td>${{subtotal_total}}</td>
      </tr>
      <tr class="total-row">
        <td colspan="6" style="text-align:right;">IVA (16%):</td>
        <td>${{iva_total}}</td>
      </tr>
      <tr class="total-row">
        <td colspan="6" style="text-align:right;">TOTAL:</td>
        <td>${{monto_total}}</td>
      </tr>
    </tbody>
  </table>

  <div style="padding: 0 20px;">
    <h3>Instrucciones de Entrega:</h3>
    <ul>
      <li>Entregar con factura CFDI 4.0 en formato XML y PDF</li>
      <li>Incluir número de OC en la factura: <strong>{{numero_oc}}</strong></li>
      <li>Temperatura de almacenamiento según ficha técnica</li>
      <li>Reportar cualquier incidencia a: <a href="mailto:{{email_cxp}}">{{email_cxp}}</a></li>
    </ul>
    <p>Para confirmar recepción de esta orden, responda este correo o comuníquese al {{telefono_clinica}}.</p>
    <p><strong>{{nombre_responsable_compras}}</strong><br>
    Departamento de Compras<br>
    {{nombre_clinica}}</p>
  </div>

  <div class="footer">
    <p>Esta orden de compra fue generada automáticamente por el sistema integrika.mx el {{fecha_generacion}}.
    Folio de referencia: {{folio_sistema}}. Esta comunicación y sus adjuntos son confidenciales.</p>
  </div>
</body>
</html>
```

### 4.4 ¿Es Seguro Enviar OC Sin Aprobación Humana?

No existe una respuesta única. La decisión depende de controles de negocio. Ver la tabla de decisiones completa en la Sección 6.

---

## 5. COFEPRIS y Medicamentos Controlados

### 5.1 Marco Regulatorio en México

La **Ley General de Salud (LGS)** clasifica los medicamentos en grupos según su nivel de control:

| Grupo | Ejemplos | Receta | Retención | Auto-reorden |
|-------|---------|--------|-----------|-------------|
| **Sin receta (OTC)** | Analgésicos, antigripales | No requerida | No | **Permitido** |
| **Receta simple** | Antibióticos, antiinflamatorios Rx | Sí | No siempre | **Permitido con umbral** |
| **Psicotrópicos Grupo III** | Benzodiacepinas, inductores del sueño | Sí (retenible) | Sí | **Solo con aprobación humana** |
| **Psicotrópicos Grupo I-II** | Anfetaminas, barbitúricos | Receta especial COFEPRIS | Sí | **Prohibido automático** |
| **Estupefacientes** | Morfina, codeína, fentanilo | Receta especial folio COFEPRIS | Sí, obligatoria | **Prohibido automático** |

### 5.2 Obligaciones para Adquisición de Controlados

Según los Arts. 244-256 de la LGS y la normatividad COFEPRIS:

1. **Libros de Control**: Para estupefacientes y psicotrópicos grupos I-II, se requiere llevar libros de control autorizados por COFEPRIS (trámite COFEPRIS-03-005)
2. **Pronóstico semestral**: Las farmacias deben presentar cada 6 meses una estimación de compra-venta de controlados (trámite COFEPRIS-03-014)
3. **Firma del QFB**: El Químico Farmacéutico Biólogo responsable sanitario debe firmar (física o con firma electrónica avanzada) los pedidos de sustancias controladas
4. **MCRS digital**: El sistema MCRS de COFEPRIS permite gestión digital de movimientos de controlados con folio único
5. **Trazabilidad obligatoria**: Cada unidad vendida/adquirida de estupefaciente debe tener número de lote, caducidad y origen rastreable

### 5.3 Flujo Diferenciado por Tipo de Medicamento

```
OTC / Sin receta
    └── Auto-reorden completa: crear OC → confirmar → enviar email proveedor

Receta simple (Rx)
    └── Auto-reorden con umbral: crear OC → si monto < umbral → auto-enviar
                                             si monto >= umbral → requiere aprobación CxP

Psicotrópicos Grupo III (benzodiacepinas)
    └── Semi-automático: detectar reorden → crear OC en BORRADOR → notificar QFB
        → QFB aprueba → OC pasa a pendiente_aprobacion → CxP confirma y envía

Psicotrópicos Grupos I-II / Estupefacientes
    └── Manual obligatorio: detectar necesidad → alerta a QFB y CxP
        → QFB solicita en MCRS → OC manual con firma → proveedor autorizado
        NUNCA auto-enviar email al proveedor
```

### 5.4 Campo Recomendado en `medicamentos`

```sql
-- Agregar a tabla medicamentos existente
ALTER TABLE medicamentos ADD COLUMN IF NOT EXISTS
    tipo_control VARCHAR(20) NOT NULL DEFAULT 'otc'
    CHECK (tipo_control IN ('otc', 'rx_simple', 'psicotropico_iii', 'psicotropico_i_ii', 'estupefaciente'));

-- Índice para filtrar en el proceso de auto-reorden
CREATE INDEX idx_med_tipo_control ON medicamentos(tipo_control);
```

---

## 6. Diseño Técnico Completo

### 6.1 Tabla de Decisiones: Cuándo Auto-Enviar vs Requerir Aprobación

| Condición | Acción del Sistema |
|-----------|-------------------|
| `tipo_control = 'otc'` Y `monto_oc < umbral_auto` | Crear OC → Confirmar → Enviar email proveedor |
| `tipo_control = 'otc'` Y `monto_oc >= umbral_auto` | Crear OC borrador → Notificar CxP para aprobación |
| `tipo_control = 'rx_simple'` Y `monto_oc < umbral_auto` | Crear OC → Pendiente aprobación → Notificar CxP |
| `tipo_control = 'rx_simple'` Y `monto_oc >= umbral_auto` | Crear OC borrador → Notificar CxP con alerta de monto |
| `tipo_control = 'psicotropico_iii'` | Crear OC borrador → Notificar QFB + CxP → Esperar firma manual |
| `tipo_control IN ('psicotropico_i_ii', 'estupefaciente')` | Solo alerta → Nunca crear OC automática |
| Proveedor sin email configurado | Crear OC borrador → Notificar CxP por email |
| OC en cooldown (< 7 días) | Omitir silenciosamente, log en `auto_reorden_log` |
| Sin proveedor configurado para el medicamento | Crear OC borrador sin proveedor → Notificar CxP |
| `monto_total = 0` o `cantidad = 0` | Error → Log → Notificar admin |

**Umbral recomendado inicial:** `umbral_auto = 5,000 MXN` (configurable en tabla de configuración del sistema)

### 6.2 Arquitectura: pg_cron + Edge Function

```
[pg_cron: diario 06:00 AM CST]
        |
        v
[PostgreSQL: SELECT medicamentos en reorden]
        |
        v (HTTP POST via pg_net)
[Edge Function: auto-reorder]
        |
        ├── Agrupar por proveedor
        ├── Calcular cantidades (hasta stock_maximo, ajuste a multiplo_pedido)
        ├── Verificar cooldown (auto_reorden_log)
        ├── Aplicar reglas de tipo_control
        ├── Crear ordenes_compra + detalle_ordenes_compra
        ├── Si aplica: cambiar estado a 'confirmada'
        ├── Si aplica: generar HTML/PDF de OC
        └── Si aplica: enviar email via Resend
```

### 6.3 Configuración pg_cron

```sql
-- Habilitar pg_cron (ya disponible en Supabase)
-- Configurar en Supabase Dashboard > Database > Extensions > pg_cron

-- Crear job diario a las 06:00 AM hora de Ciudad de México (UTC-6 en horario de verano)
-- 06:00 CST = 12:00 UTC
SELECT cron.schedule(
    'auto-reorden-diario',
    '0 12 * * *',  -- Noon UTC = 6am CST
    $$
    SELECT net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/auto-reorder',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body := jsonb_build_object(
            'trigger', 'cron',
            'timestamp', NOW()
        )
    );
    $$
);

-- Ver jobs activos
SELECT * FROM cron.job;

-- Ver historial de ejecuciones
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

### 6.4 Edge Function: `auto-reorder` (Pseudocódigo Detallado)

```typescript
// supabase/functions/auto-reorder/index.ts

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const UMBRAL_AUTO_ENVIO_MXN = 5000
const COOLDOWN_DIAS = 7

Deno.serve(async (req) => {
  // 1. AUTENTICACIÓN: verificar que viene del pg_cron o de un admin
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const resend = new Resend(Deno.env.get('RESEND_API_KEY')!)

  // 2. DETECTAR MEDICAMENTOS EN REORDEN
  //    stock_actual < stock_minimo
  //    tipo_control NO es estupefaciente ni psicotropico_i_ii
  //    tiene al menos un medicamento_proveedor activo configurado
  const { data: medicamentosEnReorden, error: errorReorden } = await supabase
    .rpc('get_medicamentos_en_reorden')
  // La función RPC encapsula la consulta compleja con JOINs

  if (errorReorden) {
    console.error('[auto-reorder] Error consultando reorden:', errorReorden)
    return new Response(JSON.stringify({ error: errorReorden.message }), { status: 500 })
  }

  if (!medicamentosEnReorden || medicamentosEnReorden.length === 0) {
    console.log('[auto-reorder] Sin medicamentos en reorden hoy')
    return new Response(JSON.stringify({ message: 'Sin reórdenes pendientes' }), { status: 200 })
  }

  // 3. VERIFICAR COOLDOWN: excluir medicamentos con OC reciente
  const fechaCooldown = new Date()
  fechaCooldown.setDate(fechaCooldown.getDate() - COOLDOWN_DIAS)

  const { data: enCooldown } = await supabase
    .from('auto_reorden_log')
    .select('medicamento_id, proveedor_id')
    .gte('ejecutado_en', fechaCooldown.toISOString())
    .in('estado', ['generada', 'enviada'])

  const cooldownSet = new Set(
    (enCooldown || []).map(r => `${r.medicamento_id}:${r.proveedor_id}`)
  )

  const medicamentosActivos = medicamentosEnReorden.filter(m => {
    const key = `${m.medicamento_id}:${m.proveedor_id}`
    if (cooldownSet.has(key)) {
      console.log(`[auto-reorder] Cooldown activo: ${m.nombre_medicamento}`)
      return false
    }
    return true
  })

  // 4. APLICAR REGLAS DE TIPO DE CONTROL
  const paraAutoEnvio = medicamentosActivos.filter(m =>
    ['otc', 'rx_simple'].includes(m.tipo_control)
  )
  const paraAprobacionManual = medicamentosActivos.filter(m =>
    m.tipo_control === 'psicotropico_iii'
  )

  // 5. AGRUPAR POR PROVEEDOR
  const porProveedor = new Map()
  for (const med of paraAutoEnvio) {
    if (!porProveedor.has(med.proveedor_id)) {
      porProveedor.set(med.proveedor_id, {
        proveedor: {
          id: med.proveedor_id,
          nombre: med.proveedor_nombre,
          email: med.proveedor_email,
          rfc: med.proveedor_rfc,
          terminos_pago: med.terminos_pago
        },
        lineas: []
      })
    }

    // Calcular cantidad óptima: hasta stock_maximo, ajustada al múltiplo
    const cantidadBase = med.stock_maximo - med.stock_actual
    const cantidadAjustada = Math.ceil(cantidadBase / med.multiplo_pedido) * med.multiplo_pedido
    const cantidadFinal = Math.max(cantidadAjustada, med.minimo_pedido)

    porProveedor.get(med.proveedor_id).lineas.push({
      medicamento_id: med.medicamento_id,
      nombre: med.nombre_medicamento,
      codigo_proveedor: med.codigo_proveedor,
      presentacion: med.presentacion,
      cantidad: cantidadFinal,
      precio_unitario: med.precio_pactado,
      subtotal: cantidadFinal * med.precio_pactado
    })
  }

  // 6. CREAR ÓRDENES DE COMPRA
  const resultados = []

  for (const [proveedorId, grupo] of porProveedor) {
    const montoTotal = grupo.lineas.reduce((acc, l) => acc + l.subtotal, 0)
    const ivaTotal = montoTotal * 0.16
    const totalConIva = montoTotal + ivaTotal

    // Determinar estado inicial
    const estadoInicial = totalConIva < UMBRAL_AUTO_ENVIO_MXN ? 'confirmada' : 'pendiente_aprobacion'

    // Crear OC principal
    const { data: oc, error: errorOC } = await supabase
      .from('ordenes_compra')
      .insert({
        proveedor_id: proveedorId,
        estado: estadoInicial,
        monto_total: totalConIva,
        subtotal: montoTotal,
        iva: ivaTotal,
        fecha_entrega_esperada: calcularFechaEntrega(grupo.proveedor, grupo.lineas),
        tipo_origen: 'auto_reorden',
        notas: `Generada automáticamente por sistema auto-reorden el ${new Date().toISOString().split('T')[0]}`
      })
      .select()
      .single()

    if (errorOC) {
      console.error(`[auto-reorder] Error creando OC para proveedor ${proveedorId}:`, errorOC)
      continue
    }

    // Crear líneas de la OC
    const lineasOC = grupo.lineas.map((l, idx) => ({
      orden_compra_id: oc.id,
      medicamento_id: l.medicamento_id,
      numero_linea: idx + 1,
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
      subtotal: l.subtotal,
      codigo_proveedor: l.codigo_proveedor
    }))

    await supabase.from('detalle_ordenes_compra').insert(lineasOC)

    // Registrar en log de auto-reorden
    for (const linea of grupo.lineas) {
      await supabase.from('auto_reorden_log').insert({
        medicamento_id: linea.medicamento_id,
        proveedor_id: proveedorId,
        orden_compra_id: oc.id,
        estado: 'generada'
      })
    }

    // 7. ENVIAR EMAIL SI APLICA
    if (estadoInicial === 'confirmada' && grupo.proveedor.email) {
      const htmlEmail = generarHTMLEmail({
        oc,
        proveedor: grupo.proveedor,
        lineas: grupo.lineas,
        montoTotal,
        ivaTotal,
        totalConIva
      })

      const { error: errorEmail } = await resend.emails.send({
        from: `Compras <compras@integrika.mx>`,
        to: [grupo.proveedor.email],
        subject: `OC-${oc.numero_folio} | Integrika Clínica | Orden de Compra - ${formatFecha(new Date())}`,
        html: htmlEmail
      })

      if (errorEmail) {
        console.error(`[auto-reorder] Error enviando email a ${grupo.proveedor.email}:`, errorEmail)
        await supabase.from('auto_reorden_log')
          .update({ estado: 'error', error_mensaje: errorEmail.message })
          .eq('orden_compra_id', oc.id)
      } else {
        await supabase.from('auto_reorden_log')
          .update({ estado: 'enviada' })
          .eq('orden_compra_id', oc.id)
      }
    }

    resultados.push({ oc_id: oc.id, proveedor: grupo.proveedor.nombre, estado: estadoInicial })
  }

  // 8. NOTIFICAR MEDICAMENTOS EN REORDEN QUE REQUIEREN APROBACIÓN MANUAL
  if (paraAprobacionManual.length > 0) {
    await enviarAlertaAprobacionManual(resend, paraAprobacionManual)
  }

  return new Response(JSON.stringify({ procesados: resultados.length, resultados }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
})

// Función auxiliar: calcular fecha de entrega esperada
function calcularFechaEntrega(proveedor, lineas) {
  // Usar el plazo máximo entre todas las líneas del proveedor
  const maxPlazo = Math.max(...lineas.map(l => l.plazo_entrega_dias || 3))
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + maxPlazo)
  return fecha.toISOString().split('T')[0]
}
```

### 6.5 Función RPC PostgreSQL: `get_medicamentos_en_reorden`

```sql
CREATE OR REPLACE FUNCTION get_medicamentos_en_reorden()
RETURNS TABLE (
    medicamento_id      UUID,
    nombre_medicamento  TEXT,
    presentacion        TEXT,
    tipo_control        TEXT,
    stock_actual        NUMERIC,
    stock_minimo        NUMERIC,
    stock_maximo        NUMERIC,
    proveedor_id        UUID,
    proveedor_nombre    TEXT,
    proveedor_email     TEXT,
    proveedor_rfc       TEXT,
    terminos_pago       TEXT,
    precio_pactado      NUMERIC,
    minimo_pedido       NUMERIC,
    multiplo_pedido     NUMERIC,
    plazo_entrega_dias  SMALLINT,
    codigo_proveedor    TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT DISTINCT ON (m.id)
        m.id                        AS medicamento_id,
        m.nombre                    AS nombre_medicamento,
        m.presentacion              AS presentacion,
        m.tipo_control              AS tipo_control,
        m.stock_actual              AS stock_actual,
        m.stock_minimo              AS stock_minimo,
        m.stock_maximo              AS stock_maximo,
        p.id                        AS proveedor_id,
        p.nombre                    AS proveedor_nombre,
        p.email                     AS proveedor_email,
        p.rfc                       AS proveedor_rfc,
        p.terminos_pago             AS terminos_pago,
        mp.precio_pactado           AS precio_pactado,
        mp.minimo_pedido            AS minimo_pedido,
        mp.multiplo_pedido          AS multiplo_pedido,
        mp.plazo_entrega_dias       AS plazo_entrega_dias,
        mp.codigo_proveedor         AS codigo_proveedor
    FROM medicamentos m
    JOIN medicamento_proveedores mp ON mp.medicamento_id = m.id
        AND mp.activo = TRUE
        AND mp.precio_vigente_desde <= CURRENT_DATE
        AND (mp.precio_vigente_hasta IS NULL OR mp.precio_vigente_hasta >= CURRENT_DATE)
    JOIN proveedores p ON p.id = mp.proveedor_id
    WHERE m.stock_actual < m.stock_minimo
      AND m.tipo_control NOT IN ('psicotropico_i_ii', 'estupefaciente')
      AND m.activo = TRUE
    ORDER BY m.id, mp.proveedor_orden ASC;
$$;
```

---

## 7. Controles de Seguridad y Operación

### 7.1 Controles Requeridos

| Control | Implementación |
|---------|---------------|
| **Cooldown anti-duplicados** | `auto_reorden_log`: no crear OC si existe una en los últimos 7 días para el mismo par medicamento-proveedor |
| **Umbral de aprobación** | OC < $5,000 MXN se auto-confirman; OC >= $5,000 requieren aprobación humana |
| **Bloqueo de controlados** | `tipo_control` en `medicamentos` impide auto-reorden para estupefacientes y psicotrópicos I-II |
| **Log de auditoría** | Toda acción del sistema queda en `auto_reorden_log` con timestamp y estado |
| **Proveedor sin email** | Sistema crea OC en borrador y notifica a CxP internamente; nunca falla silenciosamente |
| **Precio vencido** | Si el precio pactado está vencido (`precio_vigente_hasta < NOW()`), se excluye el proveedor y se notifica a CxP |
| **Idempotencia del cron** | Si el cron corre dos veces en el mismo día (error de configuración), el cooldown evita duplicados |

### 7.2 Notificaciones Internas

El sistema debe enviar **email interno a CxP** (no al proveedor) cuando:
- OC supera umbral y requiere aprobación
- Medicamento en reorden sin proveedor configurado
- Medicamento psicotrópico III requiere firma de QFB
- Error al enviar email al proveedor
- Precio pactado vencido para un medicamento en reorden

### 7.3 Dashboard de Monitoreo Recomendado

Agregar a la UI una vista de:
- Medicamentos actualmente bajo punto de reorden (con semáforo OTC/Rx/Controlado)
- Últimas OCs auto-generadas (con estado: enviada/pendiente/error)
- Proveedores sin email configurado
- Medicamentos sin proveedor preferido asignado
- Log de ejecuciones del proceso de auto-reorden

---

## 8. Plan de Implementación Sugerido

### Fase 1: Modelo de Datos (1-2 días)
- [ ] Crear tabla `medicamento_proveedores` con schema completo
- [ ] Crear tabla `auto_reorden_log`
- [ ] Agregar columna `tipo_control` a tabla `medicamentos`
- [ ] Crear función RPC `get_medicamentos_en_reorden`
- [ ] Migración para datos existentes (asignar `tipo_control = 'otc'` por defecto)

### Fase 2: UI de Administración (2-3 días)
- [ ] Pantalla de asignación de proveedores por medicamento
- [ ] Formulario de precio pactado, mínimo, múltiplo, vigencia
- [ ] Indicador visual en listado de medicamentos (sin proveedor = alerta)

### Fase 3: Edge Function (2-3 días)
- [ ] Implementar `supabase/functions/auto-reorder/index.ts`
- [ ] Template HTML de email OC
- [ ] Pruebas unitarias con datos de prueba
- [ ] Prueba de integración con Resend sandbox

### Fase 4: Programación y Monitoreo (1 día)
- [ ] Configurar pg_cron para ejecución diaria 06:00 AM CST
- [ ] Agregar vista de monitoreo en dashboard
- [ ] Configurar alertas de error (email a admin)

### Fase 5: Carga inicial de datos (variable)
- [ ] Capturar proveedores preferidos para top-50 medicamentos de mayor rotación
- [ ] Validar precios pactados con proveedores
- [ ] Periodo de prueba: primera semana en modo "solo notifica, no envía"

---

## 9. Resumen Ejecutivo

El sistema de auto-abasto con proveedor preferido por artículo es técnicamente viable dentro de la arquitectura actual de integrika.mx. La tabla `medicamento_proveedores` provee el modelo de datos completo siguiendo el patrón `vendor pricelist` de Odoo y SAP B1. La combinación pg_cron + Edge Function + Resend cubre el flujo completo de detección → agrupación → creación de OC → envío de email.

Los controles críticos son: (1) el campo `tipo_control` para bloquear estupefacientes y psicotrópicos I-II del flujo automático, (2) el cooldown de 7 días para evitar OCs duplicadas, y (3) el umbral de $5,000 MXN para decidir entre auto-confirmar o requerir aprobación humana.

El ROI esperado es significativo: eliminación de trabajo manual repetitivo en CxP, reducción de stockouts por olvido, y mejor negociación con proveedores al consolidar OCs por proveedor en lugar de pedidos fragmentados.

---

## Fuentes y Referencias

- [Odoo 19.0 Reordering Rules Documentation](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/warehouses_storage/replenishment/reordering_rules.html)
- [Odoo: Vendor Pricelist Selection with Multiple Vendors](https://www.odoo.com/forum/help-1/vendor-pricelist-selection-when-a-product-has-multiple-vendor-pricelists-201052)
- [SAP Business One: Preferred Vendor in Item Master](https://www.sap-business-one-tips.com/en/preferred-vendor/)
- [SAP Community: Preferred Vendors in Item Master](https://community.sap.com/t5/enterprise-resource-planning-q-a/preferred-vendors-in-item-master/qaq-p/11180085)
- [Supabase: Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase Cron Documentation](https://supabase.com/docs/guides/cron)
- [Supabase pg_cron Complete Guide - DEV Community](https://dev.to/kanta13jp1/supabase-pgcron-complete-guide-automate-scheduled-jobs-in-postgresql-5dih)
- [Resend: Send emails with Node.js](https://resend.com/nodejs)
- [EOQ - Cantidad Económica de Pedido: Mecalux México](https://www.mecalux.com.mx/blog/cantidad-economica-pedido-eoq)
- [COFEPRIS-03-014: Pronóstico semestral de compra-venta de controlados](https://catalogonacional.gob.mx/FichaTramite/COFEPRIS-03-014.html)
- [Ley General de Salud Arts. 244-256: Sustancias Psicotrópicas](https://mexico.justia.com/federales/leyes/ley-general-de-salud/titulo-decimo-segundo/capitulo-vi/)
- [Distribución y venta de medicamentos controlados en México - RAF Consulting](https://rafconsulting.net/blog-post.php?idpost=600)
- [Top Pharmacy ERP Solutions 2026 - Logic ERP](https://www.logicerp.com/blog/top-10-best-pharmacy-billing-software-pharma-erp-a-complete-guide/)
- [Autonomous Pharmaceutical Retail Operating System Design - Medium](https://darlingtongospel.medium.com/how-i-would-build-an-autonomous-pharmaceutical-retail-chain-operating-system-a7be554979f3)
