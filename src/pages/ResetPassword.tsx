import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, Lock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";

type Status = "checking" | "ready" | "error";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>("checking");
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Detectar error en el hash (link expirado, inválido, etc.)
    const hash = window.location.hash;
    if (hash.includes("error=") || hash.includes("error_code=")) {
      const params = new URLSearchParams(hash.replace("#", ""));
      const desc = params.get("error_description") ?? "El enlace es inválido o ha expirado.";
      setErrorMsg(decodeURIComponent(desc.replace(/\+/g, " ")));
      setStatus("error");
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStatus("ready");
    });

    // Timeout: si en 5s no llega PASSWORD_RECOVERY, mostrar error
    const t = setTimeout(() => {
      setStatus((s) => s === "checking" ? "error" : s);
      setErrorMsg("No se pudo verificar el enlace. Solicita uno nuevo.");
    }, 5000);

    return () => { subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ variant: "destructive", title: "Error", description: "La contraseña debe tener al menos 6 caracteres." });
      return;
    }
    if (password !== confirm) {
      toast({ variant: "destructive", title: "Error", description: "Las contraseñas no coinciden." });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }
    toast({ title: "Contraseña actualizada", description: "Inicia sesión con tu nueva contraseña." });
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-elevated">
            <Heart className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-display text-2xl font-bold text-foreground">ClínicaMX</h1>
          <p className="mt-1 text-sm text-muted-foreground">Restablecer contraseña</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          {status === "checking" && (
            <div className="text-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Verificando enlace...</p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
              <p className="text-sm font-medium text-destructive">{errorMsg}</p>
              <Button className="w-full" onClick={() => navigate("/login")}>
                Solicitar nuevo enlace
              </Button>
            </div>
          )}

          {status === "ready" && (
            <>
              <div className="flex items-center gap-2 mb-6">
                <Lock className="h-5 w-5 text-primary" />
                <h2 className="text-display text-lg font-semibold text-card-foreground">Nueva contraseña</h2>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Nueva contraseña</Label>
                  <Input id="password" type="password" placeholder="••••••••"
                    value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                  <PasswordStrengthMeter password={password} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirmar contraseña</Label>
                  <Input id="confirm" type="password" placeholder="••••••••"
                    value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Guardando..." : "Guardar nueva contraseña"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
