import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type AssuranceLevel = "aal1" | "aal2";

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
  const { user, hasRole } = useAuth();
  const [status, setStatus] = useState<"loading" | "ok" | "needs-enroll" | "needs-challenge">("loading");

  const refresh = useCallback(async () => {
    if (!user) {
      setStatus("ok");
      return;
    }

    const { data: adminCheck } = await supabase.rpc("is_global_admin", { _user_id: user.id });
    const requiresMfa = hasRole("admin") || !!adminCheck;

    if (!requiresMfa) {
      setStatus("ok");
      return;
    }

    const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !aal) {
      setStatus("needs-enroll");
      return;
    }

    setStatus(mfaGateStatus(aal.currentLevel as AssuranceLevel, aal.nextLevel as AssuranceLevel, requiresMfa));
  }, [user, hasRole]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, refresh };
}
