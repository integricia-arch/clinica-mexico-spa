import { useState } from "react";
import { Search, Plus, Download, Filter, FileText, MoreHorizontal } from "lucide-react";

const facturas = [
  { folio: "FAC-2026-0342", fecha: "30/03/2026", paciente: "María González Hernández", concepto: "Consulta general + Estudios de laboratorio", subtotal: 2112.07, iva: 337.93, total: 2450.00, estado: "Pagada", metodo: "Tarjeta de débito", rfc: "GOHM920415XX1", facturaRequerida: true },
  { folio: "FAC-2026-0341", fecha: "29/03/2026", paciente: "Fernanda Castillo López", concepto: "Consulta de seguimiento", subtotal: 689.66, iva: 110.34, total: 800.00, estado: "Pagada", metodo: "Efectivo", rfc: "CALF850712XX5", facturaRequerida: false },
  { folio: "FAC-2026-0340", fecha: "28/03/2026", paciente: "José Luis Pérez Vargas", concepto: "Consulta especialidad + Receta", subtotal: 3017.24, iva: 482.76, total: 3500.00, estado: "Pendiente", metodo: "Transferencia", rfc: "PEVJ680102XX2", facturaRequerida: true },
  { folio: "FAC-2026-0339", fecha: "27/03/2026", paciente: "Guadalupe Torres Reyes", concepto: "Consulta general", subtotal: 862.07, iva: 137.93, total: 1000.00, estado: "Pagada", metodo: "Efectivo", rfc: "TORG810320XX3", facturaRequerida: false },
  { folio: "FAC-2026-0338", fecha: "25/03/2026", paciente: "Roberto Sánchez Díaz", concepto: "Estudios de gabinete", subtotal: 4310.34, iva: 689.66, total: 5000.00, estado: "Anticipo", metodo: "Tarjeta de crédito", rfc: "SADR990510XX4", facturaRequerida: true },
  { folio: "FAC-2026-0337", fecha: "24/03/2026", paciente: "Miguel Á. Ruiz Flores", concepto: "Consulta seguimiento + Medicamentos", subtotal: 1551.72, iva: 248.28, total: 1800.00, estado: "Cancelada", metodo: "—", rfc: "RUFM630215XX6", facturaRequerida: false },
];

const estadoColor: Record<string, string> = {
  "Pagada": "bg-success/10 text-success",
  "Pendiente": "bg-warning/10 text-warning",
  "Anticipo": "bg-info/10 text-info",
  "Cancelada": "bg-destructive/10 text-destructive",
};

const formatMXN = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function Facturacion() {
  const [busqueda, setBusqueda] = useState("");
  const filtradas = facturas.filter((f) =>
    f.paciente.toLowerCase().includes(busqueda.toLowerCase()) ||
    f.folio.toLowerCase().includes(busqueda.toLowerCase())
  );

  const totalIngresos = facturas
    .filter((f) => f.estado === "Pagada")
    .reduce((sum, f) => sum + f.total, 0);

  const totalPendiente = facturas
    .filter((f) => f.estado === "Pendiente" || f.estado === "Anticipo")
    .reduce((sum, f) => sum + f.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display text-2xl font-bold text-foreground">Facturación</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cobros, facturas y control de ingresos</p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <Download className="h-4 w-4" />
            Exportar
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90 transition-opacity">
            <Plus className="h-4 w-4" />
            Nuevo cobro
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm font-medium text-muted-foreground">Ingresos cobrados (marzo)</p>
          <p className="mt-1 text-display text-xl font-bold text-foreground">{formatMXN(totalIngresos)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm font-medium text-muted-foreground">Saldo pendiente</p>
          <p className="mt-1 text-display text-xl font-bold text-warning">{formatMXN(totalPendiente)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm font-medium text-muted-foreground">Facturas emitidas (marzo)</p>
          <p className="mt-1 text-display text-xl font-bold text-foreground">87</p>
          <p className="text-xs text-muted-foreground mt-0.5">12 pendientes de timbrado CFDI</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por folio o paciente..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-input bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
          <Filter className="h-4 w-4" />
          Filtros
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-5 py-3 font-semibold text-muted-foreground">Folio</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground">Fecha</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">Paciente</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Concepto</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground text-right">Total</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground hidden sm:table-cell">Método</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground">Estado</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground hidden lg:table-cell">CFDI</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtradas.map((f) => (
              <tr key={f.folio} className="hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3.5 font-medium text-card-foreground">{f.folio}</td>
                <td className="px-5 py-3.5 text-muted-foreground">{f.fecha}</td>
                <td className="px-5 py-3.5 hidden md:table-cell text-card-foreground">{f.paciente}</td>
                <td className="px-5 py-3.5 hidden lg:table-cell text-muted-foreground max-w-[200px] truncate">{f.concepto}</td>
                <td className="px-5 py-3.5 text-right font-semibold text-card-foreground">{formatMXN(f.total)}</td>
                <td className="px-5 py-3.5 hidden sm:table-cell text-muted-foreground">{f.metodo}</td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${estadoColor[f.estado] || "bg-muted text-muted-foreground"}`}>
                    {f.estado}
                  </span>
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell">
                  {f.facturaRequerida ? (
                    <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                      <FileText className="h-3 w-3" /> Requerida
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No solicitada</span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <button className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          Mostrando {filtradas.length} de {facturas.length} registros
        </div>
      </div>
    </div>
  );
}
