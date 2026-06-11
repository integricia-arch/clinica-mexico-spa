import { forwardRef } from "react";

export interface CorteZData {
  folio: number;
  cajero_email: string;
  supervisor_email: string | null;
  abierto_at: string;
  cerrado_at: string;
  caja_nombre: string;
  opening_amount: number;
  cash_efectivo: number;
  cash_tarjeta: number;
  cash_transferencia: number;
  cash_mixto: number;
  fondos_egresos: number;
  fondos_ingresos: number;
  expected_cash: number;
  counted_cash: number;
  difference: number;
  ticket_count: number;
  refund_count: number;
  refund_total: number;
  supervisor_override: boolean;
}

const fmt = (n: number) =>
  Number(n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

interface Props {
  data: CorteZData;
}

const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontWeight: bold ? 700 : 400 }}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

const Divider = () => <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />;

const CorteZPrint = forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
  const diffLabel = data.difference === 0 ? "CUADRADO" : data.difference > 0 ? "SOBRANTE" : "FALTANTE";

  return (
    <div
      ref={ref}
      style={{
        fontFamily: "monospace",
        fontSize: "12px",
        width: "280px",
        padding: "12px",
        background: "#fff",
        color: "#000",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "8px" }}>
        <div style={{ fontSize: "16px", fontWeight: 700 }}>ClínicaMX</div>
        <div style={{ fontSize: "13px", fontWeight: 700 }}>CORTE Z</div>
        <div style={{ fontSize: "14px", fontWeight: 700 }}>
          Z-{String(data.folio).padStart(6, "0")}
        </div>
      </div>

      <Divider />

      <Row label="Caja:" value={data.caja_nombre} />
      <Row label="Cajero:" value={data.cajero_email} />
      <Row label="Apertura:" value={fmtDate(data.abierto_at)} />
      <Row label="Cierre:" value={fmtDate(data.cerrado_at)} />

      <Divider />

      <div style={{ fontWeight: 700, marginBottom: "4px" }}>RESUMEN DEL TURNO</div>
      <Row label="Fondo inicial:" value={fmt(data.opening_amount)} />
      <Row label="Tickets:" value={String(data.ticket_count)} />
      {data.refund_count > 0 && (
        <Row label={`Cancelaciones (${data.refund_count}):`} value={`-${fmt(data.refund_total)}`} />
      )}

      <Divider />

      <div style={{ fontWeight: 700, marginBottom: "4px" }}>COBROS POR MÉTODO</div>
      <Row label="Efectivo:" value={fmt(data.cash_efectivo)} />
      {data.cash_tarjeta > 0 && <Row label="Tarjeta:" value={fmt(data.cash_tarjeta)} />}
      {data.cash_transferencia > 0 && <Row label="Transferencia:" value={fmt(data.cash_transferencia)} />}
      {data.cash_mixto > 0 && <Row label="Mixto:" value={fmt(data.cash_mixto)} />}

      {(data.fondos_egresos > 0 || data.fondos_ingresos > 0) && (
        <>
          <Divider />
          <div style={{ fontWeight: 700, marginBottom: "4px" }}>MOVIMIENTOS DE FONDO</div>
          {data.fondos_ingresos > 0 && <Row label="Ingresos fondo:" value={fmt(data.fondos_ingresos)} />}
          {data.fondos_egresos > 0 && <Row label="Egresos fondo:" value={`-${fmt(data.fondos_egresos)}`} />}
        </>
      )}

      <Divider />

      <div style={{ fontWeight: 700, marginBottom: "4px" }}>RECONCILIACIÓN</div>
      <Row label="Esperado en caja:" value={fmt(data.expected_cash)} bold />
      <Row label="Contado (ciego):" value={fmt(data.counted_cash)} bold />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "4px 0",
          fontWeight: 700,
          color: data.difference === 0 ? "#166534" : data.difference > 0 ? "#92400e" : "#991b1b",
        }}
      >
        <span>{diffLabel}:</span>
        <span>{fmt(data.difference)}</span>
      </div>

      {data.supervisor_override && (
        <div style={{ fontSize: "11px", color: "#555", marginTop: "2px" }}>
          Autorizado por: {data.supervisor_email ?? "Supervisor"}
        </div>
      )}

      <Divider />

      <div style={{ marginTop: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ borderTop: "1px solid #000", paddingTop: "4px", fontSize: "11px", textAlign: "center" }}>
              Firma Cajero
            </div>
            <div style={{ fontSize: "10px", textAlign: "center", color: "#555" }}>{data.cajero_email}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ borderTop: "1px solid #000", paddingTop: "4px", fontSize: "11px", textAlign: "center" }}>
              Firma Supervisor
            </div>
            <div style={{ fontSize: "10px", textAlign: "center", color: "#555" }}>
              {data.supervisor_email ?? "_______________"}
            </div>
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: "10px", color: "#777", marginTop: "12px" }}>
        Documento generado automáticamente — conservar 5 años
      </div>
    </div>
  );
});

CorteZPrint.displayName = "CorteZPrint";
export default CorteZPrint;
