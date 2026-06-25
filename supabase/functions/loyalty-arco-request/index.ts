// loyalty-arco-request/index.ts
// Recibe solicitudes ARCO desde la PWA y las reenvía por email via Resend.
// verify_jwt = true — el usuario está autenticado (login OTP en PWA).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const ARCO_RECIPIENT = 'integric.ia@gmail.com'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body: { nombre?: string; identificador?: string; tipo?: string; descripcion?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { nombre, identificador, tipo, descripcion } = body

  if (!nombre || !identificador || !tipo || !descripcion) {
    return new Response(JSON.stringify({ error: 'campos_requeridos' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const tipoLabel: Record<string, string> = {
    acceso: 'Acceso',
    rectificacion: 'Rectificación',
    cancelacion: 'Cancelación',
    oposicion: 'Oposición',
  }

  const html = `
    <h2>Solicitud de Derechos ARCO — Programa de Lealtad</h2>
    <table>
      <tr><th align="left">Nombre</th><td>${escapeHtml(nombre)}</td></tr>
      <tr><th align="left">Identificador</th><td>${escapeHtml(identificador)}</td></tr>
      <tr><th align="left">Tipo de derecho</th><td>${escapeHtml(tipoLabel[tipo] ?? tipo)}</td></tr>
      <tr><th align="left">Descripción</th><td>${escapeHtml(descripcion)}</td></tr>
    </table>
    <p><em>Responder en máximo 20 días hábiles (LFPDPPP Art. 24).</em></p>
  `

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Lealtad Integrika <no-reply@integrika.mx>',
      to: [ARCO_RECIPIENT],
      subject: `Solicitud ARCO: ${tipoLabel[tipo] ?? tipo} — ${nombre}`,
      html,
    }),
  })

  if (!resendRes.ok) {
    console.error('[loyalty-arco-request] Resend error', resendRes.status)
    return new Response(JSON.stringify({ error: 'email_failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
