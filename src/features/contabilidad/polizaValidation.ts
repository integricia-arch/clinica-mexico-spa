export interface LineaDraft {
  cuentaId: string;
  lado: "cargo" | "abono";
  monto: string;
}

export interface PartidaPayload {
  cuenta_id: string;
  debe_centavos: number;
  haber_centavos: number;
}

export function calcularTotales(lineas: LineaDraft[]) {
  const totalCargo = lineas.reduce((s, l) => s + (l.lado === "cargo" ? Number(l.monto) || 0 : 0), 0);
  const totalAbono = lineas.reduce((s, l) => s + (l.lado === "abono" ? Number(l.monto) || 0 : 0), 0);
  return { totalCargo, totalAbono };
}

// Mirrors crear_poliza()'s hard rule: SUM(debe) = SUM(haber), y > 0 (una póliza vacía no cuadra).
export function polizaCuadra(totalCargo: number, totalAbono: number): boolean {
  return totalCargo > 0 && totalCargo === totalAbono;
}

export function lineasValidas(lineas: LineaDraft[]): boolean {
  return lineas.length > 0 && lineas.every((l) => l.cuentaId && Number(l.monto) > 0);
}

export function construirPartidas(lineas: LineaDraft[]): PartidaPayload[] {
  return lineas.map((l) => ({
    cuenta_id: l.cuentaId,
    debe_centavos: l.lado === "cargo" ? Math.round(Number(l.monto) * 100) : 0,
    haber_centavos: l.lado === "abono" ? Math.round(Number(l.monto) * 100) : 0,
  }));
}
