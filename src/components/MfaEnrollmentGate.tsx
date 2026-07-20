import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMfaEnforcement, registerTrustedDevice } from "@/hooks/useMfaEnforcement";
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
    setErrorMsg(null);
    // Limpiar factores TOTP unverified colgados de intentos previos —
    // si no, enroll() falla con "factor already exists" y el QR nunca aparece.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    const stale = (existing?.all ?? []).filter(
      (f) => f.factor_type === "totp" && f.status !== "verified",
    );
    for (const f of stale) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `totp-${Date.now()}`,
    });
    if (error || !data) { setErrorMsg(error?.message ?? "Error al enrolar"); return; }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
  }

  async function startChallenge(fId: string) {
    setErrorMsg(null);
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
    // Marca este dispositivo como confiable — no se volverá a pedir TOTP aquí,
    // solo en un dispositivo nuevo/distinto.
    await registerTrustedDevice();
    await refresh();
  }

  async function resetLostFactor() {
    setErrorMsg(null);
    const { data } = await supabase.auth.mfa.listFactors();
    const totp = data?.totp?.[0];
    if (!totp) { setErrorMsg("No se encontró ningún factor para reiniciar."); return; }

    // unenroll() del cliente exige AAL2, que es justo lo que el usuario no
    // puede pasar si perdió su app autenticadora — por eso se borra vía
    // Edge Function con service_role (valida que el factor sea suyo primero).
    const { error } = await supabase.functions.invoke("mfa-reset", {
      body: { factorId: totp.id },
    });
    if (error) { setErrorMsg(error.message); return; }

    setFactorId(null);
    setChallengeId(null);
    setQr(null);
    setErrorMsg(null);
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
          <div className="space-y-3">
            <Button onClick={async () => {
              setErrorMsg(null);
              const { data } = await supabase.auth.mfa.listFactors();
              // Solo factores TOTP verificados — un factor unverified no puede retarse.
              const totp = data?.totp?.find((f) => f.status === "verified");
              if (!totp) {
                setErrorMsg("No hay un factor TOTP verificado. Contacta al administrador.");
                return;
              }
              setFactorId(totp.id);
              await startChallenge(totp.id);
            }}>
              Verificar con mi app de autenticación
            </Button>
            <Button variant="ghost" size="sm" onClick={resetLostFactor}>
              ¿Perdiste acceso a tu app autenticadora? Reiniciar verificación
            </Button>
          </div>
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
