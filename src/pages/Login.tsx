import { useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;


type View = "login" | "signup" | "forgot";

export default function Login() {
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const translateAuthError = (err: any): { title: string; description: string } => {
    const code = err?.code || err?.error_code;
    const reasons: string[] = err?.weak_password?.reasons || [];
    const msg: string = err?.message || "";
    if (code === "weak_password" || reasons.includes("pwned") || /pwned|known to be weak/i.test(msg))
      return { title: "Contraseña insegura", description: "Esta contraseña aparece en filtraciones públicas. Elige una distinta con al menos 10 caracteres, mayúsculas, números y símbolos." };
    if (code === "user_already_exists" || /already registered|already exists/i.test(msg))
      return { title: "Cuenta existente", description: "Ya existe una cuenta con este correo. Intenta iniciar sesión." };
    if (code === "invalid_credentials" || /invalid login/i.test(msg))
      return { title: "Credenciales inválidas", description: "Correo o contraseña incorrectos. Verifica e inténtalo de nuevo." };
    if (/password.*(short|length|characters)|at least \d+ characters/i.test(msg))
      return { title: "Contraseña muy corta", description: "La contraseña debe tener al menos 6 caracteres." };
    if (/email.*invalid|invalid.*email/i.test(msg))
      return { title: "Correo inválido", description: "Ingresa un correo electrónico válido." };
    const rateMatch = msg.match(/after (\d+) seconds?/i);
    if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || /security purposes.*after \d+ seconds?|rate limit/i.test(msg)) {
      const secs = rateMatch?.[1];
      return {
        title: "Demasiados intentos",
        description: secs
          ? `Por seguridad, espera ${secs} segundos antes de solicitar otro enlace.`
          : "Has solicitado demasiados correos en poco tiempo. Espera unos segundos e inténtalo de nuevo.",
      };
    }
    if (code === "email_not_confirmed" || /email.*not.*confirm/i.test(msg))
      return { title: "Correo no confirmado", description: "Revisa tu bandeja y confirma tu correo antes de iniciar sesión." };
    return { title: "Error", description: msg || "Ocurrió un error inesperado. Inténtalo de nuevo." };
  };

  const handleLoginSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      toast({ variant: "destructive", title: "Verificación requerida", description: "Completa la verificación de seguridad antes de continuar." });
      return;
    }
    setLoading(true);
    try {
      if (view === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, captchaToken: captchaToken ?? undefined },
        });
        if (error) throw error;
        toast({ title: "Cuenta creada", description: "Revisa tu correo para confirmar tu cuenta." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email, password,
          options: { captchaToken: captchaToken ?? undefined },
        });
        if (error) throw error;
        const from = (location.state as { from?: string } | null)?.from ?? "/";
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      const { title, description } = translateAuthError(err);
      toast({ variant: "destructive", title, description });
    } finally {
      setLoading(false);
      // Token Turnstile es de un solo uso -- resetear siempre tras el intento.
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Ingresa tu correo electrónico." });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: "Correo enviado",
        description: "Si el correo existe, recibirás un enlace para restablecer tu contraseña.",
      });
      setView("login");
      setEmail("");
    } catch (err: any) {
      const { title, description } = translateAuthError(err);
      toast({ variant: "destructive", title, description });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "https://integrika.mx",
        },
      });
      if (error) {
        const { title, description } = translateAuthError(error);
        toast({ variant: "destructive", title, description });
        setLoading(false);
      }
      // On success: browser redirects to Google → back to app; no need to navigate manually
    } catch (err: unknown) {
      const { title, description } = translateAuthError(err);
      toast({ variant: "destructive", title, description });
      setLoading(false);
    }
  };


  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{
        background: "radial-gradient(ellipse 70% 45% at 50% -5%, hsl(239 84% 62% / 0.07) 0%, transparent 70%), hsl(228, 20%, 98%)",
      }}
    >
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-[0_8px_32px_hsl(239_84%_62%/0.35),0_2px_8px_hsl(239_84%_62%/0.20)]">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden="true">
              <polyline points="2,12 6,12 8,6 10,18 13,9 15,15 17,12 22,12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold text-foreground">ClínicaMX</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sistema de Operaciones Clínicas</p>
        </div>

        <div className="rounded-xl bg-card p-6 shadow-[0_4px_24px_hsl(222_47%_7%/0.09),0_1px_4px_hsl(222_47%_7%/0.05),inset_0_0.5px_0_hsl(0_0%_100%/0.90),inset_0_0_0_1px_hsl(228_20%_90%)]">

          {/* FORGOT PASSWORD */}
          {view === "forgot" && (
            <>
              <button onClick={() => setView("login")} className="flex items-center gap-1 min-h-[44px] py-2 text-sm text-muted-foreground hover:text-foreground mb-2">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Volver
              </button>
              <h2 className="font-display text-lg font-semibold text-card-foreground mb-2">Recuperar contraseña</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
              </p>
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-forgot">Correo electrónico</Label>
                  <Input
                    id="email-forgot"
                    type="email"
                    placeholder="doctor@clinica.mx"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Enviando..." : "Enviar enlace de recuperación"}
                </Button>
              </form>
            </>
          )}

          {/* LOGIN / SIGNUP */}
          {view !== "forgot" && (
            <>
              <div className="form-field-1">
                <h2 className="font-display text-lg font-semibold text-card-foreground mb-6">
                  {view === "signup" ? "Crear cuenta" : "Iniciar sesión"}
                </h2>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full mb-4 h-10 gap-2.5 font-medium text-sm text-foreground bg-white border-[hsl(228_20%_89%)] shadow-[0_1px_2px_hsl(222_47%_7%/0.06),inset_0_0.5px_0_rgba(255,255,255,0.90)] hover:bg-[hsl(228_20%_97%)] hover:-translate-y-px hover:shadow-[0_4px_12px_hsl(222_47%_7%/0.08),0_1px_3px_hsl(222_47%_7%/0.05),inset_0_0.5px_0_rgba(255,255,255,0.90)] active:scale-[0.98] active:translate-y-0 transition-[transform,box-shadow,background-color] duration-150 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
                  onClick={handleGoogle}
                  disabled={loading}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
                  </svg>
                  Continuar con Google
                </Button>
              </div>

              <div className="form-field-2 relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">o con correo</span>
                </div>
              </div>

              <form onSubmit={handleLoginSignup}>
                <div className="form-field-3 space-y-4">
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
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Contraseña</Label>
                      {view === "login" && (
                        <button
                          type="button"
                          onClick={() => setView("forgot")}
                          className="text-xs text-primary hover:underline"
                        >
                          ¿Olvidaste tu contraseña?
                        </button>
                      )}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      />
                    {view === "signup" && <PasswordStrengthMeter password={password} />}
                  </div>
                  {TURNSTILE_SITE_KEY && (
                    <Turnstile
                      ref={turnstileRef}
                      siteKey={TURNSTILE_SITE_KEY}
                      onSuccess={setCaptchaToken}
                      onExpire={() => setCaptchaToken(null)}
                      onError={() => setCaptchaToken(null)}
                      options={{ size: "flexible" }}
                    />
                  )}
                </div>

                <div className="form-field-4 mt-4">
                  <Button
                    type="submit"
                    className="w-full h-10 font-semibold text-sm bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-700 border-0 shadow-[0_2px_8px_hsl(239_84%_62%/0.32),0_1px_3px_hsl(239_84%_62%/0.20),inset_0_0.5px_0_rgba(255,255,255,0.18)] hover:shadow-[0_4px_16px_hsl(239_84%_62%/0.40),0_2px_6px_hsl(239_84%_62%/0.25),inset_0_0.5px_0_rgba(255,255,255,0.18)] active:scale-[0.97] transition-[transform,box-shadow,background] duration-100 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
                    disabled={loading || (!!TURNSTILE_SITE_KEY && !captchaToken)}
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    {loading ? "Procesando..." : view === "signup" ? "Registrarse" : "Entrar"}
                  </Button>
                </div>
              </form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setView(view === "signup" ? "login" : "signup")}
                  className="text-sm text-primary hover:underline"
                >
                  {view === "signup" ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate"}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Sistema orientado a cumplimiento regulatorio mexicano.
          <br />No constituye certificación oficial.
        </p>
      </div>
    </div>
  );
}
