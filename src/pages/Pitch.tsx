import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "motion/react";
import Logo from "@/components/Logo";
import {
  MessageCircle, Calendar, Bell, Shield, Users, Stethoscope,
  Pill, Receipt, Inbox as InboxIcon, ClipboardCheck, Bot, Clock,
  CheckCircle2, ArrowRight, Sparkles, Lock, Activity, Zap,
  TrendingUp, Database, Menu, X, UserCheck, Star,
  ShoppingCart, BarChart3, Package, FileText, CreditCard,
  Building2, ScanLine, AlertTriangle, ChevronDown, ChevronUp,
  Banknote, Globe, FlaskConical,
} from "lucide-react";

// ── CSS ───────────────────────────────────────────────────────────────────────
const PITCH_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
.pr{font-family:'Inter',system-ui,sans-serif;background:#fff;color:#0f172a;overflow-x:hidden;-webkit-font-smoothing:antialiased;}
.pr-h{font-family:'Figtree',system-ui,sans-serif;}
@keyframes pr-ping{0%,100%{box-shadow:0 0 0 0 rgba(5,150,105,.35)}70%{box-shadow:0 0 0 8px rgba(5,150,105,0)}}
@keyframes pr-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes pr-pulse-teal{0%,100%{opacity:1}50%{opacity:.5}}
.pr-progress{position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,#0891b2,#059669);z-index:200;transform-origin:left;pointer-events:none;transition:width .1s linear;}
.pr-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease;}
.pr-card:hover{transform:translateY(-3px);box-shadow:0 12px 36px rgba(8,145,178,.11);border-color:#a5f3fc;}
.pr-card-g:hover{box-shadow:0 12px 36px rgba(5,150,105,.10);border-color:#6ee7b7;}
.pr-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:100px;font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;}
.pr-badge-t{background:#cffafe;color:#0e7490;border:1px solid #a5f3fc;}
.pr-badge-g{background:#d1fae5;color:#047857;border:1px solid #6ee7b7;}
.pr-badge-r{background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;}
.pr-label{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#0891b2;}
.pr-label-g{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#059669;}
.pr-btn{padding:14px 28px;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;border:none;display:inline-flex;align-items:center;gap:8px;transition:all .2s;text-decoration:none;letter-spacing:-.01em;line-height:1;}
.pr-btn-p{background:#0891b2;color:#fff;box-shadow:0 4px 14px rgba(8,145,178,.28);}
.pr-btn-p:hover{background:#0e7490;box-shadow:0 8px 24px rgba(8,145,178,.38);transform:translateY(-2px);}
.pr-btn-g{background:#059669;color:#fff;box-shadow:0 4px 14px rgba(5,150,105,.28);}
.pr-btn-g:hover{background:#047857;box-shadow:0 8px 24px rgba(5,150,105,.38);transform:translateY(-2px);}
.pr-btn-o{background:#fff;color:#334155;border:1.5px solid #cbd5e1;}
.pr-btn-o:hover{border-color:#0891b2;color:#0891b2;background:#f0fdff;}
.pr-icon-box{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;border:1px solid;transition:all .3s;}
.pr-featured{border:2px solid #0891b2;box-shadow:0 0 0 4px rgba(8,145,178,.08);}
.pr-table td,.pr-table th{padding:12px 16px;text-align:left;font-size:13px;}
.pr-table th{font-weight:700;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;border-bottom:1px solid #f1f5f9;}
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
function ScrollProgress() {
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
function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
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
const TEAL = "#0891B2";
const GREEN = "#059669";
const SLATE = "#475569";

const reveal = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.55, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const navLinks = [
  { href: "#modulos", label: "Módulos" },
  { href: "#competencia", label: "vs. Competencia" },
  { href: "#roi", label: "ROI" },
  { href: "#precios", label: "Precios" },
];

const stats = [
  { value: 70, suffix: "%", label: "Menos no-shows", sub: "recordatorios T-24h y T-2h automáticos", color: TEAL },
  { value: 310133, suffix: "", label: "Clínicas en MX", sub: "solo 18% tiene software real", color: GREEN },
  { value: 24, suffix: "/7", label: "El bot nunca duerme", sub: "agenda citas a las 2am sin secretaria", color: TEAL },
  { value: 9, suffix: " módulos", label: "Todo integrado", sub: "sin integraciones ni add-ons extra", color: GREEN },
];

const modules = [
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

const competitors = [
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


const flow = [
  { step: "01", icon: MessageCircle, title: "Paciente escribe", desc: "En Telegram a cualquier hora. El bot lo identifica o registra.", color: TEAL },
  { step: "02", icon: Bot, title: "IA agenda la cita", desc: "Claude valida disponibilidad real en BD y confirma en segundos.", color: GREEN },
  { step: "03", icon: Bell, title: "Recordatorios creados", desc: "Cola T-24h y T-2h creada automáticamente.", color: TEAL },
  { step: "04", icon: Clock, title: "Cron despacha", desc: "pg_cron cada 5 min envía pendientes y reintenta fallidos.", color: GREEN },
  { step: "05", icon: UserCheck, title: "Escala si hace falta", desc: "Bot transfiere a recepción; responde desde el Inbox.", color: TEAL },
  { step: "06", icon: ClipboardCheck, title: "Todo auditado", desc: "Cada cambio registrado con usuario y timestamp.", color: GREEN },
];

const pricing = [
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

const testimonials = [
  {
    name: "Dra. María Rodríguez",
    role: "Directora Médica · Guadalajara",
    quote: "Antes perdíamos 8-10 citas a la semana por no-shows. Con los recordatorios automáticos bajamos a menos de 2. El bot funciona de noche y los domingos, eso no tiene precio.",
    photo: "https://images.unsplash.com/photo-1638202993928-7267aad84c31?q=80&w=100&auto=format&fit=crop&crop=face",
  },
  {
    name: "Dr. Jorge Mendoza",
    role: "Médico General · CDMX",
    quote: "Lo que más me sorprendió fue que entiende RFC, CURP y CFDI desde el día uno. En 48 horas estábamos operando y el contador ya no nos cobra extra por facturar.",
    photo: "https://images.unsplash.com/photo-1530497610245-94d3c16cda28?q=80&w=100&auto=format&fit=crop&crop=face",
  },
  {
    name: "Lic. Ana Lozano",
    role: "Administradora · Monterrey",
    quote: "El corte de caja con conteo ciego detectó una diferencia de $3,200 el primer mes. El sistema se pagó solo. El módulo de compras con 3-Way Match es extraordinario.",
    photo: "https://images.unsplash.com/photo-1511174511562-5f7f18b874f8?q=80&w=100&auto=format&fit=crop&crop=face",
  },
];

const mockAppointments = [
  { initials: "LP", name: "Laura Pérez", time: "09:00", status: "Confirmada" },
  { initials: "CM", name: "Carlos Mora", time: "10:30", status: "Pendiente" },
  { initials: "SR", name: "Sofía Ríos", time: "11:00", status: "Confirmada" },
];

async function startCheckout(plan: string, setLoading: (v: boolean) => void) {
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

function CellVal({ val }: { val: boolean | string }) {
  if (val === true) return <CheckCircle2 size={16} color={GREEN} />;
  if (val === false) return <X size={16} color="#cbd5e1" />;
  return <span style={{ fontSize: 12, color: "#d97706", fontWeight: 500 }}>{val}</span>;
}

function PricingCard({ plan }: { plan: typeof pricing[0] }) {
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
function DashboardMockup() {
  return (
    <div style={{ borderRadius: 18, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 24px 64px rgba(8,145,178,.14), 0 4px 16px rgba(0,0,0,.06)" }}>
      <div style={{ background: "#f8fafc", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", gap: 5 }}>
          {["#ff5f57","#febc2e","#28c840"].map((c) => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
        </div>
        <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", marginLeft: 8 }}>integrika.mx · recepción</span>
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
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 7 }}>Próximas citas</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {mockAppointments.map((a, idx) => {
            const color = idx % 2 === 0 ? TEAL : GREEN;
            return (
              <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 9, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: color + "20", border: `1px solid ${color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color, flexShrink: 0 }}>{a.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                  <div style={{ fontSize: 9, color: "#94a3b8" }}>{a.time}</div>
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
            <span style={{ fontSize: 9, color: "#94a3b8", marginLeft: "auto" }}>ahora · Telegram</span>
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

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Pitch() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  // ── ROI calculator state ───────────────────────────────────────────────────
  const [ticketPromedio, setTicketPromedio] = useState(800);
  const [noShowsPorSemana, setNoShowsPorSemana] = useState(1);
  const [inventarioFarmacia, setInventarioFarmacia] = useState(80000);
  const [citasRecuperadas, setCitasRecuperadas] = useState(3);
  const [salarioSecretaria, setSalarioSecretaria] = useState(7500);
  const [planSeleccionado, setPlanSeleccionado] = useState(2499);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

  const noShowSavings = ticketPromedio * noShowsPorSemana * 4;
  const farmaciaSavings = inventarioFarmacia * 0.04;
  const secretariaSavings = salarioSecretaria - planSeleccionado;
  const citasFueraHorario = citasRecuperadas * ticketPromedio * 4;
  const totalROI = noShowSavings + farmaciaSavings + secretariaSavings + citasFueraHorario;
  const planName = planSeleccionado === 2499 ? "Esencial" : "Profesional";

  const whatsappRoiHref = `https://wa.me/5213324508776?text=${encodeURIComponent(
    `Hola, calculé un ROI de ${formatCurrency(totalROI)} MXN/mes con IntegriKa, quiero más info`,
  )}`;


  const faqs = [
    { q: "¿Cuánto tiempo tarda el onboarding?", a: "48 horas para la configuración básica. El plan Profesional incluye onboarding asistido con capacitación a tu equipo. La mayoría de las clínicas están operando en menos de una semana." },
    { q: "¿Mis datos están seguros en México?", a: "Sí. Usamos Supabase con servidores en la región de Norteamérica. Row-Level Security en cada tabla, backups automáticos diarios, y Cloudflare WAF con modo de reto para IPs fuera de México. Tus datos nunca salen de tu instancia." },
    { q: "¿Funciona con mi PAC actual para CFDI?", a: "Usamos Facturama como PAC certificado por el SAT. Si ya tienes otro PAC, podemos evaluarlo. La migración de CSD (certificado de sello digital) se hace de forma segura via Vault cifrado." },
    { q: "¿El bot de Telegram reemplaza a mi recepcionista?", a: "Complementa. El bot maneja el 80% de las consultas rutinarias (agendar, cancelar, confirmar, preguntas frecuentes). Tu recepcionista atiende lo que requiere criterio humano. El resultado: menos carga, más capacidad." },
    { q: "¿Qué pasa si el sistema falla?", a: "Monitoreo 24/7 con BetterStack. Uptime histórico >99.8%. Las Edge Functions de Deno tienen auto-restart. En caso de incidente, el equipo recibe alerta automática en menos de 2 minutos." },
  ];

  return (
    <div className="pr">
      <style>{PITCH_STYLES}</style>
      <ScrollProgress />

      {/* NAV */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,0.96)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid #e2e8f0",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Logo size="sm" />
            <span className="pr-h" style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.03em", color: "#0f172a" }}>IntegriKa</span>
            <span style={{ fontSize: 10, color: "#94a3b8", paddingLeft: 4, borderLeft: "1px solid #e2e8f0", marginLeft: 2, display: "none" }} className="pr-nav-links">Sistema Operativo de Clínica</span>
          </div>
          <nav className="pr-nav-links" style={{ display: "none", gap: 28 }}>
            {navLinks.map((l) => (
              <a key={l.href} href={l.href}
                style={{ color: "#64748b", textDecoration: "none", fontSize: 14, fontWeight: 500, transition: "color .2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = TEAL)}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
              >{l.label}</a>
            ))}
          </nav>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a href="mailto:contacto@integrika.mx?subject=Demo%20IntegriKa">
              <button className="pr-btn pr-btn-p" style={{ padding: "10px 20px", fontSize: 13 }}>Pedir demo <ArrowRight size={13} /></button>
            </a>
            <button className="pr-mob-btn"
              style={{ background: "transparent", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: "#0f172a" }}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div style={{ borderTop: "1px solid #e2e8f0", background: "#fff", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} style={{ color: "#475569", textDecoration: "none", fontSize: 15, fontWeight: 500 }} onClick={() => setMobileOpen(false)}>{l.label}</a>
            ))}
          </div>
        )}
      </header>

      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden", paddingTop: 80, paddingBottom: 96, background: "linear-gradient(170deg,#f0fdff 0%,#f8fafc 60%,#fff 100%)" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, #bae6fd 1px, transparent 1px)", backgroundSize: "36px 36px", opacity: 0.25, pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div className="pr-hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 56, alignItems: "center" }}>

            {/* Left copy */}
            <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
              <div className="pr-badge pr-badge-t" style={{ marginBottom: 22 }}>
                <Sparkles size={11} /> Sistema Operativo de Clínica · México
              </div>
              <h1 className="pr-h" style={{ fontSize: "clamp(36px,5vw,62px)", fontWeight: 900, lineHeight: 1.04, letterSpacing: "-0.05em", marginBottom: 22, color: "#0f172a" }}>
                Tu clínica operando{" "}
                <span style={{ color: TEAL }}>sola.</span>{" "}
                Por menos que una secretaria.
              </h1>
              <p style={{ fontSize: 17, color: SLATE, lineHeight: 1.75, marginBottom: 14, maxWidth: 520 }}>
                Bot IA que agenda a las 2am. Farmacia con control total. CFDI en 3 clics. Business Intelligence en tiempo real.{" "}
                <strong style={{ color: "#0f172a" }}>9 módulos, un solo precio.</strong>
              </p>
              <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 32, maxWidth: 440 }}>
                Desde <strong style={{ color: TEAL }}>$2,499 MXN/mes</strong> — menos que el sueldo de una secretaria en CDMX.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 32 }}>
                <a href="mailto:contacto@integrika.mx?subject=Demo%20IntegriKa">
                  <button className="pr-btn pr-btn-p" style={{ fontSize: 15, padding: "15px 28px" }}>Ver demo en vivo <ArrowRight size={16} /></button>
                </a>
                <Link to="/">
                  <button className="pr-btn pr-btn-o">Abrir dashboard</button>
                </Link>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontSize: 13, color: "#64748b" }}>
                {["Sin instalación", "Onboarding en 48 h", "Cancela cuando quieras", "CFDI incluido"].map((t) => (
                  <div key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <CheckCircle2 size={14} color={GREEN} />{t}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right mockup */}
            <motion.div className="pr-hero-card" style={{ display: "none" }}
              initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.85, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <DashboardMockup />
            </motion.div>
          </div>

          {/* Stats */}
          <div className="pr-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, marginTop: 72 }}>
            {stats.map((s, i) => (
              <motion.div key={s.label} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} custom={i}>
                <div className="pr-card" style={{ padding: 22, borderRadius: 16 }}>
                  <div className="pr-h" style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.04em", color: s.color, lineHeight: 1, marginBottom: 5 }}>
                    <AnimatedCounter value={s.value} suffix={s.suffix} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a", marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>{s.sub}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section style={{ padding: "96px 0", borderTop: "1px solid #f1f5f9" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div className="pr-tech-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 56, alignItems: "center" }}>
            <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <div className="pr-label" style={{ marginBottom: 16 }}>El problema</div>
              <h2 className="pr-h" style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.08, marginBottom: 20, color: "#0f172a" }}>
                La clínica que funciona sola no existe todavía. Hasta hoy.
              </h2>
              <p style={{ color: SLATE, lineHeight: 1.75, marginBottom: 14 }}>
                Las 310,000+ clínicas privadas en México operan con{" "}
                <span style={{ color: "#dc2626", fontWeight: 600 }}>WhatsApp, papel y Excel</span>.
                Las soluciones extranjeras no entienden RFC, CURP, CFDI ni el flujo mexicano.
                Las locales se quedan cortas en tecnología.
              </p>
              <p style={{ color: SLATE, lineHeight: 1.75 }}>
                Resultado: recepcionistas saturadas, citas perdidas, farmacia sin control, facturas manuales y cero visibilidad del negocio.
              </p>
            </motion.div>
            <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1}>
              <div style={{ borderRadius: 16, border: "1px solid #fecaca", background: "#fff5f5", padding: 28 }}>
                {[
                  { txt: "Paciente llama a las 9pm — nadie contesta, cita perdida", cost: "−$800 MXN" },
                  { txt: "No-show sin recordatorio: 22–35% de citas no se presentan", cost: "−$3,200/mes" },
                  { txt: "Robo hormiga en farmacia sin trazabilidad de inventario", cost: "−$3,200/mes" },
                  { txt: "Sin CFDI: empresa no puede deducir, prefiere otra clínica", cost: "−Clientes" },
                  { txt: "Diferencia de caja no detectada hasta el mes siguiente", cost: "−$1,800/sem" },
                  { txt: "3 sistemas distintos, ninguno habla con los demás", cost: "−Productividad" },
                ].map(({ txt, cost }, i) => (
                  <motion.div key={txt} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                    style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: i < 5 ? 14 : 0, justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1 }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#f87171", marginTop: 7, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{txt}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", background: "#fee2e2", padding: "2px 8px", borderRadius: 100, flexShrink: 0, whiteSpace: "nowrap" }}>{cost}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* MÓDULOS */}
      <section id="modulos" style={{ padding: "96px 0", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 52px" }}>
            <div className="pr-label" style={{ marginBottom: 14 }}>12 módulos</div>
            <h2 className="pr-h" style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.08, marginBottom: 14, color: "#0f172a" }}>
              El único sistema que lo tiene todo — de verdad.
            </h2>
            <p style={{ color: SLATE, fontSize: 16 }}>Sin integraciones, sin add-ons, sin sorpresas en la factura.</p>
          </motion.div>
          <div className="pr-mod-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
            {modules.map((m, i) => (
              <motion.div key={m.title} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} custom={i}>
                <div className={`pr-card ${m.color === GREEN ? "pr-card-g" : ""}`} style={{ padding: 22, height: "100%", position: "relative" }}>
                  {m.hot && (
                    <div style={{ position: "absolute", top: 14, right: 14 }}>
                      <span className="pr-badge pr-badge-t" style={{ fontSize: 9, padding: "2px 8px" }}>Nuevo</span>
                    </div>
                  )}
                  <div className="pr-icon-box" style={{ color: m.color, background: m.color + "14", borderColor: m.color + "28", marginBottom: 14 }}>
                    <m.icon size={20} />
                  </div>
                  <h3 className="pr-h" style={{ fontWeight: 700, fontSize: 15, marginBottom: 7, color: "#0f172a", letterSpacing: "-0.02em" }}>{m.title}</h3>
                  <p style={{ fontSize: 13, color: SLATE, lineHeight: 1.65 }}>{m.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPETENCIA */}
      <section id="competencia" style={{ padding: "96px 0", background: "#fff", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ maxWidth: 640, marginBottom: 48 }}>
            <div className="pr-label" style={{ marginBottom: 14 }}>vs. Competencia</div>
            <h2 className="pr-h" style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.08, marginBottom: 14, color: "#0f172a" }}>
              Nadie más tiene el stack completo.
            </h2>
            <p style={{ color: SLATE }}>Huli, Mi-Consultorio y Medesk son soluciones parciales. IntegriKa es el único que integra bot IA, farmacia FEFO, CFDI nativo y BI en un solo precio.</p>
          </motion.div>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} className="pr-comp-scroll" style={{ overflowX: "auto" }}>
            <div style={{ borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", minWidth: 640 }}>
              <table className="pr-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "#f8fafc" }}>
                  <tr>
                    <th style={{ textAlign: "left" }}>Feature</th>
                    <th style={{ textAlign: "center", color: TEAL }}>IntegriKa</th>
                    <th style={{ textAlign: "center" }}>Huli</th>
                    <th style={{ textAlign: "center" }}>Mi-Consultorio</th>
                    <th style={{ textAlign: "center" }}>Medesk</th>
                  </tr>
                </thead>
                <tbody>
                  {competitors.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ fontWeight: 500, color: "#0f172a", fontSize: 13 }}>{row.feature}</td>
                      <td style={{ textAlign: "center" }}><CellVal val={row.integrika} /></td>
                      <td style={{ textAlign: "center" }}><CellVal val={row.huli} /></td>
                      <td style={{ textAlign: "center" }}><CellVal val={row.miconsultorio} /></td>
                      <td style={{ textAlign: "center" }}><CellVal val={row.medesk} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: "14px 16px", background: "#f0fdff", borderTop: "1px solid #e2e8f0", display: "flex", gap: 20, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={13} color={GREEN} /><span style={{ fontSize: 12, color: "#64748b" }}>Incluido</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><X size={13} color="#cbd5e1" /><span style={{ fontSize: 12, color: "#64748b" }}>No disponible</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 12, color: "#d97706", fontWeight: 600 }}>Parcial/Add-on</span><span style={{ fontSize: 12, color: "#64748b" }}>= costo adicional o funcionalidad limitada</span></div>
              </div>
            </div>
          </motion.div>

          {/* Precio vs stack */}
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ marginTop: 40 }}>
            <div style={{ borderRadius: 16, background: "linear-gradient(135deg,#f0fdff,#f0fdf4)", border: "1px solid #a5f3fc", padding: 28 }}>
              <div className="pr-h" style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>IntegriKa Esencial ($2,499/mes) vs. el stack equivalente</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                {[
                  { label: "Agenda + EHR (Huli)", price: "$590" },
                  { label: "Bot WhatsApp add-on", price: "$240" },
                  { label: "CFDI / contador", price: "$350" },
                  { label: "Farmacia POS FEFO", price: "$500" },
                  { label: "BI Dashboard", price: "$400" },
                  { label: "Recordatorios SMS", price: "$200" },
                ].map(({ label, price }) => (
                  <div key={label} style={{ padding: "8px 14px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0", fontSize: 13 }}>
                    <span style={{ color: "#475569" }}>{label} </span>
                    <span style={{ fontWeight: 700, color: "#dc2626" }}>{price}</span>
                  </div>
                ))}
                <div style={{ padding: "8px 14px", borderRadius: 10, background: "#fee2e2", border: "1px solid #fca5a5", fontSize: 13, fontWeight: 700, color: "#dc2626" }}>
                  Total: $2,280–$2,630/mes
                </div>
              </div>
              <div style={{ padding: "12px 18px", borderRadius: 12, background: "#059669", color: "#fff", display: "inline-flex", gap: 10, alignItems: "center" }}>
                <CheckCircle2 size={16} color="#fff" />
                <span style={{ fontWeight: 700, fontSize: 14 }}>IntegriKa Esencial: $2,499/mes · Todo incluido · Sin integraciones</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ROI */}
      <section id="roi" style={{ padding: "96px 0", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 52px" }}>
            <div className="pr-label" style={{ marginBottom: 14 }}>Retorno de inversión</div>
            <h2 className="pr-h" style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.08, marginBottom: 14, color: "#0f172a" }}>
              El plan se paga solo con los no-shows que evitas.
            </h2>
            <p style={{ color: SLATE }}>Ajusta los valores de tu clínica y calcula tu ROI en vivo.</p>
          </motion.div>
          <div className="pr-roi-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
            <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <div className="pr-card" style={{ padding: 24, height: "100%" }}>
                <h3 className="pr-h" style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "#0f172a" }}>Ajusta los valores de tu clínica</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6, display: "block" }}>Ticket promedio por consulta</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <input type="range" min={200} max={3000} step={50} value={ticketPromedio} onChange={(e) => setTicketPromedio(Number(e.target.value))} style={{ flex: 1, accentColor: TEAL }} />
                      <input type="number" min={0} step={50} value={ticketPromedio} onChange={(e) => setTicketPromedio(Number(e.target.value))} style={{ width: 100, padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, color: "#0f172a", textAlign: "right" }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6, display: "block" }}>No-shows evitados por semana</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <input type="range" min={0} max={20} step={1} value={noShowsPorSemana} onChange={(e) => setNoShowsPorSemana(Number(e.target.value))} style={{ flex: 1, accentColor: TEAL }} />
                      <input type="number" min={0} step={1} value={noShowsPorSemana} onChange={(e) => setNoShowsPorSemana(Number(e.target.value))} style={{ width: 100, padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, color: "#0f172a", textAlign: "right" }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6, display: "block" }}>Valor de inventario de farmacia</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <input type="range" min={0} max={500000} step={1000} value={inventarioFarmacia} onChange={(e) => setInventarioFarmacia(Number(e.target.value))} style={{ flex: 1, accentColor: TEAL }} />
                      <input type="number" min={0} step={1000} value={inventarioFarmacia} onChange={(e) => setInventarioFarmacia(Number(e.target.value))} style={{ width: 100, padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, color: "#0f172a", textAlign: "right" }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6, display: "block" }}>Citas recuperadas fuera de horario / semana</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <input type="range" min={0} max={20} step={1} value={citasRecuperadas} onChange={(e) => setCitasRecuperadas(Number(e.target.value))} style={{ flex: 1, accentColor: TEAL }} />
                      <input type="number" min={0} step={1} value={citasRecuperadas} onChange={(e) => setCitasRecuperadas(Number(e.target.value))} style={{ width: 100, padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, color: "#0f172a", textAlign: "right" }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6, display: "block" }}>Salario mensual de secretaria que se ahorra</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <input type="range" min={0} max={30000} step={500} value={salarioSecretaria} onChange={(e) => setSalarioSecretaria(Number(e.target.value))} style={{ flex: 1, accentColor: TEAL }} />
                      <input type="number" min={0} step={500} value={salarioSecretaria} onChange={(e) => setSalarioSecretaria(Number(e.target.value))} style={{ width: 100, padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, color: "#0f172a", textAlign: "right" }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6, display: "block" }}>Plan a comparar</label>
                    <select value={planSeleccionado} onChange={(e) => setPlanSeleccionado(Number(e.target.value))} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, color: "#0f172a", background: "#fff" }}>
                      <option value={2499}>Esencial — $2,499 MXN/mes</option>
                      <option value={5999}>Profesional — $5,999 MXN/mes</option>
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
              {[
                { label: "No-shows evitados / mes", calc: `${noShowsPorSemana} × ${formatCurrency(ticketPromedio)} × 4 semanas`, value: formatCurrency(noShowSavings), color: GREEN },
                { label: "Reducción robo hormiga farmacia", calc: `4% de ${formatCurrency(inventarioFarmacia)}`, value: formatCurrency(farmaciaSavings), color: TEAL },
                { label: "Ahorro vs secretaria extra", calc: `${formatCurrency(salarioSecretaria)} − ${formatCurrency(planSeleccionado)} plan ${planName}`, value: formatCurrency(secretariaSavings), color: GREEN },
                { label: "Recuperación de citas fuera horario", calc: `${citasRecuperadas} citas × ${formatCurrency(ticketPromedio)} × 4 semanas`, value: formatCurrency(citasFueraHorario), color: TEAL },
              ].map((item, i) => (
                <motion.div key={item.label} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}>
                  <div className="pr-card" style={{ padding: 24, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: "#0f172a", marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: SLATE }}>{item.calc}</div>
                    </div>
                    <div className="pr-h" style={{ fontSize: 28, fontWeight: 800, color: item.color, flexShrink: 0, letterSpacing: "-0.03em" }}>{item.value}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ marginTop: 24 }}>
            <div style={{ borderRadius: 16, background: TEAL, padding: "24px 28px", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.7)", marginBottom: 4 }}>ROI neto estimado vs. Plan {planName} ({formatCurrency(planSeleccionado)}/mes)</div>
                <div className="pr-h" style={{ fontSize: 32, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>+{formatCurrency(totalROI)} / mes</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.7)", marginTop: 4 }}>Solo con no-shows + farmacia + vs. secretaria extra</div>
              </div>
              <a href={whatsappRoiHref} target="_blank" rel="noopener noreferrer">
                <button className="pr-btn" style={{ background: "#fff", color: TEAL, fontWeight: 700, padding: "14px 24px" }}>
                  Hablar por WhatsApp sobre mi ROI <ArrowRight size={16} />
                </button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>


      {/* CÓMO FUNCIONA */}
      <section id="flujo" style={{ padding: "96px 0", background: "#fff", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 52px" }}>
            <div className="pr-label" style={{ marginBottom: 14 }}>Cómo funciona</div>
            <h2 className="pr-h" style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.08, color: "#0f172a" }}>
              Del primer mensaje de Telegram a la cita confirmada — sin tocar nada.
            </h2>
          </motion.div>
          <div className="pr-flow-h" style={{ display: "none", gap: 8, alignItems: "stretch" }}>
            {flow.map((s, i) => (
              <div key={s.step} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} style={{ flex: 1 }}>
                  <div className="pr-card" style={{ padding: 20, position: "relative", overflow: "hidden", height: "100%", borderColor: s.color + "22" }}>
                    <div className="pr-h" style={{ position: "absolute", top: -4, right: 12, fontSize: 52, fontWeight: 900, color: s.color, opacity: 0.07 }}>{s.step}</div>
                    <div className="pr-icon-box" style={{ color: s.color, background: s.color + "14", borderColor: s.color + "28", marginBottom: 10 }}><s.icon size={18} /></div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: s.color, marginBottom: 5 }}>PASO {s.step}</div>
                    <h3 className="pr-h" style={{ fontWeight: 700, fontSize: 13, marginBottom: 5, color: "#0f172a", lineHeight: 1.3 }}>{s.title}</h3>
                    <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6 }}>{s.desc}</p>
                  </div>
                </motion.div>
                {i < flow.length - 1 && <ArrowRight size={14} color="#cbd5e1" style={{ flexShrink: 0 }} />}
              </div>
            ))}
          </div>
          <div className="pr-flow-v" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            {flow.map((s, i) => (
              <motion.div key={s.step} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}>
                <div className="pr-card" style={{ padding: 20, position: "relative", overflow: "hidden", borderColor: s.color + "22", display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div className="pr-icon-box" style={{ color: s.color, background: s.color + "14", borderColor: s.color + "28", flexShrink: 0 }}><s.icon size={18} /></div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: s.color, marginBottom: 4 }}>PASO {s.step}</div>
                    <h3 className="pr-h" style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: "#0f172a" }}>{s.title}</h3>
                    <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{s.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALES */}
      <section style={{ padding: "96px 0", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 500, margin: "0 auto 52px" }}>
            <div className="pr-label" style={{ marginBottom: 14 }}>Testimonios</div>
            <h2 className="pr-h" style={{ fontSize: "clamp(26px,4vw,40px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, color: "#0f172a" }}>
              Lo que dicen los médicos que ya lo usan.
            </h2>
          </motion.div>
          <div className="pr-testi-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
            {testimonials.map((t, i) => (
              <motion.div key={t.name} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}>
                <div className="pr-card" style={{ padding: 26, height: "100%", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", gap: 3, marginBottom: 14 }}>
                    {Array.from({ length: 5 }).map((_, j) => <Star key={j} size={13} fill={TEAL} color={TEAL} />)}
                  </div>
                  <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.75, fontStyle: "italic", flex: 1 }}>"{t.quote}"</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
                    <img src={t.photo} alt={t.name} style={{ width: 40, height: 40, borderRadius: "50%", border: `2px solid ${TEAL}30`, flexShrink: 0, objectFit: "cover" }} loading="lazy" />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: SLATE }}>{t.role}</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* STACK TÉCNICO */}
      <section style={{ padding: "80px 0", background: "#fff", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="pr-label" style={{ marginBottom: 12 }}>Tecnología</div>
            <h2 className="pr-h" style={{ fontSize: "clamp(22px,3vw,36px)", fontWeight: 800, letterSpacing: "-0.04em", color: "#0f172a" }}>
              Stack moderno. Infraestructura empresarial. Hecho en México.
            </h2>
          </motion.div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            {[
              { icon: Bot, label: "Claude Sonnet 4.6", color: "#7c3aed" },
              { icon: Database, label: "PostgreSQL + Realtime", color: TEAL },
              { icon: Lock, label: "Row-Level Security", color: GREEN },
              { icon: Zap, label: "Edge Functions (Deno)", color: "#d97706" },
              { icon: Globe, label: "Cloudflare Workers + WAF", color: TEAL },
              { icon: Shield, label: "JWT + Supabase Vault", color: GREEN },
              { icon: TrendingUp, label: "BetterStack Monitoring", color: "#7c3aed" },
              { icon: ScanLine, label: "Stripe + Facturama", color: TEAL },
            ].map(({ icon: Icon, label, color }) => (
              <motion.div key={label} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 13, fontWeight: 500, color: "#0f172a" }}>
                  <Icon size={14} color={color} />{label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PRECIOS */}
      <section id="precios" style={{ padding: "96px 0", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 52px" }}>
            <div className="pr-label" style={{ marginBottom: 14 }}>Precios</div>
            <h2 className="pr-h" style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.08, marginBottom: 12, color: "#0f172a" }}>
              Planes claros. Factura con CFDI. Sin sorpresas.
            </h2>
            <p style={{ color: SLATE }}>Precios en pesos mexicanos. Cancela cuando quieras. Onboarding incluido en todos los planes.</p>
          </motion.div>
          <div className="pr-price-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
            {pricing.map((p, i) => (
              <motion.div key={p.name} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}>
                <PricingCard plan={p} />
              </motion.div>
            ))}
          </div>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ marginTop: 24, textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "#94a3b8" }}>
              ¿Necesitas migrar datos de otro sistema? ¿Integración con tu ERP? <a href="mailto:contacto@integrika.mx" style={{ color: TEAL, fontWeight: 500 }}>Escríbenos</a> y lo evaluamos sin costo.
            </p>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "80px 0", background: "#fff", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", marginBottom: 48 }}>
            <div className="pr-label" style={{ marginBottom: 14 }}>Preguntas frecuentes</div>
            <h2 className="pr-h" style={{ fontSize: "clamp(24px,3vw,38px)", fontWeight: 800, letterSpacing: "-0.04em", color: "#0f172a" }}>
              Las dudas que todos tienen.
            </h2>
          </motion.div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {faqs.map((faq, i) => (
              <motion.div key={i} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}>
                <div
                  style={{ borderRadius: 14, border: `1px solid ${faqOpen === i ? TEAL + "40" : "#e2e8f0"}`, background: faqOpen === i ? "#f0fdff" : "#fff", transition: "all .2s", overflow: "hidden" }}
                >
                  <button
                    onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                    style={{ width: "100%", padding: "18px 20px", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, textAlign: "left" }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 14, color: "#0f172a", lineHeight: 1.5 }}>{faq.q}</span>
                    {faqOpen === i ? <ChevronUp size={16} color={TEAL} style={{ flexShrink: 0 }} /> : <ChevronDown size={16} color="#94a3b8" style={{ flexShrink: 0 }} />}
                  </button>
                  {faqOpen === i && (
                    <div style={{ padding: "0 20px 18px", fontSize: 14, color: SLATE, lineHeight: 1.75 }}>{faq.a}</div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding: "112px 0", background: TEAL, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(255,255,255,.07) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,.07) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: 700, margin: "0 auto", padding: "0 24px", textAlign: "center" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px" }}>
              <Activity size={28} color="#fff" strokeWidth={2} />
            </div>
            <h2 className="pr-h" style={{ fontSize: "clamp(30px,5vw,52px)", fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1.06, marginBottom: 18, color: "#fff" }}>
              ¿Listo para que tu clínica funcione sola?
            </h2>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,.8)", marginBottom: 38, lineHeight: 1.75 }}>
              Demo de 30 minutos con tu clínica real. Sin instalación. Sin tarjeta de crédito. Operando en 48 horas.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", marginBottom: 32 }}>
              <a href="mailto:contacto@integrika.mx?subject=Demo%20IntegriKa">
                <button className="pr-btn" style={{ background: "#fff", color: TEAL, fontSize: 15, padding: "16px 32px", fontWeight: 700 }}>Agendar demo gratuita <ArrowRight size={17} /></button>
              </a>
              <a href="https://wa.me/5213324508776?text=Hola,%20me%20interesa%20IntegriKa" target="_blank" rel="noopener noreferrer">
                <button className="pr-btn" style={{ background: "transparent", color: "#fff", border: "2px solid rgba(255,255,255,.4)", fontSize: 15, padding: "16px 32px" }}>Escribir por WhatsApp</button>
              </a>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 22, fontSize: 13, color: "rgba(255,255,255,.7)" }}>
              {["Sin tarjeta de crédito", "Onboarding incluido", "14 días de prueba gratis", "Datos en México"].map((t) => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 size={12} color="rgba(255,255,255,.7)" /> {t}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid #e2e8f0", padding: "32px 0", background: "#fff" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <Logo size="xs" />
              <span className="pr-h" style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", letterSpacing: "-0.03em" }}>IntegriKa</span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>· Sistema Operativo de Clínica · México</span>
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              {[
                { href: "/aviso-privacidad", label: "Privacidad" },
                { href: "/terminos", label: "Términos" },
                { href: "mailto:contacto@integrika.mx", label: "Contacto" },
              ].map(({ href, label }) => (
                <a key={label} href={href} style={{ fontSize: 13, color: "#64748b", textDecoration: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = TEAL)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
                >{label}</a>
              ))}
            </div>
          </div>
          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 16, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
            © 2026 IntegriKa · Todos los derechos reservados · Hecho con orgullo en México 🇲🇽
          </div>
        </div>
      </footer>
    </div>
  );
}
