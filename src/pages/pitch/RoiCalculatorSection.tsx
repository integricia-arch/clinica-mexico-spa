import { useState } from "react";
import { motion } from "motion/react";
import { Info, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import { TEAL, GREEN, SLATE, reveal } from "./pitchShared";

/**
 * Calculadora de ROI en /pitch. Extraída de Pitch.tsx (E2 — partir archivos
 * >800 líneas) porque su estado (5 inputs numéricos + drafts de texto + plan
 * seleccionado) no se usa en ninguna otra sección de la landing.
 */
export default function RoiCalculatorSection() {
  const roiInputs = {
    ticketPromedio:     { min: 200, max: 3000,   step: 50,   decimals: 2, default: 800 },
    noShowsPorSemana:   { min: 0,   max: 20,     step: 1,    decimals: 0, default: 1 },
    inventarioFarmacia: { min: 0,   max: 500000, step: 1000, decimals: 2, default: 80000 },
    citasRecuperadas:   { min: 0,   max: 20,     step: 1,    decimals: 0, default: 3 },
    salarioSecretaria:  { min: 0,   max: 30000,  step: 500,  decimals: 2, default: 7500 },
  } as const;
  type RoiKey = keyof typeof roiInputs;

  const [ticketPromedio, setTicketPromedio] = useState<number>(roiInputs.ticketPromedio.default);
  const [noShowsPorSemana, setNoShowsPorSemana] = useState<number>(roiInputs.noShowsPorSemana.default);
  const [inventarioFarmacia, setInventarioFarmacia] = useState<number>(roiInputs.inventarioFarmacia.default);
  const [citasRecuperadas, setCitasRecuperadas] = useState<number>(roiInputs.citasRecuperadas.default);
  const [salarioSecretaria, setSalarioSecretaria] = useState<number>(roiInputs.salarioSecretaria.default);
  const [planSeleccionado, setPlanSeleccionado] = useState(2499);
  const [roiInfoOpen, setRoiInfoOpen] = useState(false);

  // Raw text mirror per input — lets the user type intermediate strings ("1,", "1.5")
  // without React clobbering the caret. Committed to numeric state on blur/Enter.
  const [roiDrafts, setRoiDrafts] = useState<Record<RoiKey, string | null>>({
    ticketPromedio: null, noShowsPorSemana: null, inventarioFarmacia: null,
    citasRecuperadas: null, salarioSecretaria: null,
  });

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const formatNumberInput = (n: number, decimals: number) =>
    new Intl.NumberFormat("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(n);

  // Accepts both es-MX ("1.234,56") and en-US ("1,234.56"): the last "," or "."
  // is the decimal separator; the rest are stripped as thousands separators.
  const parseLocalizedNumber = (raw: string): number | null => {
    const cleaned = raw.replace(/[^\d.,-]/g, "").trim();
    if (cleaned === "" || cleaned === "-" || cleaned === "," || cleaned === ".") return null;
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    const decIdx = Math.max(lastComma, lastDot);
    let intPart = cleaned;
    let decPart = "";
    if (decIdx !== -1) {
      intPart = cleaned.slice(0, decIdx);
      decPart = cleaned.slice(decIdx + 1);
    }
    intPart = intPart.replace(/[.,]/g, "");
    const normalized = decPart ? `${intPart}.${decPart}` : intPart;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  };

  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

  const commitRoiInput = (key: RoiKey, setter: (n: number) => void, raw: string) => {
    const cfg = roiInputs[key];
    const parsed = parseLocalizedNumber(raw);
    const safe = parsed === null || Number.isNaN(parsed) ? cfg.default : parsed;
    const rounded = Number(safe.toFixed(cfg.decimals));
    setter(clamp(rounded, cfg.min, cfg.max));
    setRoiDrafts((d) => ({ ...d, [key]: null }));
  };

  const roiInputProps = (key: RoiKey, value: number, setter: (n: number) => void) => {
    const cfg = roiInputs[key];
    const draft = roiDrafts[key];
    return {
      value: draft ?? formatNumberInput(value, cfg.decimals),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setRoiDrafts((d) => ({ ...d, [key]: e.target.value })),
      onBlur: (e: React.FocusEvent<HTMLInputElement>) => commitRoiInput(key, setter, e.target.value),
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      },
      inputMode: "decimal" as const,
    };
  };

  const noShowSavings = ticketPromedio * noShowsPorSemana * 4;
  const farmaciaSavings = inventarioFarmacia * 0.04;
  const secretariaSavings = salarioSecretaria - planSeleccionado;
  const citasFueraHorario = citasRecuperadas * ticketPromedio * 4;
  const totalROI = noShowSavings + farmaciaSavings + secretariaSavings + citasFueraHorario;
  const planName = planSeleccionado === 2499 ? "Esencial" : "Profesional";

  const whatsappRoiHref = `https://wa.me/5213324508776?text=${encodeURIComponent(
    `Hola, calculé un ROI de ${formatCurrency(totalROI)} MXN/mes con IntegriKa, quiero más info`,
  )}`;

  return (
    <section id="roi" style={{ padding: "96px 0", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 52px" }}>
          <div className="pr-label" style={{ marginBottom: 14 }}>Retorno de inversión</div>
          <h2 className="pr-h" style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.08, marginBottom: 14, color: "#0f172a" }}>
            El plan se paga solo con los no-shows que evitas.
          </h2>
          <p style={{ color: SLATE }}>Ajusta los valores de tu clínica y calcula tu ROI en vivo.</p>
          <button
            onClick={() => setRoiInfoOpen((v) => !v)}
            style={{
              marginTop: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: TEAL,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
            }}
            aria-expanded={roiInfoOpen}
          >
            <Info size={15} />
            ¿Cómo calculamos esto?
            {roiInfoOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {roiInfoOpen && (
            <div className="pr-card" style={{ marginTop: 16, padding: "20px 24px", textAlign: "left" }}>
              <h4 className="pr-h" style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>
                Metodología del cálculo
              </h4>
              <ul style={{ display: "flex", flexDirection: "column", gap: 10, padding: 0, margin: 0, listStyle: "none", fontSize: 13, color: SLATE, lineHeight: 1.65 }}>
                <li>
                  <strong style={{ color: "#0f172a" }}>Pacientes que no llegan (no-shows) evitados:</strong>{" "}
                  no-shows/semana × ticket promedio × 4 semanas. Supone que cada no-show evitado se convierte en una consulta cobrada.
                </li>
                <li>
                  <strong style={{ color: "#0f172a" }}>Robo hormiga farmacia:</strong>{" "}
                  4% del valor de tu inventario de farmacia. Este 4% es un promedio de mermas típicas reportadas en clínicas sin control de inventario; tu resultado real puede variar.
                </li>
                <li>
                  <strong style={{ color: "#0f172a" }}>Ahorro vs. secretaria extra:</strong>{" "}
                  salario mensual que ahorrás − costo del plan IntegriKa seleccionado.
                </li>
                <li>
                  <strong style={{ color: "#0f172a" }}>Recuperación de citas fuera de horario:</strong>{" "}
                  citas recuperadas/semana × ticket promedio × 4 semanas. Supone que el bot de WhatsApp captura reservas fuera de horario de atención que hoy se pierden.
                </li>
              </ul>
              <p style={{ marginTop: 14, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                Estos son estimados basados en los valores que ingresás arriba, no una garantía de resultados.
              </p>
            </div>
          )}
        </motion.div>
        <div className="pr-roi-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>

          <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div className="pr-card" style={{ padding: 24, height: "100%" }}>
              <h3 className="pr-h" style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "#0f172a" }}>Ajusta los valores de tu clínica</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
                <div>
                  <label htmlFor="roi-ticket-text" style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6, display: "block" }}>Ticket promedio por consulta</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input id="roi-ticket-range" aria-label="Ticket promedio por consulta (deslizador)" type="range" min={200} max={3000} step={50} value={ticketPromedio} onChange={(e) => setTicketPromedio(Number(e.target.value))} style={{ flex: 1, accentColor: TEAL }} />
                    <input id="roi-ticket-text" type="text" {...roiInputProps("ticketPromedio", ticketPromedio, setTicketPromedio)} style={{ width: 100, padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, color: "#0f172a", textAlign: "right" }} />
                  </div>
                </div>
                <div>
                  <label htmlFor="roi-noshows-text" style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6, display: "block" }}>Pacientes que no llegan (no-shows) evitados por semana</label>
                  <div style={{ fontSize: 11, color: SLATE, marginBottom: 8, lineHeight: 1.4 }}>
                    No-show = paciente que reservó cita pero no asistió. IntegriKa los reduce con recordatorios automáticos y reagendamiento por WhatsApp.
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input id="roi-noshows-range" aria-label="No-shows evitados por semana (deslizador)" type="range" min={0} max={20} step={1} value={noShowsPorSemana} onChange={(e) => setNoShowsPorSemana(Number(e.target.value))} style={{ flex: 1, accentColor: TEAL }} />
                    <input id="roi-noshows-text" type="text" {...roiInputProps("noShowsPorSemana", noShowsPorSemana, setNoShowsPorSemana)} style={{ width: 100, padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, color: "#0f172a", textAlign: "right" }} />
                  </div>
                </div>
                <div>
                  <label htmlFor="roi-inventario-text" style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6, display: "block" }}>Valor de inventario de farmacia</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input id="roi-inventario-range" aria-label="Valor de inventario de farmacia (deslizador)" type="range" min={0} max={500000} step={1000} value={inventarioFarmacia} onChange={(e) => setInventarioFarmacia(Number(e.target.value))} style={{ flex: 1, accentColor: TEAL }} />
                    <input id="roi-inventario-text" type="text" {...roiInputProps("inventarioFarmacia", inventarioFarmacia, setInventarioFarmacia)} style={{ width: 100, padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, color: "#0f172a", textAlign: "right" }} />
                  </div>
                </div>
                <div>
                  <label htmlFor="roi-citas-text" style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6, display: "block" }}>Citas recuperadas fuera de horario / semana</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input id="roi-citas-range" aria-label="Citas recuperadas fuera de horario por semana (deslizador)" type="range" min={0} max={20} step={1} value={citasRecuperadas} onChange={(e) => setCitasRecuperadas(Number(e.target.value))} style={{ flex: 1, accentColor: TEAL }} />
                    <input id="roi-citas-text" type="text" {...roiInputProps("citasRecuperadas", citasRecuperadas, setCitasRecuperadas)} style={{ width: 100, padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, color: "#0f172a", textAlign: "right" }} />
                  </div>
                </div>
                <div>
                  <label htmlFor="roi-salario-text" style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6, display: "block" }}>Salario mensual de secretaria que se ahorra</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input id="roi-salario-range" aria-label="Salario mensual de secretaria (deslizador)" type="range" min={0} max={30000} step={500} value={salarioSecretaria} onChange={(e) => setSalarioSecretaria(Number(e.target.value))} style={{ flex: 1, accentColor: TEAL }} />
                    <input id="roi-salario-text" type="text" {...roiInputProps("salarioSecretaria", salarioSecretaria, setSalarioSecretaria)} style={{ width: 100, padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, color: "#0f172a", textAlign: "right" }} />
                  </div>
                </div>
                <div>
                  <label htmlFor="roi-plan-select" style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6, display: "block" }}>Plan a comparar</label>
                  <select id="roi-plan-select" value={planSeleccionado} onChange={(e) => setPlanSeleccionado(Number(e.target.value))} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, color: "#0f172a", background: "#fff" }}>
                    <option value={2499}>Esencial — {formatCurrency(2499)} MXN/mes</option>
                    <option value={5999}>Profesional — {formatCurrency(5999)} MXN/mes</option>
                  </select>
                </div>

              </div>
            </div>
          </motion.div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
            {[
              { label: "Pacientes que no llegan / mes", calc: `${noShowsPorSemana} × ${formatCurrency(ticketPromedio)} × 4 semanas`, value: formatCurrency(noShowSavings), color: GREEN },
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
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.95)", marginBottom: 4 }}>ROI neto estimado vs. Plan {planName} ({formatCurrency(planSeleccionado)} MXN/mes)</div>
              <div className="pr-h" style={{ fontSize: 32, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>+{formatCurrency(totalROI)} / mes</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.95)", marginTop: 4 }}>Solo con no-shows + farmacia + vs. secretaria extra</div>
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
  );
}
