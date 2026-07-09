// src/pages/AdminTenantDetail.tsx
import { useEffect, useState, useCallback } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { supabase, supabaseUrl } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ModuloRow {
  modulo_id: string;
  catalogo_modulos: { id: string; nombre: string; precio_centavos: number; stripe_price_id: string | null } | null;
}

interface Summary {
  clinic: {
    id: string;
    name: string;
    status: string;
    plan: string;
    subscription_status: string;
    grace_period_ends_at: string | null;
  };
  modulos: ModuloRow[];
  subscription: {
    status?: string;
    current_period_end?: number;
    default_payment_method?: { card?: { brand: string; last4: string } } | null;
  } | null;
  invoices: { id: string; amount_paid: number; status: string; created: number; hosted_invoice_url: string }[];
}

interface CatalogoModulo {
  id: string;
  nombre: string;
  precio_centavos: number;
}

export default function AdminTenantDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [isPlatformStaff, setIsPlatformStaff] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [catalogo, setCatalogo] = useState<CatalogoModulo[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setIsPlatformStaff(false); return; }
    supabase.rpc("is_global_admin", { _user_id: user.id }).then(({ data }) => setIsPlatformStaff(Boolean(data)));
  }, [authLoading, user]);

  const clinicLoading = authLoading || isPlatformStaff === null;
  const isGlobalAdmin = isPlatformStaff === true;

  const callFn = useCallback(async (method: "GET" | "POST", body?: unknown) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const url = method === "GET"
      ? `${supabaseUrl}/functions/v1/manage-subscription?clinic_id=${id}`
      : `${supabaseUrl}/functions/v1/manage-subscription`;
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token}`,
      },
      body: method === "POST" ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, data: data as (Summary & { error?: string }) | { error?: string; checkout_url?: string } | null };
  }, [id]);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await callFn("GET");
    if (!ok || !data || "error" in data && data.error) {
      setError((data as { error?: string })?.error ?? "Error cargando la suscripción");
      setLoading(false);
      return;
    }
    const s = data as Summary;
    setSummary(s);
    setSelectedIds(s.modulos.map((m) => m.modulo_id));
    setError(null);
    setLoading(false);
  }, [callFn]);

  useEffect(() => {
    if (!clinicLoading && isGlobalAdmin) load();
  }, [clinicLoading, isGlobalAdmin, load]);

  useEffect(() => {
    if (!clinicLoading && isGlobalAdmin) {
      supabase.from("catalogo_modulos").select("id, nombre, precio_centavos").eq("activo", true)
        .then((res) => setCatalogo((res.data ?? []) as CatalogoModulo[]));
    }
  }, [clinicLoading, isGlobalAdmin]);

  if (clinicLoading) return <div className="p-6">Cargando...</div>;
  if (!isGlobalAdmin) return <Navigate to="/" replace />;

  const currentIds = summary?.modulos.map((m) => m.modulo_id) ?? [];
  const hasModuleChanges =
    selectedIds.length !== currentIds.length || selectedIds.some((id2) => !currentIds.includes(id2));

  const saveModules = async () => {
    setSaving(true);
    setError(null);
    const { ok, data } = await callFn("POST", { action: "update_modules", clinic_id: id, modulo_ids: selectedIds });
    setSaving(false);
    if (!ok || (data as { error?: string })?.error) {
      setError((data as { error?: string })?.error ?? "Error actualizando módulos");
      return;
    }
    await load();
  };

  const reactivate = async () => {
    setSaving(true);
    setError(null);
    const { ok, data } = await callFn("POST", { action: "reactivate", clinic_id: id });
    setSaving(false);
    if (!ok || (data as { error?: string })?.error) {
      setError((data as { error?: string })?.error ?? "Error reactivando");
      return;
    }
    const checkoutUrl = (data as { checkout_url?: string })?.checkout_url;
    if (checkoutUrl) { window.location.href = checkoutUrl; return; }
    await load();
  };

  const suspend = async () => {
    setSaving(true);
    setError(null);
    const { ok, data } = await callFn("POST", { action: "suspend", clinic_id: id });
    setSaving(false);
    if (!ok || (data as { error?: string })?.error) {
      setError((data as { error?: string })?.error ?? "Error suspendiendo");
      return;
    }
    await load();
  };

  return (
    <div className="p-6 max-w-3xl">
      <Link to="/admin/tenants" className="text-blue-600 underline text-sm">&larr; Volver a clientes</Link>
      {loading ? <p className="mt-4">Cargando...</p> : error && !summary ? (
        <p className="text-red-600 mt-4">{error}</p>
      ) : summary && (
        <>
          <h1 className="text-2xl font-semibold mt-2 mb-1">{summary.clinic.name}</h1>
          <p className="text-sm text-gray-500 mb-4">
            Estado: {summary.clinic.status} · Plan: {summary.clinic.plan} · Suscripción: {summary.clinic.subscription_status}
          </p>
          {error && <p className="text-red-600 mb-4">{error}</p>}

          <section className="mb-6 border rounded p-4">
            <h2 className="font-semibold mb-2">Suscripción</h2>
            {summary.subscription ? (
              <div className="text-sm space-y-1">
                <p>Estado en Stripe: {summary.subscription.status}</p>
                {summary.subscription.current_period_end && (
                  <p>Próximo cobro: {new Date(summary.subscription.current_period_end * 1000).toLocaleDateString("es-MX")}</p>
                )}
                {summary.subscription.default_payment_method?.card && (
                  <p>
                    Tarjeta: {summary.subscription.default_payment_method.card.brand} ····{" "}
                    {summary.subscription.default_payment_method.card.last4}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Sin suscripción activa en Stripe.</p>
            )}
            <div className="mt-3 flex gap-3">
              {summary.clinic.status === "suspended" || !summary.subscription ? (
                <button onClick={reactivate} disabled={saving} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50">
                  {saving ? "Procesando..." : "Reactivar suscripción"}
                </button>
              ) : (
                <button onClick={suspend} disabled={saving} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50">
                  {saving ? "Procesando..." : "Suspender"}
                </button>
              )}
            </div>
          </section>

          <section className="mb-6 border rounded p-4">
            <h2 className="font-semibold mb-2">Módulos</h2>
            <div className="space-y-1">
              {catalogo.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(m.id)}
                    onChange={(e) =>
                      setSelectedIds(e.target.checked ? [...selectedIds, m.id] : selectedIds.filter((mid) => mid !== m.id))
                    }
                  />
                  {m.nombre} — ${(m.precio_centavos / 100).toFixed(2)}
                </label>
              ))}
            </div>
            <button
              onClick={saveModules}
              disabled={saving || !hasModuleChanges}
              className="mt-3 bg-blue-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </section>

          <section className="border rounded p-4">
            <h2 className="font-semibold mb-2">Historial de facturas</h2>
            {summary.invoices.length === 0 ? (
              <p className="text-sm text-gray-500">Sin facturas todavía.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-1">Fecha</th>
                    <th>Monto</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {summary.invoices.map((inv) => (
                    <tr key={inv.id} className="border-b">
                      <td className="py-1">{new Date(inv.created * 1000).toLocaleDateString("es-MX")}</td>
                      <td>${(inv.amount_paid / 100).toFixed(2)}</td>
                      <td>{inv.status}</td>
                      <td>
                        <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                          Ver
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
