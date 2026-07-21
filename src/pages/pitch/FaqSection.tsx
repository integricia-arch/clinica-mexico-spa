import { useState } from "react";
import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { TEAL, SLATE, reveal } from "./pitchShared";

const faqs = [
  { q: "¿Cuánto tiempo tarda el onboarding?", a: "48 horas para la configuración básica. El plan Profesional incluye onboarding asistido con capacitación a tu equipo. La mayoría de las clínicas están operando en menos de una semana." },
  { q: "¿Mis datos están seguros en México?", a: "Sí. Usamos Supabase con servidores en la región de Norteamérica. Row-Level Security en cada tabla, backups automáticos diarios, y Cloudflare WAF con modo de reto para IPs fuera de México. Tus datos nunca salen de tu instancia." },
  { q: "¿Funciona con mi PAC actual para CFDI?", a: "Usamos Facturama como PAC certificado por el SAT. Si ya tienes otro PAC, podemos evaluarlo. La migración de CSD (certificado de sello digital) se hace de forma segura via Vault cifrado." },
  { q: "¿El bot de Telegram reemplaza a mi recepcionista?", a: "Complementa. El bot maneja el 80% de las consultas rutinarias (agendar, cancelar, confirmar, preguntas frecuentes). Tu recepcionista atiende lo que requiere criterio humano. El resultado: menos carga, más capacidad." },
  { q: "¿Qué pasa si el sistema falla?", a: "Monitoreo 24/7 con BetterStack. Uptime histórico >99.8%. Las Edge Functions de Deno tienen auto-restart. En caso de incidente, el equipo recibe alerta automática en menos de 2 minutos." },
];

/** FAQ de /pitch. Extraída de Pitch.tsx (E2) — faqOpen y faqs no se usan fuera de esta sección. */
export default function FaqSection() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  return (
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
                style={{ borderRadius: 14, border: `1px solid ${faqOpen === i ? TEAL + "40" : "#e2e8f0"}`, background: faqOpen === i ? "#f0fdff" : "#fff", transition: "border-color 200ms ease, background-color 200ms ease" }}
              >
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  style={{ width: "100%", padding: "18px 20px", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, textAlign: "left" }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14, color: "#0f172a", lineHeight: 1.5 }}>{faq.q}</span>
                  <span style={{ flexShrink: 0, display: "flex", transition: "transform 220ms cubic-bezier(0.77,0,0.175,1)", transform: faqOpen === i ? "rotate(180deg)" : "rotate(0deg)" }}>
                    <ChevronDown size={16} color={faqOpen === i ? TEAL : "#64748b"} />
                  </span>
                </button>
                <div style={{ display: "grid", gridTemplateRows: faqOpen === i ? "1fr" : "0fr", transition: "grid-template-rows 240ms cubic-bezier(0.77,0,0.175,1)" }}>
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ padding: "0 20px 18px", fontSize: 14, color: SLATE, lineHeight: 1.75, opacity: faqOpen === i ? 1 : 0, transition: `opacity ${faqOpen === i ? "200ms 60ms" : "120ms"} ease` }}>
                      {faq.a}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
