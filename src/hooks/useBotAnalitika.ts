import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SentimentoTrend {
  semana: string;
  positivo: number;
  neutral: number;
  negativo: number;
  enojado: number;
}

export interface FriccionItem {
  friccion: string;
  count: number;
}

export interface KPI {
  totalConversaciones: number;
  sentimientoPositivo: number;
  friccionesTop5: FriccionItem[];
  quiereTop5: FriccionItem[];
  contencionPct: number;
  citasCreadasPct: number;
  promocionesAceptadasPct: number;
}

export function useBotAnalitika(clinicId: string | null) {
  const [loading, setLoading] = useState(true);
  const [sentimentoTrend, setSentimentoTrend] = useState<SentimentoTrend[]>([]);
  const [kpi, setKpi] = useState<KPI | null>(null);

  useEffect(() => {
    if (!clinicId) return;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("conversacion_analisis")
          .select("sentimiento, friccion, quiere, escalada, cita_creada, acepto_promociones, analizado_at")
          .eq("clinic_id", clinicId)
          .order("analizado_at", { ascending: false })
          .limit(500);

        if (error || !data) {
          setLoading(false);
          return;
        }

        // ponytail: simple week aggregation, O(n) scan
        const byWeek = new Map<string, { pos: number; neu: number; neg: number; enj: number }>();
        const fricciones = new Map<string, number>();
        const quiere_features = new Map<string, number>();

        let totalConv = data.length;
        let posCount = 0;
        let escaladaCount = 0;
        let citaCount = 0;
        let promoCount = 0;

        data.forEach((row) => {
          const week = row.analizado_at
            ? new Date(row.analizado_at).toISOString().split("T")[0].slice(0, 7)
            : "unknown";

          if (!byWeek.has(week)) {
            byWeek.set(week, { pos: 0, neu: 0, neg: 0, enj: 0 });
          }

          const sentMap = byWeek.get(week)!;
          if (row.sentimiento === "positivo") {
            sentMap.pos++;
            posCount++;
          } else if (row.sentimiento === "negativo") {
            sentMap.neg++;
          } else if (row.sentimiento === "enojado") {
            sentMap.enj++;
          } else {
            sentMap.neu++;
          }

          if (row.friccion) {
            fricciones.set(row.friccion, (fricciones.get(row.friccion) ?? 0) + 1);
          }
          if (row.quiere) {
            quiere_features.set(row.quiere, (quiere_features.get(row.quiere) ?? 0) + 1);
          }

          if (row.escalada) escaladaCount++;
          if (row.cita_creada) citaCount++;
          if (row.acepto_promociones) promoCount++;
        });

        const trendArray = Array.from(byWeek.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([semana, counts]) => ({
            semana,
            positivo: counts.pos,
            neutral: counts.neu,
            negativo: counts.neg,
            enojado: counts.enj,
          }));

        const friccionesTop5 = Array.from(fricciones.entries())
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([friccion, count]) => ({ friccion, count }));

        const quiereTop5 = Array.from(quiere_features.entries())
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([quiere, count]) => ({ friccion: quiere, count }));

        setSentimentoTrend(trendArray);
        setKpi({
          totalConversaciones: totalConv,
          sentimientoPositivo: Math.round((posCount / totalConv) * 100),
          friccionesTop5,
          quiereTop5,
          contencionPct: Math.round(((totalConv - escaladaCount) / totalConv) * 100),
          citasCreadasPct: Math.round((citaCount / totalConv) * 100),
          promocionesAceptadasPct: Math.round((promoCount / totalConv) * 100),
        });
      } catch (err) {
        console.error("useBotAnalitika error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [clinicId]);

  return { loading, sentimentoTrend, kpi };
}
