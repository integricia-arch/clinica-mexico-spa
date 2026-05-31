import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import Lottie from "lottie-react";
import healthReportAnimation from "@/assets/lottie/online-health-report.json";
import {
  MessageCircle, Calendar, Bell, Shield, Users, Stethoscope,
  Pill, Receipt, Inbox as InboxIcon, ClipboardCheck, Bot, Clock,
  CheckCircle2, ArrowRight, Sparkles, Lock, Activity, Globe, Zap,
  TrendingUp, Database, Menu, X, UserCheck, Star,
  ShoppingCart, BarChart3, Package,
} from "lucide-react";

// ─── CSS ──────────────────────────────────────────────────────────────────────
const PITCH_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;0,900;1,600;1,700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

.pr{font-family:'DM Sans',system-ui,sans-serif;background:#FAF7F2;color:#1A1208;overflow-x:hidden;}
.pr-serif{font-family:'Playfair Display',Georgia,serif;}
.pr-progress{position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,#1B4332,#B45309);z-index:200;transform-origin:left;pointer-events:none;}
.pr-card{background:#fff;border:1px solid #E8DDD0;border-radius:16px;transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease;}
.pr-card:hover{transform:translateY(-3px);box-shadow:0 12px 36px rgba(27,67,50,.1);border-color:#1B4332;}
.pr-card-a:hover{box-shadow:0 12px 36px rgba(180,83,9,.1);border-color:#B45309;}
.pr-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 14px;border-radius:100px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;}
.pr-badge-g{background:#D1FAE5;color:#065F46;border:1px solid #6EE7B7;}
.pr-badge-a{background:#FEF3C7;color:#92400E;border:1px solid #FCD34D;}
.pr-label{font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#B45309;}
.pr-label-g{font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#1B4332;}
.pr-btn{padding:13px 26px;border-radius:10px;font-size:15px;font-weight:500;cursor:pointer;border:none;display:inline-flex;align-items:center;gap:8px;transition:all .2s;text-decoration:none;font-family:'DM Sans',system-ui,sans-serif;}
.pr-btn-p{background:#1B4332;color:#fff;box-shadow:0 4px 14px rgba(27,67,50,.25);}
.pr-btn-p:hover{background:#12372A;box-shadow:0 6px 22px rgba(27,67,50,.35);transform:translateY(-1px);}
.pr-btn-o{background:transparent;color:#1A1208;border:1.5px solid #C8BAA8;}
.pr-btn-o:hover{border-color:#1B4332;color:#1B4332;background:#F0EAE0;}
.pr-icon-box{width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;border:1px solid;}
.pr-featured{border:2px solid #1B4332;box-shadow:0 0 0 4px rgba(27,67,50,.07);}
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
}
`;

// ─── Animated counter ─────────────────────────────────────────────────────────
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

// ─── Scroll progress ──────────────────────────────────────────────────────────
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

// ─── Design tokens (60% warm cream / 30% deep green / 10% amber) ──────────────
const G = "#1B4332";
const A = "#B45309";
const T = "#1A1208";
const M = "#6B5B4A";

const reveal = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

// ─── Data ─────────────────────────────────────────────────────────────────────
const navLinks = [
  { href: "#modulos", label: "Módulos" },
  { href: "#farmacia", label: "Farmacia & POS" },
  { href: "#flujo", label: "Cómo funciona" },
  { href: "#precios", label: "Precios" },
];

const stats = [
  { value: "70%", numeric: 70, suffix: "%", label: "Menos no-shows", sub: "recordatorios T-24h y T-2h" },
  { value: "24/7", numeric: null, label: "Atención automática", sub: "bot IA en Telegram / WhatsApp" },
  { value: "5min", numeric: 5, suffix: " min", label: "Latencia mínima", sub: "pg_cron procesa la cola" },
  { value: "100%", numeric: 100, suffix: "%", label: "Auditable", sub: "logs append-only de cambios" },
];

const modules = [
  { icon: Calendar, title: "Agenda médica", desc: "Vista semanal multi-doctor, validación de cupos en servidor, estados detallados.", accent: false },
  { icon: Bot, title: "Bot de IA 24/7", desc: "Atiende pacientes en Telegram, agenda citas y escala a recepción cuando hace falta.", accent: true },
  { icon: InboxIcon, title: "Inbox unificado", desc: "Recepción ve todas las conversaciones en un panel tipo WhatsApp Web.", accent: false },
  { icon: Bell, title: "Recordatorios automáticos", desc: "T-24h y T-2h por Telegram, WhatsApp o SMS. Cola con reintentos y status visible.", accent: true },
  { icon: Users, title: "Pacientes y expediente", desc: "Ficha completa con RFC, CURP, INE, historial clínico, notas y documentos.", accent: false },
  { icon: Stethoscope, title: "Consultas y notas", desc: "Captura estructurada con auto-guardado y trazabilidad por usuario.", accent: true },
  { icon: ShoppingCart, title: "Farmacia & POS", desc: "Punto de venta con carrito, lotes FIFO, 4 métodos de pago. Surtir receta desde el expediente.", accent: false },
  { icon: Receipt, title: "Facturación CFDI", desc: "RFC, régimen, uso CFDI. Listo para integrarse a tu PAC.", accent: true },
  { icon: ClipboardCheck, title: "Auditoría", desc: "Log append-only de cada cambio: quién, qué, cuándo. Cumple regulación MX.", accent: false },
];

const pharmacyFeatures = [
  {
    icon: ShoppingCart, title: "Punto de Venta completo",
    desc: "Carrito con búsqueda por nombre o código de barras. Selección automática de lote FIFO. Descuentos por ítem. Cuatro métodos de pago: efectivo, tarjeta, transferencia y mixto en una sola venta.",
    pills: ["4 métodos de pago", "Lotes FIFO", "Descuentos por ítem"], accent: false,
  },
  {
    icon: Pill, title: "Surtir Receta",
    desc: "La farmacia escanea o busca la receta generada en consulta. Valida stock disponible, dispensa por lote y fecha de caducidad, descuenta inventario y registra el pago — todo sin reescribir datos.",
    pills: ["Receta → Farmacia → Stock", "Medicamentos controlados", "Sin papel extra"], accent: true,
  },
  {
    icon: BarChart3, title: "Corte de Caja por Turno",
    desc: "Cierre de turno con resumen desglosado por método de pago, marca de tarjeta, terminal y referencia. El cajero solo ve su turno; el manager ve todos.",
    pills: ["Desglose por turno", "Acceso diferenciado por rol", "Reimpresión de tickets"], accent: false,
  },
];

const differentiators = [
  { icon: Globe, title: "Hecho para México", desc: "Idioma 100% es-MX, DD/MM/YYYY, MXN, +52, RFC/CURP/INE y CFDI desde el día uno. No es un SaaS gringo traducido.", accent: false },
  { icon: Bot, title: "IA conversacional real", desc: "Bot con Claude Sonnet 4.6 y tool use: agenda citas, valida disponibilidad en BD y escala a humano cuando es necesario.", accent: true },
  { icon: Shield, title: "Seguridad por defecto", desc: "Row-Level Security en cada tabla, roles separados (admin/recepción/doctor/cajero), JWT en endpoints sensibles, auditoría completa.", accent: false },
  { icon: Zap, title: "Tiempo real", desc: "Mensajes, recordatorios y cambios de agenda se reflejan al instante en todos los dashboards vía Supabase Realtime.", accent: true },
];

const flow = [
  { step: "01", icon: MessageCircle, title: "Paciente escribe", desc: "Vía Telegram o WhatsApp. El bot lo identifica o registra." },
  { step: "02", icon: Calendar, title: "IA agenda la cita", desc: "Valida disponibilidad real y confirma en segundos." },
  { step: "03", icon: Bell, title: "Recordatorios creados", desc: "Se crean en cola los avisos T-24h y T-2h automáticamente." },
  { step: "04", icon: Clock, title: "Cron despacha", desc: "Cada 5 min pg_cron envía pendientes y reintenta fallidos." },
  { step: "05", icon: UserCheck, title: "Escala si hace falta", desc: "El bot transfiere a recepción, que responde desde el Inbox." },
  { step: "06", icon: ClipboardCheck, title: "Todo auditado", desc: "Cada cambio en cita, rol o expediente se registra con usuario y fecha." },
];

const pricing = [
  {
    name: "Esencial", price: "$2,499", period: "MXN / mes",
    desc: "Clínicas con 1-3 consultorios", featured: false, cta: "Empezar",
    features: ["Hasta 3 doctores", "500 citas/mes", "Bot Telegram", "Recordatorios automáticos", "Soporte por correo"],
  },
  {
    name: "Profesional", price: "$5,999", period: "MXN / mes",
    desc: "La opción más popular", featured: true, cta: "Solicitar demo",
    features: ["Hasta 10 doctores", "Citas ilimitadas", "Bot Telegram + WhatsApp", "Farmacia & POS completo", "Facturación CFDI", "Soporte prioritario"],
  },
  {
    name: "Empresarial", price: "A medida", period: "",
    desc: "Grupos médicos y hospitales", featured: false, cta: "Hablemos",
    features: ["Doctores ilimitados", "Multi-sucursal", "Integraciones a la medida", "SLA dedicado", "Onboarding asistido", "Capacitación in situ"],
  },
];

const testimonials = [
  {
    photoUrl: "https://images.unsplash.com/photo-1638202993928-7267aad84c31?q=80&w=400&auto=format&fit=crop&crop=face",
    name: "Dra. María Rodríguez", role: "Directora Médica", clinic: "Clínica Familiar Rodríguez · Guadalajara",
    quote: "Antes perdíamos 8-10 citas a la semana por no-shows. Con los recordatorios automáticos bajamos a menos de 2.",
  },
  {
    photoUrl: "https://images.unsplash.com/photo-1530497610245-94d3c16cda28?q=80&w=400&auto=format&fit=crop&crop=face",
    name: "Dr. Jorge Mendoza", role: "Médico General", clinic: "Consultorios Mendoza · CDMX",
    quote: "Lo que más me sorprendió fue que entiende RFC, CURP y CFDI desde el día uno. En 48 horas estábamos operando.",
  },
  {
    photoUrl: "https://images.unsplash.com/photo-1511174511562-5f7f18b874f8?q=80&w=400&auto=format&fit=crop&crop=face",
    name: "Lic. Ana Lozano", role: "Administradora", clinic: "Centro Médico Lozano · Monterrey",
    quote: "El Inbox unificado cambió todo. Ya no jugamos teléfono entre WhatsApp personal y el sistema.",
  },
];

const techItems = [
  { icon: Lock, label: "Row-Level Security" },
  { icon: Database, label: "PostgreSQL + Realtime" },
  { icon: Zap, label: "Edge Functions (Deno)" },
  { icon: Bot, label: "Claude Sonnet 4.6" },
  { icon: Shield, label: "JWT + roles separados" },
  { icon: TrendingUp, label: "Escala automática" },
];

const mockAppointments = [
  { initials: "LP", name: "Laura Pérez", time: "09:00", status: "Confirmada" },
  { initials: "CM", name: "Carlos Mora", time: "10:30", status: "Pendiente" },
  { initials: "SR", name: "Sofía Ríos", time: "11:00", status: "Confirmada" },
];

// ─── Pricing card ─────────────────────────────────────────────────────────────
function PricingCardInner({ plan }: { plan: typeof pricing[0] }) {
  return (
    <>
      {plan.featured && <div style={{ marginBottom: 16 }}><span className="pr-badge pr-badge-g">Más popular</span></div>}
      <div className="pr-serif" style={{ fontSize: 22, fontWeight: 700, color: T, marginBottom: 4 }}>{plan.name}</div>
      <div style={{ fontSize: 13, color: M, marginBottom: 20 }}>{plan.desc}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 24 }}>
        <span className="pr-serif" style={{ fontSize: 44, fontWeight: 900, color: plan.featured ? G : T, letterSpacing: "-0.03em", lineHeight: 1 }}>{plan.price}</span>
        {plan.period && <span style={{ fontSize: 13, color: M }}>{plan.period}</span>}
      </div>
      <a href="mailto:contacto@integrika.mx?subject=Plan%20ClinicaMX" style={{ display: "block", marginBottom: 24 }}>
        <button className={`pr-btn ${plan.featured ? "pr-btn-p" : "pr-btn-o"}`} style={{ width: "100%", justifyContent: "center" }}>{plan.cta}</button>
      </a>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {plan.features.map((f) => (
          <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <CheckCircle2 size={15} color={plan.featured ? G : A} style={{ marginTop: 1, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: M }}>{f}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Pitch() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="pr">
      <style>{PITCH_STYLES}</style>
      <ScrollProgress />

      {/* NAV */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(250,247,242,0.96)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: "1px solid #E8DDD0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: G, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Activity size={17} color="#fff" strokeWidth={2.5} />
            </div>
            <span className="pr-serif" style={{ fontWeight: 700, fontSize: 18, color: T }}>ClínicaMX</span>
          </div>
          <nav className="pr-nav-links" style={{ display: "none", gap: 32 }}>
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} style={{ color: M, textDecoration: "none", fontSize: 14, transition: "color .2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = G)}
                onMouseLeave={(e) => (e.currentTarget.style.color = M)}
              >{l.label}</a>
            ))}
          </nav>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a href="mailto:contacto@integrika.mx?subject=Demo%20ClinicaMX">
              <button className="pr-btn pr-btn-p" style={{ padding: "9px 18px", fontSize: 13 }}>Demo gratuita <ArrowRight size={14} /></button>
            </a>
            <button className="pr-mob-btn" style={{ background: "transparent", border: "1px solid #E8DDD0", borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: T }} onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div style={{ borderTop: "1px solid #E8DDD0", background: "#FAF7F2", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            {navLinks.map((l) => <a key={l.href} href={l.href} style={{ color: M, textDecoration: "none", fontSize: 15 }} onClick={() => setMobileOpen(false)}>{l.label}</a>)}
          </div>
        )}
      </header>

      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden", paddingTop: 88, paddingBottom: 104 }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, #FAF7F2 0%, #F0EAE0 60%, #E8DDD0 100%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: -120, right: -80, width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle, rgba(27,67,50,.06) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -60, left: -60, width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle, rgba(180,83,9,.06) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div className="pr-hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 56, alignItems: "center" }}>
            <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}>
              <div className="pr-badge pr-badge-a" style={{ marginBottom: 28 }}>
                <Sparkles size={11} /> Sistema de gestión médica · México
              </div>
              <h1 className="pr-serif" style={{ fontSize: "clamp(40px,5.5vw,72px)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.02em", marginBottom: 28, color: T }}>
                La operación de tu clínica,{" "}
                <em style={{ color: G, fontStyle: "italic" }}>automatizada de verdad.</em>
              </h1>
              <p style={{ fontSize: 18, color: M, lineHeight: 1.8, marginBottom: 36, maxWidth: 520 }}>
                Bot de IA que agenda 24/7, recordatorios que eliminan no-shows, expediente digital, farmacia con POS completo y facturación CFDI.{" "}
                <strong style={{ color: T, fontWeight: 600 }}>Hecho para clínicas mexicanas.</strong>
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 36 }}>
                <a href="mailto:contacto@integrika.mx?subject=Demo%20ClinicaMX">
                  <button className="pr-btn pr-btn-p" style={{ fontSize: 16, padding: "14px 28px" }}>Solicitar demo en vivo <ArrowRight size={16} /></button>
                </a>
                <Link to="/"><button className="pr-btn pr-btn-o" style={{ fontSize: 16, padding: "14px 28px" }}>Ver dashboard</button></Link>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 20, fontSize: 13, color: M }}>
                {["Sin instalación", "Onboarding en 48 h", "Datos en México"].map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={14} color={G} />{item}</div>
                ))}
              </div>
            </motion.div>

            <motion.div className="pr-hero-card" style={{ display: "none" }}
              initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <div style={{ borderRadius: 20, overflow: "hidden", border: "1px solid #E8DDD0", boxShadow: "0 28px 80px rgba(27,67,50,.12), 0 4px 16px rgba(0,0,0,.05)" }}>
                <div style={{ background: "#F0EAE0", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #E8DDD0" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["#ff5f57","#febc2e","#28c840"].map((c) => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
                  </div>
                  <span style={{ fontSize: 11, color: "#9B8B7A", fontFamily: "monospace", marginLeft: 8 }}>dashboard · recepción</span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: G }} />
                    <span style={{ fontSize: 10, color: G, fontWeight: 600 }}>En vivo</span>
                  </div>
                </div>
                <div style={{ background: "#FAF7F2", padding: 20 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
                    {[
                      { label: "Citas hoy", value: "12", icon: Calendar, idx: 0 },
                      { label: "Recordatorios", value: "8", icon: Bell, idx: 1 },
                      { label: "Pacientes", value: "247", icon: Users, idx: 0 },
                    ].map(({ label, value, icon: Icon, idx }) => (
                      <div key={label} style={{ borderRadius: 12, background: idx === 1 ? "#FEF3C7" : "#E8F5E9", border: `1px solid ${idx === 1 ? "#FCD34D" : "#A7D7B8"}`, padding: 12 }}>
                        <Icon size={14} color={idx === 1 ? A : G} style={{ marginBottom: 6 }} />
                        <div className="pr-serif" style={{ fontSize: 22, fontWeight: 700, color: T }}>{value}</div>
                        <div style={{ fontSize: 10, color: M }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "#9B8B7A", marginBottom: 8 }}>Próximas citas</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {mockAppointments.map((appt, idx) => {
                      const col = idx % 2 === 0 ? G : A;
                      return (
                        <div key={appt.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "#fff", border: "1px solid #E8DDD0" }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: col + "18", border: `1px solid ${col}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: col, flexShrink: 0 }}>{appt.initials}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: T, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{appt.name}</div>
                            <div style={{ fontSize: 10, color: "#9B8B7A" }}>{appt.time}</div>
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: appt.status === "Confirmada" ? G : A, background: appt.status === "Confirmada" ? "#D1FAE5" : "#FEF3C7", padding: "2px 8px", borderRadius: 100, flexShrink: 0 }}>{appt.status}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: `1px solid ${G}22`, background: "#E8F5E9" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: G + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Bot size={11} color={G} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: G }}>Bot IA</span>
                      <span style={{ fontSize: 10, color: "#9B8B7A", marginLeft: "auto" }}>ahora</span>
                    </div>
                    <p style={{ fontSize: 11, color: M, lineHeight: 1.6, margin: 0 }}>"Hola Laura, mañana a las 9:00 AM tienes cita con el Dr. García. ¿Confirmas?"</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Stats grid — large serif numbers, editorial layout */}
          <div className="pr-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 1, marginTop: 80, borderRadius: 20, overflow: "hidden", border: "1px solid #E8DDD0" }}>
            {stats.map((s, i) => (
              <motion.div key={s.label} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} custom={i}>
                <div style={{ padding: "32px 28px", background: i % 2 === 0 ? "#fff" : "#FAF7F2", borderRight: i % 2 === 0 ? "1px solid #E8DDD0" : "none", borderBottom: i < 2 ? "1px solid #E8DDD0" : "none" }}>
                  <div className="pr-serif" style={{ fontSize: 52, fontWeight: 900, letterSpacing: "-0.04em", color: i % 2 === 0 ? G : A, lineHeight: 1, marginBottom: 8 }}>
                    {s.numeric !== null ? <AnimatedCounter value={s.numeric} suffix={s.suffix} /> : s.value}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: T, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: "#9B8B7A" }}>{s.sub}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section style={{ padding: "96px 0", background: "#fff", borderTop: "1px solid #E8DDD0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div className="pr-tech-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 56, alignItems: "center" }}>
            <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <div className="pr-label" style={{ marginBottom: 16 }}>El problema</div>
              <h2 className="pr-serif" style={{ fontSize: "clamp(30px,4vw,50px)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 24, color: T }}>
                Recepción saturada, citas perdidas, expedientes en papel.
              </h2>
              <p style={{ color: M, lineHeight: 1.8, marginBottom: 16, fontSize: 16 }}>
                Las clínicas mexicanas pierden hasta el <strong style={{ color: "#DC2626" }}>30% de sus citas</strong> por no-shows, doble booking y recordatorios manuales por WhatsApp.
              </p>
              <p style={{ color: M, lineHeight: 1.8, fontSize: 16 }}>
                Las soluciones extranjeras no entienden RFC, CURP, CFDI ni el flujo de una recepción mexicana. Las locales se quedan cortas en tecnología.
              </p>
            </motion.div>
            <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1}>
              <div style={{ borderRadius: 20, border: "1px solid #FECACA", background: "#FFF5F5", padding: 36 }}>
                {[
                  "Recepción copia y pega recordatorios uno por uno",
                  "Pacientes llaman fuera de horario y nadie responde",
                  "Doble agendado por falta de validación en tiempo real",
                  "Expediente en Excel, sin trazabilidad de cambios",
                  "Farmacia con inventario manual, sin ligar receta a despacho",
                  "Facturación CFDI armada a mano con datos incompletos",
                ].map((p, i) => (
                  <motion.div key={p} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#F87171", marginTop: 8, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: "#6B4040", lineHeight: 1.7 }}>{p}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section id="modulos" style={{ padding: "96px 0", background: "#F0EAE0", borderTop: "1px solid #E8DDD0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 56px" }}>
            <div className="pr-label-g" style={{ marginBottom: 14 }}>Módulos</div>
            <h2 className="pr-serif" style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 16, color: T }}>Todo lo que tu clínica necesita, en un solo lugar.</h2>
            <p style={{ color: M, fontSize: 16 }}>Nueve módulos integrados, listos desde el primer día.</p>
          </motion.div>
          <div className="pr-mod-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
            {modules.map((m, i) => {
              const col = m.accent ? A : G;
              return (
                <motion.div key={m.title} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} custom={i}>
                  <div className={`pr-card ${m.accent ? "pr-card-a" : ""}`} style={{ padding: 28, height: "100%", background: "#fff" }}>
                    <div className="pr-icon-box" style={{ color: col, background: col + "12", borderColor: col + "28", marginBottom: 18 }}><m.icon size={20} /></div>
                    <h3 className="pr-serif" style={{ fontWeight: 700, fontSize: 17, marginBottom: 8, color: T }}>{m.title}</h3>
                    <p style={{ fontSize: 13, color: M, lineHeight: 1.7 }}>{m.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FARMACIA */}
      <section id="farmacia" style={{ padding: "96px 0", background: "#fff", borderTop: "1px solid #E8DDD0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ maxWidth: 680, marginBottom: 56 }}>
            <div className="pr-badge pr-badge-g" style={{ marginBottom: 20 }}><ShoppingCart size={11} /> Nuevo · Farmacia & POS</div>
            <h2 className="pr-serif" style={{ fontSize: "clamp(28px,4vw,50px)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 18, color: T }}>Farmacia integrada al expediente médico.</h2>
            <p style={{ color: M, fontSize: 17, lineHeight: 1.8 }}>De la receta generada en consulta al despacho en ventanilla — sin papel extra, sin reescribir datos, con trazabilidad lote-a-lote en cada venta.</p>
          </motion.div>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "16px 24px", borderRadius: 14, background: "#E8F5E9", border: `1px solid ${G}30` }}>
              {[
                { icon: Stethoscope, label: "Consulta" }, { icon: ArrowRight, label: null },
                { icon: Pill, label: "Receta" }, { icon: ArrowRight, label: null },
                { icon: ShoppingCart, label: "Farmacia POS" }, { icon: ArrowRight, label: null },
                { icon: Package, label: "Inventario" }, { icon: ArrowRight, label: null },
                { icon: BarChart3, label: "Corte de Caja" },
              ].map((item, idx) => (
                item.label
                  ? <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid ${G}30`, borderRadius: 8, padding: "6px 12px" }}><item.icon size={14} color={G} /><span style={{ fontSize: 12, fontWeight: 600, color: G }}>{item.label}</span></div>
                  : <ArrowRight key={idx} size={14} color={`${G}60`} />
              ))}
              <span style={{ marginLeft: "auto", fontSize: 12, color: G, fontWeight: 600 }}>100% trazable · lote a lote</span>
            </div>
          </motion.div>
          <div className="pr-farm-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
            {pharmacyFeatures.map((f, i) => {
              const col = f.accent ? A : G;
              return (
                <motion.div key={f.title} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}>
                  <div className={`pr-card ${f.accent ? "pr-card-a" : ""}`} style={{ padding: 36, height: "100%", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: col + "08" }} />
                    <div className="pr-icon-box" style={{ color: col, background: col + "12", borderColor: col + "28", marginBottom: 20, width: 52, height: 52, borderRadius: 14, position: "relative" }}><f.icon size={22} /></div>
                    <h3 className="pr-serif" style={{ fontWeight: 700, fontSize: 21, marginBottom: 12, color: T }}>{f.title}</h3>
                    <p style={{ fontSize: 14, color: M, lineHeight: 1.75, marginBottom: 20 }}>{f.desc}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {f.pills.map((pill) => <span key={pill} style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: col + "12", color: col, border: `1px solid ${col}28` }}>{pill}</span>)}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: "96px 0", background: "#F0EAE0", borderTop: "1px solid #E8DDD0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 56px" }}>
            <div className="pr-label" style={{ marginBottom: 14 }}>Testimonios</div>
            <h2 className="pr-serif" style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1, color: T }}>Lo que dicen los médicos que ya lo usan.</h2>
          </motion.div>
          <div className="pr-testi-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
            {testimonials.map((t, i) => (
              <motion.div key={t.name} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}>
                <div className="pr-card" style={{ padding: 32, height: "100%", background: "#fff" }}>
                  <div style={{ display: "flex", gap: 3, marginBottom: 20 }}>
                    {Array.from({ length: 5 }).map((_, j) => <Star key={j} size={14} fill={A} color={A} />)}
                  </div>
                  <p className="pr-serif" style={{ fontSize: 16, color: T, lineHeight: 1.75, fontStyle: "italic", marginBottom: 24 }}>"{t.quote}"</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <img src={t.photoUrl} alt={t.name} style={{ width: 46, height: 46, borderRadius: "50%", border: `2px solid ${G}28`, flexShrink: 0, objectFit: "cover" }} loading="lazy" />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: M }}>{t.role}</div>
                      {t.clinic && <div style={{ fontSize: 11, color: "#9B8B7A", marginTop: 1 }}>{t.clinic}</div>}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="flujo" style={{ padding: "96px 0", background: "#fff", borderTop: "1px solid #E8DDD0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 40px" }}>
            <div className="pr-label-g" style={{ marginBottom: 14 }}>Cómo funciona</div>
            <h2 className="pr-serif" style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1, color: T }}>Del primer mensaje a la cita confirmada, sin tocar nada.</h2>
          </motion.div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 48 }}>
            <div style={{ padding: 24, borderRadius: 24, background: "#F0EAE0", border: "1px solid #E8DDD0" }}>
              <Lottie animationData={healthReportAnimation} loop autoplay style={{ width: 180, height: 180, opacity: 0.85 }} />
            </div>
          </div>
          <div className="pr-flow-h" style={{ display: "none", gap: 8, alignItems: "stretch" }}>
            {flow.map((s, i) => {
              const col = i % 2 === 0 ? G : A;
              return (
                <div key={s.step} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                  <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} style={{ flex: 1 }}>
                    <div className="pr-card" style={{ padding: 20, position: "relative", overflow: "hidden", height: "100%", borderColor: col + "20" }}>
                      <div className="pr-serif" style={{ position: "absolute", top: -6, right: 10, fontSize: 54, fontWeight: 900, color: col, opacity: 0.07 }}>{s.step}</div>
                      <div className="pr-icon-box" style={{ color: col, background: col + "12", borderColor: col + "28", marginBottom: 10 }}><s.icon size={18} /></div>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: col, marginBottom: 6 }}>PASO {s.step}</div>
                      <h3 className="pr-serif" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: T, lineHeight: 1.3 }}>{s.title}</h3>
                      <p style={{ fontSize: 11, color: M, lineHeight: 1.6 }}>{s.desc}</p>
                    </div>
                  </motion.div>
                  {i < flow.length - 1 && <ArrowRight size={16} color="#C8BAA8" style={{ flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>
          <div className="pr-flow-v" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
            {flow.map((s, i) => {
              const col = i % 2 === 0 ? G : A;
              return (
                <motion.div key={s.step} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}>
                  <div className="pr-card" style={{ padding: 20, position: "relative", overflow: "hidden", borderColor: col + "20" }}>
                    <div className="pr-serif" style={{ position: "absolute", top: -6, right: 10, fontSize: 60, fontWeight: 900, color: col, opacity: 0.07 }}>{s.step}</div>
                    <div className="pr-icon-box" style={{ color: col, background: col + "12", borderColor: col + "28", marginBottom: 10 }}><s.icon size={18} /></div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: col, marginBottom: 6 }}>PASO {s.step}</div>
                    <h3 className="pr-serif" style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: T }}>{s.title}</h3>
                    <p style={{ fontSize: 13, color: M, lineHeight: 1.65 }}>{s.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* DIFFERENTIATORS */}
      <section id="diferenciadores" style={{ padding: "96px 0", background: "#F0EAE0", borderTop: "1px solid #E8DDD0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 56px" }}>
            <div className="pr-badge pr-badge-a" style={{ marginBottom: 16 }}>¿Por qué nosotros?</div>
            <h2 className="pr-serif" style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1, color: T }}>Cuatro razones por las que ganamos contra cualquier competidor.</h2>
          </motion.div>
          <div className="pr-diff-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
            {differentiators.map((d, i) => {
              const col = d.accent ? A : G;
              return (
                <motion.div key={d.title} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}>
                  <div className={`pr-card ${d.accent ? "pr-card-a" : ""}`} style={{ padding: 36, height: "100%", background: "#fff" }}>
                    <div className="pr-icon-box" style={{ color: col, background: col + "12", borderColor: col + "28", marginBottom: 20, width: 52, height: 52, borderRadius: 14 }}><d.icon size={22} /></div>
                    <h3 className="pr-serif" style={{ fontWeight: 700, fontSize: 21, marginBottom: 10, color: T }}>{d.title}</h3>
                    <p style={{ fontSize: 14, color: M, lineHeight: 1.8 }}>{d.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* STACK */}
      <section style={{ padding: "96px 0", background: "#fff", borderTop: "1px solid #E8DDD0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div className="pr-tech-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 56, alignItems: "center" }}>
            <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <div className="pr-label" style={{ marginBottom: 16 }}>Tecnología</div>
              <h2 className="pr-serif" style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 20, color: T }}>Stack moderno, infraestructura empresarial.</h2>
              <p style={{ color: M, lineHeight: 1.8, marginBottom: 28, fontSize: 16 }}>Construido sobre React 18, TypeScript y PostgreSQL. Edge functions serverless que escalan a millones de pacientes. Realtime nativo. Backups automáticos.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
                {techItems.map(({ icon: Icon, label }, idx) => {
                  const col = idx % 2 === 0 ? G : A;
                  return (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: "#FAF7F2", border: `1px solid ${col}18` }}>
                      <Icon size={15} color={col} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: T }}>{label}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
            <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1}>
              <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #E8DDD0", boxShadow: "0 8px 32px rgba(27,67,50,.08)" }}>
                <div style={{ background: "#F0EAE0", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #E8DDD0" }}>
                  <div style={{ display: "flex", gap: 6 }}>{["#ff5f57","#febc2e","#28c840"].map((c) => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}</div>
                  <span style={{ fontSize: 11, color: "#9B8B7A", fontFamily: "monospace", marginLeft: 8 }}>arquitectura</span>
                </div>
                <div style={{ padding: 24, fontFamily: "monospace", fontSize: 13, lineHeight: 2, background: "#FAF7F2" }}>
                  <div style={{ color: "#9B8B7A" }}>{"// Flujo end-to-end"}</div>
                  {[
                    { a: G, b: "Paciente", c: "#9B8B7A", d: " → ", e: T, f: "Telegram / WhatsApp" },
                    { a: "#9B8B7A", b: "  ↓ webhook", c: "", d: "", e: "", f: "" },
                    { a: "#7C3AED", b: "Claude (tool use)", c: "#9B8B7A", d: " → BD", e: "", f: "" },
                    { a: "#9B8B7A", b: "  ↓", c: "", d: "", e: "", f: "" },
                    { a: G, b: "appointments", c: "#9B8B7A", d: " + ", e: A, f: "recordatorios_cita" },
                    { a: "#9B8B7A", b: "  ↓", c: "", d: "", e: "", f: "" },
                    { a: A, b: "pg_cron", c: "#9B8B7A", d: " (5 min) → ", e: T, f: "enviar-recordatorios" },
                    { a: "#9B8B7A", b: "  ↓", c: "", d: "", e: "", f: "" },
                    { a: G, b: "Dashboard recepción", c: "#9B8B7A", d: " (realtime)", e: "", f: "" },
                  ].map((row, idx) => (
                    <div key={idx}><span style={{ color: row.a }}>{row.b}</span><span style={{ color: row.c }}>{row.d}</span><span style={{ color: row.e }}>{row.f}</span></div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="precios" style={{ padding: "96px 0", background: "#F0EAE0", borderTop: "1px solid #E8DDD0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 56px" }}>
            <div className="pr-label" style={{ marginBottom: 14 }}>Precios</div>
            <h2 className="pr-serif" style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 14, color: T }}>Planes claros. Sin sorpresas.</h2>
            <p style={{ color: M, fontSize: 16 }}>Todos los precios en pesos mexicanos. Factura con CFDI.</p>
          </motion.div>
          <div className="pr-price-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
            {pricing.map((p, i) => (
              <motion.div key={p.name} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}>
                <div className={`pr-card ${p.featured ? "pr-featured" : ""}`} style={{ padding: 36, height: "100%", background: "#fff" }}>
                  <PricingCardInner plan={p} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "120px 0", background: G, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(255,255,255,.04) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div style={{ position: "absolute", top: "50%", right: "-10%", transform: "translateY(-50%)", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(180,83,9,.15) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: 700, margin: "0 auto", padding: "0 24px", textAlign: "center" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 32px" }}>
              <Calendar size={28} color="#fff" />
            </div>
            <h2 className="pr-serif" style={{ fontSize: "clamp(34px,5vw,60px)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.06, marginBottom: 20, color: "#fff" }}>¿Listo para ver tu clínica funcionando sola?</h2>
            <p style={{ fontSize: 18, color: "rgba(255,255,255,.75)", marginBottom: 44, lineHeight: 1.8 }}>Te mostramos el sistema completo con datos reales en una llamada de 30 minutos.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", marginBottom: 36 }}>
              <a href="mailto:contacto@integrika.mx?subject=Demo%20ClinicaMX">
                <button className="pr-btn" style={{ background: "#FAF7F2", color: G, fontSize: 16, padding: "16px 36px", fontWeight: 600 }}>Agendar demo <ArrowRight size={18} /></button>
              </a>
              <a href="mailto:contacto@integrika.mx?subject=One-pager%20ClinicaMX">
                <button className="pr-btn" style={{ background: "transparent", color: "#fff", border: "2px solid rgba(255,255,255,.3)", fontSize: 16, padding: "16px 36px" }}>Descargar one-pager</button>
              </a>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 24, fontSize: 13, color: "rgba(255,255,255,.65)" }}>
              {["Sin tarjeta de crédito", "Onboarding incluido", "Cancela cuando quieras"].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={13} color="rgba(255,255,255,.65)" /> {item}</div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid #E8DDD0", padding: "28px 0", background: "#FAF7F2" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", display: "flex", flexDirection: "column", gap: 8, alignItems: "center", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: G, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Activity size={14} color="#fff" strokeWidth={2.5} />
            </div>
            <span className="pr-serif" style={{ fontWeight: 700, fontSize: 15, color: T }}>ClínicaMX SaaS</span>
            <span style={{ fontSize: 13, color: "#9B8B7A" }}>· Hecho en México</span>
          </div>
          <div style={{ fontSize: 12, color: "#9B8B7A" }}>© 2026 · Todos los derechos reservados</div>
          <div style={{ borderTop: "1px solid #E8DDD0", paddingTop: 16, marginTop: 8, width: "100%" }}>
            <p style={{ fontSize: 11, color: "#9B8B7A", textAlign: "center", margin: 0 }}>
              Animación "Online Health Report" por{" "}
              <a href="https://iconscout.com/es/contributors/victoria-motion/:assets" style={{ textDecoration: "underline", color: M }} target="_blank" rel="noopener noreferrer">Victoria Shelest</a>
              {" "}en{" "}
              <a href="https://iconscout.com" style={{ textDecoration: "underline", color: M }} target="_blank" rel="noopener noreferrer">IconScout</a>
              . Fotografías de Unsplash.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
