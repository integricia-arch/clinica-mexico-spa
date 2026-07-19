import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { untypedTable } from "@/lib/untypedTable";
import { friendlyError } from "@/lib/errors";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useInsumos } from "@/hooks/useInsumos";

/**
 * Fase 1 módulo contable: registro de insumos consumidos en una cita.
 * Escritura SOLO vía RPC registrar_insumos_cita (atómica: snapshot de costo +
 * descuento de stock). La tabla appointment_insumos no acepta DML directo.
 */

interface RegistradoRow {
  id: string;
  tipo: "consumo" | "reversa";
  cantidad: number;
  costo_unitario_centavos: number;
  insumos: { nombre: string } | null;
}

interface DraftItem {
  insumoId: string;
  cantidad: number;
}

export default function InsumosCitaSection({
  appointmentId,
  closed,
}: {
  appointmentId: string;
  closed: boolean;
}) {
  const { activeClinicId } = useActiveClinic();
  const { items: catalogo } = useInsumos(activeClinicId);
  const [registrados, setRegistrados] = useState<RegistradoRow[]>([]);
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);

  const loadRegistrados = useCallback(async () => {
    const { data, error } = await untypedTable("appointment_insumos")
      .select("id, tipo, cantidad, costo_unitario_centavos, insumos(nombre)")
      .eq("appointment_id", appointmentId)
      .order("created_at");
    if (error) {
      toast.error(friendlyError(error, "No se pudieron cargar los insumos de la cita."));
      return;
    }
    setRegistrados((data ?? []) as unknown as RegistradoRow[]);
  }, [appointmentId]);

  useEffect(() => {
    loadRegistrados();
  }, [loadRegistrados]);

  const disponibles = catalogo.filter((i) => i.activo);

  const addRow = () => setDraft((prev) => [...prev, { insumoId: "", cantidad: 1 }]);

  const updateRow = (idx: number, patch: Partial<DraftItem>) =>
    setDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const removeRow = (idx: number) => setDraft((prev) => prev.filter((_, i) => i !== idx));

  const handleRegistrar = async () => {
    const items = draft.filter((r) => r.insumoId && r.cantidad > 0);
    if (items.length === 0) {
      toast.error("Agrega al menos un insumo con cantidad.");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).rpc("registrar_insumos_cita", {
      p_appointment_id: appointmentId,
      p_items: items.map((r) => ({ insumo_id: r.insumoId, cantidad: r.cantidad })),
    });
    setSaving(false);
    if (error) {
      toast.error(friendlyError(error, "No se pudo registrar el consumo."));
      return;
    }
    toast.success("Insumos registrados; inventario actualizado.");
    setDraft([]);
    await loadRegistrados();
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <Label className="font-medium">Insumos utilizados</Label>

      {registrados.length > 0 && (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {registrados.map((r) => (
            <li key={r.id}>
              {r.tipo === "reversa" ? "↩︎ " : ""}
              {r.insumos?.nombre ?? "Insumo"} × {r.cantidad} — $
              {((r.costo_unitario_centavos * r.cantidad) / 100).toFixed(2)}
              {r.tipo === "reversa" ? " (reversa)" : ""}
            </li>
          ))}
        </ul>
      )}

      {draft.map((row, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Select value={row.insumoId} onValueChange={(v) => updateRow(idx, { insumoId: v })}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Selecciona insumo" />
            </SelectTrigger>
            <SelectContent>
              {disponibles.map((i) => (
                <SelectItem key={i.id} value={i.id} disabled={i.stock <= 0}>
                  {i.nombre} (stock: {i.stock})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={1}
            className="w-20"
            value={row.cantidad}
            onChange={(e) => updateRow(idx, { cantidad: Math.max(1, Number(e.target.value) || 1) })}
          />
          <Button variant="ghost" size="icon" onClick={() => removeRow(idx)} aria-label="Quitar insumo">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {!closed && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="mr-1 h-4 w-4" /> Agregar insumo
          </Button>
          {draft.length > 0 && (
            <Button size="sm" onClick={handleRegistrar} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Registrar consumo
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
