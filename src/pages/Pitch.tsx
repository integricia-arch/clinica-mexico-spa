import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, MotionConfig } from "motion/react";
import Logo from "@/components/Logo";
import {
  Shield,
  ArrowRight, Lock, Activity, Zap,
  TrendingUp, Database, Menu, X,
  ScanLine, ChevronDown, ChevronUp,
  Globe,
} from "lucide-react";
import {
  PITCH_STYLES, ScrollProgress, TEAL, GREEN, reveal, navLinks, stats,
  modules, competitors, flow, pricing, casoEstudio, CellVal, PricingCard,
  DashboardMockup, AnimatedCounter,
} from "./pitch/pitchShared";
import RoiCalculatorSection from "./pitch/RoiCalculatorSection";
import FaqSection from "./pitch/FaqSection";

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Pitch() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <MotionConfig reducedMotion="user">
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
            <span style={{ fontSize: 10, color: "#64748b", paddingLeft: 4, borderLeft: "1px solid #e2e8f0", marginLeft: 2, display: "none" }} className="pr-nav-links">Sistema Operativo de Clínica</span>
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
              style={{ background: "transparent", border: "1px solid #e2e8f0", borderRadius: 8, padding: "13px 15px", cursor: "pointer", color: "#0f172a", minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div style={{ borderTop: "1px solid #e2e8f0", background: "#fff", padding: "8px 24px 16px", display: "flex", flexDirection: "column" }}>
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} style={{ color: "#475569", textDecoration: "none", fontSize: 15, fontWeight: 500, padding: "12px 0", minHeight: 44, display: "flex", alignItems: "center" }} onClick={() => setMobileOpen(false)}>{l.label}</a>
            ))}
          </div>
        )}
      </header>

      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden", paddingTop: 80, paddingBottom: 96, background: "linear-gradient(170deg,#f0fdff 0%,#f8fafc 60%,#fff 100%)" }}>
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
              <p style={{ fontSize: 14, color: "#64748b", marginBottom: 32, maxWidth: 440 }}>
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
                  <div style={{ fontSize: 12, color: "#64748b" }}>{s.sub}</div>
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
      <RoiCalculatorSection />



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
            <ArrowRight size={14} color="#cbd5e1" style={{ flexShrink: 0, transform: "scaleY(-1)" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 14px", borderRadius: 12, border: `1.5px dashed ${TEAL}`, color: TEAL, fontWeight: 700, fontSize: 11, textAlign: "center", flexShrink: 0, width: 120 }}>
              ↻ vuelve al paso 01
            </div>
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
            <div style={{ marginTop: 8, padding: "14px 16px", borderRadius: 12, background: "#fff", border: `1.5px dashed ${TEAL}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: TEAL, fontWeight: 700, fontSize: 13 }}>
              <ArrowRight size={16} style={{ transform: "rotate(-90deg)" }} />
              ↻ vuelve al paso 01 — el bot ya está listo para el siguiente mensaje
            </div>
          </div>
        </div>
      </section>

      {/* CICLO 360 */}
      <section id="ciclo360" style={{ padding: "96px 0", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
        <style>{`
          .pr-360-wrap { display: none; container-type: inline-size; }
          .pr-360-v { display: grid; grid-template-columns: 1fr; gap: 12px; }
          @media (min-width: 1024px) {
            .pr-360-wrap { display: block; }
            .pr-360-v { display: none; }
          }
          .pr-360-node { width: clamp(140px, 15cqi, 200px); }
          .pr-360-dot {
            position: absolute; width: 14px; height: 14px; border-radius: 50%;
            background: #0891B2; box-shadow: 0 0 0 4px rgba(8,145,178,.20), 0 0 16px rgba(8,145,178,.55);
            transform: translate(-50%,-50%);
            animation: pr-orbit-dot ${CICLO_360_DUR}s linear infinite;
          }
          @keyframes pr-360-pulse {
            0% { box-shadow: 0 12px 28px rgba(8,145,178,.32); border-color: #0891B2; transform: translateY(-2px); }
            12% { box-shadow: none; border-color: inherit; transform: translateY(0); }
            100% { box-shadow: none; border-color: inherit; transform: translateY(0); }
          }
          .pr-360-node-pulse { animation: pr-360-pulse ${CICLO_360_DUR}s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) { .pr-360-dot, .pr-360-node-pulse { animation: none; } }
        `}</style>

        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 52px" }}>
            <div className="pr-label-g" style={{ marginBottom: 14 }}>El ciclo completo</div>
            <h2 className="pr-h" style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.08, color: "#0f172a" }}>
              Los extremos se juntan: desde que tu paciente escribe hasta que tu farmacia se reabastece.
            </h2>
            <p style={{ marginTop: 14, fontSize: 15, color: "#64748b", lineHeight: 1.6 }}>
              Un solo sistema conecta redes sociales, agenda, consulta, receta, farmacia, almacén y compras a proveedor. Todo auditado, todo en tiempo real.
            </p>
          </motion.div>

          {(() => {
            const flow360 = [
              { icon: MessageCircle, title: "Redes / Telegram", desc: "Paciente escribe" },
              { icon: Bot, title: "Bot agenda", desc: "IA confirma cita validando disponibilidad real en BD" },
              { icon: Bell, title: "Recordatorios", desc: "T-24h y T-2h; escala a Inbox si hace falta" },
              { icon: Stethoscope, title: "Consulta", desc: "Doctor hace triage, nota y expediente" },
              { icon: FileText, title: "Receta", desc: "Receta electrónica emitida y auditada" },
              { icon: Pill, title: "Farmacia", desc: "Surte receta y cobra en punto de venta" },
              { icon: Package, title: "Almacén", desc: "Inventario se descuenta por lote automáticamente" },
              { icon: AlertTriangle, title: "Reorden", desc: "Stock bajo dispara solicitud de insumos" },
              { icon: ShoppingCart, title: "Cotización", desc: "Sistema pide cotización a proveedor" },
              { icon: CreditCard, title: "Orden de compra", desc: "OC generada y enviada" },
              { icon: Building2, title: "Recepción", desc: "Mercancía entra a almacén, stock se repone" },
              { icon: ClipboardCheck, title: "Cierre", desc: "Caja concilia, todo queda auditado con usuario y timestamp" },
            ];
            const W = 1240, H = 760, cx = W / 2, cy = H / 2, rx = 500, ry = 300;
            const N = flow360.length;
            // Ángulo uniforme (-90° + i*360/N) da nodos DESIGUALMENTE espaciados
            // en una elipse con rx≠ry: la velocidad de arco varía con el ángulo,
            // así que las cajas cerca de los polos izq/der quedaban más juntas
            // que arriba/abajo (llegaban a traslaparse). Se reemplaza por
            // muestreo de arco-longitud uniforme: mismo espacio real entre cajas
            // sin importar el punto de la elipse.
            const ARC_SAMPLES = 3600;
            const arcThetas = (() => {
              const dtheta = (2 * Math.PI) / ARC_SAMPLES;
              const cumLen = [0];
              let prevX = rx, prevY = 0; // theta=0
              for (let s = 1; s <= ARC_SAMPLES; s++) {
                const theta = s * dtheta;
                const x = rx * Math.cos(theta), y = ry * Math.sin(theta);
                cumLen.push(cumLen[s - 1] + Math.hypot(x - prevX, y - prevY));
                prevX = x; prevY = y;
              }
              const total = cumLen[ARC_SAMPLES];
              const thetaAt = (targetLen: number) => {
                let lo = 0, hi = ARC_SAMPLES;
                while (lo < hi) {
                  const mid = (lo + hi) >> 1;
                  if (cumLen[mid] < targetLen) lo = mid + 1; else hi = mid;
                }
                const idx = Math.max(lo, 1);
                const l0 = cumLen[idx - 1], l1 = cumLen[idx];
                const frac = l1 > l0 ? (targetLen - l0) / (l1 - l0) : 0;
                return (idx - 1 + frac) * dtheta;
              };
              return Array.from({ length: N + 1 }, (_, i) => {
                const startOffset = (total * 0.75) % total; // theta=0 → arranca en -90°
                return thetaAt((startOffset + (i / N) * total) % total);
              });
            })();
            // Keyframes generados con los mismos ángulos que posicionan cada
            // tarjeta — el punto pasa exacto por cada nodo en su fracción de
            // tiempo correspondiente (i/N).
            const orbitStops = arcThetas.map((theta, i) => {
              const px = ((cx + rx * Math.cos(theta)) / W) * 100;
              const py = ((cy + ry * Math.sin(theta)) / H) * 100;
              return `${((i / N) * 100).toFixed(3)}% { left: ${px.toFixed(3)}%; top: ${py.toFixed(3)}%; }`;
            }).join(" ");

            return (
              <>
                {/* Desktop: SVG ellipse with nodes */}
                <div className="pr-360-wrap" style={{ position: "relative", width: "100%", maxWidth: W, margin: "0 auto", aspectRatio: `${W} / ${H}` }}>
                  <style>{`@keyframes pr-orbit-dot { ${orbitStops} }`}</style>
                  <svg viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="#e2e8f0" strokeWidth={1.5} strokeDasharray="4 6" />
                    {/* arrow indicating "vuelve a empezar" near node 1 */}
                    <path
                      d={`M ${cx + rx * Math.cos(-Math.PI / 2 - 0.35)} ${cy + ry * Math.sin(-Math.PI / 2 - 0.35)} A ${rx} ${ry} 0 0 1 ${cx + rx * Math.cos(-Math.PI / 2 - 0.05)} ${cy + ry * Math.sin(-Math.PI / 2 - 0.05)}`}
                      fill="none" stroke={TEAL} strokeWidth={2} markerEnd="url(#pr-arrow)"
                    />
                    <defs>
                      <marker id="pr-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill={TEAL} />
                      </marker>
                    </defs>
                  </svg>

                  {/* animated orbit dot */}
                  <div className="pr-360-dot" />

                  {/* center label */}
                  <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <Logo size="xl" imgClassName="pr-360-logo" />
                    <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#64748b" }}>360° · y vuelve a empezar</div>
                  </div>

                  {flow360.map((s, i) => {
                    const theta = arcThetas[i];
                    const x = cx + rx * Math.cos(theta);
                    const y = cy + ry * Math.sin(theta);
                    const color = i % 2 === 0 ? TEAL : GREEN;
                    const leftPct = (x / W) * 100;
                    const topPct = (y / H) * 100;
                    return (
                      // Positioning/centering vive en un div estático: Framer Motion
                      // controla `transform` para animar `y` en variants={reveal}, y
                      // pisaba el translate(-50%,-50%) puesto antes en el mismo
                      // motion.div — las cajas quedaban corridas fuera de la curva.
                      <div
                        key={i}
                        style={{ position: "absolute", left: `${leftPct}%`, top: `${topPct}%`, transform: "translate(-50%,-50%)" }}
                        className="pr-360-node"
                      >
                        <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}>
                          <div className="pr-card pr-360-node-pulse" style={{ padding: 12, borderColor: color + "33", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center", animationDelay: `${(i * CICLO_360_DUR) / N}s` }}>
                            <div className="pr-icon-box" style={{ color, background: color + "14", borderColor: color + "28", width: 38, height: 38 }}>
                              <s.icon size={16} />
                            </div>
                            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color }}>
                              PASO {String(i + 1).padStart(2, "0")}
                            </div>
                            <h3 className="pr-h" style={{ fontWeight: 700, fontSize: 12, color: "#0f172a", lineHeight: 1.25 }}>{s.title}</h3>
                            <p style={{ fontSize: 10.5, color: "#64748b", lineHeight: 1.4 }}>{s.desc}</p>
                          </div>
                        </motion.div>
                      </div>
                    );
                  })}
                </div>

                {/* Mobile: vertical list */}
                <div className="pr-360-v">
                  {flow360.map((s, i) => {
                    const color = i % 2 === 0 ? TEAL : GREEN;
                    return (
                      <motion.div key={i} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}>
                        <div className="pr-card" style={{ padding: 16, borderColor: color + "22", display: "flex", gap: 14, alignItems: "flex-start" }}>
                          <div className="pr-icon-box" style={{ color, background: color + "14", borderColor: color + "28", flexShrink: 0 }}>
                            <s.icon size={18} />
                          </div>
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color, marginBottom: 4 }}>
                              PASO {String(i + 1).padStart(2, "0")}
                            </div>
                            <h3 className="pr-h" style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: "#0f172a" }}>{s.title}</h3>
                            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{s.desc}</p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  <div style={{ marginTop: 8, padding: "14px 16px", borderRadius: 12, background: "#fff", border: `1.5px dashed ${TEAL}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: TEAL, fontWeight: 700, fontSize: 13 }}>
                    <ArrowRight size={16} style={{ transform: "rotate(-90deg)" }} />
                    ↻ vuelve al paso 01 — el ciclo no se detiene
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </section>

      {/* CASO DE ESTUDIO ILUSTRATIVO */}
      <section style={{ padding: "96px 0", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 52px" }}>
            <div className="pr-label" style={{ marginBottom: 14 }}>Caso de estudio</div>
            <h2 className="pr-h" style={{ fontSize: "clamp(26px,4vw,40px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, color: "#0f172a" }}>
              Lo que buscamos resolver, en una clínica tipo.
            </h2>
            <p style={{ marginTop: 12, fontSize: 13, color: SLATE }}>
              Escenario ilustrativo, no es un testimonio de cliente real — ver base al pie.
            </p>
          </motion.div>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div className="pr-card pr-caso-grid" style={{ padding: 0, display: "grid", gridTemplateColumns: "1fr", overflow: "hidden" }}>
              <div style={{ position: "relative", minHeight: 220 }}>
                <img
                  src={casoEstudio.fotoUrl}
                  alt={casoEstudio.fotoAlt}
                  style={{ width: "100%", height: "100%", minHeight: 220, objectFit: "cover", display: "block" }}
                  loading="lazy"
                />
              </div>
              <div style={{ padding: 28 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: TEAL, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 14 }}>
                  {casoEstudio.clinica}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>Problema</div>
                  <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.7 }}>{casoEstudio.problema}</p>
                </div>

                <div style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: GREEN, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>Implementación</div>
                  <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.7 }}>{casoEstudio.implementacion}</p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginBottom: 18 }}>
                  {casoEstudio.metricas.map((m) => (
                    <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: "#f0fdff", border: "1px solid #e2e8f0" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: `${TEAL}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <m.icon size={17} color={TEAL} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{m.label}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>{m.antes} → <strong style={{ color: GREEN }}>{m.despues}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ paddingTop: 14, borderTop: "1px solid #f1f5f9", fontSize: 11, color: SLATE }}>
                  {casoEstudio.base}
                </div>
              </div>
            </div>
          </motion.div>
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
          <div className="pr-mod-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
            {[
              { icon: Bot, label: "Claude Sonnet 4.6", color: "#7c3aed", desc: "El motor detrás del bot: entiende lenguaje natural real, no guiones fijos. Menos “no entendí tu mensaje”, más citas resueltas sin que tu equipo intervenga." },
              { icon: Database, label: "PostgreSQL + Realtime", color: TEAL, desc: "La misma base de datos que usan bancos y gobiernos. “Realtime” significa que cada cambio se ve al instante en todas las pantallas de tu equipo, sin refrescar." },
              { icon: Lock, label: "Row-Level Security", color: GREEN, desc: "Regla que vive dentro de la base de datos: cada consulta trae solo los datos de tu clínica, nunca los de otra. Tus datos de pacientes nunca se mezclan con los de otro cliente." },
              { icon: Zap, label: "Edge Functions (Deno)", color: "#d97706", desc: "Donde vive la lógica de cobros y validaciones — corre en servidores aislados, nunca en el navegador. Nadie puede manipular un descuento o un cobro desde su computadora." },
              { icon: Globe, label: "Cloudflare Workers + WAF", color: TEAL, desc: "La misma infraestructura que protege a bancos y tiendas grandes de internet. Filtra tráfico malicioso automáticamente, 24/7, antes de que llegue al sistema." },
              { icon: Shield, label: "JWT + Supabase Vault", color: GREEN, desc: "Cada usuario recibe un “pase” firmado digitalmente para entrar, sin mandar su contraseña en cada clic. Las claves más sensibles viven cifradas aparte, nunca a la vista." },
              { icon: TrendingUp, label: "BetterStack Monitoring", color: "#7c3aed", desc: "Un sistema externo vigila la plataforma 24/7 y avisa al equipo técnico en minutos si algo falla — antes de que tú o tus pacientes lo noten." },
              { icon: ScanLine, label: "Stripe", color: TEAL, desc: "Los cobros los procesa la misma pasarela que usan Amazon y Shopify — tu clínica nunca guarda ni ve el número de tarjeta completo." },
            ].map(({ icon: Icon, label, color, desc }) => (
              <motion.div key={label} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <div className="pr-card" style={{ padding: 20, height: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Icon size={16} color={color} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{label}</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: SLATE, lineHeight: 1.6, margin: 0 }}>{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <p style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "#64748b" }}>
            Facturación electrónica (CFDI) vía integración con PAC certificado por el SAT — detalle del proveedor pendiente de confirmar públicamente.
          </p>
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
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ marginTop: 32 }}>
            <div style={{ borderRadius: 16, background: "linear-gradient(135deg,#f0fdff,#f0fdf4)", border: "1px solid #a5f3fc", padding: 28 }}>
              <div className="pr-h" style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
                Lo que cuesta un doctor más, en otros países
              </div>
              <p style={{ fontSize: 13, color: SLATE, marginBottom: 16, maxWidth: 560 }}>
                El software médico en EE. UU. cobra por proveedor. IntegriKa Profesional cubre hasta 15 doctores dentro de un solo precio fijo.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                {[
                  { label: "DrChrono, por doctor/mes", price: "$3,500–$10,800" },
                  { label: "Kareo, por doctor/mes", price: "$6,300–$6,700" },
                  { label: "Aspel SAE, solo CFDI/usuario", price: "$1,108 + IVA" },
                ].map(({ label, price }) => (
                  <div key={label} style={{ padding: "8px 14px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0", fontSize: 13 }}>
                    <span style={{ color: "#475569" }}>{label} </span>
                    <span style={{ fontWeight: 700, color: "#dc2626" }}>{price} MXN</span>
                  </div>
                ))}
                <div style={{ padding: "8px 14px", borderRadius: 10, background: "#fee2e2", border: "1px solid #fca5a5", fontSize: 13, fontWeight: 700, color: "#dc2626" }}>
                  Multiplicado × 15 doctores: fácil pasa de $50,000 MXN/mes
                </div>
              </div>
              <div style={{ padding: "12px 18px", borderRadius: 12, background: "#059669", color: "#fff", display: "inline-flex", gap: 10, alignItems: "center" }}>
                <CheckCircle2 size={16} color="#fff" />
                <span style={{ fontWeight: 700, fontSize: 14 }}>IntegriKa Profesional: $5,999/mes · hasta 15 doctores · CFDI incluido</span>
              </div>
            </div>
          </motion.div>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ marginTop: 24, textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "#64748b" }}>
              ¿Necesitas migrar datos de otro sistema? ¿Integración con tu ERP? <a href="mailto:contacto@integrika.mx" style={{ color: TEAL, fontWeight: 500 }}>Escríbenos</a> y lo evaluamos sin costo.
            </p>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <FaqSection />


      {/* CTA FINAL */}
      <section style={{ padding: "112px 0", background: TEAL, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,.07) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: 700, margin: "0 auto", padding: "0 24px", textAlign: "center" }}>
          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px" }}>
              <Activity size={28} color="#fff" strokeWidth={2} />
            </div>
            <h2 className="pr-h" style={{ fontSize: "clamp(30px,5vw,52px)", fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1.06, marginBottom: 18, color: "#fff" }}>
              ¿Listo para que tu clínica funcione sola?
            </h2>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,.95)", marginBottom: 38, lineHeight: 1.75 }}>
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
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 22, fontSize: 13, color: "rgba(255,255,255,.95)" }}>
              {["Sin tarjeta de crédito", "Onboarding incluido", "14 días de prueba gratis", "Datos en México"].map((t) => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 size={12} color="rgba(255,255,255,.95)" /> {t}
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
              <span style={{ fontSize: 12, color: "#64748b" }}>· Sistema Operativo de Clínica · México</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { href: "/aviso-privacidad", label: "Privacidad" },
                { href: "/terminos", label: "Términos" },
                { href: "mailto:contacto@integrika.mx", label: "Contacto" },
              ].map(({ href, label }) => (
                <a key={label} href={href} style={{ fontSize: 13, color: "#64748b", textDecoration: "none", padding: "12px 8px", minHeight: 44, display: "flex", alignItems: "center" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = TEAL)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
                >{label}</a>
              ))}
            </div>
          </div>
          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 16, fontSize: 12, color: "#64748b", textAlign: "center" }}>
            © 2026 IntegriKa · Todos los derechos reservados · Hecho con orgullo en México 🇲🇽
          </div>
        </div>
      </footer>
    </div>
    </MotionConfig>
  );
}
