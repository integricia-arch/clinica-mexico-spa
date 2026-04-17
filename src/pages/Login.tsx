import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const translateAuthError = (err: any): { title: string; description: string } => {
    const code = err?.code || err?.error_code;
    const reasons: string[] = err?.weak_password?.reasons || [];
    const msg: string = err?.message || "";

    if (code === "weak_password" || reasons.includes("pwned") || /pwned|known to be weak/i.test(msg)) {
      return {
        title: "Contraseña insegura",
        description:
          "Esta contraseña aparece en filtraciones públicas conocidas. Elige una distinta, idealmente con al menos 10 caracteres, mayúsculas, números y símbolos.",
      };
    }
    if (code === "user_already_exists" || /already registered|already exists/i.test(msg)) {
      return {
        title: "Cuenta existente",
        description: "Ya existe una cuenta con este correo. Intenta iniciar sesión.",
      };
    }
    if (code === "invalid_credentials" || /invalid login/i.test(msg)) {
      return {
        title: "Credenciales inválidas",
        description: "Correo o contraseña incorrectos. Verifica e inténtalo de nuevo.",
      };
    }
    if (/password.*(short|length|characters)|at least \d+ characters/i.test(msg)) {
      return {
        title: "Contraseña muy corta",
        description: "La contraseña debe tener al menos 6 caracteres.",
      };
    }
    if (/email.*invalid|invalid.*email/i.test(msg)) {
      return {
        title: "Correo inválido",
        description: "Ingresa un correo electrónico válido.",
      };
    }
    return {
      title: "Error",
      description: msg || "Ocurrió un error inesperado. Inténtalo de nuevo.",
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast({
          title: "Cuenta creada",
          description: "Revisa tu correo electrónico para confirmar tu cuenta.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      }
    } catch (err: any) {
      const { title, description } = translateAuthError(err);
      toast({
        variant: "destructive",
        title,
        description,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-elevated">
            <Heart className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-display text-2xl font-bold text-foreground">ClínicaMX</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sistema de Operaciones Clínicas
          </p>
        </div>

        {/* Form */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-display text-lg font-semibold text-card-foreground mb-6">
            {isSignUp ? "Crear cuenta" : "Iniciar sesión"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="doctor@clinica.mx"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              {isSignUp && (
                <p className="text-xs text-muted-foreground">
                  Usa al menos 6 caracteres. Evita contraseñas comunes (como
                  "123456" o "password"); rechazamos contraseñas que aparecen en
                  filtraciones públicas conocidas.
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              <LogIn className="mr-2 h-4 w-4" />
              {loading
                ? "Procesando..."
                : isSignUp
                ? "Registrarse"
                : "Entrar"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-primary hover:underline"
            >
              {isSignUp
                ? "¿Ya tienes cuenta? Inicia sesión"
                : "¿No tienes cuenta? Regístrate"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Sistema orientado a cumplimiento regulatorio mexicano.
          <br />
          No constituye certificación oficial.
        </p>
      </div>
    </div>
  );
}
