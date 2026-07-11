import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, Save, Loader2, CheckCircle2, AlertCircle, ExternalLink, XCircle } from "lucide-react";
import { supabase, supabaseUrl } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CancelarSuscripcionModal } from "@/components/configuracion/CancelarSuscripcionModal";
import type { SubscriptionSummary, CatalogoModulo } from "@/types/subscription";
import { InvoicesTable } from "@/components/configuracion/InvoicesTable";

const METODOS = [
  { value: "card", label: "Tarjeta de crédito / débito" },
  { value: "oxxo", label: "OXXO Pay" },
  { value: "spei", label: "Transferencia SPEI" },
];

interface PagosForm {
  proveedor: string;
  ambiente: string;
  stripe_publishable_key: string;
  stripe_terminal_habilitado: boolean;
  metodos_habilitados: string[];
}

const EMPTY: PagosForm = {
  proveedor: "stripe",
  ambiente: "sandbox",
  stripe_publishable_key: "",
  stripe_terminal_habilitado: false,
  metodos_habilitados: ["card"],
};

export default function ConfiguracionPagos() {
  const navigate = useNavigate();
  const { activeClinicId } = useActiveClinic();
  const [form, setForm] = useState<PagosForm>(EMPTY);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "error" | null>(null);
  const [testando, setTestando] = useState(false);

  const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [catalogo, setCatalogo] = useState<CatalogoModulo[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [savingModules, setSavingModules] = useState(false);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [subActionLoading, setSubActionLoading] = useState(false);

  const callManageSubscription = async (action: string, extra?: Record<string, unknown>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const res = await fetch(`${supabaseUrl}/functions/v1/manage-subscription`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token}`,
      },
      body: JSON.stringify({ action, clinic_id: activeClinicId, ...extra }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error ?? "No se pudo completar la operación");
    return body;
  };

  const loadSummary = async () => {
    if (!activeClinicId) return;
    setSummaryLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const res = await fetch(`${supabaseUrl}/functions/v1/manage-subscription?clinic_id=${activeClinicId}`, {
      headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data && !data.error) {
      const s = data as SubscriptionSummary;
      setSummary(s);
      setSelectedIds(s.modulos.map((m) => m.modulo_id));
    }
    setSummaryLoading(false);
  };

  useEffect(() => {
    loadSummary();
    if (activeClinicId) {
      supabase.from("catalogo_modulos").select("id, nombre, precio_centavos").eq("activo", true)
        .then((res) => setCatalogo(((res as { data?: CatalogoModulo[] }).data ?? [])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClinicId]);

  const handleConfirmCancel = async () => {
    setSubActionLoading(true);
    try {
      await callManageSubscription("cancel");
      await loadSummary();
      setCancelModalOpen(false);
      toast.success("Suscripción cancelada — acceso vigente hasta el fin del período pagado");
    } catch (err) {
      toast.error((err as Error).message);
    }
    setSubActionLoading(false);
  };

  const handleReactivate = async () => {
    setSubActionLoading(true);
    try {
      await callManageSubscription("reactivate");
      await loadSummary();
      toast.success("Suscripción reactivada");
    } catch (err) {
      toast.error((err as Error).message);
    }
    setSubActionLoading(false);
  };

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const body = await callManageSubscription("create_portal_session");
      if (body?.url) window.location.href = body.url;
    } catch (err) {
      toast.error((err as Error).message);
    }
    setPortalLoading(false);
  };

  const currentModuleIds = summary?.modulos.map((m) => m.modulo_id) ?? [];
  const hasModuleChanges =
    selectedIds.length !== currentModuleIds.length || selectedIds.some((id) => !currentModuleIds.includes(id));

  const handleSaveModules = async () => {
    setSavingModules(true);
    setModulesError(null);
    try {
      await callManageSubscription("update_modules", { modulo_ids: selectedIds });
      await loadSummary();
      toast.success("Módulos actualizados");
    } catch (err) {
      setModulesError((err as Error).message);
    }
    setSavingModules(false);
  };

  const subStatus = summary?.clinic.subscription_status ?? null;
  const fechaCorte = summary?.subscription?.current_period_end
    ? new Date(summary.subscription.current_period_end * 1000).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : "";

  useEffect(() => {
    if (!activeClinicId) return;
    const load = async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("payment_gateway_config" as unknown as "appointments")
        .select("*")
        .eq("clinic_id", activeClinicId)
        .maybeSingle();
      if (data) {
        const cfg = data as Record<string, unknown>;
        setExistingId(cfg.id as string);
        setForm({
          proveedor: (cfg.proveedor as string | null) ?? "stripe",
          ambiente: (cfg.ambiente as string | null) ?? "sandbox",
          stripe_publishable_key: (cfg.stripe_publishable_key as string | null) ?? "",
          stripe_terminal_habilitado: (cfg.stripe_terminal_habilitado as boolean | null) ?? false,
          metodos_habilitados: (cfg.metodos_habilitados as string[] | null) ?? ["card"],
        });
      }
      setLoading(false);
    };
    load();
  }, [activeClinicId]);

  const set = <K extends keyof PagosForm>(field: K, value: PagosForm[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleMetodo = (val: string) => {
    setForm((prev) => ({
      ...prev,
      metodos_habilitados: prev.metodos_habilitados.includes(val)
        ? prev.metodos_habilitados.filter((m) => m !== val)
        : [...prev.metodos_habilitados, val],
    }));
  };

  const handleSave = async () => {
    if (!activeClinicId) return;
    if (form.proveedor === "stripe" && form.ambiente === "produccion" && !form.stripe_publishable_key.startsWith("pk_live_")) {
      toast.error("La llave pública de producción Stripe debe comenzar con pk_live_");
      return;
    }
    if (form.proveedor === "stripe" && form.ambiente === "sandbox" && form.stripe_publishable_key && !form.stripe_publishable_key.startsWith("pk_test_")) {
      toast.error("La llave pública de pruebas Stripe debe comenzar con pk_test_");
      return;
    }

    setSaving(true);
    const payload = {
      clinic_id: activeClinicId,
      proveedor: form.proveedor,
      ambiente: form.ambiente,
      stripe_publishable_key: form.stripe_publishable_key.trim() || null,
      stripe_terminal_habilitado: form.stripe_terminal_habilitado,
      metodos_habilitados: form.metodos_habilitados,
      activo: true,
    };

    const { error } = existingId
      ? await (supabase as any).from("payment_gateway_config" as any).update(payload).eq("id", existingId)
      : await (supabase as any).from("payment_gateway_config" as any).insert(payload);

    setSaving(false);
    if (error) { toast.error("Error al guardar: " + error.message); return; }
    toast.success("Configuración de pagos guardada");
  };

  const handleTestStripe = async () => {
    if (!form.stripe_publishable_key) {
      toast.error("Ingresa la llave pública de Stripe para probar");
      return;
    }
    setTestando(true);
    setTestResult(null);
    try {
      const res = await fetch("https://api.stripe.com/v1/payment_methods?type=card&limit=1", {
        headers: { Authorization: `Bearer ${form.stripe_publishable_key}` },
      });
      setTestResult(res.status !== 401 ? "ok" : "error");
      if (res.status !== 401) toast.success("Llave pública Stripe válida");
      else toast.error("Llave pública inválida o revocada");
    } catch {
      setTestResult("error");
      toast.error("No se pudo contactar a Stripe");
    }
    setTestando(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/configuracion")} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-display text-xl font-bold text-foreground">Cobros y pagos digitales</h1>
          <p className="text-sm text-muted-foreground">Configura la pasarela de pago para cobros con tarjeta, OXXO y SPEI</p>
        </div>
      </div>

      {/* Suscripción */}
      {summary && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
          <h2 className="font-semibold text-card-foreground">Tu suscripción</h2>

          {subStatus === "canceling" ? (
            <div className="rounded-lg bg-warning/10 border border-warning/30 px-4 py-3 text-sm text-warning-foreground space-y-3">
              <p>
                Tu suscripción está programada para cancelarse. Tienes acceso completo a
                todos tus módulos hasta el <strong>{fechaCorte}</strong>.
              </p>
              <Button type="button" size="sm" onClick={handleReactivate} disabled={subActionLoading} className="gap-2">
                {subActionLoading ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}
                Reactivar suscripción
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Plan {summary.clinic.plan}. Próximo cobro: {fechaCorte || "sin fecha disponible"}.
            </p>
          )}

          <div>
            <h3 className="text-sm font-semibold text-card-foreground mb-2">Módulos contratados</h3>
            <div className="space-y-2">
              {catalogo.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(m.id)}
                    onChange={(e) =>
                      setSelectedIds(e.target.checked ? [...selectedIds, m.id] : selectedIds.filter((id) => id !== m.id))
                    }
                  />
                  {m.nombre} — ${(m.precio_centavos / 100).toFixed(2)}
                </label>
              ))}
            </div>
            {modulesError && <p className="text-sm text-destructive mt-2">{modulesError}</p>}
            <Button
              type="button"
              size="sm"
              className="mt-3"
              onClick={handleSaveModules}
              disabled={savingModules || !hasModuleChanges || selectedIds.length === 0}
            >
              {savingModules ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar cambios
            </Button>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-card-foreground mb-2">Método de pago</h3>
            {summary.subscription?.default_payment_method?.card ? (
              <p className="text-sm text-muted-foreground mb-2">
                {summary.subscription.default_payment_method.card.brand} ···· {summary.subscription.default_payment_method.card.last4}
              </p>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={handleOpenPortal} disabled={portalLoading} className="gap-2">
              {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Actualizar método de pago
            </Button>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-card-foreground mb-2">Facturas</h3>
            <InvoicesTable invoices={summary.invoices} />
          </div>

          {subStatus !== "canceling" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCancelModalOpen(true)}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <XCircle className="h-4 w-4" />
              Cancelar suscripción
            </Button>
          )}
        </section>
      )}

      {/* Pasarela */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-card-foreground">Pasarela de pago</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="proveedor">Proveedor</Label>
            <select
              id="proveedor"
              value={form.proveedor}
              onChange={(e) => set("proveedor", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="stripe">Stripe (recomendado)</option>
              <option value="conekta">Conekta</option>
              <option value="ninguno">Sin pasarela</option>
            </select>
          </div>
          <div>
            <Label htmlFor="ambiente">Ambiente</Label>
            <select
              id="ambiente"
              value={form.ambiente}
              onChange={(e) => set("ambiente", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="sandbox">Sandbox (pruebas)</option>
              <option value="produccion">Producción</option>
            </select>
          </div>
        </div>

        {form.ambiente === "produccion" && (
          <div className="rounded-lg bg-warning/10 border border-warning/30 px-4 py-2.5 text-xs text-warning">
            Ambiente de producción — los cobros realizados serán reales.
          </div>
        )}

        {form.proveedor === "conekta" && (
          <div className="rounded-lg bg-info/10 border border-info/30 px-4 py-2.5 text-xs text-info">
            Integración con Conekta disponible en próxima versión. Por ahora configura el proveedor y las credenciales se activarán.
          </div>
        )}
      </section>

      {/* Stripe config */}
      {form.proveedor === "stripe" && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
          <h2 className="font-semibold text-card-foreground">Configuración Stripe</h2>

          <div>
            <Label htmlFor="stripe_publishable_key">
              Llave pública (Publishable Key)
              <a
                href="https://dashboard.stripe.com/apikeys"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Ver en Stripe <ExternalLink className="h-3 w-3" />
              </a>
            </Label>
            <Input
              id="stripe_publishable_key"
              value={form.stripe_publishable_key}
              onChange={(e) => set("stripe_publishable_key", e.target.value)}
              placeholder={form.ambiente === "sandbox" ? "pk_test_..." : "pk_live_..."}
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Esta llave es pública y segura para el frontend. La llave secreta (sk_*) solo se configura en las variables de entorno del servidor.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={handleTestStripe} disabled={testando}>
              {testando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Verificar llave
            </Button>
            {testResult === "ok" && (
              <span className="flex items-center gap-1 text-xs text-success">
                <CheckCircle2 className="h-4 w-4" /> Llave válida
              </span>
            )}
            {testResult === "error" && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-4 w-4" /> Llave inválida
              </span>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.stripe_terminal_habilitado}
                onChange={(e) => set("stripe_terminal_habilitado", e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <div>
                <span className="text-sm font-medium text-foreground">Habilitar Stripe Terminal</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Para cobro presencial con lector físico (Stripe Reader) en el consultorio. Requiere hardware adicional.
                </p>
              </div>
            </label>
          </div>
        </section>
      )}

      {/* Métodos aceptados */}
      {form.proveedor !== "ninguno" && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
          <h2 className="font-semibold text-card-foreground">Métodos de pago aceptados</h2>
          <div className="space-y-3">
            {METODOS.map((m) => (
              <label key={m.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.metodos_habilitados.includes(m.value)}
                  onChange={() => toggleMetodo(m.value)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm text-foreground">{m.label}</span>
                {m.value === "oxxo" && (
                  <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded">+$8 MXN fijo</span>
                )}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Tarjeta aplica comisión 3.6% (IVA incluido). OXXO: $8 MXN fijo + 1.2%. SPEI: sin comisión adicional de Stripe.
          </p>
        </section>
      )}

      {/* Nota sobre secret key */}
      <div className="rounded-lg bg-muted/60 border border-border px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">Seguridad — llave secreta de Stripe</p>
        <p>
          La <strong>llave secreta</strong> (sk_live_* / sk_test_*) <strong>nunca</strong> se guarda en base de datos.
          Se configura como variable de entorno en las Edge Functions del servidor. Contacta al equipo técnico para activar cobros reales.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || form.proveedor === "ninguno"} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar configuración de pagos
        </Button>
      </div>

      <CancelarSuscripcionModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleConfirmCancel}
        fechaCorte={fechaCorte || "el fin de tu período de facturación actual"}
        loading={subActionLoading}
      />
    </div>
  );
}
