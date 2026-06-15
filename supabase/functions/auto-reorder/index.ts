import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4";

const COOLDOWN_DIAS = 7;
const UMBRAL_AUTO_ENVIO_CENTAVOS = 500_000; // $5,000 MXN

interface MedReorden {
  medicamento_id: string;
  nombre_medicamento: string;
  presentacion: string | null;
  tipo_control: string;
  stock_actual: number;
  stock_minimo: number;
  stock_maximo: number;
  proveedor_id: string;
  proveedor_nombre: string;
  proveedor_email: string | null;
  proveedor_rfc: string | null;
  terminos_pago: number | null;
  precio_pactado_centavos: number;
  minimo_pedido: number;
  multiplo_pedido: number;
  plazo_entrega_dias: number;
  codigo_proveedor: string | null;
  iva_aplica: boolean;
}

interface GrupoProveedor {
  proveedor: {
    id: string;
    nombre: string;
    email: string | null;
    rfc: string | null;
    terminos_pago: number | null;
  };
  lineas: Array<{
    medicamento_id: string;
    nombre: string;
    presentacion: string | null;
    codigo_proveedor: string | null;
    cantidad: number;
    precio_pactado_centavos: number;
    iva_aplica: boolean;
    subtotal_centavos: number;
  }>;
}

function ajustarAlMultiplo(cantidad: number, multiplo: number, minimo: number): number {
  const ajustado = Math.ceil(cantidad / multiplo) * multiplo;
  return Math.max(ajustado, minimo);
}

function calcularFechaEntrega(maxPlazo: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + maxPlazo);
  return fecha.toISOString().split("T")[0];
}

function formatMXN(centavos: number): string {
  return (centavos / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function generarHtmlEmail(params: {
  folio: string;
  clinicaNombre: string;
  proveedor: GrupoProveedor["proveedor"];
  lineas: GrupoProveedor["lineas"];
  subtotal: number;
  iva: number;
  total: number;
  fechaEntrega: string;
  terminos: number;
}): string {
  const lineasHtml = params.lineas.map((l, i) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${i + 1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${l.codigo_proveedor ?? "—"}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${l.nombre}${l.presentacion ? ` — ${l.presentacion}` : ""}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${l.cantidad}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${formatMXN(l.precio_pactado_centavos)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${formatMXN(l.subtotal_centavos)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Orden de Compra ${params.folio}</title></head>
<body style="font-family:Arial,sans-serif;color:#333;font-size:13px;margin:0;padding:0;">
  <div style="background:#1a5276;color:white;padding:20px;">
    <h1 style="margin:0;font-size:18px;">ORDEN DE COMPRA No. ${params.folio}</h1>
    <p style="margin:4px 0 0;">${params.clinicaNombre}</p>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:20px;">
    <div>
      <h3 style="margin:0 0 8px;">Proveedor:</h3>
      <p style="margin:0;"><strong>${params.proveedor.nombre}</strong><br>
      RFC: ${params.proveedor.rfc ?? "N/A"}</p>
    </div>
    <div>
      <h3 style="margin:0 0 8px;">Detalles:</h3>
      <p style="margin:0;">
        Fecha emisión: <strong>${new Date().toLocaleDateString("es-MX")}</strong><br>
        Entrega requerida: <strong>${params.fechaEntrega}</strong><br>
        Condiciones: ${params.terminos} días
      </p>
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin:0 20px;width:calc(100% - 40px);">
    <thead>
      <tr style="background:#2e86c1;color:white;">
        <th style="padding:8px;text-align:left;">#</th>
        <th style="padding:8px;text-align:left;">Clave</th>
        <th style="padding:8px;text-align:left;">Medicamento</th>
        <th style="padding:8px;text-align:right;">Cant.</th>
        <th style="padding:8px;text-align:right;">Precio Unit.</th>
        <th style="padding:8px;text-align:right;">Subtotal</th>
      </tr>
    </thead>
    <tbody>${lineasHtml}</tbody>
    <tfoot>
      <tr><td colspan="5" style="padding:6px 8px;text-align:right;">Subtotal:</td><td style="padding:6px 8px;text-align:right;">${formatMXN(params.subtotal)}</td></tr>
      <tr><td colspan="5" style="padding:6px 8px;text-align:right;">IVA (16%):</td><td style="padding:6px 8px;text-align:right;">${formatMXN(params.iva)}</td></tr>
      <tr style="font-weight:bold;background:#f0f0f0;"><td colspan="5" style="padding:8px;text-align:right;">TOTAL:</td><td style="padding:8px;text-align:right;">${formatMXN(params.total)}</td></tr>
    </tfoot>
  </table>
  <div style="padding:20px;font-size:12px;color:#555;">
    <p><strong>Instrucciones:</strong> Favor de incluir No. OC <strong>${params.folio}</strong> en su factura CFDI 4.0 (XML + PDF).</p>
    <p>Generado automáticamente por sistema integrika.mx — ${new Date().toISOString()}</p>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  // Health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, fn: "auto-reorder" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const cronSecret = Deno.env.get("AUTO_REORDER_CRON_SECRET");

  // Auth: cron secret OR service role bearer
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const isCron = cronSecret && token === cronSecret;
  const isService = token === serviceKey;
  if (!isCron && !isService) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const resend = resendKey ? new Resend(resendKey) : null;

  // Optionally target a specific clinic_id from body
  let targetClinicId: string | null = null;
  try {
    const body = await req.json().catch(() => ({})) as { clinic_id?: string };
    targetClinicId = body.clinic_id ?? null;
  } catch { /* no body */ }

  // Get all active clinics (or target one)
  const clinicsQuery = supabase.from("clinics").select("id, name").eq("status", "active");
  if (targetClinicId) clinicsQuery.eq("id", targetClinicId);
  const { data: clinics, error: clinicsErr } = await clinicsQuery;
  if (clinicsErr) {
    return new Response(JSON.stringify({ error: clinicsErr.message }), { status: 500 });
  }

  const resultados: Array<{ clinic_id: string; ocs_creadas: number; alertas_manuales: number; errores: string[] }> = [];

  for (const clinic of (clinics ?? [])) {
    const errores: string[] = [];
    let ocsCreadas = 0;
    let alertasManuales = 0;

    // 1. Medicamentos en reorden con proveedor configurado
    const { data: enReorden, error: reordenErr } = await (supabase.rpc as (fn: string, args: Record<string, unknown>) => Promise<{ data: MedReorden[] | null; error: unknown }>)(
      "get_medicamentos_en_reorden",
      { p_clinic_id: clinic.id }
    );
    if (reordenErr) {
      errores.push(`RPC error: ${JSON.stringify(reordenErr)}`);
      resultados.push({ clinic_id: clinic.id, ocs_creadas: 0, alertas_manuales: 0, errores });
      continue;
    }
    if (!enReorden || enReorden.length === 0) {
      resultados.push({ clinic_id: clinic.id, ocs_creadas: 0, alertas_manuales: 0, errores });
      continue;
    }

    // 2. Cooldown: excluir pares med+proveedor con OC reciente (7 días)
    const fechaCooldown = new Date();
    fechaCooldown.setDate(fechaCooldown.getDate() - COOLDOWN_DIAS);
    const { data: enCooldown } = await supabase
      .from("auto_reorden_log")
      .select("medicamento_id, proveedor_id")
      .eq("clinic_id", clinic.id)
      .gte("ejecutado_en", fechaCooldown.toISOString())
      .in("estado", ["generada", "enviada"]);

    const cooldownSet = new Set(
      ((enCooldown ?? []) as Array<{ medicamento_id: string; proveedor_id: string }>)
        .map((r) => `${r.medicamento_id}:${r.proveedor_id}`)
    );

    const activos = enReorden.filter((m) => !cooldownSet.has(`${m.medicamento_id}:${m.proveedor_id}`));

    // 3. Separar por tipo_control
    const paraAutoOC = activos.filter((m) => ["otc", "rx_simple"].includes(m.tipo_control));
    const paraBorradorManual = activos.filter((m) => m.tipo_control === "psicotropico_iii");

    // 4. Agrupar por proveedor
    const porProveedor = new Map<string, GrupoProveedor>();
    for (const med of paraAutoOC) {
      if (!porProveedor.has(med.proveedor_id)) {
        porProveedor.set(med.proveedor_id, {
          proveedor: {
            id: med.proveedor_id,
            nombre: med.proveedor_nombre,
            email: med.proveedor_email,
            rfc: med.proveedor_rfc,
            terminos_pago: med.terminos_pago,
          },
          lineas: [],
        });
      }
      const cantidadBase = Math.max(0, med.stock_maximo - med.stock_actual);
      const cantidad = ajustarAlMultiplo(cantidadBase, med.multiplo_pedido, med.minimo_pedido);
      const subtotal = cantidad * med.precio_pactado_centavos;
      porProveedor.get(med.proveedor_id)!.lineas.push({
        medicamento_id: med.medicamento_id,
        nombre: med.nombre_medicamento,
        presentacion: med.presentacion,
        codigo_proveedor: med.codigo_proveedor,
        cantidad,
        precio_pactado_centavos: med.precio_pactado_centavos,
        iva_aplica: med.iva_aplica,
        subtotal_centavos: subtotal,
      });
    }

    // 5. Obtener folio base para OC
    const { data: folioRows } = await supabase
      .from("ordenes_compra")
      .select("folio")
      .eq("clinic_id", clinic.id) as { data: Array<{ folio: string }> | null };
    const nums = (folioRows ?? []).map((r) => parseInt(r.folio.replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
    let maxFolio = nums.length ? Math.max(...nums) : 0;

    // 6. Crear OC por proveedor
    for (const [proveedorId, grupo] of porProveedor) {
      const subtotalTotal = grupo.lineas.reduce((s, l) => s + l.subtotal_centavos, 0);
      const ivaLineas = grupo.lineas.filter((l) => l.iva_aplica).reduce((s, l) => s + l.subtotal_centavos, 0);
      const ivaTotal = Math.round(ivaLineas * 0.16);
      const totalCentavos = subtotalTotal + ivaTotal;
      const maxPlazo = Math.max(...grupo.lineas.map(() => 3)); // default; plazo per-linea not tracked here
      const fechaEntrega = calcularFechaEntrega(maxPlazo);
      const estatusOC = totalCentavos < UMBRAL_AUTO_ENVIO_CENTAVOS ? "confirmada" : "pendiente_aprobacion";

      maxFolio += 1;
      const folio = `OC-${String(maxFolio).padStart(4, "0")}`;

      const { data: oc, error: ocErr } = await supabase
        .from("ordenes_compra")
        .insert({
          clinic_id: clinic.id,
          folio,
          proveedor_id: proveedorId,
          estatus: estatusOC,
          fecha_entrega_est: fechaEntrega,
          terminos_pago: grupo.proveedor.terminos_pago ?? 30,
          subtotal_centavos: subtotalTotal,
          iva_centavos: ivaTotal,
          total_centavos: totalCentavos,
          notas: `Auto-reorden — generada automáticamente el ${new Date().toLocaleDateString("es-MX")}`,
        })
        .select("id")
        .single() as { data: { id: string } | null; error: unknown };

      if (ocErr || !oc) {
        errores.push(`OC insert error para proveedor ${proveedorId}: ${JSON.stringify(ocErr)}`);
        continue;
      }

      // Crear items de la OC
      const itemsOC = grupo.lineas.map((l) => ({
        orden_id: oc.id,
        medicamento_id: l.medicamento_id,
        cantidad_pedida: l.cantidad,
        precio_unitario_centavos: l.precio_pactado_centavos,
        tasa_iva: l.iva_aplica ? 0.16 : 0,
        subtotal_centavos: l.subtotal_centavos,
        cantidad_recibida: 0,
      }));
      const { error: itemsErr } = await supabase.from("ordenes_compra_items").insert(itemsOC);
      if (itemsErr) errores.push(`Items OC error: ${JSON.stringify(itemsErr)}`);

      // Log de auto-reorden para cooldown
      const logRows = grupo.lineas.map((l) => ({
        clinic_id: clinic.id,
        medicamento_id: l.medicamento_id,
        proveedor_id: proveedorId,
        orden_compra_id: oc.id,
        estado: "generada",
      }));
      await supabase.from("auto_reorden_log").insert(logRows);

      // Enviar email si es confirmada y proveedor tiene email
      if (estatusOC === "confirmada" && grupo.proveedor.email && resend) {
        const html = generarHtmlEmail({
          folio,
          clinicaNombre: clinic.name,
          proveedor: grupo.proveedor,
          lineas: grupo.lineas,
          subtotal: subtotalTotal,
          iva: ivaTotal,
          total: totalCentavos,
          fechaEntrega,
          terminos: grupo.proveedor.terminos_pago ?? 30,
        });

        const { error: emailErr } = await resend.emails.send({
          from: "Compras <compras@integrika.mx>",
          to: [grupo.proveedor.email],
          subject: `${folio} | ${clinic.name} | Orden de Compra`,
          html,
        });

        if (emailErr) {
          errores.push(`Email error para ${grupo.proveedor.email}: ${JSON.stringify(emailErr)}`);
          await supabase.from("auto_reorden_log")
            .update({ estado: "error", error_mensaje: JSON.stringify(emailErr) })
            .eq("orden_compra_id", oc.id);
        } else {
          await supabase.from("auto_reorden_log")
            .update({ estado: "enviada" })
            .eq("orden_compra_id", oc.id);
        }
      }

      ocsCreadas++;
    }

    // 7. Crear borradores manuales para psicotrópicos III (sin envío)
    for (const med of paraBorradorManual) {
      const cantidad = ajustarAlMultiplo(
        Math.max(0, med.stock_maximo - med.stock_actual),
        med.multiplo_pedido,
        med.minimo_pedido
      );
      maxFolio += 1;
      const folio = `OC-${String(maxFolio).padStart(4, "0")}`;
      const subtotal = cantidad * med.precio_pactado_centavos;
      const iva = med.iva_aplica ? Math.round(subtotal * 0.16) : 0;

      const { data: oc, error: ocErr } = await supabase
        .from("ordenes_compra")
        .insert({
          clinic_id: clinic.id,
          folio,
          proveedor_id: med.proveedor_id,
          estatus: "borrador",
          fecha_entrega_est: calcularFechaEntrega(med.plazo_entrega_dias),
          terminos_pago: med.terminos_pago ?? 30,
          subtotal_centavos: subtotal,
          iva_centavos: iva,
          total_centavos: subtotal + iva,
          notas: `Auto-reorden psicotrópico III — requiere firma QFB antes de enviar. ${new Date().toLocaleDateString("es-MX")}`,
        })
        .select("id")
        .single() as { data: { id: string } | null; error: unknown };

      if (ocErr || !oc) { errores.push(`Borrador psicotrópico error: ${JSON.stringify(ocErr)}`); continue; }

      await supabase.from("ordenes_compra_items").insert([{
        orden_id: oc.id,
        medicamento_id: med.medicamento_id,
        cantidad_pedida: cantidad,
        precio_unitario_centavos: med.precio_pactado_centavos,
        tasa_iva: med.iva_aplica ? 0.16 : 0,
        subtotal_centavos: subtotal,
        cantidad_recibida: 0,
      }]);

      await supabase.from("auto_reorden_log").insert({
        clinic_id: clinic.id,
        medicamento_id: med.medicamento_id,
        proveedor_id: med.proveedor_id,
        orden_compra_id: oc.id,
        estado: "generada",
      });

      alertasManuales++;
    }

    resultados.push({ clinic_id: clinic.id, ocs_creadas: ocsCreadas, alertas_manuales: alertasManuales, errores });
  }

  return new Response(JSON.stringify({ ok: true, resultados }), {
    headers: { "Content-Type": "application/json" },
  });
});
