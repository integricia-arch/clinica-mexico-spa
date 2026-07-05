import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import AlmacenTabs from "@/features/almacen/AlmacenTabs";

type Medicamento = Tables<"medicamentos">;
type Lote = Tables<"lotes_medicamento">;

export default function Almacen() {
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: meds }, { data: lts }] = await Promise.all([
      (supabase as any).from("medicamentos").select("*").eq("activo", true).order("nombre"),
      (supabase as any).from("lotes_medicamento").select("*").order("fecha_caducidad"),
    ]);
    setMedicamentos(meds ?? []);
    setLotes(lts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return <AlmacenTabs medicamentos={medicamentos} lotes={lotes} onReload={loadData} loading={loading} />;
}
