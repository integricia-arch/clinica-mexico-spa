import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.4.1";

// =========================================================
// TIPOS
// =========================================================

interface ConceptoCFDI {
  claveProdServ: string;
  noIdentificacion: string;
  cantidad: number;
  claveUnidad: string;
  descripcion: string;
  valorUnitario: number;
  importe: number;
  descuento: number;
  tasaIva: number;
  importeIva: number;
  importeTotal: number;
  objetoImp: string;
}

interface CFDIParsed {
  uuid: string;
  serie: string;
  folio: string;
  fecha: string;
  fechaTimbrado: string;
  rfcEmisor: string;
  nombreEmisor: string;
  rfcReceptor: string;
  nombreReceptor: string;
  subTotal: number;
  descuento: number;
  total: number;
  totalIva: number;
  moneda: string;
  tipoDeComprobante: string;
  metodoPago: string;
  formaPago: string;
  conceptos: ConceptoCFDI[];
}

interface AlertaMatch {
  tipo: string;
  severidad: "CRITICA" | "ALTA" | "MEDIA" | "BAJA";
  descripcion: string;
  valorCFDI: number;
  valorReferencia: number;
  diferencia: number;
  porcentajeDiferencia: number;
}

interface LineaMatch {
  lineaNumero: number;
  descripcion: string;
  noIdentificacion: string;
  cantidad: number;
  valorUnitarioCentavos: number;
  importeCentavos: number;
  ivaCentavos: number;
  totalCentavos: number;
  tasaIva: number;
  objetoImp: string;
  medicamentoId: string | null;
  matchMethod: string;
  matchScore: number;
  ocCantidadPedida: number | null;
  ocPrecioUnitCentavos: number | null;
  recepcionCantidadRecibida: number | null;
  difCantidadVsOc: number | null;
  difCantidadVsRecepcion: number | null;
  difPrecioPct: number | null;
  alertas: AlertaMatch[];
  tieneAlertaCritica: boolean;
}

// =========================================================
// PARSER CFDI XML
// =========================================================

function parseCFDIXML(xmlContent: string): CFDIParsed {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: false,
    parseAttributeValue: true,
    parseTagValue: false,
    trimValues: true,
  });

  const parsed = parser.parse(xmlContent);

  const comprobante =
    parsed["cfdi:Comprobante"] ||
    parsed["Comprobante"] ||
    parsed["cfdi:comprobante"];

  if (!comprobante) {
    throw new Error("XML no es un CFDI válido: falta nodo cfdi:Comprobante");
  }

  const complemento =
    comprobante["cfdi:Complemento"] || comprobante["Complemento"];
  const timbre =
    complemento?.["tfd:TimbreFiscalDigital"] ||
    complemento?.["TimbreFiscalDigital"];

  if (!timbre) {
    throw new Error(
      "CFDI sin timbre fiscal digital — documento no timbrado o inválido"
    );
  }

  const impuestosComp =
    comprobante["cfdi:Impuestos"] || comprobante["Impuestos"];
  const totalIva = parseFloat(
    String(impuestosComp?.["@_TotalImpuestosTrasladados"] || "0")
  );

  const conceptosNodo =
    comprobante["cfdi:Conceptos"] || comprobante["Conceptos"];
  const conceptosRaw =
    conceptosNodo?.["cfdi:Concepto"] || conceptosNodo?.["Concepto"] || [];
  const conceptosArray = Array.isArray(conceptosRaw)
    ? conceptosRaw
    : [conceptosRaw];

  const emisor =
    comprobante["cfdi:Emisor"] || comprobante["Emisor"] || {};
  const receptor =
    comprobante["cfdi:Receptor"] || comprobante["Receptor"] || {};

  return {
    uuid: String(timbre["@_UUID"] || ""),
    serie: String(comprobante["@_Serie"] || ""),
    folio: String(comprobante["@_Folio"] || ""),
    fecha: String(comprobante["@_Fecha"] || ""),
    fechaTimbrado: String(timbre["@_FechaTimbrado"] || ""),
    rfcEmisor: String(emisor["@_Rfc"] || ""),
    nombreEmisor: String(emisor["@_Nombre"] || ""),
    rfcReceptor: String(receptor["@_Rfc"] || ""),
    nombreReceptor: String(receptor["@_Nombre"] || ""),
    subTotal: parseFloat(String(comprobante["@_SubTotal"] || "0")),
    descuento: parseFloat(String(comprobante["@_Descuento"] || "0")),
    total: parseFloat(String(comprobante["@_Total"] || "0")),
    totalIva,
    moneda: String(comprobante["@_Moneda"] || "MXN"),
    tipoDeComprobante: String(comprobante["@_TipoDeComprobante"] || ""),
    metodoPago: String(comprobante["@_MetodoPago"] || ""),
    formaPago: String(comprobante["@_FormaPago"] || ""),
    conceptos: conceptosArray.map(parseConcepto),
  };
}

function parseConcepto(c: Record<string, unknown>): ConceptoCFDI {
  const cantidad = parseFloat(String(c["@_Cantidad"] || "0"));
  const valorUnitario = parseFloat(String(c["@_ValorUnitario"] || "0"));
  const importe = parseFloat(String(c["@_Importe"] || "0"));
  const descuento = parseFloat(String(c["@_Descuento"] || "0"));
  const objetoImp = String(c["@_ObjetoImp"] || "01");

  let tasaIva = 0;
  let importeIva = 0;

  const impuestosConcepto =
    c["cfdi:Impuestos"] || c["Impuestos"];
  if (impuestosConcepto && objetoImp === "02") {
    const traslados =
      impuestosConcepto["cfdi:Traslados"] || impuestosConcepto["Traslados"];
    const trasladosList = traslados
      ? Array.isArray(traslados["cfdi:Traslado"] || traslados["Traslado"])
        ? traslados["cfdi:Traslado"] || traslados["Traslado"]
        : [traslados["cfdi:Traslado"] || traslados["Traslado"]]
      : [];

    const ivaTraslado = trasladosList.find(
      (t: Record<string, unknown>) => String(t["@_Impuesto"]) === "002"
    );
    if (ivaTraslado) {
      tasaIva = parseFloat(String(ivaTraslado["@_TasaOCuota"] || "0"));
      importeIva = parseFloat(String(ivaTraslado["@_Importe"] || "0"));
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
  };
}

// =========================================================
// VALIDACION ARITMETICA
// =========================================================

function validarAritmetica(cfdi: CFDIParsed): string[] {
  const errores: string[] = [];

  for (const c of cfdi.conceptos) {
    const importeCalc =
      Math.round(c.cantidad * c.valorUnitario * 100) / 100;
    if (Math.abs(importeCalc - c.importe) > 0.02) {
      errores.push(
        `"${c.descripcion}": ${c.cantidad}×${c.valorUnitario}=${importeCalc} ≠ Importe=${c.importe}`
      );
    }
  }

  const subTotalCalc = cfdi.conceptos.reduce(
    (acc, c) => acc + c.importe - c.descuento,
    0
  );
  if (Math.abs(subTotalCalc - cfdi.subTotal) > 0.02) {
    errores.push(
      `SubTotal CFDI ${cfdi.subTotal} ≠ suma conceptos ${subTotalCalc}`
    );
  }

  const totalCalc = cfdi.subTotal - cfdi.descuento + cfdi.totalIva;
  if (Math.abs(totalCalc - cfdi.total) > 0.02) {
    errores.push(`Total CFDI ${cfdi.total} ≠ SubTotal+IVA=${totalCalc}`);
  }

  return errores;
}

// =========================================================
// MATCHING CONCEPTO → MEDICAMENTO
// =========================================================

function normalizarDesc(texto: string): string {
  return texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i][j - 1], dp[i - 1][j]);
    }
  }
  return dp[m][n];
}

function similitud(a: string, b: string): number {
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (longer.length === 0) return 100;
  const dist = levenshtein(longer, shorter);
  return Math.round(((longer.length - dist) / longer.length) * 100);
}

// =========================================================
// VERIFICACION SAT (best-effort, non-blocking)
// =========================================================

async function verificarSAT(
  uuid: string,
  rfcEmisor: string,
  rfcReceptor: string,
  total: string
): Promise<string> {
  const SAT_ENDPOINT =
    "https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc";
  const expresion = encodeURIComponent(
    `?re=${rfcEmisor}&rr=${rfcReceptor}&tt=${total}&id=${uuid}`
  );
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:Consulta>
      <tem:expresionImpresa>${expresion}</tem:expresionImpresa>
    </tem:Consulta>
  </soapenv:Body>
</soapenv:Envelope>`;

  try {
    const res = await fetch(SAT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction:
          "http://tempuri.org/IConsultaCFDIService/Consulta",
      },
      body: soapBody,
      signal: AbortSignal.timeout(12000),
    });
    const text = await res.text();
    return text.match(/<a:Estado>([^<]+)<\/a:Estado>/)?.[1] || "Desconocido";
  } catch {
    return "ErrorConsulta";
  }
}

// =========================================================
// HANDLER PRINCIPAL
// =========================================================

serve(async (req: Request) => {
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ ok: true, fn: "cfdi-parse" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método no permitido" }),
      { status: 405 }
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "No autorizado" }),
      { status: 401 }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Extraer parámetros
    let xmlContent: string;
    let facturaProveedorId: string;
    let ordenCompraId = "";
    let recepcionId = "";
    let clinicId: string;
    let proveedorId = "";

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("cfdi_xml") as File;
      if (!file) throw new Error("Campo 'cfdi_xml' requerido");
      xmlContent = await file.text();
      facturaProveedorId = String(formData.get("factura_proveedor_id") || "");
      ordenCompraId = String(formData.get("orden_compra_id") || "");
      recepcionId = String(formData.get("recepcion_id") || "");
      clinicId = String(formData.get("clinic_id") || "");
      proveedorId = String(formData.get("proveedor_id") || "");
    } else {
      const body = await req.json();
      xmlContent = body.xml_content || body.xmlContent;
      facturaProveedorId = body.factura_proveedor_id;
      ordenCompraId = body.orden_compra_id || "";
      recepcionId = body.recepcion_id || "";
      clinicId = body.clinic_id;
      proveedorId = body.proveedor_id || "";
    }

    if (!xmlContent || xmlContent.length < 100) {
      throw new Error("Contenido XML inválido o vacío");
    }
    if (!facturaProveedorId) throw new Error("factura_proveedor_id requerido");
    if (!clinicId) throw new Error("clinic_id requerido");

    // 1. Parsear XML
    const cfdi = parseCFDIXML(xmlContent);

    // 2. UUID duplicado
    const { data: existente } = await supabase
      .from("fp_cfdi")
      .select("id, factura_proveedor_id")
      .eq("uuid_cfdi", cfdi.uuid)
      .maybeSingle();

    if (existente) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `UUID duplicado: este CFDI ya fue registrado`,
          alerta: "UUID_DUPLICADO",
          cfdi_id: existente.id,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Validar aritmética
    const erroresAritmeticos = validarAritmetica(cfdi);

    // 4. Verificar SAT (async, best-effort)
    const estadoSAT = await verificarSAT(
      cfdi.uuid,
      cfdi.rfcEmisor,
      cfdi.rfcReceptor,
      cfdi.total.toFixed(2)
    );

    // 5. Guardar fp_cfdi
    const { data: fpCfdi, error: errFpCfdi } = await supabase
      .from("fp_cfdi")
      .insert({
        clinic_id: clinicId,
        factura_proveedor_id: facturaProveedorId,
        uuid_cfdi: cfdi.uuid,
        serie: cfdi.serie || null,
        folio: cfdi.folio || null,
        fecha_cfdi: cfdi.fecha,
        fecha_timbrado: cfdi.fechaTimbrado || null,
        rfc_emisor: cfdi.rfcEmisor,
        nombre_emisor: cfdi.nombreEmisor || null,
        rfc_receptor: cfdi.rfcReceptor || null,
        nombre_receptor: cfdi.nombreReceptor || null,
        subtotal_centavos: Math.round(cfdi.subTotal * 100),
        descuento_centavos: Math.round(cfdi.descuento * 100),
        iva_centavos: Math.round(cfdi.totalIva * 100),
        total_centavos: Math.round(cfdi.total * 100),
        moneda: cfdi.moneda,
        tipo_comprobante: cfdi.tipoDeComprobante || "I",
        metodo_pago: cfdi.metodoPago || null,
        forma_pago: cfdi.formaPago || null,
        estado_sat: estadoSAT,
        fecha_consulta_sat: new Date().toISOString(),
        errores_aritmeticos: erroresAritmeticos,
        xml_raw: xmlContent,
        conceptos_json: cfdi.conceptos,
      })
      .select()
      .single();

    if (errFpCfdi) throw errFpCfdi;

    // 6. Cargar datos OC + Recepción para 4-way match
    const [ocItemsRes, recepItemsRes, medicamentosRes, codigosRes] =
      await Promise.all([
        ordenCompraId
          ? supabase
              .from("ordenes_compra_items")
              .select("medicamento_id, cantidad_pedida, precio_unitario_centavos")
              .eq("orden_id", ordenCompraId)
          : Promise.resolve({ data: [] }),
        recepcionId
          ? supabase
              .from("recepciones_items")
              .select("medicamento_id, cantidad_recibida")
              .eq("recepcion_id", recepcionId)
          : Promise.resolve({ data: [] }),
        supabase
          .from("medicamentos")
          .select("id, nombre, nombre_generico, presentacion, barcode, sku, codigo_interno")
          .eq("clinic_id", clinicId)
          .eq("activo", true),
        proveedorId
          ? supabase
              .from("medicamento_codigos_proveedor")
              .select("medicamento_id, codigo_proveedor")
              .eq("proveedor_id", proveedorId)
              .eq("activo", true)
          : Promise.resolve({ data: [] }),
      ]);

    const ocItems = (ocItemsRes.data || []) as {
      medicamento_id: string;
      cantidad_pedida: number;
      precio_unitario_centavos: number;
    }[];
    const recepItems = (recepItemsRes.data || []) as {
      medicamento_id: string;
      cantidad_recibida: number;
    }[];
    const medicamentos = (medicamentosRes.data || []) as {
      id: string;
      nombre: string;
      nombre_generico: string | null;
      presentacion: string | null;
      barcode: string | null;
      sku: string | null;
      codigo_interno: string | null;
    }[];
    const codigosMap = new Map<string, string>(
      ((codigosRes.data || []) as { medicamento_id: string; codigo_proveedor: string }[]).map(
        (r) => [r.codigo_proveedor, r.medicamento_id]
      )
    );

    const ocPorMed = new Map(ocItems.map((i) => [i.medicamento_id, i]));
    const recepPorMed = new Map(recepItems.map((i) => [i.medicamento_id, i]));

    // 7. Match + 4-way por línea
    const lineas: LineaMatch[] = [];
    let hayAlertaCriticaGlobal = false;
    let totalAlertas = 0;

    for (let idx = 0; idx < cfdi.conceptos.length; idx++) {
      const c = cfdi.conceptos[idx];

      // --- Match medicamento ---
      let medId: string | null = null;
      let matchMethod = "no_match";
      let matchScore = 0;

      // Nivel 1: código en tabla medicamento_codigos_proveedor
      if (c.noIdentificacion && codigosMap.has(c.noIdentificacion)) {
        medId = codigosMap.get(c.noIdentificacion)!;
        matchMethod = "exact_no_identificacion";
        matchScore = 100;
      }

      // Nivel 2: barcode / sku / codigo_interno
      if (!medId && c.noIdentificacion) {
        const byCode = medicamentos.find(
          (m) =>
            m.barcode === c.noIdentificacion ||
            m.sku === c.noIdentificacion ||
            m.codigo_interno === c.noIdentificacion
        );
        if (byCode) {
          medId = byCode.id;
          matchMethod = "exact_codigo";
          matchScore = 95;
        }
      }

      // Nivel 3: fuzzy por descripción
      if (!medId) {
        const descNorm = normalizarDesc(c.descripcion);
        let best = { score: 0, id: "" };
        for (const m of medicamentos) {
          const s = Math.max(
            similitud(descNorm, normalizarDesc(m.nombre)),
            m.nombre_generico
              ? similitud(descNorm, normalizarDesc(m.nombre_generico))
              : 0
          );
          if (s > best.score) best = { score: s, id: m.id };
        }
        if (best.score >= 75) {
          medId = best.id;
          matchMethod = "fuzzy_descripcion";
          matchScore = best.score;
        }
      }

      // --- 4-way match ---
      const alertas: AlertaMatch[] = [];

      const ocItem = medId ? ocPorMed.get(medId) : undefined;
      const recepItem = medId ? recepPorMed.get(medId) : undefined;

      let difVsOc: number | null = null;
      let difVsRecep: number | null = null;
      let difPrecioPct: number | null = null;
      let tieneAlertaCritica = false;

      if (ocItem) {
        // Cantidad CFDI vs OC
        difVsOc = c.cantidad - ocItem.cantidad_pedida;
        if (difVsOc > 0) {
          alertas.push({
            tipo: "CANTIDAD_FACTURADA_MAYOR_ORDENADA",
            severidad: "ALTA",
            descripcion: `"${c.descripcion}": CFDI=${c.cantidad} > OC=${ocItem.cantidad_pedida}`,
            valorCFDI: c.cantidad,
            valorReferencia: ocItem.cantidad_pedida,
            diferencia: difVsOc,
            porcentajeDiferencia:
              (difVsOc / ocItem.cantidad_pedida) * 100,
          });
        }

        // Precio
        const precioCFDI = c.valorUnitario;
        const precioOC = ocItem.precio_unitario_centavos / 100;
        if (precioOC > 0) {
          difPrecioPct =
            Math.abs((precioCFDI - precioOC) / precioOC) * 100;
          if (difPrecioPct > 2) {
            alertas.push({
              tipo:
                precioCFDI > precioOC
                  ? "PRECIO_UNITARIO_MAYOR_OC"
                  : "PRECIO_UNITARIO_MENOR_OC",
              severidad: precioCFDI > precioOC ? "ALTA" : "MEDIA",
              descripcion: `"${c.descripcion}": OC=$${precioOC.toFixed(2)} CFDI=$${precioCFDI.toFixed(2)} (${difPrecioPct.toFixed(1)}%)`,
              valorCFDI: precioCFDI,
              valorReferencia: precioOC,
              diferencia: precioCFDI - precioOC,
              porcentajeDiferencia: difPrecioPct,
            });
          }
        }
      }

      if (recepItem) {
        // ANTI-ROBO: cantidad CFDI vs recepción física
        difVsRecep = c.cantidad - recepItem.cantidad_recibida;
        if (difVsRecep > 0) {
          tieneAlertaCritica = true;
          alertas.push({
            tipo: "CANTIDAD_FACTURADA_MAYOR_RECIBIDA",
            severidad: "CRITICA",
            descripcion: `ANTI-ROBO: "${c.descripcion}" CFDI=${c.cantidad} > Recibido=${recepItem.cantidad_recibida} (+${difVsRecep} no llegaron pero se cobran)`,
            valorCFDI: c.cantidad,
            valorReferencia: recepItem.cantidad_recibida,
            diferencia: difVsRecep,
            porcentajeDiferencia:
              (difVsRecep / c.cantidad) * 100,
          });
        } else if (difVsRecep < 0) {
          alertas.push({
            tipo: "CANTIDAD_RECIBIDA_MAYOR_FACTURADA",
            severidad: "MEDIA",
            descripcion: `"${c.descripcion}": Recibido=${recepItem.cantidad_recibida} > CFDI=${c.cantidad} (bonificación sin CFDI?)`,
            valorCFDI: c.cantidad,
            valorReferencia: recepItem.cantidad_recibida,
            diferencia: Math.abs(difVsRecep),
            porcentajeDiferencia:
              (Math.abs(difVsRecep) / c.cantidad) * 100,
          });
        }
      }

      if (!medId) {
        alertas.push({
          tipo: "PRODUCTO_SIN_CATALOGAR",
          severidad: "MEDIA",
          descripcion: `"${c.descripcion}" (${c.noIdentificacion || "sin código"}) no está en catálogo — requiere revisión manual`,
          valorCFDI: c.cantidad,
          valorReferencia: 0,
          diferencia: 0,
          porcentajeDiferencia: 0,
        });
      }

      if (tieneAlertaCritica) hayAlertaCriticaGlobal = true;
      totalAlertas += alertas.length;

      lineas.push({
        lineaNumero: idx + 1,
        descripcion: c.descripcion,
        noIdentificacion: c.noIdentificacion,
        cantidad: c.cantidad,
        valorUnitarioCentavos: Math.round(c.valorUnitario * 100),
        importeCentavos: Math.round(c.importe * 100),
        ivaCentavos: Math.round(c.importeIva * 100),
        totalCentavos: Math.round(c.importeTotal * 100),
        tasaIva: c.tasaIva,
        objetoImp: c.objetoImp,
        medicamentoId: medId,
        matchMethod,
        matchScore,
        ocCantidadPedida: ocItem?.cantidad_pedida ?? null,
        ocPrecioUnitCentavos: ocItem?.precio_unitario_centavos ?? null,
        recepcionCantidadRecibida: recepItem?.cantidad_recibida ?? null,
        difCantidadVsOc: difVsOc,
        difCantidadVsRecepcion: difVsRecep,
        difPrecioPct,
        alertas,
        tieneAlertaCritica,
      });
    }

    // 8. Insertar lineas en fp_cfdi_lineas
    if (lineas.length > 0) {
      await supabase.from("fp_cfdi_lineas").insert(
        lineas.map((l) => ({
          fp_cfdi_id: fpCfdi.id,
          clinic_id: clinicId,
          linea_numero: l.lineaNumero,
          no_identificacion: l.noIdentificacion || null,
          cantidad: l.cantidad,
          descripcion: l.descripcion,
          valor_unitario_centavos: l.valorUnitarioCentavos,
          importe_centavos: l.importeCentavos,
          iva_centavos: l.ivaCentavos,
          total_centavos: l.totalCentavos,
          tasa_iva: l.tasaIva,
          objeto_imp: l.objetoImp,
          medicamento_id: l.medicamentoId,
          match_method: l.matchMethod,
          match_score: l.matchScore,
          oc_cantidad_pedida: l.ocCantidadPedida,
          oc_precio_unit_centavos: l.ocPrecioUnitCentavos,
          recepcion_cantidad_recibida: l.recepcionCantidadRecibida,
          dif_cantidad_vs_oc: l.difCantidadVsOc,
          dif_cantidad_vs_recepcion: l.difCantidadVsRecepcion,
          dif_precio_pct: l.difPrecioPct,
          alertas: l.alertas,
          tiene_alerta_critica: l.tieneAlertaCritica,
        }))
      );
    }

    // 9. Actualizar facturas_proveedor con referencias CFDI + match status
    const matchStatusNuevo = hayAlertaCriticaGlobal
      ? "discrepancia"
      : totalAlertas > 0
      ? "pendiente"
      : "ok";

    await supabase
      .from("facturas_proveedor")
      .update({
        fp_cfdi_id: fpCfdi.id,
        uuid_sat: cfdi.uuid,
        cfdi_parseado: true,
        tiene_alertas_criticas: hayAlertaCriticaGlobal,
        match_alertas_count: totalAlertas,
        match_status: matchStatusNuevo,
      })
      .eq("id", facturaProveedorId);

    // 10. Respuesta
    const recomendacion = hayAlertaCriticaGlobal
      ? "RECHAZAR — Investigar antes de pagar"
      : totalAlertas > 0
      ? "REVISAR — Confirmar discrepancias con proveedor"
      : "APROBAR — Sin discrepancias significativas";

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          fp_cfdi_id: fpCfdi.id,
          uuid: cfdi.uuid,
          total: cfdi.total,
          estado_sat: estadoSAT,
          errores_aritmeticos: erroresAritmeticos,
          lineas_count: lineas.length,
          alertas_criticas: lineas.filter((l) => l.tieneAlertaCritica).length,
          alertas_total: totalAlertas,
          recomendacion,
          lineas,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error("[cfdi-parse] Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
