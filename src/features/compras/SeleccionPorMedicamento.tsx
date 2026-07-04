import { useMemo, useState } from "react";
import { type Cotizacion } from "@/hooks/useCotizaciones";
import { useCotizaciones } from "@/hooks/useCotizaciones";
import { useOrdenesCompra } from "@/hooks/useOrdenesCompra";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Split } from "lucide-react";

const fmt = (c: number) => (c / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

interface Props {
  cotizaciones: Cotizacion[];
  onGenerado: () => void;
}

interface FilaComparativa {
  key: string;
  medicamento_id: string;
  descripcion: string;
  opciones: { cotizacion_id: string; proveedor_id: string; proveedor_nombre: string; precio_unitario_centavos: number; cantidad: number; tasa_iva: number }[];
}

export default function SeleccionPorMedicamento({ cotizaciones, onGenerado }: Props) {
  const { activeClinicId } = useActiveClinic();
  const { vincularOrdenCompra } = useCotizaciones();
  const { create } = useOrdenesCompra(activeClinicId);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [seleccion, setSeleccion] = useState<Record<string, string>>({}); // medicamento_id -> cotizacion_id elegida

  const filas: FilaComparativa[] = useMemo(() => {
    const porMedicamento: Record<string, FilaComparativa> = {};
    for (const c of cotizaciones) {
      for (const it of c.items ?? []) {
        if (!it.medicamento_id) continue; // solo items ligados a catálogo pueden dividirse por proveedor
        const key = it.medicamento_id;
        if (!porMedicamento[key]) {
          porMedicamento[key] = { key, medicamento_id: key, descripcion: it.descripcion, opciones: [] };
        }
        porMedicamento[key].opciones.push({
          cotizacion_id: c.id,
          proveedor_id: c.proveedor_id,
          proveedor_nombre: c.proveedor?.nombre ?? "—",
          precio_unitario_centavos: it.precio_unitario_centavos,
          cantidad: it.cantidad,
          tasa_iva: it.iva_aplica === false ? 0 : 0.16,
        });
      }
    }
    return Object.values(porMedicamento).filter((f) => f.opciones.length > 1);
  }, [cotizaciones]);

  if (filas.length === 0) return null;

  const efectivaSeleccion = (f: FilaComparativa) => {
    if (seleccion[f.medicamento_id]) return seleccion[f.medicamento_id];
    const masBarato = [...f.opciones].sort((a, b) => a.precio_unitario_centavos - b.precio_unitario_centavos)[0];
    return masBarato.cotizacion_id;
  };

  const handleGenerar = async () => {
    setSaving(true);
    try {
      const porProveedor: Record<string, { proveedor_id: string; cotizacion_id: string; items: FilaComparativa["opciones"][number][] }> = {};
      for (const f of filas) {
        const cotId = efectivaSeleccion(f);
        const opt = f.opciones.find((o) => o.cotizacion_id === cotId);
        if (!opt) continue;
        if (!porProveedor[opt.proveedor_id]) {
          porProveedor[opt.proveedor_id] = { proveedor_id: opt.proveedor_id, cotizacion_id: cotId, items: [] };
        }
        porProveedor[opt.proveedor_id].items.push(opt);
      }

      const grupos = Object.values(porProveedor);
      if (!grupos.length) {
        toast({ title: "Nada que generar", variant: "destructive" });
        return;
      }

      for (const grupo of grupos) {
        const ocId = await create({
          proveedor_id: grupo.proveedor_id,
          fecha_entrega_est: "",
          terminos_pago: 30,
          notas: "Generada desde comparativa multi-proveedor",
          items: grupo.items.map((it) => ({
            medicamento_id: filas.find((f) => f.opciones.includes(it))?.medicamento_id ?? "",
            cantidad_pedida: it.cantidad,
            precio_unitario_centavos: it.precio_unitario_centavos,
            tasa_iva: it.tasa_iva,
          })),
        });
        await vincularOrdenCompra(grupo.cotizacion_id, ocId);
      }
      toast({ title: `${grupos.length} orden(es) de compra generada(s)` });
      onGenerado();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error al generar órdenes", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border overflow-hidden mt-3">
      <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2">
        <Split className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Selección por medicamento — puede surtirse con más de un proveedor
        </p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/20 border-b">
          <tr>
            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Medicamento</th>
            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Comprar a</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const elegido = efectivaSeleccion(f);
            return (
              <tr key={f.key} className="border-b last:border-0">
                <td className="px-3 py-2">{f.descripcion}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-3">
                    {f.opciones.map((o) => (
                      <label key={o.cotizacion_id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name={`prov-${f.medicamento_id}`}
                          checked={elegido === o.cotizacion_id}
                          onChange={() => setSeleccion((prev) => ({ ...prev, [f.medicamento_id]: o.cotizacion_id }))}
                        />
                        {o.proveedor_nombre} — {fmt(o.precio_unitario_centavos)}
                      </label>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="p-3 flex justify-end">
        <Button size="sm" onClick={handleGenerar} disabled={saving}>
          {saving ? "Generando…" : "Generar Órdenes de Compra"}
        </Button>
      </div>
    </div>
  );
}
