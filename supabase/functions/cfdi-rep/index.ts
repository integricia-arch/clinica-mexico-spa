// =================================================================
// cfdi-rep: emite CFDI tipo P (Complemento de Recepción de Pagos)
// para CFDIs PPD. Solo admin. Facturama API v3.
// =================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const round2 = (n: number) => Math.round(n * 100) / 100;

interface REPRequest {
  clinic_id: string;
  cfdi_id: string;        // UUID interno del CFDI PPD original
  fecha_pago: string;     // ISO datetime: "2026-06-12T14:00:00"
  forma_pago: string;     // "03" tarjeta, "01" efectivo, etc.
  monto: number;          // importe del pago
  num_parcialidad: number; // 1, 2, 3...
  saldo_anterior: number;
  saldo_insoluto: number;
  num_operacion?: string;  // referencia bancaria / # de operación
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supaUser.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

  const svc = createClient(SUPABASE_URL, SUPABASE_SVC);

  const { data: roles } = await svc
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  if (!(roles ?? []).some((r: any) => r.role === "admin")) {
    return json({ error: "Forbidden" }, 403);
  }

  try {
    const body: REPRequest = await req.json();
    const {
      clinic_id, cfdi_id, fecha_pago, forma_pago, monto,
      num_parcialidad, saldo_anterior, saldo_insoluto, num_operacion,
    } = body;

    if (!clinic_id || !cfdi_id || !fecha_pago || !forma_pago || !monto) {
      return json({ error: "Faltan campos obligatorios" }, 400);
    }

    // Cargar el CFDI PPD original
    const { data: docOrig } = await svc
      .from("cfdi_documentos")
      .select("id, uuid_fiscal, rfc_receptor, nombre_receptor, total, metodo_pago, status, serie, folio, clinic_id")
      .eq("id", cfdi_id)
      .eq("clinic_id", clinic_id)
      .single();

    if (!docOrig) return json({ error: "CFDI no encontrado" }, 404);
    if (docOrig.metodo_pago !== "PPD") {
      return json({ error: "El CFDI no es de método PPD — solo se emiten REP para facturas PPD" }, 422);
    }
    if (docOrig.status === "cancelado") {
      return json({ error: "El CFDI está cancelado" }, 409);
    }
    if (!docOrig.uuid_fiscal) {
      return json({ error: "El CFDI no tiene UUID fiscal — no se puede referenciar en el REP" }, 422);
    }

    // Cargar receptor del CFDI original para obtener régimen y CP
    const { data: receptor } = await svc
      .from("cfdi_receptores")
      .select("regimen_fiscal, domicilio_fiscal_cp, uso_cfdi_defecto")
      .eq("clinic_id", clinic_id)
      .eq("rfc", docOrig.rfc_receptor)
      .maybeSingle();

    // Cargar config PAC
    const { data: cfg } = await svc
      .from("cfdi_config")
      .select("*")
      .eq("clinic_id", clinic_id)
      .eq("activo", true)
      .maybeSingle();

    if (!cfg?.pac_usuario) return json({ error: "Configuración PAC no disponible" }, 400);
    if (!cfg.domicilio_fiscal_cp) return json({ error: "CP del emisor no configurado" }, 400);

    // Calcular IVA del pago (base × 16% o 8% según el CFDI original)
    // Simplificación: asumimos IVA 16% sobre la parte del pago que corresponde a IVA
    // Base = monto / (1 + tasa); importe IVA = base * tasa
    const ivaTasa   = cfg.iva_default ?? 0.16;
    const basePago  = round2(monto / (1 + ivaTasa));
    const ivaImporte = round2(monto - basePago);
    const tasaStr   = (ivaTasa as number).toFixed(6);

    // Payload Facturama Complemento de Pagos
    const payload = {
      Receptor: {
        Rfc:                     docOrig.rfc_receptor,
        Nombre:                  docOrig.nombre_receptor,
        UsoCfdi:                 "CP01",   // Pagos — uso fijo para REP
        RegimenFiscalReceptor:   receptor?.regimen_fiscal ?? "616",
        DomicilioFiscalReceptor: receptor?.domicilio_fiscal_cp ?? cfg.domicilio_fiscal_cp,
      },
      TipoDeComprobante: "P",
      Moneda:            "XXX",
      SubTotal:          "0",
      Total:             "0",
      LugarExpedicion:   cfg.domicilio_fiscal_cp,
      Exportacion:       "01",
      ...(cfg.serie_defecto ? { Serie: cfg.serie_defecto } : {}),
      Conceptos: [{
        ClaveProdServ: "84111506",
        ClaveUnidad:   "ACT",
        Cantidad:      1,
        Descripcion:   "Pago",
        ValorUnitario: 0,
        Importe:       0,
        ObjetoImp:     "01",
      }],
      Complemento: {
        Pagos: {
          Version: "2.0",
          Totales: {
            MontoTotalPagos: round2(monto),
            TotalTrasladosBaseIVA16: basePago,
            TotalTrasladosImpuestoIVA16: ivaImporte,
          },
          Pago: [{
            FechaPago:     fecha_pago,
            FormaDePagoP:  forma_pago,
            MonedaP:       "MXN",
            Monto:         round2(monto),
            ...(num_operacion ? { NumOperacion: num_operacion } : {}),
            DoctoRelacionado: [{
              IdDocumento:       docOrig.uuid_fiscal,
              ...(docOrig.serie ? { Serie: docOrig.serie } : {}),
              ...(docOrig.folio ? { Folio: docOrig.folio } : {}),
              MonedaDR:          "MXN",
              NumParcialidad:    num_parcialidad,
              ImpSaldoAnt:       round2(saldo_anterior),
              ImpPagado:         round2(monto),
              ImpSaldoInsoluto:  round2(saldo_insoluto),
              ObjetoImpDR:       "02",
              ImpuestosDR: {
                TrasladosDR: [{
                  BaseDR:       basePago,
                  ImpuestoDR:   "002",
                  TipoFactorDR: "Tasa",
                  TasaOCuotaDR: tasaStr,
                  ImporteDR:    ivaImporte,
                }],
              },
            }],
          }],
        },
      },
    };

    const facBase = cfg.pac_ambiente === "produccion"
      ? "https://api.facturama.mx"
      : "https://apisandbox.facturama.mx";
    const creds = btoa(`${cfg.pac_usuario}:${cfg.pac_contrasena}`);

    const facRes = await fetch(`${facBase}/api/3/cfdis`, {
      method: "POST",
      headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const facData = await facRes.json();

    if (!facRes.ok) {
      const msg = facData?.Message ?? facData?.message ?? JSON.stringify(facData);
      console.error("[cfdi-rep] Facturama error", facRes.status, msg);
      return json({ error: `Facturama ${facRes.status}: ${msg}` }, 422);
    }

    const uuidFiscal    = facData?.Complement?.TaxStamp?.UUID ?? facData?.complement?.taxStamp?.uuid ?? null;
    const pacIdExterno  = facData?.Id ?? facData?.id ?? null;
    const folioResp     = String(facData?.Folio ?? facData?.folio ?? "");
    const serieResp     = facData?.Serie ?? facData?.serie ?? cfg.serie_defecto ?? null;

    // Descargar XML
    let xmlContenido: string | null = null;
    if (pacIdExterno) {
      try {
        const xmlRes = await fetch(`${facBase}/api/cfdi-downloads/xml/${pacIdExterno}`, {
          headers: { Authorization: `Basic ${creds}` },
        });
        if (xmlRes.ok) xmlContenido = await xmlRes.text();
      } catch { /* no bloquear */ }
    }
    if (!xmlContenido) xmlContenido = JSON.stringify(facData);

    // Guardar REP en cfdi_documentos
    const { data: doc, error: insertErr } = await svc
      .from("cfdi_documentos")
      .insert({
        clinic_id,
        uuid_fiscal:     uuidFiscal,
        serie:           serieResp,
        folio:           folioResp || null,
        tipo:            "P",
        fecha_emision:   new Date().toISOString(),
        rfc_emisor:      cfg.rfc ?? "",
        rfc_receptor:    docOrig.rfc_receptor,
        nombre_receptor: docOrig.nombre_receptor,
        subtotal:        0,
        descuento:       0,
        total:           round2(monto),
        moneda:          "XXX",
        metodo_pago:     null,
        forma_pago,
        xml_contenido:   xmlContenido,
        status:          "vigente",
        pac_id_externo:  pacIdExterno,
        cfdi_relacionado_uuid: docOrig.uuid_fiscal as any,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[cfdi-rep] DB insert error:", insertErr.message);
      return json({
        ok: true,
        warning: "REP timbrado pero no guardado en BD: " + insertErr.message,
        uuid_fiscal: uuidFiscal,
        pac_id_externo: pacIdExterno,
      });
    }

    await svc.from("audit_logs").insert({
      user_id:    userData.user.id,
      action:     "INSERT",
      table_name: "cfdi_documentos",
      record_id:  doc.id,
      new_values: { uuid_fiscal: uuidFiscal, tipo: "P", cfdi_ppd: cfdi_id, monto },
    });

    return json({
      ok:             true,
      cfdi_id:        doc.id,
      uuid_fiscal:    uuidFiscal,
      pac_id_externo: pacIdExterno,
      folio:          folioResp,
      serie:          serieResp,
      monto:          round2(monto),
    });

  } catch (err: any) {
    console.error("[cfdi-rep] unexpected error:", err);
    return json({ error: err.message ?? "Error interno" }, 500);
  }
});
