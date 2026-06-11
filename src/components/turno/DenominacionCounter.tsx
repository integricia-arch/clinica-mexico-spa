import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

export type DenomBreakdown = Record<string, number>; // denomination string → quantity

interface Props {
  onTotal: (total: number, breakdown: DenomBreakdown) => void;
}

const BILLETES = [1000, 500, 200, 100, 50, 20];
const MONEDAS  = [10, 5, 2, 1, 0.5];
const ALL      = [...BILLETES, ...MONEDAS];

const fmtDenom = (d: number) =>
  d < 1
    ? `$${d.toFixed(2).replace(".", ".")}`
    : `$${d.toLocaleString("es-MX")}`;

const fmtMXN = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function DenominacionCounter({ onTotal }: Props) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(ALL.map((d) => [String(d), ""])),
  );

  const total = ALL.reduce((sum, d) => {
    const q = Number(qty[String(d)]) || 0;
    return sum + d * q;
  }, 0);

  const breakdown: DenomBreakdown = Object.fromEntries(
    ALL.filter((d) => (Number(qty[String(d)]) || 0) > 0).map((d) => [
      String(d),
      Number(qty[String(d)]),
    ]),
  );

  const handleChange = useCallback(
    (denom: number, value: string) => {
      const next = { ...qty, [String(denom)]: value };
      setQty(next);
      const newTotal = ALL.reduce((sum, d) => {
        const q = Number(next[String(d)]) || 0;
        return sum + d * q;
      }, 0);
      const newBreakdown: DenomBreakdown = Object.fromEntries(
        ALL.filter((d) => (Number(next[String(d)]) || 0) > 0).map((d) => [
          String(d),
          Number(next[String(d)]),
        ]),
      );
      onTotal(newTotal, newBreakdown);
    },
    [qty, onTotal],
  );

  const reset = () => {
    const empty = Object.fromEntries(ALL.map((d) => [String(d), ""]));
    setQty(empty);
    onTotal(0, {});
  };

  return (
    <div className="rounded-lg border border-border bg-muted/10">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Contar por denominaciones</span>
        <span className="flex items-center gap-2">
          {total > 0 && <span className="font-semibold text-foreground">{fmtMXN(total)}</span>}
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Billetes</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {BILLETES.map((d) => (
                <DenomRow
                  key={d}
                  denom={d}
                  value={qty[String(d)]}
                  onChange={(v) => handleChange(d, v)}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Monedas</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {MONEDAS.map((d) => (
                <DenomRow
                  key={d}
                  denom={d}
                  value={qty[String(d)]}
                  onChange={(v) => handleChange(d, v)}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="text-xs text-muted-foreground">Total denominaciones</span>
            <span className="font-semibold text-sm text-foreground">{fmtMXN(total)}</span>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="flex-1"
              disabled={total === 0}
              onClick={() => onTotal(total, breakdown)}
            >
              Usar {fmtMXN(total)}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={reset}>
              Limpiar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DenomRow({
  denom,
  value,
  onChange,
}: {
  denom: number;
  value: string;
  onChange: (v: string) => void;
}) {
  const qty = Number(value) || 0;
  const subtotal = denom * qty;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-mono w-14 text-right text-muted-foreground shrink-0">
        {fmtDenom(denom)}
      </span>
      <span className="text-xs text-muted-foreground">×</span>
      <Input
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 text-xs text-center w-14 px-1"
        placeholder="0"
      />
      <span className="text-xs text-muted-foreground w-16 text-right">
        {qty > 0 ? `= ${subtotal.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}` : ""}
      </span>
    </div>
  );
}
