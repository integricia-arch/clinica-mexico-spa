import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, CreditCard, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  corteId: string;
}

const fmt = (n: number) =>
  Number(n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function TarjetaTpvReconcile({ corteId }: Props) {
  const [sistemaTot, setSistemaTot] = useState<number | null>(null);
  const [tpvInput, setTpvInput] = useState("");
  const [saved, setSaved] = useState<{ tpv: number; diff: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!corteId) return;
    supabase
      .rpc("get_corte_tarjeta_total", { p_corte_id: corteId } as never)
      .then(({ data, error }) => {
        setLoading(false);
        if (error || data === null) return;
        const tot = Number(data);
        setSistemaTot(tot);
        setTpvInput(String(tot));
      });
  }, [corteId]);

  if (loading) return null;
  if (sistemaTot === 0 || sistemaTot === null) return null;

  if (saved) {
    const diffColor =
      saved.diff === 0 ? "text-green-700 dark:text-green-400" :
      Math.abs(saved.diff) <= 1 ? "text-amber-600" : "text-red-600";
    return (
      <div className="rounded-lg border border-green-500/40 bg-green-500/5 p-3 space-y-1 text-sm">
        <p className="font-medium text-green-700 dark:text-green-400 flex items-center gap-1.5">
          <CheckCircle className="h-3.5 w-3.5" /> Tarjeta reconciliada
        </p>
        <div className="flex justify-between text-muted-foreground">
          <span>Sistema</span>
          <span className="font-medium text-foreground">{fmt(sistemaTot)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>TPV físico</span>
          <span className="font-medium text-foreground">{fmt(saved.tpv)}</span>
        </div>
        <div className={`flex justify-between font-semibold ${diffColor}`}>
          <span>Diferencia</span>
          <span>{saved.diff >= 0 ? "+" : ""}{fmt(saved.diff)}</span>
        </div>
      </div>
    );
  }

  const tpvNum = Number(tpvInput);
  const liveDiff = !isNaN(tpvNum) ? tpvNum - sistemaTot : null;
  const diffColor =
    liveDiff === null ? "" :
    liveDiff === 0 ? "text-green-600" :
    Math.abs(liveDiff) <= 1 ? "text-amber-600" : "text-red-600";

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
      <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
        <CreditCard className="h-3.5 w-3.5" /> Conciliación tarjeta (TPV)
      </p>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Sistema registró</span>
        <span className="font-medium text-foreground">{fmt(sistemaTot)}</span>
      </div>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={tpvInput}
        onChange={(e) => setTpvInput(e.target.value)}
        placeholder="Total reportado por terminal"
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
          disabled={saving || isNaN(tpvNum) || tpvNum < 0}
          onClick={async () => {
            if (isNaN(tpvNum) || tpvNum < 0) { toast.error("Monto inválido"); return; }
            setSaving(true);
            const { data, error } = await supabase.rpc("corte_set_tarjeta_tpv", {
              p_corte_id: corteId,
              p_tpv_declarado: tpvNum,
            } as never);
            setSaving(false);
            if (error) { toast.error(`No se pudo guardar: ${error.message}`); return; }
            setSaved({ tpv: tpvNum, diff: tpvNum - Number(data ?? sistemaTot) });
          }}
        >
          {saving ? "Guardando…" : "Guardar"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSistemaTot(0)}
        >
          Omitir
        </Button>
      </div>
    </div>
  );
}
