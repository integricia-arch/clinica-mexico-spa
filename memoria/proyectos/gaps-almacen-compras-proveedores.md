# Comparativa: Sistema Actual vs. Mejores Prácticas — Almacén, Compras y Proveedores
**Fecha:** 2026-06-15 | **Base:** investigacion-almacen-compras-proveedores.md

---

## ESTADO ACTUAL DEL SISTEMA

### ✅ Ya implementado correctamente

| Área | Qué funciona | Archivos |
|---|---|---|
| **POS Farmacia** | Venta con lotes, FIFO, FEFO implícito, pagos múltiples, IVA 0% en medicamentos | PuntoDeVenta.tsx |
| **Control de lotes** | `lotes_medicamento` con fecha_caducidad, existencia, FIFO en venta | medicamentos_catalogo migration |
| **Medicamentos controlados** | `is_controlled`, `sale_type`, bloqueo de venta directa en POS | permissions.ts, PuntoDeVenta.tsx |
| **Recetas capturadas** | Post-venta captura: médico, cédula, folio, tipo controlado | RecetaValidacionModal.tsx, recetas_capturadas table |
| **Movimientos de inventario** | `movimientos_inventario` con tipos: entrada/salida/ajuste/caducidad | migration 20260508000002 |
| **IVA diferenciado** | `tasa_iva` por producto (0% default), cálculo proporcional en venta | PuntoDeVenta.tsx:428-444 |
| **Shift management farmacia** | Apertura, conteo ciego, cierre, reconciliación efectivo | ShiftPanel.tsx, pharmacy_close_shift RPC |
| **Catálogo extendido** | barcode, sku, registro_sanitario, principio_activo, forma_farmacéutica | medicamentos_catalogo migration |
| **Catálogo insumos** | CRUD con stock, costo, caducidad, proveedor vinculado | useInsumos.ts, insumos table |
| **Kits de tratamiento** | Bundle de insumos con costo derivado y margen configurable | useKits.ts, kits/kit_items tables |
| **Proveedores básicos** | CRUD: nombre, contacto, teléfono, email | useProveedores.ts, proveedores table |
| **Alertas stock mínimo** | `almacen_alertas` table + vista en Farmacia.tsx | Farmacia.tsx |
| **Auditoría POS** | audit_logs, pos_error_logs en cada evento relevante | PuntoDeVenta.tsx |
| **Roles y permisos** | posPermissions por rol, bloqueo descuentos/controlados | permissions.ts |

---

## ❌ GAPS IDENTIFICADOS (vs. investigación formal)

### CRÍTICO — Riesgo legal/sanitario inmediato

| # | Gap | Riesgo | Norma | Estado actual |
|---|---|---|---|---|
| 1 | **Alertas de caducidad automáticas** no existen en UI | COFEPRIS — venta de vencido = sanción penal | NOM-072-SSA1-2012 | `almacen_alertas` existe pero no hay alerta proactiva de lotes próximos a vencer |
| 2 | **Libro de control COFEPRIS exportable** — `LibroControl.tsx` existe pero no hay reporte en formato COFEPRIS | Inspección COFEPRIS sin reporte válido | LGS Art. 226-226Bis | LibroControl.tsx parcial |
| 3 | **IVA en catálogo** — `tasa_iva` default es 0.16 (16%) para todo | Medicamentos = 0% (LIVA Art. 2-A) | CFF/LIVA | `tasa_iva` existe pero default 0.16 — medicamentos deben ser 0.00 |

### ALTO — Control financiero/operativo

| # | Gap | Riesgo | Norma | Estado actual |
|---|---|---|---|---|
| 4 | **Sin módulo de Órdenes de Compra (OC)** | Compras sin control, sin 3-way match | COSO | No existe. Planeado pero no implementado |
| 5 | **Sin flujo de recepción de mercancía** vinculado a OC | Inventario entra sin verificación | COSO CC 10.2 | Solo `increment_lote_existencia` RPC manual |
| 6 | **Sin 3-way matching** (OC + GR + Factura) | Pago sin base documental, facturas duplicadas | IIA | No existe |
| 7 | **Proveedores sin RFC, CLABE, ni verificación EFOS** | CFDI de proveedor EFOS = deducción anulada + multa | CFF Art. 69-B | Proveedor solo: nombre, contacto, tel, email |
| 8 | **Sin validación de CFDI de proveedor** (UUID SAT) | Pago de facturas inválidas o apócrifas | CFF Art. 29 | No existe |
| 9 | **Sin cuentas por pagar** con fechas de vencimiento | Pagos tardíos, pérdida de descuentos | Operativo | No existe |
| 10 | **Sin flujo de aprobación de compras** por nivel de monto | Compras no autorizadas | COSO Principle 10 | No existe |

### MEDIO — Operación robusta

| # | Gap | Riesgo | Norma | Estado actual |
|---|---|---|---|---|
| 11 | **Sin proceso formal de devoluciones a proveedor** | Pérdida económica, inventario incorrecto | Operativo | No existe |
| 12 | **Sin registro de uso interno** (consumo clínica) | Diferencias inexplicables en inventario | Operativo | No existe — mermas sin tipificación interna |
| 13 | **Sin clasificación ABC automática** | Gestión reactiva, quiebres en productos críticos | Best practice | No existe |
| 14 | **Sin evaluación de proveedores** | Deterioro de calidad sin consecuencia | IIA 2110 | No existe |
| 15 | **Sin proceso de inventario cíclico guiado** | Diferencias acumuladas detectadas solo al año | IIA | Solo conteo manual sin sistema |
| 16 | **Sin términos de pago en proveedor** | Sin programación de pagos, sin crédito documentado | Operativo | No existe en tabla proveedores |
| 17 | **Sin punto de reorden en lotes** (solo stock_minimo en medicamentos) | Alertas tardías, no considera tiempo de entrega | Operativo | `stock_minimo` existe en medicamentos, no en insumos |
| 18 | **Sin actas de merma digitales** | No deducible ISR si no está documentado | LISR Art. 25 | Solo tipo "caducidad" en movimientos_inventario sin acta |
| 19 | **Sin cadena de frío en recepción** | Medicamentos refrigerados sin verificación de temperatura | COFEPRIS BPM | No existe |
| 20 | **Sin conciliación estado cuenta proveedor** | Diferencias en CxP no detectadas | Operativo | No existe |

### BAJO — Auditoría y trazabilidad

| # | Gap | Riesgo | Estado actual |
|---|---|---|---|
| 21 | Sin folio correlativo de OC | Trazabilidad incompleta | No hay OC |
| 22 | Sin reporte de rotación de inventario | Sin visibilidad de obsolescencia | No existe |
| 23 | Sin análisis de precio vs. mercado | Márgenes no monitoreados | Parcial en kits (margen_objetivo) |
| 24 | Sin precio de costo en medicamentos (solo en insumos) | Sin cálculo de margen en farmacia | `lotes_medicamento` no tiene costo_unitario |

---

## PLAN DE IMPLEMENTACIÓN

### Fase 0 — Correcciones críticas (ya hay estructura) — 1-2 días

**Gap #3: Corregir IVA default en medicamentos**
- Tabla `medicamentos`: `tasa_iva DEFAULT 0.00` (cambiar de 0.16)
- UI: Al crear medicamento, campo IVA con opciones: "0% (Medicamento)" / "16% (Otro)"
- Migration: `ALTER TABLE medicamentos ALTER COLUMN tasa_iva SET DEFAULT 0.00;`
- Riesgo si no se corrige: CFDI de ventas de farmacia con IVA incorrecto

**Gap #1: Alertas de caducidad proactivas**
- Query en Farmacia.tsx al cargar: `lotes_medicamento WHERE fecha_caducidad <= now() + 90 days AND existencia > 0`
- Sección "Próximos a vencer" en tab Inventario con color-coded: rojo <30, naranja <60, amarillo <90
- Tabla `almacen_alertas` ya existe — extender para alertas de caducidad

### Fase 1 — Proveedor robusto — 3-5 días

**Gap #7: Enriquecer catálogo de proveedores**
```sql
ALTER TABLE proveedores ADD COLUMN rfc TEXT;
ALTER TABLE proveedores ADD COLUMN regimen_fiscal TEXT;
ALTER TABLE proveedores ADD COLUMN domicilio_fiscal TEXT;
ALTER TABLE proveedores ADD COLUMN clabe TEXT;
ALTER TABLE proveedores ADD COLUMN banco TEXT;
ALTER TABLE proveedores ADD COLUMN terminos_pago INTEGER DEFAULT 30; -- días
ALTER TABLE proveedores ADD COLUMN plazo_entrega INTEGER DEFAULT 3; -- días
ALTER TABLE proveedores ADD COLUMN requiere_cofepris BOOLEAN DEFAULT FALSE;
ALTER TABLE proveedores ADD COLUMN estatus_efos TEXT DEFAULT 'no_verificado'; -- no_verificado|ok|alerta
ALTER TABLE proveedores ADD COLUMN ultima_verificacion_efos TIMESTAMPTZ;
ALTER TABLE proveedores ADD COLUMN clasificacion TEXT DEFAULT 'regular'; -- critico|regular|ocasional
```
- UI: expandir formulario en ProveedoresTab (inventario.tsx)

**Gap #24: Precio de costo en lotes de medicamentos**
```sql
ALTER TABLE lotes_medicamento ADD COLUMN costo_unitario_centavos INTEGER DEFAULT 0;
```
- Capturar al registrar entrada de lote

### Fase 2 — Módulo de Compras básico — 1-2 semanas

**Gap #4, #5, #6: Órdenes de Compra + Recepción**

Tablas nuevas:
```sql
CREATE TABLE ordenes_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  folio TEXT GENERATED ALWAYS AS ('OC-' || LPAD(folio_num::TEXT, 6, '0')) STORED,
  folio_num SERIAL,
  proveedor_id UUID REFERENCES proveedores(id),
  status TEXT DEFAULT 'borrador', -- borrador|confirmada|parcialmente_recibida|completada|cancelada
  fecha_emision DATE DEFAULT CURRENT_DATE,
  fecha_entrega_esperada DATE,
  terminos_pago INTEGER DEFAULT 30,
  notas TEXT,
  aprobado_por UUID REFERENCES auth.users(id),
  aprobado_at TIMESTAMPTZ,
  total_centavos INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ordenes_compra_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id UUID REFERENCES ordenes_compra(id) ON DELETE CASCADE,
  medicamento_id UUID REFERENCES medicamentos(id),
  insumo_id UUID REFERENCES insumos(id),
  descripcion TEXT NOT NULL,
  cantidad NUMERIC NOT NULL,
  unidad TEXT NOT NULL,
  precio_unitario_centavos INTEGER NOT NULL,
  total_centavos INTEGER GENERATED ALWAYS AS (cantidad * precio_unitario_centavos) STORED
);

CREATE TABLE recepciones_mercancia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  orden_id UUID REFERENCES ordenes_compra(id),
  proveedor_id UUID REFERENCES proveedores(id),
  fecha_recepcion DATE DEFAULT CURRENT_DATE,
  remision_proveedor TEXT,
  notas TEXT,
  recibido_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recepciones_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recepcion_id UUID REFERENCES recepciones_mercancia(id) ON DELETE CASCADE,
  orden_item_id UUID REFERENCES ordenes_compra_items(id),
  medicamento_id UUID REFERENCES medicamentos(id),
  insumo_id UUID REFERENCES insumos(id),
  cantidad_recibida NUMERIC NOT NULL,
  numero_lote TEXT,
  fecha_caducidad DATE,
  costo_unitario_centavos INTEGER,
  condicion TEXT DEFAULT 'ok' -- ok|dañado|rechazado
);
```

UI: Nueva sección "Compras" en ajustes/inventario.tsx o página dedicada:
- Tab "Órdenes de Compra": lista OC, crear OC, confirmar, recibir
- Tab "Recepciones": historial de recepciones, detalle por OC
- Al confirmar recepción → auto-incrementar lotes_medicamento (+ costo_unitario) y/o insumos.stock

**Gap #6: 3-Way Match básico**
- Al registrar factura de proveedor (CFDI): comparar con OC + Recepción
- Vista: factura vs. OC vs. recepción — diferencias resaltadas
- Bloquear pago si diferencia > tolerancia sin aprobación gerente

### Fase 3 — Cuentas por pagar y control financiero — 1-2 semanas

**Gap #9, #8: CxP + Validación CFDI**
```sql
CREATE TABLE facturas_proveedor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  proveedor_id UUID REFERENCES proveedores(id),
  recepcion_id UUID REFERENCES recepciones_mercancia(id),
  orden_id UUID REFERENCES ordenes_compra(id),
  uuid_cfdi TEXT UNIQUE, -- folio fiscal SAT
  serie TEXT,
  folio TEXT,
  fecha_factura DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  subtotal_centavos INTEGER,
  iva_centavos INTEGER,
  total_centavos INTEGER NOT NULL,
  estatus TEXT DEFAULT 'pendiente', -- pendiente|aprobada|pagada|cancelada
  estatus_cfdi TEXT DEFAULT 'no_verificado', -- no_verificado|valido|invalido|cancelado
  estatus_efos TEXT DEFAULT 'no_verificado',
  aprobada_por UUID REFERENCES auth.users(id),
  notas TEXT,
  xml_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pagos_proveedor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  factura_id UUID REFERENCES facturas_proveedor(id),
  fecha_pago DATE NOT NULL,
  monto_centavos INTEGER NOT NULL,
  metodo TEXT DEFAULT 'transferencia', -- transferencia|cheque|efectivo
  referencia_bancaria TEXT,
  aprobado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Fase 4 — Inventario físico y mermas — 1 semana

**Gap #15, #18: Inventario cíclico + actas de merma**
```sql
CREATE TABLE conteos_inventario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  tipo TEXT DEFAULT 'ciclico', -- ciclico|general
  categoria_abc TEXT, -- A|B|C|todos
  fecha_inicio DATE,
  fecha_fin DATE,
  status TEXT DEFAULT 'en_proceso',
  creado_por UUID REFERENCES auth.users(id),
  aprobado_por UUID REFERENCES auth.users(id)
);

CREATE TABLE conteos_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conteo_id UUID REFERENCES conteos_inventario(id),
  medicamento_id UUID REFERENCES medicamentos(id),
  lote_id UUID REFERENCES lotes_medicamento(id),
  cantidad_sistema NUMERIC,
  cantidad_fisica NUMERIC,
  diferencia NUMERIC GENERATED ALWAYS AS (cantidad_fisica - cantidad_sistema) STORED,
  motivo_diferencia TEXT, -- merma|robo|error_captura|no_encontrado
  ajustado BOOLEAN DEFAULT FALSE
);
```

**Gap #12: Uso interno**
- Nuevo tipo en `movimientos_inventario`: `uso_interno`
- Campos adicionales: `departamento`, `autorizado_por`

### Fase 5 — Auditoría e inteligencia — 2 semanas

**Gap #13, #22: Clasificación ABC + reportes de rotación**
- Función PostgreSQL: calcular valor anual = Σ(ventas × costo) por medicamento
- Clasificar A/B/C automáticamente, actualizar en medicamentos
- Reporte: rotación de inventario, días de inventario, productos sin movimiento >90 días

**Gap #14: Evaluación de proveedores**
- Tabla `evaluaciones_proveedor` con scores trimestrales
- Métricas auto-calculadas: % entregas a tiempo, % devoluciones, precio vs. mercado

---

## RESUMEN DE BRECHAS POR MÓDULO

```
MÓDULO                    IMPLEMENTADO    GAPS CRÍTICOS   GAPS MEDIOS
─────────────────────────────────────────────────────────────────
Catálogo medicamentos         90%             1 (IVA)         3
Lotes y caducidades           80%             1 (alertas)     2
Medicamentos controlados      70%             1 (reporte)     1
POS ventas                    95%             0               1
Insumos                       80%             0               2
Kits tratamiento              90%             0               1
Proveedores                   30%             2 (RFC/EFOS)    4
Órdenes de compra              0%             MÓDULO FALTA    —
Recepción mercancía            5%             MÓDULO FALTA    —
3-Way matching                 0%             MÓDULO FALTA    —
Cuentas por pagar              0%             MÓDULO FALTA    —
Inventario físico guiado       0%             —               3
Mermas documentadas           20%             1               2
Uso interno                    0%             —               2
Clasificación ABC              0%             —               2
Evaluación proveedores         0%             —               3
```

---

## PRIORIDADES EJECUTIVAS

**Hacer AHORA (sin código nuevo, solo config/migration):**
1. Corregir `tasa_iva DEFAULT 0.00` en medicamentos
2. Agregar RFC, CLABE, términos_pago a tabla proveedores

**Hacer en próximas 2 semanas:**
3. Alertas de caducidad en tab Inventario de Farmacia
4. Módulo básico de OC (crear, confirmar, recibir)
5. Capturar costo_unitario en lotes al recibir

**Hacer en 1-2 meses:**
6. Facturas de proveedor + validación CFDI
7. Proceso de inventario cíclico guiado
8. Actas de merma digitales
9. Uso interno registrado
10. Evaluación básica de proveedores

---
*Fuente base: investigacion-almacen-compras-proveedores.md | Código mapeado: cavecrew-investigator 2026-06-15*
