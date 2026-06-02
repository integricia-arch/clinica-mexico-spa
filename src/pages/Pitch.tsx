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
  ShoppingCart, BarChart3, ScanLine, Package,
} from "lucide-react";

// ── CSS ───────────────────────────────────────────────────────────────────────
const PITCH_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700;800&family=Noto+Sans:wght@300;400;500;700&display=swap');
.pr{font-family:'Noto Sans',system-ui,sans-serif;background:#fff;color:#0f172a;overflow-x:hidden;}
.pr-h{font-family:'Figtree',system-ui,sans-serif;}
@keyframes pr-ping{0%,100%{box-shadow:0 0 0 0 rgba(5,150,105,.35)}70%{box-shadow:0 0 0 8px rgba(5,150,105,0)}}
.pr-progress{position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,#0891b2,#059669);z-index:200;transform-origin:left;pointer-events:none;}
.pr-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease;}
.pr-card:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(8,145,178,.13);border-color:#a5f3fc;}
.pr-card-g:hover{box-shadow:0 16px 40px rgba(5,150,105,.12);border-color:#6ee7b7;}
.pr-alt{background:#f0fdff;}
.pr-alt-g{background:#f0fdf4;}
.pr-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 14px;border-radius:100px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;}
.pr-badge-t{background:#cffafe;color:#0e7490;border:1px solid #a5f3fc;}
.pr-badge-g{background:#d1fae5;color:#047857;border:1px solid #6ee7b7;}
.pr-label{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#0891b2;}
.pr-label-g{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#059669;}
.pr-btn{padding:14px 28px;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;border:none;display:inline-flex;align-items:center;gap:8px;transition:all .2s;text-decoration:none;letter-spacing:-.01em;}
.pr-btn-p{background:#0891b2;color:#fff;box-shadow:0 4px 14px rgba(8,145,178,.28);}
.pr-btn-p:hover{background:#0e7490;box-shadow:0 6px 22px rgba(8,145,178,.38);transform:translateY(-2px);}
.pr-btn-g{background:#059669;color:#fff;box-shadow:0 4px 14px rgba(5,150,105,.28);}
.pr-btn-g:hover{background:#047857;box-shadow:0 6px 22px rgba(5,150,105,.38);transform:translateY(-2px);}
.pr-btn-o{background:#fff;color:#334155;border:1.5px solid #cbd5e1;}
.pr-btn-o:hover{border-color:#0891b2;color:#0891b2;background:#f0fdff;}
.pr-icon-box{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;border:1px solid;transition:all .3s;}
.pr-featured{border:2px solid #0891b2;box-shadow:0 0 0 4px rgba(8,145,178,.08);}
@media(min-width:768px){
  .pr-nav-links{display:flex!important;}
  .pr-mob-btn{display:none!important;}
  .pr-hero-grid{grid-template-columns:1fr 1fr!important;}
  .pr-stats-grid{grid-template-columns:repeat(4,1fr)!important;}
  .pr-mod-grid{grid-template-columns:repeat(3,1fr)!important;}
  .pr-farm-grid{grid-template-columns:repeat(3,1fr)!important;}
  .pr-diff-grid{grid-template-columns:repeat(2,1fr)!important;}
  .pr-price-grid{grid-template-columns:repeat(3,1fr)!important;align-items:start;}
  .pr-flow-h{display:flex!important;}
  .pr-flow-v{display:none!important;}
  .pr-tech-grid{grid-template-columns:1fr 1fr!important;}
  .pr-testi-grid{grid-template-columns:repeat(2,1fr)!important;}
}
.pr-hero-card{display:block;}
`;

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

// ── ScrollProgress ─────────────────────────────────────────────────────────────
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

// ── Data ───────────────────────────────────────────────────────────────────────
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
  { href: "#farmacia", label: "Farmacia & POS" },
  { href: "#flujo", label: "Cómo funciona" },
  { href: "#precios", label: "Precios" },
];

const stats = [
  { value: "70%", numeric: 70, suffix: "%", label: "Menos no-shows", sub: "recordatorios T-24h y T-2h", color: TEAL, bg: "#cffafe" },
  { value: "24/7", numeric: null, label: "Atención automática", sub: "bot IA en Telegram / WhatsApp", color: GREEN, bg: "#d1fae5" },
  { value: "5min", numeric: 5, suffix: " min", label: "Latencia mínima", sub: "pg_cron procesa la cola", color: TEAL, bg: "#cffafe" },
  { value: "100%", numeric: 100, suffix: "%", label: "Auditable", sub: "logs append-only de cambios", color: GREEN, bg: "#d1fae5" },
];

const modules = [
  { icon: Calendar, title: "Agenda médica", desc: "Vista semanal multi-doctor, validación de cupos en servidor, estados detallados.", color: TEAL },
  { icon: Bot, title: "Bot de IA 24/7", desc: "Atiende pacientes en Telegram, agenda citas y escala a recepción cuando hace falta.", color: GREEN },
  { icon: InboxIcon, title: "Inbox unificado", desc: "Recepción ve todas las conversaciones en un panel tipo WhatsApp Web.", color: TEAL },
  { icon: Bell, title: "Recordatorios automáticos", desc: "T-24h y T-2h por Telegram, WhatsApp o SMS. Cola con reintentos y status visible.", color: GREEN },
  { icon: Users, title: "Pacientes y expediente", desc: "Ficha completa con RFC, CURP, INE, historial clínico, notas y documentos.", color: TEAL },
  { icon: Stethoscope, title: "Consultas y notas", desc: "Captura estructurada con auto-guardado y trazabilidad por usuario.", color: GREEN },
  { icon: ShoppingCart, title: "Farmacia & POS", desc: "Punto de venta con carrito, lotes FIFO, 4 métodos de pago. Surtir receta directamente desde el expediente.", color: TEAL },
  { icon: Receipt, title: "Facturación CFDI", desc: "RFC, régimen, uso CFDI. Listo para integrarse a tu PAC.", color: GREEN },
  { icon: ClipboardCheck, title: "Auditoría", desc: "Log append-only de cada cambio: quién, qué, cuándo. Cumple regulación MX.", color: TEAL },
];

const pharmacyFeatures = [
  {
    icon: ShoppingCart,
    title: "Punto de Venta completo",
    desc: "Carrito con búsqueda por nombre o código de barras. Selección automática de lote FIFO. Descuentos por ítem. Cuatro métodos de pago: efectivo, tarjeta, transferencia y mixto en una sola venta.",
    pills: ["4 métodos de pago", "Lotes FIFO", "Descuentos por ítem"],
    color: TEAL,
    bg: "#cffafe",
  },
  {
    icon: Pill,
    title: "Surtir Receta",
    desc: "La farmacia escanea o busca la receta generada en consulta. Valida stock disponible, dispensa por lote y fecha de caducidad, descuenta inventario y registra el pago — todo sin reescribir datos.",
    pills: ["Receta → Farmacia → Stock", "Medicamentos controlados", "Sin papel extra"],
    color: GREEN,
    bg: "#d1fae5",
  },
  {
    icon: BarChart3,
    title: "Corte de Caja por Turno",
    desc: "Cierre de turno con resumen desglosado por método de pago, marca de tarjeta, terminal y referencia. El cajero solo ve su turno; el manager ve todos. Reimpresión de tickets en cualquier momento.",
    pills: ["Desglose por turno", "Acceso diferenciado por rol", "Reimpresión de tickets"],
    color: TEAL,
    bg: "#cffafe",
  },
];

const differentiators = [
  { icon: Globe, title: "Hecho para México", desc: "Idioma 100% es-MX, DD/MM/YYYY, MXN, +52, RFC/CURP/INE y CFDI desde el día uno. No es un SaaS gringo traducido.", color: TEAL },
  { icon: Bot, title: "IA conversacional real", desc: "Bot con Claude Sonnet 4.6 y tool use: agenda citas, valida disponibilidad en BD y escala a humano cuando es necesario.", color: GREEN },
  { icon: Shield, title: "Seguridad por defecto", desc: "Row-Level Security en cada tabla, roles separados (admin/recepción/doctor/cajero), JWT en endpoints sensibles, auditoría completa.", color: TEAL },
  { icon: Zap, title: "Tiempo real", desc: "Mensajes, recordatorios y cambios de agenda se reflejan al instante en todos los dashboards vía Supabase Realtime.", color: GREEN },
];

const flow = [
  { step: "01", icon: MessageCircle, title: "Paciente escribe", desc: "Vía Telegram o WhatsApp. El bot lo identifica o registra.", color: TEAL },
  { step: "02", icon: Calendar, title: "IA agenda la cita", desc: "Valida disponibilidad real y confirma en segundos.", color: GREEN },
  { step: "03", icon: Bell, title: "Recordatorios creados", desc: "Se crean en cola los avisos T-24h y T-2h automáticamente.", color: TEAL },
  { step: "04", icon: Clock, title: "Cron despacha", desc: "Cada 5 min pg_cron envía pendientes y reintenta fallidos.", color: GREEN },
  { step: "05", icon: UserCheck, title: "Escala si hace falta", desc: "El bot transfiere a recepción, que responde desde el Inbox.", color: TEAL },
  { step: "06", icon: ClipboardCheck, title: "Todo auditado", desc: "Cada cambio en cita, rol o expediente se registra con usuario y fecha.", color: GREEN },
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
    photoUrl: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=400&auto=format&fit=crop&crop=face",
    name: "Dr. Carlos Ramírez",
    role: "Médico Internista",
    clinic: "Clínica Ramírez · Puebla",
    quote: "La agenda multi-doctor y el bot 24/7 nos permitieron atender el doble de pacientes sin contratar más personal de recepción.",
  },
  {
    photoUrl: "https://images.unsplash.com/photo-1638202993928-7267aad84c31?q=80&w=400&auto=format&fit=crop&crop=face",
    name: "Dra. María Rodríguez",
    role: "Directora Médica",
    clinic: "Clínica Familiar Rodríguez · Guadalajara",
    quote: "Antes perdíamos 8-10 citas a la semana por no-shows. Con los recordatorios automáticos bajamos a menos de 2.",
  },
  {
    photoUrl: "https://images.unsplash.com/photo-1530497610245-94d3c16cda28?q=80&w=400&auto=format&fit=crop&crop=face",
    name: "Dr. Jorge Mendoza",
    role: "Médico General",
    clinic: "Consultorios Mendoza · CDMX",
    quote: "Lo que más me sorprendió fue que entiende RFC, CURP y CFDI desde el día uno. En 48 horas estábamos operando.",
  },
  {
    photoUrl: "https://images.unsplash.com/photo-1511174511562-5f7f18b874f8?q=80&w=400&auto=format&fit=crop&crop=face",
    name: "Lic. Ana Lozano",
    role: "Administradora",
    clinic: "Centro Médico Lozano · Monterrey",
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

// ── PricingCardInner ──────────────────────────────────────────────────────────
function PricingCardInner({ plan }: { plan: typeof pricing[0] }) {
  return (
    <>
      {plan.featured && (
        <div style={{ marginBottom: 16 }}>
          <div className="pr-badge pr-badge-t">Más popular</div>
        </div>
      )}
      <div className="pr-h" style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 4, letterSpacing: "-0.02em" }}>{plan.name}</div>
      <div style={{ fontSize: 13, color: SLATE, marginBottom: 20 }}>{plan.desc}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 24 }}>
        <span className="pr-h" style={{ fontSize: 42, fontWeight: 800, color: plan.featured ? TEAL : "#0f172a", letterSpacing: "-0.04em" }}>{plan.price}</span>
        {plan.period && <span style={{ fontSize: 13, color: SLATE }}>{plan.period}</span>}
      </div>
      <a href={`mailto:pablo@integrika.com.mx?subject=Plan%20Cl%C3%ADnicaMX%20-%20${encodeURIComponent(plan.name)}`}
        className={`pr-btn ${plan.featured ? "pr-btn-p" : "pr-btn-o"}`}
        style={{ display: "flex", width: "100%", justifyContent: "center", marginBottom: 24, boxSizing: "border-box" }}>
        {plan.cta}
      </a>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {plan.features.map((f) => (
          <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <CheckCircle2 size={15} color={plan.featured ? TEAL : GREEN} style={{ marginTop: 1, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#475569" }}>{f}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function Pitch() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="pr">
      <style>{PITCH_STYLES}</style>
      <ScrollProgress />

      {/* ── NAV ────────────────────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #e2e8f0",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: TEAL, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Activity size={17} color="#fff" strokeWidth={2.5} />
            </div>
            <span className="pr-h" style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em", color: "#0f172a" }}>ClínicaMX</span>
          </div>
          <nav className="pr-nav-links" style={{ display: "none", gap: 32 }}>
            {navLinks.map((l) => (
              <a key={l.href} href={l.href}
                style={{ color: "#64748b", textDecoration: "none", fontSize: 14, fontWeight: 500, transition: "color .2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = TEAL)}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
              >{l.label}</a>
            ))}
          </nav>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a href="mailto:pablo@integrika.com.mx?subject=Demo%20Cl%C3%ADnicaMX"
              className="pr-btn pr-btn-p" style={{ padding: "10px 20px", fontSize: 13 }}>
              Demo gratuita <ArrowRight size={14} />
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

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section style={{ position: "relative", overflow: "hidden", paddingTop: 80, paddingBottom: 96, background: "linear-gradient(180deg,#f0fdff 0%,#fff 100%)" }}>
        {/* Subtle background dots */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, #a5f3fc 1px, transparent 1px)", backgroundSize: "32px 32px", opacity: 0.35, pointerEvents: "none" }} />

        <div style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div className="pr-hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 56, alignItems: "center" }}>

            {/* Left: copy */}
            <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
              <div className="pr-badge pr-badge-t" style={{ marginBottom: 24 }}>
                <Sparkles size={11} /> Sistema de gestión médica · México
              </div>
              <h1 className="pr-h" style={{ fontSize: "clamp(38px,5vw,64px)", fontWeight: 800, lineHeight: 1.06, letterSpacing: "-0.04em", marginBottom: 24, color: "#0f172a" }}>
                La operación de tu clínica,{" "}
                <span style={{ color: TEAL }}>automatizada de verdad.</span>
              </h1>
              <p style={{ fontSize: 18, color: SLATE, lineHeight: 1.75, marginBottom: 36, maxWidth: 520 }}>
                Bot de IA que agenda 24/7, recordatorios que eliminan no-shows, expediente digital,
                farmacia con POS completo y facturación CFDI.{" "}
                <strong style={{ color: "#0f172a" }}>Hecho para clínicas mexicanas.</strong>
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 36 }}>
                <a href="mailto:pablo@integrika.com.mx?subject=Demo%20Cl%C3%ADnicaMX"
                  className="pr-btn pr-btn-p">
                  Solicitar demo en vivo <ArrowRight size={16} />
                </a>
                <Link to="/" className="pr-btn pr-btn-o">Ver dashboard</Link>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 20, fontSize: 13, color: "#64748b" }}>
                {["Sin instalación", "Onboarding en 48 h", "Datos en México"].map((t) => (
                  <div key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <CheckCircle2 size={14} color={GREEN} />{t}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right: dashboard mockup */}
            <motion.div className="pr-hero-card"
              initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.85, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <div style={{ borderRadius: 18, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 24px 72px rgba(8,145,178,.12), 0 4px 16px rgba(0,0,0,.06)" }}>
                {/* Browser bar */}
                <div style={{ background: "#f8fafc", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["#ff5f57","#febc2e","#28c840"].map((c) => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
                  </div>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", marginLeft: 8 }}>dashboard · recepción</span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, animation: "pr-ping 2s ease-in-out infinite" }} />
                    <span style={{ fontSize: 10, color: GREEN, fontWeight: 600 }}>En vivo</span>
                  </div>
                </div>
                {/* Dashboard content */}
                <div style={{ background: "#fff", padding: 20 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
                    {[
                      { label: "Citas hoy", value: "12", icon: Calendar, color: TEAL, bg: "#cffafe" },
                      { label: "Recordatorios", value: "8", icon: Bell, color: GREEN, bg: "#d1fae5" },
                      { label: "Pacientes", value: "247", icon: Users, color: TEAL, bg: "#cffafe" },
                    ].map(({ label, value, icon: Icon, color, bg }) => (
                      <div key={label} style={{ borderRadius: 12, background: bg, border: `1px solid ${color}33`, padding: 12 }}>
                        <Icon size={14} color={color} style={{ marginBottom: 6 }} />
                        <div className="pr-h" style={{ fontSize: 22, fontWeight: 700, color: "#0f172a" }}>{value}</div>
                        <div style={{ fontSize: 10, color: "#64748b" }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>Próximas citas</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {mockAppointments.map((a, idx) => {
                      const color = idx % 2 === 0 ? TEAL : GREEN;
                      return (
                        <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: color + "22", border: `1px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color, flexShrink: 0 }}>{a.initials}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                            <div style={{ fontSize: 10, color: "#94a3b8" }}>{a.time}</div>
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: a.status === "Confirmada" ? GREEN : "#d97706", background: a.status === "Confirmada" ? "#d1fae5" : "#fef3c7", padding: "2px 8px", borderRadius: 100, flexShrink: 0 }}>{a.status}</div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Bot message */}
                  <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: `1px solid ${TEAL}22`, background: "#f0fdff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: TEAL + "22", border: `1px solid ${TEAL}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Bot size={11} color={TEAL} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: TEAL }}>Bot IA</span>
                      <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>ahora</span>
                    </div>
                    <p style={{ fontSize: 11, color: "#475569", lineHeight: 1.6, margin: 0 }}>
                      "Hola Laura, mañana a las 9:00 AM tienes cita con el Dr. García. ¿Confirmas tu asistencia?"
                    </p>
                  </div>
                </div>
              </div>
              {/* Hero doctor photo accent */}
              <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
                <div style={{ borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 8px 32px rgba(8,145,178,.12)", overflow: "hidden", maxWidth: 300, width: "100%" }}>
                  <img
                    src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=800&auto=format&fit=crop"
                    alt="Médico usando ClínicaMX"
                    style={{ width: "100%", display: "block" }}
                    loading="lazy"
                  />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Stats */}
          <div className="pr-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, marginTop: 72 }}>
            {stats.map((s, i) => (
              <motion.div key={s.label} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} custom={i}>
                <div className="pr-card" style={{ padding: 24, borderRadius: 16 }}>
                  <div className="pr-h" style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em", color: s.color, lineHeight: 1, marginBottom: 6 }}>
                    {s.numeric !== null ? <AnimatedCounter value={s.numeric} suffix={s.suffix} /> : s.value}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>{s.sub}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEM ────────────────────────────────────────────────────────── */}
      <section style={{ padding: "96px 0", borderTop: "1px solid #f1f5f9" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div className="pr-tech-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 56, alignItems: "center" }}>
            <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <div className="pr-label" style={{ marginBottom: 16 }}>El problema</div>
              <h2 className="pr-h" style={{ fontSize: "clamp(30px,4vw,46px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 24, color: "#0f172a" }}>
                Recepción saturada, citas perdidas, expedientes en papel.
              </h2>
              <p style={{ color: SLATE, lineHeight: 1.75, marginBottom: 16 }}>
                Las clínicas mexicanas pierden hasta el{" "}
                <span style={{ color: "#dc2626", fontWeight: 600 }}>30% de sus citas</span>{" "}
                por no-shows, doble booking y recordatorios manuales por WhatsApp.
              </p>
              <p style={{ color: SLATE, lineHeight: 1.75 }}>
                Las soluciones extranjeras no entienden RFC, CURP, CFDI ni el flujo de una recepción mexicana. Las locales se quedan cortas en tecnología.
              </p>
            </motion.div>
            <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1}>
              <div style={{ borderRadius: 18, border: "1px solid #fecaca", background: "#fff5f5", padding: 32 }}>
                {[
                  "Recepción copia y pega recordatorios uno por uno",
                  "Pacientes llaman fuera de horario y nadie responde",
                  "Doble agendado por falta de validación en tiempo real",
                  "Expediente en Excel, sin trazabilidad de cambios",
                  "Farmacia con inventario manual, sin ligar receta a despacho",
                  "Facturación CFDI armada a mano con datos incompletos",
                ].map((p, i) => (
                  <motion.div key={p} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f87171", marginTop: 7, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: "#475569", lineHeight: 1.65 }}>{p}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── MODULES ────────────────────────────────────────────────────────── */}
      <section id="modulos" style={{ padding: "96px 0", background: "#f0fdff" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 56px" }}>
            <div className="pr-label" style={{ marginBottom: 14 }}>Módulos</div>
            <h2 className="pr-h" style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 16, color: "#0f172a" }}>
              Todo lo que tu clínica necesita, en un solo lugar.
            </h2>
            <p style={{ color: SLATE, fontSize: 16 }}>Nueve módulos integrados, listos desde el primer día.</p>
          </motion.div>
          <div className="pr-mod-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
            {modules.map((m, i) => (
              <motion.div key={m.title} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} custom={i}>
                <div className={`pr-card ${m.color === GREEN ? "pr-card-g" : ""}`} style={{ padding: 24, height: "100%" }}>
                  <div className="pr-icon-box" style={{ color: m.color, background: m.color + "15", borderColor: m.color + "30", marginBottom: 16 }}>
                    <m.icon size={20} />
                  </div>
                  <h3 className="pr-h" style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: "#0f172a", letterSpacing: "-0.02em" }}>{m.title}</h3>
                  <p style={{ fontSize: 13, color: SLATE, lineHeight: 1.65 }}>{m.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FARMACIA POS ───────────────────────────────────────────────────── */}
      <section id="farmacia" style={{ padding: "96px 0", background: "#fff", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ maxWidth: 680, marginBottom: 56 }}>
            <div className="pr-badge pr-badge-g" style={{ marginBottom: 20 }}>
              <ShoppingCart size={11} /> Nuevo · Farmacia & POS
            </div>
            <h2 className="pr-h" style={{ fontSize: "clamp(28px,4vw,46px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 18, color: "#0f172a" }}>
              Farmacia integrada al expediente médico.
            </h2>
            <p style={{ color: SLATE, fontSize: 17, lineHeight: 1.75 }}>
              De la receta generada en consulta al despacho en ventanilla — sin papel extra, sin reescribir datos, con trazabilidad lote-a-lote en cada venta.
            </p>
          </motion.div>

          {/* Farmacia trace banner */}
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "16px 24px", borderRadius: 14, background: "#f0fdf4", border: "1px solid #6ee7b7" }}>
              {[
                { icon: Stethoscope, label: "Consulta" },
                { icon: ArrowRight, label: null },
                { icon: Pill, label: "Receta" },
                { icon: ArrowRight, label: null },
                { icon: ShoppingCart, label: "Farmacia POS" },
                { icon: ArrowRight, label: null },
                { icon: Package, label: "Inventario" },
                { icon: ArrowRight, label: null },
                { icon: BarChart3, label: "Corte de Caja" },
              ].map((item, idx) => (
                item.label ? (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #a7f3d0", borderRadius: 8, padding: "6px 12px" }}>
                    <item.icon size={14} color={GREEN} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#047857" }}>{item.label}</span>
                  </div>
                ) : (
                  <ArrowRight key={idx} size={14} color="#6ee7b7" />
                )
              ))}
              <span style={{ marginLeft: "auto", fontSize: 12, color: "#059669", fontWeight: 600 }}>100% trazable · lote a lote</span>
            </div>
          </motion.div>

          <div className="pr-farm-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
            {pharmacyFeatures.map((f, i) => (
              <motion.div key={f.title} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}>
                <div className={`pr-card ${f.color === GREEN ? "pr-card-g" : ""}`} style={{ padding: 32, height: "100%", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: -12, right: -12, width: 80, height: 80, borderRadius: "50%", background: f.bg, opacity: 0.6 }} />
                  <div className="pr-icon-box" style={{ color: f.color, background: f.color + "15", borderColor: f.color + "30", marginBottom: 20, width: 52, height: 52, borderRadius: 14, position: "relative" }}>
                    <f.icon size={22} />
                  </div>
                  <h3 className="pr-h" style={{ fontWeight: 700, fontSize: 20, marginBottom: 12, color: "#0f172a", letterSpacing: "-0.02em" }}>{f.title}</h3>
                  <p style={{ fontSize: 14, color: SLATE, lineHeight: 1.7, marginBottom: 20 }}>{f.desc}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {f.pills.map((pill) => (
                      <span key={pill} style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: f.bg, color: f.color === TEAL ? "#0e7490" : "#047857", border: `1px solid ${f.color}33` }}>
                        {pill}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ───────────────────────────────────────────────────── */}
      <section style={{ padding: "96px 0", background: "#f0fdff", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 56px" }}>
            <div className="pr-label" style={{ marginBottom: 14 }}>Testimonios</div>
            <h2 className="pr-h" style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, color: "#0f172a" }}>
              Lo que dicen los médicos que ya lo usan.
            </h2>
          </motion.div>
          <div className="pr-testi-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
            {testimonials.map((t, i) => (
              <motion.div key={t.name} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}>
                <div className="pr-card" style={{ padding: 28, height: "100%" }}>
                  <div style={{ display: "flex", gap: 3, marginBottom: 16 }}>
                    {Array.from({ length: 5 }).map((_, j) => <Star key={j} size={14} fill={TEAL} color={TEAL} />)}
                  </div>
                  <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.7, fontStyle: "italic", marginBottom: 20 }}>"{t.quote}"</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <img src={t.photoUrl} alt={t.name} style={{ width: 44, height: 44, borderRadius: "50%", border: `2px solid ${TEAL}33`, flexShrink: 0, objectFit: "cover" }} loading="lazy" />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: SLATE }}>{t.role}</div>
                      {t.clinic && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{t.clinic}</div>}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FLOW ───────────────────────────────────────────────────────────── */}
      <section id="flujo" style={{ padding: "96px 0", background: "#fff", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 40px" }}>
            <div className="pr-label" style={{ marginBottom: 14 }}>Cómo funciona</div>
            <h2 className="pr-h" style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, color: "#0f172a" }}>
              Del primer mensaje a la cita confirmada, sin tocar nada.
            </h2>
          </motion.div>

          {/* Lottie animation */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 48 }}>
            <div style={{ padding: 24, borderRadius: 24, background: "#f0fdff", border: "1px solid #a5f3fc" }}>
              <Lottie
                animationData={healthReportAnimation}
                loop
                autoplay
                style={{ width: 200, height: 200, opacity: 0.9 }}
              />
            </div>
          </div>

          {/* Desktop horizontal */}
          <div className="pr-flow-h" style={{ display: "none", gap: 8, alignItems: "stretch" }}>
            {flow.map((s, i) => (
              <div key={s.step} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} style={{ flex: 1 }}>
                  <div className="pr-card" style={{ padding: 20, position: "relative", overflow: "hidden", height: "100%", borderColor: s.color + "22" }}>
                    <div className="pr-h" style={{ position: "absolute", top: -4, right: 12, fontSize: 52, fontWeight: 800, color: s.color, opacity: 0.08 }}>{s.step}</div>
                    <div className="pr-icon-box" style={{ color: s.color, background: s.color + "15", borderColor: s.color + "30", marginBottom: 10 }}><s.icon size={18} /></div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: s.color, marginBottom: 6 }}>PASO {s.step}</div>
                    <h3 className="pr-h" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: "#0f172a", lineHeight: 1.3 }}>{s.title}</h3>
                    <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6 }}>{s.desc}</p>
                  </div>
                </motion.div>
                {i < flow.length - 1 && <ArrowRight size={16} color="#cbd5e1" style={{ flexShrink: 0 }} />}
              </div>
            ))}
          </div>

          {/* Mobile grid */}
          <div className="pr-flow-v" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
            {flow.map((s, i) => (
              <motion.div key={s.step} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}>
                <div className="pr-card" style={{ padding: 20, position: "relative", overflow: "hidden", borderColor: s.color + "22" }}>
                  <div className="pr-h" style={{ position: "absolute", top: -4, right: 12, fontSize: 56, fontWeight: 800, color: s.color, opacity: 0.08 }}>{s.step}</div>
                  <div className="pr-icon-box" style={{ color: s.color, background: s.color + "15", borderColor: s.color + "30", marginBottom: 10 }}><s.icon size={18} /></div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: s.color, marginBottom: 6 }}>PASO {s.step}</div>
                  <h3 className="pr-h" style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: "#0f172a" }}>{s.title}</h3>
                  <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DIFFERENTIATORS ────────────────────────────────────────────────── */}
      <section id="diferenciadores" style={{ padding: "96px 0", background: "#f0fdff", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 56px" }}>
            <div className="pr-badge pr-badge-t" style={{ marginBottom: 16 }}>¿Por qué nosotros?</div>
            <h2 className="pr-h" style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, color: "#0f172a" }}>
              Cuatro razones por las que ganamos contra cualquier competidor.
            </h2>
          </motion.div>
          <div className="pr-diff-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
            {differentiators.map((d, i) => (
              <motion.div key={d.title} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}>
                <div className={`pr-card ${d.color === GREEN ? "pr-card-g" : ""}`} style={{ padding: 32, height: "100%" }}>
                  <div className="pr-icon-box" style={{ color: d.color, background: d.color + "15", borderColor: d.color + "30", marginBottom: 20, width: 52, height: 52, borderRadius: 14 }}>
                    <d.icon size={22} />
                  </div>
                  <h3 className="pr-h" style={{ fontWeight: 700, fontSize: 20, marginBottom: 10, color: "#0f172a", letterSpacing: "-0.02em" }}>{d.title}</h3>
                  <p style={{ fontSize: 14, color: SLATE, lineHeight: 1.75 }}>{d.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STACK ──────────────────────────────────────────────────────────── */}
      <section style={{ padding: "96px 0", background: "#fff", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div className="pr-tech-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 56, alignItems: "center" }}>
            <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <div className="pr-label" style={{ marginBottom: 16 }}>Tecnología</div>
              <h2 className="pr-h" style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 20, color: "#0f172a" }}>
                Stack moderno, infraestructura empresarial.
              </h2>
              <p style={{ color: SLATE, lineHeight: 1.75, marginBottom: 28 }}>
                Construido sobre React 18, TypeScript y PostgreSQL. Edge functions serverless que escalan a millones de pacientes. Realtime nativo. Backups automáticos.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
                {techItems.map(({ icon: Icon, label }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: "#f0fdff", border: `1px solid ${TEAL}20` }}>
                    <Icon size={15} color={TEAL} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#0f172a" }}>{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1}>
              <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 8px 32px rgba(8,145,178,.08)" }}>
                <div style={{ background: "#f8fafc", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["#ff5f57","#febc2e","#28c840"].map((c) => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
                  </div>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", marginLeft: 8 }}>arquitectura</span>
                </div>
                <div style={{ padding: 24, fontFamily: "monospace", fontSize: 13, lineHeight: 2, background: "#fff" }}>
                  <div style={{ color: "#94a3b8" }}>{"// Flujo end-to-end"}</div>
                  {[
                    { a: TEAL, b: "Paciente", c: "#94a3b8", d: " → ", e: "#0f172a", f: "Telegram / WhatsApp" },
                    { a: "#94a3b8", b: "  ↓ webhook", c: "", d: "", e: "", f: "" },
                    { a: "#7c3aed", b: "Claude (tool use)", c: "#94a3b8", d: " → BD", e: "", f: "" },
                    { a: "#94a3b8", b: "  ↓", c: "", d: "", e: "", f: "" },
                    { a: TEAL, b: "appointments", c: "#94a3b8", d: " + ", e: GREEN, f: "recordatorios_cita" },
                    { a: "#94a3b8", b: "  ↓", c: "", d: "", e: "", f: "" },
                    { a: "#d97706", b: "pg_cron", c: "#94a3b8", d: " (5 min) → ", e: "#0f172a", f: "enviar-recordatorios" },
                    { a: "#94a3b8", b: "  ↓", c: "", d: "", e: "", f: "" },
                    { a: GREEN, b: "Dashboard recepción", c: "#94a3b8", d: " (realtime)", e: "", f: "" },
                  ].map((row, idx) => (
                    <div key={idx}>
                      <span style={{ color: row.a }}>{row.b}</span>
                      <span style={{ color: row.c }}>{row.d}</span>
                      <span style={{ color: row.e }}>{row.f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────────────────────────── */}
      <section id="precios" style={{ padding: "96px 0", background: "#f0fdff", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 56px" }}>
            <div className="pr-label" style={{ marginBottom: 14 }}>Precios</div>
            <h2 className="pr-h" style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 14, color: "#0f172a" }}>
              Planes claros. Sin sorpresas.
            </h2>
            <p style={{ color: SLATE }}>Todos los precios en pesos mexicanos. Factura con CFDI.</p>
          </motion.div>
          <div className="pr-price-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
            {pricing.map((p, i) => (
              <motion.div key={p.name} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}>
                <div className={`pr-card ${p.featured ? "pr-featured" : ""}`} style={{ padding: 32, height: "100%" }}>
                  <PricingCardInner plan={p} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section style={{ padding: "112px 0", background: TEAL, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(255,255,255,.06) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: 700, margin: "0 auto", padding: "0 24px", textAlign: "center" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px" }}>
              <Calendar size={28} color="#fff" />
            </div>
            <h2 className="pr-h" style={{ fontSize: "clamp(32px,5vw,56px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.06, marginBottom: 20, color: "#fff" }}>
              ¿Listo para ver tu clínica funcionando sola?
            </h2>
            <p style={{ fontSize: 18, color: "rgba(255,255,255,.8)", marginBottom: 40, lineHeight: 1.75 }}>
              Te mostramos el sistema completo con datos reales en una llamada de 30 minutos.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", marginBottom: 36 }}>
              <a href="mailto:pablo@integrika.com.mx?subject=Demo%20Cl%C3%ADnicaMX"
                className="pr-btn" style={{ background: "#fff", color: TEAL, fontSize: 16, padding: "16px 36px", fontWeight: 700 }}>
                Agendar demo <ArrowRight size={18} />
              </a>
              <a href="mailto:pablo@integrika.com.mx?subject=Solicitar%20one-pager%20Cl%C3%ADnicaMX"
                className="pr-btn" style={{ background: "transparent", color: "#fff", border: "2px solid rgba(255,255,255,.4)", fontSize: 16, padding: "16px 36px" }}>
                Solicitar one-pager
              </a>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 24, fontSize: 13, color: "rgba(255,255,255,.7)" }}>
              {["Sin tarjeta de crédito", "Onboarding incluido", "Cancela cuando quieras"].map((t) => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 size={13} color="rgba(255,255,255,.7)" /> {t}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid #e2e8f0", padding: "28px 0", background: "#fff" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", display: "flex", flexDirection: "column", gap: 8, alignItems: "center", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: TEAL, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Activity size={14} color="#fff" strokeWidth={2.5} />
            </div>
            <span className="pr-h" style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", letterSpacing: "-0.02em" }}>ClínicaMX SaaS</span>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>· Hecho en México</span>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>© 2026 · Todos los derechos reservados</div>
          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 16, marginTop: 8, width: "100%" }}>
            <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", margin: 0 }}>
              Animación "Online Health Report" por{" "}
              <a href="https://iconscout.com/es/contributors/victoria-motion/:assets" style={{ textDecoration: "underline", color: "#64748b" }} target="_blank" rel="noopener noreferrer">Victoria Shelest</a>
              {" "}en{" "}
              <a href="https://iconscout.com" style={{ textDecoration: "underline", color: "#64748b" }} target="_blank" rel="noopener noreferrer">IconScout</a>
              . Fotografías de Unsplash.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
