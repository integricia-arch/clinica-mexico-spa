import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseModulosActivosResult {
  slugs: string[];
  loading: boolean;
}

export function useModulosActivos(clinicId: string | undefined): UseModulosActivosResult {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicId) {
      setSlugs([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("cliente_modulos")
      .select("activo_hasta, catalogo_modulos(slug)")
      .eq("clinic_id", clinicId)
      .then(({ data }) => {
        if (cancelled) return;
        const now = Date.now();
        const active = (data ?? [])
          .filter((r) => !r.activo_hasta || new Date(r.activo_hasta).getTime() > now)
          .map((r) => (r.catalogo_modulos as { slug: string } | null)?.slug)
          .filter((s): s is string => Boolean(s));
        setSlugs(active);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clinicId]);

  return { slugs, loading };
}
