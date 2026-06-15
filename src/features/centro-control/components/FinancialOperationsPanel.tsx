import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CreditCard, Clock, TrendingUp, FileWarning,
  ShoppingCart, AlertCircle, Package, ChevronRight,
} from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";
import type { FinancialDashboardData } from "../hooks/useFinancialDashboardData";

interface Props {
  data: FinancialDashboardData;
  loading: boolean;
}

function fmtMXN(centavos: number) {
  return (centavos / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function elapsedLabel(since: string) {
  const mins = differenceInMinutes(new Date(), new Date(since));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

interface AlertChipProps {
  count: number;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "warning" | "destructive" | "info";
  to: string;
}

function AlertChip({ count, label, icon: Icon, variant, to }: AlertChipProps) {
  const navigate = useNavigate();
  if (count === 0) return null;
  const cls =
    variant === "destructive"
      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
      : variant === "warning"
        ? "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
        : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100";
  return (
    <button
      onClick={() => navigate(to)}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${cls}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{count} {label}</span>
      <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
    </button>
  );
}

export default function FinancialOperationsPanel({ data, loading }: Props) {
  const navigate = useNavigate();

  const hasAlerts =
    data.actasPendientes > 0 ||
    data.ocPendientes > 0 ||
    data.cxpVencidas > 0 ||
    data.faltantesFarmacia > 0;

  if (loading) return null;

  return (
    <div className="space-y-3">
      {/* Turnos activos */}
      {data.turnos.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Turnos activos
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.turnos.map((t) => (
              <Card key={t.id} className="border-green-200 bg-green-50/40">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-green-600 shrink-0" />
                      <span className="font-semibold text-sm text-foreground">{t.caja_nombre}</span>
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-0 text-xs">Abierto</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Tiempo abierto
                      </p>
                      <p className="font-medium">{elapsedLabel(t.abierto_at)}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground">Apertura</p>
                      <p className="font-medium">{format(new Date(t.abierto_at), "HH:mm", { locale: es })}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground">Fondo inicial</p>
                      <p className="font-medium">{fmtMXN(t.monto_apertura * 100)}</p>
                    </div>
                    {t.pharmacy_shift_id && (
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" /> Ventas turno
                        </p>
                        <p className="font-semibold text-green-700">{fmtMXN(t.ventas_turno_centavos)}</p>
                      </div>
                    )}
                  </div>

                  <Button
                    size="sm" variant="outline"
                    className="w-full text-xs h-7"
                    onClick={() => navigate("/caja")}
                  >
                    Ir a Caja
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Sin turno activo */}
      {data.turnos.length === 0 && (
        <div className="flex items-center justify-between rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Sin turno de caja activo
          </div>
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => navigate("/caja")}>
            Abrir turno
          </Button>
        </div>
      )}

      {/* Alertas operativas no-clínicas */}
      {hasAlerts && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Alertas operativas
          </h2>
          <div className="flex flex-wrap gap-2">
            <AlertChip
              count={data.actasPendientes}
              label={data.actasPendientes === 1 ? "acta merma pendiente firma" : "actas merma pendientes firma"}
              icon={FileWarning}
              variant="warning"
              to="/farmacia"
            />
            <AlertChip
              count={data.ocPendientes}
              label={data.ocPendientes === 1 ? "OC pendiente aprobación" : "OC pendientes aprobación"}
              icon={ShoppingCart}
              variant="warning"
              to="/farmacia"
            />
            <AlertChip
              count={data.cxpVencidas}
              label={data.cxpVencidas === 1 ? "factura CxP vencida" : "facturas CxP vencidas"}
              icon={AlertCircle}
              variant="destructive"
              to="/farmacia"
            />
            <AlertChip
              count={data.faltantesFarmacia}
              label={data.faltantesFarmacia === 1 ? "faltante farmacia" : "faltantes farmacia"}
              icon={Package}
              variant="info"
              to="/farmacia"
            />
          </div>
        </div>
      )}
    </div>
  );
}
