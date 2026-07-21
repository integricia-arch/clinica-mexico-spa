// =================================================================
// cfdi-timbrar: timbre CFDI 4.0 vía Facturama, guarda en cfdi_documentos
// Solo admin. Requiere cfdi_config con PAC configurado.
// =================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { enforceRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SUPABASE_ANON || !SUPABASE_SVC) {
  throw new Error("[cfdi-timbrar] Env vars missing: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY");
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const round2 = (n: number) => Math.round(n * 100) / 100;

async function getPacCredentials(svc: ReturnType<typeof createClient>, cfg: Record<string, any>) {
  if (cfg.pac_secret_id) {
    const { data: secret, error } = await svc.rpc("cfdi_get_secret", { p_id: cfg.pac_secret_id });
    if (error) throw new Error("Error leyendo secreto PAC: " + error.message);
    return { pac_usuario: cfg.pac_usuario as string, pac_contrasena: secret as string };
  }
  // Fallback a texto plano (legado — eliminar una vez todos migrados)
  if (cfg.pac_contrasena) return { pac_usuario: cfg.pac_usuario as string, pac_contrasena: cfg.pac_contrasena as string };
  throw new Error("Credenciales PAC no configuradas en Configuración → Facturación");
}

interface Concepto {
  clave_prod_serv: string;
  clave_unidad: string;
  cantidad: number;
  descripcion: string;
  valor_unitario: number;
  descuento?: number;
  objeto_imp: "01" | "02" | "03"; // 01=no objeto IVA, 02=sí objeto
  iva_tasa?: number;               // 0.16 | 0.08 | 0.00 cuando objeto_imp=02
}

interface InformacionGlobal {
  periodicidad: "01" | "02" | "03" | "04" | "05"; // 01=diario 02=semanal 03=quincenal 04=mensual 05=bimestral
  meses: string;   // "01"-"12"
  anio: number;
}

interface TimbrarRequest {
  clinic_id: string;
  tipo: "I" | "E";
  receptor: {
    rfc: string;
    nombre: string;
    regimen_fiscal: string;
    domicilio_fiscal_cp: string;
    uso_cfdi: string;
    email?: string;
  };
  conceptos: Concepto[];
  metodo_pago: "PUE" | "PPD";
  forma_pago: string;
  informacion_global?: InformacionGlobal;
  appointment_id?: string;
  sale_id?: string;
  cfdi_relacionado_uuid?: string; // UUID SAT del CFDI origen (requerido para tipo E)
  tipo_relacion?: string;         // default "01" (nota de crédito)
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") return json({ status: "ok", fn: "cfdi-timbrar" });

  // Auth: verificar usuario activo
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supaUser.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

  const svc = createClient(SUPABASE_URL, SUPABASE_SVC);

  // Verificar rol admin
  const { data: roles, error: rolesErr } = await svc
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  if (rolesErr) {
    console.error("[cfdi-timbrar] roles query error:", rolesErr.message);
    return json({ error: "Error interno al verificar permisos" }, 500);
  }
  if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) {
    return json({ error: "Forbidden" }, 403);
  }

  const okRate = await enforceRateLimit(svc, `timbrar:${userData.user.id}`, 60, 3600);
  if (!okRate) return rateLimitResponse(corsHeaders, 3600);

  try {
    const body: TimbrarRequest = await req.json();
    const { clinic_id, tipo = "I", receptor, conceptos, metodo_pago, forma_pago, informacion_global, appointment_id, sale_id, cfdi_relacionado_uuid, tipo_relacion = "01" } = body;

    if (!clinic_id || !receptor?.rfc || !conceptos?.length) {
      return json({ error: "Faltan datos: clinic_id, receptor.rfc y conceptos son obligatorios" }, 400);
    }
    if (tipo === "E" && !cfdi_relacionado_uuid) {
      return json({ error: "Para tipo E (nota de crédito) se requiere cfdi_relacionado_uuid (UUID SAT del CFDI de ingreso)" }, 400);
    }

    // Cargar config CFDI de la clínica
    const { data: cfg } = await svc
      .from("cfdi_config")
      .select("*")
      .eq("clinic_id", clinic_id)
      .eq("activo", true)
      .maybeSingle();

    if (!cfg) return json({ error: "Sin configuración CFDI — configura el emisor primero" }, 400);
    if (!cfg.pac_usuario || (!cfg.pac_secret_id && !cfg.pac_contrasena)) {
      return json({ error: "Credenciales PAC no configuradas en Configuración → Facturación" }, 400);
    }
    if (!cfg.domicilio_fiscal_cp) {
      return json({ error: "CP del domicilio fiscal del emisor no configurado" }, 400);
    }

    // Calcular totales y construir conceptos para Facturama
    let subtotal = 0;
    // Map: "tasaStr" → { base, importe } — agrega traslados por tasa
    const trasladosMap = new Map<string, { base: number; importe: number }>();

    const conceptosFac = conceptos.map((c) => {
      const importe = round2(c.cantidad * c.valor_unitario);
      const desc    = round2(c.descuento ?? 0);
      const base    = round2(importe - desc);
      subtotal     += base;

      const item: Record<string, unknown> = {
        ClaveProdServ: c.clave_prod_serv,
        ClaveUnidad:   c.clave_unidad,
        Cantidad:      c.cantidad,
        Descripcion:   c.descripcion,
        ValorUnitario: round2(c.valor_unitario),
        Importe:       importe,
        ObjetoImp:     c.objeto_imp,
      };
      if (desc > 0) item.Descuento = desc;

      if (c.objeto_imp === "02" && c.iva_tasa !== undefined && c.iva_tasa >= 0) {
        const tasaStr    = c.iva_tasa.toFixed(6);
        const ivaImporte = round2(base * c.iva_tasa);
        item.Impuestos = {
          Traslados: [{
            Base:        base,
            Impuesto:    "002",
            TipoFactor:  "Tasa",
            TasaOCuota:  tasaStr,
            Importe:     ivaImporte,
          }],
        };
        // Acumular para totales
        const prev = trasladosMap.get(tasaStr) ?? { base: 0, importe: 0 };
        trasladosMap.set(tasaStr, {
          base:    round2(prev.base + base),
          importe: round2(prev.importe + ivaImporte),
        });
      }

      return item;
    });

    subtotal = round2(subtotal);
    const totalIva = round2([...trasladosMap.values()].reduce((s, v) => s + v.importe, 0));
    const total    = round2(subtotal + totalIva);

    // Payload Facturama API v3 (CFDI 4.0)
    const payload: Record<string, unknown> = {
      Receptor: {
        Rfc:                      receptor.rfc.toUpperCase().trim(),
        Nombre:                   receptor.nombre.trim(),
        UsoCfdi:                  receptor.uso_cfdi,
        RegimenFiscalReceptor:    receptor.regimen_fiscal,
        DomicilioFiscalReceptor:  receptor.domicilio_fiscal_cp,
      },
      TipoDeComprobante: tipo,
      MetodoPago:        metodo_pago,
      FormaPago:         metodo_pago === "PPD" ? "99" : forma_pago,
      Moneda:            "MXN",
      SubTotal:          subtotal,
      Total:             total,
      LugarExpedicion:   cfg.domicilio_fiscal_cp,
      Exportacion:       "01",
      Conceptos:         conceptosFac,
    };

    if (cfg.serie_defecto) payload.Serie = cfg.serie_defecto;

    // Tipo E: nota de crédito requiere CfdiRelacionados con TipoRelacion "01"
    if (tipo === "E" && cfdi_relacionado_uuid) {
      payload.CfdiRelacionados = [{
        TipoRelacion:    tipo_relacion,
        CfdiRelacionado: [{ Uuid: cfdi_relacionado_uuid }],
      }];
    }

    // Factura global: InformacionGlobal + receptor XAXX bloqueado
    if (informacion_global) {
      payload.InformacionGlobal = {
        Periodicidad: informacion_global.periodicidad,
        Meses:        informacion_global.meses.padStart(2, "0"),
        Año:          informacion_global.anio,
      };
    }

    if (trasladosMap.size > 0) {
      payload.Impuestos = {
        TotalImpuestosTrasladados: totalIva,
        Traslados: [...trasladosMap.entries()].map(([tasa, vals]) => ({
          Base:       vals.base,
          Impuesto:   "002",
          TipoFactor: "Tasa",
          TasaOCuota: tasa,
          Importe:    vals.importe,
        })),
      };
    }

    // Llamar a Facturama
    const facBase = cfg.pac_ambiente === "produccion"
      ? "https://api.facturama.mx"
      : "https://apisandbox.facturama.mx";
    const { pac_contrasena } = await getPacCredentials(svc, cfg);
    const creds = btoa(`${cfg.pac_usuario}:${pac_contrasena}`);

    const facRes = await fetch(`${facBase}/api/3/cfdis`, {
      method:  "POST",
      headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    const facData = await facRes.json();

    if (!facRes.ok) {
      const msg = facData?.Message ?? facData?.message ?? "(sin mensaje)";
      console.error("[cfdi-timbrar] Facturama error", facRes.status, msg);
      return json({ error: `Facturama ${facRes.status}: ${msg}` }, 422);
    }

    // Extraer UUID del timbre fiscal
    const uuidFiscal    = facData?.Complement?.TaxStamp?.UUID
                       ?? facData?.complement?.taxStamp?.uuid
                       ?? null;
    const pacIdExterno  = facData?.Id ?? facData?.id ?? null;
    const folioRespuesta = String(facData?.Folio ?? facData?.folio ?? "");
    const serieRespuesta = facData?.Serie ?? facData?.serie ?? cfg.serie_defecto ?? null;

    // Intentar descargar el XML timbrado
    let xmlContenido: string | null = null;
    if (pacIdExterno) {
      try {
        const xmlRes = await fetch(`${facBase}/api/cfdi-downloads/xml/${pacIdExterno}`, {
          headers: { Authorization: `Basic ${creds}` },
        });
        if (xmlRes.ok) xmlContenido = await xmlRes.text();
      } catch (e) {
        console.warn("[cfdi-timbrar] No se pudo descargar XML:", e);
      }
    }
    // Fallback: guardar JSON de Facturama si no se obtuvo XML real
    if (!xmlContenido) xmlContenido = JSON.stringify(facData);

    // Guardar en cfdi_documentos
    const { data: doc, error: insertErr } = await svc
      .from("cfdi_documentos")
      .insert({
        clinic_id,
        uuid_fiscal:    uuidFiscal,
        serie:          serieRespuesta,
        folio:          folioRespuesta || null,
        tipo,
        fecha_emision:  new Date().toISOString(),
        rfc_emisor:     cfg.rfc ?? "",
        rfc_receptor:   receptor.rfc.toUpperCase().trim(),
        nombre_receptor: receptor.nombre.trim(),
        subtotal,
        descuento:      0,
        total,
        moneda:         "MXN",
        metodo_pago,
        forma_pago:     metodo_pago === "PPD" ? "99" : forma_pago,
        xml_contenido:  xmlContenido,
        status:         "vigente",
        appointment_id:        appointment_id ?? null,
        sale_id:               sale_id ?? null,
        pac_id_externo:        pacIdExterno,
        cfdi_relacionado_uuid: cfdi_relacionado_uuid ?? null,
      })
      .select("id")
      .single();

    if (insertErr) {
      // CFDI fue timbrado pero no se guardó — devolver UUID para no perderlo
      console.error("[cfdi-timbrar] DB insert error:", insertErr.message);
      return json({
        ok:            true,
        warning:       "CFDI timbrado pero no guardado en BD — guarda el UUID manualmente: " + insertErr.message,
        uuid_fiscal:   uuidFiscal,
        pac_id_externo: pacIdExterno,
        folio:         folioRespuesta,
        total,
      });
    }

    // Guardar conceptos
    const { error: conceptosErr } = await svc.from("cfdi_conceptos").insert(
      conceptos.map((c) => {
        const base = round2(c.cantidad * c.valor_unitario - (c.descuento ?? 0));
        return {
          cfdi_id:         doc.id,
          clave_prod_serv: c.clave_prod_serv,
          clave_unidad:    c.clave_unidad,
          cantidad:        c.cantidad,
          descripcion:     c.descripcion,
          valor_unitario:  c.valor_unitario,
          importe:         round2(c.cantidad * c.valor_unitario),
          descuento:       c.descuento ?? 0,
          objeto_imp:      c.objeto_imp,
          iva_tasa:        c.iva_tasa ?? null,
          iva_importe:     c.objeto_imp === "02" && c.iva_tasa !== undefined
                             ? round2(base * c.iva_tasa) : null,
        };
      })
    );
    if (conceptosErr) {
      console.error("[cfdi-timbrar] cfdi_conceptos insert error:", conceptosErr.message);
    }

    // Guardar/actualizar receptor en catálogo si es nuevo
    const { data: recExist } = await svc
      .from("cfdi_receptores")
      .select("id")
      .eq("clinic_id", clinic_id)
      .eq("rfc", receptor.rfc.toUpperCase().trim())
      .maybeSingle();

    if (!recExist) {
      await svc.from("cfdi_receptores").insert({
        clinic_id,
        rfc:                 receptor.rfc.toUpperCase().trim(),
        nombre:              receptor.nombre.trim(),
        regimen_fiscal:      receptor.regimen_fiscal,
        domicilio_fiscal_cp: receptor.domicilio_fiscal_cp,
        uso_cfdi_defecto:    receptor.uso_cfdi,
        email_envio:         receptor.email ?? null,
      });
    }

    // Registrar en audit_logs
    await svc.from("audit_logs").insert({
      user_id:   userData.user.id,
      action:    "INSERT",
      table_name: "cfdi_documentos",
      record_id:  doc.id,
      new_values: { uuid_fiscal: uuidFiscal, total, tipo },
    });

    return json({
      ok:             true,
      cfdi_id:        doc.id,
      uuid_fiscal:    uuidFiscal,
      pac_id_externo: pacIdExterno,
      folio:          folioRespuesta,
      serie:          serieRespuesta,
      total,
    });

  } catch (err: any) {
    console.error("[cfdi-timbrar] unexpected error:", err);
    return json({ error: err.message ?? "Error interno" }, 500);
  }
});
