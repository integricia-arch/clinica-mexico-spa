import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, CreditCard, ArrowLeftRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Metodo = "tarjeta" | "transferencia";

interface Props {
  corteId: string;
  metodo: Metodo;
}

const CONFIG: Record<Metodo, { label: string; icon: React.ElementType; placeholder: string }> = {
  tarjeta: {
    label: "Conciliación tarjeta (TPV)",
    icon: CreditCard,
    placeholder: "Total reportado por terminal física",
  },
  transferencia: {
    label: "Conciliación transferencias / SPEI",
    icon: ArrowLeftRight,
    placeholder: "Total transferencias confirmadas",
  },
};

const fmt = (n: number) =>
  Number(n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function PagoReconcile({ corteId, metodo }: Props) {
  const cfg = CONFIG[metodo];
  const Icon = cfg.icon;

  const [sistemaTot, setSistemaTot] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [saved, setSaved] = useState<{ declarado: number; diff: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!corteId) return;
    supabase
      .rpc("get_corte_pago_total", { p_corte_id: corteId, p_metodo: metodo } as never)
      .then(({ data, error }) => {
        setLoading(false);
        if (error || data === null) return;
        const tot = Number(data);
        setSistemaTot(tot);
        setInput(String(tot));
      });
  }, [corteId, metodo]);

  if (loading || sistemaTot === 0 || sistemaTot === null) return null;

  if (saved) {
    const diffColor =
      saved.diff === 0 ? "text-green-700 dark:text-green-400" :
      Math.abs(saved.diff) <= 1 ? "text-amber-600" : "text-red-600";
    return (
      <div className="rounded-lg border border-green-500/40 bg-green-500/5 p-3 space-y-1 text-sm">
        <p className="font-medium text-green-700 dark:text-green-400 flex items-center gap-1.5">
          <CheckCircle className="h-3.5 w-3.5" /> {cfg.label} — registrada
        </p>
        <div className="flex justify-between text-muted-foreground">
          <span>Sistema</span>
          <span className="font-medium text-foreground">{fmt(sistemaTot)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Declarado</span>
          <span className="font-medium text-foreground">{fmt(saved.declarado)}</span>
        </div>
        <div className={`flex justify-between font-semibold ${diffColor}`}>
          <span>Diferencia</span>
          <span>{saved.diff >= 0 ? "+" : ""}{fmt(saved.diff)}</span>
        </div>
      </div>
    );
  }

  const declared = Number(input);
  const liveDiff = !isNaN(declared) ? declared - sistemaTot : null;
  const diffColor =
    liveDiff === null ? "" :
    liveDiff === 0 ? "text-green-600" :
    Math.abs(liveDiff) <= 1 ? "text-amber-600" : "text-red-600";

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
      <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" /> {cfg.label}
      </p>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Sistema registró</span>
        <span className="font-medium text-foreground">{fmt(sistemaTot)}</span>
      </div>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={cfg.placeholder}
        className="h-9 text-sm"
      />
      {liveDiff !== null && (
        <p className={`text-xs flex items-center gap-1 ${diffColor}`}>
          {liveDiff !== 0 && <AlertTriangle className="h-3 w-3" />}
          Diferencia: {liveDiff >= 0 ? "+" : ""}{fmt(liveDiff)}
          {liveDiff === 0 && " ✓ Cuadrado"}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          disabled={saving || isNaN(declared) || declared < 0}
          onClick={async () => {
            if (isNaN(declared) || declared < 0) { toast.error("Monto inválido"); return; }
            setSaving(true);
            const { data, error } = await supabase.rpc("corte_set_pago_declarado", {
              p_corte_id: corteId,
              p_metodo: metodo,
              p_declarado: declared,
            } as never);
            setSaving(false);
            if (error) { toast.error(`No se pudo guardar: ${error.message}`); return; }
            setSaved({ declarado: declared, diff: declared - Number(data ?? sistemaTot) });
          }}
        >
          {saving ? "Guardando…" : "Guardar"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSistemaTot(0)}>
          Omitir
        </Button>
      </div>
    </div>
  );
}
