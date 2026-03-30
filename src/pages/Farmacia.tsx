import { Search, Filter, Plus, AlertTriangle, Package, Pill } from "lucide-react";

const inventario = [
  { id: 1, nombre: "Paracetamol 500mg", categoria: "Analgésico", existencia: 342, minimo: 100, precio: 45.00, lote: "LOT-2026-A12", caducidad: "15/09/2027" },
  { id: 2, nombre: "Amoxicilina 500mg", categoria: "Antibiótico", existencia: 28, minimo: 50, precio: 120.00, lote: "LOT-2025-B34", caducidad: "30/06/2026" },
  { id: 3, nombre: "Omeprazol 20mg", categoria: "Gastrointestinal", existencia: 215, minimo: 80, precio: 65.00, lote: "LOT-2026-C56", caducidad: "20/12/2027" },
  { id: 4, nombre: "Metformina 850mg", categoria: "Antidiabético", existencia: 180, minimo: 100, precio: 35.00, lote: "LOT-2026-D78", caducidad: "10/03/2028" },
  { id: 5, nombre: "Losartán 50mg", categoria: "Antihipertensivo", existencia: 12, minimo: 60, precio: 55.00, lote: "LOT-2025-E90", caducidad: "05/04/2026" },
  { id: 6, nombre: "Ibuprofeno 400mg", categoria: "Antiinflamatorio", existencia: 410, minimo: 100, precio: 38.00, lote: "LOT-2026-F11", caducidad: "25/01/2028" },
  { id: 7, nombre: "Cetirizina 10mg", categoria: "Antihistamínico", existencia: 95, minimo: 50, precio: 28.00, lote: "LOT-2026-G22", caducidad: "18/08/2027" },
  { id: 8, nombre: "Diclofenaco gel 1%", categoria: "Tópico", existencia: 67, minimo: 30, precio: 89.00, lote: "LOT-2026-H33", caducidad: "12/11/2027" },
];

const formatMXN = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function Farmacia() {
  const bajoStock = inventario.filter((i) => i.existencia < i.minimo);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display text-2xl font-bold text-foreground">Farmacia y almacén</h1>
          <p className="mt-1 text-sm text-muted-foreground">Control de inventario y dispensación de medicamentos</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90 transition-opacity">
          <Plus className="h-4 w-4" />
          Registrar entrada
        </button>
      </div>

      {/* Alerts */}
      {bajoStock.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {bajoStock.length} medicamento{bajoStock.length > 1 ? "s" : ""} por debajo del mínimo
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {bajoStock.map((i) => i.nombre).join(", ")} — Se recomienda reabastecer.
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <Package className="h-4 w-4" /> Total de productos
          </div>
          <p className="mt-1 text-display text-xl font-bold text-foreground">{inventario.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <Pill className="h-4 w-4" /> Recetas dispensadas hoy
          </div>
          <p className="mt-1 text-display text-xl font-bold text-foreground">14</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-destructive text-sm font-medium">
            <AlertTriangle className="h-4 w-4" /> Stock bajo
          </div>
          <p className="mt-1 text-display text-xl font-bold text-destructive">{bajoStock.length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar medicamento por nombre o lote..."
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
              <th className="px-5 py-3 font-semibold text-muted-foreground">Medicamento</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">Categoría</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground">Existencia</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground hidden sm:table-cell">Mínimo</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Precio unitario</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Lote</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">Caducidad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {inventario.map((item) => {
              const bajo = item.existencia < item.minimo;
              return (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-card-foreground">{item.nombre}</td>
                  <td className="px-5 py-3.5 hidden md:table-cell text-muted-foreground">{item.categoria}</td>
                  <td className="px-5 py-3.5">
                    <span className={`font-semibold ${bajo ? "text-destructive" : "text-card-foreground"}`}>
                      {item.existencia}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell text-muted-foreground">{item.minimo}</td>
                  <td className="px-5 py-3.5 hidden lg:table-cell text-muted-foreground">{formatMXN(item.precio)}</td>
                  <td className="px-5 py-3.5 hidden lg:table-cell text-muted-foreground">{item.lote}</td>
                  <td className="px-5 py-3.5 hidden md:table-cell text-muted-foreground">{item.caducidad}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
