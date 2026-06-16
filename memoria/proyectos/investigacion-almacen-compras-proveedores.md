# Investigación Formal: Almacén, Compras y Proveedores en POS/ERP para Clínica con Farmacia
**Fecha:** 2026-06-15 | **Fuentes:** NIF C-4/B-10, CFF, COFEPRIS, COSO, IIA, Odoo, SAP B1, Lightspeed, Square, Shopify, QuickBooks

---

## MÓDULO 1: ALMACÉN / INVENTARIO

### A. Catálogo de Productos

**Atributos mínimos obligatorios por producto en farmacia/clínica:**

| Campo | Tipo | Obligatorio | Norma/Razón |
|---|---|---|---|
| Nombre comercial | texto | ✅ | Identificación |
| Nombre genérico | texto | ✅ (medicamentos) | COFEPRIS/LGS |
| SKU interno | texto único | ✅ | Trazabilidad |
| Código de barras EAN-13 | texto | ✅ | Automatización POS |
| Unidad de medida | catálogo (pieza/caja/ml) | ✅ | NIF C-4 coherencia |
| Precio de venta | decimal | ✅ | POS |
| Precio de costo (último) | decimal | ✅ | Valuación inventario |
| Tasa IVA | 0% / 16% | ✅ | CFF art. 2-A: medicamentos = 0% |
| Stock mínimo | entero | ✅ | Punto de reorden |
| Stock máximo | entero | recomendado | Control de sobreinventario |
| Punto de reorden | entero | ✅ | Cálculo automático |
| Requiere receta | booleano | ✅ (medicamentos) | LGS / COFEPRIS |
| Controlado (psicotrópico) | booleano | ✅ | LGS Título Séptimo |
| Categoría ABC | A/B/C | recomendado | Control de inventario |
| Proveedor preferido | FK | recomendado | Compras automáticas |
| Control por lote | booleano | ✅ (medicamentos) | COFEPRIS |
| Control por caducidad | booleano | ✅ (medicamentos) | COFEPRIS |

**Clasificación ABC:**
- **A (20% SKUs, 80% valor):** alto costo, insulinas, biológicos. Conteo mensual, doble validación.
- **B (30% SKUs, 15% valor):** antibióticos comunes, vitaminas. Conteo trimestral.
- **C (50% SKUs, 5% valor):** artículos bajo costo, material curación básico. Conteo semestral.

**IVA en medicamentos — CRÍTICO:**
- Medicamentos = IVA 0% (CFF art. 2-A fracción I inc. b)
- Material de curación / artículos de higiene = IVA 16%
- Error frecuente: aplicar 16% a medicamento → CFDI incorrecto → multa SAT

**Control de lotes y caducidades (COFEPRIS NOM-072-SSA1-2012):**
1. Al recibir: capturar número de lote + fecha de caducidad
2. Al vender: sistema despacha el lote con caducidad más próxima (FEFO — First Expired, First Out)
3. Alerta 30/60/90 días antes de vencer
4. Registro de mermas por caducidad en acta firmada

**Productos controlados (psicotrópicos/estupefacientes) — LGS Título Séptimo:**
- Receta Especial (rosa) retenida en farmacia obligatoria
- Libro de Control (físico o electrónico autorizado COFEPRIS)
- Inventario PERMANENTE — no solo periódico
- Compra solo a distribuidores con permiso COFEPRIS
- Diferencia de inventario = reporte obligatorio a COFEPRIS
- Riesgo: sanción penal (LGS art. 193-197), cancelación licencia sanitaria

---

### B. Entradas al Almacén

**Proceso de recepción:**
```
Orden de Compra (aprobada)
        ↓
Llegada proveedor → Cotejo físico vs. OC:
  • Cantidad por pieza/caja
  • Producto correcto (verificar EAN)
  • Fecha caducidad (no aceptar <6 meses para medicamentos)
  • Condición del embalaje
        ↓
Coincide OC? ──No──→ Rechazo parcial/total → Nota de devolución → RMA
        ↓ Sí
Captura en sistema (GR — Goods Receipt):
  • Número de lote + caducidad por artículo (si aplica)
  • Cantidad real recibida
  • Costo de cada artículo
        ↓
Sistema actualiza inventario + genera cuenta por pagar provisional
        ↓
Factura CFDI del proveedor → Validar vs. SAT (timbre)
        ↓
3-way match: OC + GR + Factura → ¿Coinciden? → Aprobar pago
```

**Valuación de inventario (NIF C-4):**
- **LIFO prohibido en México** desde 2008 (adopción IFRS/IAS 2)
- **PEPS (FIFO):** recomendado para medicamentos — coincide con FEFO (obligación sanitaria)
- **Costo Promedio Ponderado:** permitido, más simple para SKUs de bajo costo
- Recomendación: PEPS para medicamentos, Promedio Ponderado para insumos

---

### C. Salidas del Almacén

| Tipo | Disparador | Documento | Sistema |
|---|---|---|---|
| Venta POS | Cobro en caja | Ticket/CFDI | Automático |
| Uso interno | Solicitud interna | Nota de consumo interno | Manual con autorización |
| Devolución a proveedor | Defecto/Error | Nota devolución + CFDI proveedor | Manual |
| Merma/caducidad | Expiración/daño | Acta de merma firmada | Ajuste manual |
| Ajuste de inventario | Diferencia en conteo | Acta de ajuste firmada | Manual post-conteo |
| Muestra médica | Uso promocional | Registro de muestra | Manual |

**Mermas — tratamiento contable:**
- **Merma normal:** absorber como costo de ventas
- **Merma extraordinaria** (caducidad masiva, robo, daño):
  - Acta de destrucción firmada por responsable sanitario + testigo
  - Medicamentos controlados: reporte a COFEPRIS obligatorio
  - Baja inventario → cargo a "pérdida en merma"
  - Merma comprobada con acta = deducible ISR (LISR art. 25 fr. I)
  - Revisar reintegro de IVA acreditado si merma extraordinaria

**Ajustes de inventario — sólo con:**
1. Conteo físico documentado
2. Diferencia validada por dos personas
3. Acta con: fecha, producto, cantidad sistema, cantidad física, diferencia, responsable, autoriza
4. Supervisor aprueba (no quien contó)
5. Registro con motivo: robo, error captura, merma, daño

---

### D. Control de Inventario Físico

**Frecuencia mínima en farmacia:**
- Medicamentos controlados: inventario permanente (COFEPRIS)
- Categoría A: mensual
- Categoría B: trimestral
- Categoría C: semestral
- General: mínimo anual (NIF / SAT)

**Proceso:**
```
PREPARACIÓN:
  1. Congelar recepciones pendientes
  2. Imprimir lista de conteo CIEGO (sin cantidades sistema)
  3. Asignar zonas a contadores independientes

CONTEO:
  1. Conteo ciego: contador escribe físico sin ver sistema
  2. Doble conteo: segundo contador repite sin ver primero
  3. Diferencia >2%: tercer conteo dirimente

DIFERENCIAS:
  1. Sistema compara: físico vs. sistema
  2. Investigar antes de ajustar (recepción no registrada? venta no capturada?)
  3. Diferencia inexplicable → considera robo → reporte interno

AJUSTE:
  1. Acta firmada: contador + supervisor + gerente
  2. Ajuste en sistema con motivo
  3. Contabilidad: cargo/abono a inventario vs. resultados
```

---

### E. Alertas y Puntos de Reorden

**Fórmula punto de reorden:**
```
Punto de Reorden = (Demanda Media Diaria × Tiempo de Entrega en días) + Stock de Seguridad
Stock de Seguridad = Z × σ_demanda × √(Tiempo de Entrega)
  Z = 1.65 (95% servicio) | Z = 2.33 (99% servicio)
```

**Fórmula simple (sin estadística):**
```
Punto de Reorden = ventas promedio × (días entrega + días buffer)
Ejemplo: 20 ventas/día × (3+5 días) = 160 unidades
```

**Protocolo de alertas de caducidad:**
| Días para vencer | Acción | Responsable |
|---|---|---|
| 90 días | Alerta sistema, revisar en siguiente conteo | Almacenista |
| 60 días | Activar descuento o campaña de salida | Gerente |
| 30 días | Separar físicamente, oferta agresiva o devolución | Gerente + Compras |
| 15 días | Si no vendible: iniciar trámite destrucción COFEPRIS | Responsable sanitario |
| Vencido | Destrucción inmediata + acta + reporte COFEPRIS (si controlado) | Responsable sanitario |

---

## MÓDULO 2: COMPRAS / ÓRDENES DE COMPRA

### F. El Proceso Completo de Compra (Procure-to-Pay)

```
SOLICITUD → COTIZACIÓN (≥3 proveedores para >$5,000 MXN) → AUTORIZACIÓN
     ↓
ORDEN DE COMPRA (folio correlativo, enviada al proveedor)
     ↓
RECEPCIÓN FÍSICA + GR en sistema
     ↓
RECEPCIÓN CFDI (validar UUID SAT + EFOS)
     ↓
3-WAY MATCH (OC = GR = Factura)
     ↓
APROBACIÓN DE PAGO → PAGO SPEI → CONCILIACIÓN
```

**Tabla de niveles de autorización:**
| Monto | Quién autoriza |
|---|---|
| < $2,000 MXN | Encargado de farmacia/almacén |
| $2,000 – $10,000 MXN | Gerente administrativo |
| $10,000 – $50,000 MXN | Director general |
| > $50,000 MXN | Director general + socio/consejo |
| Urgencia cualquier monto | Director con ratificación posterior en 24h |

---

### G. Órdenes de Compra

**Contenido mínimo de una OC válida:**
```
ENCABEZADO: folio, fecha, entrega esperada, proveedor (razón social, RFC, dirección)
CUERPO: descripción, SKU, cantidad, UM, precio unitario, subtotal, IVA, total, moneda
PIE: términos de pago, condiciones entrega, condiciones devolución, vigencia, firma autoriza
```

**Estados del ciclo de vida:**
```
Borrador → Confirmada → [Parcialmente Recibida] → Completada
                    ↘ Cancelada
```

**Compras de urgencia:**
- Autorización no puede omitirse — llamada/mensaje del director válida si se documenta en 24h
- Crear OC retroactiva con motivo urgencia
- Nunca pagar sin documentar

---

### H. Recepción y 3-Way Matching

**3-Way Match:**
```
OC (lo que PEDIMOS) = GR (lo que RECIBIMOS) = Factura (lo que nos COBRAN)
Tolerancias: cantidad ±5%, precio 0% (diferencia requiere aprobación)
```

**Cuando la factura no coincide:**
| Discrepancia | Acción |
|---|---|
| Factura > GR | Solicitar nota de crédito. No pagar excedente |
| Factura < GR | Registrar diferencia a favor |
| Precio factura > OC | Requiere aprobación gerente |
| Producto diferente | Rechazar factura, solicitar CFDI correcto |
| CFDI no timbrado/UUID inválido | No deducible. Rechazar |

**Registro contable:**
- Al recibir GR: Cargo Inventario / Abono CxP provisional
- Al aprobar factura: Cargo CxP provisional / Abono CxP definitivas
- Al pagar: Cargo CxP definitivas / Abono Banco

---

## MÓDULO 3: PROVEEDORES

### I. Alta y Gestión de Proveedores

**Atributos mínimos del catálogo:**
RFC, razón social, domicilio fiscal, régimen fiscal, CLABE, banco, contacto, términos de pago,
plazo de entrega, moneda, tipo de proveedor, permiso COFEPRIS (si medicamentos),
clasificación (crítico/regular/ocasional), estatus EFOS/EDOS.

**Verificación obligatoria antes del alta:**
1. **SAT EFOS/EDOS:** `sat.gob.mx` — si está en lista negra NO contratar (CFF art. 69-B)
2. **COFEPRIS:** verificar permiso comercialización medicamentos vigente
3. **RFC activo:** confirmar en `sat.gob.mx`
4. **Opinión de cumplimiento IMSS** (si proveedor tiene personal)

**Clasificación:**
| Nivel | Criterio | Gestión |
|---|---|---|
| Crítico | Único proveedor, alto volumen, entrega larga | Contrato marco, evaluación trimestral, proveedor alternativo |
| Regular | Múltiples opciones, volumen medio | Evaluación semestral |
| Ocasional | Compra esporádica, bajo monto | Alta simplificada, verificación SAT mínima |

**Evaluación anual (pesos sugeridos):**
- Precio competitivo: 30%
- Calidad / devoluciones: 30%
- Cumplimiento en tiempo: 25%
- Servicio / respuesta: 15%

---

### J. Cuentas por Pagar

**Ciclo completo:**
```
Recepción CFDI → Validar UUID SAT + EFOS → 3-way match
→ Aprobación → Programación (fecha vencimiento) → Pago SPEI
→ Registro en sistema → Conciliación mensual vs. estado cuenta proveedor
```

**Validación CFDI obligatoria antes de pagar:**
1. Descargar XML del proveedor
2. Verificar UUID en SAT (timbrado válido)
3. Verificar RFC emisor no en EFOS a la fecha del CFDI
4. Verificar que UUID no haya sido pagado antes (duplicado)

**Retenciones a personas físicas:**
| Tipo de servicio | Retención ISR | Retención IVA |
|---|---|---|
| Servicios profesionales (honorarios) | 10% | 10.67% (2/3 del IVA) |
| Arrendamiento | 20% | 10.67% |
| Transportista PF | 7.5% | No aplica |
| Productos (con actividad empresarial) | 0% | 0% |

**Control de anticipos:**
- CFDI tipo "A" al recibir anticipo
- Al recibir mercancía: aplicar anticipo vs. saldo en CFDI definitivo

---

### K. Riesgos y Controles en Compras/Proveedores

**Fraudes comunes y controles:**
| Fraude | Control |
|---|---|
| Proveedor ficticio | Alta requiere aprobación gerente + docs. Quien da de alta ≠ quien paga |
| Facturas duplicadas | Sistema detecta UUID duplicado antes de pagar |
| Pago sin recepción | 3-way match obligatorio |
| Inflación de precio | OC firmada antes. Factura > OC requiere aprobación extra |
| Kick-back | Rotación de compradores. Comité compras para montos altos |
| Robo en recepción | Doble validación física. Quien recibe ≠ quien registra |

**Separación de funciones mínima (COSO):**
```
COMPRAS (solicita/OC) ≠ RECEPCIÓN (recibe físico) ≠ CONTABILIDAD/PAGOS
Mínimo para clínica pequeña: quien PAGA ≠ quien COMPRA
Compensar: dueño/director revisa todas las transacciones mensualmente
```

**Verificación EFOS antes de cada pago:**
```
RFC proveedor → sat.gob.mx → ¿En lista?
  SÍ → DETENER PAGO → reportar dirección → asesor fiscal
  NO → continuar
```

---

## MÓDULO 4: GAPS COMUNES EN CLÍNICAS/FARMACIAS PEQUEÑAS

| Gap | Riesgo | Impacto |
|---|---|---|
| Sin control lotes/caducidades | Venta medicamento vencido | CRÍTICO — penal |
| Sin registro medicamentos controlados | Incumplimiento LGS | CRÍTICO — penal |
| Sin 3-way match | Pagos sin recepción, facturas duplicadas | ALTO |
| Sin validación EFOS en proveedores | Crédito fiscal anulado (69-B) | ALTO |
| Sin flujo aprobación compras | Compras no autorizadas | ALTO |
| Sin punto de reorden automático | Quiebres detectados visualmente | ALTO |
| Sin separación compras/pagos | Proveedor ficticio indetectable | ALTO |
| Sin validación CFDI al pagar | Pago facturas apócrifas | ALTO |
| Sin clasificación ABC | Quiebres en A, sobreinventario en C | MEDIO |
| Sin evaluación de proveedores | Deterioro calidad/precio sin consecuencia | MEDIO |
| Sin alertas de caducidad | Mermas evitables | MEDIO |
| Sin retenciones automáticas a PF | Multas SAT | MEDIO-ALTO |
| Sin actas de merma | No deducible ISR, riesgo COFEPRIS | MEDIO |
| Sin devoluciones documentadas | Pérdida económica, inventario incorrecto | ALTO |

---

## TABLA COMPARATIVA DE SISTEMAS

| Control | Odoo Inventory/Purchase | Lightspeed Retail | Square for Retail | Shopify POS | QuickBooks |
|---|---|---|---|---|---|
| Control de lotes | ✅ Nativo | ❌ | ❌ | ❌ | ❌ |
| Control de caducidades | ✅ (con lotes) | ❌ | ❌ | ❌ | ❌ |
| FEFO automático | ✅ | ❌ | ❌ | ❌ | ❌ |
| Clasificación ABC | ✅ (con módulo) | Manual | ❌ | ❌ | ❌ |
| Punto de reorden | ✅ Automático | ✅ Manual | ✅ Básico | ✅ Básico | ✅ Manual |
| Alertas caducidad | ✅ | ❌ | ❌ | ❌ | ❌ |
| Órdenes de compra (PO) | ✅ Completo | ✅ Básico | ❌ | ❌ Plugin | ✅ |
| Flujo aprobación compras | ✅ Configurable | ❌ | ❌ | ❌ | ❌ |
| 3-way matching | ✅ | ❌ | ❌ | ❌ | Parcial |
| Valuación FIFO | ✅ | ❌ (promedio) | ❌ (promedio) | ❌ (promedio) | ✅ |
| Inventario físico | ✅ | ✅ | ✅ Básico | ✅ Básico | ✅ |
| Devoluciones a proveedor | ✅ Formal | Básico | Básico | ❌ | ✅ |
| Gestión de proveedores | ✅ Completo | Básico | ❌ | ❌ | ✅ |
| Evaluación de proveedores | ✅ | ❌ | ❌ | ❌ | ❌ |
| CxP con vencimiento | ✅ | ❌ | ❌ | ❌ | ✅ |
| Validación EFOS/EDOS | Plugin/Manual | ❌ | ❌ | ❌ | ❌ |
| CFDI México | Con localización MX | ❌ | ❌ | ❌ | Con módulo MX |
| Separación de funciones | ✅ Roles granulares | Básico | Básico | Básico | Básico |
| Medicamentos controlados | Manual (sin flujo COFEPRIS) | ❌ | ❌ | ❌ | ❌ |
| **Adecuado farmacia MX** | ⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐ | ⭐⭐⭐ |

---

## RESUMEN DE RIESGOS CRÍTICOS

| Prioridad | Gap | Consecuencia | Norma |
|---|---|---|---|
| 🔴 CRÍTICO | Sin control medicamentos controlados | Penal + cancelación licencia | LGS Título VII |
| 🔴 CRÍTICO | Sin validación lotes/caducidades | Venta medicamento vencido | COFEPRIS NOM-072 |
| 🔴 ALTO | Sin validación EFOS antes de pagar | CFDI no deducible + 69-B CFF | CFF art. 69-B |
| 🔴 ALTO | Sin 3-way match | Pagos sin recepción, fraude proveedor | COSO |
| 🔴 ALTO | Sin separación compras/pagos | Proveedor ficticio indetectable | COSO Principle 10 |
| 🟡 ALTO | Sin flujo aprobación OC | Compras no autorizadas | IIA |
| 🟡 ALTO | Sin punto de reorden automático | Quiebres de stock en A | NIF C-4 / operación |
| 🟡 MEDIO | Sin evaluación proveedores | Deterioro calidad/precio | IIA 2110 |
| 🟡 MEDIO | Sin actas de merma firmadas | No deducible ISR | LISR art. 25 |
| 🟢 BAJO | Sin clasificación ABC formal | Gestión reactiva | Best practice |

---

## PLAN DE MEJORAS (PENDIENTE COMPARAR CON IMPLEMENTACIÓN ACTUAL)

### Fase 1 — Controles críticos legales (COFEPRIS + SAT)
- Control de lotes y caducidades en productos
- Registro especial medicamentos controlados (libro de control)
- Validación automática EFOS/EDOS en alta y pago de proveedores
- IVA 0% automático en medicamentos

### Fase 2 — Control financiero
- Flujo completo de OC: solicitud → aprobación → envío → recepción
- 3-way match: OC + GR + CFDI
- CxP con fechas de vencimiento y programación de pagos
- Validación UUID CFDI antes de aprobar pago

### Fase 3 — Operación robusta
- Punto de reorden automático con alertas
- Clasificación ABC con frecuencia de conteo diferenciada
- Flujo de devoluciones a proveedor documentado
- Evaluación periódica de proveedores
- Retenciones automáticas a personas físicas

### Fase 4 — Auditoría e inteligencia
- Dashboard de rotación de inventario
- Alertas de caducidad con workflow de acción
- Reporte de diferencias de inventario por período
- Análisis de compras por proveedor vs. presupuesto

---
*Fuentes: NIF C-4 (CINIF), LGS Título VII, COFEPRIS NOM-072-SSA1-2012, CFF art. 2-A/29/69-B, LISR art. 25, COSO 2013, IIA Standards 2110/2120, Odoo v17 docs, SAP B1 9.3, Lightspeed Retail docs, Square for Retail docs, Shopify POS docs, QuickBooks Desktop/Online docs*
