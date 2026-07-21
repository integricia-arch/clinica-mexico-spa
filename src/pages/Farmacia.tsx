import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SurtirReceta from "@/features/farmacia/SurtirReceta";
import PuntoDeVenta from "@/features/farmacia/PuntoDeVenta";
import SolicitudesInsumos from "@/features/farmacia/SolicitudesInsumos";
import CajaTurno from "@/pages/CajaTurno";
import CorteTurno from "@/features/caja/CorteTurno";
import { useTurno } from "@/components/TurnoGuard";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { Lock } from "lucide-react";
import { VerAsientoContableButton } from "@/features/contabilidad/VerAsientoContableButton";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type Medicamento = Tables<"medicamentos">;

type PharmacySale = {
  id: string;
  created_at: string;
  customer_name: string | null;
  status: string;
  total: number;
};

const formatMXN = (n: number) =>
  Number(n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function HistorialVentas() {
  const { activeClinicId } = useActiveClinic();
  const [sales, setSales] = useState<PharmacySale[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const highlightRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (!activeClinicId) return;
    setLoading(true);
    (supabase as any)
      .from("pharmacy_sales")
      .select("id, created_at, customer_name, status, total")
      .eq("clinic_id", activeClinicId)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }: { data: PharmacySale[] | null }) => {
        setSales(data ?? []);
        setLoading(false);
      });
  }, [activeClinicId]);

  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, sales]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <h3 className="font-semibold text-sm">Historial de ventas</h3>
      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : sales.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin ventas registradas.</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="text-left">Folio</th>
                <th className="text-left">Fecha</th>
                <th className="text-left">Cliente</th>
                <th className="text-left">Status</th>
                <th className="text-right">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr
                  key={s.id}
                  ref={s.id === highlightId ? highlightRef : undefined}
                  className={`border-t border-border ${s.id === highlightId ? "ring-2 ring-primary" : ""}`}
                >
                  <td className="font-mono py-1">{s.id.slice(0, 8).toUpperCase()}</td>
                  <td>{format(new Date(s.created_at), "dd/MM/yy HH:mm", { locale: es })}</td>
                  <td>{s.customer_name ?? "—"}</td>
                  <td>
                    <Badge variant={s.status === "cancelled" ? "destructive" : "outline"} className="text-[10px]">
                      {s.status}
                    </Badge>
                  </td>
                  <td className="text-right">{formatMXN(Number(s.total))}</td>
                  <td className="py-1">
                    <VerAsientoContableButton referenceType="pharmacy_sale" referenceId={s.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Farmacia() {
  const turnoCtx = useTurno();

  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [tab, setTab] = useState("pos");
  const [prescriptionScan, setPrescriptionScan] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: meds } = await (supabase as any).from("medicamentos").select("*").eq("activo", true).order("nombre");
    setMedicamentos(meds ?? []);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Farmacia</h1>
          {turnoCtx && (
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm text-muted-foreground">{turnoCtx.openTurno.caja_nombre}</p>
              <Badge variant="outline" className="text-green-600 border-green-500/40 text-xs">Abierto</Badge>
            </div>
          )}
        </div>
        {turnoCtx && (
          <Button
            variant="outline" size="sm"
            onClick={turnoCtx.initiateClose}
            className="gap-2 text-destructive border-destructive/40 hover:bg-destructive/5"
          >
            <Lock className="h-4 w-4" />
            Cerrar turno
          </Button>
        )}
      </div>
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="pos">Punto de Venta</TabsTrigger>
          <TabsTrigger value="surtir">Surtir receta</TabsTrigger>
          <TabsTrigger value="insumos">Insumos</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="cierre">Cierre</TabsTrigger>
        </TabsList>
        <TabsContent value="pos" forceMount className={tab !== "pos" ? "hidden" : ""}>
          <PuntoDeVenta
            onScanPrescription={(code) => { setPrescriptionScan(code); setTab("surtir"); }}
          />
        </TabsContent>
        <TabsContent value="surtir">
          <SurtirReceta initialCode={prescriptionScan ?? undefined} />
        </TabsContent>
        <TabsContent value="insumos">
          <SolicitudesInsumos medicamentos={medicamentos} />
        </TabsContent>
        <TabsContent value="historial">
          <HistorialVentas />
        </TabsContent>
        <TabsContent value="cierre" className="space-y-6">
          <CajaTurno onTurnoCerrado={() => setTab("pos")} />
          <CorteTurno />
        </TabsContent>
      </Tabs>
    </div>
  );
}
