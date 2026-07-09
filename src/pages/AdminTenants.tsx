import { useEffect, useState, useCallback } from "react";
import { supabase, supabaseUrl } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

interface TenantRow {
  id: string;
  code: string;
  name: string;
  status: string;
  plan: string;
  created_at: string;
  whatsapp_status: string | null;
  whatsapp_phone_number_id: string | null;
  subscription_status: string;
  grace_period_ends_at: string | null;
}

interface Modulo {
  id: string;
  nombre: string;
  precio_centavos: number;
}

export default function AdminTenants() {
  const { user, loading: authLoading } = useAuth();
  const [isPlatformStaff, setIsPlatformStaff] = useState<boolean | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);

  // ponytail: estados del wizard/modales declarados aquí (antes de cualquier
  // return condicional) — moverlos abajo de un `if (...) return` viola las
  // reglas de hooks de React y causaba "Rendered more hooks than during the
  // previous render" en cuanto isPlatformStaff pasaba de null a un booleano.
  const [waTarget, setWaTarget] = useState<TenantRow | null>(null);
  const [waForm, setWaForm] = useState({ phone_number_id: "", waba_id: "", test_to: "" });
  const [waSaving, setWaSaving] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);

  const [showWizard, setShowWizard] = useState(false);
  const [form, setForm] = useState({
    code: "", name: "", rfc: "", address: "", contacto_facturacion_email: "", admin_email: "",
  });
  const [moduloIds, setModuloIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingClinicId, setPendingClinicId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");

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
      .select(
        "id, code, name, status, plan, created_at, whatsapp_status, whatsapp_phone_number_id, subscription_status, grace_period_ends_at"
      )
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

  useEffect(() => {
    if (!clinicLoading && isGlobalAdmin) {
      (async () => {
        const result = await supabase
          .from("catalogo_modulos")
          .select("id, nombre, precio_centavos")
          .eq("activo", true);
        const data = (result as { data?: Modulo[] })?.data;
        setModulos((data ?? []) as Modulo[]);
      })();
    }
  }, [clinicLoading, isGlobalAdmin]);

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

  const guardarNumero = async () => {
    if (!waTarget) return;
    setWaSaving(true);
    setWaError(null);
    const { error } = await supabase.rpc("set_clinic_whatsapp_number", {
      _clinic_id: waTarget.id,
      _phone_number_id: waForm.phone_number_id,
      _waba_id: waForm.waba_id,
    });
    setWaSaving(false);
    if (error) { setWaError(error.message); return; }
    await load();
  };

  const enviarPrueba = async () => {
    if (!waTarget) return;
    setWaSaving(true);
    setWaError(null);
    const { data, error } = await supabase.functions.invoke("whatsapp-test-send", {
      body: { clinic_id: waTarget.id, to: waForm.test_to },
    });
    setWaSaving(false);
    if (error || (data as { error?: string })?.error) {
      setWaError((data as { error?: string })?.error ?? error?.message ?? "Error desconocido");
      return;
    }
    await load();
  };

  // ponytail: fetch crudo en vez de supabase.functions.invoke() — el wrapper
  // consume el body de la respuesta al armar su propio error genérico, así
  // que el mensaje real que mandan estas funciones nunca llegaba al usuario.
  const callFn = async (slug: string, body: unknown) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const res = await fetch(`${supabaseUrl}/functions/v1/${slug}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data: data as { error?: string; clinic_id?: string } | null };
  };

  const submitWizard = async () => {
    setSubmitting(true);
    setFormError(null);
    // ponytail: try/catch/finally para que una excepción (red, CORS, etc.)
    // no deje el botón trabado en "Creando..." sin mensaje de error.
    try {
      const { ok, status, data } = await callFn("create-tenant", {
        ...form,
        code: crypto.randomUUID(),
        modulo_ids: moduloIds,
      });
      if (!ok || data?.error) {
        setFormError(data?.error ?? `Error ${status}`);
        return;
      }
      setPendingClinicId(data?.clinic_id ?? null);
    } catch (e) {
      setFormError((e as Error).message ?? "Error de red inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  const submitVerifyCode = async () => {
    if (!pendingClinicId) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const { ok, status, data } = await callFn("verify-tenant-code", {
        clinic_id: pendingClinicId,
        code: verifyCode,
      });
      if (!ok || data?.error) {
        setFormError(data?.error ?? `Error ${status}`);
        return;
      }
      setShowWizard(false);
      setPendingClinicId(null);
      setVerifyCode("");
      setForm({ code: "", name: "", rfc: "", address: "", contacto_facturacion_email: "", admin_email: "" });
      setModuloIds([]);
      await load();
    } catch (e) {
      setFormError((e as Error).message ?? "Error de red inesperado");
    } finally {
      setSubmitting(false);
    }
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
              <th>Suscripción</th>
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
                <td>
                  {t.subscription_status}
                  {t.subscription_status === "past_due" && t.grace_period_ends_at
                    ? ` (hasta ${new Date(t.grace_period_ends_at).toLocaleDateString("es-MX")})`
                    : ""}
                </td>
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
                  <button
                    onClick={() => {
                      setWaTarget(t);
                      setWaForm({ phone_number_id: t.whatsapp_phone_number_id ?? "", waba_id: "", test_to: "" });
                      setWaError(null);
                    }}
                    className="text-blue-700 underline ml-3"
                  >
                    WhatsApp
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {showWizard && pendingClinicId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded max-w-md w-full">
            <h2 className="text-xl font-semibold mb-1">Verifica el correo</h2>
            <p className="text-sm text-gray-500 mb-4">
              Mandamos un código de 6 dígitos a {form.contacto_facturacion_email || form.admin_email}. Captúralo para
              activar la clínica, crear la suscripción e inscribir los módulos.
            </p>
            {formError && <p className="text-red-600 mb-2">{formError}</p>}
            <input
              placeholder="Código de 6 dígitos"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full border p-2 rounded text-center text-lg tracking-widest"
              maxLength={6}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowWizard(false);
                  setPendingClinicId(null);
                  setVerifyCode("");
                }}
                className="px-4 py-2"
              >
                Cancelar
              </button>
              <button
                onClick={submitVerifyCode}
                disabled={submitting || verifyCode.length !== 6}
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {submitting ? "Verificando..." : "Verificar y activar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showWizard && !pendingClinicId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Nuevo cliente</h2>
            {formError && <p className="text-red-600 mb-2">{formError}</p>}
            <div className="space-y-2">
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
              <div className="space-y-1">
                <p className="text-sm font-medium">Módulos</p>
                {modulos.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={moduloIds.includes(m.id)}
                      onChange={(e) =>
                        setModuloIds(
                          e.target.checked ? [...moduloIds, m.id] : moduloIds.filter((id) => id !== m.id)
                        )
                      }
                    />
                    {m.nombre} — ${(m.precio_centavos / 100).toFixed(2)}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowWizard(false)} className="px-4 py-2">Cancelar</button>
              <button
                onClick={submitWizard}
                disabled={submitting || !form.name || !form.admin_email || moduloIds.length === 0}
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {submitting ? "Creando..." : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
      {waTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded max-w-md w-full">
            <h2 className="text-xl font-semibold mb-1">WhatsApp — {waTarget.name}</h2>
            <p className="text-sm text-gray-500 mb-4">
              Estado: {waTarget.whatsapp_status ?? "no configurado"}
            </p>
            {waError && <p className="text-red-600 mb-2">{waError}</p>}
            <div className="space-y-2">
              <input
                placeholder="Phone Number ID"
                value={waForm.phone_number_id}
                onChange={(e) => setWaForm({ ...waForm, phone_number_id: e.target.value })}
                className="w-full border p-2 rounded"
              />
              <input
                placeholder="WABA ID"
                value={waForm.waba_id}
                onChange={(e) => setWaForm({ ...waForm, waba_id: e.target.value })}
                className="w-full border p-2 rounded"
              />
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={guardarNumero}
                disabled={waSaving || !waForm.phone_number_id || !waForm.waba_id}
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {waSaving ? "Guardando..." : "Guardar"}
              </button>
            </div>
            <hr className="my-4" />
            <div className="space-y-2">
              <input
                placeholder="Número de prueba (ej. +5215512345678)"
                value={waForm.test_to}
                onChange={(e) => setWaForm({ ...waForm, test_to: e.target.value })}
                className="w-full border p-2 rounded"
              />
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setWaTarget(null)} className="px-4 py-2">Cerrar</button>
              <button
                onClick={enviarPrueba}
                disabled={waSaving || !waForm.test_to}
                className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {waSaving ? "Enviando..." : "Enviar mensaje de prueba"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
