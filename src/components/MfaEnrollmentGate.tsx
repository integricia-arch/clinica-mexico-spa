import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMfaEnforcement } from "@/hooks/useMfaEnforcement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function MfaEnrollmentGate({ children }: { children: React.ReactNode }) {
  const { status, refresh } = useMfaEnforcement();
  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin motion-reduce:animate-none rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (status === "ok") return <>{children}</>;

  async function startEnroll() {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error || !data) { setErrorMsg(error?.message ?? "Error al enrolar"); return; }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
  }

  async function startChallenge(fId: string) {
    const { data, error } = await supabase.auth.mfa.challenge({ factorId: fId });
    if (error || !data) { setErrorMsg(error?.message ?? "Error al iniciar verificación"); return; }
    setChallengeId(data.id);
  }

  async function verify() {
    const fId = factorId;
    const cId = challengeId;
    if (!fId || !cId) return;
    const { error } = await supabase.auth.mfa.verify({ factorId: fId, challengeId: cId, code });
    if (error) { setErrorMsg(error.message); return; }
    await refresh();
  }

  return (
    <div className="flex h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-lg font-semibold">Verificación en dos pasos requerida</h1>
        <p className="text-sm text-muted-foreground">
          Tu rol requiere autenticación de dos factores (TOTP) para continuar.
        </p>
        {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

        {status === "needs-enroll" && !qr && (
          <Button onClick={startEnroll}>Configurar autenticación de dos factores</Button>
        )}

        {qr && !challengeId && (
          <div className="space-y-3">
            <img src={qr} alt="Código QR TOTP" className="mx-auto" />
            <Button onClick={() => factorId && startChallenge(factorId)}>Ya escaneé el código</Button>
          </div>
        )}

        {status === "needs-challenge" && !challengeId && (
          <Button onClick={async () => {
            const { data } = await supabase.auth.mfa.listFactors();
            const totp = data?.totp?.[0];
            if (totp) { setFactorId(totp.id); await startChallenge(totp.id); }
          }}>
            Verificar con mi app de autenticación
          </Button>
        )}

        {challengeId && (
          <div className="space-y-3">
            <Input
              inputMode="numeric"
              placeholder="Código de 6 dígitos"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button onClick={verify}>Verificar</Button>
          </div>
        )}
      </div>
    </div>
  );
}
