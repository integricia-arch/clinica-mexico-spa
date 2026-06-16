# CFDI 4.0 + PAC + Pagos con Tarjeta — Investigación Formal

> Investigación: 2026-06-12. Base para implementación del módulo de facturación.

## 1. CFDI 4.0 — Características Obligatorias

### 1.1 Tipos de Comprobante (`TipoDeComprobante`)

| Clave | Nombre | Uso en clínica |
|-------|--------|----------------|
| I | Ingreso | Consultas, medicamentos, procedimientos, estudios |
| E | Egreso | Nota de crédito, devoluciones |
| P | Pago | Complemento REP — cuando el pago es posterior a la factura |
| N | Nómina | Pago de empleados (no aplica en este módulo) |
| T | Traslado | No aplica |

### 1.2 Datos del Emisor (la clínica)

| Campo | Requerido | Notas |
|-------|-----------|-------|
| RFC | ✅ Obligatorio | Validado y activo en el SAT |
| Nombre / Razón Social | ✅ Obligatorio | Exacto al RFC en el SAT |
| RegimenFiscal | ✅ Obligatorio | Ver catálogo `c_RegimenFiscal` |
| LugarExpedicion | ✅ Obligatorio | Código postal del domicilio fiscal |
| Certificado (CSD) | ✅ Obligatorio | Archivos `.cer` + `.key` + contraseña |
| Serie | Opcional | Ej. "A", "FAC" |
| Folio | Opcional (recomendado) | Número correlativo propio |

**Regímenes fiscales más comunes para clínicas:**
- `601` — General de Ley Personas Morales
- `605` — Sueldos y Salarios (no aplica emisor)
- `612` — Personas Físicas con Actividades Empresariales y Profesionales
- `621` — Incorporación Fiscal (Régimen Simplificado de Confianza)
- `626` — Resico (Régimen Simplificado de Confianza - PM)

### 1.3 Datos del Receptor (el paciente)

| Campo | Requerido | Notas |
|-------|-----------|-------|
| RFC | ✅ Obligatorio | Validado y activo. XAXX010101000 para público general |
| Nombre | ✅ Obligatorio (CFDI 4.0 nuevo) | Exacto al SAT — causa rechazo si no coincide |
| RegimenFiscalReceptor | ✅ Obligatorio (CFDI 4.0 nuevo) | 616 para público general |
| DomicilioFiscalReceptor | ✅ Obligatorio (CFDI 4.0 nuevo) | CP del domicilio fiscal del paciente |
| UsoCFDI | ✅ Obligatorio | Ver catálogo `c_UsoCFDI` — ya no se permite "Por definir" |
| ResidenciaFiscal | Condicional | Solo si RFC extranjero |
| NumRegIdTrib | Condicional | Solo si RFC extranjero |

**Usos CFDI más relevantes para servicios médicos:**
- `S01` — Sin efectos fiscales (uso general post-CFDI 4.0 para no deducibles)
- `D01` — Honorarios médicos, dentales y gastos hospitalarios
- `D02` — Gastos médicos por incapacidad o discapacidad
- `D04` — Donativos
- `G01` — Adquisición de mercancias (farmacia)
- `G03` — Gastos en general
- `I04` — Equipo de cómputo y accesorios (TI)

### 1.4 Método y Forma de Pago

**MetodoPago:**
- `PUE` — Pago en una sola exhibición (se paga al emitir)
- `PPD` — Pago en parcialidades o diferido → **requiere Complemento de Pagos REP**

**FormaPago (`c_FormaPago`) más usadas en clínicas:**
| Clave | Descripción |
|-------|-------------|
| 01 | Efectivo |
| 02 | Cheque nominativo |
| 03 | Transferencia electrónica (SPEI) |
| 04 | Tarjeta de crédito |
| 28 | Tarjeta de débito |
| 29 | Tarjeta de servicios |
| 99 | Por definir (solo con PPD) |

### 1.5 Conceptos (líneas de detalle)

| Campo | Requerido | Notas |
|-------|-----------|-------|
| ClaveProdServ | ✅ | Catálogo SAT `c_ClaveProdServ` |
| ClaveUnidad | ✅ | Catálogo SAT `c_ClaveUnidad` |
| Cantidad | ✅ | |
| Descripcion | ✅ | |
| ValorUnitario | ✅ | Sin impuestos |
| Importe | ✅ | Cantidad × ValorUnitario |
| Descuento | Opcional | |
| ObjetoImp | ✅ | 01=No objeto, 02=Sí objeto, 03=Sí objeto no obligado |
| Impuestos | Condicional | Si ObjetoImp = 02 |
| NumeroPedimento | Condicional | Solo importaciones |

**Claves de productos/servicios para clínicas (`c_ClaveProdServ`):**
| Clave | Descripción |
|-------|-------------|
| 85121800 | Servicios de salud humana |
| 85121803 | Servicios médicos generales |
| 85121806 | Servicios médicos especializados |
| 85121805 | Servicios de cirugía |
| 85101600 | Servicios hospitalarios |
| 85131600 | Servicios de diagnóstico |
| 85141600 | Servicios de enfermería |
| 51101500 | Medicamentos y fármacos |
| 51101700 | Antibióticos |
| 41111500 | Equipo médico de diagnóstico |

**Claves de unidad (`c_ClaveUnidad`) más usadas:**
| Clave | Descripción |
|-------|-------------|
| E48 | Unidad de servicio (para servicios médicos) |
| H87 | Pieza (para medicamentos en pieza) |
| KGM | Kilogramo |
| LTR | Litro |
| ACT | Actividad |

### 1.6 Impuestos

**Traslados:**
| Impuesto | Tipo | Factor | TasaOCuota |
|----------|------|--------|------------|
| 002 IVA | Tasa | 0.160000 | Normal México |
| 002 IVA | Tasa | 0.080000 | Zona fronteriza |
| 002 IVA | Tasa | 0.000000 | Tasa cero |

**Retenciones:**
| Impuesto | Aplicación |
|----------|------------|
| 001 ISR | Honorarios profesionales a personas físicas: 10% |
| 002 IVA | Servicios a personas morales: 10.67% del IVA cobrado |

> Nota clínica: Servicios médicos de un médico titulado pueden estar exentos de IVA (Art. 15 frac. XIV LIVA). El sistema debe soportar `ObjetoImp=01` para estos casos.

### 1.7 Complementos Relevantes

| Complemento | Cuándo usar | Versión |
|-------------|-------------|---------|
| Pagos 2.0 (REP) | Cuando MetodoPago=PPD, cada que se recibe un pago | 2.0 |
| Leyendas Fiscales | Leyendas obligatorias por ley (raras para clínicas) | 1.0 |

### 1.8 Cancelación CFDI 4.0

| Motivo | Clave | Descripción |
|--------|-------|-------------|
| Con relación | 01 | Emitir CFDI de sustitución antes de cancelar |
| Sin relación | 02 | Error sin necesidad de nuevo CFDI |
| No se realizó | 03 | Operación nunca ocurrió |
| Nominativa global | 04 | Operación incluida en factura global |

**Reglas importantes:**
- Montos > $1,000 MXN: requiere aceptación del receptor (ventana de 72h para auto-cancelar)
- Montos ≤ $1,000 MXN: cancelación sin aceptación dentro de 72h
- Dentro del ejercicio fiscal: plazo límite para cancelar

### 1.9 Factura Global (público general)

Para ventas sin RFC específico (farmacia, consultas sin solicitud de factura):
- RFC receptor: `XAXX010101000`
- Nombre: `PUBLICO EN GENERAL`
- Uso: `S01`
- Régimen: `616`
- Periodicidad: `01`=Diario, `02`=Semanal, `03`=Quincenal, `04`=Mensual, `05`=Bimestral
- Exportación: `01`

---

## 2. PAC — Proveedor Autorizado de Certificación

### 2.1 ¿Qué hace un PAC?

1. Recibe el XML CFDI firmado con el CSD del emisor
2. Valida estructura, campos, RFC, catálogos SAT
3. Agrega el **Timbre Fiscal Digital (TFD)** — sello del SAT
4. Regresa el XML timbrado + UUID (folio fiscal)
5. Garantiza respaldo por 5 años (obligación legal)

### 2.2 Comparativa PACs para este proyecto

| PAC | Tipo API | Precio timbre | Sandbox | SDKs JS | Uptime | Recomendado |
|-----|----------|---------------|---------|---------|--------|-------------|
| **Facturama** | REST (JSON) | $0.50 MXN (masivo) | ✅ Gratis | ✅ | ~99.9% | ✅ **Primera opción** |
| **Fiscalapi** | REST (JSON) | Suscripción + paquetes | ✅ Gratis | ✅ JS oficial | 99.9% <500ms | ✅ Segunda opción |
| **Finkok** | SOAP/XML | Por volumen | ✅ | ❌ (solo SOAP) | 99.9% 24/7 | ❌ Para enterprise |
| **SW Sapien** | REST | Por consumo | ✅ | Parcial | ~99.5% | Tercera opción |

### 2.3 Recomendación: Facturama (Paso 1)

**Por qué Facturama:**
- Mayor adopción en SaaS/startups mexicanas
- API REST + JSON (sin SOAP)
- Autenticación: HTTP Basic sobre HTTPS
- Sandbox gratuito en `https://apisandbox.facturama.mx`
- Docs: `https://apisandbox.facturama.mx/Docs`
- Planes: $110–$1,650 MXN/año. Masivo: $0.50/timbre adicional
- Soporte cancelación, descarga XML/PDF, catálogos SAT embebidos

**Endpoints principales:**
```
POST /api/Cfdi                    → Timbrar CFDI
DELETE /api/Cfdi/{id}             → Cancelar CFDI
GET  /api/Cfdi/{id}               → Consultar CFDI
GET  /api/Cfdi/{id}/{format}      → Descargar XML / PDF
POST /api/PaymentComplement       → Complemento de pagos REP
GET  /api/catalogs/{catalog}      → Catálogos SAT
GET  /api/Client/{id}             → Catálogo de receptores guardados
```

**Autenticación:** `Authorization: Basic base64(usuario:contraseña)`

**Alternativa si escala: migrar a Fiscalapi** — REST puro, JS SDK oficial, <500ms latencia.

---

## 3. Pasarela de Pago con Tarjeta

### 3.1 Comparativa para clínicas en México (2026)

| Pasarela | Comisión tarjeta | IVA incluido | OXXO | SPEI | Terminal física | Dispersión | API |
|----------|-----------------|--------------|------|------|-----------------|------------|-----|
| **Stripe** | 3.6% + $3 MXN | ✅ Sí | ✅ (OXXO) | Próximamente | ✅ Stripe Terminal | 2-7 días | ⭐⭐⭐⭐⭐ |
| **Conekta** | 3.4% + $3 MXN + IVA | ❌ | ✅ | ✅ | ❌ | 2-3 días | ⭐⭐⭐⭐ |
| **Mercado Pago** | 3.49% + $4 MXN + IVA | ❌ | ✅ | ✅ | ✅ | Instant/14/30 días | ⭐⭐⭐ |
| **Clip** | 3.6% + IVA | ❌ | ✅ | ✅ | ✅ (principal) | 1-3 días | ⭐⭐ |

### 3.2 Recomendación: Stripe

**Por qué Stripe para Integrika:**
- IVA incluido en comisión (precio real = precio anunciado)
- API documentación excepcional, SDK oficial TypeScript
- Stripe Terminal = lector físico para cobro en consultorio
- Stripe Checkout embebido para pagos online / anticipo de citas
- Stripe OXXO disponible para pacientes sin tarjeta
- Webhooks confiables para actualizar estado de pago en tiempo real
- Comisión real efectiva a $1,500 MXN: **3.80%** (mejor que Conekta ~4.18% y MP ~4.36% después de IVA)

**Flujos cubiertos:**
1. Cobro en mostrador (tarjeta física con Terminal)
2. Pago online anticipado de cita (Stripe Checkout)
3. Pago en OXXO (sin tarjeta)
4. Cargo automático / suscripción (paquetes de servicios)

**Credenciales necesarias:**
- `STRIPE_PUBLISHABLE_KEY` (frontend, segura)
- `STRIPE_SECRET_KEY` (solo backend/edge functions, NUNCA en cliente)
- `STRIPE_WEBHOOK_SECRET` (validar eventos de webhook)

---

## 4. Modelo de Datos — Tablas Nuevas Requeridas

### `cfdi_config` — Configuración CFDI por clínica
```sql
id uuid PK
clinic_id uuid FK → clinics
rfc varchar(13)
razon_social text
regimen_fiscal varchar(3)           -- c_RegimenFiscal
domicilio_fiscal_cp varchar(5)
serie_defecto varchar(10)            -- "A", "FAC", etc.
pac_proveedor text                   -- 'facturama' | 'fiscalapi'
pac_ambiente text                    -- 'sandbox' | 'produccion'
pac_usuario text                     -- cifrado en tránsito
pac_contrasena text                  -- cifrado, nunca plain en BD
csd_cer_path text                    -- ruta en storage seguro
csd_key_path text                    -- ruta en storage seguro
csd_contrasena text                  -- cifrada
iva_default numeric(5,4)             -- 0.16 por defecto
zona_fronteriza boolean              -- IVA al 8%
activo boolean
created_at timestamptz
updated_at timestamptz
```

### `cfdi_receptores` — Datos fiscales de pacientes/empresas
```sql
id uuid PK
clinic_id uuid FK → clinics
patient_id uuid FK → patients (nullable, puede ser empresa)
rfc varchar(13)
nombre text
regimen_fiscal varchar(3)
domicilio_fiscal_cp varchar(5)
uso_cfdi_defecto varchar(3)          -- c_UsoCFDI
email_envio text                     -- para envío automático del XML
created_at timestamptz
updated_at timestamptz
```

### `cfdi_documentos` — CFDI emitidos
```sql
id uuid PK
clinic_id uuid FK → clinics
uuid_fiscal uuid                     -- UUID del SAT (folio fiscal)
serie varchar(10)
folio text
tipo text                            -- I, E, P, N
fecha_emision timestamptz
rfc_emisor varchar(13)
rfc_receptor varchar(13)
nombre_receptor text
subtotal numeric(12,2)
descuento numeric(12,2)
total numeric(12,2)
moneda varchar(3)                    -- MXN
metodo_pago varchar(3)               -- PUE, PPD
forma_pago varchar(2)
xml_path text                        -- ruta en Supabase Storage
pdf_path text
status text                          -- vigente | cancelado
motivo_cancelacion varchar(2)
cfdi_relacionado_uuid uuid
appointment_id uuid FK → appointments (nullable)
patient_id uuid FK → patients (nullable)
sale_id uuid                         -- pharmacy_sales o movimientos
created_at timestamptz
updated_at timestamptz
```

### `cfdi_conceptos` — Líneas del CFDI (para consulta)
```sql
id uuid PK
cfdi_id uuid FK → cfdi_documentos
clave_prod_serv varchar(8)
clave_unidad varchar(3)
cantidad numeric(10,4)
descripcion text
valor_unitario numeric(12,6)
importe numeric(12,2)
descuento numeric(12,2)
objeto_imp varchar(2)                -- 01, 02, 03
iva_tasa numeric(5,4)               -- 0.16, 0.08, 0.00
iva_importe numeric(12,2)
created_at timestamptz
```

### `payment_gateway_config` — Configuración pasarela de pago
```sql
id uuid PK
clinic_id uuid FK → clinics
proveedor text                       -- 'stripe' | 'conekta' | 'ninguno'
ambiente text                        -- 'sandbox' | 'produccion'
stripe_publishable_key text          -- public, seguro en cliente
stripe_webhook_secret text           -- solo backend
stripe_terminal_habilitado boolean
metodos_habilitados text[]           -- ['card','oxxo','spei']
activo boolean
created_at timestamptz
updated_at timestamptz
```

> `STRIPE_SECRET_KEY` NUNCA en BD — solo en Supabase Vault / env vars de edge functions.

### `payment_transactions` — Transacciones con pasarela
```sql
id uuid PK
clinic_id uuid FK → clinics
appointment_id uuid FK → appointments (nullable)
sale_id uuid (nullable)
proveedor text                       -- stripe, conekta
payment_intent_id text               -- ID de Stripe/Conekta
amount numeric(12,2)
currency varchar(3)                  -- MXN
metodo text                          -- card, oxxo, spei
status text                          -- pending | paid | failed | refunded
metadata jsonb
cfdi_id uuid FK → cfdi_documentos (nullable)
created_at timestamptz
updated_at timestamptz
```

---

## 5. Configuración — Secciones Nuevas

### 5.1 Sección existente a activar: "Facturación y CFDI"
Ruta propuesta: `/configuracion/facturacion`

**UI sections:**
- Datos del emisor (RFC, razón social, régimen, CP)
- Certificado de Sello Digital (CSD) — upload `.cer` + `.key`
- PAC configuración (proveedor, ambiente, credenciales)
- Preferencias (serie, IVA default, zona fronteriza)
- Test de timbrado (botón para verificar conexión PAC en sandbox)

### 5.2 Sección nueva: "Cobros y pagos digitales"
Ruta propuesta: `/configuracion/pagos`

**UI sections:**
- Pasarela de pago (selector: Stripe / Conekta / ninguno)
- Credenciales Stripe (publishable key, habilitación de terminal)
- Métodos aceptados (tarjeta, OXXO, SPEI)
- Terminal física (Stripe Terminal reader config)
- Test de conexión

---

## 6. Plan de Implementación — Fases

### Fase 1: Fundación (ahora)
- [ ] Migración SQL: tablas `cfdi_config`, `cfdi_receptores`, `cfdi_documentos`, `cfdi_conceptos`
- [ ] Migración SQL: tablas `payment_gateway_config`, `payment_transactions`
- [ ] Configuración → sección Facturación CFDI (formulario emisor + CSD upload)
- [ ] Configuración → sección Pagos (selector pasarela + credenciales)

### Fase 2: CFDI emisión básica
- [ ] Edge function `cfdi-timbrar`: recibe datos, firma con CSD, llama Facturama API, guarda XML
- [ ] Facturación UI: botón "Timbrar CFDI" en registros de cobro
- [ ] Generación de CFDI tipo I (Ingreso) para citas pagadas
- [ ] Descarga XML + PDF
- [ ] Validación de datos fiscales del receptor antes de timbrar

### Fase 3: Complemento de Pagos
- [ ] CFDI tipo P (Pago) — Complemento REP para cobros PPD
- [ ] Asociar transacciones de farmacia a CFDI global diario/mensual

### Fase 4: Stripe
- [ ] Edge function `stripe-payment-intent`: crea PaymentIntent seguro en servidor
- [ ] Frontend: Stripe Elements para captura de tarjeta en cobro
- [ ] Webhook handler: actualiza `payment_transactions` en tiempo real
- [ ] Integración con Stripe Terminal para cobro físico

### Fase 5: Cancelación y gestión
- [ ] Cancelación CFDI con motivo y sustitución
- [ ] Factura global para público general (farmacia)
- [ ] Notas de crédito (CFDI tipo E)

---

## 7. Seguridad

- CSD `.key` y contraseña: almacenar en Supabase Vault, nunca en `clinic_settings` en texto plano
- `STRIPE_SECRET_KEY`: solo en env vars de edge functions, nunca en cliente
- Webhooks Stripe: validar `Stripe-Signature` header en cada llamada
- CFDI XML: almacenar en Supabase Storage con bucket privado (solo service_role)
- RFC del receptor: validar contra lista negra SAT (69-B) antes de timbrar

---

*Fuentes: SAT Anexo 20 RMF 2026, Facturama API docs, Fiscalapi.com, Atempora Stripe vs Conekta vs MP análisis 2026, Banxico tasas descuento giro médico abril 2026*
