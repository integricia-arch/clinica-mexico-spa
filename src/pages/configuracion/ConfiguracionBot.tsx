import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle, Save, Loader2, AlertCircle, AlertTriangle } from "lucide-react";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useClinicSettingsForm } from "@/hooks/useClinicSettingsForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BotSettings {
  nombre_asistente: string;
  tono: "formal" | "cálido" | "casual";
  mensaje_bienvenida: string;
  mensaje_despedida: string;
  instrucciones_extra: string;
  recordatorios_horas: number;
  promociones_habilitadas: boolean;
  promociones_texto_optin: string;
}

const DEFAULTS: BotSettings = {
  nombre_asistente: "Asistente Clínica",
  tono: "cálido",
  mensaje_bienvenida: "Hola, soy tu asistente de agendamiento",
  mensaje_despedida: "¡Gracias por usar nuestros servicios!",
  instrucciones_extra: "",
  recordatorios_horas: 24,
  promociones_habilitadas: false,
  promociones_texto_optin: "",
};

const TONES = [
  { value: "formal", label: "Formal" },
  { value: "cálido", label: "Cálido" },
  { value: "casual", label: "Casual" },
];

// Keywords that should never appear in instrucciones_extra
const FORBIDDEN_KEYWORDS = /diagnostica|consejo médico/i;

function hasForbiddenKeywords(text: string): boolean {
  return FORBIDDEN_KEYWORDS.test(text);
}

export default function ConfiguracionBot() {
  const navigate = useNavigate();
  const { activeClinicId } = useActiveClinic();
  const { form, setField, loading, saving, dirty, error, save } =
    useClinicSettingsForm<BotSettings>(activeClinicId ?? "", "bot", DEFAULTS);

  const hasWarning = hasForbiddenKeywords(form.instrucciones_extra);

  const handleSave = async () => {
    if (hasWarning) {
      const confirmed = window.confirm(
        'Advertencia: "instrucciones_extra" contiene palabras prohibidas (diagnostica, consejo médico).\n\n¿Continuar de todas formas?'
      );
      if (!confirmed) return;
    }
    await save();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/configuracion")}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-display text-xl font-bold text-foreground flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" /> Configuración del Bot Telegram
          </h1>
          <p className="text-sm text-muted-foreground">
            Personaliza el comportamiento y mensajes del asistente de agendamiento.
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
          <MessageCircle className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-card-foreground">Identidad del Asistente</h2>
        </div>

        <div>
          <Label htmlFor="nombre_asistente">Nombre del asistente</Label>
          <Input
            id="nombre_asistente"
            value={form.nombre_asistente}
            onChange={(e) => setField("nombre_asistente", e.target.value)}
            placeholder="Ej. Asistente Clínica"
            disabled={saving}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Nombre que el bot usa para presentarse a los usuarios.
          </p>
        </div>

        <div>
          <Label htmlFor="tono">Tono de comunicación</Label>
          <Select value={form.tono} onValueChange={(v) => setField("tono", v as BotSettings["tono"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Afecta la forma en que el bot responde a los usuarios.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-card-foreground">Mensajes</h2>
        </div>

        <div>
          <Label htmlFor="mensaje_bienvenida">Mensaje de bienvenida</Label>
          <Textarea
            id="mensaje_bienvenida"
            value={form.mensaje_bienvenida}
            onChange={(e) => setField("mensaje_bienvenida", e.target.value)}
            placeholder="Hola, soy tu asistente de agendamiento"
            className="min-h-16"
            disabled={saving}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Se envía cuando el usuario inicia la conversación.
          </p>
        </div>

        <div>
          <Label htmlFor="mensaje_despedida">Mensaje de despedida</Label>
          <Textarea
            id="mensaje_despedida"
            value={form.mensaje_despedida}
            onChange={(e) => setField("mensaje_despedida", e.target.value)}
            placeholder="¡Gracias por usar nuestros servicios!"
            className="min-h-16"
            disabled={saving}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Se envía al finalizar una sesión o cuando el usuario pide ayuda.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-card-foreground">Instrucciones Adicionales</h2>
        </div>

        <div>
          <Label htmlFor="instrucciones_extra">Instrucciones para el asistente</Label>
          <Textarea
            id="instrucciones_extra"
            value={form.instrucciones_extra}
            onChange={(e) => setField("instrucciones_extra", e.target.value)}
            placeholder="Ej. Prioriza agendar con el Dr. González en horario matutino..."
            className="min-h-20"
            disabled={saving}
          />
          {hasWarning && (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 flex items-center gap-2 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Advertencia: Las instrucciones no pueden contener palabras prohibidas como "diagnostica" o "consejo médico".
              </span>
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Instrucciones contextuales para guiar el comportamiento del asistente.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-card-foreground">Recordatorios</h2>
        </div>

        <div>
          <Label htmlFor="recordatorios_horas">Horas antes de la cita para recordatorio</Label>
          <Input
            id="recordatorios_horas"
            type="number"
            min="1"
            max="72"
            value={form.recordatorios_horas}
            onChange={(e) => setField("recordatorios_horas", Math.max(1, Math.min(72, parseInt(e.target.value) || 1)))}
            disabled={saving}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Rango: 1 a 72 horas. El bot enviará recordatorios automáticos en el tiempo especificado.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-card-foreground">Promociones</h2>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="promociones_habilitadas" className="cursor-pointer">
              Habilitar promociones y ofertas
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Permite que el bot envíe mensajes promocionales a usuarios.
            </p>
          </div>
          <Switch
            id="promociones_habilitadas"
            checked={form.promociones_habilitadas}
            onCheckedChange={(v) => setField("promociones_habilitadas", v)}
            disabled={saving}
          />
        </div>

        {form.promociones_habilitadas && (
          <div>
            <Label htmlFor="promociones_texto_optin">Mensaje de opt-in para promociones</Label>
            <Textarea
              id="promociones_texto_optin"
              value={form.promociones_texto_optin}
              onChange={(e) => setField("promociones_texto_optin", e.target.value)}
              placeholder="Ej. ¿Te gustaría recibir ofertas especiales en tu próxima cita?"
              className="min-h-16"
              disabled={saving}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Mensaje que se muestra para pedir consentimiento antes de enviar promociones.
            </p>
          </div>
        )}
      </section>

      <div className="rounded-lg bg-muted/60 border border-border px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">Restricciones de seguridad</p>
        <p>
          El asistente nunca puede diagnosticar, recetar o dar consejo médico. Las instrucciones
          deben limitarse a: agendar citas, recabar información del paciente, recordatorios,
          y gestión de reservas. Cualquier solicitud de consejo médico será rechazada.
        </p>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate("/configuracion")} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving || !dirty} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar configuración del bot
        </Button>
      </div>
    </div>
  );
}
