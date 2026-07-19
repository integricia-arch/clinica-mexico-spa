import type { PnlMes, FlujoMes } from "@/hooks/useContabilidad";

function centavosToPesos(c: number): string {
  return (c / 100).toFixed(2);
}

// ponytail: CSV manual con comillas — sin librería, los campos son todos numéricos/fecha, sin comas embebidas.
export function exportContabilidadCsv(pnl: PnlMes[], flujo: FlujoMes[]) {
  const lines: string[] = [];

  lines.push("Estado de resultados (P&L) por mes");
  lines.push("Mes,Ingresos,Costo de ventas,Utilidad bruta,Gastos operativos,Utilidad neta,Margen bruto %,Margen neto %");
  pnl.forEach((m) => {
    lines.push([
      m.mes,
      centavosToPesos(m.ingresos_centavos),
      centavosToPesos(m.costo_ventas_centavos),
      centavosToPesos(m.utilidad_bruta_centavos),
      centavosToPesos(m.gastos_operativos_centavos),
      centavosToPesos(m.utilidad_neta_centavos),
      m.margen_bruto_pct ?? "",
      m.margen_neto_pct ?? "",
    ].join(","));
  });

  lines.push("");
  lines.push("Flujo de efectivo por mes");
  lines.push("Mes,Cobros,Pagos,Flujo neto");
  flujo.forEach((m) => {
    lines.push([
      m.mes,
      centavosToPesos(m.cobros_centavos),
      centavosToPesos(m.pagos_centavos),
      centavosToPesos(m.flujo_neto_centavos),
    ].join(","));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `contabilidad_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
