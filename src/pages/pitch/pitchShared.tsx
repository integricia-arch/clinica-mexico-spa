import { useState, useRef, useEffect } from "react";
import { useInView } from "motion/react";
import {
  MessageCircle, Calendar, Bell, Users,
  Receipt, Inbox as InboxIcon, ClipboardCheck, Bot, Clock,
  CheckCircle2, Sparkles,
  UserCheck,
  ShoppingCart, BarChart3, Package, FileText, CreditCard,
  Building2, AlertTriangle,
  Banknote, FlaskConical, X,
} from "lucide-react";

// ── CSS ───────────────────────────────────────────────────────────────────────
export const PITCH_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
.pr{font-family:'Inter',system-ui,sans-serif;background:#fff;color:#0f172a;overflow-x:hidden;-webkit-font-smoothing:antialiased;}
.pr-h{font-family:'Figtree',system-ui,sans-serif;}
@keyframes pr-ping{0%,100%{box-shadow:0 0 0 0 rgba(5,150,105,.35)}70%{box-shadow:0 0 0 8px rgba(5,150,105,0)}}
@keyframes pr-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes pr-pulse-teal{0%,100%{opacity:1}50%{opacity:.5}}
.pr-progress{position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,#0891b2,#059669);z-index:200;transform-origin:left;pointer-events:none;transition:width .1s linear;}
.pr-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;transition:transform 220ms cubic-bezier(0.23,1,0.32,1),box-shadow 220ms ease,border-color 220ms ease;}
@media (hover:hover) and (pointer:fine){
  .pr-card:hover{transform:translateY(-3px);box-shadow:0 12px 36px rgba(8,145,178,.11);border-color:#a5f3fc;}
  .pr-card-g:hover{box-shadow:0 12px 36px rgba(5,150,105,.10);border-color:#6ee7b7;}
}
.pr-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:100px;font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;}
.pr-badge-t{background:#cffafe;color:#0e7490;border:1px solid #a5f3fc;}
.pr-badge-g{background:#d1fae5;color:#047857;border:1px solid #6ee7b7;}
.pr-badge-r{background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;}
.pr-label{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#0891b2;}
.pr-label-g{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#059669;}
.pr-btn{padding:14px 28px;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;border:none;display:inline-flex;align-items:center;gap:8px;transition:transform 160ms cubic-bezier(0.23,1,0.32,1),background-color 160ms ease,box-shadow 160ms ease,color 160ms ease,border-color 160ms ease;text-decoration:none;letter-spacing:-.01em;line-height:1;}
.pr-btn-p{background:#0891b2;color:#fff;box-shadow:0 4px 14px rgba(8,145,178,.28);}
.pr-btn-g{background:#059669;color:#fff;box-shadow:0 4px 14px rgba(5,150,105,.28);}
.pr-btn-o{background:#fff;color:#334155;border:1.5px solid #cbd5e1;}
@media (hover:hover) and (pointer:fine){
  .pr-btn-p:hover{background:#0e7490;box-shadow:0 8px 24px rgba(8,145,178,.38);transform:translateY(-2px);}
  .pr-btn-g:hover{background:#047857;box-shadow:0 8px 24px rgba(5,150,105,.38);transform:translateY(-2px);}
  .pr-btn-o:hover{border-color:#0891b2;color:#0891b2;background:#f0fdff;}
}
.pr-btn:active{transform:scale(0.97);transition-duration:80ms;}
.pr-btn:focus-visible,.pr-card:focus-visible,.pr-mob-btn:focus-visible{outline:2px solid #0891B2;outline-offset:2px;}
a:focus-visible{outline:2px solid #0891B2;outline-offset:2px;border-radius:2px;}
.pr-icon-box{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;border:1px solid;transition:all .3s;}
.pr-featured{border:2px solid #0891b2;box-shadow:0 0 0 4px rgba(8,145,178,.08);}
.pr-table td,.pr-table th{padding:12px 16px;text-align:left;font-size:13px;}
.pr-table th{font-weight:700;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;border-bottom:1px solid #f1f5f9;}
.pr-table tr{border-bottom:1px solid #f8fafc;}
.pr-table tr:last-child{border-bottom:none;}
.pr-table tbody tr:hover{background:#f8fafc;}
@media(min-width:768px){
  .pr-nav-links{display:flex!important;}
  .pr-mob-btn{display:none!important;}
  .pr-hero-grid{grid-template-columns:1fr 1fr!important;}
  .pr-hero-card{display:block!important;}
  .pr-stats-grid{grid-template-columns:repeat(4,1fr)!important;}
  .pr-mod-grid{grid-template-columns:repeat(3,1fr)!important;}
  .pr-farm-grid{grid-template-columns:repeat(3,1fr)!important;}
  .pr-diff-grid{grid-template-columns:repeat(2,1fr)!important;}
  .pr-price-grid{grid-template-columns:repeat(3,1fr)!important;align-items:start;}
  .pr-flow-h{display:flex!important;}
  .pr-flow-v{display:none!important;}
  .pr-tech-grid{grid-template-columns:1fr 1fr!important;}
  .pr-testi-grid{grid-template-columns:repeat(3,1fr)!important;}
  .pr-roi-grid{grid-template-columns:1fr 1fr!important;}
  .pr-comp-scroll{overflow-x:visible!important;}
}
`;

// ── Scroll Progress ────────────────────────────────────────────────────────────
export function ScrollProgress() {
  const [w, setW] = useState(0);
  useEffect(() => {
    const cb = () => {
      const d = document.documentElement;
      setW((d.scrollTop / (d.scrollHeight - d.clientHeight)) * 100);
    };
    window.addEventListener("scroll", cb, { passive: true });
    return () => window.removeEventListener("scroll", cb);
  }, []);
  return <div className="pr-progress" style={{ width: `${w}%` }} />;
}

// ── AnimatedCounter ────────────────────────────────────────────────────────────
export function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let cur = 0;
    const steps = 60, ms = 1800;
    const inc = value / steps;
    const t = setInterval(() => {
      cur += inc;
      if (cur >= value) { setN(value); clearInterval(t); }
      else setN(Math.floor(cur));
    }, ms / steps);
    return () => clearInterval(t);
  }, [inView, value]);
  return <span ref={ref}>{n}{suffix}</span>;
}

// ── Constants ──────────────────────────────────────────────────────────────────
export const TEAL = "#0891B2";
export const GREEN = "#059669";
export const CICLO_360_DUR = 14 * 0.7; // 9.8s — esfera y resaltado de caja comparten esta duración, 30% más rápido que las 14s originales
export const SLATE = "#475569";

export const reveal = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.55, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export const navLinks = [
  { href: "#modulos", label: "Módulos" },
  { href: "#competencia", label: "vs. Competencia" },
  { href: "#roi", label: "ROI" },
  { href: "#precios", label: "Precios" },
];

export const stats = [
  { value: 70, suffix: "%", label: "Menos no-shows", sub: "recordatorios T-24h y T-2h automáticos", color: TEAL },
  { value: 310133, suffix: "", label: "Clínicas en MX", sub: "solo 18% tiene software real", color: GREEN },
  { value: 24, suffix: "/7", label: "El bot nunca duerme", sub: "agenda citas a las 2am sin secretaria", color: TEAL },
  { value: 9, suffix: " módulos", label: "Todo integrado", sub: "sin integraciones ni add-ons extra", color: GREEN },
];

export const modules = [
  { icon: Bot, title: "Bot IA (Claude Sonnet)", desc: "Agenda, cancela y reagenda citas en Telegram con lenguaje natural. Valida disponibilidad real. Escala a recepción cuando es necesario. Funciona a las 2am.", color: TEAL, hot: true },
  { icon: Bell, title: "Recordatorios automáticos", desc: "T-24h y T-2h por Telegram. Cola pg_cron con reintentos. Estado visible en dashboard. Sin WhatsApp personal de por medio.", color: GREEN, hot: false },
  { icon: Calendar, title: "Agenda multi-doctor", desc: "Vista semanal y diaria. Sin doble booking (constraint GIST en BD). Google Calendar sincronizado bidireccionalmente por cada médico.", color: TEAL, hot: false },
  { icon: Users, title: "Expediente clínico", desc: "Historia clínica digital, notas SOAP, recetas, consentimientos. Cumple NOM-004. Trazabilidad completa por usuario y fecha.", color: GREEN, hot: false },
  { icon: ShoppingCart, title: "Farmacia POS completa", desc: "Carrito con escáner, lotes FEFO, IVA proporcional. Surtir receta directo del expediente. Medicamentos controlados (COFEPRIS). Corte Z/X con conteo ciego.", color: TEAL, hot: false },
  { icon: Package, title: "Almacén y Compras", desc: "Órdenes de compra con flujo de aprobación. 3-Way Match anti-robo. Evaluación de proveedores. Auto-reorden inteligente. CxP con aging.", color: GREEN, hot: true },
  { icon: FileText, title: "CFDI 4.0 nativo", desc: "Timbrado, cancelación (4 motivos SAT), REP y Factura Global vía Facturama. CSD propio en Vault seguro. Sin contador intermediario.", color: TEAL, hot: true },
  { icon: CreditCard, title: "Pagos integrados (Stripe)", desc: "Card, OXXO, SPEI y Terminal física. 3.6% + $3 MXN IVA incluido. Payment intents server-side, webhook verificado, sin datos de tarjeta en tu BD.", color: GREEN, hot: false },
  { icon: BarChart3, title: "Business Intelligence", desc: "KPIs en tiempo real: ventas, citas, inventario, CxP, rotación ABC. 5 tabs de análisis. Alertas automáticas. Decisiones con datos, no instinto.", color: TEAL, hot: false },
  { icon: Building2, title: "Multi-clínica", desc: "Un login, N sedes. RLS por clínica en cada tabla. Roles por sede. Listo para franquicias y grupos médicos sin configuración adicional.", color: GREEN, hot: false },
  { icon: InboxIcon, title: "Inbox unificado", desc: "Todas las conversaciones Telegram en un panel tipo WhatsApp Web. Respuesta directa desde recepción. Realtime sin F5.", color: TEAL, hot: false },
  { icon: ClipboardCheck, title: "Auditoría completa", desc: "Log append-only de cada cambio: quién, qué, cuándo. Cumple NOM-004. Bitácora temperatura cadena frío. Control presupuestal por categoría.", color: GREEN, hot: false },
];

export const competitors = [
  { feature: "Bot IA en Telegram/WhatsApp", integrika: true, huli: "Add-on caro", miconsultorio: false, medesk: false },
  { feature: "Farmacia POS con FEFO", integrika: true, huli: false, miconsultorio: false, medesk: false },
  { feature: "CFDI 4.0 nativo", integrika: true, huli: false, miconsultorio: "Parcial", medesk: "Incompleto" },
  { feature: "3-Way Match anti-robo", integrika: true, huli: false, miconsultorio: false, medesk: false },
  { feature: "Google Calendar sync", integrika: true, huli: false, miconsultorio: false, medesk: "Parcial" },
  { feature: "BI Dashboard en tiempo real", integrika: true, huli: false, miconsultorio: false, medesk: "Básico" },
  { feature: "Multi-clínica / franquicias", integrika: true, huli: "Parcial", miconsultorio: false, medesk: true },
  { feature: "Pagos Stripe integrados", integrika: true, huli: false, miconsultorio: false, medesk: false },
  { feature: "Almacén y órdenes de compra", integrika: true, huli: false, miconsultorio: false, medesk: false },
  { feature: "Hecho 100% para México", integrika: true, huli: "Parcial", miconsultorio: true, medesk: "No" },
];

export const flow = [
  { step: "01", icon: MessageCircle, title: "Paciente escribe", desc: "En Telegram a cualquier hora. El bot lo identifica o registra.", color: TEAL },
  { step: "02", icon: Bot, title: "IA agenda la cita", desc: "Claude valida disponibilidad real en BD y confirma en segundos.", color: GREEN },
  { step: "03", icon: Bell, title: "Recordatorios creados", desc: "Cola T-24h y T-2h creada automáticamente.", color: TEAL },
  { step: "04", icon: Clock, title: "Cron despacha", desc: "pg_cron cada 5 min envía pendientes y reintenta fallidos.", color: GREEN },
  { step: "05", icon: UserCheck, title: "Escala si hace falta", desc: "Bot transfiere a recepción; responde desde el Inbox.", color: TEAL },
  { step: "06", icon: ClipboardCheck, title: "Todo auditado", desc: "Cada cambio queda con usuario y fecha. El bot ya está listo para el siguiente mensaje.", color: GREEN },
];

export const pricing = [
  {
    name: "Básico",
    price: "$999",
    period: "MXN / mes",
    desc: "Médico individual o consultorio pequeño",
    featured: false,
    cta: "Suscribirme",
    checkoutPlan: null as string | null,
    features: [
      "1 doctor",
      "Bot Telegram 24/7",
      "Agenda + recordatorios automáticos",
      "Expediente clínico básico",
      "Soporte por correo",
    ],
  },
  {
    name: "Esencial",
    price: "$2,499",
    period: "MXN / mes",
    desc: "Clínicas con 2-5 doctores",
    featured: false,
    cta: "Suscribirme",
    checkoutPlan: "esencial" as string | null,
    features: [
      "Hasta 5 doctores",
      "Todo del plan Básico",
      "Farmacia POS + corte de caja",
      "Expediente completo NOM-004",
      "Google Calendar sync",
      "Soporte prioritario",
    ],
  },
  {
    name: "Profesional",
    price: "$5,999",
    period: "MXN / mes",
    desc: "La opción más completa",
    featured: true,
    cta: "Suscribirme",
    checkoutPlan: "profesional" as string | null,
    features: [
      "Hasta 15 doctores",
      "Todo del plan Esencial",
      "CFDI 4.0 + Stripe pagos",
      "Almacén + 3-Way Match",
      "Business Intelligence",
      "Multi-clínica / franquicias",
      "Onboarding asistido",
    ],
  },
  {
    name: "Empresarial",
    price: "A medida",
    period: "",
    desc: "Grupos médicos y hospitales",
    featured: false,
    cta: "Hablemos",
    checkoutPlan: null as string | null,
    features: [
      "Doctores ilimitados",
      "Todo del Profesional",
      "SLA dedicado",
      "Capacitación in situ",
      "Integraciones personalizadas",
    ],
  },
];

export const escenarios = [
  {
    icon: Bell,
    title: "Menos citas perdidas",
    quote: "Una clínica que pierde 8-10 citas a la semana por no-shows puede bajar a 2 o menos con recordatorios automáticos y un bot que confirma de noche y en domingo.",
    base: "Basado en tasas de no-show reportadas del 22-35% en consultorios sin recordatorios.",
  },
  {
    icon: Receipt,
    title: "Facturación sin contador extra",
    quote: "RFC, CURP y CFDI 4.0 integrados desde el día uno: una clínica puede estar operando y timbrando en 48 horas, sin pagar aparte por cada factura.",
    base: "Basado en el flujo de onboarding y el módulo CFDI nativo de la plataforma.",
  },
  {
    icon: Banknote,
    title: "Caja bajo control",
    quote: "El corte de caja con conteo ciego está diseñado para detectar diferencias desde el primer mes — una sola diferencia de $3,200 encontrada a tiempo paga el sistema.",
    base: "Basado en el diseño de conteo ciego y 3-Way Match del módulo de caja y compras.",
  },
];

export const mockAppointments = [
  { initials: "LP", name: "Laura Pérez", time: "09:00", status: "Confirmada" },
  { initials: "CM", name: "Carlos Mora", time: "10:30", status: "Pendiente" },
  { initials: "SR", name: "Sofía Ríos", time: "11:00", status: "Confirmada" },
];

export async function startCheckout(plan: string, setLoading: (v: boolean) => void) {
  setLoading(true);
  try {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      },
    );
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error ?? `Error ${res.status}`);
    window.location.href = data.url;
  } catch (err) {
    setLoading(false);
    alert(`No se pudo iniciar la suscripción: ${(err as Error).message}\nEscríbenos a contacto@integrika.mx`);
  }
}

export function CellVal({ val }: { val: boolean | string }) {
  if (val === true) return <CheckCircle2 size={16} color={GREEN} />;
  if (val === false) return <X size={16} color="#cbd5e1" />;
  return <span style={{ fontSize: 12, color: "#d97706", fontWeight: 500 }}>{val}</span>;
}

export function PricingCard({ plan }: { plan: typeof pricing[0] }) {
  const [loading, setLoading] = useState(false);
  return (
    <div className={`pr-card ${plan.featured ? "pr-featured" : ""}`} style={{ padding: 28, height: "100%", display: "flex", flexDirection: "column" }}>
      {plan.featured && (
        <div style={{ marginBottom: 14 }}>
          <div className="pr-badge pr-badge-t"><Sparkles size={10} /> Más popular</div>
        </div>
      )}
      <div className="pr-h" style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 4, letterSpacing: "-0.02em" }}>{plan.name}</div>
      <div style={{ fontSize: 13, color: SLATE, marginBottom: 18 }}>{plan.desc}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 20 }}>
        <span className="pr-h" style={{ fontSize: 38, fontWeight: 800, color: plan.featured ? TEAL : "#0f172a", letterSpacing: "-0.04em" }}>{plan.price}</span>
        {plan.period && <span style={{ fontSize: 12, color: SLATE }}>{plan.period}</span>}
      </div>
      {plan.checkoutPlan ? (
        <button
          className={`pr-btn ${plan.featured ? "pr-btn-p" : "pr-btn-o"}`}
          style={{ width: "100%", justifyContent: "center", marginBottom: 20, opacity: loading ? 0.6 : 1 }}
          disabled={loading}
          onClick={() => startCheckout(plan.checkoutPlan!, setLoading)}
        >
          {loading ? "Redirigiendo…" : plan.cta}
        </button>
      ) : (
        <a href={plan.cta === "Hablemos" ? "mailto:contacto@integrika.mx?subject=Plan%20Empresarial%20IntegriKa" : "mailto:contacto@integrika.mx?subject=Plan%20Básico"} style={{ display: "block", marginBottom: 20 }}>
          <button className={`pr-btn ${plan.featured ? "pr-btn-p" : "pr-btn-o"}`} style={{ width: "100%", justifyContent: "center" }}>
            {plan.cta}
          </button>
        </a>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
        {plan.features.map((f) => (
          <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
            <CheckCircle2 size={14} color={plan.featured ? TEAL : GREEN} style={{ marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#475569" }}>{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard Mockup ───────────────────────────────────────────────────────────
export function DashboardMockup() {
  return (
    <div style={{ borderRadius: 18, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 24px 64px rgba(8,145,178,.14), 0 4px 16px rgba(0,0,0,.06)" }}>
      <div style={{ background: "#f8fafc", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", gap: 5 }}>
          {["#ff5f57","#febc2e","#28c840"].map((c) => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
        </div>
        <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace", marginLeft: 8 }}>integrika.mx · recepción</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 5, alignItems: "center" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, animation: "pr-pulse-teal 2s ease-in-out infinite" }} />
          <span style={{ fontSize: 10, color: GREEN, fontWeight: 600 }}>En vivo</span>
        </div>
      </div>
      <div style={{ background: "#fff", padding: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
          {[
            { label: "Citas hoy", value: "14", icon: Calendar, color: TEAL, bg: "#cffafe" },
            { label: "Ventas hoy", value: "$8,420", icon: Banknote, color: GREEN, bg: "#d1fae5" },
            { label: "Sin confirmar", value: "3", icon: AlertTriangle, color: "#d97706", bg: "#fef3c7" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} style={{ borderRadius: 10, background: bg, border: `1px solid ${color}30`, padding: "10px 12px" }}>
              <Icon size={13} color={color} style={{ marginBottom: 5 }} />
              <div className="pr-h" style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#64748b", marginBottom: 7 }}>Próximas citas</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {mockAppointments.map((a, idx) => {
            const color = idx % 2 === 0 ? TEAL : GREEN;
            return (
              <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 9, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: color + "20", border: `1px solid ${color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color, flexShrink: 0 }}>{a.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                  <div style={{ fontSize: 9, color: "#64748b" }}>{a.time}</div>
                </div>
                <div style={{ fontSize: 9, fontWeight: 600, color: a.status === "Confirmada" ? GREEN : "#d97706", background: a.status === "Confirmada" ? "#d1fae5" : "#fef3c7", padding: "2px 7px", borderRadius: 100, flexShrink: 0 }}>{a.status}</div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 12, padding: 10, borderRadius: 10, border: `1px solid ${TEAL}20`, background: "#f0fdff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: TEAL + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bot size={10} color={TEAL} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: TEAL }}>Bot IA</span>
            <span style={{ fontSize: 9, color: "#64748b", marginLeft: "auto" }}>ahora · Telegram</span>
          </div>
          <p style={{ fontSize: 10, color: "#475569", lineHeight: 1.5, margin: 0 }}>
            "Hola Laura, te recuerdo que mañana a las 9:00 tienes cita con el Dr. García. ¿Confirmas tu asistencia? 😊"
          </p>
        </div>
        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "#f0fdf4", border: `1px solid ${GREEN}20`, display: "flex", alignItems: "center", gap: 8 }}>
          <FlaskConical size={12} color={GREEN} />
          <span style={{ fontSize: 10, color: "#047857", fontWeight: 500 }}>Farmacia: 3 alertas de reorden · 1 lote por vencer</span>
        </div>
      </div>
    </div>
  );
}
