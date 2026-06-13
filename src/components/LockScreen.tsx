import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, Lock, LogOut } from "lucide-react";
import { toast } from "sonner";

interface Props {
  email: string;
  initials: string;
  roleLabel: string;
  onUnlocked: () => void;
  onSwitchUser: () => void;
}

const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 30_000;

export default function LockScreen({ email, initials, roleLabel, onUnlocked, onSwitchUser }: Props) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;
  const secondsLeft = lockedUntil ? Math.ceil((lockedUntil - Date.now()) / 1000) : 0;

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!password || isLocked) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_MS);
        setAttempts(0);
        toast.error(`Demasiados intentos. Espera 30 segundos.`);
      } else {
        toast.error(`Contraseña incorrecta. ${MAX_ATTEMPTS - next} intento${MAX_ATTEMPTS - next !== 1 ? "s" : ""} restante${MAX_ATTEMPTS - next !== 1 ? "s" : ""}.`);
      }
      setPassword("");
      return;
    }
    onUnlocked();
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md p-6">
      <div className="mb-6 flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-elevated">
          <Heart className="h-7 w-7 text-primary-foreground" />
        </div>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary text-2xl font-bold ring-2 ring-primary/20">
          {initials}
        </div>
        <div className="text-center">
          <p className="font-semibold text-foreground">{email}</p>
          <p className="text-sm text-muted-foreground">{roleLabel}</p>
        </div>
      </div>

      <div className="w-full max-w-xs rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2 justify-center text-muted-foreground text-sm">
          <Lock className="h-4 w-4" />
          <span>Pantalla bloqueada</span>
        </div>

        <form onSubmit={handleUnlock} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="lock-password">Contraseña</Label>
            <Input
              id="lock-password"
              type="password"
              placeholder="Ingresa tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="h-11"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !password || isLocked}>
            {isLocked ? `Bloqueado (${secondsLeft}s)` : loading ? "Verificando…" : "Desbloquear"}
          </Button>
        </form>

        <div className="border-t border-border pt-3">
          <button
            onClick={onSwitchUser}
            className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <LogOut className="h-3.5 w-3.5" />
            Cambiar de usuario
          </button>
        </div>
      </div>
    </div>
  );
}
