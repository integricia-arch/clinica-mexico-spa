import { useState } from "react";
import { Search, Plus, Phone, Mail, MoreHorizontal, Filter } from "lucide-react";

const pacientes = [
  { id: 1, nombre: "María González Hernández", telefono: "+52 55 1234 5678", correo: "maria.gonzalez@correo.mx", edad: 34, ultimaCita: "28/03/2026", estado: "Activo", rfc: "GOHM920415XX1" },
  { id: 2, nombre: "José Luis Pérez Vargas", telefono: "+52 33 9876 5432", correo: "jl.perez@correo.mx", edad: 58, ultimaCita: "25/03/2026", estado: "Activo", rfc: "PEVJ680102XX2" },
  { id: 3, nombre: "Guadalupe Torres Reyes", telefono: "+52 81 5555 1234", correo: "guadalupe.t@correo.mx", edad: 45, ultimaCita: "20/03/2026", estado: "Activo", rfc: "TORG810320XX3" },
  { id: 4, nombre: "Roberto Sánchez Díaz", telefono: "+52 55 4321 8765", correo: "r.sanchez@correo.mx", edad: 27, ultimaCita: "15/03/2026", estado: "Inactivo", rfc: "SADR990510XX4" },
  { id: 5, nombre: "Fernanda Castillo López", telefono: "+52 222 6789 0123", correo: "fer.castillo@correo.mx", edad: 41, ultimaCita: "29/03/2026", estado: "Activo", rfc: "CALF850712XX5" },
  { id: 6, nombre: "Miguel Ángel Ruiz Flores", telefono: "+52 55 0987 6543", correo: "miguel.ruiz@correo.mx", edad: 63, ultimaCita: "22/03/2026", estado: "Activo", rfc: "RUFM630215XX6" },
  { id: 7, nombre: "Ana Sofía Morales Vega", telefono: "+52 664 3456 7890", correo: "ana.morales@correo.mx", edad: 29, ultimaCita: "18/03/2026", estado: "Activo", rfc: "MOVA970830XX7" },
  { id: 8, nombre: "Carlos Eduardo Jiménez Ríos", telefono: "+52 55 2345 6789", correo: "c.jimenez@correo.mx", edad: 52, ultimaCita: "10/03/2026", estado: "Inactivo", rfc: "JIRC740425XX8" },
];

export default function Pacientes() {
  const [busqueda, setBusqueda] = useState("");
  const filtrados = pacientes.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.telefono.includes(busqueda) ||
    p.rfc.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display text-2xl font-bold text-foreground">Pacientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Directorio y expedientes de pacientes registrados</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90 transition-opacity">
          <Plus className="h-4 w-4" />
          Nuevo paciente
        </button>
      </div>

      {/* Search & filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o RFC..."
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
              <th className="px-5 py-3 font-semibold text-muted-foreground">Nombre completo</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">Teléfono</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Correo</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground hidden sm:table-cell">Edad</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Última cita</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground">Estado</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtrados.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-card-foreground">{p.nombre}</p>
                  <p className="text-xs text-muted-foreground md:hidden">{p.telefono}</p>
                </td>
                <td className="px-5 py-3.5 hidden md:table-cell text-muted-foreground">{p.telefono}</td>
                <td className="px-5 py-3.5 hidden lg:table-cell text-muted-foreground">{p.correo}</td>
                <td className="px-5 py-3.5 hidden sm:table-cell text-muted-foreground">{p.edad} años</td>
                <td className="px-5 py-3.5 hidden lg:table-cell text-muted-foreground">{p.ultimaCita}</td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    p.estado === "Activo" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                  }`}>
                    {p.estado}
                  </span>
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
          Mostrando {filtrados.length} de {pacientes.length} pacientes
        </div>
      </div>
    </div>
  );
}
