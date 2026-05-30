import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useTransform, useSpring, useInView } from "framer-motion";
import Lottie from "lottie-react";
import healthReportAnimation from "@/assets/lottie/online-health-report.json";
import {
  MessageCircle, Calendar, Bell, Shield, Users, Stethoscope,
  Pill, Receipt, Inbox as InboxIcon, ClipboardCheck, Bot, Clock,
  CheckCircle2, ArrowRight, Sparkles, Lock, Activity, Globe, Zap,
  TrendingUp, Database, Menu, X, UserCheck, Star,
} from "lucide-react";

// ── CSS injected into page ────────────────────────────────────────────────────
const PITCH_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap');
.pr{font-family:'Instrument Sans',system-ui,sans-serif;background:#03080f;color:#e2e8f0;overflow-x:hidden;}
.pr-h{font-family:'Bricolage Grotesque',system-ui,sans-serif;}
.pr-shimmer{background:linear-gradient(90deg,#00d9f5 0%,#a78bfa 30%,#00d9f5 55%,#34d399 75%,#00d9f5 100%);background-size:300% 100%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:pr-sh 5s linear infinite;}
@keyframes pr-sh{0%{background-position:0% 50%}100%{background-position:300% 50%}}
@keyframes pr-float{0%,100%{transform:translateY(0) scale(1)}40%{transform:translateY(-28px) scale(1.05)}70%{transform:translateY(-14px) scale(0.97)}}
@keyframes pr-float2{0%,100%{transform:translateY(0) rotate(0deg)}35%{transform:translateY(-36px) rotate(5deg)}65%{transform:translateY(-18px) rotate(-3deg)}}
@keyframes pr-marq{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
@keyframes pr-marq-r{0%{transform:translateX(-50%)}100%{transform:translateX(0)}}
@keyframes pr-border{0%{background-position:0% 50%}100%{background-position:400% 50%}}
@keyframes pr-ping{0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,.5)}70%{box-shadow:0 0 0 10px rgba(52,211,153,0)}}
.pr-glass{background:rgba(8,20,44,.75);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid rgba(0,217,245,.1);}
.pr-card{transition:transform .25s ease,box-shadow .25s ease;}
.pr-card:hover{transform:translateY(-5px);box-shadow:0 24px 64px rgba(0,0,0,.5),0 0 0 1px rgba(0,217,245,.12),0 0 40px rgba(0,217,245,.06);}
.pr-glow-border{position:relative;border-radius:16px;}
.pr-glow-border::before{content:'';position:absolute;inset:-1px;border-radius:16px;background:linear-gradient(90deg,#00d9f5,#a78bfa,#34d399,#a78bfa,#00d9f5);background-size:400% 100%;animation:pr-border 4s linear infinite;z-index:-1;opacity:0;transition:opacity .3s;}
.pr-glow-border:hover::before{opacity:1;}
.pr-featured-wrap{background:linear-gradient(90deg,#00d9f5,#a78bfa,#34d399,#a78bfa,#00d9f5);background-size:400% 100%;animation:pr-border 3s linear infinite;border-radius:18px;padding:1.5px;}
.pr-dots{background-image:radial-gradient(circle,rgba(0,217,245,.18) 1px,transparent 1px);background-size:30px 30px;}
.pr-progress{position:fixed;top:0;left:0;height:2px;background:linear-gradient(90deg,#00d9f5,#a78bfa,#34d399);z-index:200;transform-origin:left;pointer-events:none;}
.pr-marq{display:flex;gap:20px;width:max-content;animation:pr-marq 40s linear infinite;}
.pr-marq-r{display:flex;gap:20px;width:max-content;animation:pr-marq-r 38s linear infinite;}
.pr-marq:hover,.pr-marq-r:hover{animation-play-state:paused;}
.pr-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 14px;border-radius:100px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;}
.pr-badge-c{background:rgba(0,217,245,.1);color:#00d9f5;border:1px solid rgba(0,217,245,.22);}
.pr-badge-v{background:rgba(167,139,250,.1);color:#a78bfa;border:1px solid rgba(167,139,250,.22);}
.pr-label{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#00d9f5;}
.pr-btn{padding:14px 28px;border-radius:12px;font-size:15px;font-weight:600;letter-spacing:-.01em;cursor:pointer;border:none;display:inline-flex;align-items:center;gap:8px;transition:all .2s;text-decoration:none;}
.pr-btn-p{background:linear-gradient(135deg,#00d9f5,#0891b2);color:#03080f;box-shadow:0 0 24px rgba(0,217,245,.35);}
.pr-btn-p:hover{box-shadow:0 0 48px rgba(0,217,245,.55);transform:translateY(-2px);}
.pr-btn-o{background:rgba(255,255,255,.04);color:#cbd5e1;border:1px solid rgba(255,255,255,.12);}
.pr-btn-o:hover{border-color:rgba(0,217,245,.35);background:rgba(0,217,245,.06);color:#00d9f5;}
.pr-icon-box{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;border:1px solid;transition:all .3s;}
@media(min-width:768px){
  .pr-nav-links{display:flex!important;}
  .pr-mob-btn{display:none!important;}
  .pr-hero-grid{grid-template-columns:1fr 1fr!important;}
  .pr-hero-card{display:block!important;}
  .pr-stats-grid{grid-template-columns:repeat(4,1fr)!important;}
  .pr-mod-grid{grid-template-columns:repeat(3,1fr)!important;}
  .pr-diff-grid{grid-template-columns:repeat(2,1fr)!important;}
  .pr-price-grid{grid-template-columns:repeat(3,1fr)!important;align-items:start;}
  .pr-flow-h{display:flex!important;}
  .pr-flow-v{display:none!important;}
  .pr-tech-grid{grid-template-columns:1fr 1fr!important;}
}
`;

// ── TiltCard: 3D mouse-tracking ───────────────────────────────────────────────
function TiltCard({
  children, className = "", style = {}, intensity = 8,
}: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; intensity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const xMv = useMotionValue(0);
  const yMv = useMotionValue(0);
  const sp = { stiffness: 180, damping: 26 };
  const rotateX = useSpring(useTransform(yMv, [-0.5, 0.5], [intensity, -intensity]), sp);
  const rotateY = useSpring(useTransform(xMv, [-0.5, 0.5], [-intensity, intensity]), sp);

  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    xMv.set((e.clientX - r.left) / r.width - 0.5);
    yMv.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => { xMv.set(0); yMv.set(0); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d", ...style }}
      className={className}
    >
      {children}
    </motion.div>
  );
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
const CYAN = "#00d9f5", VIOLET = "#a78bfa", EMERALD = "#34d399";

const stats = [
  { value: "70%", numeric: 70, suffix: "%", label: "Menos no-shows", sub: "recordatorios T-24h y T-2h", color: CYAN },
  { value: "24/7", numeric: null, label: "Atención automática", sub: "bot IA en Telegram / WhatsApp", color: VIOLET },
  { value: "5min", numeric: 5, suffix: " min", label: "Latencia mínima", sub: "pg_cron procesa la cola", color: EMERALD },
  { value: "100%", numeric: 100, suffix: "%", label: "Auditable", sub: "logs append-only de cambios", color: CYAN },
];

const modules = [
  { icon: Calendar, title: "Agenda médica", desc: "Vista semanal multi-doctor, validación de cupos en servidor, estados detallados.", color: CYAN },
  { icon: Bot, title: "Bot de IA 24/7", desc: "Atiende pacientes en Telegram, agenda citas y escala a recepción cuando hace falta.", color: VIOLET },
  { icon: InboxIcon, title: "Inbox unificado", desc: "Recepción ve todas las conversaciones en un panel tipo WhatsApp Web.", color: EMERALD },
  { icon: Bell, title: "Recordatorios automáticos", desc: "T-24h y T-2h por Telegram, WhatsApp o SMS. Cola con reintentos y status visible.", color: CYAN },
  { icon: Users, title: "Pacientes y expediente", desc: "Ficha completa con RFC, CURP, INE, historial clínico, notas y documentos.", color: VIOLET },
  { icon: Stethoscope, title: "Consultas y notas", desc: "Captura estructurada con auto-guardado y trazabilidad por usuario.", color: EMERALD },
  { icon: Pill, title: "Farmacia interna", desc: "Inventario, recetas y dispensación ligada al expediente del paciente.", color: CYAN },
  { icon: Receipt, title: "Facturación CFDI", desc: "RFC, régimen, uso CFDI. Listo para integrarse a tu PAC.", color: VIOLET },
  { icon: ClipboardCheck, title: "Auditoría", desc: "Log append-only de cada cambio: quién, qué, cuándo. Cumple regulación MX.", color: EMERALD },
];

const differentiators = [
  { icon: Globe, title: "Hecho para México", desc: "Idioma 100% es-MX, DD/MM/YYYY, MXN, +52, RFC/CURP/INE y CFDI desde el día uno. No es un SaaS gringo traducido.", color: CYAN },
  { icon: Bot, title: "IA conversacional real", desc: "Bot con Claude Sonnet 4.6 y tool use: agenda citas, valida disponibilidad en BD y escala a humano cuando es necesario.", color: VIOLET },
  { icon: Shield, title: "Seguridad por defecto", desc: "Row-Level Security en cada tabla, roles separados (admin/recepción/doctor), JWT en endpoints sensibles, auditoría completa.", color: EMERALD },
  { icon: Zap, title: "Tiempo real", desc: "Mensajes, recordatorios y cambios de agenda se reflejan al instante en todos los dashboards vía Supabase Realtime.", color: CYAN },
];

const flow = [
  { step: "01", icon: MessageCircle, title: "Paciente escribe", desc: "Vía Telegram o WhatsApp. El bot lo identifica o registra.", color: CYAN },
  { step: "02", icon: Calendar, title: "IA agenda la cita", desc: "Valida disponibilidad real y confirma en segundos.", color: VIOLET },
  { step: "03", icon: Bell, title: "Recordatorios creados", desc: "Se crean en cola los avisos T-24h y T-2h automáticamente.", color: EMERALD },
  { step: "04", icon: Clock, title: "Cron despacha", desc: "Cada 5 min pg_cron envía pendientes y reintenta fallidos.", color: CYAN },
  { step: "05", icon: UserCheck, title: "Escala si hace falta", desc: "El bot transfiere a recepción, que responde desde el Inbox.", color: VIOLET },
  { step: "06", icon: ClipboardCheck, title: "Todo auditado", desc: "Cada cambio en cita, rol o expediente se registra con usuario y fecha.", color: EMERALD },
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
    features: ["Hasta 10 doctores", "Citas ilimitadas", "Bot Telegram + WhatsApp", "Inbox multi-canal", "Facturación CFDI", "Soporte prioritario"],
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
  { photoUrl: "https://i.pravatar.cc/150?img=32", name: "Dr. Carlos Vega", role: "Cardiólogo · Tijuana", clinic: "", quote: "La agenda multi-doctor resolvió el caos de tres consultorios. Los pacientes confirman solos y el expediente aparece listo." },
  { photoUrl: "https://i.pravatar.cc/150?img=56", name: "Dra. Sandra Torres", role: "Pediatra · Querétaro", clinic: "", quote: "Mis pacientes son mamás muy ocupadas. El bot agenda a las 10pm sin que yo esté disponible. Un cambio total." },
];

const navLinks = [
  { href: "#modulos", label: "Módulos" },
  { href: "#flujo", label: "Cómo funciona" },
  { href: "#diferenciadores", label: "Por qué nosotros" },
  { href: "#precios", label: "Precios" },
];

const mockAppointments = [
  { initials: "LP", color: CYAN, name: "Laura Pérez", time: "09:00", status: "Confirmada" },
  { initials: "CM", color: VIOLET, name: "Carlos Mora", time: "10:30", status: "Pendiente" },
  { initials: "SR", color: EMERALD, name: "Sofia Ríos", time: "11:00", status: "Confirmada" },
];

const techItems = [
  { icon: Lock, label: "Row-Level Security" },
  { icon: Database, label: "PostgreSQL + Realtime" },
  { icon: Zap, label: "Edge Functions (Deno)" },
  { icon: Bot, label: "Claude Sonnet 4.6" },
  { icon: Shield, label: "JWT + roles separados" },
  { icon: TrendingUp, label: "Escala automática" },
];

const reveal = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.65, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

// ── PricingCardInner ──────────────────────────────────────────────────────────
function PricingCardInner({ plan }: { plan: typeof pricing[0] }) {
  return (
    <>
      {plan.featured && (
        <div style={{ marginBottom: 16 }}>
          <div className="pr-badge pr-badge-c">Más popular</div>
        </div>
      )}
      <div className="pr-h" style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0", marginBottom: 4, letterSpacing: "-0.02em" }}>{plan.name}</div>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>{plan.desc}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 24 }}>
        <span className="pr-h" style={{ fontSize: 42, fontWeight: 800, color: plan.featured ? CYAN : "#e2e8f0", letterSpacing: "-0.04em" }}>{plan.price}</span>
        {plan.period && <span style={{ fontSize: 13, color: "#64748b" }}>{plan.period}</span>}
      </div>
      <a href="mailto:contacto@integrika.mx?subject=Plan%20ClinicaMX" style={{ display: "block", marginBottom: 24 }}>
        <button className={`pr-btn ${plan.featured ? "pr-btn-p" : "pr-btn-o"}`} style={{ width: "100%", justifyContent: "center" }}>
          {plan.cta}
        </button>
      </a>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {plan.features.map((f) => (
          <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <CheckCircle2 size={15} color={plan.featured ? CYAN : EMERALD} style={{ marginTop: 1, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#94a3b8" }}>{f}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function Pitch() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mouse, setMouse] = useState({ x: -9999, y: -9999 });

  return (
    <div className="pr" onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}>
      <style>{PITCH_STYLES}</style>
      <ScrollProgress />

      {/* Global mouse spotlight */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: `radial-gradient(520px circle at ${mouse.x}px ${mouse.y}px, rgba(0,217,245,0.04), transparent 65%)`,
      }} />

      {/* ── NAV ────────────────────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(3,8,15,0.9)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,217,245,0.08)",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#00d9f5,#0891b2)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 22px rgba(0,217,245,0.45)" }}>
              <Activity size={17} color="#03080f" strokeWidth={2.5} />
            </div>
            <span className="pr-h" style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.03em", color: "#e2e8f0" }}>ClínicaMX</span>
          </div>
          <nav className="pr-nav-links" style={{ display: "none", gap: 32 }}>
            {navLinks.map((l) => (
              <a key={l.href} href={l.href}
                style={{ color: "#94a3b8", textDecoration: "none", fontSize: 14, fontWeight: 500, letterSpacing: "-0.01em", transition: "color .2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = CYAN)}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
              >{l.label}</a>
            ))}
          </nav>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a href="mailto:contacto@integrika.mx?subject=Demo%20ClinicaMX">
              <button className="pr-btn pr-btn-p" style={{ padding: "10px 20px", fontSize: 13 }}>Demo <ArrowRight size={14} /></button>
            </a>
            <button className="pr-mob-btn"
              style={{ background: "transparent", border: "1px solid rgba(0,217,245,0.2)", borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: "#e2e8f0" }}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div style={{ borderTop: "1px solid rgba(0,217,245,0.08)", background: "rgba(3,8,15,0.97)", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} style={{ color: "#94a3b8", textDecoration: "none", fontSize: 15, fontWeight: 500 }} onClick={() => setMobileOpen(false)}>{l.label}</a>
            ))}
          </div>
        )}
      </header>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section style={{ position: "relative", overflow: "hidden", paddingTop: 80, paddingBottom: 100 }}>
        <div className="pr-dots" style={{ position: "absolute", inset: 0, opacity: 0.5 }} />
        <div style={{ position: "absolute", top: "5%", right: "-8%", width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,217,245,.12) 0%,transparent 70%)", animation: "pr-float 10s ease-in-out infinite", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-10%", left: "-8%", width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle,rgba(167,139,250,.1) 0%,transparent 70%)", animation: "pr-float2 13s ease-in-out infinite", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "40%", left: "40%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle,rgba(52,211,153,.06) 0%,transparent 70%)", animation: "pr-float 15s ease-in-out infinite 3s", pointerEvents: "none" }} />

        <div style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div className="pr-hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 48, alignItems: "center" }}>
            {/* Copy */}
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
              <div className="pr-badge pr-badge-c" style={{ marginBottom: 24 }}>
                <Sparkles size={11} /> Hecho en México · para clínicas mexicanas
              </div>
              <h1 className="pr-h" style={{ fontSize: "clamp(40px,5vw,68px)", fontWeight: 800, lineHeight: 1.04, letterSpacing: "-0.04em", marginBottom: 24 }}>
                La operación de tu clínica,{" "}
                <span className="pr-shimmer">automatizada de verdad.</span>
              </h1>
              <p style={{ fontSize: 18, color: "#94a3b8", lineHeight: 1.7, marginBottom: 36, maxWidth: 520 }}>
                Bot de IA en Telegram y WhatsApp que agenda citas 24/7, recordatorios automáticos
                que reducen no-shows, expediente digital, facturación CFDI y todo auditado.{" "}
                <strong style={{ color: "#cbd5e1" }}>Listo para vender hoy.</strong>
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 36 }}>
                <a href="mailto:contacto@integrika.mx?subject=Demo%20ClinicaMX">
                  <button className="pr-btn pr-btn-p">Solicitar demo en vivo <ArrowRight size={16} /></button>
                </a>
                <Link to="/">
                  <button className="pr-btn pr-btn-o">Ver dashboard</button>
                </Link>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 20, fontSize: 13, color: "#64748b" }}>
                {["Sin instalación", "Onboarding en 48 h", "Datos en México"].map((t) => (
                  <div key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <CheckCircle2 size={14} color={CYAN} />{t}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* 3D Dashboard */}
            <motion.div className="pr-hero-card" style={{ display: "none" }}
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <TiltCard intensity={10} style={{ perspective: 1200 }}>
                <div className="pr-glass" style={{ borderRadius: 18, overflow: "hidden", boxShadow: "0 32px 96px rgba(0,0,0,.6),0 0 0 1px rgba(0,217,245,.12),0 0 80px rgba(0,217,245,.06)", transformStyle: "preserve-3d" }}>
                  <div style={{ background: "rgba(6,15,30,.9)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(0,217,245,.1)" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {["#ff5f57","#febc2e","#28c840"].map((c) => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
                    </div>
                    <span style={{ fontSize: 11, color: "rgba(148,163,184,.6)", fontFamily: "monospace", marginLeft: 8 }}>dashboard · recepción</span>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: EMERALD, boxShadow: `0 0 8px ${EMERALD}`, animation: "pr-ping 2s ease-in-out infinite" }} />
                      <span style={{ fontSize: 10, color: EMERALD }}>En vivo</span>
                    </div>
                  </div>
                  <div style={{ padding: 20 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
                      {[
                        { label: "Citas hoy", value: "12", icon: Calendar, color: CYAN },
                        { label: "Recordatorios", value: "8", icon: Bell, color: VIOLET },
                        { label: "Pacientes", value: "247", icon: Users, color: EMERALD },
                      ].map(({ label, value, icon: Icon, color }) => (
                        <div key={label} style={{ borderRadius: 12, background: `${color}08`, border: `1px solid ${color}22`, padding: 12 }}>
                          <Icon size={14} color={color} style={{ marginBottom: 6 }} />
                          <div className="pr-h" style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0" }}>{value}</div>
                          <div style={{ fontSize: 10, color: "#64748b" }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#475569", marginBottom: 8 }}>Próximas citas</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {mockAppointments.map((a) => (
                        <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.05)" }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: a.color + "22", border: `1px solid ${a.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: a.color, flexShrink: 0 }}>{a.initials}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                            <div style={{ fontSize: 10, color: "#475569" }}>{a.time}</div>
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: a.status === "Confirmada" ? EMERALD : "#f59e0b", background: (a.status === "Confirmada" ? EMERALD : "#f59e0b") + "18", padding: "2px 8px", borderRadius: 100, flexShrink: 0 }}>{a.status}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: `1px solid ${CYAN}22`, background: `${CYAN}04` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${CYAN}22`, border: `1px solid ${CYAN}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Bot size={11} color={CYAN} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: CYAN }}>Bot IA</span>
                        <span style={{ fontSize: 10, color: "#475569", marginLeft: "auto" }}>ahora</span>
                      </div>
                      <p style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
                        "Hola Laura, mañana a las 9:00 AM tienes cita con el Dr. García. ¿Confirmas tu asistencia?"
                      </p>
                    </div>
                  </div>
                </div>
              </TiltCard>
              {/* Hero doctor photo — accent card */}
              <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
                <div style={{
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.10)",
                  boxShadow: "0 0 0 1px rgba(0,217,245,0.18), 0 24px 64px rgba(0,0,0,0.55)",
                  overflow: "hidden",
                  maxWidth: 320,
                  width: "100%",
                }}>
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
                <TiltCard intensity={5}>
                  <div className="pr-glass pr-card" style={{ borderRadius: 16, padding: 24, border: `1px solid ${s.color}22` }}>
                    <div className="pr-h" style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em", color: s.color, lineHeight: 1, marginBottom: 6 }}>
                      {s.numeric !== null ? <AnimatedCounter value={s.numeric} suffix={s.suffix} /> : s.value}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#e2e8f0", marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{s.sub}</div>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEM ────────────────────────────────────────────────────────── */}
      <section style={{ padding: "96px 0", borderTop: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div className="pr-tech-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 48, alignItems: "center" }}>
            <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <div className="pr-label" style={{ marginBottom: 16 }}>El problema</div>
              <h2 className="pr-h" style={{ fontSize: "clamp(32px,4vw,48px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 24 }}>
                Recepción saturada, citas perdidas, expedientes en papel.
              </h2>
              <p style={{ color: "#94a3b8", lineHeight: 1.7, marginBottom: 16 }}>Las clínicas mexicanas pierden hasta el <span style={{ color: "#fca5a5", fontWeight: 600 }}>30% de sus citas</span> por no-shows, doble booking y recordatorios manuales por WhatsApp.</p>
              <p style={{ color: "#94a3b8", lineHeight: 1.7 }}>Las soluciones extranjeras no entienden RFC, CURP, CFDI ni el flujo de una recepción mexicana. Las locales se quedan cortas en tecnología.</p>
            </motion.div>
            <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1}>
              <div style={{ borderRadius: 18, border: "1px solid rgba(239,68,68,.2)", background: "rgba(239,68,68,.04)", padding: 32 }}>
                {[
                  "Recepción copia y pega recordatorios uno por uno",
                  "Pacientes llaman fuera de horario y nadie responde",
                  "Doble agendado por falta de validación en tiempo real",
                  "Expediente en Excel, sin trazabilidad de cambios",
                  "Facturación CFDI armada a mano con datos incompletos",
                ].map((p, i) => (
                  <motion.div key={p} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f87171", marginTop: 7, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6 }}>{p}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── MODULES ────────────────────────────────────────────────────────── */}
      <section id="modulos" style={{ padding: "96px 0", borderTop: "1px solid rgba(255,255,255,.06)", background: "rgba(0,217,245,.015)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 56px" }}>
            <div className="pr-label" style={{ marginBottom: 14 }}>Módulos</div>
            <h2 className="pr-h" style={{ fontSize: "clamp(30px,4vw,46px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 16 }}>
              Todo lo que tu clínica necesita, en un solo lugar.
            </h2>
            <p style={{ color: "#64748b", fontSize: 16 }}>Nueve módulos integrados, listos desde el primer día.</p>
          </motion.div>
          <div className="pr-mod-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
            {modules.map((m, i) => (
              <motion.div key={m.title} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} custom={i}>
                <TiltCard intensity={6}>
                  <div className="pr-glass pr-card pr-glow-border" style={{ borderRadius: 16, padding: 24, height: "100%", position: "relative", zIndex: 0 }}>
                    <div className="pr-icon-box" style={{ color: m.color, background: m.color + "15", borderColor: m.color + "30", marginBottom: 16 }}>
                      <m.icon size={20} />
                    </div>
                    <h3 className="pr-h" style={{ fontWeight: 700, fontSize: 17, marginBottom: 8, color: "#e2e8f0", letterSpacing: "-0.02em" }}>{m.title}</h3>
                    <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65 }}>{m.desc}</p>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS MARQUEE ───────────────────────────────────────────── */}
      <section style={{ padding: "96px 0", borderTop: "1px solid rgba(255,255,255,.06)", overflow: "hidden" }}>
        <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", marginBottom: 48, padding: "0 24px" }}>
          <div className="pr-label" style={{ marginBottom: 14 }}>Testimonios</div>
          <h2 className="pr-h" style={{ fontSize: "clamp(30px,4vw,46px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1 }}>
            Lo que dicen los médicos que ya lo usan.
          </h2>
        </motion.div>
        <div style={{ overflow: "hidden", marginBottom: 16 }}>
          <div className="pr-marq">
            {[...testimonials, ...testimonials].map((t, i) => (
              <div key={i} className="pr-glass" style={{ borderRadius: 16, padding: "22px 24px", minWidth: 320, maxWidth: 360, flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                  {Array.from({ length: 5 }).map((_, j) => <Star key={j} size={13} fill={CYAN} color={CYAN} />)}
                </div>
                <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.65, fontStyle: "italic", marginBottom: 16 }}>"{t.quote}"</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <img src={t.photoUrl} alt={t.name} style={{ width: 40, height: 40, borderRadius: "50%", border: `2px solid ${CYAN}33`, flexShrink: 0 }} loading="lazy" />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{t.role}</div>
                    {t.clinic && <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>{t.clinic}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ overflow: "hidden" }}>
          <div className="pr-marq-r">
            {[...testimonials, ...testimonials].reverse().map((t, i) => (
              <div key={i} className="pr-glass" style={{ borderRadius: 16, padding: "22px 24px", minWidth: 320, maxWidth: 360, flexShrink: 0, borderColor: `${VIOLET}22` }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                  {Array.from({ length: 5 }).map((_, j) => <Star key={j} size={13} fill={VIOLET} color={VIOLET} />)}
                </div>
                <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.65, fontStyle: "italic", marginBottom: 16 }}>"{t.quote}"</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <img src={t.photoUrl} alt={t.name} style={{ width: 40, height: 40, borderRadius: "50%", border: `2px solid ${VIOLET}33`, flexShrink: 0 }} loading="lazy" />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{t.role}</div>
                    {t.clinic && <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>{t.clinic}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FLOW ───────────────────────────────────────────────────────────── */}
      <section id="flujo" style={{ padding: "96px 0", borderTop: "1px solid rgba(255,255,255,.06)", background: "rgba(167,139,250,.015)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 56px" }}>
            <div className="pr-label" style={{ marginBottom: 14 }}>Cómo funciona</div>
            <h2 className="pr-h" style={{ fontSize: "clamp(30px,4vw,46px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1 }}>
              Del primer mensaje a la cita confirmada, sin tocar nada.
            </h2>
          </motion.div>
          {/* Lottie animation */}
          <div className="flex justify-center my-12">
            <div className="p-6 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10">
              <Lottie
                animationData={healthReportAnimation}
                loop
                autoplay
                style={{ width: 240, height: 240 }}
                className="opacity-90"
              />
            </div>
          </div>
          {/* Desktop horizontal */}
          <div className="pr-flow-h" style={{ display: "none", gap: 8, alignItems: "stretch" }}>
            {flow.map((s, i) => (
              <div key={s.step} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} style={{ flex: 1 }}>
                  <TiltCard intensity={5}>
                    <div className="pr-glass pr-card" style={{ borderRadius: 14, padding: 20, position: "relative", overflow: "hidden", height: "100%", border: `1px solid ${s.color}18` }}>
                      <div className="pr-h" style={{ position: "absolute", top: -4, right: 12, fontSize: 56, fontWeight: 800, color: s.color, opacity: 0.1 }}>{s.step}</div>
                      <div className="pr-icon-box" style={{ color: s.color, background: s.color + "15", borderColor: s.color + "30", marginBottom: 10 }}><s.icon size={18} /></div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: s.color, marginBottom: 6 }}>PASO {s.step}</div>
                      <h3 className="pr-h" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: "#e2e8f0", lineHeight: 1.3 }}>{s.title}</h3>
                      <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6 }}>{s.desc}</p>
                    </div>
                  </TiltCard>
                </motion.div>
                {i < flow.length - 1 && <ArrowRight size={16} color="#334155" style={{ flexShrink: 0 }} />}
              </div>
            ))}
          </div>
          {/* Mobile grid */}
          <div className="pr-flow-v" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
            {flow.map((s, i) => (
              <motion.div key={s.step} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}>
                <div className="pr-glass pr-card" style={{ borderRadius: 14, padding: 20, position: "relative", overflow: "hidden", border: `1px solid ${s.color}18` }}>
                  <div className="pr-h" style={{ position: "absolute", top: -4, right: 12, fontSize: 60, fontWeight: 800, color: s.color, opacity: 0.1 }}>{s.step}</div>
                  <div className="pr-icon-box" style={{ color: s.color, background: s.color + "15", borderColor: s.color + "30", marginBottom: 10 }}><s.icon size={18} /></div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: s.color, marginBottom: 6 }}>PASO {s.step}</div>
                  <h3 className="pr-h" style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: "#e2e8f0" }}>{s.title}</h3>
                  <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DIFFERENTIATORS ────────────────────────────────────────────────── */}
      <section id="diferenciadores" style={{ padding: "96px 0", borderTop: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 56px" }}>
            <div className="pr-badge pr-badge-v" style={{ marginBottom: 16 }}>¿Por qué nosotros?</div>
            <h2 className="pr-h" style={{ fontSize: "clamp(30px,4vw,46px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1 }}>
              Cuatro razones por las que ganamos contra cualquier competidor.
            </h2>
          </motion.div>
          <div className="pr-diff-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
            {differentiators.map((d, i) => (
              <motion.div key={d.title} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}>
                <TiltCard intensity={6}>
                  <div className="pr-glass pr-card pr-glow-border" style={{ borderRadius: 16, padding: 32, height: "100%", position: "relative", zIndex: 0 }}>
                    <div className="pr-icon-box" style={{ color: d.color, background: d.color + "15", borderColor: d.color + "30", marginBottom: 20, width: 52, height: 52, borderRadius: 14 }}>
                      <d.icon size={22} />
                    </div>
                    <h3 className="pr-h" style={{ fontWeight: 700, fontSize: 20, marginBottom: 10, color: "#e2e8f0", letterSpacing: "-0.02em" }}>{d.title}</h3>
                    <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7 }}>{d.desc}</p>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STACK ──────────────────────────────────────────────────────────── */}
      <section style={{ padding: "96px 0", borderTop: "1px solid rgba(255,255,255,.06)", background: "rgba(0,217,245,.012)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div className="pr-tech-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 56, alignItems: "center" }}>
            <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <div className="pr-label" style={{ marginBottom: 16 }}>Tecnología</div>
              <h2 className="pr-h" style={{ fontSize: "clamp(30px,4vw,46px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 20 }}>
                Stack moderno, infraestructura empresarial.
              </h2>
              <p style={{ color: "#64748b", lineHeight: 1.7, marginBottom: 28 }}>
                Construido sobre React 18, TypeScript y PostgreSQL. Edge functions serverless que escalan a millones de pacientes. Realtime nativo. Backups automáticos.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
                {techItems.map(({ icon: Icon, label }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: `${CYAN}06`, border: `1px solid ${CYAN}14` }}>
                    <Icon size={15} color={CYAN} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#cbd5e1" }}>{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1}>
              <TiltCard intensity={6}>
                <div className="pr-glass" style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.4),0 0 0 1px rgba(0,217,245,.1)" }}>
                  <div style={{ background: "rgba(6,14,28,.9)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(0,217,245,.1)" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {["#ff5f57","#febc2e","#28c840"].map((c) => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
                    </div>
                    <span style={{ fontSize: 11, color: "rgba(148,163,184,.5)", fontFamily: "monospace", marginLeft: 8 }}>arquitectura</span>
                  </div>
                  <div style={{ padding: 24, fontFamily: "monospace", fontSize: 13, lineHeight: 2 }}>
                    <div style={{ color: "#475569" }}>{"// Flujo end-to-end"}</div>
                    {[
                      { a: CYAN, b: "Paciente", c: "#64748b", d: " → ", e: "#e2e8f0", f: "Telegram / WhatsApp" },
                      { a: "#64748b", b: "  ↓ webhook", c: "", d: "", e: "", f: "" },
                      { a: VIOLET, b: "Claude (tool use)", c: "#64748b", d: " → BD", e: "", f: "" },
                      { a: "#64748b", b: "  ↓", c: "", d: "", e: "", f: "" },
                      { a: CYAN, b: "appointments", c: "#64748b", d: " + ", e: EMERALD, f: "recordatorios_cita" },
                      { a: "#64748b", b: "  ↓", c: "", d: "", e: "", f: "" },
                      { a: "#f59e0b", b: "pg_cron", c: "#64748b", d: " (5 min) → ", e: "#e2e8f0", f: "enviar-recordatorios" },
                      { a: "#64748b", b: "  ↓", c: "", d: "", e: "", f: "" },
                      { a: EMERALD, b: "Dashboard recepción", c: "#64748b", d: " (realtime)", e: "", f: "" },
                    ].map((row, idx) => (
                      <div key={idx}>
                        <span style={{ color: row.a }}>{row.b}</span>
                        <span style={{ color: row.c }}>{row.d}</span>
                        <span style={{ color: row.e }}>{row.f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </TiltCard>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────────────────────────── */}
      <section id="precios" style={{ padding: "96px 0", borderTop: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 56px" }}>
            <div className="pr-label" style={{ marginBottom: 14 }}>Precios</div>
            <h2 className="pr-h" style={{ fontSize: "clamp(30px,4vw,46px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 14 }}>
              Planes claros. Sin sorpresas.
            </h2>
            <p style={{ color: "#64748b" }}>Todos los precios en pesos mexicanos. Factura con CFDI.</p>
          </motion.div>
          <div className="pr-price-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
            {pricing.map((p, i) => (
              <motion.div key={p.name} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}>
                {p.featured ? (
                  <div className="pr-featured-wrap">
                    <div style={{ background: "#060e1e", borderRadius: 17, padding: 32 }}>
                      <PricingCardInner plan={p} />
                    </div>
                  </div>
                ) : (
                  <TiltCard intensity={5}>
                    <div className="pr-glass pr-card" style={{ borderRadius: 16, padding: 32 }}>
                      <PricingCardInner plan={p} />
                    </div>
                  </TiltCard>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section style={{ padding: "120px 0", borderTop: "1px solid rgba(255,255,255,.06)", position: "relative", overflow: "hidden" }}>
        <div className="pr-dots" style={{ position: "absolute", inset: 0, opacity: 0.3 }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,217,245,.08) 0%,transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: 700, margin: "0 auto", padding: "0 24px", textAlign: "center" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: `${CYAN}14`, border: `1px solid ${CYAN}25`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", boxShadow: `0 0 40px ${CYAN}20` }}>
              <Calendar size={28} color={CYAN} />
            </div>
            <h2 className="pr-h" style={{ fontSize: "clamp(36px,5vw,60px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05, marginBottom: 20 }}>
              ¿Listo para ver tu clínica{" "}
              <span className="pr-shimmer">funcionando sola?</span>
            </h2>
            <p style={{ fontSize: 18, color: "#64748b", marginBottom: 40, lineHeight: 1.7 }}>
              Te mostramos el sistema completo con datos reales en una llamada de 30 minutos.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", marginBottom: 36 }}>
              <a href="mailto:contacto@integrika.mx?subject=Demo%20ClinicaMX">
                <button className="pr-btn pr-btn-p" style={{ fontSize: 16, padding: "16px 36px" }}>Agendar demo <ArrowRight size={18} /></button>
              </a>
              <a href="mailto:contacto@integrika.mx?subject=One-pager%20ClinicaMX">
                <button className="pr-btn pr-btn-o" style={{ fontSize: 16, padding: "16px 36px" }}>Descargar one-pager</button>
              </a>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 24, fontSize: 13, color: "#475569" }}>
              {["Sin tarjeta de crédito", "Onboarding incluido", "Cancela cuando quieras"].map((t) => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 size={13} color={CYAN} /> {t}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,.06)", padding: "28px 0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", display: "flex", flexDirection: "column", gap: 8, alignItems: "center", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: "linear-gradient(135deg,#00d9f5,#0891b2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Activity size={14} color="#03080f" strokeWidth={2.5} />
            </div>
            <span className="pr-h" style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0", letterSpacing: "-0.02em" }}>ClínicaMX SaaS</span>
            <span style={{ fontSize: 13, color: "#334155" }}>· Hecho en México</span>
          </div>
          <div style={{ fontSize: 12, color: "#334155" }}>© 2026 · Todos los derechos reservados</div>
          <div className="mt-12 pt-8 border-t border-white/10" style={{ width: "100%" }}>
            <p className="text-xs text-white/40 text-center px-4">
              Animación "Online Health Report" por{" "}
              <a
                href="https://iconscout.com/es/contributors/victoria-motion/:assets"
                className="underline hover:text-white/60"
                target="_blank" rel="noopener noreferrer"
              >Victoria Shelest</a>
              {" "}en{" "}
              <a
                href="https://iconscout.com"
                className="underline hover:text-white/60"
                target="_blank" rel="noopener noreferrer"
              >IconScout</a>
              . Fotografías de Unsplash.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
