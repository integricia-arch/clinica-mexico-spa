import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Loader2, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { Button } from "@/components/ui/button";

const CODE_TTL_MS = 15 * 60 * 1000;

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function VincularTelegram() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeClinicId } = useActiveClinic();
  const [linked, setLinked] = useState<boolean | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("staff_identidades_canal")
      .select("id")
      .eq("user_id", user.id)
      .eq("canal_id", "telegram")
      .maybeSingle()
      .then(({ data }) => setLinked(!!data));
  }, [user]);

  const handleGenerar = async () => {
    if (!user) return;
    setGenerating(true);
    const nuevoCode = generateCode();
    const expires = new Date(Date.now() + CODE_TTL_MS).toISOString();
    const { error } = await supabase.from("staff_link_codes").insert({
      code: nuevoCode,
      user_id: user.id,
      clinic_id: activeClinicId,
      expires_at: expires,
    });
    setGenerating(false);
    if (error) { toast.error("No se pudo generar el código: " + error.message); return; }
    setCode(nuevoCode);
    setExpiresAt(Date.now() + CODE_TTL_MS);
  };

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(`/vincular ${code}`);
    toast.success("Copiado");
  };

  const minutosRestantes = expiresAt ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 60000)) : null;

  return (
    <div className="space-y-6 max-w-md">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-lg font-semibold">Vincular Telegram</h1>
          <p className="text-sm text-muted-foreground">Recibe avisos de asignación de citas directo en Telegram</p>
        </div>
      </div>

      {linked && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          Tu cuenta ya está vinculada. Generar un nuevo código la revincula igual.
        </div>
      )}

      {!code ? (
        <Button onClick={handleGenerar} disabled={generating || linked === null}>
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Generar código de vinculación
        </Button>
      ) : (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            Abre el bot de Telegram de la clínica y envía:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted px-3 py-2 text-base font-mono font-semibold">
              /vincular {code}
            </code>
            <Button variant="outline" size="icon" onClick={handleCopy}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Expira en {minutosRestantes} min. Si expira, genera uno nuevo.
          </p>
        </div>
      )}
    </div>
  );
}
