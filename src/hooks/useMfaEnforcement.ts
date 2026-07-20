import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type AssuranceLevel = "aal1" | "aal2";

const DEVICE_TOKEN_KEY = "mfa_trusted_device_token";

function getOrCreateDeviceToken(): string {
  let token = localStorage.getItem(DEVICE_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID() + crypto.randomUUID();
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
  }
  return token;
}

export async function registerTrustedDevice() {
  const token = getOrCreateDeviceToken();
  await supabase.rpc("mfa_register_trusted_device", {
    _device_token: token,
    _device_label: navigator.userAgent.slice(0, 200),
  });
}

async function isTrustedDevice(): Promise<boolean> {
  const token = localStorage.getItem(DEVICE_TOKEN_KEY);
  if (!token) return false;
  const { data, error } = await supabase.rpc("mfa_check_trusted_device", { _device_token: token });
  return !error && data === true;
}

export function mfaGateStatus(
  currentLevel: AssuranceLevel,
  nextLevel: AssuranceLevel,
  requiresMfa: boolean,
): "ok" | "needs-enroll" | "needs-challenge" {
  if (!requiresMfa) return "ok";
  if (currentLevel === "aal2") return "ok";
  if (nextLevel === "aal2") return "needs-challenge";
  return "needs-enroll";
}

export function useMfaEnforcement() {
  const { user } = useAuth();
  const [status, setStatus] = useState<"loading" | "ok" | "needs-enroll" | "needs-challenge">("loading");

  const refresh = useCallback(async () => {
    if (!user) {
      setStatus("ok");
      return;
    }

    // Solo usuarios marcados en su alta como requeridos de MFA (nuevos admins).
    // Cuentas existentes antes de esta migración quedan grandfathered (flag default false).
    const { data: profile } = await supabase
      .from("profiles")
      .select("mfa_enrollment_required")
      .eq("id", user.id)
      .maybeSingle();
    const requiresMfa = !!profile?.mfa_enrollment_required;

    if (!requiresMfa) {
      setStatus("ok");
      return;
    }

    const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !aal) {
      setStatus("needs-enroll");
      return;
    }

    const gate = mfaGateStatus(aal.currentLevel as AssuranceLevel, aal.nextLevel as AssuranceLevel, requiresMfa);
    if (gate === "ok") {
      setStatus("ok");
      return;
    }

    // Ya enroló antes (nextLevel aal2 disponible) y este es un dispositivo ya
    // confiado → no volver a pedir el código, solo en dispositivo nuevo/distinto.
    if (gate === "needs-challenge" && (await isTrustedDevice())) {
      setStatus("ok");
      return;
    }

    setStatus(gate);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, refresh };
}
