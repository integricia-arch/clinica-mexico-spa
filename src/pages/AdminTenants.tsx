import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { Navigate } from "react-router-dom";

interface TenantRow {
  id: string;
  code: string;
  name: string;
  status: string;
  plan: string;
  created_at: string;
}

export default function AdminTenants() {
  const { isGlobalAdmin, loading: clinicLoading } = useActiveClinic();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchErr } = await supabase
      .from("clinics")
      .select("id, code, name, status, plan, created_at")
      .order("created_at", { ascending: false });
    if (fetchErr) {
      setError(fetchErr.message);
    } else {
      setTenants((data ?? []) as TenantRow[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!clinicLoading && isGlobalAdmin) load();
  }, [clinicLoading, isGlobalAdmin, load]);

  if (clinicLoading) return <div className="p-6">Cargando...</div>;
  if (!isGlobalAdmin) return <Navigate to="/" replace />;

  const setStatus = async (clinicId: string, status: string) => {
    const { error: rpcErr } = await supabase.rpc("set_clinic_status", {
      _clinic_id: clinicId,
      _status: status,
    });
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    await load();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Clientes (hospitales)</h1>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {loading ? (
        <p>Cargando...</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Nombre</th>
              <th>Código</th>
              <th>Estado</th>
              <th>Plan</th>
              <th>Alta</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-b">
                <td className="py-2">{t.name}</td>
                <td>{t.code}</td>
                <td>{t.status}</td>
                <td>{t.plan}</td>
                <td>{new Date(t.created_at).toLocaleDateString("es-MX")}</td>
                <td>
                  {t.status === "suspended" ? (
                    <button onClick={() => setStatus(t.id, "active")} className="text-green-700 underline">
                      Reactivar
                    </button>
                  ) : (
                    <button onClick={() => setStatus(t.id, "suspended")} className="text-red-700 underline">
                      Suspender
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
