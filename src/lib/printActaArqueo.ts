export interface ActaArqueoData {
  folio: number;
  cajaNombre: string;
  clinicName?: string;
  cajeroName?: string;
  fechaCierre: string;
  openingAmount: number;
  cashTotal: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  supervisorOverride: boolean;
  fondoSiguiente?: number;
  efectivoDeposito?: number;
  denominaciones?: Record<string, number>; // denomination string → quantity
}

const mxn = (n: number) =>
  Number(n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const dateStr = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  });

export function printActaArqueo(data: ActaArqueoData): void {
  const folio = `Z-${String(data.folio).padStart(6, "0")}`;
  const diffLabel = data.difference === 0 ? "CUADRADO" : data.difference > 0 ? "SOBRANTE" : "FALTANTE";
  const diffSign = data.difference > 0 ? "+" : "";

  const denomRows = (() => {
    const d = data.denominaciones;
    if (!d || Object.keys(d).length === 0) return "";
    const ORDER = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5];
    const rows = ORDER.filter((k) => d[String(k)] > 0).map((k) => {
      const qty = d[String(k)];
      const sub = k * qty;
      const label = k < 1 ? `$${k.toFixed(2)}` : `$${k.toLocaleString("es-MX")}`;
      return `<tr><td class="label">${label} × ${qty}</td><td class="num">${mxn(sub)}</td></tr>`;
    });
    return rows.length > 0
      ? `<section><h2>Desglose de denominaciones</h2><table>${rows.join("")}</table></section>`
      : "";
  })();

  const distribucionRows = data.fondoSiguiente !== undefined
    ? `
      <tr>
        <td>Fondo para siguiente turno</td>
        <td class="num">${mxn(data.fondoSiguiente)}</td>
      </tr>
      <tr>
        <td>Para depósito / caja fuerte</td>
        <td class="num">${mxn(data.efectivoDeposito ?? 0)}</td>
      </tr>`
    : `<tr><td colspan="2" style="color:#777;font-style:italic">No registrada</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Acta de Arqueo ${folio}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; padding: 20mm 18mm; }
  h1 { font-size: 16pt; text-align: center; margin-bottom: 2px; letter-spacing: 1px; }
  .clinic { text-align: center; font-size: 10pt; color: #555; margin-bottom: 12px; }
  .folio { text-align: center; font-size: 13pt; font-weight: bold; margin: 10px 0 4px; }
  .fecha { text-align: center; font-size: 9pt; color: #555; margin-bottom: 18px; }
  hr { border: none; border-top: 1.5px solid #222; margin: 10px 0; }
  .hr-thin { border-color: #bbb; margin: 6px 0; }
  section { margin-bottom: 16px; }
  section h2 { font-size: 9pt; text-transform: uppercase; letter-spacing: 1px;
               color: #444; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 4px; font-size: 10.5pt; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.label { color: #444; width: 65%; }
  .diff-row td { font-weight: bold; border-top: 1.5px solid #333; padding-top: 6px; }
  .diff-ok td { color: #1a7a1a; }
  .diff-high td { color: #b85c00; }
  .diff-low td { color: #c0392b; }
  .supervisor-note { font-size: 9pt; color: #555; margin-top: 4px; }
  .signatures { margin-top: 28px; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 12px; }
  .sig-box { border-top: 1.5px solid #333; padding-top: 6px; }
  .sig-box .role { font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
  .sig-box .name { font-size: 9.5pt; margin: 3px 0; }
  .sig-box .date-line { font-size: 9pt; color: #555; margin-top: 18px; }
  .footer { margin-top: 32px; text-align: center; font-size: 8pt; color: #999; border-top: 1px solid #ddd; padding-top: 6px; }
  @media print {
    body { padding: 10mm 14mm; }
    @page { size: letter; margin: 15mm; }
  }
</style>
</head>
<body>

<h1>ACTA DE ARQUEO DE CAJA</h1>
${data.clinicName ? `<p class="clinic">${data.clinicName}</p>` : ""}

<p class="folio">Folio ${folio}</p>
<p class="fecha">Cierre: ${dateStr(data.fechaCierre)}</p>

<hr>

<section>
  <h2>Datos del turno</h2>
  <table>
    <tr><td class="label">Caja</td><td class="num">${data.cajaNombre}</td></tr>
    <tr><td class="label">Cajero</td><td class="num">${data.cajeroName ?? "—"}</td></tr>
  </table>
</section>

<section>
  <h2>Conteo de efectivo</h2>
  <table>
    <tr>
      <td class="label">Fondo de apertura</td>
      <td class="num">${mxn(data.openingAmount)}</td>
    </tr>
    <tr>
      <td class="label">Cobros en efectivo</td>
      <td class="num">${mxn(data.cashTotal)}</td>
    </tr>
    <tr>
      <td class="label">Efectivo esperado</td>
      <td class="num">${mxn(data.expectedCash)}</td>
    </tr>
    <tr>
      <td class="label">Efectivo contado (ciego)</td>
      <td class="num">${mxn(data.countedCash)}</td>
    </tr>
    <tr class="diff-row ${data.difference === 0 ? "diff-ok" : data.difference > 0 ? "diff-high" : "diff-low"}">
      <td class="label">${diffLabel}</td>
      <td class="num">${diffSign}${mxn(data.difference)}</td>
    </tr>
  </table>
  ${data.supervisorOverride ? `<p class="supervisor-note">* Diferencia autorizada por supervisor</p>` : ""}
</section>

${denomRows}

<section>
  <h2>Distribución del efectivo</h2>
  <table>${distribucionRows}</table>
</section>

<div class="signatures">
  <hr>
  <div class="sig-grid">
    <div class="sig-box">
      <p class="role">Cajero</p>
      <p class="name">${data.cajeroName ?? "&nbsp;"}</p>
      <p class="date-line">Fecha y hora: ___________________________</p>
    </div>
    <div class="sig-box">
      <p class="role">Supervisor</p>
      <p class="name">&nbsp;</p>
      <p class="date-line">Fecha y hora: ___________________________</p>
    </div>
  </div>
</div>

<p class="footer">Documento interno — ${data.clinicName ?? "Clínica"} — Generado el ${new Date().toLocaleString("es-MX")}</p>

<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=800,height=700");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
