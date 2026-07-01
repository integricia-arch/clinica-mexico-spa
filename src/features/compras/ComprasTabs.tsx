import { ComprasNavProvider, useComprasNav } from "@/features/compras/ComprasNavContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useCxpAlertas } from "@/hooks/useCxpAlertas";
import DashboardCompras from "./DashboardCompras";
import SolicitudesCompra from "./SolicitudesCompra";
import OrdenesCompra from "./OrdenesCompra";
import RecepcionMercancia from "./RecepcionMercancia";
import FacturasProveedor from "./FacturasProveedor";
import ReporteAgingCxP from "./ReporteAgingCxP";
import DevolucionesProveedor from "./DevolucionesProveedor";
import EvaluacionProveedores from "./EvaluacionProveedores";
import CotizacionesPanel from "./CotizacionesPanel";
import PresupuestoPanel from "./PresupuestoPanel";
import BitacoraTemperaturaPanel from "./BitacoraTemperaturaPanel";
import AuditLogPanel from "./AuditLogPanel";

interface Medicamento { id: string; nombre: string; unidad: string; }

function ComprasTabsInner({ medicamentos }: { medicamentos: Medicamento[] }) {
  const { tab, navigateTo } = useComprasNav();
  const { hasRole } = useAuth();
  const { activeClinicId } = useActiveClinic();
  const { pendientes: alertasPendientes } = useCxpAlertas(activeClinicId);

  return (
    <Tabs value={tab} onValueChange={(t) => navigateTo(t)}>
      <TabsList className="flex-wrap">
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="solicitudes">Solicitudes</TabsTrigger>
        <TabsTrigger value="cotizaciones">Cotizaciones</TabsTrigger>
        <TabsTrigger value="oc">Órdenes de Compra</TabsTrigger>
        <TabsTrigger value="recepcion">Recepción</TabsTrigger>
        <TabsTrigger value="cxp" className="gap-1.5">
          Cuentas por Pagar
          {alertasPendientes.length > 0 && (
            <Badge variant="destructive" className="h-5 px-1.5 text-xs">{alertasPendientes.length}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="aging">Aging</TabsTrigger>
        <TabsTrigger value="devoluciones">Devoluciones</TabsTrigger>
        <TabsTrigger value="evaluacion">Evaluación</TabsTrigger>
        <TabsTrigger value="presupuesto">Presupuesto</TabsTrigger>
        <TabsTrigger value="temperatura">Temperatura</TabsTrigger>
        {(hasRole("admin") || hasRole("manager")) && (
          <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="dashboard"    className="mt-4"><DashboardCompras /></TabsContent>
      <TabsContent value="solicitudes"  className="mt-4"><SolicitudesCompra medicamentos={medicamentos} /></TabsContent>
      <TabsContent value="cotizaciones" className="mt-4"><CotizacionesPanel /></TabsContent>
      <TabsContent value="oc"           className="mt-4"><OrdenesCompra /></TabsContent>
      <TabsContent value="recepcion"    className="mt-4"><RecepcionMercancia /></TabsContent>
      <TabsContent value="cxp"          className="mt-4"><FacturasProveedor /></TabsContent>
      <TabsContent value="aging"        className="mt-4"><ReporteAgingCxP /></TabsContent>
      <TabsContent value="devoluciones" className="mt-4"><DevolucionesProveedor /></TabsContent>
      <TabsContent value="evaluacion"   className="mt-4"><EvaluacionProveedores /></TabsContent>
      <TabsContent value="presupuesto"  className="mt-4"><PresupuestoPanel /></TabsContent>
      <TabsContent value="temperatura"  className="mt-4"><BitacoraTemperaturaPanel /></TabsContent>
      <TabsContent value="auditoria"    className="mt-4"><AuditLogPanel /></TabsContent>
    </Tabs>
  );
}

export default function ComprasTabs({ medicamentos }: { medicamentos: Medicamento[] }) {
  return (
    <ComprasNavProvider>
      <ComprasTabsInner medicamentos={medicamentos} />
    </ComprasNavProvider>
  );
}
