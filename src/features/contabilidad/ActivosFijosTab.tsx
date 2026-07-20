import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { untypedTable } from "@/lib/untypedTable";
import { friendlyError } from "@/lib/errors";
import { useActiveClinic } from "@/hooks/useActiveClinic";

const CATEGORIAS = [
  { value: "mobiliario_equipo", label: "Mobiliario y equipo" },
  { value: "equipo_medico", label: "Equipo médico" },
  { value: "equipo_computo", label: "Equipo de cómputo" },
  { value: "otro", label: "Otro" },
];

interface ActivoFijo {
  id: string;
  nombre: string;
  categoria: string;
  costo_centavos: number;
  fecha_adquisicion: string;
  notas: string | null;
}

function fmtMXN(centavos: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(centavos / 100);
}

export function ActivosFijosTab() {
  const { activeClinicId } = useActiveClinic();
  const [rows, setRows] = useState<ActivoFijo[]>([]);
  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("mobiliario_equipo");
  const [costo, setCosto] = useState("");
  const [cuentaAbono, setCuentaAbono] = useState<"102" | "201">("102");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeClinicId) return;
    setLoading(true);
    const { data, error } = await untypedTable("activos_fijos")
      .select("id,nombre,categoria,costo_centavos,fecha_adquisicion,notas")
      .eq("clinic_id", activeClinicId)
      .order("fecha_adquisicion", { ascending: false });
    if (!error) setRows((data ?? []) as ActivoFijo[]);
    setLoading(false);
  }, [activeClinicId]);

  useEffect(() => { load(); }, [load]);

  const handleRegistrar = async () => {
    const costoCentavos = Math.round(Number(costo) * 100);
    if (!activeClinicId || !nombre.trim() || !costoCentavos || costoCentavos <= 0) {
      toast.error("Nombre y costo son requeridos.");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).rpc("registrar_activo_fijo", {
      p_payload: {
        clinic_id: activeClinicId, nombre: nombre.trim(), categoria,
        costo_centavos: costoCentavos, cuenta_abono_codigo: cuentaAbono, notas: notas.trim() || null,
      },
    });
    setSaving(false);
    if (error) { toast.error(friendlyError(error, "No se pudo registrar el activo.")); return; }
    toast.success("Activo fijo registrado — póliza generada.");
    setNombre(""); setCosto(""); setNotas("");
    load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Registrar activo fijo (mobiliario, equipo médico, equipo de cómputo)</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2">
              <Label htmlFor="field-activo-nombre" className="text-xs">Nombre / descripción</Label>
              <Input id="field-activo-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Sillón dental unidad 2" />
            </div>
            <div>
              <Label className="text-xs">Categoría</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="field-activo-costo" className="text-xs">Costo (MXN)</Label>
              <Input id="field-activo-costo" type="number" min={0} step="0.01" value={costo} onChange={(e) => setCosto(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Pago con</Label>
              <Select value={cuentaAbono} onValueChange={(v) => setCuentaAbono(v as "102" | "201")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="102">Bancos (contado)</SelectItem>
                  <SelectItem value="201">Proveedores (crédito)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="field-activo-notas" className="text-xs">Notas (opcional)</Label>
            <Input id="field-activo-notas" value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
          <Button size="sm" onClick={handleRegistrar} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />} Registrar y generar póliza
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          {loading ? <Skeleton className="h-40 w-full rounded-xl" /> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin activos fijos registrados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Fecha</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Nombre</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Categoría</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-4">{r.fecha_adquisicion}</td>
                      <td className="py-2 pr-4">{r.nombre}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{CATEGORIAS.find((c) => c.value === r.categoria)?.label ?? r.categoria}</td>
                      <td className="py-2 text-right font-medium">{fmtMXN(r.costo_centavos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
