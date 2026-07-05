import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type RecetaRow = {
  id: string;
  folio_secuencial: number | null;
  clinic_id: string;
  sale_id: string | null;
  nombre_medico: string | null;
  cedula_profesional: string | null;
  especialidad: string | null;
  fecha_receta: string | null;
  folio_receta: string | null;
  nombre_paciente: string | null;
  diagnostico: string | null;
  receta_retenida: boolean | null;
  grupo: string | null;
  folio_cofepris: string | null;
  notas: string | null;
  created_at: string;
};

type Props = {
  clinicId: string;
  clinicName?: string;
};

export function LibroControl({ clinicId, clinicName }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<RecetaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [desde, setDesde] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));
  const [grupo, setGrupo] = useState<string>("todos");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      let q = (supabase as any)
        .from("recetas_capturadas")
        .select("*")
        .eq("clinic_id", clinicId)
        .gte("created_at", `${desde}T00:00:00`)
        .lte("created_at", `${hasta}T23:59:59`)
        .order("folio_secuencial", { ascending: true });

      if (grupo !== "todos") q = q.eq("grupo", grupo);

      const { data, error } = await q;
      if (error) throw error;
      const mapped: RecetaRow[] = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id ?? ""),
        folio_secuencial: (r.folio_secuencial as number | null) ?? null,
        clinic_id: String(r.clinic_id ?? ""),
        sale_id: (r.sale_id as string | null) ?? null,
        nombre_medico: (r.nombre_medico as string | null) ?? null,
        cedula_profesional: (r.cedula_profesional as string | null) ?? null,
        especialidad: (r.especialidad as string | null) ?? null,
        fecha_receta: (r.fecha_receta as string | null) ?? null,
        folio_receta: (r.folio_receta as string | null) ?? null,
        nombre_paciente: (r.nombre_paciente as string | null) ?? null,
        diagnostico: (r.diagnostico as string | null) ?? null,
        receta_retenida: (r.receta_retenida as boolean | null) ?? null,
        grupo: (r.grupo as string | null) ?? null,
        folio_cofepris: (r.folio_cofepris as string | null) ?? null,
        notas: (r.notas as string | null) ?? null,
        created_at: String(r.created_at ?? ""),
      }));
      setRows(mapped);
    } catch (e: unknown) {
      toast({ title: "Error al cargar libro", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [clinicId, desde, hasta, grupo, toast]);

  function exportCSV() {
    if (rows.length === 0) return;

    const headers = [
      "Folio", "Fecha Registro", "Grupo", "Folio COFEPRIS",
      "Fecha Receta", "Nombre Médico", "Cédula", "Especialidad",
      "Paciente", "Diagnóstico", "Receta Retenida",
      "Folio Receta", "Notas", "ID Venta",
    ];

    const csvRows = rows.map((r) => [
      r.folio_secuencial ?? "",
      r.created_at ? format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: es }) : "",
      r.grupo ?? "",
      r.folio_cofepris ?? "",
      r.fecha_receta ?? "",
      r.nombre_medico ?? "",
      r.cedula_profesional ?? "",
      r.especialidad ?? "",
      r.nombre_paciente ?? "",
      r.diagnostico ?? "",
      r.receta_retenida ? "Sí" : "No",
      r.folio_receta ?? "",
      r.notas ?? "",
      r.sale_id ? r.sale_id.slice(0, 8).toUpperCase() : "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));

    const csv = [headers.join(","), ...csvRows].join("\r\n");
    const bom = "﻿";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `libro-control-cofepris-${desde}-${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function grupoColor(g: string | null) {
    if (g === "IV") return "destructive";
    if (g === "III") return "default";
    if (g === "II") return "secondary";
    return "outline";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <Label>Desde</Label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-36" />
        </div>
        <div>
          <Label>Hasta</Label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-36" />
        </div>
        <div>
          <Label>Grupo</Label>
          <Select value={grupo} onValueChange={setGrupo}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="II">Grupo II</SelectItem>
              <SelectItem value="III">Grupo III</SelectItem>
              <SelectItem value="IV">Grupo IV</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={cargar} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Cargando…" : "Consultar"}
        </Button>
        <Button variant="outline" onClick={exportCSV} disabled={rows.length === 0}>
          <Download className="h-4 w-4 mr-1" />
          Exportar CSV
        </Button>
      </div>

      {rows.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {rows.length} registro{rows.length !== 1 ? "s" : ""} · {clinicName ?? clinicId} · {desde} – {hasta}
        </p>
      )}

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted">
              <tr>
                {["Folio","Fecha","Grupo","COFEPRIS","Médico","Cédula","Paciente","Ret.","Venta"].map((h) => (
                  <th key={h} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="px-2 py-1 font-mono">{r.folio_secuencial ?? "—"}</td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    {r.created_at ? format(new Date(r.created_at), "dd/MM/yy HH:mm", { locale: es }) : "—"}
                  </td>
                  <td className="px-2 py-1">
                    {r.grupo && (
                      <Badge variant={grupoColor(r.grupo)} className="text-[10px] py-0">
                        {r.grupo}
                      </Badge>
                    )}
                  </td>
                  <td className="px-2 py-1 font-mono">{r.folio_cofepris ?? "—"}</td>
                  <td className="px-2 py-1 truncate max-w-[120px]">{r.nombre_medico ?? "—"}</td>
                  <td className="px-2 py-1 font-mono">{r.cedula_profesional ?? "—"}</td>
                  <td className="px-2 py-1 truncate max-w-[120px]">{r.nombre_paciente ?? "—"}</td>
                  <td className="px-2 py-1 text-center">{r.receta_retenida ? "✓" : ""}</td>
                  <td className="px-2 py-1 font-mono">
                    {r.sale_id ? r.sale_id.slice(0, 8).toUpperCase() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !loading && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Selecciona un rango de fechas y presiona Consultar.
          </p>
        )
      )}
    </div>
  );
}
