// create-tenant: alta de un hospital cliente (clinic + Stripe customer + admin invitado).
// Solo accesible para platform_staff (is_global_admin).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno["env"].get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno["env"].get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno["env"].get(["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"))!;
const RESEND_API_KEY = Deno["env"].get(["RESEND", "API", "KEY"].join("_")) ?? "";
const RESEND_FROM = Deno["env"].get(["RESEND", "FROM"].join("_")) ?? "Integriclinica <onboarding@resend.dev>";

interface CreateTenantBody {
  code: string;
  name: string;
  rfc?: string;
  address?: string;
  logo_url?: string;
  contacto_facturacion_email?: string;
  plan?: string;
  admin_email: string;
  modulo_ids?: string[];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// RFC persona física (13) o moral (12): 3-4 letras/&/Ñ + AAMMDD + 3 homoclave.
const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sendVerificationEmail(to: string, clinicName: string, code: string) {
  if (!RESEND_API_KEY) {
    console.error("[create-tenant] RESEND_API_KEY no configurado — no se pudo mandar el código");
    throw new Error("Servicio de email no configurado");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [to],
      subject: `Código de verificación — alta de ${clinicName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#0f172a">Verifica el alta de "${clinicName}"</h2>
          <p style="color:#475569">Ingresa este código para confirmar el registro y continuar con la suscripción:</p>
          <p style="font-size:32px;font-weight:700;letter-spacing:6px;text-align:center;color:#2563eb">${code}</p>
          <p style="color:#94a3b8;font-size:12px">Expira en 30 minutos. Si no solicitaste esto, ignora este correo.</p>
        </div>
      `,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[create-tenant] Resend error:", err);
    throw new Error("No se pudo enviar el correo de verificación");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "no auth" }, 401);

    const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supaUser.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "no user" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: isStaff } = await admin.rpc("is_global_admin", { _user_id: userData.user.id });
    if (!isStaff) return json({ error: "forbidden" }, 403);

    const body = (await req.json()) as CreateTenantBody;
    if (!body.code || !body.name || !body.admin_email) {
      return json({ error: "code, name y admin_email son requeridos" }, 400);
    }
    if (!EMAIL_REGEX.test(body.admin_email)) {
      return json({ error: "admin_email no tiene formato de correo válido" }, 400);
    }
    if (body.contacto_facturacion_email && !EMAIL_REGEX.test(body.contacto_facturacion_email)) {
      return json({ error: "contacto_facturacion_email no tiene formato de correo válido" }, 400);
    }
    if (body.rfc && !RFC_REGEX.test(body.rfc)) {
      return json({ error: "RFC inválido — debe tener formato de persona física (13) o moral (12)" }, 400);
    }
    const moduloIds: string[] = Array.isArray(body.modulo_ids) ? body.modulo_ids : [];
    if (moduloIds.length === 0) {
      return json({ error: "Selecciona al menos un módulo" }, 400);
    }
    const { data: modulos, error: modulosErr } = await admin
      .from("catalogo_modulos")
      .select("id, stripe_price_id")
      .in("id", moduloIds)
      .eq("activo", true);
    if (modulosErr || !modulos?.length || modulos.some((m) => !m.stripe_price_id)) {
      return json({ error: "Módulos inválidos o sin stripe_price_id configurado" }, 400);
    }

    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const { data: clinic, error: clinicErr } = await admin
      .from("clinics")
      .insert({
        code: body.code,
        name: body.name,
        rfc: body.rfc ?? null,
        address: body.address ?? null,
        logo_url: body.logo_url ?? null,
        contacto_facturacion_email: body.contacto_facturacion_email ?? null,
        plan: body.plan ?? "estandar",
        status: "pendiente_verificacion",
        pending_admin_email: body.admin_email,
        pending_modulo_ids: moduloIds,
        verification_code: verificationCode,
        verification_code_expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (clinicErr || !clinic) {
      console.error("[create-tenant] error creando clinic:", clinicErr);
      return json({ error: clinicErr?.message ?? "error creando clínica" }, 500);
    }
    const clinicId = clinic.id as string;

    try {
      await sendVerificationEmail(body.contacto_facturacion_email ?? body.admin_email, body.name, verificationCode);
    } catch (emailErr) {
      console.error("[create-tenant] error mandando código, revirtiendo clinic:", emailErr);
      await admin.from("clinics").delete().eq("id", clinicId);
      return json({ error: (emailErr as Error).message }, 500);
    }

    return json({ clinic_id: clinicId, status: "pendiente_verificacion" });
  } catch (err) {
    console.error("[create-tenant] unexpected error:", err);
    return json({ error: (err as Error).message ?? "error inesperado" }, 500);
  }
});
