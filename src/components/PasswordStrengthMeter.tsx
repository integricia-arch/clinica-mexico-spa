import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordStrengthMeterProps {
  password: string;
}

interface Rule {
  label: string;
  test: (p: string) => boolean;
}

const RULES: Rule[] = [
  { label: "Mínimo 8 caracteres", test: (p) => p.length >= 8 },
  { label: "Una mayúscula (A-Z)", test: (p) => /[A-Z]/.test(p) },
  { label: "Una minúscula (a-z)", test: (p) => /[a-z]/.test(p) },
  { label: "Un número (0-9)", test: (p) => /\d/.test(p) },
  { label: "Un símbolo (!@#$...)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const COMMON_PASSWORDS = new Set([
  "123456",
  "12345678",
  "123456789",
  "password",
  "qwerty",
  "abc123",
  "111111",
  "password1",
  "contraseña",
  "admin",
  "iloveyou",
  "letmein",
]);

function calcScore(password: string): number {
  if (!password) return 0;
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 1;
  let score = RULES.reduce((acc, r) => acc + (r.test(password) ? 1 : 0), 0);
  if (password.length >= 12) score += 1;
  return Math.min(score, 5);
}

const LEVELS = [
  { label: "Muy débil", color: "bg-destructive", text: "text-destructive" },
  { label: "Débil", color: "bg-destructive", text: "text-destructive" },
  { label: "Aceptable", color: "bg-amber-500", text: "text-amber-600" },
  { label: "Buena", color: "bg-amber-500", text: "text-amber-600" },
  { label: "Fuerte", color: "bg-emerald-500", text: "text-emerald-600" },
  { label: "Muy fuerte", color: "bg-emerald-600", text: "text-emerald-700" },
];

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const score = useMemo(() => calcScore(password), [password]);
  const level = LEVELS[score];
  const isCommon = password && COMMON_PASSWORDS.has(password.toLowerCase());

  if (!password) return null;

  return (
    <div className="space-y-2 pt-1" aria-live="polite">
      <div className="flex gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={score}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i < score ? level.color : "bg-muted",
            )}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className={cn("font-medium", level.text)}>{level.label}</span>
        {isCommon && (
          <span className="text-destructive">Contraseña común detectada</span>
        )}
      </div>
      <ul className="space-y-1 text-xs">
        {RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li
              key={rule.label}
              className={cn(
                "flex items-center gap-1.5",
                ok ? "text-emerald-600" : "text-muted-foreground",
              )}
            >
              {ok ? (
                <Check className="h-3 w-3" />
              ) : (
                <X className="h-3 w-3" />
              )}
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
