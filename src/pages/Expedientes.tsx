import { FileText, Search, Filter, Eye, Download, MoreHorizontal } from "lucide-react";

const expedientes = [
  { id: 1, paciente: "María González Hernández", ultimaActualizacion: "30/03/2026", documentos: 12, tipo: "Historial completo", medico: "Dr. Mendoza" },
  { id: 2, paciente: "José Luis Pérez Vargas", ultimaActualizacion: "25/03/2026", documentos: 8, tipo: "Seguimiento crónico", medico: "Dra. Ramírez" },
  { id: 3, paciente: "Guadalupe Torres Reyes", ultimaActualizacion: "20/03/2026", documentos: 5, tipo: "Primera vez", medico: "Dr. Mendoza" },
  { id: 4, paciente: "Roberto Sánchez Díaz", ultimaActualizacion: "15/03/2026", documentos: 15, tipo: "Historial completo", medico: "Dra. Ortiz" },
  { id: 5, paciente: "Fernanda Castillo López", ultimaActualizacion: "29/03/2026", documentos: 3, tipo: "Consulta nueva", medico: "Dra. Ramírez" },
  { id: 6, paciente: "Miguel Á. Ruiz Flores", ultimaActualizacion: "22/03/2026", documentos: 20, tipo: "Seguimiento crónico", medico: "Dr. Mendoza" },
];

const secciones = [
  "Datos generales del paciente",
  "Historial clínico",
  "Notas de consulta",
  "Recetas emitidas",
  "Resultados de estudios",
  "Consentimientos informados",
  "Indicaciones médicas",
  "Documentos adjuntos",
];

export default function Expedientes() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display text-2xl font-bold text-foreground">Expedientes clínicos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Documentación clínica estructurada — orientada a normativa mexicana de expediente electrónico
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-primary/20 bg-accent p-4 flex items-start gap-3">
        <FileText className="h-5 w-5 text-accent-foreground shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-accent-foreground">Estructura de expediente preparada para auditoría</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Los expedientes siguen una estructura orientada a los lineamientos de documentación clínica electrónica en México.
            Este módulo no constituye certificación regulatoria.
          </p>
        </div>
      </div>

      {/* Sections overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {secciones.map((s) => (
          <div key={s} className="rounded-lg border border-border bg-card px-4 py-3 text-xs font-medium text-card-foreground shadow-card hover:bg-muted/50 transition-colors cursor-pointer">
            {s}
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar expediente por nombre del paciente..."
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
              <th className="px-5 py-3 font-semibold text-muted-foreground">Paciente</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground hidden sm:table-cell">Médico responsable</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">Tipo</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Documentos</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Última actualización</th>
              <th className="px-5 py-3 font-semibold text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {expedientes.map((e) => (
              <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3.5 font-medium text-card-foreground">{e.paciente}</td>
                <td className="px-5 py-3.5 hidden sm:table-cell text-muted-foreground">{e.medico}</td>
                <td className="px-5 py-3.5 hidden md:table-cell text-muted-foreground">{e.tipo}</td>
                <td className="px-5 py-3.5 hidden lg:table-cell text-muted-foreground">{e.documentos} archivos</td>
                <td className="px-5 py-3.5 hidden lg:table-cell text-muted-foreground">{e.ultimaActualizacion}</td>
                <td className="px-5 py-3.5">
                  <div className="flex gap-1">
                    <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Ver expediente">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Descargar">
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
