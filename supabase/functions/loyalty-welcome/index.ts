// loyalty-welcome/index.ts
// Edge Function que envía email de bienvenida via Resend cuando un miembro se registra.
// Body: { member_id, clinic_id }
// Retorna: { ok: true } si el email se envió, { ok: false, reason: string } si se saltó o falló

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isClinicAccessForbidden } from './clinic-access.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// Sanitiza HTML para evitar inyecciones
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

serve(async (req) => {
  if (req.method === 'GET') return new Response('OK', { status: 200 })

  try {
    const { member_id, clinic_id } = await req.json()
    if (!member_id || !clinic_id) {
      return new Response(
        JSON.stringify({ error: 'member_id y clinic_id requeridos' }),
        { status: 400 }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // El handler original no validaba ningun JWT propio (dependia solo del
    // gateway verify_jwt=true) ni cruzaba member_id/clinic_id contra la
    // membresia del caller -- cualquier usuario autenticado podia forzar
    // el reenvio del email de bienvenida a un miembro/clinica ajenos.
    const auth = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!auth) {
      return new Response(JSON.stringify({ error: 'no autorizado' }), { status: 401 })
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser(auth)
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'token invalido' }), { status: 401 })
    }
    const { data: memberships } = await supabase
      .from('clinic_memberships')
      .select('clinic_id')
      .eq('user_id', userData.user.id)
    if (isClinicAccessForbidden(memberships, clinic_id)) {
      return new Response(JSON.stringify({ error: 'permiso denegado' }), { status: 403 })
    }

    // Paralleliza queries de miembro y config
    const [{ data: member }, { data: cfg }] = await Promise.all([
      supabase
        .from('loyalty_members')
        .select('nombre,email,puntos_disponibles,codigo_barras,nivel')
        .eq('id', member_id)
        .single(),
      supabase
        .from('loyalty_config')
        .select('nombre_programa,slug_farmacia,color_primario,valor_punto_mxn,pesos_por_punto')
        .eq('clinic_id', clinic_id)
        .single(),
    ])

    if (!member?.email || !cfg) {
      return new Response(JSON.stringify({ ok: false, reason: 'sin_email_o_config' }), {
        status: 200,
      })
    }

    const pwaUrl = `https://loyalty.integrika.mx/${cfg.slug_farmacia}`
    const nombreSanitizado = escapeHtml(member.nombre ?? '')
    const programaSanitizado = escapeHtml(cfg.nombre_programa ?? '')
    const codigoBarrasSanitizado = escapeHtml(member.codigo_barras ?? '')

    const html = `
<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
  <div style="background:${cfg.color_primario};color:white;border-radius:12px;padding:24px;text-align:center">
    <h1 style="margin:0;font-size:24px">¡Bienvenido al ${programaSanitizado}!</h1>
  </div>
  <div style="padding:24px">
    <p>Hola <strong>${nombreSanitizado}</strong>,</p>
    <p>Ya eres miembro de <strong>${programaSanitizado}</strong>. Cada $${cfg.pesos_por_punto} MXN que gastes acumulas puntos canjeables por descuentos.</p>
    <p><strong>Tu código:</strong> <code style="font-size:18px;letter-spacing:2px">${codigoBarrasSanitizado}</code></p>
    <p>Muéstralo en caja para acumular puntos en cada compra.</p>
    <a href="${pwaUrl}" style="display:inline-block;margin-top:16px;background:${cfg.color_primario};color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
      Ver mi Monedero online
    </a>
    <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
    <p style="font-size:12px;color:#888">
      Recibiste este correo porque te registraste en ${programaSanitizado}.<br>
      <a href="${pwaUrl}/cuenta" style="color:#888">Cancelar suscripción a comunicaciones</a>
    </p>
  </div>
</body></html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${cfg.nombre_programa} <noreply@integrika.mx>`,
        to: [member.email],
        subject: `¡Bienvenido al ${cfg.nombre_programa}!`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[loyalty-welcome] Resend error:', err)
      return new Response(JSON.stringify({ ok: false, error: err }), { status: 200 })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (e) {
    console.error('[loyalty-welcome] error:', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
