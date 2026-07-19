export interface LineaEstadoCuenta {
  fecha: string;
  concepto: string;
  monto_centavos: number;
  referencia_banco: string;
}

// ponytail: parser CSV manual (split por línea/coma) — sin librería, formato
// esperado es fijo (fecha,concepto,monto[,referencia]) sin comillas ni comas
// embebidas, típico de exports de banco mexicano.
export function parseEstadoCuentaCsv(texto: string): { lineas: LineaEstadoCuenta[]; errores: string[] } {
  const lineas: LineaEstadoCuenta[] = [];
  const errores: string[] = [];
  const filas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const inicio = /fecha/i.test(filas[0] ?? "") ? 1 : 0;

  for (let i = inicio; i < filas.length; i++) {
    const cols = filas[i].split(",").map((c) => c.trim());
    const [fecha, concepto, montoStr, referencia] = cols;
    const monto = parseFloat((montoStr ?? "").replace(/[^0-9.\-]/g, ""));
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || isNaN(monto) || monto === 0) {
      errores.push(`Línea ${i + 1}: "${filas[i]}" inválida (fecha YYYY-MM-DD y monto ≠ 0 requeridos)`);
      continue;
    }
    lineas.push({
      fecha,
      concepto: concepto ?? "",
      monto_centavos: Math.round(monto * 100),
      referencia_banco: referencia ?? "",
    });
  }

  return { lineas, errores };
}
