import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, Lock, AlertCircle, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { friendlyError } from "@/lib/errors";

type Status = "checking" | "mfa-challenge" | "ready" | "error";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>("checking");
  const [errorMsg, setErrorMsg] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Sesión de recovery viene en AAL1. Si la cuenta tiene MFA, updateUser()
  // rechaza con "insufficient_aal" — hay que subir a AAL2 con un challenge
  // TOTP antes de mostrar el formulario de contraseña.
  const checkAssurance = async () => {
    const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !aal) { setStatus("ready"); return; }
    if (aal.currentLevel === "aal2" || aal.nextLevel !== "aal2") { setStatus("ready"); return; }

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = factors?.totp?.find((f) => f.status === "verified");
    if (!totp) {
      setErrorMsg("Tu cuenta requiere verificación en dos pasos pero no tiene un factor configurado. Contacta al administrador.");
      setStatus("error");
      return;
    }
    setMfaFactorId(totp.id);
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: totp.id });
    if (challengeErr || !challenge) {
      setMfaError(challengeErr?.message ?? "No se pudo iniciar la verificación en dos pasos.");
    } else {
      setMfaChallengeId(challenge.id);
    }
    setStatus("mfa-challenge");
  };

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("error=") || hash.includes("error_code=")) {
      const params = new URLSearchParams(hash.replace("#", ""));
      const desc = params.get("error_description") ?? "El enlace es inválido o ha expirado.";
      setErrorMsg(decodeURIComponent(desc.replace(/\+/g, " ")));
      setStatus("error");
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") void checkAssurance();
    });

    // Si el hash contiene tokens (magiclink o recovery), establecer sesión manualmente
    const hashParams = new URLSearchParams(hash.replace("#", ""));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    }

    const t = setTimeout(() => {
      setStatus((s) => s === "checking" ? "error" : s);
      setErrorMsg("No se pudo verificar el enlace. Solicita uno nuevo.");
    }, 5000);

    return () => { subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId || !mfaChallengeId) return;
    setMfaError(null);
    setLoading(true);
    const { error } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: mfaChallengeId, code: mfaCode });
    setLoading(false);
    if (error) {
      console.error("[ResetPassword] mfa.verify falló", { code: error.code, status: error.status, message: error.message });
      setMfaError(friendlyError(error, error.message || "Código inválido. Intenta de nuevo."));
      return;
    }
    setStatus("ready");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 12) {
      toast({ variant: "destructive", title: "Error", description: "La contraseña debe tener al menos 12 caracteres." });
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
      console.error("[ResetPassword] updateUser falló", { code: error.code, status: error.status, message: error.message, name: error.name });
      const mapped = friendlyError(error, "");
      toast({
        variant: "destructive",
        title: "No se pudo guardar la nueva contraseña (paso: auth.updateUser)",
        description: mapped || `${error.message || "Error sin mensaje"} ${error.code ? `[${error.code}]` : error.status ? `[HTTP ${error.status}]` : ""}`.trim(),
      });
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

          {status === "mfa-challenge" && (
            <>
              <div className="flex items-center gap-2 mb-6">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h2 className="text-display text-lg font-semibold text-card-foreground">Verificación en dos pasos</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Tu cuenta tiene autenticación de dos factores. Ingresa el código de tu app autenticadora para continuar.
              </p>
              {mfaError && <p className="text-sm text-destructive mb-3">{mfaError}</p>}
              <form onSubmit={handleVerifyMfa} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mfa-code">Código de 6 dígitos</Label>
                  <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456"
                    value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} required minLength={6} maxLength={6}
                    disabled={!mfaChallengeId} />
                </div>
                <Button type="submit" className="w-full" disabled={loading || !mfaChallengeId}>
                  {loading ? "Verificando..." : "Verificar"}
                </Button>
              </form>
            </>
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
                    value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} />
                  <PasswordStrengthMeter password={password} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirmar contraseña</Label>
                  <Input id="confirm" type="password" placeholder="••••••••"
                    value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={12} />
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
