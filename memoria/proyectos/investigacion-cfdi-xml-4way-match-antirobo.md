# Investigación: CFDI 4.0 Parsing XML, 4-Way Match y Sistema Anti-Fraude para Farmacias

**Autor:** Investigación técnica para integrika.mx  
**Fecha:** 2026-06-15  
**Versión:** 1.0  
**Contexto:** Sistema de clínica/farmacia con Supabase, Edge Functions Deno, ya tiene 3-way match básico

---

## Resumen Ejecutivo

Esta investigación cubre el parsing automatizado de CFDI 4.0 (XML SAT México) para facturas de proveedores farmacéuticos, el diseño de un sistema de 4-way match a nivel de línea de producto (no solo totales), y las alertas anti-fraude/anti-robo de medicamentos. El objetivo es reemplazar la captura manual actual por una validación automática que detecte discrepancias entre lo facturado, lo ordenado y lo físicamente recibido.

---

## 1. Estructura CFDI 4.0 para Compras Farmacéuticas

### 1.1 Contexto Legal

El CFDI (Comprobante Fiscal Digital por Internet) versión 4.0 es obligatorio desde 2023 para todos los contribuyentes en México. Cada CFDI es timbrado por un PAC (Proveedor Autorizado de Certificación) y contiene un UUID (Folio Fiscal) único que identifica el documento ante el SAT. Para una farmacia que compra medicamentos, el proveedor emite un CFDI tipo `I` (Ingreso) desde su perspectiva — que es la factura que la farmacia recibe como comprobante de compra.

### 1.2 Estructura XML Completa — Ejemplo Real CFDI 4.0

```xml
<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante
  xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd"
  Version="4.0"
  Serie="A"
  Folio="10245"
  Fecha="2026-06-14T10:30:00"
  Sello="[SELLO_DIGITAL_BASE64]"
  FormaPago="03"
  NoCertificado="20001000000300022815"
  Certificado="[CERTIFICADO_BASE64]"
  SubTotal="15000.00"
  Descuento="0.00"
  Moneda="MXN"
  Total="17400.00"
  TipoDeComprobante="I"
  Exportacion="01"
  MetodoPago="PUE"
  LugarExpedicion="06600">

  <!-- ===== EMISOR (el proveedor de medicamentos) ===== -->
  <cfdi:Emisor
    Rfc="DIST123456ABC"
    Nombre="DISTRIBUIDORA FARMACEUTICA SA DE CV"
    RegimenFiscal="601"/>

  <!-- ===== RECEPTOR (la farmacia/clínica que compra) ===== -->
  <cfdi:Receptor
    Rfc="CLIN987654XYZ"
    Nombre="CLINICA MEXICO SA DE CV"
    DomicilioFiscalReceptor="06600"
    RegimenFiscalReceptor="601"
    UsoCFDI="G03"/>
    <!-- UsoCFDI G03 = Gastos en general (compras para reventa) -->
    <!-- UsoCFDI G01 = Adquisición de mercancias -->

  <!-- ===== CONCEPTOS (líneas de productos) ===== -->
  <cfdi:Conceptos>

    <!-- Concepto 1: Paracetamol 500mg -->
    <cfdi:Concepto
      ClaveProdServ="51101603"
      NoIdentificacion="MED-PAR-500"
      Cantidad="100"
      ClaveUnidad="H87"
      Unidad="Pieza"
      Descripcion="PARACETAMOL 500MG TAB C/10"
      ValorUnitario="25.00"
      Importe="2500.00"
      Descuento="0.00"
      ObjetoImp="02">
      <!-- ObjetoImp 02 = Sí objeto de impuesto -->
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado
            Base="2500.00"
            Impuesto="002"
            TipoFactor="Tasa"
            TasaOCuota="0.160000"
            Importe="400.00"/>
          <!-- Impuesto 002 = IVA; TasaOCuota 0.160000 = 16% -->
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>

    <!-- Concepto 2: Amoxicilina (antibiótico con IVA exento) -->
    <cfdi:Concepto
      ClaveProdServ="51101500"
      NoIdentificacion="MED-AMX-250"
      Cantidad="50"
      ClaveUnidad="H87"
      Unidad="Pieza"
      Descripcion="AMOXICILINA 250MG/5ML SUS 60ML"
      ValorUnitario="45.00"
      Importe="2250.00"
      ObjetoImp="01">
      <!-- ObjetoImp 01 = No objeto de impuesto (medicamentos de patente: IVA 0%) -->
    </cfdi:Concepto>

    <!-- Concepto 3: Insulina (cadena de frío, tasa 0%) -->
    <cfdi:Concepto
      ClaveProdServ="51101700"
      NoIdentificacion="MED-INS-NPH"
      Cantidad="20"
      ClaveUnidad="H87"
      Unidad="Pieza"
      Descripcion="INSULINA NPH 100UI/ML 10ML VIAL"
      ValorUnitario="520.00"
      Importe="10400.00"
      ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado
            Base="10400.00"
            Impuesto="002"
            TipoFactor="Tasa"
            TasaOCuota="0.000000"
            Importe="0.00"/>
          <!-- IVA 0% para medicamentos de patente -->
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>

  </cfdi:Conceptos>

  <!-- ===== RESUMEN DE IMPUESTOS A NIVEL COMPROBANTE ===== -->
  <cfdi:Impuestos TotalImpuestosTrasladados="400.00">
    <cfdi:Traslados>
      <cfdi:Traslado
        Base="2500.00"
        Impuesto="002"
        TipoFactor="Tasa"
        TasaOCuota="0.160000"
        Importe="400.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>

  <!-- ===== TIMBRE FISCAL DIGITAL (puesto por el PAC) ===== -->
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital
      xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
      Version="1.1"
      UUID="6128A3C0-4B2D-41F8-9A1E-123456789ABC"
      FechaTimbrado="2026-06-14T10:30:55"
      RfcProvCertif="SAT970701NN3"
      NoCertificadoSAT="20001000000300022816"
      SelloSAT="[SELLO_SAT_BASE64]"
      SelloCFD="[SELLO_CFD_BASE64]"/>
  </cfdi:Complemento>

</cfdi:Comprobante>
```

### 1.3 Campos Clave del CFDI y su Mapeo

| Campo CFDI | Nodo | Descripción | Mapeo en Sistema |
|---|---|---|---| 
| `UUID` | TimbreFiscalDigital | Folio fiscal único (36 chars) | `facturas_proveedor.uuid_cfdi` |
| `Total` | Comprobante | Monto total con IVA | `facturas_proveedor.total_centavos` |
| `SubTotal` | Comprobante | Monto antes de IVA | `facturas_proveedor.subtotal_centavos` |
| `Fecha` | Comprobante | Fecha emisión del CFDI | `facturas_proveedor.fecha_cfdi` |
| `Rfc` | Emisor | RFC del proveedor | Verificar vs `proveedores.rfc` |
| `NoIdentificacion` | Concepto | Código interno del proveedor | Match vs `medicamentos.codigo_proveedor` |
| `ClaveProdServ` | Concepto | Clave SAT del producto | Validar es farmacéutico |
| `Cantidad` | Concepto | Unidades facturadas | Comparar vs OC y recepción |
| `ValorUnitario` | Concepto | Precio por unidad | Comparar vs OC precio pactado |
| `Importe` | Concepto | Subtotal por línea (Cantidad × ValorUnitario) | Recalcular para validar |
| `TasaOCuota` | Traslado/Impuesto | Tasa IVA (0.16, 0.0, o Exento) | Calcular IVA por línea |

### 1.4 Claves ClaveProdServ del SAT para Medicamentos

El catálogo `c_ClaveProdServ` del SAT organiza los medicamentos en la sección **51 — Drogas y productos farmacéuticos**:

| Código | Descripción | Aplica a |
|---|---|---|
| `51100000` | Drogas y productos farmacéuticos | Categoría padre |
| `51101500` | Antibióticos y antimicrobianos | Amoxicilina, Azitromicina, Ciprofloxacino |
| `51101600` | Analgésicos y antipiréticos | Paracetamol, Ibuprofeno, Diclofenaco |
| `51101603` | Analgésicos no narcóticos | Paracetamol, Metamizol |
| `51101700` | Hormonas y agentes relacionados | Insulinas, Tiroxina |
| `51101800` | Vitaminas y suplementos minerales | Complejo B, Vitamina C |
| `51101900` | Antihistamínicos y antialérgicos | Loratadina, Cetirizina |
| `51102000` | Cardiovasculares | Metoprolol, Enalapril, Losartán |
| `51102100` | Antiulcerosos y gastrointestinales | Omeprazol, Ranitidina |
| `51102200` | Antidiabéticos orales | Metformina, Glibenclamida |
| `51102300` | Dermatológicos | Clotrimazol crema, Betametasona |
| `51110000` | Preparaciones farmacéuticas de diagnóstico | Reactivos, tiras glucosa |
| `51161500` | Material de curación y sutura | Gasas, vendas, suturas |
| `85121502` | Servicios farmacéuticos | Cuando aplica |

**Importante para IVA**: En México, los medicamentos de patente (con registro sanitario COFEPRIS) tienen IVA al **0%** (tasa 0, no exentos). Los suplementos alimenticios, cosméticos y productos sin registro como medicamento pagan IVA al **16%**. En el CFDI esto se refleja en `TasaOCuota="0.000000"` vs `TasaOCuota="0.160000"`.

**ClaveUnidad para medicamentos**: `H87` (Pieza) es la más común. También se usa `BX` (Caja), `BT` (Botella), `SET` (Conjunto).

---

## 2. Parsing XML CFDI en TypeScript/Deno (Supabase Edge Function)

### 2.1 Estrategia de Parsing

Las Supabase Edge Functions corren en **Deno** (runtime TypeScript nativo). Para parsear XML CFDI hay tres opciones:

| Opción | Pros | Contras |
|---|---|---|
| `DOMParser` nativo | Sin dependencias, disponible en Deno | API verbosa, más código |
| `fast-xml-parser` (npm) | Rápido, bien mantenido, v5.x | Import vía CDN/esm.sh |
| `@nodecfdi/cfdi-core` | Específico para CFDI | Menor comunidad |

**Recomendación**: `fast-xml-parser` importado vía `esm.sh` para Deno. Es la solución más mantenida con 4500+ proyectos npm dependientes.

### 2.2 Edge Function: `cfdi-parse`

```typescript
// supabase/functions/cfdi-parse/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.4.1"

// =========================================================
// TIPOS
// =========================================================

interface ConceptoCFDI {
  claveProdServ: string
  noIdentificacion: string
  cantidad: number
  claveUnidad: string
  descripcion: string
  valorUnitario: number
  importe: number
  descuento: number
  tasaIva: number  // 0, 0.08, 0.16
  importeIva: number
  importeTotal: number
  objetoImp: string // "01" no objeto, "02" sí objeto
}

interface CFDIParsed {
  uuid: string
  version: string
  serie: string
  folio: string
  fecha: string
  fechaTimbrado: string
  rfcEmisor: string
  nombreEmisor: string
  rfcReceptor: string
  nombreReceptor: string
  subTotal: number
  descuento: number
  total: number
  moneda: string
  tipoDeComprobante: string
  metodoPago: string
  formaPago: string
  totalIva: number
  conceptos: ConceptoCFDI[]
  // Validación SAT
  selloCFD: string
  selloSAT: string
  noCertificadoSAT: string
}

interface MatchResultLinea {
  conceptoCfdi: ConceptoCFDI
  medicamentoId: string | null
  matchMethod: "exact_codigo" | "exact_no_identificacion" | "fuzzy_descripcion" | "no_match"
  matchScore: number  // 0-100
  ocCantidadPedida: number | null
  recepcionCantidadRecibida: number | null
  ocPrecioUnitario: number | null
  alertas: AlertaMatch[]
}

interface AlertaMatch {
  tipo: TipoAlerta
  severidad: "CRITICA" | "ALTA" | "MEDIA" | "BAJA"
  descripcion: string
  valorCFDI: number
  valorReferencia: number
  diferencia: number
  porcentajeDiferencia: number
}

type TipoAlerta =
  | "CANTIDAD_FACTURADA_MAYOR_RECIBIDA"     // ROBO/DESVIO
  | "CANTIDAD_FACTURADA_MAYOR_ORDENADA"     // FACTURACION INDEBIDA
  | "CANTIDAD_RECIBIDA_MENOR_ORDENADA"      // FALTANTE EN ENTREGA
  | "PRECIO_UNITARIO_MAYOR_OC"             // COBRO EXCESIVO
  | "PRECIO_UNITARIO_MENOR_OC"             // DESCUENTO NO AUTORIZADO
  | "TOTAL_NO_CUADRA"                      // ERROR ARITMETICO
  | "PRODUCTO_SIN_CATALOGAR"               // NUEVO PRODUCTO
  | "RFC_EMISOR_NO_COINCIDE"               // PROVEEDOR INCORRECTO
  | "UUID_DUPLICADO"                       // FACTURA DUPLICADA
  | "CFDI_CANCELADO_SAT"                   // INVALIDO ANTE SAT

// =========================================================
// PARSER PRINCIPAL
// =========================================================

const CFDI_NS = "cfdi"
const TFD_NS = "tfd"

function parseCFDIXML(xmlContent: string): CFDIParsed {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: false,  // Mantener prefijos de namespace
    parseAttributeValue: true,
    parseTagValue: false,
    trimValues: true,
  })

  const parsed = parser.parse(xmlContent)

  // El nodo raíz puede ser "cfdi:Comprobante" o con variaciones de namespace
  const comprobante =
    parsed["cfdi:Comprobante"] ||
    parsed["Comprobante"] ||
    parsed["cfdi:comprobante"]

  if (!comprobante) {
    throw new Error("XML no es un CFDI válido: falta nodo cfdi:Comprobante")
  }

  const attrs = comprobante  // Los atributos están al mismo nivel con el prefix @_

  // Timbre Fiscal Digital (dentro de cfdi:Complemento)
  const complemento = comprobante["cfdi:Complemento"] || comprobante["Complemento"]
  const timbre =
    complemento?.["tfd:TimbreFiscalDigital"] ||
    complemento?.["TimbreFiscalDigital"]

  if (!timbre) {
    throw new Error("CFDI sin timbre fiscal digital — documento no timbrado o inválido")
  }

  // Impuestos a nivel comprobante
  const impuestosComp = comprobante["cfdi:Impuestos"] || comprobante["Impuestos"]
  const totalIvaTrasladado = parseFloat(
    impuestosComp?.["@_TotalImpuestosTrasladados"] || "0"
  )

  // Parsear conceptos
  const conceptosNodo = comprobante["cfdi:Conceptos"] || comprobante["Conceptos"]
  const conceptosRaw = conceptosNodo?.["cfdi:Concepto"] || conceptosNodo?.["Concepto"] || []
  // Si solo hay un concepto, XMLParser devuelve objeto (no array)
  const conceptosArray = Array.isArray(conceptosRaw) ? conceptosRaw : [conceptosRaw]

  const conceptos: ConceptoCFDI[] = conceptosArray.map(parseConcepto)

  return {
    uuid: String(timbre["@_UUID"] || ""),
    version: String(attrs["@_Version"] || "4.0"),
    serie: String(attrs["@_Serie"] || ""),
    folio: String(attrs["@_Folio"] || ""),
    fecha: String(attrs["@_Fecha"] || ""),
    fechaTimbrado: String(timbre["@_FechaTimbrado"] || ""),
    rfcEmisor: String(comprobante["cfdi:Emisor"]?.["@_Rfc"] || comprobante["Emisor"]?.["@_Rfc"] || ""),
    nombreEmisor: String(comprobante["cfdi:Emisor"]?.["@_Nombre"] || comprobante["Emisor"]?.["@_Nombre"] || ""),
    rfcReceptor: String(comprobante["cfdi:Receptor"]?.["@_Rfc"] || comprobante["Receptor"]?.["@_Rfc"] || ""),
    nombreReceptor: String(comprobante["cfdi:Receptor"]?.["@_Nombre"] || comprobante["Receptor"]?.["@_Nombre"] || ""),
    subTotal: parseFloat(String(attrs["@_SubTotal"] || "0")),
    descuento: parseFloat(String(attrs["@_Descuento"] || "0")),
    total: parseFloat(String(attrs["@_Total"] || "0")),
    moneda: String(attrs["@_Moneda"] || "MXN"),
    tipoDeComprobante: String(attrs["@_TipoDeComprobante"] || ""),
    metodoPago: String(attrs["@_MetodoPago"] || ""),
    formaPago: String(attrs["@_FormaPago"] || ""),
    totalIva: totalIvaTrasladado,
    conceptos,
    selloCFD: String(attrs["@_Sello"] || ""),
    selloSAT: String(timbre["@_SelloSAT"] || ""),
    noCertificadoSAT: String(timbre["@_NoCertificadoSAT"] || ""),
  }
}

function parseConcepto(c: Record<string, unknown>): ConceptoCFDI {
  const cantidad = parseFloat(String(c["@_Cantidad"] || "0"))
  const valorUnitario = parseFloat(String(c["@_ValorUnitario"] || "0"))
  const importe = parseFloat(String(c["@_Importe"] || "0"))
  const descuento = parseFloat(String(c["@_Descuento"] || "0"))
  const objetoImp = String(c["@_ObjetoImp"] || "01")

  // Extraer IVA del nodo Impuestos del concepto
  let tasaIva = 0
  let importeIva = 0

  const impuestosConcepto = c["cfdi:Impuestos"] || c["Impuestos"]
  if (impuestosConcepto && objetoImp === "02") {
    const traslados = impuestosConcepto["cfdi:Traslados"] || impuestosConcepto["Traslados"]
    const trasladosList = traslados
      ? (Array.isArray(traslados["cfdi:Traslado"] || traslados["Traslado"])
          ? (traslados["cfdi:Traslado"] || traslados["Traslado"])
          : [traslados["cfdi:Traslado"] || traslados["Traslado"]])
      : []

    // Buscar IVA (Impuesto="002")
    const ivaTraslado = trasladosList.find(
      (t: Record<string, unknown>) => String(t["@_Impuesto"]) === "002"
    )
    if (ivaTraslado) {
      tasaIva = parseFloat(String(ivaTraslado["@_TasaOCuota"] || "0"))
      importeIva = parseFloat(String(ivaTraslado["@_Importe"] || "0"))
    }
  }

  return {
    claveProdServ: String(c["@_ClaveProdServ"] || ""),
    noIdentificacion: String(c["@_NoIdentificacion"] || ""),
    cantidad,
    claveUnidad: String(c["@_ClaveUnidad"] || "H87"),
    descripcion: String(c["@_Descripcion"] || ""),
    valorUnitario,
    importe,
    descuento,
    tasaIva,
    importeIva,
    importeTotal: importe - descuento + importeIva,
    objetoImp,
  }
}

// =========================================================
// VALIDACION ARITMETICA INTERNA DEL CFDI
// =========================================================

function validarAritmeticaCFDI(cfdi: CFDIParsed): string[] {
  const errores: string[] = []

  // Validar que cada concepto: Cantidad * ValorUnitario = Importe (tolerancia 1 centavo)
  for (const concepto of cfdi.conceptos) {
    const importeCalculado = Math.round(concepto.cantidad * concepto.valorUnitario * 100) / 100
    const diferencia = Math.abs(importeCalculado - concepto.importe)
    if (diferencia > 0.02) {
      errores.push(
        `Concepto "${concepto.descripcion}": Cantidad(${concepto.cantidad}) × ValorUnitario(${concepto.valorUnitario}) = ${importeCalculado} ≠ Importe(${concepto.importe})`
      )
    }
  }

  // Validar SubTotal = suma de Importes - Descuentos de conceptos
  const subTotalCalculado = cfdi.conceptos.reduce(
    (acc, c) => acc + c.importe - c.descuento,
    0
  )
  if (Math.abs(subTotalCalculado - cfdi.subTotal) > 0.02) {
    errores.push(
      `SubTotal del CFDI ${cfdi.subTotal} no coincide con suma de conceptos ${subTotalCalculado}`
    )
  }

  // Validar Total = SubTotal + IVA
  const totalCalculado = cfdi.subTotal - cfdi.descuento + cfdi.totalIva
  if (Math.abs(totalCalculado - cfdi.total) > 0.02) {
    errores.push(
      `Total del CFDI ${cfdi.total} no coincide con SubTotal + IVA = ${totalCalculado}`
    )
  }

  return errores
}

// =========================================================
// VERIFICACION ANTE EL SAT (WebService SOAP)
// =========================================================

async function verificarCFDIenSAT(
  uuid: string,
  rfcEmisor: string,
  rfcReceptor: string,
  total: string
): Promise<{ estado: string; esCancelable: string; estatusCancelacion: string }> {
  // Endpoint oficial del SAT para consulta de estado CFDI
  const SAT_ENDPOINT = "https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc"

  // Expresión de búsqueda para CFDI 4.0
  const expresion = encodeURIComponent(
    `?re=${rfcEmisor}&rr=${rfcReceptor}&tt=${total}&id=${uuid}`
  )

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:Consulta>
      <tem:expresionImpresa>${expresion}</tem:expresionImpresa>
    </tem:Consulta>
  </soapenv:Body>
</soapenv:Envelope>`

  try {
    const response = await fetch(SAT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://tempuri.org/IConsultaCFDIService/Consulta",
      },
      body: soapBody,
      signal: AbortSignal.timeout(15000), // 15s timeout
    })

    const responseText = await response.text()

    // Parsear respuesta SOAP para extraer CodigoEstatus
    const estadoMatch = responseText.match(/<a:Estado>([^<]+)<\/a:Estado>/)
    const cancelableMatch = responseText.match(/<a:EsCancelable>([^<]+)<\/a:EsCancelable>/)
    const estatusMatch = responseText.match(/<a:EstatusCancelacion>([^<]+)<\/a:EstatusCancelacion>/)

    return {
      estado: estadoMatch?.[1] || "Desconocido",
      // "Vigente" = válido | "Cancelado" = inválido
      esCancelable: cancelableMatch?.[1] || "",
      estatusCancelacion: estatusMatch?.[1] || "",
    }
  } catch (error) {
    // Si el SAT no responde, registrar el intento pero no bloquear el flujo
    console.error("[cfdi-parse] Error consultando SAT:", error)
    return {
      estado: "ErrorConsulta",
      esCancelable: "",
      estatusCancelacion: "",
    }
  }
}

// =========================================================
// HANDLER DE LA EDGE FUNCTION
// =========================================================

serve(async (req: Request) => {
  // Solo POST con multipart/form-data o JSON con xmlContent
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), { status: 405 })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  try {
    // Extraer XML del cuerpo de la solicitud
    let xmlContent: string
    let facturaProveedorId: string
    let ordenCompraId: string
    let recepcionId: string

    const contentType = req.headers.get("content-type") || ""
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      const file = formData.get("cfdi_xml") as File
      if (!file) throw new Error("Campo 'cfdi_xml' requerido")
      xmlContent = await file.text()
      facturaProveedorId = String(formData.get("factura_proveedor_id") || "")
      ordenCompraId = String(formData.get("orden_compra_id") || "")
      recepcionId = String(formData.get("recepcion_id") || "")
    } else {
      const body = await req.json()
      xmlContent = body.xml_content
      facturaProveedorId = body.factura_proveedor_id
      ordenCompraId = body.orden_compra_id
      recepcionId = body.recepcion_id
    }

    if (!xmlContent || xmlContent.length < 100) {
      throw new Error("Contenido XML inválido o vacío")
    }

    // 1. Parsear XML
    const cfdi = parseCFDIXML(xmlContent)

    // 2. Validar aritmética interna
    const erroresAritmeticos = validarAritmeticaCFDI(cfdi)

    // 3. Verificar ante SAT (async, no bloqueante para el flujo principal)
    const estadoSAT = await verificarCFDIenSAT(
      cfdi.uuid,
      cfdi.rfcEmisor,
      cfdi.rfcReceptor,
      cfdi.total.toFixed(2)
    )

    // 4. Verificar UUID duplicado en BD
    const { data: cfdiExistente } = await supabase
      .from("facturas_proveedor_cfdi")
      .select("id, factura_proveedor_id")
      .eq("uuid_cfdi", cfdi.uuid)
      .single()

    if (cfdiExistente) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `UUID duplicado: este CFDI ya fue registrado en factura ${cfdiExistente.factura_proveedor_id}`,
          alerta: "UUID_DUPLICADO",
        }),
        { status: 409 }
      )
    }

    // 5. Guardar CFDI parseado en BD
    const { data: cfdiGuardado, error: errorGuardado } = await supabase
      .from("facturas_proveedor_cfdi")
      .insert({
        factura_proveedor_id: facturaProveedorId,
        uuid_cfdi: cfdi.uuid,
        serie: cfdi.serie,
        folio: cfdi.folio,
        fecha_cfdi: cfdi.fecha,
        fecha_timbrado: cfdi.fechaTimbrado,
        rfc_emisor: cfdi.rfcEmisor,
        nombre_emisor: cfdi.nombreEmisor,
        subtotal_centavos: Math.round(cfdi.subTotal * 100),
        descuento_centavos: Math.round(cfdi.descuento * 100),
        iva_centavos: Math.round(cfdi.totalIva * 100),
        total_centavos: Math.round(cfdi.total * 100),
        moneda: cfdi.moneda,
        estado_sat: estadoSAT.estado,
        errores_aritmeticos: erroresAritmeticos,
        xml_raw: xmlContent,
        conceptos: cfdi.conceptos,
      })
      .select()
      .single()

    if (errorGuardado) throw errorGuardado

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          cfdi_id: cfdiGuardado.id,
          uuid: cfdi.uuid,
          total: cfdi.total,
          conceptos_count: cfdi.conceptos.length,
          estado_sat: estadoSAT.estado,
          errores_aritmeticos: erroresAritmeticos,
          cfdi: cfdi,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[cfdi-parse] Error:", message)
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }
})
```

---

## 3. Mapeo CFDI Concepto → Medicamento del Catálogo

### 3.1 Estrategia de Matching por Prioridad

El matching se hace en cascada, del más confiable al menos confiable:

```typescript
// supabase/functions/cfdi-match-conceptos/index.ts

async function matchConceptoAMedicamento(
  supabase: SupabaseClient,
  concepto: ConceptoCFDI,
  proveedorId: string
): Promise<MatchResultLinea> {

  // ─── NIVEL 1: Match exacto por NoIdentificacion del proveedor ───────────
  // NoIdentificacion = código interno que el PROVEEDOR asigna al producto
  // Es el campo más confiable porque es determinístico
  if (concepto.noIdentificacion) {
    const { data } = await supabase
      .from("medicamento_codigos_proveedor")
      .select("medicamento_id, codigo_proveedor")
      .eq("proveedor_id", proveedorId)
      .eq("codigo_proveedor", concepto.noIdentificacion)
      .single()

    if (data) {
      return buildMatchResult(concepto, data.medicamento_id, "exact_no_identificacion", 100)
    }
  }

  // ─── NIVEL 2: Match exacto por código interno/SKU ───────────────────────
  // Buscar en la tabla de medicamentos por código de barras o SKU
  const { data: medicamentoPorCodigo } = await supabase
    .from("medicamentos")
    .select("id, nombre, codigo_barras, sku")
    .or(
      `codigo_barras.eq.${concepto.noIdentificacion},` +
      `sku.eq.${concepto.noIdentificacion}`
    )
    .single()

  if (medicamentoPorCodigo) {
    return buildMatchResult(concepto, medicamentoPorCodigo.id, "exact_codigo", 95)
  }

  // ─── NIVEL 3: Fuzzy match por descripción normalizada ───────────────────
  // Normalizar ambas cadenas antes de comparar
  const descripcionNormalizada = normalizarDescripcion(concepto.descripcion)

  const { data: medicamentos } = await supabase
    .from("medicamentos")
    .select("id, nombre, nombre_generico, presentacion")
    .limit(200) // Buscar en catálogo activo

  if (medicamentos) {
    let mejorMatch = { medicamentoId: "", score: 0 }

    for (const med of medicamentos) {
      const nombreNorm = normalizarDescripcion(med.nombre)
      const genericoNorm = normalizarDescripcion(med.nombre_generico || "")
      const score = Math.max(
        calcularSimilitud(descripcionNormalizada, nombreNorm),
        calcularSimilitud(descripcionNormalizada, genericoNorm)
      )
      if (score > mejorMatch.score) {
        mejorMatch = { medicamentoId: med.id, score }
      }
    }

    // Solo aceptar matches con score >= 75%
    if (mejorMatch.score >= 75) {
      return buildMatchResult(concepto, mejorMatch.medicamentoId, "fuzzy_descripcion", mejorMatch.score)
    }
  }

  // ─── NIVEL 4: Sin match — producto nuevo/no catalogado ──────────────────
  return buildMatchResult(concepto, null, "no_match", 0)
}

function normalizarDescripcion(texto: string): string {
  return texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // Quitar acentos
    .replace(/[^A-Z0-9\s]/g, " ")     // Solo alfanumérico
    .replace(/\s+/g, " ")             // Colapsar espacios
    .trim()
}

function calcularSimilitud(a: string, b: string): number {
  // Algoritmo de distancia Levenshtein normalizada
  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a
  if (longer.length === 0) return 100

  const editDistance = levenshteinDistance(longer, shorter)
  return Math.round(((longer.length - editDistance) / longer.length) * 100)
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i-1] === a[j-1]
        ? matrix[i-1][j-1]
        : Math.min(
            matrix[i-1][j-1] + 1,
            matrix[i][j-1] + 1,
            matrix[i-1][j] + 1
          )
    }
  }
  return matrix[b.length][a.length]
}
```

### 3.2 Consideraciones de Matching para Medicamentos

- **NoIdentificacion es la clave de oro**: Los distribuidores farmacéuticos (DISFASA, Marzam, Nadro, etc.) asignan códigos internos consistentes. Construir una tabla `medicamento_codigos_proveedor` con estos mapeos es la inversión más valiosa.
- **Fuzzy matching por descripción**: Manejar variantes comunes: "PARACETAMOL" vs "PARACETAMOL 500MG TAB", "AMOXICILIN" vs "AMOXICILINA". El umbral de 75% de similitud evita falsos positivos.
- **Productos sin match**: Generar alerta `PRODUCTO_SIN_CATALOGAR` y encolar para revisión manual. El operador puede crear el medicamento o agregar el código de proveedor.

---

## 4. Sistema de 4-Way Match: Lógica Completa Anti-Fraude

### 4.1 Las 4 Comparaciones y su Significado

```
OC (Orden de Compra)  →  emitida por la farmacia al proveedor
CFDI (Factura CFDI)   →  emitida por el proveedor
Recepción             →  registrada por el almacenista al recibir
Factura Interna       →  registrada en el sistema (actualmente manual)

4-Way Match:
  ┌─────────────────┬────────────────────┬────────────────────────────────┐
  │ Comparación     │ Dimensión          │ ¿Qué detecta?                  │
  ├─────────────────┼────────────────────┼────────────────────────────────┤
  │ CFDI vs OC      │ Cantidad           │ ¿Facturan más de lo ordenado?  │
  │ CFDI vs OC      │ Precio unitario    │ ¿Precio diferente al pactado?  │
  │ CFDI vs Recep.  │ Cantidad           │ ¿Facturan más de lo que llegó? │
  │ CFDI vs Fact.   │ Total              │ ¿El total cuadra con registro? │
  └─────────────────┴────────────────────┴────────────────────────────────┘
```

### 4.2 Tolerancias Recomendadas

| Dimensión | Tolerancia | Justificación |
|---|---|---|
| Cantidad | **0%** (cero tolerancia) | Las unidades son enteras, no puede haber fracciones |
| Precio unitario | **±2%** | Permite variaciones de redondeo y actualizaciones de lista |
| Total por línea | **±$1 MXN** | Diferencias de redondeo al multiplicar |
| Total de factura | **±$5 MXN** | Diferencias de redondeo acumuladas |

### 4.3 Código del Motor de 4-Way Match

```typescript
async function ejecutar4WayMatch(
  supabase: SupabaseClient,
  cfdiId: string,
  ordenCompraId: string,
  recepcionId: string
): Promise<{ alertas: AlertaMatch[]; resumen: ResumenMatch }> {
  const alertas: AlertaMatch[] = []

  // Cargar datos
  const [cfdiData, ocData, recepcionData] = await Promise.all([
    supabase
      .from("facturas_proveedor_cfdi")
      .select("*, conceptos")
      .eq("id", cfdiId)
      .single(),
    supabase
      .from("ordenes_compra_items")
      .select("medicamento_id, cantidad_pedida, precio_unitario_centavos")
      .eq("orden_compra_id", ordenCompraId),
    supabase
      .from("recepciones_items")
      .select("medicamento_id, cantidad_recibida, lote, fecha_caducidad")
      .eq("recepcion_id", recepcionId),
  ])

  const conceptos: ConceptoCFDI[] = cfdiData.data?.conceptos || []
  const ocItems = ocData.data || []
  const recepItems = recepcionData.data || []

  // Indexar por medicamento_id para O(1) lookup
  const ocPorMed = new Map(ocItems.map(i => [i.medicamento_id, i]))
  const recepPorMed = new Map(recepItems.map(i => [i.medicamento_id, i]))

  for (const concepto of conceptos) {
    // Primero necesitamos el medicamento_id de este concepto
    const matchConcepto = await matchConceptoAMedicamento(supabase, concepto, /* proveedorId */)
    const medId = matchConcepto.medicamentoId
    if (!medId) continue // Producto sin catalogar — ya tiene su propia alerta

    const ocItem = ocPorMed.get(medId)
    const recepItem = recepPorMed.get(medId)

    // ── COMPARACION 1: CFDI cantidad vs OC cantidad_pedida ─────────────────
    if (ocItem) {
      const diferencia = concepto.cantidad - ocItem.cantidad_pedida
      if (diferencia > 0) {
        // Facturan MAS de lo que se ordenó
        alertas.push({
          tipo: "CANTIDAD_FACTURADA_MAYOR_ORDENADA",
          severidad: "ALTA",
          descripcion: `"${concepto.descripcion}": CFDI factura ${concepto.cantidad} unidades pero OC ordenó solo ${ocItem.cantidad_pedida}`,
          valorCFDI: concepto.cantidad,
          valorReferencia: ocItem.cantidad_pedida,
          diferencia,
          porcentajeDiferencia: (diferencia / ocItem.cantidad_pedida) * 100,
        })
      }
    }

    // ── COMPARACION 2 (ANTI-ROBO): CFDI cantidad vs Recepción ──────────────
    // ALERTA CRITICA: Si el CFDI dice que llegaron X unidades pero la
    // recepción registró menos, alguien se quedó con la diferencia.
    if (recepItem) {
      const diferencia = concepto.cantidad - recepItem.cantidad_recibida
      if (diferencia > 0) {
        // Facturan MAS de lo que físicamente llegó → SEÑAL DE ROBO/DESVIO
        alertas.push({
          tipo: "CANTIDAD_FACTURADA_MAYOR_RECIBIDA",
          severidad: "CRITICA",
          descripcion: `ALERTA ANTI-ROBO: "${concepto.descripcion}": ` +
            `CFDI factura ${concepto.cantidad} unidades, ` +
            `pero SOLO SE RECIBIERON ${recepItem.cantidad_recibida} unidades físicamente. ` +
            `Diferencia: ${diferencia} unidades NO LLEGARON pero SÍ SE COBRAN.`,
          valorCFDI: concepto.cantidad,
          valorReferencia: recepItem.cantidad_recibida,
          diferencia,
          porcentajeDiferencia: (diferencia / concepto.cantidad) * 100,
        })
      } else if (diferencia < 0) {
        // Recibieron MAS de lo facturado (raro pero posible: bonificación física sin CFDI)
        alertas.push({
          tipo: "CANTIDAD_RECIBIDA_MENOR_ORDENADA",
          severidad: "MEDIA",
          descripcion: `"${concepto.descripcion}": Se recibieron ${recepItem.cantidad_recibida} unidades pero el CFDI solo factura ${concepto.cantidad}. Verificar si hay nota de crédito pendiente.`,
          valorCFDI: concepto.cantidad,
          valorReferencia: recepItem.cantidad_recibida,
          diferencia: Math.abs(diferencia),
          porcentajeDiferencia: (Math.abs(diferencia) / concepto.cantidad) * 100,
        })
      }
    }

    // ── COMPARACION 3: CFDI precio_unitario vs OC precio_unitario ──────────
    if (ocItem) {
      const precioCFDI = concepto.valorUnitario
      const precioOC = ocItem.precio_unitario_centavos / 100
      const diferenciaPct = Math.abs((precioCFDI - precioOC) / precioOC) * 100

      if (diferenciaPct > 2) {
        // Más del 2% de diferencia en precio
        alertas.push({
          tipo: precioCFDI > precioOC ? "PRECIO_UNITARIO_MAYOR_OC" : "PRECIO_UNITARIO_MENOR_OC",
          severidad: precioCFDI > precioOC ? "ALTA" : "MEDIA",
          descripcion: `"${concepto.descripcion}": Precio OC $${precioOC.toFixed(2)} vs CFDI $${precioCFDI.toFixed(2)} (diferencia ${diferenciaPct.toFixed(1)}%)`,
          valorCFDI: precioCFDI,
          valorReferencia: precioOC,
          diferencia: precioCFDI - precioOC,
          porcentajeDiferencia: diferenciaPct,
        })
      }
    }
  }

  // ── COMPARACION 4: Total CFDI vs Total en BD (factura interna) ───────────
  // (A nivel comprobante, no por línea)

  const resumen: ResumenMatch = {
    alertasCriticas: alertas.filter(a => a.severidad === "CRITICA").length,
    alertasAltas: alertas.filter(a => a.severidad === "ALTA").length,
    alertasMedias: alertas.filter(a => a.severidad === "MEDIA").length,
    alertasBajas: alertas.filter(a => a.severidad === "BAJA").length,
    recomendacion:
      alertas.some(a => a.severidad === "CRITICA")
        ? "RECHAZAR — Investigar antes de pagar"
        : alertas.some(a => a.severidad === "ALTA")
        ? "RETENER — Requiere aprobación gerencia"
        : alertas.some(a => a.severidad === "MEDIA")
        ? "REVISAR — Confirmar con proveedor"
        : "APROBAR — Sin discrepancias significativas",
  }

  return { alertas, resumen }
}
```

### 4.4 Tabla Maestra de Alertas por Tipo de Discrepancia

| Tipo de Alerta | Severidad | ¿Qué indica? | Acción Recomendada |
|---|---|---|---|
| `CANTIDAD_FACTURADA_MAYOR_RECIBIDA` | **CRITICA** | Facturan más de lo que llegó físicamente. Posible robo en tránsito, complicidad con el chofer, desvío de mercancía. | Bloquear pago. Investigación inmediata. Cámaras de recepción. Confrontar al proveedor y al almacenista. |
| `UUID_DUPLICADO` | **CRITICA** | El mismo CFDI ya fue registrado y posiblemente pagado. Fraude por factura duplicada. | Bloquear pago. Notificar auditoría. |
| `CFDI_CANCELADO_SAT` | **CRITICA** | El CFDI fue cancelado ante el SAT. El documento no tiene validez fiscal. | Rechazar. Solicitar nuevo CFDI válido. |
| `RFC_EMISOR_NO_COINCIDE` | **CRITICA** | El RFC del emisor no es el proveedor registrado. Posible factura falsa o del proveedor equivocado. | Rechazar. Verificar identidad del proveedor. |
| `CANTIDAD_FACTURADA_MAYOR_ORDENADA` | ALTA | Facturan más unidades de las que se ordenaron. Puede ser error del proveedor o intento de cobrar de más. | Retener pago. Contactar proveedor para nota de crédito. |
| `PRECIO_UNITARIO_MAYOR_OC` | ALTA | El precio facturado es mayor al precio pactado en la OC (más del 2%). | Retener pago. Solicitar rectificación de precio. |
| `ERRORES_ARITMETICOS_CFDI` | ALTA | El CFDI tiene errores matemáticos internos. El SAT debería haberlo rechazado. | Rechazar. Solicitar CFDI corregido. |
| `CANTIDAD_RECIBIDA_MENOR_ORDENADA` | MEDIA | Se recibieron menos unidades de las ordenadas. Puede ser entrega parcial legítima. | Verificar si hay nota de entrega parcial. Exigir complemento de entrega. |
| `PRECIO_UNITARIO_MENOR_OC` | MEDIA | El precio es menor al pactado. Puede ser descuento no comunicado o error. | Verificar con proveedor. Actualizar OC si es descuento válido. |
| `PRODUCTO_SIN_CATALOGAR` | MEDIA | El medicamento en el CFDI no está en el catálogo interno. Puede ser producto nuevo o variante. | Crear medicamento en catálogo o rechazar si no se autorizó la compra. |
| `TOTAL_NO_CUADRA` | MEDIA | El total del CFDI no coincide con el total de la factura registrada manualmente. | Revisar captura manual. Actualizar con datos del CFDI. |

---

## 5. Extracción desde PDF (Fallback para Proveedores sin CFDI)

### 5.1 ¿Cuándo usar OCR de PDF?

Aunque en México todos los contribuyentes con actividad comercial deben emitir CFDI, existen casos donde se recibirá un PDF:
- Proveedores extranjeros (importaciones directas)
- Proveedores en el Régimen de Incorporación Fiscal que aún no implementan CFDI correctamente
- Remisiones o notas de entrega (no facturas)
- Gastos menores de persona física sin obligación de CFDI

**Recomendación**: Para una farmacia que compra a distribuidores mayoristas nacionales, el 95%+ de las transacciones tendrán CFDI XML válido. El PDF es siempre una representación visual del CFDI — si el proveedor te da el PDF pero no el XML, solicitarlo. El XML es el documento fiscal legal, no el PDF.

### 5.2 Comparativa OCR para Facturas en México

| Servicio | Precio aprox. | Español | Tablas | Precisión Invoice | Integración |
|---|---|---|---|---|---|
| **AWS Textract** | $1.50/1K págs (básico), $15/1K (formularios) | Sí | Sí | Alta | S3 + Lambda nativo |
| **Google Document AI** | $1.50/1K págs (básico), $10/1K (formularios) | Sí (auto) | Sí | Muy alta | GCS + Cloud Run |
| **Azure Form Recognizer** | $1.50/1K págs (básico), $10/1K (formularios) | Sí | Sí | Alta | Azure Blob |
| **Mindee** | $0.10/pág (hasta 250/mes gratis) | Sí | Sí | Alta, especializado en facturas | REST API simple |
| **GPT-4o Vision** | ~$0.005/imagen | Sí | Razonable | Alta (estructurada con prompt) | API Anthropic/OpenAI |

**Recomendación para México**: Si se necesita OCR de PDF, **Mindee** es el más costo-efectivo para volúmenes bajos de una clínica (tiene tier gratuito y precio por documento sin compromisos de volumen). Para volúmenes altos, **Google Document AI** con el modelo especializado en facturas supera a Textract en precisión según benchmarks 2025-2026.

**Alternativa emergente**: Modelos multimodales (GPT-4o, Claude Opus con visión) pueden extraer datos estructurados de facturas PDF con un prompt bien diseñado, a costo comparable o menor, y con mayor flexibilidad para formatos variables.

---

## 6. Diseño Técnico Propuesto

### 6.1 Flujo Completo End-to-End

```
USUARIO (admin/compras)
    │
    ▼ Upload XML en UI (drag & drop)
SUPABASE STORAGE
    │ cfdi-bucket/uploads/{uuid}.xml
    ▼
EDGE FUNCTION: cfdi-parse
    │ 1. Descargar XML del bucket
    │ 2. Parsear XML → CFDIParsed
    │ 3. Validar aritmética interna
    │ 4. Verificar UUID duplicado en BD
    │ 5. Consultar estado SAT (async)
    │ 6. Guardar en facturas_proveedor_cfdi + conceptos_cfdi
    ▼
EDGE FUNCTION: cfdi-match-conceptos
    │ 1. Para cada Concepto CFDI:
    │    - Match exacto por NoIdentificacion
    │    - Match por código/SKU
    │    - Fuzzy match por descripción
    │    - Registrar matchMethod + score
    ▼
EDGE FUNCTION: cfdi-4way-match
    │ 1. Cargar OC + Recepción asociadas
    │ 2. Por cada concepto matcheado:
    │    - CFDI cantidad vs OC cantidad_pedida
    │    - CFDI cantidad vs Recepción cantidad_recibida ← ANTI-ROBO
    │    - CFDI precio vs OC precio
    │ 3. Total CFDI vs Factura interna
    │ 4. Generar array de AlertaMatch con severidades
    │ 5. Actualizar match_status en facturas_proveedor
    ▼
UI: FacturasProveedor
    │ - Tabla de conceptos CFDI vs OC vs Recepción
    │ - Alertas por severidad (rojo/naranja/amarillo)
    │ - Botón "Aprobar pago" (deshabilitado si hay CRITICA)
    │ - Botón "Registrar discrepancia" para investigación
```

### 6.2 Schema SQL Propuesto

```sql
-- ============================================================
-- TABLA PRINCIPAL: Datos del CFDI parseado
-- ============================================================
CREATE TABLE facturas_proveedor_cfdi (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  factura_proveedor_id  UUID NOT NULL REFERENCES facturas_proveedor(id) ON DELETE CASCADE,
  
  -- Identificación fiscal
  uuid_cfdi             VARCHAR(36) NOT NULL UNIQUE, -- Folio fiscal SAT
  serie                 VARCHAR(25),
  folio                 VARCHAR(40),
  fecha_cfdi            TIMESTAMPTZ NOT NULL,
  fecha_timbrado        TIMESTAMPTZ,
  
  -- Emisor (proveedor)
  rfc_emisor            VARCHAR(13) NOT NULL,
  nombre_emisor         VARCHAR(300),
  
  -- Receptor (la clínica)
  rfc_receptor          VARCHAR(13) NOT NULL,
  nombre_receptor       VARCHAR(300),
  
  -- Montos en centavos para evitar errores de punto flotante
  subtotal_centavos     BIGINT NOT NULL DEFAULT 0,
  descuento_centavos    BIGINT NOT NULL DEFAULT 0,
  iva_centavos          BIGINT NOT NULL DEFAULT 0,
  total_centavos        BIGINT NOT NULL DEFAULT 0,
  
  -- Metadatos
  moneda                VARCHAR(3) DEFAULT 'MXN',
  tipo_comprobante      VARCHAR(1) DEFAULT 'I', -- I=Ingreso
  metodo_pago           VARCHAR(3),
  forma_pago            VARCHAR(3),
  
  -- Estado ante el SAT
  estado_sat            VARCHAR(50) DEFAULT 'Pendiente',
  -- 'Vigente', 'Cancelado', 'No encontrado', 'ErrorConsulta'
  fecha_consulta_sat    TIMESTAMPTZ,
  
  -- Validaciones internas
  errores_aritmeticos   TEXT[] DEFAULT '{}',
  
  -- Raw XML para auditoría
  xml_raw               TEXT,
  xml_bucket_path       TEXT, -- ruta en Supabase Storage
  
  -- JSONB con los conceptos parseados
  conceptos             JSONB NOT NULL DEFAULT '[]',
  
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: Líneas de conceptos del CFDI (normalizada)
-- ============================================================
CREATE TABLE cfdi_conceptos (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cfdi_id                 UUID NOT NULL REFERENCES facturas_proveedor_cfdi(id) ON DELETE CASCADE,
  
  -- Datos del CFDI
  clave_prod_serv         VARCHAR(20),
  no_identificacion       VARCHAR(100), -- Código del proveedor
  cantidad                NUMERIC(15, 4) NOT NULL,
  clave_unidad            VARCHAR(10),
  descripcion             TEXT NOT NULL,
  valor_unitario_centavos BIGINT NOT NULL,
  importe_centavos        BIGINT NOT NULL,
  descuento_centavos      BIGINT DEFAULT 0,
  tasa_iva                NUMERIC(10, 6) DEFAULT 0,
  iva_centavos            BIGINT DEFAULT 0,
  total_centavos          BIGINT NOT NULL,
  objeto_imp              VARCHAR(2) DEFAULT '02',
  
  -- Match con catálogo interno
  medicamento_id          UUID REFERENCES medicamentos(id),
  match_method            VARCHAR(30),
  -- 'exact_no_identificacion', 'exact_codigo', 'fuzzy_descripcion', 'no_match'
  match_score             INTEGER DEFAULT 0, -- 0-100
  match_validado          BOOLEAN DEFAULT FALSE, -- Confirmado por usuario
  
  -- 4-Way match results
  oc_item_id              UUID, -- Referencia al item de OC
  recepcion_item_id       UUID, -- Referencia al item de recepción
  
  -- Cantidades de referencia (desnormalizadas para reportes rápidos)
  oc_cantidad_pedida      NUMERIC(15, 4),
  oc_precio_unit_centavos BIGINT,
  recepcion_cantidad_recibida NUMERIC(15, 4),
  
  -- Diferencias calculadas
  dif_cantidad_vs_oc      NUMERIC(15, 4), -- cantidad_cfdi - oc_cantidad
  dif_cantidad_vs_recepcion NUMERIC(15, 4), -- cantidad_cfdi - recepcion_cantidad ← CRÍTICO
  dif_precio_pct          NUMERIC(8, 4),  -- % diferencia precio
  
  -- Alertas generadas
  alertas                 JSONB DEFAULT '[]',
  tiene_alerta_critica    BOOLEAN DEFAULT FALSE,
  
  linea_numero            INTEGER,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: Mapeo de códigos de proveedor a medicamentos internos
-- Esta tabla es la clave para el matching confiable
-- ============================================================
CREATE TABLE medicamento_codigos_proveedor (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  medicamento_id  UUID NOT NULL REFERENCES medicamentos(id),
  proveedor_id    UUID NOT NULL REFERENCES proveedores(id),
  codigo_proveedor VARCHAR(100) NOT NULL, -- NoIdentificacion del CFDI
  descripcion_proveedor TEXT,              -- Descripcion en el CFDI de ese proveedor
  clave_prod_serv VARCHAR(20),
  activo          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(proveedor_id, codigo_proveedor)
);

-- ============================================================
-- COLUMNAS ADICIONALES en facturas_proveedor (existente)
-- ============================================================
ALTER TABLE facturas_proveedor
  ADD COLUMN IF NOT EXISTS cfdi_id UUID REFERENCES facturas_proveedor_cfdi(id),
  ADD COLUMN IF NOT EXISTS uuid_cfdi VARCHAR(36),
  ADD COLUMN IF NOT EXISTS cfdi_parseado BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tiene_alertas_criticas BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS match_4way_status VARCHAR(30) DEFAULT 'pendiente',
  -- 'pendiente', 'aprobado', 'rechazado', 'en_revision', 'con_discrepancias'
  ADD COLUMN IF NOT EXISTS match_alertas_count INTEGER DEFAULT 0;

-- ============================================================
-- INDICES para performance
-- ============================================================
CREATE INDEX idx_cfdi_uuid ON facturas_proveedor_cfdi(uuid_cfdi);
CREATE INDEX idx_cfdi_rfc_emisor ON facturas_proveedor_cfdi(rfc_emisor);
CREATE INDEX idx_cfdi_fecha ON facturas_proveedor_cfdi(fecha_cfdi DESC);
CREATE INDEX idx_cfdi_estado_sat ON facturas_proveedor_cfdi(estado_sat);
CREATE INDEX idx_conceptos_cfdi_id ON cfdi_conceptos(cfdi_id);
CREATE INDEX idx_conceptos_medicamento ON cfdi_conceptos(medicamento_id);
CREATE INDEX idx_conceptos_alerta_critica ON cfdi_conceptos(tiene_alerta_critica) WHERE tiene_alerta_critica = TRUE;
CREATE INDEX idx_cod_proveedor_lookup ON medicamento_codigos_proveedor(proveedor_id, codigo_proveedor);

-- ============================================================
-- VISTA: Dashboard de discrepancias activas
-- ============================================================
CREATE OR REPLACE VIEW v_discrepancias_activas AS
SELECT
  fp.id AS factura_id,
  fp.proveedor_nombre,
  fp.created_at AS fecha_registro,
  fpc.uuid_cfdi,
  fpc.fecha_cfdi,
  fpc.total_centavos AS total_cfdi_centavos,
  fpc.estado_sat,
  COUNT(cc.id) FILTER (WHERE cc.tiene_alerta_critica) AS alertas_criticas,
  COUNT(cc.id) FILTER (WHERE cc.alertas != '[]'::jsonb AND NOT cc.tiene_alerta_critica) AS alertas_no_criticas,
  fp.match_4way_status
FROM facturas_proveedor fp
JOIN facturas_proveedor_cfdi fpc ON fpc.factura_proveedor_id = fp.id
LEFT JOIN cfdi_conceptos cc ON cc.cfdi_id = fpc.id
WHERE fp.match_4way_status IN ('con_discrepancias', 'en_revision')
GROUP BY fp.id, fp.proveedor_nombre, fp.created_at,
         fpc.uuid_cfdi, fpc.fecha_cfdi, fpc.total_centavos,
         fpc.estado_sat, fp.match_4way_status
ORDER BY alertas_criticas DESC, fp.created_at DESC;
```

### 6.3 Diseño de UI: Componente de Upload y Validación CFDI

El componente React para el flujo de upload y validación tendría tres secciones:

**Sección 1 — Upload**: Zona drag-and-drop que acepta `.xml`. Al soltar el archivo, llama a la Edge Function `cfdi-parse` y muestra un spinner mientras procesa. Si el CFDI es inválido (cancelado en SAT, errores aritméticos, UUID duplicado), muestra error bloqueante.

**Sección 2 — Tabla de Conceptos Extraídos**: Tabla con columnas: Descripción CFDI | Código Proveedor | Match Catálogo | Cantidad CFDI | Cantidad OC | Cantidad Recibida | Precio Unit CFDI | Precio Unit OC | IVA | Total. Cada fila tiene un badge de status: verde (sin alertas), amarillo (alerta media), naranja (alerta alta), rojo (alerta crítica). Las filas rojas se resaltan con fondo.

**Sección 3 — Panel de Alertas**: Lista de alertas ordenadas por severidad. Alertas críticas muestran un banner bloqueante con botón "Bloquear pago y abrir investigación". El botón "Aprobar y registrar pago" está deshabilitado mientras existan alertas críticas o altas sin resolver.

---

## 7. Casos Reales de Fraude que este Sistema Previene

### 7.1 Fraude por Desvío en Tránsito
**Escenario**: El proveedor factura 100 cajas de Amoxicilina. El chofer entrega 85 cajas a la farmacia y desvía 15 cajas para venderlas por su cuenta. El almacenista registra 85 en la recepción. El sistema detecta: CFDI=100 vs Recepción=85 → ALERTA CRÍTICA `CANTIDAD_FACTURADA_MAYOR_RECIBIDA`.

### 7.2 Fraude por Complicidad Interna
**Escenario**: El almacenista y el chofer acuerdan registrar en el sistema 100 cajas recibidas (para que cuadre con el CFDI), pero en realidad solo llegaron 85. Este fraude NO puede ser detectado solo con el CFDI — requiere conteo físico independiente. El sistema puede mitigarlo con: revisiones spot de inventario físico vs sistema, y análisis de patrones (si este proveedor/almacenista tiene discrepancias frecuentes).

### 7.3 Fraude por Factura Duplicada
**Escenario**: Un proveedor reenvía el mismo CFDI (mismo UUID) dos meses después esperando que sea pagado de nuevo. El sistema detecta UUID duplicado y bloquea.

### 7.4 Fraude por Precio Inflado
**Escenario**: La OC se firmó a $25/caja, pero el CFDI llega con $28/caja. Sin revisión automática, el sistema pagaría el precio inflado. El sistema detecta diferencia de precio >2% y genera ALERTA ALTA.

### 7.5 Fraude por Factura de Proveedor Falso
**Escenario**: Alguien crea una factura falsa con un CFDI de un proveedor diferente. El sistema detecta que el RFC del emisor no coincide con el proveedor registrado en la OC y genera ALERTA CRÍTICA.

### 7.6 Contexto COFEPRIS 2024-2025
En 2024, COFEPRIS identificó 194 negocios irregulares en distribución farmacéutica. Se detectaron al menos 59 proveedores del gobierno federal con documentación falsa en licitaciones. El robo de medicamentos en tránsito (caso Lia Farma, 2024) ejemplifica el escenario que este sistema detectaría con la comparación CFDI vs Recepción.

---

## 8. Plan de Implementación Sugerido

| Fase | Tarea | Esfuerzo Estimado | Prioridad |
|---|---|---|---|
| 1 | Crear schema SQL (`facturas_proveedor_cfdi`, `cfdi_conceptos`, `medicamento_codigos_proveedor`) | 2h | ALTA |
| 1 | Edge Function `cfdi-parse` (parsing + validación aritmética + verificación SAT) | 4h | ALTA |
| 2 | Edge Function `cfdi-match-conceptos` (matching a catálogo, 3 niveles) | 3h | ALTA |
| 2 | Componente React: drag-drop XML upload con preview de datos extraídos | 3h | ALTA |
| 3 | Edge Function `cfdi-4way-match` (comparación cantidad vs OC y recepción) | 4h | MUY ALTA |
| 3 | UI: Tabla de conceptos con alertas por severidad + panel de discrepancias | 4h | MUY ALTA |
| 4 | Tabla `medicamento_codigos_proveedor`: migrar/mapear códigos de principales proveedores (DISFASA, Marzam, Nadro) | 4h | ALTA |
| 4 | Vista de dashboard de discrepancias activas + notificaciones | 2h | MEDIA |
| 5 | OCR de PDF como fallback (solo si se necesita) | 8h | BAJA |

**Total estimado Fase 1-4**: ~26 horas de desarrollo para el sistema completo.

---

## 9. Referencias y Fuentes

- [Estructura CFDI 4.0 — SendFactura](https://sendfactura.com/blog/factura-cfdi-40.php)
- [Ejemplos CFDI 4.0 — Factoro](https://factoro.mx/recursos/ejemplos/cfdi-4-0/)
- [Catálogo c_ClaveProdServ SAT — EdiFactMx](https://www.edifact.com.mx/masinfo/clave-sat-medicamentos.html)
- [Claves producto farmacia — SIFEI](https://www.sifei.com.mx/blog/nuestro-blog-1/post/que-claves-de-producto-debo-manejar-en-la-farmacia-999)
- [fast-xml-parser npm](https://www.npmjs.com/package/fast-xml-parser)
- [deno-fast-xml-parser GitHub](https://github.com/ThauEx/deno-fast-xml-parser)
- [Consulta estado CFDI SAT — CfdiUtils](https://cfdiutils.readthedocs.io/es/latest/componentes/estado-sat.html)
- [@nodecfdi/sat-estado-cfdi-soap npm](https://www.npmjs.com/package/@nodecfdi/sat-estado-cfdi-soap)
- [4-Way Matching AP — DocuClipper](https://www.docuclipper.com/blog/4-way-matching/)
- [AWS Textract vs Google Document AI 2026 — BrainCuber](https://www.braincuber.com/blog/aws-textract-vs-google-document-ai-ocr-comparison)
- [COFEPRIS alerta robo medicamentos 2024](https://www.gob.mx/cofepris/articulos/cofepris-alerta-sobre-robo-de-medicamentos-se-despliegan-acciones-de-vigilancia-y-control)
- [Red corrupción proveedores medicamentos — El Universal](https://www.eluniversal.com.mx/nacion/detectan-red-de-corrupcion-en-compra-de-medicamentos/)
- [Verificación CFDI SAT — metricas.mx](https://metricas.mx/blog/verificacion-de-facturas-como-validar-un-cfdi-ante-el-sat)
- [Supabase Edge Functions Deno](https://supabase.com/docs/guides/functions)
- [IVA en CFDI 4.0 — MySuite](https://blog.mysuitemex.com/2024/11/18/iva-en-cfdi-4-0-impuestos-federales/)
