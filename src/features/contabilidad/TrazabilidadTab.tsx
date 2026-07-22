import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";

export interface TrazaActor {
  user_id: string;
  nombre: string;
}

export interface TrazaNodo {
  tipo: string;
  id?: string;
  folio?: string | null;
  fecha?: string | null;
  monto_centavos?: number | null;
  estado?: string | null;
  creado_por?: TrazaActor | null;
  autorizado_por?: TrazaActor | null;
  mensaje?: string;
  hijos?: TrazaNodo[];
}

const TIPOS = [
  "solicitud_compra", "cotizacion", "orden_compra", "recepcion_mercancia",
  "factura_proveedor", "pago_proveedor", "poliza",
  "appointment", "appointment_insumo", "movimiento_caja",
  "pharmacy_sale", "loyalty_movimiento", "cfdi_documento",
];

function fmtMXN(centavos?: number | null) {
  if (centavos == null) return "";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(centavos / 100);
}

function NodoCard({ nodo, nivel }: { nodo: TrazaNodo; nivel: number }) {
  if (nodo.tipo === "HUECO") {
    return (
      <div style={{ marginLeft: nivel * 20 }} className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {nodo.mensaje}
      </div>
    );
  }
  return (
    <div style={{ marginLeft: nivel * 20 }} className="space-y-2">
      <Card>
        <CardContent className="p-3 text-sm">
          <div className="font-semibold">
            {nodo.tipo}
            {nodo.folio ? <> — <span>{nodo.folio}</span></> : null}
          </div>
          <div className="text-muted-foreground">
            {nodo.fecha ?? ""} {nodo.estado ? `· ${nodo.estado}` : ""} {fmtMXN(nodo.monto_centavos)}
          </div>
          {nodo.creado_por && <div>Creó: <span>{nodo.creado_por.nombre}</span></div>}
          {nodo.autorizado_por && <div>Autorizó: <span>{nodo.autorizado_por.nombre}</span></div>}
        </CardContent>
      </Card>
      {(nodo.hijos ?? []).map((hijo, i) => (
        <NodoCard key={i} nodo={hijo} nivel={nivel + 1} />
      ))}
    </div>
  );
}

export function TrazabilidadTab() {
  const [tipo, setTipo] = useState("solicitud_compra");
  const [idInput, setIdInput] = useState("");
  const [arbol, setArbol] = useState<TrazaNodo | null>(null);
  const [proveedorId, setProveedorId] = useState("");
  const [arboles, setArboles] = useState<TrazaNodo[]>([]);
  const [loading, setLoading] = useState(false);

  const buscarEvento = async () => {
    if (!idInput.trim()) return;
    setLoading(true);
    setArbol(null);
    const { data, error } = await (supabase as any).rpc("contab_trazar", { p_tipo: tipo, p_id: idInput.trim() });
    setLoading(false);
    if (error) { toast.error(friendlyError(error)); return; }
    setArbol(data as TrazaNodo);
  };

  const buscarProveedor = async () => {
    if (!proveedorId.trim()) return;
    setLoading(true);
    setArboles([]);
    const { data, error } = await (supabase as any).rpc("contab_trazar_proveedor", { p_proveedor_id: proveedorId.trim() });
    setLoading(false);
    if (error) { toast.error(friendlyError(error)); return; }
    setArboles(Array.isArray(data) ? (data as TrazaNodo[]) : [data as TrazaNodo]);
  };

  return (
    <Tabs defaultValue="evento">
      <TabsList>
        <TabsTrigger value="evento">Por evento</TabsTrigger>
        <TabsTrigger value="proveedor">Por proveedor</TabsTrigger>
      </TabsList>

      <TabsContent value="evento" className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div>
              <Label htmlFor="traza-tipo">Tipo de evento</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger id="traza-tipo" aria-label="Tipo de evento" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[240px]">
              <Label htmlFor="traza-id">Id o folio</Label>
              <Input id="traza-id" aria-label="Id o folio" value={idInput} onChange={(e) => setIdInput(e.target.value)} placeholder="uuid del registro" />
            </div>
            <Button onClick={buscarEvento} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
            </Button>
          </CardContent>
        </Card>
        {arbol && <NodoCard nodo={arbol} nivel={0} />}
      </TabsContent>

      <TabsContent value="proveedor" className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="flex-1 min-w-[240px]">
              <Label htmlFor="traza-proveedor">Id de proveedor</Label>
              <Input id="traza-proveedor" aria-label="Id de proveedor" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} placeholder="uuid del proveedor" />
            </div>
            <Button onClick={buscarProveedor} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar cadenas"}
            </Button>
          </CardContent>
        </Card>
        {arboles.map((a, i) => <NodoCard key={i} nodo={a} nivel={0} />)}
      </TabsContent>
    </Tabs>
  );
}
