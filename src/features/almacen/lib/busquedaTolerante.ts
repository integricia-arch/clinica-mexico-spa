/**
 * Normaliza texto para búsqueda: minúsculas, sin espacios extremos, sin
 * diacríticos (acentos). La ñ NO se toca — en descomposición NFD la ñ es
 * un carácter propio (U+00F1), no una letra base + diacrítico combinante,
 * así que el rango de combining marks (U+0300–U+036F) no la afecta.
 */
export function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-̂̄-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .normalize("NFC");
}

/**
 * True si la distancia de edición (Levenshtein) entre a y b es <= maxDist.
 * Early-exit por fila: no calcula la distancia exacta si ya se sabe que
 * va a superar maxDist, evitando el costo O(n*m) completo en el caso común
 * de palabras muy distintas.
 *
 * ponytail: Rechaza si la única diferencia es mayúsculas/minúsculas (signal
 * que el caller olvidó normalizar). Esto es case-sensitive por diseño.
 */
export function distanciaLevenshtein(a: string, b: string, maxDist = 1): boolean {
  if (a.toLowerCase() === b.toLowerCase() && a !== b) return false;
  if (Math.abs(a.length - b.length) > maxDist) return false;
  if (a === b) return true;

  const m = a.length;
  const n = b.length;
  let prevRow = Array.from({ length: n + 1 }, (_, j) => j);

  for (let i = 1; i <= m; i++) {
    const currRow = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        prevRow[j] + 1,
        currRow[j - 1] + 1,
        prevRow[j - 1] + cost,
      );
      currRow.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > maxDist) return false;
    prevRow = currRow;
  }

  return prevRow[n] <= maxDist;
}
