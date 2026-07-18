export function exceedsLimiteEfectivo(
  efectivoEsperado: number,
  limiteEfectivo: string | null | undefined,
): boolean {
  if (!limiteEfectivo || limiteEfectivo.trim() === "") return false;
  const limite = Number(limiteEfectivo);
  if (!Number.isFinite(limite) || limite <= 0) return false;
  return efectivoEsperado > limite;
}
