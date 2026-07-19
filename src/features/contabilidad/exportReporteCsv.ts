function csvField(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ponytail: sin librería CSV — concepto/descripcion son texto libre (pueden traer
// comas), se escapan con csvField; el resto son números/fechas sin riesgo.
export function exportReporteCsv(nombre: string, headers: string[], rows: (string | number)[][]) {
  const lines = [headers.map(csvField).join(","), ...rows.map((r) => r.map(csvField).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombre}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
