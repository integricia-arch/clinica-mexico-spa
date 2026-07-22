import integrikaLogo from "@/assets/integrika-logo.jpeg";
import { cn } from "@/lib/utils";

export interface LogoProps {
  /** Visual size preset. Maps to a fixed width/height. */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Renders just the logo mark or mark + brand text. */
  variant?: "icon" | "wordmark";
  /** Additional classes applied to the outer wrapper. */
  className?: string;
  /** Additional classes applied to the image. */
  imgClassName?: string;
  /** Override default alt text. */
  alt?: string;
  /** White-label: logo de la clínica activa (clinics.logo_url). Null/undefined = logo IntegriKa. */
  logoUrl?: string | null;
  /** White-label: nombre de la clínica activa (clinics.name). Null/undefined = wordmark IntegriKa. */
  name?: string | null;
  /** White-label: subtítulo bajo el nombre. Default "Sistema Operativo de Clínica". */
  subtitle?: string | null;
}

const sizeMap = {
  xs: 24,
  sm: 36,
  md: 40,
  lg: 56,
  xl: 72,
};

export function Logo({
  size = "md",
  variant = "icon",
  className,
  imgClassName,
  alt,
  logoUrl,
  name,
  subtitle,
}: LogoProps) {
  const src = logoUrl || integrikaLogo;
  const displayAlt = alt ?? name ?? "IntegriKa";
  const displayName = name || "IntegriKa";
  const displaySubtitle = subtitle || "Sistema Operativo de Clínica";
  const px = sizeMap[size];
  const radius = size === "xs" ? 6 : size === "sm" ? 8 : size === "md" ? 10 : size === "lg" ? 14 : 18;
  const shadow =
    size === "xl"
      ? "shadow-[0_8px_32px_hsl(239_84%_62%/0.35),0_2px_8px_hsl(239_84%_62%/0.20)]"
      : "shadow-[0_4px_16px_hsl(239_84%_62%/0.30)]";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img
        src={src}
        alt={displayAlt}
        width={px}
        height={px}
        className={cn(
          "shrink-0 object-cover",
          shadow,
          imgClassName,
        )}
        style={{ borderRadius: radius, width: px, height: px }}
      />
      {variant === "wordmark" && (
        <div className="min-w-0">
          <span className="font-display font-semibold text-sm tracking-tight text-white/90 truncate">{displayName}</span>
          <span className="block text-[10px] tracking-wide text-white/40 truncate">{displaySubtitle}</span>
        </div>
      )}
    </div>
  );
}

export default Logo;
