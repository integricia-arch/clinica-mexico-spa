import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  const { user, loading: authLoading } = useAuth();
  const [isPlatformStaff, setIsPlatformStaff] = useState<boolean | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsPlatformStaff(false);
      return;
    }
    supabase
      .rpc("is_global_admin", { _user_id: user.id })
      .then(({ data }) => setIsPlatformStaff(Boolean(data)));
  }, [authLoading, user]);

  const clinicLoading = authLoading || isPlatformStaff === null;
  const isGlobalAdmin = isPlatformStaff === true;

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

  const [showWizard, setShowWizard] = useState(false);
  const [form, setForm] = useState({
    code: "", name: "", rfc: "", address: "", contacto_facturacion_email: "", admin_email: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submitWizard = async () => {
    setSubmitting(true);
    setFormError(null);
    const { data, error: fnErr } = await supabase.functions.invoke("create-tenant", {
      body: form,
    });
    setSubmitting(false);
    if (fnErr || (data as { error?: string })?.error) {
      setFormError((data as { error?: string })?.error ?? fnErr?.message ?? "Error desconocido");
      return;
    }
    setShowWizard(false);
    setForm({ code: "", name: "", rfc: "", address: "", contacto_facturacion_email: "", admin_email: "" });
    await load();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Clientes (hospitales)</h1>
      <button onClick={() => setShowWizard(true)} className="mb-4 bg-blue-600 text-white px-4 py-2 rounded">
        Nuevo cliente
      </button>
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
      {showWizard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Nuevo cliente</h2>
            {formError && <p className="text-red-600 mb-2">{formError}</p>}
            <div className="space-y-2">
              <input
                placeholder="Código único (ej. hospital_norte)"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full border p-2 rounded"
              />
              <input
                placeholder="Nombre del hospital"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border p-2 rounded"
              />
              <input
                placeholder="RFC"
                value={form.rfc}
                onChange={(e) => setForm({ ...form, rfc: e.target.value })}
                className="w-full border p-2 rounded"
              />
              <input
                placeholder="Dirección"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full border p-2 rounded"
              />
              <input
                placeholder="Email facturación"
                value={form.contacto_facturacion_email}
                onChange={(e) => setForm({ ...form, contacto_facturacion_email: e.target.value })}
                className="w-full border p-2 rounded"
              />
              <input
                placeholder="Email admin del hospital"
                value={form.admin_email}
                onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                className="w-full border p-2 rounded"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowWizard(false)} className="px-4 py-2">Cancelar</button>
              <button
                onClick={submitWizard}
                disabled={submitting || !form.code || !form.name || !form.admin_email}
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {submitting ? "Creando..." : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
