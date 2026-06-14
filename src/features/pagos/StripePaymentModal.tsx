import { useEffect, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Loader2, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface StripePaymentModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: (paymentIntentId: string, transactionId: string | null) => void;
  clinicId: string;
  amountCents: number;
  description: string;
  appointmentId?: string;
  saleId?: string;
}

const fmt = (cents: number) =>
  (cents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

// ─── Inner form (needs Stripe context) ─────────────────────────────────────
function PaymentForm({
  onSuccess,
  onCancel,
  amountCents,
}: {
  onSuccess: (piId: string) => void;
  onCancel: () => void;
  amountCents: number;
}) {
  const stripe   = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [errMsg, setErrMsg]         = useState<string | null>(null);
  const [ready, setReady]           = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setErrMsg(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (error) {
      setErrMsg(error.message ?? "Error al procesar el pago");
      setProcessing(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      onSuccess(paymentIntent.id);
    } else {
      setErrMsg(`Estado inesperado: ${paymentIntent?.status}`);
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-center">
        <p className="text-xs text-muted-foreground">Total a cobrar</p>
        <p className="text-2xl font-bold text-foreground">{fmt(amountCents)}</p>
      </div>

      <PaymentElement
        onReady={() => setReady(true)}
        options={{ layout: "tabs" }}
      />

      {errMsg && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {errMsg}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={processing} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" disabled={!stripe || !elements || !ready || processing} className="flex-1 gap-2">
          {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {processing ? "Procesando…" : "Pagar"}
        </Button>
      </div>
    </form>
  );
}

// ─── Success state ──────────────────────────────────────────────────────────
function SuccessView({ amount, onClose }: { amount: number; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <CheckCircle2 className="h-16 w-16 text-success" />
      <div className="text-center">
        <p className="text-lg font-bold text-foreground">¡Pago exitoso!</p>
        <p className="text-muted-foreground text-sm mt-1">{fmt(amount)} cobrados correctamente</p>
      </div>
      <Button onClick={onClose} className="mt-2 w-full">Cerrar</Button>
    </div>
  );
}

// ─── Main modal ─────────────────────────────────────────────────────────────
export default function StripePaymentModal({
  open,
  onOpenChange,
  onSuccess,
  clinicId,
  amountCents,
  description,
  appointmentId,
  saleId,
}: StripePaymentModalProps) {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret]   = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [loadError, setLoadError]         = useState<string | null>(null);
  const [loadingSetup, setLoadingSetup]   = useState(false);
  const [paid, setPaid]                   = useState(false);

  // Cargar publishable key y crear PaymentIntent al abrir
  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setLoadError(null);
      setPaid(false);
      return;
    }

    const init = async () => {
      setLoadingSetup(true);
      setLoadError(null);
      try {
        // 1. Cargar publishable key desde payment_gateway_config
        const { data: gwCfg, error: cfgErr } = await supabase
          .from("payment_gateway_config" as any)
          .select("stripe_publishable_key, ambiente, activo, proveedor")
          .eq("clinic_id", clinicId)
          .maybeSingle();

        if (cfgErr || !gwCfg) throw new Error("Sin configuración de pagos para esta clínica");
        const gw = gwCfg as any;
        if (!gw.activo || gw.proveedor !== "stripe") throw new Error("Stripe no habilitado — configura en Ajustes → Cobros");
        if (!gw.stripe_publishable_key) throw new Error("Llave publicable de Stripe no configurada");

        setStripePromise(loadStripe(gw.stripe_publishable_key));

        // 2. Crear PaymentIntent vía edge function
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Sin sesión");

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-payment-intent`,
          {
            method: "POST",
            headers: {
              Authorization:  `Bearer ${session.access_token}`,
              apikey:          import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              "Content-Type":  "application/json",
            },
            body: JSON.stringify({
              clinic_id:      clinicId,
              amount_cents:   amountCents,
              description,
              appointment_id: appointmentId,
              sale_id:        saleId,
            }),
          },
        );

        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);

        setClientSecret(data.client_secret);
        setTransactionId(data.transaction_id);
      } catch (err: any) {
        setLoadError(err.message);
        toast.error("Error al inicializar cobro: " + err.message);
      } finally {
        setLoadingSetup(false);
      }
    };

    init();
  }, [open, clinicId, amountCents, description, appointmentId, saleId]);

  const handlePaymentSuccess = (piId: string) => {
    setPaid(true);
    onSuccess(piId, transactionId);
    setTimeout(() => onOpenChange(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Cobro con tarjeta
          </DialogTitle>
        </DialogHeader>

        {paid ? (
          <SuccessView amount={amountCents} onClose={() => onOpenChange(false)} />
        ) : loadingSetup ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Preparando cobro…</p>
          </div>
        ) : loadError ? (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {loadError}
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
              Cerrar
            </Button>
          </div>
        ) : stripePromise && clientSecret ? (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: "stripe",
                variables: { colorPrimary: "#6d28d9" },
              },
              locale: "es-419",
            }}
          >
            <PaymentForm
              onSuccess={handlePaymentSuccess}
              onCancel={() => onOpenChange(false)}
              amountCents={amountCents}
            />
          </Elements>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
