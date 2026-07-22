import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { untypedTable } from "@/lib/untypedTable";
import { friendlyError } from "@/lib/errors";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { calcularTotales, polizaCuadra, lineasValidas as validarLineas, construirPartidas, type LineaDraft } from "./polizaValidation";

interface CuentaOption { id: string; codigo: string; nombre: string }

const TIPOS = [
  { value: "diario", label: "Diario" },
  { value: "ingreso", label: "Ingreso" },
  { value: "egreso", label: "Egreso" },
];

export function NuevaPolizaDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const { activeClinicId } = useActiveClinic();
  const [cuentas, setCuentas] = useState<CuentaOption[]>([]);
  const [tipo, setTipo] = useState("diario");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [concepto, setConcepto] = useState("");
  const [lineas, setLineas] = useState<LineaDraft[]>([
    { cuentaId: "", lado: "cargo", monto: "" },
    { cuentaId: "", lado: "abono", monto: "" },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await untypedTable("cuentas_contables").select("id,codigo,nombre").order("codigo");
      setCuentas((data ?? []) as CuentaOption[]);
    })();
  }, [open]);

  const addLinea = () => setLineas((prev) => [...prev, { cuentaId: "", lado: "cargo", monto: "" }]);
  const removeLinea = (idx: number) => setLineas((prev) => prev.filter((_, i) => i !== idx));
  const updateLinea = (idx: number, patch: Partial<LineaDraft>) =>
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const { totalCargo, totalAbono } = calcularTotales(lineas);
  const cuadra = polizaCuadra(totalCargo, totalAbono);
  const lineasSonValidas = validarLineas(lineas);

  const reset = () => {
    setConcepto("");
    setLineas([{ cuentaId: "", lado: "cargo", monto: "" }, { cuentaId: "", lado: "abono", monto: "" }]);
  };

  const handleGuardar = async () => {
    if (!activeClinicId || !concepto.trim() || !lineasSonValidas || !cuadra) return;
    setSaving(true);
    const partidas = construirPartidas(lineas);
    const { error } = await (supabase as any).rpc("crear_poliza", {
      p_payload: { clinic_id: activeClinicId, tipo, fecha, concepto: concepto.trim(), partidas },
    });
    setSaving(false);
    if (error) { toast.error(friendlyError(error, "No se pudo crear la póliza.")); return; }
    toast.success("Póliza creada");
    reset();
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Nueva póliza manual</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="field-nueva-poliza-fecha" className="text-xs">Fecha</Label>
              <Input id="field-nueva-poliza-fecha" type="date" className="h-9" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="field-nueva-poliza-concepto" className="text-xs">Concepto</Label>
            <Input id="field-nueva-poliza-concepto" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Descripción de la póliza" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Cuentas afectadas (cargo/abono)</Label>
            {lineas.map((l, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select value={l.cuentaId} onValueChange={(v) => updateLinea(idx, { cuentaId: v })}>
                  <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="Cuenta" /></SelectTrigger>
                  <SelectContent>
                    {cuentas.map((c) => <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={l.lado} onValueChange={(v) => updateLinea(idx, { lado: v as "cargo" | "abono" })}>
                  <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cargo">Cargo</SelectItem>
                    <SelectItem value="abono">Abono</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" min={0} step="0.01" className="h-9 w-32" placeholder="Monto"
                  value={l.monto} onChange={(e) => updateLinea(idx, { monto: e.target.value })} />
                <Button variant="ghost" size="icon" onClick={() => removeLinea(idx)} disabled={lineas.length <= 2} aria-label="Quitar línea">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addLinea}><Plus className="mr-1 h-4 w-4" /> Agregar línea</Button>
          </div>

          <div className={`text-sm rounded-md border p-2 ${cuadra ? "border-emerald-300 text-emerald-700" : "border-destructive/40 text-destructive"}`}>
            Cargo: ${totalCargo.toFixed(2)} — Abono: ${totalAbono.toFixed(2)} — {cuadra ? "Cuadra" : "No cuadra"}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGuardar} disabled={saving || !cuadra || !lineasSonValidas || !concepto.trim()}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Guardar póliza
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
