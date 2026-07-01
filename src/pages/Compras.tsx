import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import ComprasTabs from "@/features/compras/ComprasTabs";

type Medicamento = Tables<"medicamentos">;

export default function Compras() {
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("medicamentos")
        .select("*")
        .eq("activo", true)
        .order("nombre");
      setMedicamentos(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Compras</h1>
      <ComprasTabs medicamentos={medicamentos} />
    </div>
  );
}
