// ponytail: mismo patrón manual que exportContabilidadCsv.ts — sin librería,
// filas de reportes contables son numéricas/fecha/texto simple, sin comas embebidas.
export function exportReporteCsv(nombre: string, headers: string[], rows: (string | number)[][]) {
  const lines = [headers.join(","), ...rows.map((r) => r.join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombre}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
