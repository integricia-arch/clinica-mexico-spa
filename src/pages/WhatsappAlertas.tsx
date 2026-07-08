import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface AlertaRow {
  id: string;
  clinic_id: string;
  tipo: string;
  referencia_id: string;
  detectado_at: string;
}

export default function WhatsappAlertas() {
  const { user } = useAuth();
  const [alertas, setAlertas] = useState<AlertaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchErr } = await supabase
      .from("whatsapp_audit_alertas")
      .select("id, clinic_id, tipo, referencia_id, detectado_at")
      .eq("resuelto", false)
      .order("detectado_at", { ascending: false });
    if (fetchErr) {
      setError(fetchErr.message);
    } else {
      setAlertas((data ?? []) as AlertaRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolver = async (id: string) => {
    setError(null);
    const { error: updateErr } = await supabase
      .from("whatsapp_audit_alertas")
      .update({ resuelto: true, resuelto_at: new Date().toISOString(), resuelto_por: user?.id })
      .eq("id", id);
    if (updateErr) {
      setError(updateErr.message);
    } else {
      await load();
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Alertas de mensajes WhatsApp</h1>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {loading ? <p>Cargando...</p> : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Tipo</th>
              <th>Detectado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {alertas.map((a) => (
              <tr key={a.id} className="border-b">
                <td className="py-2">{a.tipo}</td>
                <td>{new Date(a.detectado_at).toLocaleString("es-MX")}</td>
                <td><button onClick={() => resolver(a.id)} className="text-green-700 underline">Marcar resuelta</button></td>
              </tr>
            ))}
            {alertas.length === 0 && <tr><td colSpan={3} className="py-4 text-gray-500">Sin alertas abiertas.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
