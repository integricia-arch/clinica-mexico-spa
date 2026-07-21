import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * U4 — checklist de activación para clínica nueva: admin de clínica recién
 * creada cae en dashboard vacío sin guía. Estado se deriva de datos reales
 * (no un flag separado) para que nunca quede desincronizado de lo que el
 * admin ya hizo.
 */

export interface OnboardingStep {
  key: "doctor" | "servicio" | "cita";
  label: string;
  done: boolean;
  href: string;
}

export interface OnboardingChecklist {
  steps: OnboardingStep[];
  percent: number;
  completed: boolean;
  loading: boolean;
}

export function useOnboardingChecklist(clinicId: string | null): OnboardingChecklist {
  const [counts, setCounts] = useState<{ doctores: number; servicios: number; citas: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!clinicId) {
      setCounts(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const [doctores, servicios, citas] = await Promise.all([
        supabase.from("doctors").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
        supabase.from("servicios").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
      ]);
      if (cancelled) return;
      setCounts({
        doctores: doctores.count ?? 0,
        servicios: servicios.count ?? 0,
        citas: citas.count ?? 0,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clinicId]);

  const steps: OnboardingStep[] = [
    { key: "doctor", label: "Da de alta un doctor", done: (counts?.doctores ?? 0) > 0, href: "/ajustes" },
    { key: "servicio", label: "Agrega un servicio", done: (counts?.servicios ?? 0) > 0, href: "/ajustes" },
    { key: "cita", label: "Agenda la primera cita", done: (counts?.citas ?? 0) > 0, href: "/agenda" },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);

  return { steps, percent, completed: doneCount === steps.length, loading };
}
