import { useEffect, useState } from "react";
import { Mail, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface CfdiDoc {
  id: string;
  uuid_fiscal: string | null;
  serie: string | null;
  folio: string | null;
  tipo: string;
  rfc_receptor: string;
  nombre_receptor: string;
  total: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  doc: CfdiDoc;
}

const TIPO_LABEL: Record<string, string> = {
  I: "Factura de Ingreso",
  E: "Nota de Crédito",
  P: "Complemento de Pagos",
};

const fmt = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function EnviarEmailCFDIDialog({ open, onOpenChange, doc }: Props) {
  const { activeClinicId } = useActiveClinic();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setSending(false);
    loadEmailFromCatalogo();
  }, [open]);

  const loadEmailFromCatalogo = async () => {
    if (!activeClinicId || !doc.rfc_receptor) return;
    setLoadingEmail(true);
    const { data } = await supabase
      .from("cfdi_receptores" as any)
      .select("email_envio")
      .eq("clinic_id", activeClinicId)
      .eq("rfc", doc.rfc_receptor)
      .maybeSingle();
    if (data && (data as any).email_envio) {
      setEmail((data as any).email_envio);
    }
    setLoadingEmail(false);
  };

  const handleEnviar = async () => {
    if (!activeClinicId) return;
    if (!email.trim()) { toast.error("El email es obligatorio"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Formato de email inválido");
      return;
    }

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sin sesión activa");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cfdi-email`,
        {
          method:  "POST",
          headers: {
            Authorization:  `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            apikey:         import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            clinic_id:      activeClinicId,
            cfdi_id:        doc.id,
            email_override: email.trim(),
          }),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? `Error ${res.status}`);

      toast.success(
        `CFDI enviado a ${result.email_sent}` +
        (result.has_pdf ? " (XML + PDF)" : " (XML)")
      );
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? "Error al enviar el email");
    } finally {
      setSending(false);
    }
  };

  const folio = doc.serie ? `${doc.serie}-${doc.folio ?? "0"}` : (doc.folio ?? "—");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Enviar CFDI por email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Resumen CFDI */}
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm space-y-1">
            <div><span className="font-medium">Tipo:</span> {TIPO_LABEL[doc.tipo] ?? doc.tipo}</div>
            <div><span className="font-medium">Folio:</span> {folio}</div>
            <div><span className="font-medium">Receptor:</span> {doc.nombre_receptor}</div>
            <div><span className="font-medium">RFC:</span> {doc.rfc_receptor}</div>
            <div><span className="font-medium">Total:</span> {fmt(doc.total)}</div>
          </div>

          {/* Campo email */}
          <div>
            <Label htmlFor="cfdi_email_dest">
              Enviar a *
              {loadingEmail && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                  Cargando email del catálogo…
                </span>
              )}
            </Label>
            <Input
              id="cfdi_email_dest"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="destinatario@email.com"
              disabled={sending}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Pre-llenado desde el catálogo de receptores. Editable para este envío.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Se adjuntará el XML timbrado. El PDF se incluye si está disponible en el PAC.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={handleEnviar} disabled={sending || !email.trim()}>
            {sending
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enviando…</>
              : <><Send className="h-4 w-4 mr-2" />Enviar</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
