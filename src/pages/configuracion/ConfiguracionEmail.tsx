import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Save, Loader2, AlertCircle } from "lucide-react";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useClinicSettingsForm } from "@/hooks/useClinicSettingsForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EmailSettings {
  from_name: string;
  from_email: string;
  reply_to: string;
}

const DEFAULTS: EmailSettings = {
  from_name: "",
  from_email: "",
  reply_to: "",
};

export default function ConfiguracionEmail() {
  const navigate = useNavigate();
  const { activeClinicId } = useActiveClinic();
  const { form, setField, loading, saving, dirty, error, save } =
    useClinicSettingsForm<EmailSettings>(activeClinicId ?? "", "email", DEFAULTS);

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
        <button
          onClick={() => navigate("/configuracion")}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-display text-xl font-bold text-foreground">Email y notificaciones</h1>
          <p className="text-sm text-muted-foreground">
            Configura el remitente que aparece en correos enviados desde el sistema (CFDI, recordatorios).
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-card-foreground">Remitente</h2>
        </div>

        <div>
          <Label htmlFor="from_name">Nombre del remitente</Label>
          <Input
            id="from_name"
            value={form.from_name}
            onChange={(e) => setField("from_name", e.target.value)}
            placeholder="Ej. Integriclinica"
            disabled={saving}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Nombre que ve el receptor en la bandeja de entrada.
          </p>
        </div>

        <div>
          <Label htmlFor="from_email">Correo emisor</Label>
          <Input
            id="from_email"
            type="email"
            value={form.from_email}
            onChange={(e) => setField("from_email", e.target.value)}
            placeholder="Ej. facturacion@tudominio.com"
            disabled={saving}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Debe pertenecer a un dominio verificado en Resend. Si lo dejas vacío se usará el remitente por defecto del sistema.
          </p>
        </div>

        <div>
          <Label htmlFor="reply_to">Responder a (opcional)</Label>
          <Input
            id="reply_to"
            type="email"
            value={form.reply_to}
            onChange={(e) => setField("reply_to", e.target.value)}
            placeholder="Ej. contacto@tudominio.com"
            disabled={saving}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Correo al que se dirigen las respuestas. Puede ser diferente al emisor.
          </p>
        </div>
      </section>

      <div className="rounded-lg bg-muted/60 border border-border px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">Verificación de dominio (Resend)</p>
        <p>
          Para usar tu propio dominio como remitente debes verificarlo en el panel de Resend
          y agregar los registros DNS indicados. El correo enviado desde un dominio no verificado
          puede caer en spam.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || !dirty} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar configuración de email
        </Button>
      </div>
    </div>
  );
}
