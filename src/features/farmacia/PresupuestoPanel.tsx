import { useEffect, useState } from "react";
import { usePresupuesto, type PresupuestoEjecucion, type NuevoPresupuesto } from "@/hooks/usePresupuesto";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, AlertTriangle, XCircle, Plus, RefreshCw, Trash2 } from "lucide-react";

const CATEGORIAS = [
  "Analgésico","Antibiótico","Antiinflamatorio","Antihipertensivo","Antidiabético",
  "Gastrointestinal","Antihistamínico","Broncodilatador","Neurológico","Soluciones","Vitaminas","Tópico","Otro",
];

const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const fmt = (c: number) => (c / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function PctBar({ pct, alerta }: { pct: number; alerta: number }) {
  const clamped = Math.min(pct, 100);
  const color = pct >= 100 ? "bg-red-600" : pct >= alerta ? "bg-orange-400" : "bg-green-500";
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function PctBadge({ pct, alerta }: { pct: number; alerta: number }) {
  if (pct >= 100) return (
    <Badge className="bg-red-600 text-white gap-1"><XCircle className="h-3 w-3" />{pct}%</Badge>
  );
  if (pct >= alerta) return (
    <Badge className="bg-orange-500 text-white gap-1"><AlertTriangle className="h-3 w-3" />{pct}%</Badge>
  );
  return <Badge variant="outline" className="text-green-700 border-green-400">{pct}%</Badge>;
}

const HOY = new Date();

export default function PresupuestoPanel() {
  const { fetchEjecucion, upsertPresupuesto, deletePresupuesto, loading, error } = usePresupuesto();
  const { toast } = useToast();

  const [mes, setMes] = useState(HOY.getMonth() + 1);
  const [anio, setAnio] = useState(HOY.getFullYear());
  const [data, setData] = useState<PresupuestoEjecucion[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState<NuevoPresupuesto>({
    categoria: "Analgésico",
    periodo_mes: HOY.getMonth() + 1,
    periodo_anio: HOY.getFullYear(),
    monto_presupuestado_centavos: 0,
    alerta_pct: 80,
  });
  const [montoInput, setMontoInput] = useState("");

  const cargar = async () => {
    const rows = await fetchEjecucion(mes, anio);
    setData(rows);
  };

  useEffect(() => { cargar(); }, [mes, anio]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const monto = Math.round(parseFloat(montoInput.replace(/,/g, "")) * 100);
    if (isNaN(monto) || monto <= 0) {
      toast({ title: "Monto inválido", variant: "destructive" });
      return;
    }
    try {
      await upsertPresupuesto({ ...form, monto_presupuestado_centavos: monto });
      toast({ title: "Presupuesto guardado" });
      setShowForm(false);
      setMontoInput("");
      await cargar();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este presupuesto?")) return;
    try {
      await deletePresupuesto(id);
      await cargar();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const anios = Array.from({ length: 4 }, (_, i) => HOY.getFullYear() - 1 + i);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          <h2 className="text-lg font-semibold">Control Presupuestal por Categoría</h2>
        </div>
        <div className="flex gap-2">
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {anios.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={cargar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-lg border p-4 space-y-4 bg-muted/30">
          <h3 className="text-sm font-semibold">Agregar / actualizar presupuesto</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label>Categoría</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Mes</Label>
              <Select value={String(form.periodo_mes)} onValueChange={(v) => setForm({ ...form, periodo_mes: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Año</Label>
              <Select value={String(form.periodo_anio)} onValueChange={(v) => setForm({ ...form, periodo_anio: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anios.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Monto presupuestado (MXN)</Label>
              <Input
                type="text"
                placeholder="50,000.00"
                value={montoInput}
                onChange={(e) => setMontoInput(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>% alerta</Label>
              <Input
                type="number"
                min="50"
                max="100"
                value={form.alerta_pct}
                onChange={(e) => setForm({ ...form, alerta_pct: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-2 xl:col-span-3 flex items-end gap-2">
              <Button type="submit" disabled={loading}>Guardar</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </form>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {data.length === 0 && !loading && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Sin presupuestos para {MESES[mes - 1]} {anio}. Agrega uno con el botón "Nuevo".
        </div>
      )}

      <div className="space-y-3">
        {data.map((row) => {
          const restante = row.monto_presupuestado_centavos - row.ejecutado_centavos;
          return (
            <div key={row.id} className={`rounded-lg border p-4 space-y-2 ${row.pct_ejecutado >= 100 ? "border-red-300 bg-red-50" : row.pct_ejecutado >= row.alerta_pct ? "border-orange-200 bg-orange-50" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{row.categoria}</span>
                  <PctBadge pct={Number(row.pct_ejecutado)} alerta={row.alerta_pct} />
                  {row.pct_ejecutado >= 100 && (
                    <span className="text-xs text-red-700 font-medium">PRESUPUESTO AGOTADO</span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(row.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <PctBar pct={Number(row.pct_ejecutado)} alerta={row.alerta_pct} />

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Presupuestado</p>
                  <p className="font-medium">{fmt(row.monto_presupuestado_centavos)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ejecutado</p>
                  <p className={`font-medium ${row.pct_ejecutado >= 100 ? "text-red-700" : ""}`}>
                    {fmt(row.ejecutado_centavos)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Disponible</p>
                  <p className={`font-medium ${restante < 0 ? "text-red-700" : "text-green-700"}`}>
                    {fmt(Math.max(0, restante))}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
