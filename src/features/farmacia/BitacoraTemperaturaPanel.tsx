import { useEffect, useState } from "react";
import { useBitacoraTemperatura, RANGOS_TEMP, type ZonaTemp, type LecturaTemp } from "@/hooks/useBitacoraTemperatura";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Thermometer, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const ZONA_LABELS: Record<ZonaTemp, string> = {
  refrigeracion: "Refrigeración",
  congelacion:   "Congelación",
  cuarto_frio:   "Cuarto Frío",
  ambiente:      "Temperatura Ambiente",
};

function TempBadge({ zona, ultima }: { zona: ZonaTemp; ultima: LecturaTemp | null }) {
  const rango = RANGOS_TEMP[zona];
  if (!ultima) {
    return (
      <div className="rounded-lg border p-4 flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{ZONA_LABELS[zona]}</p>
        <p className="text-2xl font-bold text-muted-foreground">—</p>
        <p className="text-xs text-muted-foreground">Sin registros</p>
      </div>
    );
  }
  const fueraRango = ultima.fuera_de_rango;
  const cardClass = fueraRango
    ? "rounded-lg border border-red-300 bg-red-50 p-4 flex flex-col gap-1"
    : "rounded-lg border border-green-200 bg-green-50 p-4 flex flex-col gap-1";

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{ZONA_LABELS[zona]}</p>
        {fueraRango
          ? <AlertTriangle className="h-4 w-4 text-red-600" />
          : <CheckCircle className="h-4 w-4 text-green-600" />
        }
      </div>
      <p className={`text-2xl font-bold ${fueraRango ? "text-red-700" : "text-green-700"}`}>
        {ultima.temperatura_celsius} °C
      </p>
      <p className="text-xs text-muted-foreground">
        Rango: {rango.min} a {rango.max} °C
      </p>
      {ultima.humedad_pct != null && (
        <p className="text-xs text-muted-foreground">Humedad: {ultima.humedad_pct}%</p>
      )}
      <p className="text-xs text-muted-foreground">
        {format(new Date(ultima.created_at), "dd/MM HH:mm", { locale: es })}
        {ultima.registrado_nombre ? ` — ${ultima.registrado_nombre}` : ""}
      </p>
    </div>
  );
}

export default function BitacoraTemperaturaPanel() {
  const { fetchLecturas, fetchUltimaPorZona, registrarLectura, loading, error } = useBitacoraTemperatura();
  const { toast } = useToast();

  const [ultimas, setUltimas] = useState<Record<ZonaTemp, LecturaTemp | null>>({
    refrigeracion: null, congelacion: null, cuarto_frio: null, ambiente: null,
  });
  const [historial, setHistorial] = useState<LecturaTemp[]>([]);
  const [zonaFiltro, setZonaFiltro] = useState<ZonaTemp | "todas">("todas");

  const [form, setForm] = useState({
    zona: "refrigeracion" as ZonaTemp,
    temperatura_celsius: "",
    humedad_pct: "",
    observaciones: "",
  });

  const cargarUltimas = async () => {
    const u = await fetchUltimaPorZona();
    setUltimas(u);
  };

  const cargarHistorial = async () => {
    const zona = zonaFiltro === "todas" ? undefined : zonaFiltro;
    const data = await fetchLecturas(zona, 50);
    setHistorial(data);
  };

  useEffect(() => { cargarUltimas(); }, []);
  useEffect(() => { cargarHistorial(); }, [zonaFiltro]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const temp = parseFloat(form.temperatura_celsius);
    if (isNaN(temp)) {
      toast({ title: "Temperatura inválida", variant: "destructive" });
      return;
    }
    try {
      const nueva = await registrarLectura({
        zona: form.zona,
        temperatura_celsius: temp,
        humedad_pct: form.humedad_pct ? parseFloat(form.humedad_pct) : undefined,
        observaciones: form.observaciones || undefined,
      });
      toast({
        title: nueva.fuera_de_rango
          ? `⚠️ FUERA DE RANGO: ${temp} °C en ${ZONA_LABELS[form.zona]}`
          : `Lectura registrada: ${temp} °C`,
        variant: nueva.fuera_de_rango ? "destructive" : "default",
      });
      setForm({ zona: form.zona, temperatura_celsius: "", humedad_pct: "", observaciones: "" });
      await cargarUltimas();
      await cargarHistorial();
    } catch {
      /* error ya en state */
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Thermometer className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Bitácora de Temperatura — Cadena Frío</h2>
        </div>
        <Button size="sm" variant="outline" onClick={() => { cargarUltimas(); cargarHistorial(); }} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Estado actual por zona */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {(["refrigeracion","congelacion","cuarto_frio","ambiente"] as ZonaTemp[]).map((z) => (
          <TempBadge key={z} zona={z} ultima={ultimas[z]} />
        ))}
      </div>

      {/* Formulario nueva lectura */}
      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="text-sm font-semibold">Registrar Lectura</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label>Zona</Label>
            <Select value={form.zona} onValueChange={(v) => setForm({ ...form, zona: v as ZonaTemp })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(ZONA_LABELS) as [ZonaTemp, string][]).map(([z, label]) => (
                  <SelectItem key={z} value={z}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Temperatura (°C) *</Label>
            <Input
              type="number"
              step="0.1"
              placeholder={`${RANGOS_TEMP[form.zona].min} a ${RANGOS_TEMP[form.zona].max}`}
              value={form.temperatura_celsius}
              onChange={(e) => setForm({ ...form, temperatura_celsius: e.target.value })}
              required
            />
          </div>

          <div className="space-y-1">
            <Label>Humedad (%)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              placeholder="Opcional"
              value={form.humedad_pct}
              onChange={(e) => setForm({ ...form, humedad_pct: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label>Observaciones</Label>
            <Input
              placeholder="Notas opcionales"
              value={form.observaciones}
              onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
            />
          </div>

          <div className="sm:col-span-2 xl:col-span-4 flex justify-end">
            <Button type="submit" disabled={loading}>Registrar Lectura</Button>
          </div>
        </form>
      </div>

      {/* Historial */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Historial (50 registros)</h3>
          <Select value={zonaFiltro} onValueChange={(v) => setZonaFiltro(v as ZonaTemp | "todas")}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Todas las zonas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las zonas</SelectItem>
              {(Object.entries(ZONA_LABELS) as [ZonaTemp, string][]).map(([z, label]) => (
                <SelectItem key={z} value={z}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Fecha/Hora</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Zona</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Temp (°C)</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Humedad</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Registró</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody>
              {historial.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground text-sm">Sin registros</td></tr>
              )}
              {historial.map((l) => (
                <tr key={l.id} className={`border-b last:border-0 ${l.fuera_de_rango ? "bg-red-50" : ""}`}>
                  <td className="px-3 py-2 text-xs font-mono">
                    {format(new Date(l.created_at), "dd/MM/yy HH:mm", { locale: es })}
                  </td>
                  <td className="px-3 py-2 text-xs">{ZONA_LABELS[l.zona]}</td>
                  <td className={`px-3 py-2 text-right font-medium ${l.fuera_de_rango ? "text-red-600" : "text-green-700"}`}>
                    {l.temperatura_celsius}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                    {l.humedad_pct != null ? `${l.humedad_pct}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[120px]">
                    {l.registrado_nombre ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {l.fuera_de_rango
                      ? <Badge className="bg-red-600 text-white text-xs">Fuera de rango</Badge>
                      : <Badge variant="outline" className="text-green-700 border-green-400 text-xs">OK</Badge>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
